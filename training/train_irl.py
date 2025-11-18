"""
Training script for IRL model with beautiful TUI (Terminal User Interface).
Loads data from database, extracts features, and trains reward model.
"""

import sys
from pathlib import Path
import sqlite3
import json
import numpy as np
import time
import re
import subprocess
from typing import List, Tuple, Optional, Dict
from datetime import datetime
from threading import Thread, Event

# Try to import rich for TUI, fallback to basic print if not available
try:
    from rich.console import Console
    from rich.live import Live
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
    from rich.table import Table
    from rich.layout import Layout
    from rich.text import Text
    from rich import box
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    print("⚠️  Install 'rich' for beautiful TUI: pip install rich")
    print("   Continuing with basic output...\n")

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from encoding.feature_extractor import FeatureExtractor
from models.irl_algorithm import MaxEntIRL
from database import DatabaseManager
from utils.helpers import load_config


class TrainingTUI:
    """Beautiful terminal UI for training, inspired by htop/gotop."""
    
    def __init__(self):
        self.console = Console() if HAS_RICH else None
        self.current_epoch = 0
        self.total_epochs = 0
        self.current_loss = None
        self.current_reward_mean = None
        self.current_reward_std = None
        self.training_start_time = None
        self.data_loading_progress = 0
        self.data_loading_total = 0
        self.data_loading_status = "Initializing..."
        self.training_status = "Waiting..."
        self.history_loss = []
        self.history_reward_mean = []
        self.history_reward_std = []
        self.stop_event = Event()
        # Recent data tracking
        self.recent_actions = []  # List of recent actions added
        self.data_sources = {}  # Count by source
        self.data_action_types = {}  # Count by action type
        self.last_data_timestamp = None
        self.total_actions_in_db = 0
        # Completion summary
        self.completed = False
        self.completion_summary = {}
        self.new_data_summary = {}
    
    def update_data_loading(self, current: int, total: int, status: str):
        """Update data loading progress."""
        self.data_loading_progress = current
        self.data_loading_total = total
        self.data_loading_status = status
    
    def add_recent_action(self, action_type: str, source: str, context: str = ""):
        """Add a recent action to the display."""
        self.recent_actions.append({
            'type': action_type,
            'source': source,
            'context': context[:50] if context else "",
            'time': time.time()
        })
        # Keep only last 10
        if len(self.recent_actions) > 10:
            self.recent_actions = self.recent_actions[-10:]
        
        # Update counts
        self.data_sources[source] = self.data_sources.get(source, 0) + 1
        self.data_action_types[action_type] = self.data_action_types.get(action_type, 0) + 1
        self.last_data_timestamp = time.time()
    
    def set_total_actions(self, total: int):
        """Set total actions in database."""
        self.total_actions_in_db = total
    
    def update_training(self, epoch: int, total_epochs: int, loss: float = None, 
                       reward_mean: float = None, reward_std: float = None):
        """Update training metrics."""
        self.current_epoch = epoch
        self.total_epochs = total_epochs
        if loss is not None:
            self.current_loss = loss
            self.history_loss.append(loss)
        if reward_mean is not None:
            self.current_reward_mean = reward_mean
            self.history_reward_mean.append(reward_mean)
        if reward_std is not None:
            self.current_reward_std = reward_std
            self.history_reward_std.append(reward_std)
    
    def render(self) -> str:
        """Render the TUI layout."""
        if not HAS_RICH:
            return self._render_basic()
        
        # Create layout
        layout = Layout()
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="body"),
            Layout(name="footer", size=3)
        )
        layout["body"].split_row(
            Layout(name="left", ratio=2),
            Layout(name="right", ratio=1)
        )
        
        # Header
        header = Panel(
            Text("🧠 KrypticTrack IRL Training", style="bold cyan"),
            box=box.ROUNDED,
            border_style="cyan"
        )
        layout["header"].update(header)
        
        # Left panel - Training progress
        left_table = Table(show_header=False, box=None, padding=(0, 1))
        
        if self.completed:
            # Show completion summary
            left_table.add_row(Text("✅ COMPLETE!", style="bold green"), "")
            left_table.add_row("", "")
            if self.completion_summary:
                left_table.add_row(Text("Model Path:", style="bold"), self.completion_summary.get('model_path', 'N/A')[:50])
                left_table.add_row("", "")
                left_table.add_row(Text("Final Metrics:", style="bold cyan"), "")
                loss = self.completion_summary.get('final_loss')
                if loss is not None:
                    loss_color = "green" if loss < 0.1 else "yellow" if loss < 0.5 else "red"
                    left_table.add_row("  Loss:", Text(f"{loss:.6f}", style=loss_color))
                if self.completion_summary.get('final_reward_mean') is not None:
                    left_table.add_row("  Reward μ:", f"{self.completion_summary['final_reward_mean']:.4f}")
                if self.completion_summary.get('final_reward_std') is not None:
                    left_table.add_row("  Reward σ:", f"{self.completion_summary['final_reward_std']:.4f}")
                left_table.add_row("", "")
                left_table.add_row(Text("Training Info:", style="bold cyan"), "")
                left_table.add_row("  Epochs:", str(self.completion_summary.get('num_epochs', 'N/A')))
                left_table.add_row("  Actions:", f"{self.completion_summary.get('total_actions', 0):,}")
                left_table.add_row("  Data Range:", self.completion_summary.get('data_range', 'N/A'))
        else:
            # Normal training progress
            left_table.add_row("Status:", Text(self.training_status, style="bold green"))
            left_table.add_row("Epoch:", f"{self.current_epoch}/{self.total_epochs}")
            
            if self.current_loss is not None:
                loss_color = "green" if self.current_loss < 0.1 else "yellow" if self.current_loss < 0.5 else "red"
                left_table.add_row("Loss:", Text(f"{self.current_loss:.6f}", style=loss_color))
            
            if self.current_reward_mean is not None:
                left_table.add_row("Reward μ:", f"{self.current_reward_mean:.4f}")
            
            if self.current_reward_std is not None:
                left_table.add_row("Reward σ:", f"{self.current_reward_std:.4f}")
            
            if self.training_start_time:
                elapsed = time.time() - self.training_start_time
                left_table.add_row("Elapsed:", f"{elapsed:.1f}s")
            
            # Progress bar
            if self.total_epochs > 0:
                progress_pct = min((self.current_epoch / self.total_epochs) * 100, 100.0)
                progress_bar = "█" * int(progress_pct / 2) + "░" * (50 - int(progress_pct / 2))
                left_table.add_row("Progress:", f"[cyan]{progress_bar}[/cyan] {progress_pct:.1f}%")
        
        left_panel = Panel(left_table, title="Training Metrics", border_style="blue", box=box.ROUNDED)
        layout["left"].update(left_panel)
        
        # Right panel - Data details
        right_table = Table(show_header=False, box=None, padding=(0, 1))
        right_table.add_row("Status:", Text(self.data_loading_status, style="bold"))
        
        if self.data_loading_total > 0:
            loading_pct = (self.data_loading_progress / self.data_loading_total) * 100
            loading_bar = "█" * int(loading_pct / 2) + "░" * (50 - int(loading_pct / 2))
            right_table.add_row("Progress:", f"[green]{loading_bar}[/green] {loading_pct:.1f}%")
            right_table.add_row("Actions:", f"{self.data_loading_progress:,}/{self.data_loading_total:,}")
        
        if self.total_actions_in_db > 0:
            right_table.add_row("", "")  # Spacer
            right_table.add_row(Text("Total in DB:", style="bold"), f"{self.total_actions_in_db:,}")
        
        # Data sources breakdown
        if self.data_sources:
            right_table.add_row("", "")  # Spacer
            right_table.add_row(Text("Sources:", style="bold cyan"), "")
            for source, count in sorted(self.data_sources.items(), key=lambda x: x[1], reverse=True)[:5]:
                right_table.add_row(f"  • {source}:", f"{count:,}")
        
        # Action types breakdown
        if self.data_action_types:
            right_table.add_row("", "")  # Spacer
            right_table.add_row(Text("Action Types:", style="bold cyan"), "")
            for action_type, count in sorted(self.data_action_types.items(), key=lambda x: x[1], reverse=True)[:5]:
                display_name = action_type.replace('_', ' ').title()[:20]
                right_table.add_row(f"  • {display_name}:", f"{count:,}")
        
        # Recent actions
        if self.recent_actions:
            right_table.add_row("", "")  # Spacer
            right_table.add_row(Text("Recent Data:", style="bold yellow"), "")
            for action in self.recent_actions[-5:]:  # Show last 5
                time_ago = time.time() - action['time']
                if time_ago < 60:
                    time_str = f"{int(time_ago)}s ago"
                elif time_ago < 3600:
                    time_str = f"{int(time_ago/60)}m ago"
                else:
                    time_str = f"{int(time_ago/3600)}h ago"
                
                action_display = action['type'].replace('_', ' ').title()[:15]
                source_display = action['source'][:8]
                right_table.add_row(f"  [{time_str}]", f"{source_display}: {action_display}")
        
        # Show new data context if completed
        if self.completed and self.new_data_summary:
            right_table.add_row("", "")  # Spacer
            right_table.add_row(Text("New Context:", style="bold magenta"), "")
            right_table.add_row("  Total Actions:", f"{self.new_data_summary.get('total_actions', 0):,}")
            if self.new_data_summary.get('sources_breakdown'):
                right_table.add_row("  Sources:", "")
                for source, count in list(self.new_data_summary['sources_breakdown'].items())[:3]:
                    right_table.add_row(f"    • {source}:", f"{count:,}")
            if self.new_data_summary.get('action_types'):
                right_table.add_row("  Top Actions:", "")
                for action_type, count in list(self.new_data_summary['action_types'].items())[:3]:
                    display_name = action_type.replace('_', ' ').title()[:18]
                    right_table.add_row(f"    • {display_name}:", f"{count:,}")
        
        right_panel = Panel(right_table, title="Data Details", border_style="green", box=box.ROUNDED)
        layout["right"].update(right_panel)
        
        # Footer
        footer_text = Text("Press Ctrl+C to stop training", style="dim")
        footer = Panel(footer_text, box=box.ROUNDED, border_style="dim")
        layout["footer"].update(footer)
        
        return layout
    
    def _render_basic(self) -> str:
        """Basic text output when rich is not available."""
        output = []
        output.append("=" * 60)
        output.append("🧠 KrypticTrack IRL Training")
        output.append("=" * 60)
        output.append(f"Status: {self.training_status}")
        output.append(f"Epoch: {self.current_epoch}/{self.total_epochs}")
        if self.current_loss is not None:
            output.append(f"Loss: {self.current_loss:.6f}")
        if self.current_reward_mean is not None:
            output.append(f"Reward μ: {self.current_reward_mean:.4f}")
        if self.data_loading_total > 0:
            output.append(f"Data: {self.data_loading_progress:,}/{self.data_loading_total:,}")
        return "\n".join(output)


