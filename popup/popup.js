// Logic for YouTube Study Mode popup UI

document.addEventListener('DOMContentLoaded', () => {
  const toggleStudyMode = document.getElementById('toggleStudyMode');
  const channelList = document.getElementById('channelList');
  const clearChannels = document.getElementById('clearChannels');
  const exportChannels = document.getElementById('exportChannels');

  // Load and display study mode state
  chrome.storage.local.get(['studyModeEnabled'], (result) => {
    toggleStudyMode.checked = result.studyModeEnabled || false;
  });

  // Load and display study channels
  async function loadChannels() {
    channelList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading channels...</div>';
    
    chrome.storage.local.get(['studyChannels'], async (result) => {
      const channels = result.studyChannels || [];
      channelList.innerHTML = '';
      
      if (channels.length === 0) {
        channelList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No channels added yet</div>';
        return;
      }

      // Handle legacy format (array of strings)
      if (channels.length > 0 && typeof channels[0] === 'string') {
        // Convert legacy format to new format
        const updatedChannels = await Promise.all(channels.map(async (channelId) => {
          try {
            const details = await window.channelUtils.getChannelDetails(channelId);
            return {
              id: channelId,
              name: details.name,
              thumbnail: details.thumbnail
            };
          } catch (error) {
            console.error('Error converting legacy channel:', error);
            return {
              id: channelId,
              name: `Channel ${channelId}`,
              thumbnail: `https://www.gstatic.com/youtube/img/channels/channel_${channelId}_default.png`
            };
          }
        }));
        
        // Save updated format
        chrome.storage.local.set({ studyChannels: updatedChannels });
        channels = updatedChannels;
      }

      for (const channel of channels) {
        const li = document.createElement('li');
        li.style.cssText = `
          display: flex;
          align-items: center;
          padding: 8px;
          margin: 4px 0;
          background: #f5f5f5;
          border-radius: 4px;
          transition: background-color 0.2s;
        `;

        // Create channel item with thumbnail and name
        li.innerHTML = `
          <img src="${channel.thumbnail}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px; object-fit: cover;">
          <span style="flex-grow: 1; font-size: 14px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${channel.name}</span>
          <button style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 8px;">Remove</button>
        `;

        // Add hover effect
        li.addEventListener('mouseover', () => {
          li.style.backgroundColor = '#e9e9e9';
        });
        li.addEventListener('mouseout', () => {
          li.style.backgroundColor = '#f5f5f5';
        });

        // Add click handler to open channel
        li.addEventListener('click', (e) => {
          if (e.target.tagName !== 'BUTTON') {
            chrome.tabs.create({ url: `https://www.youtube.com/channel/${channel.id}` });
          }
        });

        // Add remove button functionality
        const removeBtn = li.querySelector('button');
        removeBtn.onclick = (e) => {
          e.stopPropagation(); // Prevent channel opening when clicking remove
          chrome.storage.local.get(['studyChannels'], (data) => {
            const updatedChannels = data.studyChannels.filter(c => c.id !== channel.id);
            chrome.storage.local.set({ studyChannels: updatedChannels }, loadChannels);
          });
        };

        channelList.appendChild(li);
      }
    });
  }

  // Toggle study mode
  toggleStudyMode.addEventListener('change', (e) => {
    chrome.storage.local.set({ studyModeEnabled: e.target.checked });
    
    // Notify content script of the change
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'STUDY_MODE_TOGGLED', 
          enabled: e.target.checked 
        });
      }
    });
  });

  // Clear all channels
  clearChannels.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all study channels?')) {
      chrome.storage.local.set({ studyChannels: [] }, loadChannels);
    }
  });

  // Export channels
  exportChannels.addEventListener('click', () => {
    chrome.storage.local.get(['studyChannels'], (result) => {
      const channels = result.studyChannels || [];
      const blob = new Blob([JSON.stringify(channels, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'study-channels.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Initial load
  loadChannels();
}); 