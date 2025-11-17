"""
Better logging system - no console spam, structured logging
"""

import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


class StructuredLogger:
    """Structured logger that doesn't spam console."""
    
    def __init__(self, log_file: Optional[Path] = None):
        self.log_file = log_file or Path('logs/backend.log')
        self.log_file.parent.mkdir(exist_ok=True)
        
        # Setup logging
        self.logger = logging.getLogger('kryptictrack')
        self.logger.setLevel(logging.INFO)
        
        # File handler (all logs)
        file_handler = logging.FileHandler(self.log_file)
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        self.logger.addHandler(file_handler)
        
        # NO console handler - all logs go to file only
        # Console stays completely clean
        
        # Store recent logs in memory for API access
        self.recent_logs: List[Dict] = []
        self.max_recent_logs = 100
    
    def log_action(self, level: str, message: str, **kwargs):
        """Log an action with structured data."""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'level': level,
            'message': message,
            **kwargs
        }
        
        # Add to recent logs
        self.recent_logs.append(log_entry)
        if len(self.recent_logs) > self.max_recent_logs:
            self.recent_logs.pop(0)
        
        # Log to file
        if level == 'error':
            self.logger.error(f"{message} | {json.dumps(kwargs)}")
        elif level == 'warning':
            self.logger.warning(f"{message} | {json.dumps(kwargs)}")
        elif level == 'info':
            self.logger.info(f"{message} | {json.dumps(kwargs)}")
        else:
            self.logger.debug(f"{message} | {json.dumps(kwargs)}")
    
    def get_recent_logs(self, level: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """Get recent logs, optionally filtered by level."""
        logs = self.recent_logs
        if level:
            logs = [log for log in logs if log['level'] == level]
        return logs[-limit:]
    
    def get_stats(self) -> Dict:
        """Get logging statistics."""
        total = len(self.recent_logs)
        errors = len([l for l in self.recent_logs if l['level'] == 'error'])
        warnings = len([l for l in self.recent_logs if l['level'] == 'warning'])
        
        return {
            'total_logs': total,
            'errors': errors,
            'warnings': warnings,
            'info': total - errors - warnings
        }


# Global logger instance
_logger_instance = None

def get_logger() -> StructuredLogger:
    """Get the global logger instance."""
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = StructuredLogger()
    return _logger_instance

