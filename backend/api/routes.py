"""API routes for KrypticTrack backend."""

from flask import Blueprint, request, jsonify, current_app
import time
import json
import threading
import subprocess
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

api_bp = Blueprint('api', __name__)

# Training state (in-memory, could be moved to database)
training_state = {
    'status': 'idle',  # idle, training, completed, error, stopped
    'progress': 0,
    'current_epoch': 0,
    'total_epochs': 0,
    'message': '',
    'started_at': None,
    'completed_at': None,
    'model_path': None,
    'error': None,
    'logs': [],  # Training logs (last 100 lines)
    'metrics': {  # Current epoch metrics
        'loss': None,
        'reward_mean': None,
        'reward_std': None,
        'learning_rate': None
    },
    'history': {  # Training history
        'loss': [],
        'reward_mean': [],
        'reward_std': []
    }
}
training_lock = threading.Lock()
training_process = None  # Store the subprocess so we can kill it
MAX_LOG_LINES = 100


@api_bp.route('/log-action', methods=['POST'])
def log_action():
    """
    Receive action data from any source (VS Code, Chrome, System).
    
    Expected JSON:
    {
        "source": "vscode" | "chrome" | "system",
        "action_type": "file_edit" | "page_visit" | "app_switch" | etc.,
        "context": {
            ...action-specific context...
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Validate required fields - support both 'context' and 'context_json'
        required_fields = ['source', 'action_type']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Filter out high-frequency/noisy actions that bloat the neural network
        # These events are too frequent and don't provide meaningful signal
        FILTERED_ACTION_TYPES = {
            'dom_change',  # Too frequent, not useful
            'mouse_move',  # Too frequent, creates bloat
            'mouse_enter',  # Too frequent, creates bloat
            'mouse_leave',  # Too frequent, creates bloat
        }
        
        action_type = data.get('action_type')
        if action_type in FILTERED_ACTION_TYPES:
            return jsonify({'success': True, 'message': f'Ignored (filtered: {action_type})'}), 200
        
        # Handle both 'context' and 'context_json' for backward compatibility
        context_data = data.get('context') or data.get('context_json', {})
        
        # Get database from app context
        db = current_app.config.get('db')
        if not db:
            return jsonify({'error': 'Database not configured'}), 500
        
        session_id = current_app.config.get('current_session_id', '')
        
        # Insert into actions table - use proper transaction handling
        timestamp = time.time()
        context_json = json.dumps(context_data) if isinstance(context_data, dict) else (context_data or '{}')
        
        conn = db.connect()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO actions 
                (timestamp, source, action_type, context_json, session_id)
                VALUES (?, ?, ?, ?, ?)
            """, (timestamp, data['source'], data['action_type'], context_json, session_id))
            
            # Update session record
            cursor.execute("""
                UPDATE sessions 
                SET total_actions = total_actions + 1
                WHERE id = ?
            """, (session_id,))
            
            # Update sources_used array
            cursor.execute("SELECT sources_used FROM sessions WHERE id = ?", (session_id,))
            result = cursor.fetchone()
            sources = json.loads(result[0]) if result and result[0] else []
            if data['source'] not in sources:
                sources.append(data['source'])
                cursor.execute("""
                    UPDATE sessions 
                    SET sources_used = ?
                    WHERE id = ?
                """, (json.dumps(sources), session_id))
            
            conn.commit()
        except Exception as db_error:
            conn.rollback()
            raise db_error
        
        return jsonify({
            'success': True,
            'id': cursor.lastrowid,
            'timestamp': timestamp
        }), 201
        
    except Exception as e:
        # Log to file only, NO console output
        logger = current_app.config.get('logger')
        if logger:
            logger.log_action('error', 'Failed to log action', 
                            error=str(e), source=data.get('source'), 
                            action_type=data.get('action_type'))
        # Return success to prevent retries - error is logged to file
        return jsonify({'success': False, 'error': 'Logged to file'}), 200