def load_shell_history_to_db(db_path: str, tui: Optional[TrainingTUI] = None) -> int:
    """
    Load shell history (zsh, bash, fish) directly into database.
    Returns number of actions added.
    """
    home = Path.home()
    actions_added = 0
    
    # Get database connection
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if actions table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='actions'")
    if not cursor.fetchone():
        conn.close()
        return 0
    
    # Get last timestamp from database to avoid duplicates
    cursor.execute("SELECT MAX(timestamp) FROM actions WHERE source = 'system'")
    last_timestamp_row = cursor.fetchone()
    last_timestamp = last_timestamp_row[0] if last_timestamp_row[0] else 0
    
    # Load zsh history
    zsh_history = home / '.zsh_history'
    if zsh_history.exists() and tui:
        tui.update_data_loading(0, 1, "Loading zsh history...")
    
    if zsh_history.exists():
        try:
            if tui:
                tui.update_data_loading(0, 1, f"Reading zsh history from {zsh_history}...")
            
            # Read zsh history file - it's binary format with null bytes
            with open(zsh_history, 'rb') as f:
                content = f.read()
            
            # zsh history uses null bytes to separate entries, decode carefully
            # Try to decode as utf-8, handling errors
            try:
                text_content = content.decode('utf-8', errors='replace')
            except:
                # Fallback: replace problematic bytes
                text_content = content.decode('latin-1', errors='replace')
            
            lines = text_content.split('\n')
            total_lines = len(lines)
            
            if tui:
                tui.update_data_loading(0, total_lines, f"Parsing {total_lines} zsh history lines...")
            
            processed = 0
            for i, line in enumerate(lines):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                # Parse zsh history format: ': timestamp:0;command'
                # Also handle multi-line commands (they may be split)
                match = re.match(r':\s*(\d+):\d+;(.+)', line)
                if match:
                    timestamp = int(match.group(1))
                    command = match.group(2).strip()
                    
                    # Skip very short commands (likely incomplete)
                    if len(command) < 2:
                        continue
                    
                    if command and timestamp > last_timestamp:
                        # Check if already exists (use hash of command for faster lookup)
                        import hashlib
                        cmd_hash = hashlib.md5(command.encode()).hexdigest()
                        cursor.execute("""
                            SELECT COUNT(*) FROM actions 
                            WHERE source = 'system' 
                            AND action_type = 'terminal_command'
                            AND context_json LIKE ?
                        """, (f'%{cmd_hash[:8]}%',))
                        
                        # Also check by command content
                        cursor.execute("""
                            SELECT COUNT(*) FROM actions 
                            WHERE source = 'system' 
                            AND action_type = 'terminal_command'
                            AND context_json LIKE ?
                        """, (f'%"full_command": "{command[:100].replace('"', "")}"%',))
                        
                        if cursor.fetchone()[0] == 0:
                            context = {
                                'command': command.split()[0] if command.split() else '',
                                'full_command': command[:500],
                                'shell': 'zsh',
                                'category': 'other',
                                'cmd_hash': cmd_hash[:8]  # For deduplication
                            }
                            
                            cursor.execute("""
                                INSERT INTO actions (timestamp, source, action_type, context_json, session_id)
                                VALUES (?, 'system', 'terminal_command', ?, 'shell_history_import')
                            """, (timestamp, json.dumps(context)))
                            actions_added += 1
                            
                            if tui and actions_added % 100 == 0:
                                tui.update_data_loading(i, total_lines, f"Loaded {actions_added} zsh commands...")
                                tui.add_recent_action('terminal_command', 'zsh', command[:50])
                    
                    processed += 1
                    if processed % 1000 == 0 and tui:
                        tui.update_data_loading(i, total_lines, f"Processed {processed}/{total_lines} lines, added {actions_added} commands...")
            
            if tui:
                tui.update_data_loading(total_lines, total_lines, f"✅ Loaded {actions_added} zsh commands")
        except Exception as e:
            if tui:
                tui.update_data_loading(0, 1, f"Error loading zsh: {str(e)[:50]}")
            else:
                print(f"Warning: Error loading zsh history: {e}")
    
    # Load bash history
    bash_history = home / '.bash_history'
    if bash_history.exists():
        try:
            with open(bash_history, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                current_time = time.time()
                
                for line in lines:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    
                    # Use current time for bash (no timestamps)
                    if current_time > last_timestamp:
                        cursor.execute("""
                            SELECT COUNT(*) FROM actions 
                            WHERE source = 'system' 
                            AND action_type = 'terminal_command'
                            AND context_json LIKE ?
                        """, (f'%"full_command": "{line[:100]}"%',))
                        
                        if cursor.fetchone()[0] == 0:
                            context = {
                                'command': line.split()[0] if line.split() else '',
                                'full_command': line[:500],
                                'shell': 'bash',
                                'category': 'other'
                            }
                            
                            cursor.execute("""
                                INSERT INTO actions (timestamp, source, action_type, context_json, session_id)
                                VALUES (?, 'system', 'terminal_command', ?, 'shell_history_import')
                            """, (current_time, json.dumps(context)))
                            actions_added += 1
                            current_time += 1  # Increment to avoid exact duplicates
                            
                            if tui:
                                tui.add_recent_action('terminal_command', 'bash', line[:50])
        except Exception as e:
            pass
    
    conn.commit()
    conn.close()
    
    if tui:
        tui.update_data_loading(actions_added, actions_added, f"Loaded {actions_added} shell commands")
    
    return actions_added


def load_trajectories_from_db(db_path: str, min_actions: int = 100, 
                              last_training_timestamp: float = None,
                              tui: Optional[TrainingTUI] = None):
    """
    Load expert trajectories from database.
    
    Args:
        db_path: Path to SQLite database
        min_actions: Minimum number of actions required
        last_training_timestamp: Only load actions after this timestamp (for incremental training)
        tui: Optional TUI for progress updates
        
    Returns:
        Tuple of (trajectories, metadata_dict)
    """
    if tui:
        tui.update_data_loading(0, 1, f"Connecting to database...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Filter out high-frequency/noisy actions that bloat the neural network
    FILTERED_ACTION_TYPES = {
        'dom_change',
        'mouse_move',
        'mouse_enter',
        'mouse_leave',
    }
    
    # Build query with optional timestamp filter
    placeholders = ','.join(['?' for _ in FILTERED_ACTION_TYPES])
    if last_training_timestamp:
        query = f"""
            SELECT id, timestamp, source, action_type, context_json
            FROM actions
            WHERE action_type NOT IN ({placeholders})
            AND timestamp > ?
            ORDER BY timestamp ASC
        """
        params = tuple(FILTERED_ACTION_TYPES) + (last_training_timestamp,)
    else:
        query = f"""
            SELECT id, timestamp, source, action_type, context_json
            FROM actions
            WHERE action_type NOT IN ({placeholders})
            ORDER BY timestamp ASC
        """
        params = tuple(FILTERED_ACTION_TYPES)
    
    if tui:
        tui.update_data_loading(0, 1, "Querying database...")
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    if len(rows) < min_actions:
        conn.close()
        raise ValueError(
            f"Not enough data! Found {len(rows)} actions (after filtering), need at least {min_actions}.\n"
            f"Keep using the system to collect more data."
        )
    
    # Extract metadata
    first_action_id = rows[0][0]
    last_action_id = rows[-1][0]
    first_timestamp = rows[0][1]
    last_timestamp = rows[-1][1]
    total_actions = len(rows)
    
    # Get unique sources
    sources = set(row[2] for row in rows)
    
    # Count by source and action type
    source_counts = {}
    action_type_counts = {}
    for row in rows:
        source = row[2]
        action_type = row[3]
        source_counts[source] = source_counts.get(source, 0) + 1
        action_type_counts[action_type] = action_type_counts.get(action_type, 0) + 1
    
    metadata = {
        'first_action_id': first_action_id,
        'last_action_id': last_action_id,
        'first_timestamp': first_timestamp,
        'last_timestamp': last_timestamp,
        'total_actions': total_actions,
        'sources': list(sources)
    }
    
    if tui:
        tui.update_data_loading(0, total_actions, f"Found {total_actions:,} actions")
        tui.set_total_actions(total_actions)
        # Update TUI with data breakdown
        tui.data_sources = source_counts
        tui.data_action_types = action_type_counts
    
    # Initialize feature extractor
    extractor = FeatureExtractor()
    
    # Build trajectories
    trajectory = []
    
    if tui:
        tui.update_data_loading(0, total_actions, "Extracting features...")
    
    for i, (action_id, timestamp, source, action_type, context_json) in enumerate(rows):
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
        
        if tui and (i + 1) % 100 == 0:
            tui.update_data_loading(i + 1, total_actions, f"Processing {i+1:,}/{total_actions:,} actions...")
    
    if tui:
        tui.update_data_loading(total_actions, total_actions, f"✅ Created trajectory with {len(trajectory)} state-action pairs")
    
    # Return as list of trajectories (for now, just one) and metadata
    return [trajectory], metadata


class TrainingCallback:
    """Callback for training progress updates."""
    
    def __init__(self, tui: TrainingTUI):
        self.tui = tui
        self.tui.training_start_time = time.time()
    
    def __call__(self, epoch: int, total_epochs: int, loss: float = None,
                reward_mean: float = None, reward_std: float = None):
        """Update TUI with training metrics."""
        self.tui.update_training(epoch, total_epochs, loss, reward_mean, reward_std)


def train_model(
    db_path: str,
    num_epochs: int = 50,
    learning_rate: float = 0.001,
    batch_size: int = 64,
    checkpoint_dir: Path = None,
    last_training_timestamp: float = None,
    tui: Optional[TrainingTUI] = None
):
    """
    Train IRL model with beautiful TUI.
    
    Args:
        db_path: Path to database
        num_epochs: Number of training epochs
        learning_rate: Learning rate
        batch_size: Batch size
        checkpoint_dir: Directory to save checkpoints
        last_training_timestamp: Only train on data after this timestamp (for incremental training)
        tui: Optional TUI for progress display
        
    Returns:
        Tuple of (irl_model, history, metadata_dict)
    """
    if tui:
        tui.training_status = "Loading data..."
        tui.training_start_time = time.time()
    
    # Load trajectories with metadata
    try:
        trajectories, data_metadata = load_trajectories_from_db(
            db_path, min_actions=100, 
            last_training_timestamp=last_training_timestamp,
            tui=tui
        )
    except ValueError as e:
        if tui:
            tui.training_status = f"❌ Error: {str(e)[:50]}"
        else:
            print(f"❌ Error: {e}")
        return None, None, None
    
    # Initialize IRL algorithm
    if tui:
        tui.training_status = "Initializing model..."
    
    irl = MaxEntIRL(
        state_dim=192,
        action_dim=48,
        learning_rate=learning_rate
    )
    
    # Create callback for progress updates
    callback = TrainingCallback(tui) if tui else None
    
    # Train with TUI
    if tui:
        tui.training_status = "Training..."
    
    # Train with callback support
    history = irl.train(
        expert_trajectories=trajectories,
        num_epochs=num_epochs,
        batch_size=batch_size,
        verbose=not bool(tui),  # Verbose only if no TUI
        callback=callback  # Pass callback for TUI updates
    )
    
    # Save model
    if checkpoint_dir is None:
        checkpoint_dir = project_root / 'models' / 'checkpoints'
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    checkpoint_path = checkpoint_dir / f'reward_model_{timestamp}.pt'
    
    if tui:
        tui.training_status = "Saving model..."
    
    irl.save_model(str(checkpoint_path))
    
    # Add model path to metadata
    data_metadata['model_path'] = str(checkpoint_path)
    data_metadata['final_loss'] = history['loss'][-1] if history.get('loss') else None
    data_metadata['final_reward_mean'] = history['reward_mean'][-1] if history.get('reward_mean') else None
    data_metadata['final_reward_std'] = history['reward_std'][-1] if history.get('reward_std') else None
    data_metadata['num_epochs'] = num_epochs
    data_metadata['learning_rate'] = learning_rate
    data_metadata['batch_size'] = batch_size
    data_metadata['started_at'] = time.time()
    data_metadata['completed_at'] = time.time()
    
    if tui:
        tui.training_status = "✅ Training Complete!"
        tui.completed = True
        tui.completion_summary = {
            'model_path': str(checkpoint_path),
            'final_loss': data_metadata['final_loss'],
            'final_reward_mean': data_metadata['final_reward_mean'],
            'final_reward_std': data_metadata['final_reward_std'],
            'num_epochs': num_epochs,
            'total_actions': data_metadata['total_actions'],
            'sources': data_metadata['sources'],
            'data_range': f"{datetime.fromtimestamp(data_metadata['first_timestamp']).strftime('%Y-%m-%d %H:%M')} to {datetime.fromtimestamp(data_metadata['last_timestamp']).strftime('%Y-%m-%d %H:%M')}"
        }
        tui.new_data_summary = {
            'total_actions': data_metadata['total_actions'],
            'sources_breakdown': {s: tui.data_sources.get(s, 0) for s in data_metadata['sources']},
            'action_types': dict(list(tui.data_action_types.items())[:10])
        }
        # Update to 100% progress
        tui.update_training(num_epochs, num_epochs, data_metadata['final_loss'], 
                           data_metadata['final_reward_mean'], data_metadata['final_reward_std'])
    
    # Output metadata as JSON for backend to parse
    if not tui:
        print(f"\n📊 TRAINING_METADATA_JSON: {json.dumps(data_metadata)}")
    
    return irl, history, data_metadata


if __name__ == '__main__':
    # Check if rich is available
    use_tui = HAS_RICH
    
    # Create TUI
    tui = TrainingTUI() if use_tui else None
    
    # Load config
    config = load_config()
    db_config = config['database']
    db_path = db_config['path']
    
    # Resolve database path relative to project root
    if not Path(db_path).is_absolute():
        db_path = project_root / db_path
    
    # Ensure database exists, create if needed
    if not Path(db_path).exists():
        if tui:
            tui.update_data_loading(0, 1, "Database not found, creating...")
        # Create database with schema
        from database.schema import create_tables
        from database import DatabaseManager
        db_manager = DatabaseManager(db_path)
        create_tables(db_manager.connect())
        db_manager.close()
    
    # Load shell history if backend hasn't been running
    if tui:
        tui.update_data_loading(0, 1, "Checking for shell history...")
    
    shell_actions = load_shell_history_to_db(str(db_path), tui)
    if shell_actions > 0 and tui:
        tui.console.print(f"[green]✅ Loaded {shell_actions} shell commands from history[/green]")
    elif shell_actions > 0:
        print(f"✅ Loaded {shell_actions} shell commands from history")
    
    # Training config - check environment variables first (from API), then config file
    import os
    
    # Ask user for training parameters if not set via environment
    if not os.environ.get('TRAINING_EPOCHS'):
        if tui and HAS_RICH:
            tui.console.print("\n[bold cyan]Training Configuration[/bold cyan]")
            try:
                epochs_input = tui.console.input("[cyan]Number of epochs[/cyan] (default: 50): ").strip()
                num_epochs = int(epochs_input) if epochs_input else 50
            except ValueError:
                num_epochs = 50
                tui.console.print("[yellow]Invalid input, using default: 50[/yellow]")
            
            try:
                batch_input = tui.console.input("[cyan]Batch size[/cyan] (default: 64): ").strip()
                batch_size = int(batch_input) if batch_input else 64
            except ValueError:
                batch_size = 64
                tui.console.print("[yellow]Invalid input, using default: 64[/yellow]")
            
            try:
                lr_input = tui.console.input("[cyan]Learning rate[/cyan] (default: 0.001): ").strip()
                learning_rate = float(lr_input) if lr_input else 0.001
            except ValueError:
                learning_rate = 0.001
                tui.console.print("[yellow]Invalid input, using default: 0.001[/yellow]")
        else:
            # Basic input without rich
            try:
                epochs_input = input("\nNumber of epochs (default: 50): ").strip()
                num_epochs = int(epochs_input) if epochs_input else 50
            except (ValueError, EOFError):
                num_epochs = 50
            
            try:
                batch_input = input("Batch size (default: 64): ").strip()
                batch_size = int(batch_input) if batch_input else 64
            except (ValueError, EOFError):
                batch_size = 64
            
            try:
                lr_input = input("Learning rate (default: 0.001): ").strip()
                learning_rate = float(lr_input) if lr_input else 0.001
            except (ValueError, EOFError):
                learning_rate = 0.001
    else:
        # Use environment variables or config defaults
        num_epochs = int(os.environ.get('TRAINING_EPOCHS', 0)) or config.get('training', {}).get('num_epochs', 50)
        learning_rate = float(os.environ.get('TRAINING_LR', 0)) or config.get('training', {}).get('learning_rate', 0.001)
        batch_size = int(os.environ.get('TRAINING_BATCH_SIZE', 0)) or config.get('training', {}).get('batch_size', 64)
    
    # Train with TUI
    try:
        if use_tui:
            def generate_layout():
                return tui.render()
            
            with Live(generate_layout(), refresh_per_second=10, screen=False) as live:
                def update_ui():
                    while not tui.stop_event.is_set():
                        live.update(generate_layout())
                        time.sleep(0.1)
                
                update_thread = Thread(target=update_ui, daemon=True)
                update_thread.start()
                
                try:
                    irl, history, metadata = train_model(
                        db_path=str(db_path),
                        num_epochs=num_epochs,
                        learning_rate=learning_rate,
                        batch_size=batch_size,
                        tui=tui
                    )
                    
                    tui.stop_event.set()
                    # Show completion screen for 5 seconds
                    for _ in range(50):  # 5 seconds at 10fps
                        live.update(generate_layout())
                        time.sleep(0.1)
                    
                    # Clear screen and show final summary
                    live.stop()
                    tui.console.clear()
                    
                    if irl:
                        # Show beautiful completion summary
                        summary_table = Table(show_header=False, box=box.ROUNDED, border_style="green")
                        summary_table.add_column(style="bold cyan", width=20)
                        summary_table.add_column(style="white", width=60)
                        
                        summary_table.add_row("", Text("🎉 Training Complete!", style="bold green"))
                        summary_table.add_row("", "")
                        summary_table.add_row("Model Path:", metadata['model_path'])
                        summary_table.add_row("", "")
                        summary_table.add_row(Text("Final Metrics:", style="bold"), "")
                        summary_table.add_row("  Loss:", f"{metadata['final_loss']:.6f}")
                        summary_table.add_row("  Reward μ:", f"{metadata['final_reward_mean']:.4f}")
                        summary_table.add_row("  Reward σ:", f"{metadata['final_reward_std']:.4f}")
                        summary_table.add_row("", "")
                        summary_table.add_row(Text("Training Config:", style="bold"), "")
                        summary_table.add_row("  Epochs:", str(num_epochs))
                        summary_table.add_row("  Batch Size:", str(batch_size))
                        summary_table.add_row("  Learning Rate:", str(learning_rate))
                        summary_table.add_row("", "")
                        summary_table.add_row(Text("Data Used:", style="bold"), "")
                        summary_table.add_row("  Total Actions:", f"{metadata['total_actions']:,}")
                        summary_table.add_row("  Sources:", ", ".join(metadata['sources']))
                        summary_table.add_row("  Data Range:", f"{datetime.fromtimestamp(metadata['first_timestamp']).strftime('%Y-%m-%d %H:%M')} to {datetime.fromtimestamp(metadata['last_timestamp']).strftime('%Y-%m-%d %H:%M')}")
                        
                        summary_panel = Panel(summary_table, title="Training Summary", border_style="green")
                        tui.console.print(summary_panel)
                        tui.console.print(f"\n[bold green]✅ Model ready for predictions![/bold green]")
                except KeyboardInterrupt:
                    tui.stop_event.set()
                    tui.console.print("\n[yellow]Training interrupted by user[/yellow]")
                finally:
                    tui.stop_event.set()
        else:
            # Basic training without TUI
            irl, history, metadata = train_model(
                db_path=str(db_path),
                num_epochs=num_epochs,
                learning_rate=learning_rate,
                batch_size=batch_size,
                tui=None
            )
            
            if irl:
                print("🎉 Success! Model is ready for predictions.")
                print(f"Model saved to: {metadata['model_path']}")
    except Exception as e:
        if tui:
            tui.console.print(f"\n[bold red]❌ Training failed: {e}[/bold red]")
        else:
            print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
