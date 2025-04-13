/**
 * @description  Background script
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-03-24
 * @lastModified 2025-04-13
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       background
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