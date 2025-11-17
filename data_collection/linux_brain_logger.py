"""
Linux "Second Brain" Logger
Comprehensive logging of all meaningful activities on Linux for neural network training.
"""

import time
import json
import requests
import psutil
import subprocess
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, List
import re

try:
    import Xlib.display
    from Xlib import X
    HAS_X11 = True
except ImportError:
    HAS_X11 = False
    print("Warning: X11 not available")


class LinuxBrainLogger:
    """
    Comprehensive Linux activity logger - tracks everything for "second brain" feel.
    """
    
    def __init__(self, api_url: str = 'http://localhost:5000/api', api_key: str = 'local-dev-key-change-in-production'):
        self.api_url = api_url
        self.api_key = api_key
        self.last_active_app = None
        self.last_window_title = None
        self.last_terminal_command = None
        self.last_git_repo = None
        self.known_processes = set()
        self.terminal_history_file = Path.home() / '.bash_history'
        self._initialize_tracking()
    
    def _initialize_tracking(self):
        """Initialize tracking state."""
        try:
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    self.known_processes.add(proc.info['pid'])
                except:
                    continue
        except:
            pass
    
    def log_action(self, action_type: str, context: Dict):
        """Log action to backend."""
        try:
            response = requests.post(
                f'{self.api_url}/log-action',
                json={
                    'source': 'system',
                    'action_type': action_type,
                    'context': context,
                    'timestamp': time.time()
                },
                headers={'X-API-Key': self.api_key},
                timeout=2
            )
            return response.status_code == 201
        except:
            return False
    
    # ==================== FILE OPERATIONS ====================
    
    def track_file_operations(self):
        """Track file operations using inotify (if available) or process monitoring."""
        try:
            # Track recently modified files
            for proc in psutil.process_iter(['pid', 'name', 'open_files']):
                try:
                    if proc.info['open_files']:
                        for file_info in proc.info['open_files']:
                            file_path = file_info.path
                            if self._is_user_file(file_path):
                                self.log_action('file_access', {
                                    'file_path': file_path,
                                    'app': proc.info['name'],
                                    'pid': proc.info['pid'],
                                    'operation': 'open'
                                })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            pass
    
    def _is_user_file(self, file_path: str) -> bool:
        """Check if file is a user file (not system file)."""
        user_home = str(Path.home())
        system_paths = ['/proc', '/sys', '/dev', '/tmp', '/var/log']
        
        if not file_path.startswith(user_home):
            return False
        
        for sys_path in system_paths:
            if file_path.startswith(sys_path):
                return False
        
        return True
    
    # ==================== TERMINAL COMMANDS ====================
    
    def track_terminal_commands(self):
        """Track terminal commands from bash history."""
        try:
            if not self.terminal_history_file.exists():
                return
            
            # Read last few lines of history
            with open(self.terminal_history_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                if lines:
                    last_command = lines[-1].strip()
                    if last_command and last_command != self.last_terminal_command:
                        # Parse command
                        command_parts = last_command.split()
                        if command_parts:
                            cmd = command_parts[0]
                            args = ' '.join(command_parts[1:]) if len(command_parts) > 1 else ''
                            
                            self.log_action('terminal_command', {
                                'command': cmd,
                                'args': args[:200],  # Limit length
                                'full_command': last_command[:500],
                                'timestamp': time.time()
                            })
                            
                            self.last_terminal_command = last_command
                            
                            # Detect git commands
                            if cmd == 'git':
                                self._track_git_command(args)
        except Exception as e:
            pass
    
    def _track_git_command(self, args: str):
        """Track git-specific commands."""
        git_commands = {
            'commit': 'git_commit',
            'push': 'git_push',
            'pull': 'git_pull',
            'clone': 'git_clone',
            'branch': 'git_branch',
            'checkout': 'git_checkout',
            'merge': 'git_merge',
        }
        
        for cmd, action_type in git_commands.items():
            if args.startswith(cmd):
                # Try to extract repo path
                repo_path = self._get_current_git_repo()
                
                self.log_action(action_type, {
                    'git_command': cmd,
                    'args': args[:200],
                    'repo_path': repo_path,
                    'timestamp': time.time()
                })
                break
    
    def _get_current_git_repo(self) -> Optional[str]:
        """Get current git repository path."""
        try:
            result = subprocess.run(
                ['git', 'rev-parse', '--show-toplevel'],
                capture_output=True,
                text=True,
                timeout=1,
                cwd=os.getcwd()
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except:
            pass
        return None
    
    # ==================== NETWORK ACTIVITY ====================
    
    def track_network_activity(self):
        """Track network connections and activity."""
        try:
            connections = psutil.net_connections(kind='inet')
            active_connections = []
            
            for conn in connections:
                if conn.status == 'ESTABLISHED':
                    try:
                        proc = psutil.Process(conn.pid)
                        app_name = proc.name()
                        
                        # Only track user applications
                        if self._is_gui_app(app_name, ''):
                            active_connections.append({
                                'app': app_name,
                                'local_addr': f"{conn.laddr.ip}:{conn.laddr.port}",
                                'remote_addr': f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                                'status': conn.status
                            })
                    except:
                        continue
            
            if active_connections:
                self.log_action('network_activity', {
                    'connections': active_connections[:10],  # Limit to 10
                    'total_connections': len(active_connections),
                    'timestamp': time.time()
                })
        except Exception as e:
            pass
    
    # ==================== SYSTEM RESOURCES ====================
    
    def track_system_resources(self):
        """Track CPU, memory, disk usage patterns."""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Get top processes by CPU
            top_processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    proc.info['cpu_percent'] = proc.cpu_percent(interval=0.1)
                    if proc.info['cpu_percent'] > 1.0:  # Only significant usage
                        top_processes.append({
                            'name': proc.info['name'],
                            'cpu': round(proc.info['cpu_percent'], 1),
                            'memory': round(proc.info['memory_percent'], 1)
                        })
                except:
                    continue
            
            top_processes.sort(key=lambda x: x['cpu'], reverse=True)
            
            self.log_action('system_resources', {
                'cpu_percent': round(cpu_percent, 1),
                'memory_percent': round(memory.percent, 1),
                'disk_percent': round(disk.percent, 1),
                'top_processes': top_processes[:5],  # Top 5
                'timestamp': time.time()
            })
        except Exception as e:
            pass
    
    # ==================== FOCUS SESSIONS ====================
    
    def track_focus_sessions(self):
        """Track focused work sessions (extended time in same app)."""
        active_window = self._get_active_window()
        if not active_window:
            return
        
        current_app = active_window.get('app', 'Unknown')
        
        # If same app for > 5 minutes, it's a focus session
        if current_app == self.last_active_app:
            if hasattr(self, 'focus_start_time'):
                focus_duration = time.time() - self.focus_start_time
                if focus_duration > 300:  # 5 minutes
                    if not hasattr(self, 'focus_logged') or not self.focus_logged:
                        self.log_action('focus_session', {
                            'app': current_app,
                            'window_title': active_window.get('title', ''),
                            'duration': round(focus_duration, 2),
                            'timestamp': time.time()
                        })
                        self.focus_logged = True
            else:
                self.focus_start_time = time.time()
                self.focus_logged = False
        else:
            self.focus_start_time = time.time()
            self.focus_logged = False
    
    # ==================== APP LAUNCHES ====================
    
    def track_app_launches(self):
        """Track when new applications are launched."""
        try:
            current_pids = set()
            for proc in psutil.process_iter(['pid', 'name', 'exe', 'create_time', 'ppid']):
                try:
                    pid = proc.info['pid']
                    current_pids.add(pid)
                    
                    if pid not in self.known_processes:
                        app_name = proc.info['name']
                        exe_path = proc.info.get('exe', '')
                        
                        if self._is_gui_app(app_name, exe_path):
                            self.log_action('app_launch', {
                                'app': app_name,
                                'exe_path': exe_path,
                                'pid': pid,
                                'parent_pid': proc.info.get('ppid'),
                                'launch_time': proc.info.get('create_time', time.time()),
                                'timestamp': time.time()
                            })
                        
                        self.known_processes.add(pid)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            self.known_processes = self.known_processes.intersection(current_pids)
        except Exception as e:
            pass
    
    # ==================== WINDOW TRACKING ====================
    
    def _get_active_window(self) -> Optional[Dict]:
        """Get currently active window."""
        if not HAS_X11:
            return None
        
        try:
            display = Xlib.display.Display()
            root = display.screen().root
            window = root.get_full_property(
                display.intern_atom('_NET_ACTIVE_WINDOW'),
                X.AnyPropertyType
            ).value[0]
            
            if window:
                window_obj = display.create_resource_object('window', window)
                window_name = window_obj.get_wm_name()
                window_class = window_obj.get_wm_class()
                
                pid = None
                try:
                    pid_prop = window_obj.get_full_property(
                        display.intern_atom('_NET_WM_PID'),
                        X.AnyPropertyType
                    )
                    if pid_prop:
                        pid = pid_prop.value[0]
                except:
                    pass
                
                exe_path = None
                app_name = window_class[0] if window_class else 'Unknown'
                if pid:
                    try:
                        proc = psutil.Process(pid)
                        exe_path = proc.exe()
                        app_name = proc.name()
                    except:
                        pass
                
                return {
                    'title': window_name or 'Unknown',
                    'class': window_class[0] if window_class else 'Unknown',
                    'app': app_name,
                    'pid': pid,
                    'exe_path': exe_path
                }
        except:
            pass
        
        return None
    
    def track_window_changes(self):
        """Track window focus and title changes."""
        active_window = self._get_active_window()
        if not active_window:
            return
        
        current_app = active_window.get('app', 'Unknown')
        current_title = active_window.get('title', '')
        
        # App switch
        if current_app != self.last_active_app:
            if self.last_active_app:
                self.log_action('app_switch', {
                    'from_app': self.last_active_app,
                    'to_app': current_app,
                    'window_title': current_title,
                    'app_pid': active_window.get('pid'),
                    'timestamp': time.time()
                })
            self.last_active_app = current_app
        
        # Window title change
        if current_app == self.last_active_app and current_title != self.last_window_title:
            if self.last_window_title:
                self.log_action('window_change', {
                    'app': current_app,
                    'from_title': self.last_window_title,
                    'to_title': current_title,
                    'timestamp': time.time()
                })
            self.last_window_title = current_title
    
    # ==================== UTILITY METHODS ====================
    
    def _is_gui_app(self, app_name: str, exe_path: str) -> bool:
        """Check if process is a GUI application."""
        system_keywords = [
            'systemd', 'kernel', 'dbus', 'gdm', 'pulseaudio', 'pipewire',
            'gnome-shell', 'kde', 'xorg', 'wayland', 'compositor',
            'ssh', 'bash', 'zsh', 'sh', 'python', 'node', 'npm',
            'system', 'daemon', 'service'
        ]
        
        app_lower = app_name.lower()
        exe_lower = exe_path.lower() if exe_path else ''
        
        for keyword in system_keywords:
            if keyword in app_lower or keyword in exe_lower:
                return False
        
        return True
    
    # ==================== MAIN LOOP ====================
    
    def run(self, interval: int = 3):
        """Run the comprehensive logger."""
        print("🧠 Linux Brain Logger started!")
        print("   Tracking: Files, Terminal, Network, Resources, Focus, Apps, Windows")
        
        last_file_check = time.time()
        last_terminal_check = time.time()
        last_network_check = time.time()
        last_resources_check = time.time()
        last_app_check = time.time()
        
        while True:
            try:
                # Window tracking (frequent - every interval)
                self.track_window_changes()
                self.track_focus_sessions()
                
                # File operations (every 10 seconds)
                if time.time() - last_file_check >= 10:
                    self.track_file_operations()
                    last_file_check = time.time()
                
                # Terminal commands (every 5 seconds)
                if time.time() - last_terminal_check >= 5:
                    self.track_terminal_commands()
                    last_terminal_check = time.time()
                
                # Network activity (every 30 seconds)
                if time.time() - last_network_check >= 30:
                    self.track_network_activity()
                    last_network_check = time.time()
                
                # System resources (every 60 seconds)
                if time.time() - last_resources_check >= 60:
                    self.track_system_resources()
                    last_resources_check = time.time()
                
                # App launches (every 5 seconds)
                if time.time() - last_app_check >= 5:
                    self.track_app_launches()
                    last_app_check = time.time()
                
                time.sleep(interval)
            except KeyboardInterrupt:
                print("\n🛑 Linux Brain Logger stopped")
                break
            except Exception as e:
                print(f"Error in brain logger: {e}")
                time.sleep(interval)


if __name__ == '__main__':
    logger = LinuxBrainLogger()
    logger.run(interval=3)




