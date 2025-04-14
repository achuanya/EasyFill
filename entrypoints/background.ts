/**
 * @description  Background script
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-03-24
 * @lastModified 2025-04-14 // 更新日期
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       background
 */

import { logger } from '../utils/logger';
import { saveKeywordSetsToCache, getKeywordSetsFromCache } from '../utils/keywordService';

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
  chrome.runtime.onInstalled.addListener(async (details) => {
    let needsInitialSync = false;
    if (details.reason === 'install') {
      logger.info('已首次安装，准备初始化数据');
      needsInitialSync = true;
    } else if (details.reason === 'update') {
      logger.info(`EasyFill 已更新到版本 ${chrome.runtime.getManifest().version}，准备更新数据`);
      needsInitialSync = true;
    }

    // 确保在 onInstalled 完成必要操作（包括可能的强制同步）后，再初始化定时同步逻辑
    if (needsInitialSync) {
      // 强制同步以获取最新数据
      await syncKeywordsData(true);
    }
    // 无论是否安装/更新，都初始化或重新初始化同步定时器等
    await initializeKeywordSync();
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
    if (request.action === 'getOrSyncKeywords') {
      // 触发同步检查（非强制），然后获取最新缓存数据
      syncKeywordsData(false)
        .then(syncResult => {
          if (syncResult.success) {
            // 同步成功（或无需同步），尝试从缓存获取最新数据
            return getKeywordSetsFromCache();
          } else {
            // 同步失败，抛出错误以便 catch 处理
            throw new Error(syncResult.message || '同步关键字数据失败');
          }
        })
        .then(cachedData => {
          if (cachedData) {
            sendResponse({ success: true, data: cachedData });
          } else {
            logger.warn('同步后未能从缓存获取数据');
            // 尝试获取本地默认值作为备用
            return fetchLocalKeywords().then(localData => {
              sendResponse({ success: true, data: localData });
            }).catch(localError => {
              logger.error('同步和缓存均失败后，获取本地默认值也失败', localError);
              sendResponse({ success: false, error: '无法获取关键字数据，请检查网络或配置' });
            });
          }
        })
        .catch(error => {
          logger.error('处理 getOrSyncKeywords 请求失败', error);
          sendResponse({
            success: false,
            error: error.message || '获取或同步关键字数据时发生未知错误'
          });
        });
      return true; // 表示异步处理 sendResponse
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
      syncKeywordsData(true) // 强制同步
        .then(result => sendResponse({ success: true, data: result })) // 返回同步结果
        .catch(error => sendResponse({
          success: false,
          error: error.message || '手动同步关键字数据失败'
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
        .then(() => {
          sendResponse({ success: true });
          // 触发一次非强制同步以应用新设置（例如 URL 更改）
          initializeKeywordSync(); // 重新初始化会检查是否需要立即同步
        })
        .catch(error => sendResponse({
          success: false,
          error: error.message || '更新同步设置失败'
        }));
      return true;
    }

    logger.warn('收到未知的消息 action', { request });
  });
});

/**
 * @description 初始化关键字同步系统
 * @function initializeKeywordSync
 * @returns {Promise<void>}
 */
async function initializeKeywordSync(): Promise<void> {
  try {
    const { syncEnabled, syncInterval } = await getSyncSettingsFromStorage();

    if (syncEnabled) {
      setupSyncInterval(syncInterval);

      const lastSync = await getLastSyncTime();
      const now = Date.now();

      // 仅在非首次启动且缓存过期时，由 initializeKeywordSync 触发同步
      // 首次安装/更新的同步由 onInstalled 监听器处理
      if (lastSync && (now - lastSync > syncInterval)) {
        logger.info('初始化时检测到缓存过期，需要同步数据');
        // 使用 await 确保同步操作完成（如果需要后续逻辑依赖它）
        await syncKeywordsData(false); // 非强制同步
      } else if (lastSync) {
        logger.info('缓存数据有效，无需立即同步', {
          lastSync: new Date(lastSync).toISOString(),
          nextSync: new Date(lastSync + syncInterval).toISOString()
        });
      } else {
        logger.info('首次启动或存储已清除，初始同步将由 onInstalled 事件处理');
      }
    } else {
      logger.info('自动同步功能已禁用');
      // 清理可能存在的旧定时器
      if (syncIntervalId !== null) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
        logger.info('已清除自动同步定时器');
      }
    }
  } catch (error: any) {
    logger.error('初始化关键字同步系统失败', error instanceof Error ? error.message : String(error), error);
  }
}

