/**
 * @description: 定义内容脚本，处理页面上的自动填充逻辑。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2025-3-24
 */

import { logger, LogLevel } from '../utils/logger';

export default defineBackground(() => {
  logger.info('后台服务已启动');

  // 设置日志级别，生产环境可调整
  if (process.env.NODE_ENV === 'production') {
    logger.setLevel(LogLevel.WARN);
  }

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
      logger.info(`扩展已更新到版本 ${chrome.runtime.getManifest().version}`);
    }
  });
});