@api_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get current session statistics."""
    try:
        db = current_app.config.get('db')
        session_id = current_app.config.get('current_session_id', '')
        
        if not db:
            return jsonify({
                'session_id': session_id,
                'total_actions': 0,
                'active_sources': 0,
                'actions_by_source': {},
                'top_actions': [],
                'recent_actions': [],
                'session_duration_seconds': 0
            }), 200
        
        conn = db.connect()
        cursor = conn.cursor()
        
        # Total actions - Count ALL actions (not just current session) for historical data
        cursor.execute("SELECT COUNT(*) FROM actions")
        result = cursor.fetchone()
        total_actions = result[0] if result else 0
        
        # Active sources - Count distinct sources from ALL actions
        cursor.execute("SELECT COUNT(DISTINCT source) FROM actions")
        result = cursor.fetchone()
        active_sources = result[0] if result else 0
        
        # Actions by source - ALL actions
        cursor.execute("""
            SELECT source, COUNT(*) as count 
            FROM actions 
            GROUP BY source
        """)
        actions_by_source = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Actions by type (top 10) - ALL actions
        cursor.execute("""
            SELECT action_type, COUNT(*) as count 
            FROM actions 
            GROUP BY action_type 
            ORDER BY count DESC 
            LIMIT 10
        """)
        top_actions = [{'type': row[0], 'count': row[1]} for row in cursor.fetchall()]
        
        # Recent actions - Last 10 actions
        cursor.execute("""
            SELECT id, timestamp, source, action_type, context_json
            FROM actions
            ORDER BY timestamp DESC
            LIMIT 10
        """)
        recent_rows = cursor.fetchall()
        recent_actions = []
        for row in recent_rows:
            try:
                context = json.loads(row[4]) if row[4] else {}
            except:
                context = {}
            recent_actions.append({
                'id': row[0],
                'timestamp': row[1],
                'source': row[2],
                'action_type': row[3],
                'context': context
            })
        
        # Session duration and info
        session_duration = 0
        session_start = None
        sources_used = []
        try:
            cursor.execute("SELECT start_time, sources_used FROM sessions WHERE id = ?", (session_id,))
            session_data = cursor.fetchone()
            if session_data:
                session_start = session_data[0]
                session_duration = time.time() - session_start
                sources_used = json.loads(session_data[1]) if session_data[1] else []
        except:
            pass
        
        return jsonify({
            'session_id': session_id,
            'total_actions': total_actions or 0,
            'active_sources': active_sources or 0,
            'actions_by_source': actions_by_source or {},
            'top_actions': top_actions or [],
            'recent_actions': recent_actions or [],
            'session_duration_seconds': session_duration,
            'session_start_time': session_start,
            'sources_used': sources_used
        }), 200
        
    except Exception as e:
        # Return empty stats instead of error
        logger = current_app.config.get('logger')
        if logger:
            logger.log_action('error', 'Failed to get stats', error=str(e))
        return jsonify({
            'session_id': current_app.config.get('current_session_id', ''),
            'total_actions': 0,
            'active_sources': 0,
            'actions_by_source': {},
            'top_actions': [],
            'recent_actions': [],
            'session_duration_seconds': 0,
            'error': str(e)
        }), 200


@api_bp.route('/predictions', methods=['GET'])
def get_predictions():
    """Get model predictions for next likely action."""
    try:
        model_manager = current_app.config.get('model_manager')
        if not model_manager or not model_manager.model_loaded:
            return jsonify({
                'predicted_action': None,
                'confidence': 0.0,
                'message': 'Model not loaded. Train a model first.',
                'available': False
            }), 200
        
        # Get recent actions
        db = current_app.config.get('db')
        if not db:
            return jsonify({
                'predicted_action': None,
                'confidence': 0.0,
                'message': 'Database not available',
                'available': False
            }), 200
        
        conn = db.connect()
        cursor = conn.cursor()
        
        # Get last 20 actions
        cursor.execute("""
            SELECT timestamp, source, action_type, context_json
            FROM actions
            ORDER BY timestamp DESC
            LIMIT 20
        """)
        
        rows = cursor.fetchall()
        recent_actions = []
        for row in rows:
            try:
                context = json.loads(row[3]) if row[3] else {}
            except:
                context = {}
            recent_actions.append({
                'timestamp': row[0],
                'source': row[1],
                'action_type': row[2],
                'context': context
            })
        
        # Reverse to get chronological order
        recent_actions.reverse()
        
        # Get LLM service for explanations
        from backend.services.llm_service import get_llm_service
        llm_service = get_llm_service()
        use_llm = request.args.get('use_llm', 'true').lower() == 'true' and llm_service.is_available()
        
        # Get prediction with optional LLM explanation
        prediction = model_manager.predict_next_action(recent_actions, use_llm=use_llm, llm_service=llm_service if use_llm else None)
        prediction['available'] = True
        prediction['llm_enabled'] = use_llm
        
        return jsonify(prediction), 200
        
    except Exception as e:
        return jsonify({
            'predicted_action': None,
            'confidence': 0.0,
            'message': f'Prediction error: {str(e)}',
            'available': False
        }), 200


@api_bp.route('/model/evaluate', methods=['GET'])
def evaluate_model():
    """Evaluate model performance on recent actions."""
    try:
        model_manager = current_app.config.get('model_manager')
        if not model_manager or not model_manager.model_loaded:
            return jsonify({
                'accuracy': 0.0,
                'avg_reward': 0.0,
                'message': 'Model not loaded',
                'available': False
            }), 200
        
        # Get test actions (last 100)
        db = current_app.config.get('db')
        if not db:
            return jsonify({
                'accuracy': 0.0,
                'avg_reward': 0.0,
                'message': 'Database not available',
                'available': False
            }), 200
        
        conn = db.connect()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT timestamp, source, action_type, context_json
            FROM actions
            ORDER BY timestamp DESC
            LIMIT 100
        """)
        
        rows = cursor.fetchall()
        test_actions = []
        for row in rows:
            try:
                context = json.loads(row[3]) if row[3] else {}
            except:
                context = {}
            test_actions.append({
                'timestamp': row[0],
                'source': row[1],
                'action_type': row[2],
                'context': context
            })
        
        # Reverse to get chronological order
        test_actions.reverse()
        
        # Evaluate
        evaluation = model_manager.evaluate_model(test_actions)
        evaluation['available'] = True
        
        return jsonify(evaluation), 200
        
    except Exception as e:
        return jsonify({
            'accuracy': 0.0,
            'avg_reward': 0.0,
            'message': f'Evaluation error: {str(e)}',
            'available': False
        }), 200


