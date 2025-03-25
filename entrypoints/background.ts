/**
 * @description: 定义内容脚本，处理页面上的自动填充逻辑。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2023-10-10
 */
export default defineBackground(() => {
  console.log('[Background] 已加载。');
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('settings.html'),
    });
  });
});