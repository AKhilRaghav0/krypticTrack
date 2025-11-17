"""
Training script for IRL model.
Loads data from database, extracts features, and trains reward model.
"""

import sys
from pathlib import Path
import sqlite3
import json
import numpy as np
from typing import List, Tuple
from datetime import datetime

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from encoding.feature_extractor import FeatureExtractor
from models.irl_algorithm import MaxEntIRL
from database import DatabaseManager
from utils.helpers import load_config


def load_trajectories_from_db(db_path: str, min_actions: int = 100) -> List[List[Tuple[np.ndarray, np.ndarray]]]:
    """
    Load expert trajectories from database.
    
    Args:
        db_path: Path to SQLite database
        min_actions: Minimum number of actions required
        
    Returns:
        List of trajectories, each is list of (state, action) tuples
    """
    print(f"📂 Loading data from {db_path}...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Filter out high-frequency/noisy actions that bloat the neural network
    FILTERED_ACTION_TYPES = {
        'dom_change',
        'mouse_move',
        'mouse_enter',
        'mouse_leave',
    }
    
    # Get all actions ordered by timestamp, excluding filtered types
    placeholders = ','.join(['?' for _ in FILTERED_ACTION_TYPES])
    cursor.execute(f"""
        SELECT timestamp, source, action_type, context_json
        FROM actions
        WHERE action_type NOT IN ({placeholders})
        ORDER BY timestamp ASC
    """, tuple(FILTERED_ACTION_TYPES))
    
    rows = cursor.fetchall()
    conn.close()
    
    if len(rows) < min_actions:
        raise ValueError(
            f"Not enough data! Found {len(rows)} actions (after filtering), need at least {min_actions}.\n"
            f"Keep using the system to collect more data."
        )
    
    print(f"   Found {len(rows):,} actions (filtered noisy events)")
    
    # Initialize feature extractor
    extractor = FeatureExtractor()
    
    # Build trajectories
    # For now, we'll create one long trajectory from all actions
    # In future, we could split by session or time gaps
    trajectory = []
    
    print("   Extracting features...")
    for i, (timestamp, source, action_type, context_json) in enumerate(rows):
        try:
            context = json.loads(context_json) if context_json else {}
        except:
            context = {}
        
        action_data = {
            'timestamp': timestamp,
            'source': source,
            'action_type': action_type,
            'context': context
        }
        
        # Extract state vector (before this action)
        state = extractor.extract_state_vector()
        
        # Extract action vector (for this action)
        action = extractor.extract_action_vector(action_data)
        
        trajectory.append((state, action))
        
        # Update extractor with this action (for next state)
        extractor.update_from_action(action_data)
        
        if (i + 1) % 1000 == 0:
            print(f"   Processed {i+1:,}/{len(rows):,} actions...")
    
    print(f"   ✅ Created trajectory with {len(trajectory)} state-action pairs")
    
    # Return as list of trajectories (for now, just one)
    return [trajectory]


def train_model(
    db_path: str,
    num_epochs: int = 50,
    learning_rate: float = 0.001,
    batch_size: int = 64,
    checkpoint_dir: Path = None
):
    """
    Train IRL model.
    
    Args:
        db_path: Path to database
        num_epochs: Number of training epochs
        learning_rate: Learning rate
        batch_size: Batch size
        checkpoint_dir: Directory to save checkpoints
    """
    print("\n" + "="*60)
    print("🚀 KrypticTrack IRL Training")
    print("="*60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Load trajectories
    try:
        trajectories = load_trajectories_from_db(db_path, min_actions=100)
    except ValueError as e:
        print(f"❌ Error: {e}")
        return
    
    # Initialize IRL algorithm
    irl = MaxEntIRL(
        state_dim=192,
        action_dim=48,
        learning_rate=learning_rate
    )
    
    # Train
    print("\n" + "="*60)
    print("📊 Training Statistics")
    print("="*60)
    
    history = irl.train(
        expert_trajectories=trajectories,
        num_epochs=num_epochs,
        batch_size=batch_size,
        verbose=True
    )
    
    # Save model
    if checkpoint_dir is None:
        checkpoint_dir = project_root / 'models' / 'checkpoints'
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    checkpoint_path = checkpoint_dir / f'reward_model_{timestamp}.pt'
    
    irl.save_model(str(checkpoint_path))
    
    # Print final statistics
    print("\n" + "="*60)
    print("✅ Training Complete!")
    print("="*60)
    print(f"Final loss: {history['loss'][-1]:.4f}")
    print(f"Final reward mean: {history['reward_mean'][-1]:.4f}")
    print(f"Final reward std: {history['reward_std'][-1]:.4f}")
    print(f"\nModel saved to: {checkpoint_path}")
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    return irl, history


if __name__ == '__main__':
    # Load config
    config = load_config()
    db_config = config['database']
    db_path = db_config['path']
    
    # Resolve database path relative to project root
    if not Path(db_path).is_absolute():
        db_path = project_root / db_path
    
    # Ensure database exists
    if not Path(db_path).exists():
        print(f"❌ Database not found: {db_path}")
        print(f"   Make sure the Chrome extension is running and collecting data.")
        sys.exit(1)
    
    # Training config - check environment variables first (from API), then config file
    import os
    num_epochs = int(os.environ.get('TRAINING_EPOCHS', 0)) or config.get('training', {}).get('num_epochs', 50)
    learning_rate = float(os.environ.get('TRAINING_LR', 0)) or config.get('training', {}).get('learning_rate', 0.001)
    batch_size = int(os.environ.get('TRAINING_BATCH_SIZE', 0)) or config.get('training', {}).get('batch_size', 64)
    
    # Train
    try:
        irl, history = train_model(
            db_path=db_path,
            num_epochs=num_epochs,
            learning_rate=learning_rate,
            batch_size=batch_size
        )
        print("🎉 Success! Model is ready for predictions.")
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)



