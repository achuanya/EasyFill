/**
 * @description: 定义内容脚本，处理页面上的自动填充逻辑。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2025-3-24
 */

import { logger } from '../utils/logger';

export default defineBackground(() => {
  logger.info('脚本已初始化');
  
  chrome.action.onClicked.addListener((tab) => {
    logger.info('用户点击扩展图标，打开设置页面', { tabId: tab.id });
    chrome.tabs.create({
      url: chrome.runtime.getURL('settings.html'),
    }).then(newTab => {
      logger.info('设置页面已打开', { newTabId: newTab.id });
    }).catch(error => {
      logger.error('打开设置页面失败', error);
    });
  });
});