@api_bp.route('/model/info', methods=['GET'])
def model_info():
    """Get information about loaded model."""
    try:
        model_manager = current_app.config.get('model_manager')
        if not model_manager:
            return jsonify({
                'loaded': False,
                'message': 'Model manager not initialized'
            }), 200
        
        # Try to reload latest model if not loaded
        if not model_manager.model_loaded:
            model_manager.load_latest_model()
        
        info = model_manager.get_model_info()
        return jsonify(info), 200
        
    except Exception as e:
        return jsonify({
            'loaded': False,
            'message': f'Error: {str(e)}'
        }), 200


@api_bp.route('/insights', methods=['GET'])
def get_insights():
    """Get behavioral insights."""
    try:
        db = current_app.config.get('db')
        if not db:
            return jsonify({'insights': [], 'error': 'Database not configured'}), 200
        
        conn = db.connect()
        cursor = conn.cursor()
        
        # Check if we should regenerate insights
        force_regenerate = request.args.get('regenerate', 'false').lower() == 'true'
        
        # Get recent insights from database
        cursor.execute("""
            SELECT * FROM insights 
            ORDER BY discovered_at DESC 
            LIMIT 20
        """)
        
        db_insights = cursor.fetchall()
        
        # If no insights or forced regenerate, generate new ones
        if not db_insights or force_regenerate:
            from backend.services.insights_generator import generate_insights
            from backend.services.llm_service import get_llm_service
            
            llm_service = get_llm_service()
            if llm_service.is_available():
                # Load user context for LLM
                llm_service.load_user_context(conn)
            
            generate_insights(conn, llm_service if llm_service.is_available() else None)
            
            # Fetch again after generation
            cursor.execute("""
                SELECT * FROM insights 
                ORDER BY discovered_at DESC 
                LIMIT 20
            """)
            db_insights = cursor.fetchall()
        
        insights = []
        for row in db_insights:
            insights.append({
                'id': row[0],
                'discovered_at': row[1],
                'pattern_type': row[2],
                'description': row[3],
                'confidence': row[4],
                'evidence': json.loads(row[5]) if row[5] else {}
            })
        
        return jsonify({'insights': insights}), 200
        
    except Exception as e:
        logger = current_app.config.get('logger')
        if logger:
            logger.log_action('error', 'Failed to get insights', error=str(e))
        return jsonify({'error': str(e), 'insights': []}), 200


@api_bp.route('/insights/generate', methods=['POST'])
def generate_insights_endpoint():
    """Force regenerate insights."""
    try:
        db = current_app.config.get('db')
        if not db:
            return jsonify({'error': 'Database not configured'}), 500
        
        conn = db.connect()
        
        from backend.services.insights_generator import generate_insights
        from backend.services.llm_service import get_llm_service
        
        llm_service = get_llm_service()
        if llm_service.is_available():
            # Load user context for LLM
            llm_service.load_user_context(conn)
        
        insights = generate_insights(conn, llm_service if llm_service.is_available() else None)
        
        return jsonify({
            'message': f'Generated {len(insights)} insights',
            'count': len(insights)
        }), 200
        
    except Exception as e:
        logger = current_app.config.get('logger')
        if logger:
            logger.log_action('error', 'Failed to generate insights', error=str(e))
        return jsonify({'error': str(e)}), 500


