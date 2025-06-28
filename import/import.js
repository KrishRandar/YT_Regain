const importFile = document.getElementById('importFile');
const importBtn = document.getElementById('importBtn');
const msg = document.getElementById('msg');
let fileContent = null;

importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    importBtn.disabled = true;
    fileContent = null;
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    fileContent = event.target.result;
    importBtn.disabled = false;
    msg.textContent = '';
  };
  reader.onerror = () => {
    msg.textContent = 'Failed to read file.';
    msg.className = 'error';
    importBtn.disabled = true;
    fileContent = null;
  };
  reader.readAsText(file);
});

importBtn.addEventListener('click', () => {
  msg.textContent = '';
  msg.className = '';
  if (!fileContent) return;
  let imported;
  try {
    imported = JSON.parse(fileContent);
  } catch (e) {
    msg.textContent = 'Invalid JSON file.';
    msg.className = 'error';
    return;
  }
  if (!Array.isArray(imported)) {
    msg.textContent = 'File must be an array of channels.';
    msg.className = 'error';
    return;
  }
  const valid = imported.filter(ch => ch && ch.id && ch.name && ch.thumbnail);
  if (valid.length === 0) {
    msg.textContent = 'No valid channels found in file.';
    msg.className = 'error';
    return;
  }
  chrome.storage.local.get(['studyChannels'], (result) => {
    const existing = result.studyChannels || [];
    const merged = [...existing];
    let addedCount = 0;
    for (const ch of valid) {
      if (!merged.some(c => c.id === ch.id)) {
        merged.push(ch);
        addedCount++;
      }
    }
    chrome.storage.local.set({ studyChannels: merged }, () => {
      msg.textContent = `Import successful! Added ${addedCount} new channel(s).`;
      msg.className = 'success';
      importBtn.disabled = true;
    });
  });
}); 