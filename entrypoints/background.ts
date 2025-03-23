export default defineBackground(() => {
  console.log('[Background] 已加载。');

  // 点击图标 => 打开 settings/index.html
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('settings.html')
    });
  });
});