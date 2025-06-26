// Utility functions for channel ID extraction and storage

/**
 * Extracts the channel ID from the current YouTube page.
 * Supports video and channel pages.
 */
function extractChannelId() {
  // Try to get channel ID from meta tags (works on video pages)
  const meta = document.querySelector('meta[itemprop="channelId"]');
  if (meta) return meta.content;

  // Try to get channel ID from URL (works on channel pages)
  const match = window.location.pathname.match(/\/channel\/([\w-]+)/);
  if (match) return match[1];

  // Try to get channel ID from user or custom URLs (fallback)
  const links = document.querySelectorAll('a[href*="/channel/"]');
  for (const link of links) {
    const m = link.href.match(/\/channel\/([\w-]+)/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Adds a channel to the studyChannels list in chrome.storage.local.
 */
async function addChannelToStudy(channelId, callback) {
  try {
    // Get channel details first
    const details = await getChannelDetails(channelId);
    
    // Create channel object
    const channel = {
      id: channelId,
      name: details.name,
      thumbnail: details.thumbnail
    };

    // Add to storage
    chrome.storage.local.get({ studyChannels: [] }, (data) => {
      const channels = data.studyChannels;
      // Check if channel already exists (by ID)
      if (!channels.some(c => c.id === channelId)) {
        channels.push(channel);
        chrome.storage.local.set({ studyChannels: channels }, callback);
      } else if (callback) {
        callback();
      }
    });

    // Just click the play button immediately
    const playButton = document.querySelector('.ytp-play-button');
    if (playButton) {
      playButton.click();
    }
  } catch (error) {
    console.error('Error adding channel to study:', error);
    // Add with default values if details fetch fails
    const channel = {
      id: channelId,
      name: `Channel ${channelId}`,
      thumbnail: `https://www.gstatic.com/youtube/img/channels/channel_${channelId}_default.png`
    };
    
    chrome.storage.local.get({ studyChannels: [] }, (data) => {
      const channels = data.studyChannels;
      if (!channels.some(c => c.id === channelId)) {
        channels.push(channel);
        chrome.storage.local.set({ studyChannels: channels }, callback);
      } else if (callback) {
        callback();
      }
    });
  }
}

/**
 * Checks if a channel ID is in the studyChannels list.
 */
function isChannelInStudy(channelId, callback) {
  chrome.storage.local.get({ studyChannels: [] }, (data) => {
    callback(data.studyChannels.some(c => c.id === channelId));
  });
}

/**
 * Gets the current list of study channels.
 */
function getStudyChannels(callback) {
  chrome.storage.local.get({ studyChannels: [] }, (data) => {
    callback(data.studyChannels);
  });
}

/**
 * Fetches channel details (name and thumbnail) from YouTube.
 */
async function getChannelDetails(channelId) {
  try {
    // First check cache
    const cacheResult = await new Promise(resolve => {
      chrome.storage.local.get({ channelDetailsCache: {} }, data => {
        const cache = data.channelDetailsCache[channelId];
        // Use cache if it exists and is less than 1 day old
        if (cache && cache.timestamp > Date.now() - 86400000) {
          resolve(cache);
        } else {
          resolve(null);
        }
      });
    });
    
    if (cacheResult) {
      console.log('Using cached channel details for', channelId);
      return {
        name: cacheResult.name,
        thumbnail: cacheResult.thumbnail
      };
    }

    // Fetch channel page
    const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch channel page');
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract channel name
    const name = doc.querySelector('meta[property="og:title"]')?.content?.replace(' - YouTube', '');

    // Extract channel thumbnail
    const thumbnail = doc.querySelector('meta[property="og:image"]')?.content;

    if (!name || !thumbnail) {
      throw new Error('Could not extract channel details');
    }

    const details = {
      name,
      thumbnail
    };

    // Cache the results
    await new Promise(resolve => {
      chrome.storage.local.get({ channelDetailsCache: {} }, data => {
        const cache = data.channelDetailsCache;
        cache[channelId] = {
          ...details,
          timestamp: Date.now()
        };
        chrome.storage.local.set({ channelDetailsCache: cache }, resolve);
      });
    });

    return details;
  } catch (error) {
    console.error('Error getting channel details:', error);
    return {
      name: `Channel ${channelId}`,
      thumbnail: `https://www.gstatic.com/youtube/img/channels/channel_${channelId}_default.png`
    };
  }
}

// Export functions for use in content scripts and popup
window.channelUtils = {
  extractChannelId,
  addChannelToStudy,
  isChannelInStudy,
  getStudyChannels,
  getChannelDetails
}; 