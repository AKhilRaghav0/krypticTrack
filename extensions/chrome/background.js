// Enhanced Chrome extension background - tracks EVERYTHING including history

const API_URL = 'http://localhost:5000/api';
const API_KEY = 'local-dev-key-change-in-production';

let isLogging = true;
let currentTab = null;
let tabStartTime = Date.now();
let scrollDepth = 0;
let tabHistory = []; // Track tab navigation history

// Helper function to safely parse URLs
function safeParseURL(urlString) {
    if (!urlString || typeof urlString !== 'string') {
        return null;
    }
    
    // Only parse http/https URLs
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
        return null;
    }
    
    try {
        return new URL(urlString);
    } catch (e) {
        return null;
    }
}

// Initialize
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ isLogging: true });
    console.log('KrypticTrack: Extension installed');
    
    // Start tracking browser history
    startHistoryTracking();
});

// Track browser history
async function startHistoryTracking() {
    // Get recent history items
    chrome.history.search({
        text: '',
        maxResults: 100,
        startTime: Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
    }, (historyItems) => {
        historyItems.forEach(item => {
            logAction('history_item', {
                url: item.url,
                title: item.title,
                visit_count: item.visitCount,
                last_visit_time: item.lastVisitTime,
                typed_count: item.typedCount || 0,
                timestamp: Date.now()
            });
        });
    });
    
    // Listen for new history items
    chrome.history.onVisited.addListener((historyItem) => {
        logAction('history_visit', {
            url: historyItem.url,
            title: historyItem.title,
            visit_count: historyItem.visitCount,
            timestamp: Date.now()
        });
    });
}

// Track tab changes with full context
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    if (!isLogging) return;

    const tab = await chrome.tabs.get(activeInfo.tabId);
    const previousTab = currentTab;
    const previousDuration = previousTab ? (Date.now() - tabStartTime) : 0;
    
    // Log tab_switch with full context
    if (previousTab && previousTab.url) {
        const prevUrl = safeParseURL(previousTab.url);
        const currUrl = safeParseURL(tab.url);
        
        if (prevUrl || currUrl) {
            logAction('tab_switch', {
                from_url: previousTab.url,
                from_domain: prevUrl ? prevUrl.hostname : 'unknown',
                from_path: prevUrl ? prevUrl.pathname : 'unknown',
                from_protocol: prevUrl ? prevUrl.protocol : 'unknown',
                from_title: previousTab.title || '',
                to_url: tab.url || 'unknown',
                to_domain: currUrl ? currUrl.hostname : 'unknown',
                to_path: currUrl ? currUrl.pathname : 'unknown',
                to_protocol: currUrl ? currUrl.protocol : 'unknown',
                to_title: tab.title || '',
                duration_on_previous: previousDuration,
                timestamp: Date.now()
            });
        } else {
            // Fallback for non-http URLs
            logAction('tab_switch', {
                from_url: previousTab.url || 'unknown',
                to_url: tab.url || 'unknown',
                from_title: previousTab.title || '',
                to_title: tab.title || '',
                duration_on_previous: previousDuration,
                timestamp: Date.now()
            });
        }
        
        // Add to tab history (only for http/https URLs)
        if (prevUrl) {
            tabHistory.push({
                url: previousTab.url,
                title: previousTab.title,
                duration: previousDuration,
                timestamp: Date.now() - previousDuration
            });
            if (tabHistory.length > 100) tabHistory.shift();
        }
    }
    
    currentTab = tab;
    tabStartTime = Date.now();
    scrollDepth = 0;

    // Always log tab_visit with full context
    if (tab.url) {
        const url = safeParseURL(tab.url);
        if (url) {
            logAction('tab_visit', {
                url: tab.url,
                domain: url.hostname,
                path: url.pathname,
                protocol: url.protocol,
                search_params: url.search,
                hash: url.hash,
                title: tab.title || '',
                timestamp: Date.now()
            });
        } else {
            // Fallback for non-http URLs (chrome://, about:, etc.)
            logAction('tab_visit', {
                url: tab.url,
                title: tab.title || '',
                timestamp: Date.now()
            });
        }
    }
});

