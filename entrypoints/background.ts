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
import { saveKeywordSetsToCache } from '../utils/keywordService';

// 保存定时器ID，用于清理
let syncIntervalId: number | null = null;

// 默认同步间隔 (6小时)
const DEFAULT_SYNC_INTERVAL = 6 * 60 * 60 * 1000;

// 最小同步间隔 (1小时)
const MIN_SYNC_INTERVAL = 60 * 60 * 1000;

// 键值存储前缀
const STORAGE_KEYS = {
  SYNC_INTERVAL: 'easyfill_sync_interval',
  LAST_SYNC: 'easyfill_last_sync',
  SYNC_ENABLED: 'easyfill_sync_enabled',
  KEYWORDS_URL: 'easyfill_keywords_url',
  KEYWORDS_ETAG: 'easyfill_keywords_etag',
  KEYWORDS_LAST_MODIFIED: 'easyfill_keywords_last_modified',
  SYNC_NETWORK_TYPE: 'easyfill_sync_network_type'
};

interface SyncStatus {
  lastSync: number;
  nextSync: number;
  syncEnabled: boolean;
  syncInterval: number;
  networkType: 'any' | 'wifi_only';
  keywordsUrl: string;
}

export default defineBackground(() => {
  logger.info('后台脚本已初始化');
  
  // 在扩展启动时立即开始数据同步
  initializeKeywordSync();
  
  // 监听扩展安装或更新事件
  chrome.runtime.onInstalled.addListener(details => {
    if (details.reason === 'install') {
      logger.info('EasyFill 已首次安装，初始化数据');
      // 首次安装立即同步
      syncKeywordsData(true);
    } else if (details.reason === 'update') {
      logger.info(`EasyFill 已更新到版本 ${chrome.runtime.getManifest().version}`);
      // 版本更新后立即同步
      syncKeywordsData(true);
    }
  });
  
  // 监听网络状态变化
  if (navigator.connection) {
    // TypeScript 可能不知道 navigator.connection，但Chrome扩展环境支持
    (navigator.connection as any).addEventListener('change', handleNetworkChange);
  }
  
  // 处理扩展图标点击
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

  // 处理消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 处理关键字请求
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
    
    // 手动触发同步
    if (request.action === 'syncKeywordsNow') {
      syncKeywordsData(true)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message || '同步关键字数据失败' 
        }));
      return true;
    }
    
    // 获取同步状态
    if (request.action === 'getSyncStatus') {
      getSyncStatus()
        .then(status => sendResponse({ success: true, data: status }))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message || '获取同步状态失败' 
        }));
      return true;
    }
    
    // 更新同步设置
    if (request.action === 'updateSyncSettings') {
      updateSyncSettings(request.settings)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message || '更新同步设置失败'
        }));
      return true;
    }
  });
});

/**
 * @description 初始化关键字同步系统
 * @function initializeKeywordSync
 * @returns {Promise<void>}
 */
async function initializeKeywordSync(): Promise<void> {
  try {
    // 获取当前同步设置
    const { syncEnabled, syncInterval } = await getSyncSettingsFromStorage();
    
    // 如果启用了同步，设置定时器
    if (syncEnabled) {
      setupSyncInterval(syncInterval);
      
      // 检查是否需要立即同步
      const lastSync = await getLastSyncTime();
      const now = Date.now();
      
      if (!lastSync || (now - lastSync > syncInterval)) {
        // 如果从未同步或已经超过同步间隔，立即启动同步
        logger.info('初始化时检测到需要同步数据');
        syncKeywordsData(false);
      } else {
        logger.info('缓存数据有效，无需立即同步', {
          lastSync: new Date(lastSync).toISOString(),
          nextSync: new Date(lastSync + syncInterval).toISOString()
        });
      }
    } else {
      logger.info('自动同步功能已禁用');
    }
  } catch (error) {
    logger.error('初始化关键字同步系统失败', error);
  }
}

/**
 * @description 设置同步间隔定时器
 * @function setupSyncInterval
 * @param {number} interval 同步间隔，单位毫秒
 * @returns {void}
 */
function setupSyncInterval(interval: number): void {
  // 清除现有定时器（如果有）
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  
  // 设置新的定时器
  if (interval >= MIN_SYNC_INTERVAL) {
    syncIntervalId = setInterval(() => {
      syncKeywordsData(false);
    }, interval) as unknown as number;
    
    logger.info('已设置关键字自动同步间隔', { 
      intervalHours: Math.round(interval / (60 * 60 * 1000)) 
    });
  } else {
    logger.warn('同步间隔设置过短，已使用最小值', {
      requestedInterval: interval,
      minInterval: MIN_SYNC_INTERVAL
    });
    
    // 使用最小间隔设置定时器
    syncIntervalId = setInterval(() => {
      syncKeywordsData(false);
    }, MIN_SYNC_INTERVAL) as unknown as number;
  }
}