/**
 * @description 设置同步间隔定时器
 * @function setupSyncInterval
 * @param {number} interval 同步间隔，单位毫秒
 * @returns {void}
 */
function setupSyncInterval(interval: number): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }

  const effectiveInterval = Math.max(interval || DEFAULT_SYNC_INTERVAL, MIN_SYNC_INTERVAL);

  if (effectiveInterval !== interval) {
    logger.warn('同步间隔调整为有效值', {
      requestedInterval: interval,
      effectiveInterval: effectiveInterval,
      minInterval: MIN_SYNC_INTERVAL
    });
  }

  syncIntervalId = setInterval(() => {
    syncKeywordsData(false);
  }, effectiveInterval) as unknown as number;

  logger.info('已设置关键字自动同步间隔', {
    intervalMinutes: Math.round(effectiveInterval / (60 * 1000))
  });
}

/**
 * @description 处理网络状态变化
 * @function handleNetworkChange
 * @returns {Promise<void>}
 */
async function handleNetworkChange(): Promise<void> {
  const isOnline = navigator.onLine;
  logger.info(`网络状态变化: ${isOnline ? '在线' : '离线'}`);

  if (!isOnline) {
    return;
  }

  try {
    const { syncEnabled, networkType, syncInterval } = await getSyncSettingsFromStorage();

    if (!syncEnabled) {
      logger.info('自动同步已禁用，忽略网络变化');
      return;
    }

    let canSync = false;
    if (networkType === 'any') {
      canSync = true;
    } else if (networkType === 'wifi_only') {
      const connection = navigator.connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const type = connection?.type;
      if (type === 'wifi') {
        canSync = true;
        logger.info('检测到WiFi连接');
      } else {
        logger.info(`当前网络类型 (${type || '未知'}) 不满足 wifi_only 设置，跳过检查`);
      }
    }

    if (canSync) {
      logger.info('网络条件满足，检查是否需要同步数据');
      const lastSync = await getLastSyncTime();
      const now = Date.now();

      if (!lastSync || (now - lastSync > syncInterval)) {
        logger.info('检测到网络恢复且需要同步数据');
        syncKeywordsData(false);
      } else {
        logger.info('网络恢复，但数据仍然有效，无需立即同步');
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
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([
      STORAGE_KEYS.SYNC_ENABLED,
      STORAGE_KEYS.SYNC_INTERVAL,
      STORAGE_KEYS.SYNC_NETWORK_TYPE
    ], (result) => {
      if (chrome.runtime.lastError) {
        logger.error('获取同步设置失败', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve({
          syncEnabled: result[STORAGE_KEYS.SYNC_ENABLED] !== false,
          syncInterval: result[STORAGE_KEYS.SYNC_INTERVAL] || DEFAULT_SYNC_INTERVAL,
          networkType: result[STORAGE_KEYS.SYNC_NETWORK_TYPE] || 'any'
        });
      }
    });
  });
}

/**
 * @description 获取上次同步时间
 * @function getLastSyncTime
 * @returns {Promise<number | null>}
 */
async function getLastSyncTime(): Promise<number | null> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEYS.LAST_SYNC], (result) => {
      if (chrome.runtime.lastError) {
        logger.error('获取上次同步时间失败', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result[STORAGE_KEYS.LAST_SYNC] || null);
      }
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
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({
      [STORAGE_KEYS.LAST_SYNC]: now
    }, () => {
      if (chrome.runtime.lastError) {
        logger.error('更新上次同步时间失败', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        logger.info('上次同步时间已更新', { timestamp: new Date(now).toISOString() });
        resolve();
      }
    });
  });
}

/**
 * @description 获取同步状态信息
 * @function getSyncStatus
 * @returns {Promise<SyncStatus>}
 */