// Track navigation - LOG EVERYTHING
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!isLogging) return;
    
    // Log page load when status is complete
    if (changeInfo.status === 'complete' && tab.url) {
        const url = safeParseURL(tab.url);
        if (url) {
            logAction('page_load', {
                url: tab.url,
                domain: url.hostname,
                path: url.pathname,
                protocol: url.protocol,
                search_params: url.search,
                hash: url.hash,
                title: tab.title || '',
                is_active_tab: currentTab && currentTab.id === tabId,
                timestamp: Date.now()
            });
        } else {
            // Fallback for non-http URLs
            logAction('page_load', {
                url: tab.url,
                title: tab.title || '',
                timestamp: Date.now()
            });
        }
        
        // Update current tab if it's the active one
        if (currentTab && currentTab.id === tabId) {
            currentTab = tab;
            tabStartTime = Date.now();
            scrollDepth = 0;
        }
    }
    
    // Track URL changes
    if (changeInfo.url && tab.url) {
        const url = safeParseURL(tab.url);
        if (url) {
            logAction('url_change', {
                url: tab.url,
                domain: url.hostname,
                path: url.pathname,
                title: tab.title || '',
                timestamp: Date.now()
            });
        } else {
            // Fallback for non-http URLs
            logAction('url_change', {
                url: tab.url,
                timestamp: Date.now()
            });
        }
    }
});

// Track tab closing
chrome.tabs.onRemoved.addListener((tabId) => {
    if (!isLogging || !currentTab || currentTab.id !== tabId) return;

    const duration = (Date.now() - tabStartTime) / 1000;
    logAction('tab_close', {
        url: currentTab.url || 'unknown',
        duration: duration,
        timestamp: Date.now()
    });
});

// Track new tab creation
chrome.tabs.onCreated.addListener((tab) => {
    if (!isLogging) return;
    logAction('tab_new', {
        url: tab.url || 'new_tab',
        timestamp: Date.now()
    });
});