/**
 * @description 处理网络状态变化
 * @function handleNetworkChange
 * @returns {Promise<void>}
 */
async function handleNetworkChange(): Promise<void> {
  try {
    // 获取网络同步设置
    const { networkType } = await getSyncSettingsFromStorage();
    
    // 如果设置为仅WiFi，检查当前是否为WiFi
    if (networkType === 'wifi_only') {
      // 检查是否为WiFi网络
      const isWifi = navigator.connection && 
                    (navigator.connection as any).type === 'wifi';
      
      if (isWifi) {
        logger.info('检测到WiFi连接，检查是否需要同步数据');
        const lastSync = await getLastSyncTime();
        const now = Date.now();
        
        // 检查上次同步是否超过1小时，避免频繁同步
        if (!lastSync || (now - lastSync > MIN_SYNC_INTERVAL)) {
          syncKeywordsData(false);
        }
      }
    }
  } catch (error) {
    logger.error('处理网络变化失败', error);
  }
}

/**
 * @description 从存储中获取同步设置
 * @function getSyncSettingsFromStorage
 * @returns {Promise<{syncEnabled: boolean, syncInterval: number, networkType: 'any' | 'wifi_only'}>}
 */
async function getSyncSettingsFromStorage(): Promise<{
  syncEnabled: boolean, 
  syncInterval: number,
  networkType: 'any' | 'wifi_only'
}> {
  return new Promise(resolve => {
    chrome.storage.local.get([
      STORAGE_KEYS.SYNC_ENABLED,
      STORAGE_KEYS.SYNC_INTERVAL,
      STORAGE_KEYS.SYNC_NETWORK_TYPE
    ], (result) => {
      resolve({
        syncEnabled: result[STORAGE_KEYS.SYNC_ENABLED] !== false, // 默认启用
        syncInterval: result[STORAGE_KEYS.SYNC_INTERVAL] || DEFAULT_SYNC_INTERVAL,
        networkType: result[STORAGE_KEYS.SYNC_NETWORK_TYPE] || 'any'
      });
    });
  });
}

/**
 * @description 获取上次同步时间
 * @function getLastSyncTime
 * @returns {Promise<number | null>}
 */
async function getLastSyncTime(): Promise<number | null> {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEYS.LAST_SYNC], (result) => {
      resolve(result[STORAGE_KEYS.LAST_SYNC] || null);
    });
  });
}

/**
 * @description 更新上次同步时间
 * @function updateLastSyncTime
 * @returns {Promise<void>}
 */
async function updateLastSyncTime(): Promise<void> {
  const now = Date.now();
  return new Promise(resolve => {
    chrome.storage.local.set({
      [STORAGE_KEYS.LAST_SYNC]: now
    }, () => {
      resolve();
    });
  });
}

/**
 * @description 获取同步状态信息
 * @function getSyncStatus
 * @returns {Promise<SyncStatus>}
 */
async function getSyncStatus(): Promise<SyncStatus> {
  const { syncEnabled, syncInterval, networkType } = await getSyncSettingsFromStorage();
  const lastSync = await getLastSyncTime() || 0;
  let keywordsUrl = '';
  
  // 获取关键字URL
  await new Promise<void>(resolve => {
    chrome.storage.local.get([STORAGE_KEYS.KEYWORDS_URL], (result) => {
      keywordsUrl = result[STORAGE_KEYS.KEYWORDS_URL] || '';
      resolve();
    });
  });
  
  return {
    lastSync,
    nextSync: lastSync + syncInterval,
    syncEnabled,
    syncInterval,
    networkType,
    keywordsUrl
  };
}

/**
 * @description 更新同步设置
 * @function updateSyncSettings
 * @param {Partial<SyncStatus>} settings 要更新的设置
 * @returns {Promise<void>}
 */
