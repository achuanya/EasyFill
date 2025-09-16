/**
 * @description 黑名单处理，用于处理黑名单的获取、缓存、同步和域名检查等操作
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-09-16
 * @lastModified 2025-09-16
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       utils/blacklistService
 */

import { logger } from './logger';
import {
  getCacheData,
  setCacheData,
  chromeStorageGet,
  chromeStorageSet,
  chromeStorageRemove,
  CacheConfig
} from './storageUtils';

// 存储键名常量
const STORAGE_KEYS = {
  BLACKLIST_ENABLED: 'easyfill_blacklist_enabled',
  BLACKLIST_URL: 'easyfill_blacklist_url',
  OFFICIAL_BLACKLIST: 'easyfill_official_blacklist',
  USER_BLACKLIST: 'easyfill_user_blacklist',
  BLACKLIST_LAST_SYNC: 'easyfill_blacklist_last_sync',
  BLACKLIST_ETAG: 'easyfill_blacklist_etag',
  BLACKLIST_LAST_MODIFIED: 'easyfill_blacklist_last_modified',
  BLACKLIST_CACHE: 'easyfill_blacklist_cache'
};

// 缓存配置
const BLACKLIST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时

// 黑名单缓存配置
const BLACKLIST_CACHE_CONFIG: CacheConfig = {
  key: STORAGE_KEYS.BLACKLIST_CACHE,
  ttl: BLACKLIST_CACHE_TTL,
  validator: (data: any) => Array.isArray(data)
};

/**
 * @description: 黑名单状态接口
 * @interface BlacklistStatus
 * @property {boolean} blacklistEnabled - 是否启用黑名单功能
 * @property {string} blacklistUrl - 官方黑名单URL地址
 * @property {string[]} officialBlacklist - 官方黑名单域名列表
 * @property {string[]} userBlacklist - 用户自定义黑名单域名列表
 * @property {number} lastSync - 最后同步时间戳
 */
export interface BlacklistStatus {
  blacklistEnabled: boolean;
  blacklistUrl: string;
  officialBlacklist: string[];
  userBlacklist: string[];
  lastSync: number;
}

/**
 * @description: 黑名单同步结果接口
 * @interface BlacklistSyncResult
 * @property {string[]} blacklist - 同步获取的黑名单域名列表
 */
export interface BlacklistSyncResult {
  blacklist: string[];
}

/**
 * @description: 域名检查结果接口
 * @interface DomainCheckResult
 * @property {boolean} allowed - 是否允许在该域名上进行自动填充
 * @property {string} reason - 检查结果的原因说明
 */
export interface DomainCheckResult {
  allowed: boolean;
  reason: string;
}

/**
 * @description 获取黑名单状态，包括启用状态、URL配置和域名列表
 * @function getBlacklistStatus
 * @returns {Promise<BlacklistStatus>} 返回一个包含黑名单状态的Promise对象
 */
export async function getBlacklistStatus(): Promise<BlacklistStatus> {
  try {
    const result = await chromeStorageGet([
      STORAGE_KEYS.BLACKLIST_ENABLED,
      STORAGE_KEYS.BLACKLIST_URL,
      STORAGE_KEYS.OFFICIAL_BLACKLIST,
      STORAGE_KEYS.USER_BLACKLIST,
      STORAGE_KEYS.BLACKLIST_LAST_SYNC
    ]);

    const status: BlacklistStatus = {
      blacklistEnabled: result[STORAGE_KEYS.BLACKLIST_ENABLED] !== undefined ? result[STORAGE_KEYS.BLACKLIST_ENABLED] : true,
      blacklistUrl: result[STORAGE_KEYS.BLACKLIST_URL] || 'https://lhasa-1253887673.cos.ap-shanghai.myqcloud.com/EasyFill/IPblacklist.txt',
      officialBlacklist: result[STORAGE_KEYS.OFFICIAL_BLACKLIST] || [],
      userBlacklist: result[STORAGE_KEYS.USER_BLACKLIST] || [],
      lastSync: result[STORAGE_KEYS.BLACKLIST_LAST_SYNC] || 0
    };
    return status;
  } catch (error) {
    logger.error('获取黑名单状态时发生异常', error);
    throw error;
  }
}

/**
 * @description 更新黑名单设置，支持部分更新
 * @function updateBlacklistSettings
 * @param {Partial<BlacklistStatus>} settings 要更新的设置对象
 * @returns {Promise<void>} 返回一个Promise对象，表示更新操作完成
 */