async function getSyncStatus(): Promise<SyncStatus> {
  try {
    const { syncEnabled, syncInterval, networkType } = await getSyncSettingsFromStorage();
    const lastSync = await getLastSyncTime();
    let keywordsUrl = '';

    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.get([STORAGE_KEYS.KEYWORDS_URL], (result) => {
        if (chrome.runtime.lastError) {
          logger.error('获取关键字 URL 失败', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          keywordsUrl = result[STORAGE_KEYS.KEYWORDS_URL] || 'https://cos.lhasa.icu/EasyFill/keywords.json';
          resolve();
        }
      });
    });

    return {
      lastSync: lastSync || 0,
      nextSync: lastSync ? lastSync + syncInterval : 0,
      syncEnabled,
      syncInterval,
      networkType,
      keywordsUrl
    };
  } catch (error) {
    logger.error('获取同步状态时发生错误', error);
    throw error;
  }
}

/**
 * @description 更新同步设置
 * @function updateSyncSettings
 * @param {Partial<SyncStatus>} settings 要更新的设置
 * @returns {Promise<void>}
 */
async function updateSyncSettings(settings: Partial<SyncStatus>): Promise<void> {
  const updates: Record<string, any> = {};
  let needsReInit = false;

  if (settings.syncEnabled !== undefined) {
    updates[STORAGE_KEYS.SYNC_ENABLED] = settings.syncEnabled;
    needsReInit = true;
  }

  if (settings.syncInterval !== undefined) {
    updates[STORAGE_KEYS.SYNC_INTERVAL] = Math.max(settings.syncInterval || 0, MIN_SYNC_INTERVAL);
    needsReInit = true;
  }

  if (settings.networkType !== undefined) {
    updates[STORAGE_KEYS.SYNC_NETWORK_TYPE] = settings.networkType;
  }

  if (settings.keywordsUrl !== undefined) {
    try {
      new URL(settings.keywordsUrl);
      updates[STORAGE_KEYS.KEYWORDS_URL] = settings.keywordsUrl;
      needsReInit = true;
    } catch (e) {
      logger.warn('提供的关键字 URL 格式无效，未更新', { url: settings.keywordsUrl });
      throw new Error('关键字 URL 格式无效');
    }
  }

  if (Object.keys(updates).length === 0) {
    logger.info('没有需要更新的同步设置');
    return;
  }

  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(updates, () => {
      if (chrome.runtime.lastError) {
        logger.error('存储同步设置更新失败', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });

  logger.info('同步设置已更新', { updates });

  if (needsReInit) {
    logger.info('重新初始化同步系统以应用新设置');
    await initializeKeywordSync();
  }
}

/**
 * @description 同步关键字数据
 * @function syncKeywordsData
 * @param {boolean} forceSync 是否强制同步，忽略缓存
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function syncKeywordsData(forceSync: boolean = false): Promise<{success: boolean, message: string}> {
  try {
    const isOnline = navigator.onLine;
    if (!isOnline) {
      logger.warn('无网络连接，跳过同步');
      return { success: false, message: '设备当前处于离线状态' };
    }

    const { networkType, keywordsUrl: storedKeywordsUrl } = await getSyncSettingsFromStorage();
    const keywordsUrl = storedKeywordsUrl || 'https://cos.lhasa.icu/EasyFill/keywords.json';

    if (!keywordsUrl) {
      logger.error('关键字 URL 未配置，无法同步');
      return { success: false, message: '关键字 URL 未配置' };
    }

    if (!forceSync && networkType === 'wifi_only') {
      const connection = navigator.connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const type = connection?.type;
      if (type !== 'wifi') {
        logger.info(`非WiFi连接 (${type || '未知'})，已跳过自动同步`);
        return { success: false, message: '当前非WiFi环境，已跳过同步' };
      }
    }

    let etag = '';
    let lastModified = '';

    if (!forceSync) {
      try {
        const result = await new Promise<chrome.storage.StorageAreaGetCallback>(resolve =>
          chrome.storage.local.get([
            STORAGE_KEYS.KEYWORDS_ETAG,
            STORAGE_KEYS.KEYWORDS_LAST_MODIFIED
          ], resolve)
        );
        if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
        etag = result[STORAGE_KEYS.KEYWORDS_ETAG] || '';
        lastModified = result[STORAGE_KEYS.KEYWORDS_LAST_MODIFIED] || '';
      } catch (storageError) {
        logger.warn('获取 ETag/Last-Modified 失败，将执行完整请求', storageError);
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };

    if (etag && !forceSync) {
      headers['If-None-Match'] = etag;
    }

    if (lastModified && !forceSync) {
      headers['If-Modified-Since'] = lastModified;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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

      if (response.status === 304) {
        logger.info('关键字数据未变化 (304 Not Modified)');
        await updateLastSyncTime();
        return { success: true, message: '关键字数据未更新' };
      }

      if (!response.ok) {
        logger.error(`HTTP 错误: ${response.status} ${response.statusText}`, { url: keywordsUrl });
        throw new Error(`HTTP 错误: ${response.status}`);
      }

      const newEtag = response.headers.get('ETag') || '';
      const newLastModified = response.headers.get('Last-Modified') || '';

      const headerUpdates: Record<string, string> = {};
      if (newEtag) headerUpdates[STORAGE_KEYS.KEYWORDS_ETAG] = newEtag;
      if (newLastModified) headerUpdates[STORAGE_KEYS.KEYWORDS_LAST_MODIFIED] = newLastModified;

      if (Object.keys(headerUpdates).length > 0) {
        try {
          await new Promise<void>((resolve, reject) => {
            chrome.storage.local.set(headerUpdates, () => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else resolve();
            });
          });
          logger.info('已更新 ETag/Last-Modified 头信息');
        } catch (storageError) {
          logger.warn('保存 ETag/Last-Modified 头信息失败', storageError);
        }
      }

      let jsonData: Record<string, string[]>;
      try {
        jsonData = await response.json();
      } catch (parseError) {
        logger.error('解析关键字 JSON 数据失败', { error: parseError, url: keywordsUrl });
        throw new Error('无法解析服务器返回的关键字数据');
      }

      if (!jsonData || typeof jsonData !== 'object' || !Array.isArray(jsonData.name) || !Array.isArray(jsonData.email) || !Array.isArray(jsonData.url)) {
        logger.error('关键字数据格式不正确', { dataReceived: jsonData });
        throw new Error('关键字数据格式不正确');
      }

      await saveKeywordSetsToCache(jsonData);

      await updateLastSyncTime();

      logger.info('关键字数据同步并缓存成功', {
        timestamp: Date.now(),
        dataStats: {
          name: jsonData.name.length,
          email: jsonData.email.length,
          url: jsonData.url.length
        }
      });

      return { success: true, message: '关键字数据已成功更新' };

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        logger.warn('关键字数据同步超时', { url: keywordsUrl });
        return { success: false, message: '同步请求超时' };
      }
      throw fetchError;
    }
  } catch (error: any) {
    logger.error('同步关键字数据过程中发生未捕获错误', error);
    return { success: false, message: error.message || '同步失败，请稍后重试' };
  }
}

/**
 * @description 获取远程关键字数据
 * @function fetchRemoteKeywords
 * @param {string} url 关键字数据URL
 * @returns {Promise<Record<string, string[]>>} 关键字数据对象
 */
async function fetchRemoteKeywords(url: string): Promise<Record<string, string[]>> {
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
      logger.error(`后台 fetchRemoteKeywords HTTP 错误: ${response.status}`, { url });
      throw new Error(`HTTP 错误: ${response.status}`);
    }

    const jsonData = await response.json();
    if (!jsonData || typeof jsonData !== 'object' || !Array.isArray(jsonData.name)) {
      throw new Error('无效的 JSON 数据格式');
    }
    return jsonData;
  } catch (error: any) {
    clearTimeout(timeoutId);
    logger.error('后台脚本 fetchRemoteKeywords 失败', { error: error.message, url });
    if (error.name === 'AbortError') {
      throw new Error('获取远程关键字超时');
    }
    throw new Error(`获取远程关键字失败: ${error.message}`);
  }
}

/**
 * @description 获取本地关键字数据
 * @function fetchLocalKeywords
 * @returns {Promise<Record<string, string[]>>} 关键字数据对象
 */
async function fetchLocalKeywords(): Promise<Record<string, string[]>> {
  try {
    const url = chrome.runtime.getURL('data/keywords.json');
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`获取本地关键字文件失败: ${response.status}`);
    }

    const jsonData = await response.json();
    if (!jsonData || typeof jsonData !== 'object' || !Array.isArray(jsonData.name)) {
      throw new Error('无效的本地 JSON 数据格式');
    }
    return jsonData;
  } catch (error: any) {
    logger.error('后台脚本获取本地关键字失败', error);
    throw new Error(`获取本地关键字失败: ${error.message}`);
  }
}