@api_bp.route('/sites/popular', methods=['GET'])
def get_popular_sites():
    """Get most popular sites from history."""
    try:
        db = current_app.config.get('db')
        if not db:
            return jsonify({'sites': [], 'error': 'Database not configured'}), 200
        
        conn = db.connect()
        
        days = request.args.get('days', 7, type=int)
        limit = request.args.get('limit', 20, type=int)
        
        from backend.services.site_popularity import get_popular_sites
        sites = get_popular_sites(conn, days, limit)
        
        return jsonify({'sites': sites}), 200
        
    except Exception as e:
        # Use structured logger instead of console spam
        logger = current_app.config.get('logger')
        if logger:
            logger.log_action('error', 'Failed to get popular sites', error=str(e))
        return jsonify({'error': str(e), 'sites': []}), 200


def run_training(num_epochs=50, learning_rate=0.001, batch_size=64):
    """Run training in background thread with parameters."""
    global training_state
    
    try:
        with training_lock:
            training_state['status'] = 'training'
            training_state['progress'] = 0
            training_state['started_at'] = time.time()
            training_state['error'] = None
        
        # Get project root
        project_root = Path(__file__).parent.parent.parent
        training_script = project_root / 'training' / 'train_irl.py'
        
        # Store parameters in training state
        with training_lock:
            training_state['metrics']['learning_rate'] = learning_rate
            training_state['config'] = {
                'num_epochs': num_epochs,
                'learning_rate': learning_rate,
                'batch_size': batch_size
            }
        
        # Run training script with environment variables for parameters
        # (We'll modify train_irl.py to accept these, or pass via config override)
        import os
        env = os.environ.copy()
        env['TRAINING_EPOCHS'] = str(num_epochs)
        env['TRAINING_LR'] = str(learning_rate)
        env['TRAINING_BATCH_SIZE'] = str(batch_size)
        
        process = subprocess.Popen(
            ['python', str(training_script)],
            cwd=str(project_root),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env
        )
        
        # Store process globally so we can kill it
        global training_process
        with training_lock:
            training_process = process
        
        # Parse output for progress
        current_epoch = 0
        total_epochs = 50  # Default from config
        
        for line in process.stdout:
            # Check if training was stopped
            with training_lock:
                if training_state['status'] == 'stopped':
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except:
                        process.kill()
                    training_state['message'] = 'Training stopped by user'
                    training_state['completed_at'] = time.time()
                    return
            line = line.strip()
            if not line:
                continue
            
            # Store log line
            with training_lock:
                training_state['logs'].append({
                    'timestamp': time.time(),
                    'message': line
                })
                # Keep only last MAX_LOG_LINES
                if len(training_state['logs']) > MAX_LOG_LINES:
                    training_state['logs'] = training_state['logs'][-MAX_LOG_LINES:]
            
            # Parse epoch progress
            if 'Epoch' in line and '/' in line:
                try:
                    parts = line.split('Epoch')[1].split('/')
                    if len(parts) >= 2:
                        current_epoch = int(parts[0].strip())
                        total_epochs = int(parts[1].split()[0])
                        progress = int((current_epoch / total_epochs) * 100)
                        
                        with training_lock:
                            training_state['current_epoch'] = current_epoch
                            training_state['total_epochs'] = total_epochs
                            training_state['progress'] = min(progress, 99)
                            training_state['message'] = f'Epoch {current_epoch}/{total_epochs}'
                except:
                    pass
            
            # Parse metrics: "Loss: 0.0001 | Reward: -0.0010 ± 0.0427"
            if '| Loss:' in line or 'Loss:' in line:
                try:
                    # Extract loss
                    if 'Loss:' in line:
                        loss_part = line.split('Loss:')[1].split('|')[0].strip()
                        loss = float(loss_part.split()[0])
                        
                        # Extract reward mean and std
                        reward_mean = None
                        reward_std = None
                        if 'Reward:' in line:
                            reward_part = line.split('Reward:')[1].strip()
                            if '±' in reward_part:
                                parts = reward_part.split('±')
                                reward_mean = float(parts[0].strip())
                                reward_std = float(parts[1].strip())
                            else:
                                reward_mean = float(reward_part.split()[0])
                        
                        with training_lock:
                            training_state['metrics'] = {
                                'loss': loss,
                                'reward_mean': reward_mean,
                                'reward_std': reward_std,
                                'learning_rate': training_state['metrics'].get('learning_rate')
                            }
                            # Add to history
                            if loss is not None:
                                training_state['history']['loss'].append(loss)
                            if reward_mean is not None:
                                training_state['history']['reward_mean'].append(reward_mean)
                            if reward_std is not None:
                                training_state['history']['reward_std'].append(reward_std)
                except:
                    pass
            
            # Check for completion
            if 'Training Complete' in line or 'Model saved to' in line:
                if 'Model saved to' in line:
                    # Extract model path
                    model_path = line.split('Model saved to')[1].strip()
                    with training_lock:
                        training_state['model_path'] = model_path
        
        process.wait()
        
        # Check for latest model
        checkpoint_dir = project_root / 'models' / 'checkpoints'
        if checkpoint_dir.exists():
            models = sorted(checkpoint_dir.glob('reward_model_*.pt'), key=lambda p: p.stat().st_mtime, reverse=True)
            if models:
                with training_lock:
                    training_state['model_path'] = str(models[0])
        
        # Get metadata from training state
        data_metadata = None
        with training_lock:
            training_state['status'] = 'completed'
            training_state['progress'] = 100
            training_state['completed_at'] = time.time()
            training_state['message'] = 'Training completed successfully!'
            data_metadata = training_state.get('data_metadata')
        
        # Save training run metadata to database
        if data_metadata:
            try:
                # We need to access the database, but we're in a background thread
                # So we'll save it to a file that the main thread can read, or use a queue
                # For now, we'll save it to training_state and the /model/status endpoint will save it
                # Actually, let's try to get db from a global or save it via a callback
                pass  # Will be handled by a separate endpoint call
            except:
                pass
        
        # Reload model after training completes
        # Note: We can't access current_app in background thread, so we'll reload on next request
        # The model will be auto-loaded on backend startup anyway
            
    except Exception as e:
        with training_lock:
            training_state['status'] = 'error'
            training_state['error'] = str(e)
            training_state['message'] = f'Training failed: {str(e)}'


