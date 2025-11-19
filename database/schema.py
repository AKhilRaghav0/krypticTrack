"""Database schema definitions for KrypticTrack."""

def create_tables(db_connection):
    """Create all necessary tables for data collection."""
    cursor = db_connection.cursor()
    
    # Unified actions table (primary table for all sources)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            source TEXT NOT NULL,  -- 'vscode', 'chrome', 'system'
            action_type TEXT NOT NULL,
            context_json TEXT NOT NULL,  -- JSON string with action details
            state_vector BLOB,  -- Computed state vector (Phase 2)
            action_vector BLOB,  -- Computed action vector (Phase 2)
            session_id TEXT,
            created_at REAL DEFAULT (strftime('%s', 'now'))
        )
    """)
    
    # Training runs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS training_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at REAL NOT NULL,
            completed_at REAL,
            num_epochs INTEGER,
            final_loss REAL,
            accuracy REAL,
            model_path TEXT,
            notes TEXT,
            -- Data range tracking
            first_action_id INTEGER,
            last_action_id INTEGER,
            first_timestamp REAL,
            last_timestamp REAL,
            total_actions_used INTEGER,
            data_sources TEXT  -- JSON array of sources used
        )
    """)
    
    # Predictions log (for accuracy tracking)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            state_json TEXT,
            predicted_action TEXT,
            confidence REAL,
            actual_action TEXT,  -- Filled in later when action occurs
            was_correct BOOLEAN,
            session_id TEXT
        )
    """)
    
    # Insights/patterns discovered
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discovered_at REAL NOT NULL,
            pattern_type TEXT,  -- 'preference', 'anomaly', 'trend', 'pattern'
            description TEXT,
            confidence REAL,
            evidence_json TEXT
        )
    """)
    
    # Sessions (daily/continuous tracking)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            start_time REAL NOT NULL,
            end_time REAL,
            total_actions INTEGER DEFAULT 0,
            sources_used TEXT,  -- JSON array of sources
            context_summary TEXT  -- JSON object
        )
    """)
    
    # Work Sessions (daily work goals and analysis)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS work_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,  -- YYYY-MM-DD format
            start_time REAL NOT NULL,
            end_time REAL,
            planned_work TEXT,  -- What user planned to work on
            actual_summary TEXT,  -- LLM-generated summary of actual work
            time_wasted_minutes REAL,  -- Time wasted on distractions
            idle_time_minutes REAL,  -- Time spent idle
            focused_time_minutes REAL,  -- Time spent focused
            distractions TEXT,  -- JSON array of distractions
            achievements TEXT,  -- JSON array of achievements
            insights TEXT,  -- LLM-generated insights
            created_at REAL DEFAULT (strftime('%s', 'now'))
        )
    """)
    
    # Legacy tables (for backward compatibility with existing data collection)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS keystrokes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            key_name TEXT,
            key_code INTEGER,
            is_press BOOLEAN,
            duration_ms REAL,
            active_window TEXT,
            session_id TEXT
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mouse_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            event_type TEXT NOT NULL,
            x INTEGER,
            y INTEGER,
            button TEXT,
            scroll_delta_x REAL,
            scroll_delta_y REAL,
            active_window TEXT,
            session_id TEXT
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS application_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            event_type TEXT NOT NULL,
            application_name TEXT,
            window_title TEXT,
            process_id INTEGER,
            duration_seconds REAL,
            session_id TEXT
        )
    """)
    
    # Create indexes for faster queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actions_timestamp ON actions(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actions_source ON actions(source)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actions_type ON actions(action_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actions_session_id ON actions(session_id)")
    # Composite index for common query pattern: source + timestamp
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actions_source_timestamp ON actions(source, timestamp)")
    # Composite index for type + timestamp queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actions_type_timestamp ON actions(action_type, timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON predictions(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_predictions_was_correct ON predictions(was_correct)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_insights_discovered ON insights(discovered_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_training_runs_started ON training_runs(started_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_work_sessions_date ON work_sessions(date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_work_sessions_start_time ON work_sessions(start_time)")
    
    db_connection.commit()
    print("✅ Database tables created successfully")