// Listen for messages from content script - LOG EVERYTHING
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabUrl = sender.tab ? sender.tab.url : '';
    
    if (message.type === 'scroll') {
        scrollDepth = Math.max(scrollDepth, message.scrollPercentage);
        logAction('scroll', {
            scroll_percentage: message.scrollPercentage,
            scroll_velocity: message.scroll_velocity,
            scroll_direction: message.scroll_direction,
            url: tabUrl,
            timestamp: message.timestamp || Date.now()
        });
    } else if (message.type === 'scroll_checkpoint') {
        logAction('scroll_checkpoint', {
            checkpoint: message.percentage,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'keystroke') {
        logAction('keystroke', {
            key: message.key,
            code: message.code,
            timeSinceLastKey: message.timeSinceLastKey,
            isTyping: message.isTyping,
            target: message.target,
            targetType: message.targetType,
            targetId: message.targetId,
            targetClass: message.targetClass,
            cursorPosition: message.cursorPosition,
            textLength: message.textLength,
            typingSpeed: message.typingSpeed,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'keyup') {
        logAction('keyup', {
            key: message.key,
            code: message.code,
            holdDuration: message.holdDuration,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'mouse_move') {
        // Filtered - too high frequency, creates bloat
        return;
    } else if (false && message.type === 'mouse_move') {
        logAction('mouse_move', {
            x: message.x,
            y: message.y,
            velocity: message.velocity,
            elementTag: message.elementTag,
            elementId: message.elementId,
            elementClass: message.elementClass,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'mouse_click') {
        logAction('mouse_click', {
            x: message.x,
            y: message.y,
            clickType: message.clickType,
            clickValue: message.clickValue?.substring(0, 100),
            targetTag: message.targetTag,
            targetId: message.targetId,
            targetClass: message.targetClass,
            button: message.button,
            ctrlKey: message.ctrlKey,
            shiftKey: message.shiftKey,
            altKey: message.altKey,
            metaKey: message.metaKey,
            interactionCount: message.interactionCount,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'mouse_enter' || message.type === 'mouse_leave') {
        // Filtered - too high frequency, creates bloat
        return;
        logAction(message.type, {
            elementTag: message.elementTag,
            elementId: message.elementId,
            elementClass: message.elementClass,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'input_focus' || message.type === 'input_blur') {
        logAction(message.type, {
            inputType: message.inputType,
            name: message.name,
            id: message.id,
            valueLength: message.valueLength || 0,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'text_select') {
        logAction('text_select', {
            selectedText: message.selectedText,
            selectionLength: message.selectionLength,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'copy' || message.type === 'paste') {
        logAction(message.type, {
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'dom_change') {
        // Ignore dom_change - removed from content.js, too basic
        return; // Don't log it
        logAction('dom_change', {
            changeType: message.changeType,
            nodeCount: message.nodeCount,
            targetTag: message.targetTag,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'image_load') {
        logAction('image_load', {
            src: message.src,
            alt: message.alt,
            width: message.width,
            height: message.height,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'window_resize') {
        logAction('window_resize', {
            width: message.width,
            height: message.height,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'window_focus' || message.type === 'window_blur' || message.type === 'page_visibility') {
        logAction(message.type, {
            visible: message.visible,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'video_seek') {
        logAction('video_seek', {
            currentTime: message.currentTime,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'form_input') {
        logAction('form_input', {
            inputType: message.inputType,
            name: message.name,
            id: message.id,
            valueLength: message.valueLength,
            cursorPosition: message.cursorPosition,
            hasValue: message.hasValue,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'form_submit') {
        logAction('form_submit', {
            formId: message.formId,
            formAction: message.formAction,
            fieldCount: message.fieldCount,
            formData: message.formData,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'activity_summary') {
        logAction('activity_summary', {
            timeOnPage: message.timeOnPage,
            keystrokeCount: message.keystrokeCount,
            mouseClickCount: message.mouseClickCount,
            mouseMoveCount: message.mouseMoveCount,
            scrollDepth: message.scrollDepth,
            typingSpeed: message.typingSpeed,
            formInteractions: message.formInteractions,
            buttonClicks: message.buttonClicks,
            linkClicks: message.linkClicks,
            mouseDistance: message.mouseDistance,
            uniqueElementsInteracted: message.uniqueElementsInteracted,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'page_exit') {
        logAction('page_exit', {
            timeOnPage: message.timeOnPage,
            scrollDepth: message.scrollDepth,
            totalKeystrokes: message.totalKeystrokes,
            totalClicks: message.mouseClickCount,
            formInteractions: message.formInteractions,
            buttonClicks: message.buttonClicks,
            linkClicks: message.linkClicks,
            uniqueElementsInteracted: message.uniqueElementsInteracted,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'video_play') {
        logAction('video_play', {
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'video_pause') {
        logAction('video_pause', {
            duration: message.duration,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'video_progress') {
        logAction('video_progress', {
            percentage: message.percentage,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'github_repo_view') {
        logAction('github_repo_view', {
            repo: message.repo,
            path: message.path,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'github_file_view') {
        logAction('github_file_view', {
            file: message.file,
            repo: message.repo,
            url: tabUrl,
            timestamp: message.timestamp
        });
    } else if (message.type === 'search') {
        const tabUrl = sender.tab ? sender.tab.url : '';
        const url = safeParseURL(tabUrl);
        logAction('search', {
            query: message.query,
            searchEngine: message.searchEngine || (url ? url.hostname : 'unknown'),
            domain: url ? url.hostname : 'unknown',
            url: tabUrl,
            timestamp: message.timestamp || Date.now()
        });
    } else if (message.type === 'video_watch') {
        const tabUrl = sender.tab ? sender.tab.url : '';
        const url = safeParseURL(tabUrl);
        logAction('video_watch', {
            url: tabUrl,
            domain: url ? url.hostname : 'unknown',
            duration: message.duration,
            timestamp: Date.now()
        });
    }
    
    sendResponse({ success: true });
});

// Periodic history sync (every 5 minutes)
setInterval(() => {
    if (!isLogging) return;
    
    chrome.history.search({
        text: '',
        maxResults: 50,
        startTime: Date.now() - 5 * 60 * 1000 // Last 5 minutes
    }, (historyItems) => {
        historyItems.forEach(item => {
            logAction('history_sync', {
                url: item.url,
                title: item.title,
                visit_count: item.visitCount,
                last_visit_time: item.lastVisitTime,
                timestamp: Date.now()
            });
        });
    });
}, 5 * 60 * 1000);

// Log action to backend - LOG EVERYTHING
async function logAction(actionType, context) {
    if (!isLogging) return;

    try {
        const response = await fetch(`${API_URL}/log-action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                source: 'chrome',
                action_type: actionType,
                context: context
            })
        });
        
        if (!response.ok) {
            console.warn('KrypticTrack: Backend returned error', response.status);
        }
    } catch (error) {
        console.error('KrypticTrack: Failed to log action', error);
    }
}

// Toggle logging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggle_logging') {
        isLogging = !isLogging;
        chrome.storage.local.set({ isLogging: isLogging });
        sendResponse({ isLogging: isLogging });
    }
    return true;
});

// Get current logging status
chrome.storage.local.get(['isLogging'], (result) => {
    isLogging = result.isLogging !== false;
});