@api_bp.route('/train', methods=['POST'])
def trigger_training():
    """Trigger model training with optional parameters."""
    global training_state
    
    with training_lock:
        if training_state['status'] == 'training':
            return jsonify({
                'error': 'Training already in progress',
                'status': 'training'
            }), 409
        
        # Get training parameters from request
        data = request.get_json() or {}
        num_epochs = data.get('num_epochs', 50)
        learning_rate = data.get('learning_rate', 0.001)
        batch_size = data.get('batch_size', 64)
        
        # Validate parameters
        if not (1 <= num_epochs <= 1000):
            return jsonify({'error': 'num_epochs must be between 1 and 1000'}), 400
        if not (0.0001 <= learning_rate <= 0.1):
            return jsonify({'error': 'learning_rate must be between 0.0001 and 0.1'}), 400
        if not (1 <= batch_size <= 512):
            return jsonify({'error': 'batch_size must be between 1 and 512'}), 400
        
        # Check if we have enough data
        db = current_app.config.get('db')
        if db:
            conn = db.connect()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM actions")
            count = cursor.fetchone()[0]
            
            if count < 100:
                return jsonify({
                    'error': f'Not enough data! Need at least 100 actions, have {count}',
                    'status': 'error'
                }), 400
        
        # Reset training state
        training_state['status'] = 'queued'
        training_state['progress'] = 0
        training_state['message'] = 'Starting training...'
        training_state['logs'] = []
        training_state['metrics'] = {'loss': None, 'reward_mean': None, 'reward_std': None, 'learning_rate': learning_rate}
        training_state['history'] = {'loss': [], 'reward_mean': [], 'reward_std': []}
        
        # Start training in background thread with parameters
        thread = threading.Thread(
            target=run_training,
            args=(num_epochs, learning_rate, batch_size),
            daemon=True
        )
        thread.start()
        
        return jsonify({
            'message': 'Training started',
            'status': 'queued',
            'config': {
                'num_epochs': num_epochs,
                'learning_rate': learning_rate,
                'batch_size': batch_size
            }
        }), 202


