// Content script for YouTube Study Mode extension 

// Load channelUtils from utils/channelUtils.js
// (Assumes manifest.json includes contentScript.js and button.css, and channelUtils.js is loaded via popup or bundled)

const BUTTON_ID = 'studyModeAddBtn';
let debounceTimer = null;
let studyModeEnabled = false;
let currentChannelId = null;

// Initialize study mode state
chrome.storage.local.get(['studyModeEnabled'], (result) => {
  studyModeEnabled = result.studyModeEnabled || false;
  if (studyModeEnabled) {
    applyStudyModeFiltering();
  }
});

function createAddButton() {
  if (document.getElementById(BUTTON_ID)) return; // Prevent duplicate
  
  const channelId = window.channelUtils.extractChannelId();
  if (!channelId) return;

  // Check if channel is already in study list
  window.channelUtils.isChannelInStudy(channelId, (isStudyChannel) => {
    if (isStudyChannel) return; // Don't show button for study channels

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.textContent = 'Add to Study Mode';
    btn.onclick = () => {
      window.channelUtils.addChannelToStudy(channelId, () => {
        btn.textContent = 'Added!';
        setTimeout(() => { 
          btn.remove(); // Remove button after adding
          // Refresh the page to apply changes
          window.location.reload();
        }, 1000);
      });
    };
    document.body.appendChild(btn);
  });
}

function removeAddButton() {
  const btn = document.getElementById(BUTTON_ID);
  if (btn) btn.remove();
}

function shouldShowButton() {
  // Show on video or channel pages only
  const isVideo = /^\/watch/.test(window.location.pathname);
  const isChannel = /^\/channel\//.test(window.location.pathname);
  return isVideo || isChannel;
}

function handlePageChange() {
  // Clear any existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Set a new timer
  debounceTimer = setTimeout(() => {
    removeAddButton();
    if (shouldShowButton()) {
      createAddButton();
    }
    if (studyModeEnabled) {
      applyStudyModeFiltering();
    }
  }, 500); // 500ms debounce
}

function isAdPlaying() {
  // Check for various ad indicators
  return (
    document.querySelector('.ytp-ad-player-overlay') !== null ||
    document.querySelector('.ytp-ad-overlay-container') !== null ||
    document.querySelector('.ytp-ad-skip-button') !== null ||
    document.querySelector('.ytp-ad-preview-container') !== null
  );
}

function applyStudyModeFiltering() {
  if (!studyModeEnabled) {
    removeAllFiltering();
    return;
  }

  // Remove any existing warning overlay
  const existingWarning = document.querySelector('div[style*="position: fixed"]');
  if (existingWarning) existingWarning.remove();

  // If an ad is playing, don't apply filtering
  if (isAdPlaying()) {
    removeAllFiltering();
    return;
  }

  // Get current channel ID
  const newChannelId = window.channelUtils.extractChannelId();
  if (!newChannelId) return;

  // Only reapply filtering if channel changed
  if (newChannelId !== currentChannelId) {
    currentChannelId = newChannelId;
    
    // Check if current channel is in study list
    window.channelUtils.isChannelInStudy(currentChannelId, (isStudyChannel) => {
      if (!isStudyChannel) {
        blockNonStudyContent();
      } else {
        removeAllFiltering();
      }
    });
  }

  // Always block distracting elements
  blockDistractingElements();
}

function removeAllFiltering() {
  // Reset video player state
  const videoPlayer = document.querySelector('#movie_player');
  if (videoPlayer) {
    videoPlayer.style.filter = '';
    videoPlayer.style.pointerEvents = '';
  }

  // Remove warning overlay
  const warning = document.querySelector('div[style*="position: fixed"]');
  if (warning) warning.remove();

  // Reset body display
  document.body.style.display = '';

  // Reset recommendations and sidebar
  const recommendations = document.querySelector('#secondary');
  if (recommendations) recommendations.style.display = '';
  const sidebar = document.querySelector('#related');
  if (sidebar) sidebar.style.display = '';
}

function blockNonStudyContent() {
  // Block video player
  const videoPlayer = document.querySelector('#movie_player');
  if (videoPlayer) {
    videoPlayer.style.filter = 'blur(10px)';
    videoPlayer.style.pointerEvents = 'none';
  }

  // Add warning overlay
  const warning = document.createElement('div');
  warning.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 20px;
    border-radius: 8px;
    z-index: 10000;
    text-align: center;
    max-width: 80%;
  `;
  warning.textContent = 'This channel is not in your study list. Enable Study Mode in the extension popup to view content.';
  document.body.appendChild(warning);
}

function blockDistractingElements() {
  // Block Shorts
  if (window.location.pathname.includes('/shorts/')) {
    document.body.style.display = 'none';
    return;
  }

  // Block recommendations
  const recommendations = document.querySelector('#secondary');
  if (recommendations) {
    recommendations.style.display = 'none';
  }

  // Block sidebar
  const sidebar = document.querySelector('#related');
  if (sidebar) {
    sidebar.style.display = 'none';
  }
}

// Initial run
handlePageChange();

// Listen for YouTube's navigation events
document.addEventListener('yt-navigate-finish', handlePageChange);
document.addEventListener('yt-page-data-updated', handlePageChange);

// Use a more targeted observer for the main content area
const targetNode = document.querySelector('#content');
if (targetNode) {
  const observer = new MutationObserver((mutations) => {
    // Only trigger if the mutations affect the page structure
    const shouldUpdate = mutations.some(mutation => 
      mutation.type === 'childList' && 
      mutation.target.id === 'content'
    );
    
    if (shouldUpdate) {
      handlePageChange();
    }
  });

  observer.observe(targetNode, {
    childList: true,
    subtree: false // Only observe direct children
  });
}

// Add observer for ad state changes
const adObserver = new MutationObserver((mutations) => {
  if (studyModeEnabled) {
    applyStudyModeFiltering();
  }
});

// Observe the video player for ad-related changes
const videoContainer = document.querySelector('#movie_player');
if (videoContainer) {
  adObserver.observe(videoContainer, {
    childList: true,
    subtree: true,
    attributes: true
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STUDY_MODE_TOGGLED') {
    studyModeEnabled = message.enabled;
    if (studyModeEnabled) {
      applyStudyModeFiltering();
    } else {
      removeAllFiltering();
    }
  }
});

// Clean up on page unload
window.addEventListener('unload', () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  removeAddButton();
  adObserver.disconnect();
}); 