async function updateSyncSettings(settings: Partial<SyncStatus>): Promise<void> {
  const updates: Record<string, any> = {};
  
  if (settings.syncEnabled !== undefined) {
    updates[STORAGE_KEYS.SYNC_ENABLED] = settings.syncEnabled;
  }
  
  if (settings.syncInterval !== undefined) {
    // 确保同步间隔不小于最小值
    updates[STORAGE_KEYS.SYNC_INTERVAL] = Math.max(settings.syncInterval, MIN_SYNC_INTERVAL);
  }
  
  if (settings.networkType !== undefined) {
    updates[STORAGE_KEYS.SYNC_NETWORK_TYPE] = settings.networkType;
  }
  
  if (settings.keywordsUrl !== undefined) {
    updates[STORAGE_KEYS.KEYWORDS_URL] = settings.keywordsUrl;
  }
  
  // 存储更新的设置
  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(updates, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
  
  // 重新初始化同步系统
  await initializeKeywordSync();
  
  logger.info('同步设置已更新', { updates });
}

/**
 * @description 同步关键字数据
 * @function syncKeywordsData
 * @param {boolean} forceSync 是否强制同步，忽略缓存
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function syncKeywordsData(forceSync: boolean = false): Promise<{success: boolean, message: string}> {
  try {
    // 检查网络条件
    const isOnline = navigator.onLine;
    if (!isOnline) {
      logger.warn('无网络连接，跳过同步');
      return { success: false, message: '设备当前处于离线状态' };
    }
    
    // 检查网络类型条件
    const { networkType } = await getSyncSettingsFromStorage();
    if (networkType === 'wifi_only') {
      const isWifi = navigator.connection && 
                    (navigator.connection as any).type === 'wifi';
      
      if (!isWifi && !forceSync) {
        logger.info('非WiFi连接，已跳过自动同步');
        return { success: false, message: '当前非WiFi环境，已跳过同步' };
      }
    }
    
    // 获取关键字URL
    let keywordsUrl = '';
    await new Promise<void>(resolve => {
      chrome.storage.local.get([STORAGE_KEYS.KEYWORDS_URL], (result) => {
        keywordsUrl = result[STORAGE_KEYS.KEYWORDS_URL];
        resolve();
      });
    });
    
    // 获取ETag和Last-Modified
    let etag = '';
    let lastModified = '';
    
    if (!forceSync) {
      await new Promise<void>(resolve => {
        chrome.storage.local.get([
          STORAGE_KEYS.KEYWORDS_ETAG,
          STORAGE_KEYS.KEYWORDS_LAST_MODIFIED
        ], (result) => {
          etag = result[STORAGE_KEYS.KEYWORDS_ETAG] || '';
          lastModified = result[STORAGE_KEYS.KEYWORDS_LAST_MODIFIED] || '';
          resolve();
        });
      });
    }
    
    // 构建请求头，使用条件请求减少带宽使用
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    
    if (etag && !forceSync) {
      headers['If-None-Match'] = etag;
    }
    
    if (lastModified && !forceSync) {
      headers['If-Modified-Since'] = lastModified;
    }
    
    // 设置请求超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    try {
      logger.info('开始同步关键字数据', { 
        url: keywordsUrl, 
        forceSync,
        useConditionalRequest: !!(etag || lastModified) && !forceSync
      });
      
      const response = await fetch(keywordsUrl, {
        method: 'GET',
        headers,
        cache: 'no-cache',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // 处理304 Not Modified
      if (response.status === 304) {
        logger.info('关键字数据未变化，使用缓存');
        await updateLastSyncTime();
        return { success: true, message: '关键字数据未更新，使用现有缓存' };
      }
      
      // 处理其他非成功状态
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
      }
      
      // 获取新的ETag和Last-Modified
      const newEtag = response.headers.get('ETag') || '';
      const newLastModified = response.headers.get('Last-Modified') || '';
      
      // 保存新的响应头
      if (newEtag || newLastModified) {
        const headerUpdates: Record<string, string> = {};
        
        if (newEtag) {
          headerUpdates[STORAGE_KEYS.KEYWORDS_ETAG] = newEtag;
        }
        
        if (newLastModified) {
          headerUpdates[STORAGE_KEYS.KEYWORDS_LAST_MODIFIED] = newLastModified;
        }
        
        await new Promise<void>(resolve => {
          chrome.storage.local.set(headerUpdates, () => resolve());
        });
      }
      
      // 解析数据
      const jsonData = await response.json();
      
      // 验证数据格式
      if (!jsonData.name || !jsonData.email || !jsonData.url) {
        throw new Error('关键字数据格式不正确');
      }
      
      // 保存到缓存
      await saveKeywordSetsToCache(jsonData);
      
      // 更新同步时间
      await updateLastSyncTime();
      
      logger.info('关键字数据同步成功', { 
        timestamp: Date.now(),
        dataStats: {
          name: jsonData.name?.length || 0,
          email: jsonData.email?.length || 0,
          url: jsonData.url?.length || 0
        }
      });
      
      return { success: true, message: '关键字数据已成功更新' };
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.warn('关键字数据同步超时');
        return { success: false, message: '同步请求超时' };
      }
      
      throw error; // 重新抛出其他错误
    }
  } catch (error) {
    logger.error('同步关键字数据失败', error);
    return { success: false, message: error.message || '同步失败，请稍后重试' };
  }
}

/**
 * @description 获取远程关键字数据
 * @function fetchRemoteKeywords
 * @param {string} url 关键字数据URL
 * @returns {Promise<any>} 关键字数据对象
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
 * @returns {Promise<any>} 关键字数据对象
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