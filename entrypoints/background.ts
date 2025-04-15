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
  chrome.runtime.onInstalled.addListener(async (details) => {
    let needsInitialSync = false;
    let reason = '';
    if (details.reason === 'install') {
      reason = '首次安装';
      logger.info(`${reason}，准备初始化数据`);
      needsInitialSync = true;
    } else if (details.reason === 'update') {
      reason = `更新到版本 ${chrome.runtime.getManifest().version}`;
      logger.info(`EasyFill 已${reason}，准备更新数据`);
      needsInitialSync = true;
    }

    if (needsInitialSync) {
      logger.info(`执行 ${reason} 后的强制同步`);
      // 强制同步以获取最新数据
      await syncKeywordsData(true); // 等待强制同步完成
      logger.info(`${reason} 强制同步完成`);
    }

    // 无论是否安装/更新，都确保同步定时器根据最新设置被正确初始化
    // 这将读取最新的 syncEnabled 和 syncInterval 设置并设置或清除定时器
    logger.info(`在 onInstalled 事件后调用 initializeKeywordSync 以确保定时器状态正确`);
    await initializeKeywordSync(); // 重新调用以确保定时器基于最新状态设置
  });

  // 监听网络状态变化
  if (navigator.connection) {
    // 本地环境会提示 类型“Navigator”上不存在属性“connection”，但Chrome扩展环境支持
    (navigator.connection as any).addEventListener('change', handleNetworkChange);
  }

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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getOrSyncKeywords') {
      // 触发同步检查（非强制）
      syncKeywordsData(false)
      // 使用 async 以便在内部使用 await
      .then(async syncResult => {
        if (syncResult.success) {
          // 同步成功或无需同步
          if (syncResult.data) {
            // 如果 syncKeywordsData 返回了新数据，直接使用它
            logger.info('getOrSyncKeywords: 使用 syncKeywordsData 返回的新数据');
            sendResponse({ success: true, data: syncResult.data });
          } else {
            // syncKeywordsData 成功但没有返回新数据 (例如 304 或缓存有效)
            // 此时需要从缓存读取
            logger.info('getOrSyncKeywords: syncKeywordsData 未返回新数据，尝试从缓存读取');
            const cachedData = await getKeywordSetsFromCache();
            if (cachedData) {
              sendResponse({ success: true, data: cachedData });
            } else {
              // 缓存也没有数据（可能已过期或从未缓存）
              logger.warn('getOrSyncKeywords: 同步后缓存仍无效或为空，尝试加载本地默认值');
              try {
                const localData = await fetchLocalKeywords();
                sendResponse({ success: true, data: localData });
              } catch (localError: any) {
                logger.error('getOrSyncKeywords: 获取本地默认值失败', localError);
                sendResponse({ success: false, error: '无法获取关键字数据，请检查网络或配置' });
              }
            }
          }
        } else {
          logger.warn('getOrSyncKeywords: syncKeywordsData 失败，尝试加载本地默认值', { message: syncResult.message });
          try {
            const localData = await fetchLocalKeywords();
            // 同步失败但本地成功，仍视为成功获取数据
            sendResponse({ success: true, data: localData });
          } catch (localError: any) {
            logger.error('getOrSyncKeywords: 同步失败后，获取本地默认值也失败', localError);
            sendResponse({ success: false, error: syncResult.message || '获取关键字数据失败' });
          }
        }
      })
      .catch(error => {
        // 捕获 syncKeywordsData 或 getKeywordSetsFromCache/fetchLocalKeywords 中未处理的异常
        logger.error('处理 getOrSyncKeywords 请求时发生意外错误', error);
        sendResponse({
          success: false,
          error: error.message || '获取或同步关键字数据时发生未知错误'
        });
      });
      // 表示异步处理 sendResponse
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
        .then(async () => {
          logger.info('检测到关键字数据源更新, 即将强制同步数据...', request.settings.keywordsUrl);
          
          try {
            // 等待强制同步完成
            const syncResult = await syncKeywordsData(true);
            logger.info('强制同步数据完成', { success: syncResult.success, message: syncResult.message });
            // 注意：这里的同步结果目前没有传递回设置页面，设置页面只关心设置是否保存成功。
          } catch (syncError: any) {
            logger.error('强制同步数据失败', syncError);
          }
          
          // 设置更新后，重新初始化以应用新设置（例如 URL 更改、启用/禁用、间隔更改）
          // initializeKeywordSync 内部会处理定时器的重置
          logger.info('强制同步数据成功，重新调用 initializeKeywordSync 完成更改');
          initializeKeywordSync();
          sendResponse({ success: true });
        })
        .catch(error => {
          logger.error('处理 updateSyncSettings 消息时捕获到错误', error); // 添加日志
          sendResponse({
            success: false,
            error: error.message || '更新同步数据失败'
          });
        });
      return true;
    }

    logger.warn('收到未知的消息 action', { request });
  });
});

