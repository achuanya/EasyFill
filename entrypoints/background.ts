/**
 * @description: 定义内容脚本，处理页面上的自动填充逻辑。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2025-3-24
 */

import { logger } from '../utils/logger';

export default defineBackground(() => {
  chrome.action.onClicked.addListener(() => {
    logger.info('用户点击扩展图标，打开设置页面');
    chrome.tabs.create({
      url: chrome.runtime.getURL('settings.html'),
    });
  });
  
  // 监听扩展安装和更新事件
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      logger.info('扩展首次安装');
    } else if (details.reason === 'update') {
      const version = chrome.runtime.getManifest().version;
      logger.info(`扩展已更新到版本 ${version}`);
    }
  });
});