@api_bp.route('/train/stop', methods=['POST'])
def stop_training():
    """Stop currently running training."""
    global training_state, training_process
    
    with training_lock:
        if training_state['status'] != 'training':
            return jsonify({
                'error': 'No training in progress',
                'status': training_state['status']
            }), 400
        
        # Mark as stopped
        training_state['status'] = 'stopped'
        training_state['message'] = 'Stopping training...'
        
        # Kill the process
        if training_process:
            try:
                training_process.terminate()
                # Give it 5 seconds to terminate gracefully
                try:
                    training_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    # Force kill if it doesn't terminate
                    training_process.kill()
                    training_process.wait()
            except Exception as e:
                training_state['error'] = f'Error stopping training: {str(e)}'
        
        training_state['completed_at'] = time.time()
        training_state['message'] = 'Training stopped by user'
        training_process = None
    
    return jsonify({
        'message': 'Training stopped',
        'status': 'stopped'
    }), 200


@api_bp.route('/model/new-data', methods=['GET'])
def get_new_data_since_last_training():
    """Get information about new data since last training run."""
    try:
        db = current_app.config.get('db')
        if not db:
            return jsonify({'error': 'Database not available'}), 500
        
        conn = db.connect()
        cursor = conn.cursor()
        
        # Get last training run
        cursor.execute("""
            SELECT id, completed_at, last_timestamp, total_actions_used, first_timestamp
            FROM training_runs
            WHERE completed_at IS NOT NULL
            ORDER BY completed_at DESC
            LIMIT 1
        """)
        
        last_run = cursor.fetchone()
        
        if not last_run:
            # No previous training, return all data stats
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_actions,
                    MIN(timestamp) as first_timestamp,
                    MAX(timestamp) as last_timestamp,
                    COUNT(DISTINCT source) as sources_count
                FROM actions
                WHERE action_type NOT IN ('dom_change', 'mouse_move', 'mouse_enter', 'mouse_leave')
            """)
            stats = cursor.fetchone()
            
            return jsonify({
                'has_previous_training': False,
                'new_actions_count': stats[0] if stats else 0,
                'first_timestamp': stats[1] if stats else None,
                'last_timestamp': stats[2] if stats else None,
                'sources_count': stats[3] if stats else 0,
                'message': 'No previous training found. All data is new.'
            }), 200
        
        last_run_id, last_completed_at, last_timestamp, total_actions_used, first_timestamp = last_run
        
        # Get new actions since last training
        if last_timestamp:
            cursor.execute("""
                SELECT 
                    COUNT(*) as new_actions,
                    MIN(timestamp) as first_new_timestamp,
                    MAX(timestamp) as last_new_timestamp,
                    COUNT(DISTINCT source) as new_sources_count,
                    GROUP_CONCAT(DISTINCT source) as new_sources
                FROM actions
                WHERE action_type NOT IN ('dom_change', 'mouse_move', 'mouse_enter', 'mouse_leave')
                AND timestamp > ?
            """, (last_timestamp,))
        else:
            # Fallback: use completed_at time
            cursor.execute("""
                SELECT 
                    COUNT(*) as new_actions,
                    MIN(timestamp) as first_new_timestamp,
                    MAX(timestamp) as last_new_timestamp,
                    COUNT(DISTINCT source) as new_sources_count,
                    GROUP_CONCAT(DISTINCT source) as new_sources
                FROM actions
                WHERE action_type NOT IN ('dom_change', 'mouse_move', 'mouse_enter', 'mouse_leave')
                AND timestamp > ?
            """, (last_completed_at,))
        
        new_data = cursor.fetchone()
        new_actions_count, first_new_timestamp, last_new_timestamp, new_sources_count, new_sources_str = new_data
        
        # Get action type breakdown for new data
        if last_timestamp:
            cursor.execute("""
                SELECT action_type, COUNT(*) as count
                FROM actions
                WHERE action_type NOT IN ('dom_change', 'mouse_move', 'mouse_enter', 'mouse_leave')
                AND timestamp > ?
                GROUP BY action_type
                ORDER BY count DESC
                LIMIT 10
            """, (last_timestamp,))
        else:
            cursor.execute("""
                SELECT action_type, COUNT(*) as count
                FROM actions
                WHERE action_type NOT IN ('dom_change', 'mouse_move', 'mouse_enter', 'mouse_leave')
                AND timestamp > ?
                GROUP BY action_type
                ORDER BY count DESC
                LIMIT 10
            """, (last_completed_at,))
        
        action_breakdown = [{'action_type': row[0], 'count': row[1]} for row in cursor.fetchall()]
        
        # Get source breakdown
        if last_timestamp:
            cursor.execute("""
                SELECT source, COUNT(*) as count
                FROM actions
                WHERE action_type NOT IN ('dom_change', 'mouse_move', 'mouse_enter', 'mouse_leave')
                AND timestamp > ?
                GROUP BY source
                ORDER BY count DESC
            """, (last_timestamp,))
        else:
            cursor.execute("""
                SELECT source, COUNT(*) as count
                FROM actions
                WHERE action_type NOT IN ('dom_change', 'mouse_move', 'mouse_enter', 'mouse_leave')
                AND timestamp > ?
                GROUP BY source
                ORDER BY count DESC
            """, (last_completed_at,))
        
        source_breakdown = [{'source': row[0], 'count': row[1]} for row in cursor.fetchall()]
        
        new_sources = new_sources_str.split(',') if new_sources_str else []
        
        return jsonify({
            'has_previous_training': True,
            'last_training': {
                'id': last_run_id,
                'completed_at': last_completed_at,
                'last_timestamp': last_timestamp,
                'total_actions_used': total_actions_used
            },
            'new_data': {
                'actions_count': new_actions_count or 0,
                'first_timestamp': first_new_timestamp,
                'last_timestamp': last_new_timestamp,
                'sources_count': new_sources_count or 0,
                'sources': new_sources,
                'action_breakdown': action_breakdown,
                'source_breakdown': source_breakdown
            },
            'ready_for_training': (new_actions_count or 0) >= 100,
            'message': f'Found {new_actions_count or 0} new actions since last training' if new_actions_count else 'No new data since last training'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/actions/search', methods=['GET'])
def search_actions():
    """Search actions by query string."""
    try:
        query = request.args.get('q', '').lower()
        if not query:
            return jsonify({'results': []}), 200
        
        db = current_app.config.get('db')
        if not db:
            return jsonify({'results': []}), 200
        
        conn = db.connect()
        cursor = conn.cursor()
        
        # Search in action_type, source, and context_json
        cursor.execute("""
            SELECT id, timestamp, source, action_type, context_json
            FROM actions
            WHERE 
                LOWER(action_type) LIKE ? OR
                LOWER(source) LIKE ? OR
                LOWER(context_json) LIKE ?
            ORDER BY timestamp DESC
            LIMIT 20
        """, (f'%{query}%', f'%{query}%', f'%{query}%'))
        
        rows = cursor.fetchall()
        results = []
        
        for row in rows:
            try:
                context = json.loads(row[4]) if row[4] else {}
            except:
                context = {}
            
            results.append({
                'id': row[0],
                'timestamp': row[1],
                'source': row[2],
                'action_type': row[3],
                'context': context
            })
        
        conn.close()
        return jsonify({'results': results}), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'results': []}), 200


@api_bp.route('/model/status', methods=['GET'])
def model_status():
    """Get model training status and latest model info."""
    global training_state
    
    # Save training metadata to database if available and training just completed
    db = current_app.config.get('db')
    if db:
        with training_lock:
            data_metadata = training_state.get('data_metadata')
            if data_metadata and training_state.get('status') == 'completed':
                try:
                    conn = db.connect()
                    cursor = conn.cursor()
                    
                    # Check if this training run was already saved
                    cursor.execute("""
                        SELECT id FROM training_runs 
                        WHERE started_at = ? AND completed_at = ?
                    """, (data_metadata.get('started_at'), data_metadata.get('completed_at')))
                    
                    if not cursor.fetchone():
                        # Save training run metadata
                        cursor.execute("""
                            INSERT INTO training_runs 
                            (started_at, completed_at, num_epochs, final_loss, model_path,
                             first_action_id, last_action_id, first_timestamp, last_timestamp,
                             total_actions_used, data_sources)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            data_metadata.get('started_at'),
                            data_metadata.get('completed_at'),
                            data_metadata.get('num_epochs'),
                            data_metadata.get('final_loss'),
                            data_metadata.get('model_path'),
                            data_metadata.get('first_action_id'),
                            data_metadata.get('last_action_id'),
                            data_metadata.get('first_timestamp'),
                            data_metadata.get('last_timestamp'),
                            data_metadata.get('total_actions'),
                            json.dumps(data_metadata.get('sources', []))
                        ))
                        conn.commit()
                        # Clear metadata from state to prevent duplicate saves
                        training_state['data_metadata'] = None
                    conn.close()
                except Exception as e:
                    # Log error but don't fail the request
                    pass
    
    with training_lock:
        status = training_state.copy()
        # Don't send all logs in status, use separate endpoint
        # But include last 10 lines for quick preview
        if 'logs' in status:
            status['recent_logs'] = status['logs'][-10:]
            del status['logs']  # Remove full logs to reduce payload
        # Keep history for charts
        if 'history' in status:
            # Limit history to last 100 points for performance
            if status['history'].get('loss'):
                status['history']['loss'] = status['history']['loss'][-100:]
            if status['history'].get('reward_mean'):
                status['history']['reward_mean'] = status['history']['reward_mean'][-100:]
            if status['history'].get('reward_std'):
                status['history']['reward_std'] = status['history']['reward_std'][-100:]
    
    # Check for latest model if not in state
    if not status.get('model_path'):
        project_root = Path(__file__).parent.parent.parent
        checkpoint_dir = project_root / 'models' / 'checkpoints'
        if checkpoint_dir.exists():
            models = sorted(checkpoint_dir.glob('reward_model_*.pt'), key=lambda p: p.stat().st_mtime, reverse=True)
            if models:
                model_path = models[0]
                status['model_path'] = str(model_path)
                status['model_exists'] = True
                status['model_size_mb'] = round(model_path.stat().st_size / (1024 * 1024), 2)
                status['model_modified'] = datetime.fromtimestamp(model_path.stat().st_mtime).isoformat()
            else:
                status['model_exists'] = False
        else:
            status['model_exists'] = False
    
    # Determine overall status
    if status['status'] == 'idle' and status.get('model_exists'):
        status['status'] = 'trained'
    elif status['status'] == 'idle':
        status['status'] = 'not_trained'
    
    return jsonify(status), 200