export async function updateBlacklistSettings(settings: Partial<BlacklistStatus>): Promise<void> {
  try {
    const updateData: Record<string, any> = {};
    
    if (settings.blacklistEnabled !== undefined) {
      updateData[STORAGE_KEYS.BLACKLIST_ENABLED] = settings.blacklistEnabled;
    }
    if (settings.blacklistUrl !== undefined) {
      updateData[STORAGE_KEYS.BLACKLIST_URL] = settings.blacklistUrl;
    }
    if (settings.officialBlacklist !== undefined) {
      updateData[STORAGE_KEYS.OFFICIAL_BLACKLIST] = settings.officialBlacklist;
    }
    if (settings.userBlacklist !== undefined) {
      updateData[STORAGE_KEYS.USER_BLACKLIST] = settings.userBlacklist;
    }
    if (settings.lastSync !== undefined) {
      updateData[STORAGE_KEYS.BLACKLIST_LAST_SYNC] = settings.lastSync;
    }

    if (Object.keys(updateData).length === 0) {
      logger.info('没有需要更新的黑名单设置');
      return;
    }

    await chromeStorageSet(updateData);
    logger.info('黑名单设置已更新', settings);
  } catch (error) {
    logger.error('更新黑名单设置时发生异常', error);
    throw error;
  }
}

/**
 * @description 从缓存中获取官方黑名单数据，如果缓存过期则返回null
 * @function getBlacklistFromCache
 * @returns {Promise<string[] | null>} 返回一个Promise对象，包含黑名单数据或null
 */
export async function getBlacklistFromCache(): Promise<string[] | null> {
  try {
    const cachedData = await getCacheData<string[]>(BLACKLIST_CACHE_CONFIG);
    if (cachedData) {
      logger.info('从缓存加载官方黑名单', {
        blacklistCount: cachedData.length
      });
    }
    return cachedData;
  } catch (error) {
    logger.error('读取黑名单缓存失败', error);
    return null;
  }
}

/**
 * @description 将官方黑名单保存到缓存中
 * @function saveBlacklistToCache
 * @param {string[]} data 黑名单数据数组
 * @returns {Promise<void>} 返回一个Promise对象，表示保存操作完成
 */
export async function saveBlacklistToCache(data: string[]): Promise<void> {
  try {
    await setCacheData(BLACKLIST_CACHE_CONFIG, data);
    logger.info('官方黑名单已缓存', { blacklistCount: data.length });
  } catch (error) {
    logger.error('缓存官方黑名单时发生异常', error);
    throw error;
  }
}

/**
 * @description 同步官方黑名单，支持缓存机制和强制同步
 * @function syncOfficialBlacklist
 * @param {boolean} forceSync 是否强制同步，默认为false
 * @returns {Promise<BlacklistSyncResult>} 返回一个包含同步结果的Promise对象
 */