/**
 * @description 初始化关键字同步系统。负责设置定时器和在非首次启动时检查缓存是否过期。
 * @function initializeKeywordSync
 * @returns {Promise<void>}
 */
async function initializeKeywordSync(): Promise<void> {
  try {
    const { syncEnabled, syncInterval } = await getSyncSettingsFromStorage();
    logger.info('initializeKeywordSync 开始执行', { syncEnabled, syncInterval });
    
    if (syncEnabled) {
      // setupSyncInterval 内部会清理旧定时器
      setupSyncInterval(syncInterval);

      const lastSync = await getLastSyncTime();
      const now = Date.now();

      // 关键逻辑：仅在 *非首次启动* (lastSync 存在) 且缓存 *确实过期* 时，才由本函数触发同步
      // 首次安装/更新的同步由 onInstalled 监听器强制执行 syncKeywordsData(true)
      if (lastSync && (now - lastSync > syncInterval)) {
        logger.info('initializeKeywordSync 检测到缓存过期，触发非强制同步', {
          lastSync: new Date(lastSync).toISOString(),
          syncIntervalMins: Math.round(syncInterval / 60000),
          now: new Date(now).toISOString()
        });
        // 使用 await 确保同步操作完成（如果需要后续逻辑依赖它），但通常后台启动时不需要阻塞
        await syncKeywordsData(false); // 非强制同步
      } else if (lastSync) {
        // lastSync 存在但未过期
        logger.info('initializeKeywordSync 检测到缓存数据仍然有效', {
          lastSync: new Date(lastSync).toISOString(),
          nextSync: new Date(lastSync + syncInterval).toISOString()
        });
      } else {
        logger.info('initializeKeywordSync 检测到无上次同步记录 (首次启动或存储清除)，将等待 onInstalled 或下一个定时器周期');
      }
    } else {
      logger.info('initializeKeywordSync 检测到自动同步功能已禁用');
      // 清理可能存在的旧定时器
      if (syncIntervalId !== null) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
        logger.info('已清除自动同步定时器');
      }
    }
    logger.info('initializeKeywordSync 执行完毕');
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
  // 总是先清理旧的定时器，防止重复设置
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    logger.info('清理了旧的同步定时器', { oldIntervalId: syncIntervalId });
    syncIntervalId = null;
  }

  const effectiveInterval = Math.max(interval || DEFAULT_SYNC_INTERVAL, MIN_SYNC_INTERVAL);

  // 添加 interval !== undefined 检查避免无效警告
  if (effectiveInterval !== interval && interval !== undefined) {
    logger.warn('请求的同步间隔无效或过小，已调整为有效值', {
      requestedInterval: interval,
      effectiveInterval: effectiveInterval,
      minInterval: MIN_SYNC_INTERVAL
    });
  }

  // 设置新的定时器
  syncIntervalId = setInterval(() => {
    logger.info('定时器触发，执行非强制同步');
    syncKeywordsData(false); // 定时器总是执行非强制同步
  }, effectiveInterval) as unknown as number;

  logger.info('已设置新的关键字自动同步间隔', {
    newIntervalId: syncIntervalId,
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
    // 确保间隔不小于最小值
    updates[STORAGE_KEYS.SYNC_INTERVAL] = Math.max(settings.syncInterval || 0, MIN_SYNC_INTERVAL);
  }

  if (settings.networkType !== undefined) {
    updates[STORAGE_KEYS.SYNC_NETWORK_TYPE] = settings.networkType;
  }

  if (settings.keywordsUrl !== undefined) {
    // 验证 URL 合法性
    try {
      // 允许空字符串以清除自定义 URL 并回退到默认值
      if (settings.keywordsUrl === '' || new URL(settings.keywordsUrl)) {
         updates[STORAGE_KEYS.KEYWORDS_URL] = settings.keywordsUrl;
      } else {
         // 如果 URL 无效且非空，则抛出错误
         throw new Error('无效的 URL 格式');
      }
    } catch (e) {
      logger.warn('提供的关键字 URL 格式无效，未更新', { url: settings.keywordsUrl });
      // 向上抛出错误，让消息处理器捕获并通知前端
      throw new Error('关键字 URL 格式无效');
    }
  }

  if (Object.keys(updates).length === 0) {
    logger.info('没有需要更新的同步设置');
    return;
  }

  // 保存更新到存储
  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(updates, () => {
      if (chrome.runtime.lastError) {
        logger.error('存储同步设置更新失败', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message || '存储设置失败')); // 提供更明确的错误信息
      } else {
        resolve();
      }
    });
  });

  logger.info('同步设置已成功存储', { updates });
}

