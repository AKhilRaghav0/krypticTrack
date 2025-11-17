#!/bin/bash

# KrypticTrack Start/Stop Script
# Manages both Flask backend and Vite frontend

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PID files
BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/.frontend.pid"

# Functions
start_backend() {
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
        echo -e "${YELLOW}Backend is already running (PID: $(cat "$BACKEND_PID_FILE"))${NC}"
        return
    fi

    echo -e "${BLUE}🚀 Starting Flask backend...${NC}"
    
    # Activate virtual environment if it exists
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    
    # Start Flask in background
    python backend/app.py > logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$BACKEND_PID_FILE"
    
    # Wait a bit to check if it started successfully
    sleep 2
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
        echo -e "${BLUE}   API: http://localhost:5000${NC}"
    else
        echo -e "${RED}❌ Backend failed to start. Check logs/backend.log${NC}"
        rm -f "$BACKEND_PID_FILE"
        return 1
    fi
}

start_system_logger() {
    SYSTEM_LOGGER_PID_FILE="$SCRIPT_DIR/.system_logger.pid"
    
    if [ -f "$SYSTEM_LOGGER_PID_FILE" ] && kill -0 "$(cat "$SYSTEM_LOGGER_PID_FILE")" 2>/dev/null; then
        echo -e "${YELLOW}System logger is already running (PID: $(cat "$SYSTEM_LOGGER_PID_FILE"))${NC}"
        return
    fi

    echo -e "${BLUE}🖥️  Starting system logger...${NC}"
    
    # Activate virtual environment if it exists
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    
    # Start system logger in background
    python data_collection/system_logger.py > logs/system_logger.log 2>&1 &
    SYSTEM_LOGGER_PID=$!
    echo $SYSTEM_LOGGER_PID > "$SYSTEM_LOGGER_PID_FILE"
    
    # Wait a bit to check if it started successfully
    sleep 1
    if kill -0 $SYSTEM_LOGGER_PID 2>/dev/null; then
        echo -e "${GREEN}✅ System logger started (PID: $SYSTEM_LOGGER_PID)${NC}"
    else
        echo -e "${YELLOW}⚠️  System logger may have failed. Check logs/system_logger.log${NC}"
        rm -f "$SYSTEM_LOGGER_PID_FILE"
    fi
}

stop_system_logger() {
    SYSTEM_LOGGER_PID_FILE="$SCRIPT_DIR/.system_logger.pid"
    
    if [ ! -f "$SYSTEM_LOGGER_PID_FILE" ]; then
        echo -e "${YELLOW}System logger is not running${NC}"
        return
    fi
    
    SYSTEM_LOGGER_PID=$(cat "$SYSTEM_LOGGER_PID_FILE")
    
    if kill -0 "$SYSTEM_LOGGER_PID" 2>/dev/null; then
        echo -e "${BLUE}🛑 Stopping system logger (PID: $SYSTEM_LOGGER_PID)...${NC}"
        kill "$SYSTEM_LOGGER_PID" 2>/dev/null || true
        sleep 1
        
        # Force kill if still running
        if kill -0 "$SYSTEM_LOGGER_PID" 2>/dev/null; then
            kill -9 "$SYSTEM_LOGGER_PID" 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✅ System logger stopped${NC}"
    else
        echo -e "${YELLOW}System logger process not found${NC}"
    fi
    
    rm -f "$SYSTEM_LOGGER_PID_FILE"
}

start_frontend() {
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
        echo -e "${YELLOW}Frontend is already running (PID: $(cat "$FRONTEND_PID_FILE"))${NC}"
        return
    fi

    echo -e "${BLUE}🎨 Starting Vite frontend...${NC}"
    
    cd frontend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing dependencies...${NC}"
        npm install
    fi
    
    # Start Vite in background
    npm run dev > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "../$FRONTEND_PID_FILE"
    
    cd ..
    
    # Wait a bit to check if it started successfully
    sleep 3
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
        echo -e "${BLUE}   Dev Server: http://localhost:3000${NC}"
    else
        echo -e "${RED}❌ Frontend failed to start. Check logs/frontend.log${NC}"
        rm -f "$FRONTEND_PID_FILE"
        return 1
    fi
}

stop_backend() {
    if [ ! -f "$BACKEND_PID_FILE" ]; then
        echo -e "${YELLOW}Backend is not running${NC}"
        return
    fi
    
    BACKEND_PID=$(cat "$BACKEND_PID_FILE")
    
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${BLUE}🛑 Stopping backend (PID: $BACKEND_PID)...${NC}"
        kill "$BACKEND_PID" 2>/dev/null || true
        sleep 1
        
        # Force kill if still running
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            kill -9 "$BACKEND_PID" 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✅ Backend stopped${NC}"
    else
        echo -e "${YELLOW}Backend process not found${NC}"
    fi
    
    rm -f "$BACKEND_PID_FILE"
}

