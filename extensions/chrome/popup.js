const API_URL = 'http://localhost:5000/api';
const API_KEY = 'local-dev-key-change-in-production';

let isLogging = true;

// Load status
chrome.storage.local.get(['isLogging'], (result) => {
    isLogging = result.isLogging !== false;
    updateUI();
});

// Toggle logging
document.getElementById('toggleBtn').addEventListener('click', async () => {
    isLogging = !isLogging;
    chrome.storage.local.set({ isLogging: isLogging });
    
    chrome.runtime.sendMessage({ action: 'toggle_logging' });
    updateUI();
});

// View stats
document.getElementById('statsBtn').addEventListener('click', async () => {
    try {
        const response = await fetch(`${API_URL}/stats`, {
            headers: { 'X-API-Key': API_KEY }
        });
        const data = await response.json();
        
        document.getElementById('actionCount').textContent = data.total_actions || 0;
        document.getElementById('sessionTime').textContent = formatDuration(data.session_duration_seconds || 0);
        document.getElementById('stats').style.display = 'block';
    } catch (error) {
        alert('Backend not available. Make sure Flask server is running.');
    }
});

function updateUI() {
    const indicator = document.getElementById('indicator');
    const statusText = document.getElementById('statusText');
    const toggleBtn = document.getElementById('toggleBtn');
    
    if (isLogging) {
        indicator.classList.remove('off');
        statusText.textContent = 'Logging Active';
        toggleBtn.textContent = 'Pause Logging';
    } else {
        indicator.classList.add('off');
        statusText.textContent = 'Logging Paused';
        toggleBtn.textContent = 'Resume Logging';
    }
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}