@api_bp.route('/training/logs', methods=['GET'])
def get_training_logs():
    """Get training logs."""
    global training_state
    
    with training_lock:
        logs = training_state.get('logs', [])
        # Return last N lines
        limit = request.args.get('limit', 100, type=int)
        return jsonify({
            'logs': logs[-limit:],
            'total': len(logs)
        }), 200


@api_bp.route('/recent-actions', methods=['GET'])
def recent_actions():
    """Get recent actions with filtering and sorting."""
    try:
        limit = request.args.get('limit', 100, type=int)
        source_filter = request.args.get('source', None)  # Filter by source
        action_type_filter = request.args.get('action_type', None)  # Filter by action type
        sort_by = request.args.get('sort', 'timestamp')  # Sort by: timestamp, source, action_type
        order = request.args.get('order', 'desc')  # Order: asc, desc
        
        db = current_app.config.get('db')
        session_id = current_app.config.get('current_session_id', '')
        
        if not db:
            return jsonify({'actions': [], 'total': 0}), 200
        
        conn = db.connect()
        cursor = conn.cursor()
        
        # Build query with filters - show ALL actions (not just current session)
        # This allows viewing historical data even after backend restart
        query = "SELECT id, timestamp, source, action_type, context_json FROM actions WHERE 1=1"
        params = []
        
        if source_filter:
            query += " AND source = ?"
            params.append(source_filter)
        
        if action_type_filter:
            query += " AND action_type = ?"
            params.append(action_type_filter)
        
        # Validate sort column
        valid_sorts = ['timestamp', 'source', 'action_type']
        if sort_by not in valid_sorts:
            sort_by = 'timestamp'
        
        # Validate order
        order = 'DESC' if order.lower() == 'desc' else 'ASC'
        
        query += f" ORDER BY {sort_by} {order} LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        
        actions = []
        for row in cursor.fetchall():
            try:
                context = json.loads(row[4]) if row[4] else {}
            except:
                context = {}
            actions.append({
                'id': row[0],
                'timestamp': row[1],
                'source': row[2],
                'action_type': row[3],
                'context': context
            })
        
        # Get total count for pagination - show ALL actions
        count_query = "SELECT COUNT(*) FROM actions WHERE 1=1"
        count_params = []
        if source_filter:
            count_query += " AND source = ?"
            count_params.append(source_filter)
        if action_type_filter:
            count_query += " AND action_type = ?"
            count_params.append(action_type_filter)
        
        cursor.execute(count_query, count_params)
        total = cursor.fetchone()[0]
        
        return jsonify({
            'actions': actions,
            'total': total,
            'limit': limit,
            'filters': {
                'source': source_filter,
                'action_type': action_type_filter
            },
            'sort': {
                'by': sort_by,
                'order': order.lower()
            }
        }), 200
        
    except Exception as e:
        return jsonify({'actions': [], 'total': 0, 'error': str(e)}), 200


