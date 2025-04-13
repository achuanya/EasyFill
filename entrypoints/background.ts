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

  // 关键字相关的消息处理
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchRemoteKeywords') {
      fetchRemoteKeywords(request.url)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message || '获取远程关键字数据失败' 
        }));
      return true;
    }
    
    if (request.action === 'fetchLocalKeywords') {
      fetchLocalKeywords()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message || '获取本地关键字数据失败' 
        }));
      return true;
    }
  });
});

/**
 * @description 获取远程关键字数据
 * @function fetchRemoteKeywords
 * @param url 关键字数据URL
 * @returns 关键字数据对象
 */
async function fetchRemoteKeywords(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const jsonData = await response.json();
    return jsonData;
  } catch (error: any) {
    logger.error('后台脚本获取远程关键字失败', error);
    throw error;
  }
}

/**
 * @description 获取本地关键字数据
 * @function fetchLocalKeywords
 * @returns 关键字数据对象
 */
async function fetchLocalKeywords() {
  try {
    const url = chrome.runtime.getURL('data/keywords.json');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`获取本地关键字文件失败: ${response.status}`);
    }
    
    const jsonData = await response.json();
    return jsonData;
  } catch (error: any) {
    logger.error('后台脚本获取本地关键字失败', error);
    throw error;
  }
}