/**
 * @description 同步关键字数据。返回值包含同步是否成功、消息以及可选的新获取的数据。
 * @function syncKeywordsData
 * @param {boolean} forceSync 是否强制同步，忽略缓存
 * @returns {Promise<{success: boolean, message: string, data?: Record<string, string[]>}>}
 */
async function syncKeywordsData(forceSync: boolean = false): Promise<{success: boolean, message: string, data?: Record<string, string[]>}> {
  try {
    const isOnline = navigator.onLine;
    if (!isOnline) {
      logger.warn('无网络连接，跳过同步');
      return { success: false, message: '设备当前处于离线状态' };
    }

    // 获取最新的设置，特别是 keywordsUrl
    const settings = await new Promise<{
        networkType: 'any' | 'wifi_only',
        keywordsUrl: string,
        syncEnabled: boolean, // 也获取 syncEnabled
        syncInterval: number // 也获取 syncInterval
    }>((resolve, reject) => {
        chrome.storage.local.get([
            STORAGE_KEYS.SYNC_NETWORK_TYPE,
            STORAGE_KEYS.KEYWORDS_URL,
            STORAGE_KEYS.SYNC_ENABLED, // 读取 syncEnabled
            STORAGE_KEYS.SYNC_INTERVAL // 读取 syncInterval
        ], (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve({
                    networkType: result[STORAGE_KEYS.SYNC_NETWORK_TYPE] || 'any',
                    keywordsUrl: result[STORAGE_KEYS.KEYWORDS_URL] || 'https://cos.lhasa.icu/EasyFill/keywords.json',
                    syncEnabled: result[STORAGE_KEYS.SYNC_ENABLED] !== false, // 默认启用
                    syncInterval: result[STORAGE_KEYS.SYNC_INTERVAL] || DEFAULT_SYNC_INTERVAL // 默认间隔
                });
            }
        });
    });


    // 如果同步被禁用，则不执行（除非是强制同步，例如来自 onInstalled 或手动触发）
    if (!settings.syncEnabled && !forceSync) {
        logger.info('自动同步已禁用，且非强制同步，跳过');
        return { success: false, message: '自动同步已禁用' };
    }


    const { networkType, keywordsUrl } = settings;


    if (!keywordsUrl) {
      logger.error('关键字 URL 未配置，无法同步');
      return { success: false, message: '关键字 URL 未配置' };
    }

    // 检查网络类型限制 (仅在非强制同步时检查)
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

    // 获取 ETag 和 Last-Modified (仅在非强制同步时使用)
    if (!forceSync) {
      try {
        // 使用 Promise 包装 chrome.storage.local.get
        const result = await new Promise<{[key: string]: any}>((resolve, reject) => {
            chrome.storage.local.get([
                STORAGE_KEYS.KEYWORDS_ETAG,
                STORAGE_KEYS.KEYWORDS_LAST_MODIFIED
            ], (items) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(items);
                }
            });
        });
        etag = result[STORAGE_KEYS.KEYWORDS_ETAG] || '';
        lastModified = result[STORAGE_KEYS.KEYWORDS_LAST_MODIFIED] || '';
      } catch (storageError: any) { // 显式类型化 error
        logger.warn('获取 ETag/Last-Modified 失败，将执行完整请求', storageError.message);
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    // 添加条件请求头 (仅在非强制同步且 ETag/LastModified 存在时)
    if (etag && !forceSync) {
      headers['If-None-Match'] = etag;
    }
    if (lastModified && !forceSync) {
      headers['If-Modified-Since'] = lastModified;
    }

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
        cache: 'no-cache', // 确保获取最新数据
        signal: controller.signal
      });

      clearTimeout(timeoutId); // 清除超时定时器

      //
      // 处理不同的响应状态码
      // 304 Not Modified: 数据未变化，使用缓存的 ETag 和 Last-Modified
      // 200 OK: 数据已更新，使用新的 ETag 和 Last-Modified
      // 404 Not Found: 资源未找到，可能需要清除缓存的 ETag 和 Last-Modified
      // 500 Internal Server Error: 服务器错误，可能需要重试
      //

      // 304 Not Modified: 数据未变化
      if (response.status === 304) {
        logger.info('关键字数据未变化 (304 Not Modified)');
        // 即使数据未变，也更新上次同步时间戳，表示我们检查过了
        await updateLastSyncTime();
        // 成功，但没有新数据
        return { success: true, message: '关键字数据未更新' };
      }

      // 处理非 OK 状态码 (例如 404, 500)
      if (!response.ok) {
        logger.error(`HTTP 错误: ${response.status} ${response.statusText}`, { url: keywordsUrl, status: response.status });
        // 根据状态码可以决定是否清除 ETag/LastModified，例如 404 可能意味着资源不存在了
        if (response.status === 404) {
             logger.warn('资源未找到 (404)，可能需要检查 URL 或清除旧的 ETag/LastModified');
             // 可选：清除 ETag/LastModified 避免后续无效的条件请求
             try {
                await new Promise<void>((resolve, reject) => {
                    chrome.storage.local.remove([STORAGE_KEYS.KEYWORDS_ETAG, STORAGE_KEYS.KEYWORDS_LAST_MODIFIED], () => {
                        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                        else resolve();
                    });
                });
                logger.info('已清除旧的 ETag/Last-Modified 由于 404 错误');
             } catch (removeError: any) {
                 logger.warn('清除 ETag/Last-Modified 失败', removeError.message);
             }
        }
        throw new Error(`HTTP 错误: ${response.status}`);
      }

      // 处理成功获取的新数据 (2xx 状态码)

      // 获取新的 ETag 和 Last-Modified
      const newEtag = response.headers.get('ETag') || '';
      const newLastModified = response.headers.get('Last-Modified') || '';

      // 保存新的 ETag 和 Last-Modified
      const headerUpdates: Record<string, string> = {};
      if (newEtag) headerUpdates[STORAGE_KEYS.KEYWORDS_ETAG] = newEtag;
      if (newLastModified) headerUpdates[STORAGE_KEYS.KEYWORDS_LAST_MODIFIED] = newLastModified;

      if (Object.keys(headerUpdates).length > 0) {
        try {
          // 使用 Promise 包装 set 操作
          await new Promise<void>((resolve, reject) => {
            chrome.storage.local.set(headerUpdates, () => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else resolve();
            });
          });
          logger.info('已更新 ETag/Last-Modified 头信息', headerUpdates);
        } catch (storageError: any) {
          logger.warn('保存 ETag/Last-Modified 头信息失败', storageError.message);
        }
      }

      // 解析 JSON 数据
      let jsonData: Record<string, string[]>;
      try {
        jsonData = await response.json();
      } catch (parseError: any) {
        logger.error('解析关键字 JSON 数据失败', { error: parseError.message, url: keywordsUrl });
        throw new Error('无法解析服务器返回的关键字数据');
      }

      // 验证 JSON 数据结构
      if (!jsonData || typeof jsonData !== 'object' || !Array.isArray(jsonData.name) || !Array.isArray(jsonData.email) || !Array.isArray(jsonData.url)) {
        logger.error('关键字数据格式不正确', { dataReceived: jsonData ? Object.keys(jsonData) : null }); // 记录收到的 key
        throw new Error('关键字数据格式不正确');
      }

      // 保存数据到缓存
      await saveKeywordSetsToCache(jsonData); // saveKeywordSetsToCache 内部有日志

      // 更新上次同步时间
      await updateLastSyncTime(); // updateLastSyncTime 内部有日志

      logger.info('关键字数据同步并缓存成功', {
        timestamp: Date.now(),
        dataStats: {
          name: jsonData.name.length,
          email: jsonData.email.length,
          url: jsonData.url.length
        }
      });

      return { success: true, message: '关键字数据已成功更新', data: jsonData };

    } catch (fetchError: any) {
      // 处理 fetch 本身的错误 (网络问题、超时等)
      clearTimeout(timeoutId); // 确保超时定时器被清除
      if (fetchError.name === 'AbortError') {
        logger.warn('关键字数据同步超时', { url: keywordsUrl });
        return { success: false, message: '同步请求超时' };
      }
      // 对于其他 fetch 错误，记录并作为失败返回
      logger.error('Fetch 请求失败', { error: fetchError.message, name: fetchError.name, url: keywordsUrl });
      // 重新抛出，让顶层 catch 处理
      throw fetchError;
    }
  } catch (error: any) {
    // 顶层 catch 处理所有未被内部捕获的错误
    logger.error('同步关键字数据过程中发生未捕获错误', { errorMessage: error.message, errorName: error.name, stack: error.stack });
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