stop_frontend() {
    if [ ! -f "$FRONTEND_PID_FILE" ]; then
        echo -e "${YELLOW}Frontend is not running${NC}"
        return
    fi
    
    FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
    
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "${BLUE}🛑 Stopping frontend (PID: $FRONTEND_PID)...${NC}"
        kill "$FRONTEND_PID" 2>/dev/null || true
        sleep 1
        
        # Force kill if still running
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            kill -9 "$FRONTEND_PID" 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✅ Frontend stopped${NC}"
    else
        echo -e "${YELLOW}Frontend process not found${NC}"
    fi
    
    rm -f "$FRONTEND_PID_FILE"
}

build_frontend() {
    echo -e "${BLUE}🔨 Building frontend for production...${NC}"
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing dependencies...${NC}"
        npm install
    fi
    
    npm run build
    cd ..
    echo -e "${GREEN}✅ Frontend build complete${NC}"
}

status() {
    echo -e "${BLUE}📊 KrypticTrack Status${NC}"
    echo ""
    
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
        echo -e "${GREEN}✅ Backend: Running (PID: $(cat "$BACKEND_PID_FILE"))${NC}"
        echo -e "   URL: http://localhost:5000"
    else
        echo -e "${RED}❌ Backend: Not running${NC}"
    fi
    
    echo ""
    
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
        echo -e "${GREEN}✅ Frontend: Running (PID: $(cat "$FRONTEND_PID_FILE"))${NC}"
        echo -e "   URL: http://localhost:3000"
    else
        echo -e "${RED}❌ Frontend: Not running${NC}"
    fi
    
    echo ""
    
    SYSTEM_LOGGER_PID_FILE="$SCRIPT_DIR/.system_logger.pid"
    if [ -f "$SYSTEM_LOGGER_PID_FILE" ] && kill -0 "$(cat "$SYSTEM_LOGGER_PID_FILE")" 2>/dev/null; then
        echo -e "${GREEN}✅ System Logger: Running (PID: $(cat "$SYSTEM_LOGGER_PID_FILE"))${NC}"
    else
        echo -e "${RED}❌ System Logger: Not running${NC}"
    fi
}

# Main command handling
case "${1:-}" in
    start)
        echo -e "${BLUE}🚀 Starting KrypticTrack...${NC}"
        echo ""
        start_backend
        echo ""
        start_frontend
        echo ""
        start_system_logger
        echo ""
        echo -e "${GREEN}✨ KrypticTrack is running!${NC}"
        echo -e "${BLUE}   Frontend: http://localhost:3000${NC}"
        echo -e "${BLUE}   Backend API: http://localhost:5000${NC}"
        ;;
    
    stop)
        echo -e "${BLUE}🛑 Stopping KrypticTrack...${NC}"
        echo ""
        stop_frontend
        echo ""
        stop_backend
        echo ""
        stop_system_logger
        echo ""
        echo -e "${GREEN}✅ KrypticTrack stopped${NC}"
        ;;
    
    restart)
        echo -e "${BLUE}🔄 Restarting KrypticTrack...${NC}"
        echo ""
        stop_frontend
        stop_backend
        stop_system_logger
        sleep 2
        start_backend
        echo ""
        start_frontend
        echo ""
        start_system_logger
        echo ""
        echo -e "${GREEN}✨ KrypticTrack restarted!${NC}"
        ;;
    
    status)
        status
        ;;
    
    build)
        build_frontend
        ;;
    
    start-backend)
        start_backend
        ;;
    
    start-frontend)
        start_frontend
        ;;
    
    stop-backend)
        stop_backend
        ;;
    
    stop-frontend)
        stop_frontend
        ;;
    
    *)
        echo -e "${BLUE}KrypticTrack Management Script${NC}"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|build|start-backend|start-frontend|stop-backend|stop-frontend}"
        echo ""
        echo "Commands:"
        echo "  start           - Start both backend and frontend"
        echo "  stop            - Stop both backend and frontend"
        echo "  restart         - Restart both services"
        echo "  status          - Show status of both services"
        echo "  build           - Build frontend for production"
        echo "  start-backend   - Start only backend"
        echo "  start-frontend  - Start only frontend"
        echo "  stop-backend    - Stop only backend"
        echo "  stop-frontend   - Stop only frontend"
        echo ""
        exit 1
        ;;
esac