export async function syncOfficialBlacklist(forceSync: boolean = false): Promise<BlacklistSyncResult> {
  try {
    // 如果不是强制同步，先尝试从缓存获取
    if (!forceSync) {
      const cachedBlacklist = await getBlacklistFromCache();
      if (cachedBlacklist !== null) {
        logger.info('使用缓存的官方黑名单数据', { blacklistCount: cachedBlacklist.length });
        return { blacklist: cachedBlacklist };
      }
    }

    // 检查网络连接
    const isOnline = navigator.onLine;
    if (!isOnline) {
      logger.warn('无网络连接，尝试使用已存储的黑名单数据');
      // 尝试从存储中获取已有的黑名单数据
      const blacklistStatus = await getBlacklistStatus();
      if (blacklistStatus.officialBlacklist && blacklistStatus.officialBlacklist.length > 0) {
        logger.info('使用已存储的官方黑名单数据', { blacklistCount: blacklistStatus.officialBlacklist.length });
        return { blacklist: blacklistStatus.officialBlacklist };
      }
      throw new Error('设备当前处于离线状态且无可用的黑名单数据');
    }

    // 获取黑名单URL配置
    const blacklistStatus = await getBlacklistStatus();
    const blacklistUrl = blacklistStatus.blacklistUrl;
    
    if (!blacklistUrl) {
      logger.error('黑名单 URL 未配置，无法同步');
      throw new Error('黑名单 URL 未配置');
    }

    let etag = '';
    let lastModified = '';

    // 获取 ETag 和 Last-Modified (仅在非强制同步时使用)
    if (!forceSync) {
      try {
          const result = await chromeStorageGet([
            STORAGE_KEYS.BLACKLIST_ETAG,
            STORAGE_KEYS.BLACKLIST_LAST_MODIFIED
          ]);
          etag = result[STORAGE_KEYS.BLACKLIST_ETAG] || '';
          lastModified = result[STORAGE_KEYS.BLACKLIST_LAST_MODIFIED] || '';
        } catch (storageError: any) {
          logger.warn('获取黑名单 ETag/Last-Modified 失败，将执行完整请求', storageError.message);
        }
    }

    const headers: Record<string, string> = {
      'Accept': 'text/plain'
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
      logger.info('开始同步官方黑名单', {
        url: blacklistUrl,
        forceSync,
        useConditionalRequest: !!(etag || lastModified) && !forceSync
      });

      const blacklistResponse = await fetch(blacklistUrl, {
        method: 'GET',
        headers,
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 304 Not Modified: 数据未变化
      if (blacklistResponse.status === 304) {
        logger.info('官方黑名单数据未变化 (304 Not Modified)');
        // 更新上次同步时间戳
        await updateBlacklistSettings({ lastSync: Date.now() });
        // 返回当前缓存的黑名单
        return { blacklist: blacklistStatus.officialBlacklist };
      }

      // 处理非 OK 状态码
      if (!blacklistResponse.ok) {
        logger.error(`HTTP 错误: ${blacklistResponse.status} ${blacklistResponse.statusText}`, { 
          url: blacklistUrl, 
          status: blacklistResponse.status 
        });
        if (blacklistResponse.status === 404) {
          logger.warn('黑名单资源未找到 (404)，清除旧的 ETag/LastModified');
          try {
            await chromeStorageRemove([STORAGE_KEYS.BLACKLIST_ETAG, STORAGE_KEYS.BLACKLIST_LAST_MODIFIED]);
            logger.info('已清除旧的黑名单 ETag/Last-Modified 由于 404 错误');
          } catch (removeError: any) {
            logger.warn('清除黑名单 ETag/Last-Modified 失败', removeError.message);
          }
        }
        throw new Error(`HTTP 错误: ${blacklistResponse.status}`);
      }

      // 获取新的 ETag 和 Last-Modified
      const newEtag = blacklistResponse.headers.get('ETag') || '';
      const newLastModified = blacklistResponse.headers.get('Last-Modified') || '';

      // 保存新的 ETag 和 Last-Modified
      const headerUpdates: Record<string, string> = {};
      if (newEtag) headerUpdates[STORAGE_KEYS.BLACKLIST_ETAG] = newEtag;
      if (newLastModified) headerUpdates[STORAGE_KEYS.BLACKLIST_LAST_MODIFIED] = newLastModified;

      if (Object.keys(headerUpdates).length > 0) {
        try {
          await chromeStorageSet(headerUpdates);
          logger.info('已更新黑名单 ETag/Last-Modified 头信息', headerUpdates);
        } catch (storageError: any) {
          logger.warn('保存黑名单 ETag/Last-Modified 头信息失败', storageError.message);
        }
      }

      // 解析文本数据
      let blacklist: string[] = [];
      try {
        const textContent = await blacklistResponse.text();
        // 解析txt文件，每行一个域名，过滤空行和注释行
        blacklist = textContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#') && !line.startsWith('//'))
          .map(line => line.toLowerCase()); // 转换为小写以便匹配
      } catch (parseError: any) {
        logger.error('解析黑名单文本数据失败', { error: parseError.message, url: blacklistUrl });
        throw new Error('无法解析服务器返回的黑名单数据');
      }

      // 更新存储
       await updateBlacklistSettings({
         officialBlacklist: blacklist,
         lastSync: Date.now()
       });

       // 保存到缓存
       try {
         await saveBlacklistToCache(blacklist);
         logger.info('官方黑名单已保存到缓存');
       } catch (cacheError: any) {
         logger.warn('保存官方黑名单到缓存失败，但同步成功', cacheError.message);
       }
       
       logger.info('官方黑名单同步成功', { 
         blacklistCount: blacklist.length,
         timestamp: Date.now()
       });
       
       return { blacklist };

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        logger.warn('官方黑名单同步超时', { url: blacklistUrl });
        throw new Error('同步请求超时');
      }
      logger.error('Fetch 请求失败', { error: fetchError.message, name: fetchError.name, url: blacklistUrl });
      throw fetchError;
    }
  } catch (error: any) {
    logger.error('同步官方黑名单过程中发生未捕获错误', { 
      errorMessage: error.message, 
      errorName: error.name, 
      stack: error.stack 
    });
    throw new Error(error.message || '同步失败，请稍后重试');
  }
}

/**
 * @description 检查域名是否在黑名单中，支持通配符匹配和精确匹配
 * @function checkDomainInBlacklist
 * @param {string} domain 要检查的域名
 * @returns {Promise<DomainCheckResult>} 返回一个包含检查结果的Promise对象，包含allowed和reason字段
 */
export async function checkDomainInBlacklist(domain: string): Promise<DomainCheckResult> {
  try {
    const status = await getBlacklistStatus();
    const normalizedDomain = domain.toLowerCase();
    
    // 检查黑名单
    if (status.blacklistEnabled) {
      const allBlacklist = [...status.officialBlacklist, ...status.userBlacklist];
      const isInBlacklist = allBlacklist.some(blackDomain => {
        const normalizedBlackDomain = blackDomain.toLowerCase();
        
        // 支持通配符匹配，例如 *.baidu.com
        if (normalizedBlackDomain.startsWith('*.')) {
          const baseDomain = normalizedBlackDomain.substring(2);
          // 必须以 "*.baidu.com" 结尾，或者完全等于 "baidu.com"
          return normalizedDomain.endsWith('.' + baseDomain) || normalizedDomain === baseDomain;
        }
        
        // 精确匹配或子域名匹配
        // 例如，黑名单是 baidu.com，那么 a.baidu.com 和 baidu.com 都应该匹配
        return normalizedDomain === normalizedBlackDomain || normalizedDomain.endsWith('.' + normalizedBlackDomain);
      });
      
      if (isInBlacklist) {
        return { allowed: false, reason: '域名在黑名单中' };
      }
    }
    
    return { allowed: true, reason: '域名允许填充' };
  } catch (error: any) {
    logger.error('检查域名黑名单状态失败', error);
    // 出错时默认允许，避免影响正常使用
    return { allowed: true, reason: '检查失败，默认允许' };
  }
}

/**
 * @description 通过消息传递从后台脚本获取黑名单状态
 * @function getBlacklistStatusFromBackground
 * @returns {Promise<BlacklistStatus>} 返回一个包含黑名单状态的Promise对象
 */
export async function getBlacklistStatusFromBackground(): Promise<BlacklistStatus> {
  try {
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'getBlacklistStatus' },
        (response) => {
          if (chrome.runtime.lastError) {
            logger.error('通信错误：获取黑名单状态失败', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });
    
    if (response && response.success) {
      return response.data;
    } else {
      const errorMsg = response?.error || '获取黑名单状态失败';
      logger.error('获取黑名单状态失败', { error: errorMsg });
      throw new Error(errorMsg);
    }
  } catch (error) {
    logger.error('获取黑名单状态请求失败', error);
    throw error;
  }
}

/**
 * @description 通过消息传递向后台脚本更新黑名单设置
 * @function updateBlacklistSettingsFromBackground
 * @param {Partial<BlacklistStatus>} settings 要更新的设置对象，支持部分更新
 * @returns {Promise<void>} 返回一个Promise对象，表示更新操作完成
 */
export async function updateBlacklistSettingsFromBackground(settings: Partial<BlacklistStatus>): Promise<void> {
  try {
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'updateBlacklistSettings', settings },
        (response) => {
          if (chrome.runtime.lastError) {
            logger.error('通信错误：更新黑名单设置失败', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });
    
    if (response && response.success) {
      return;
    } else {
      const errorMsg = response?.error || '更新黑名单设置失败';
      logger.error('更新黑名单设置失败', { error: errorMsg });
      throw new Error(errorMsg);
    }
  } catch (error) {
    logger.error('更新黑名单设置请求失败', error);
    throw error;
  }
}

/**
 * @description 通过消息传递从后台脚本同步官方黑名单
 * @function syncOfficialBlacklistFromBackground
 * @returns {Promise<BlacklistSyncResult>} 返回一个包含同步结果的Promise对象
 */
export async function syncOfficialBlacklistFromBackground(): Promise<BlacklistSyncResult> {
  try {
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'syncOfficialBlacklist' },
        (response) => {
          if (chrome.runtime.lastError) {
            logger.error('通信错误：同步官方黑名单失败', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });
    
    if (response && response.success) {
      return response.data;
    } else {
      const errorMsg = response?.error || '同步官方黑名单失败';
      logger.error('同步官方黑名单失败', { error: errorMsg });
      throw new Error(errorMsg);
    }
  } catch (error) {
    logger.error('同步官方黑名单请求失败', error);
    throw error;
  }
}

/**
 * @description 通过消息传递从后台脚本检查域名是否在黑名单中
 * @function checkDomainInBlacklistFromBackground
 * @param {string} domain 要检查的域名
 * @returns {Promise<DomainCheckResult>} 返回一个包含检查结果的Promise对象
 */
export async function checkDomainInBlacklistFromBackground(domain: string): Promise<DomainCheckResult> {
  try {
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'checkDomainInBlacklist', domain },
        (response) => {
          if (chrome.runtime.lastError) {
            logger.error('通信错误：检查域名黑名单状态失败', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });
    
    if (response && response.success) {
      return response.data;
    } else {
      const errorMsg = response?.error || '检查域名黑名单状态失败';
      logger.error('检查域名黑名单状态失败', { error: errorMsg });
      throw new Error(errorMsg);
    }
  } catch (error) {
    logger.error('检查域名黑名单状态请求失败', error);
    throw error;
  }
}