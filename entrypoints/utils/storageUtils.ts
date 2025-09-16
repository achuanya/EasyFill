/**
 * @description 通用存储工具函数，提供缓存管理和Chrome存储操作的统一接口
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-09-16
 * @lastModified 2025-09-16
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       utils/storageUtils
 */

import { logger } from './logger';

/**
 * @description 缓存数据结构接口
 * @interface CacheData
 * @template T 缓存数据的类型
 */
export interface CacheData<T = any> {
  data: T;
  timestamp: number;
}

/**
 * @description 缓存配置接口
 * @interface CacheConfig
 */
export interface CacheConfig {
  /** 缓存过期时间（毫秒），默认24小时 */
  ttl?: number;
  /** 缓存键名 */
  key: string;
  /** 数据验证函数 */
  validator?: (data: any) => boolean;
}

/**
 * @description Chrome存储操作结果接口
 * @interface StorageResult
 * @template T 存储数据的类型
 */
export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 默认缓存TTL：24小时
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * @description 将Chrome存储操作包装为Promise
 * @function chromeStorageGet
 * @template T 返回数据的类型
 * @param {string | string[]} keys 要获取的存储键名
 * @param {'local' | 'sync'} storageType 存储类型，默认为'local'
 * @returns {Promise<T>} 返回包含存储数据的Promise
 */
export async function chromeStorageGet<T = any>(
  keys: string | string[],
  storageType: 'local' | 'sync' = 'local'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const storage = storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
    
    storage.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        const error = new Error(chrome.runtime.lastError.message);
        logger.error(`Chrome存储读取失败 (${storageType})`, {
          keys,
          error: chrome.runtime.lastError
        });
        reject(error);
      } else {
        resolve(result as T);
      }
    });
  });
}

/**
 * @description 将Chrome存储设置操作包装为Promise
 * @function chromeStorageSet
 * @param {Record<string, any>} items 要设置的存储项
 * @param {'local' | 'sync'} storageType 存储类型，默认为'local'
 * @returns {Promise<void>} 返回表示操作完成的Promise
 */
export async function chromeStorageSet(
  items: Record<string, any>,
  storageType: 'local' | 'sync' = 'local'
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const storage = storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
    
    storage.set(items, () => {
      if (chrome.runtime.lastError) {
        const error = new Error(chrome.runtime.lastError.message);
        logger.error(`Chrome存储写入失败 (${storageType})`, {
          items: Object.keys(items),
          error: chrome.runtime.lastError
        });
        reject(error);
      } else {
        logger.info(`Chrome存储写入成功 (${storageType})`, {
          keys: Object.keys(items)
        });
        resolve();
      }
    });
  });
}

/**
 * @description 将Chrome存储删除操作包装为Promise
 * @function chromeStorageRemove
 * @param {string | string[]} keys 要删除的存储键名
 * @param {'local' | 'sync'} storageType 存储类型，默认为'local'
 * @returns {Promise<void>} 返回表示操作完成的Promise
 */
export async function chromeStorageRemove(
  keys: string | string[],
  storageType: 'local' | 'sync' = 'local'
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const storage = storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
    
    storage.remove(keys, () => {
      if (chrome.runtime.lastError) {
        const error = new Error(chrome.runtime.lastError.message);
        logger.error(`Chrome存储删除失败 (${storageType})`, {
          keys,
          error: chrome.runtime.lastError
        });
        reject(error);
      } else {
        logger.info(`Chrome存储删除成功 (${storageType})`, { keys });
        resolve();
      }
    });
  });
}

/**
 * @description 从缓存中获取数据，支持过期检查和数据验证
 * @function getCacheData
 * @template T 缓存数据的类型
 * @param {CacheConfig} config 缓存配置
 * @returns {Promise<T | null>} 返回缓存数据或null（如果缓存不存在或已过期）
 */
export async function getCacheData<T = any>(config: CacheConfig): Promise<T | null> {
  try {
    const { key, ttl = DEFAULT_CACHE_TTL, validator } = config;
    
    const result = await chromeStorageGet<Record<string, CacheData<T>>>([key]);
    
    if (!result || !result[key]) {
      logger.info('缓存未找到', { key });
      return null;
    }

    const cacheData = result[key];
    const { data, timestamp } = cacheData;
    const now = Date.now();
    const age = now - timestamp;

    // 检查缓存是否过期
    if (age >= ttl) {
      logger.info('缓存已过期', {
        key,
        age: Math.floor(age / 1000) + '秒',
        ttl: Math.floor(ttl / 1000) + '秒'
      });
      return null;
    }

    // 数据验证
    if (validator && !validator(data)) {
      logger.warn('缓存数据验证失败，视为无效缓存', { key, data });
      return null;
    }

    logger.info('从缓存加载数据', {
      key,
      source: 'cache',
      cacheAge: Math.floor(age / 1000) + '秒',
      validFor: Math.floor((ttl - age) / 1000) + '秒'
    });

    return data;
  } catch (error) {
    logger.error('读取缓存数据失败', { key: config.key, error });
    return null;
  }
}

/**
 * @description 将数据保存到缓存中
 * @function setCacheData
 * @template T 缓存数据的类型
 * @param {CacheConfig} config 缓存配置
 * @param {T} data 要缓存的数据
 * @returns {Promise<void>} 返回表示保存操作完成的Promise
 */
export async function setCacheData<T = any>(config: CacheConfig, data: T): Promise<void> {
  try {
    const { key, validator } = config;
    
    // 数据验证
    if (validator && !validator(data)) {
      const error = new Error('数据验证失败，无法缓存');
      logger.error('尝试缓存无效数据', { key, data });
      throw error;
    }

    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now()
    };

    await chromeStorageSet({ [key]: cacheData });
    
    logger.info('数据已缓存', { key });
  } catch (error) {
    logger.error('缓存数据时发生异常', { key: config.key, error });
    throw error;
  }
}

/**
 * @description 清除指定的缓存数据
 * @function clearCacheData
 * @param {string} key 缓存键名
 * @returns {Promise<void>} 返回表示清除操作完成的Promise
 */
export async function clearCacheData(key: string): Promise<void> {
  try {
    await chromeStorageRemove([key]);
    logger.info('缓存已清除', { key });
  } catch (error) {
    logger.error('清除缓存失败', { key, error });
    throw error;
  }
}

/**
 * @description 批量获取存储数据的辅助函数
 * @function getStorageData
 * @template T 返回数据的类型
 * @param {string[]} keys 要获取的存储键名数组
 * @param {'local' | 'sync'} storageType 存储类型，默认为'local'
 * @returns {Promise<T>} 返回包含存储数据的Promise
 */
export async function getStorageData<T = any>(
  keys: string[],
  storageType: 'local' | 'sync' = 'local'
): Promise<T> {
  return chromeStorageGet<T>(keys, storageType);
}

/**
 * @description 批量设置存储数据的辅助函数
 * @function setStorageData
 * @param {Record<string, any>} data 要设置的数据对象
 * @param {'local' | 'sync'} storageType 存储类型，默认为'local'
 * @returns {Promise<void>} 返回表示操作完成的Promise
 */
export async function setStorageData(
  data: Record<string, any>,
  storageType: 'local' | 'sync' = 'local'
): Promise<void> {
  return chromeStorageSet(data, storageType);
}

/**
 * @description 获取单个存储项的辅助函数
 * @function getStorageItem
 * @template T 返回数据的类型
 * @param {string} key 存储键名
 * @param {T} defaultValue 默认值
 * @param {'local' | 'sync'} storageType 存储类型，默认为'local'
 * @returns {Promise<T>} 返回存储的值或默认值
 */
export async function getStorageItem<T = any>(
  key: string,
  defaultValue: T,
  storageType: 'local' | 'sync' = 'local'
): Promise<T> {
  try {
    const result = await chromeStorageGet<Record<string, T>>([key], storageType);
    return result[key] !== undefined ? result[key] : defaultValue;
  } catch (error) {
    logger.error('获取存储项失败，返回默认值', { key, defaultValue, error });
    return defaultValue;
  }
}

/**
 * @description 设置单个存储项的辅助函数
 * @function setStorageItem
 * @param {string} key 存储键名
 * @param {any} value 要存储的值
 * @param {'local' | 'sync'} storageType 存储类型，默认为'local'
 * @returns {Promise<void>} 返回表示操作完成的Promise
 */
export async function setStorageItem(
  key: string,
  value: any,
  storageType: 'local' | 'sync' = 'local'
): Promise<void> {
  return chromeStorageSet({ [key]: value }, storageType);
}

/**
 * @description 检查缓存是否存在且有效
 * @function isCacheValid
 * @param {string} key 缓存键名
 * @param {number} ttl 缓存过期时间（毫秒），默认24小时
 * @returns {Promise<boolean>} 返回缓存是否有效
 */
export async function isCacheValid(
  key: string,
  ttl: number = DEFAULT_CACHE_TTL
): Promise<boolean> {
  try {
    const result = await chromeStorageGet<Record<string, CacheData>>([key]);
    
    if (!result || !result[key]) {
      return false;
    }

    const { timestamp } = result[key];
    const age = Date.now() - timestamp;
    
    return age < ttl;
  } catch (error) {
    logger.error('检查缓存有效性失败', { key, error });
    return false;
  }
}

/**
 * @description 获取缓存的年龄（毫秒）
 * @function getCacheAge
 * @param {string} key 缓存键名
 * @returns {Promise<number | null>} 返回缓存年龄或null（如果缓存不存在）
 */
export async function getCacheAge(key: string): Promise<number | null> {
  try {
    const result = await chromeStorageGet<Record<string, CacheData>>([key]);
    
    if (!result || !result[key]) {
      return null;
    }

    const { timestamp } = result[key];
    return Date.now() - timestamp;
  } catch (error) {
    logger.error('获取缓存年龄失败', { key, error });
    return null;
  }
}

// ============================================================================
// localStorage 缓存管理函数
// ============================================================================

/**
 * @description localStorage缓存配置接口
 * @interface LocalCacheConfig
 */
export interface LocalCacheConfig {
  /** 缓存过期时间（毫秒），默认24小时 */
  ttl?: number;
  /** 缓存键名 */
  key: string;
  /** 数据验证函数 */
  validator?: (data: any) => boolean;
}

/**
 * @description 从localStorage获取缓存数据
 * @function getLocalCacheData
 * @template T 缓存数据的类型
 * @param {LocalCacheConfig} config 缓存配置
 * @returns {T | null} 返回缓存数据或null（如果缓存不存在或已过期）
 */
export function getLocalCacheData<T = any>(config: LocalCacheConfig): T | null {
  try {
    const { key, ttl = DEFAULT_CACHE_TTL, validator } = config;
    
    if (typeof localStorage === 'undefined') {
      logger.warn('localStorage不可用', { key });
      return null;
    }

    const cached = localStorage.getItem(key);
    if (!cached) {
      logger.info('localStorage缓存未找到', { key });
      return null;
    }

    const cacheData: CacheData<T> = JSON.parse(cached);
    const { data, timestamp } = cacheData;
    const now = Date.now();
    const age = now - timestamp;

    // 检查缓存是否过期
    if (age >= ttl) {
      logger.info('localStorage缓存已过期', {
        key,
        age: Math.floor(age / 1000) + '秒',
        ttl: Math.floor(ttl / 1000) + '秒'
      });
      localStorage.removeItem(key);
      return null;
    }

    // 数据验证
    if (validator && !validator(data)) {
      logger.warn('localStorage缓存数据验证失败，视为无效缓存', { key, data });
      localStorage.removeItem(key);
      return null;
    }

    logger.info('从localStorage缓存加载数据', {
      key,
      source: 'localStorage',
      cacheAge: Math.floor(age / 1000) + '秒',
      validFor: Math.floor((ttl - age) / 1000) + '秒'
    });

    return data;
  } catch (error) {
    logger.error('读取localStorage缓存数据失败', { key: config.key, error });
    return null;
  }
}

/**
 * @description 将数据保存到localStorage缓存中
 * @function setLocalCacheData
 * @template T 缓存数据的类型
 * @param {LocalCacheConfig} config 缓存配置
 * @param {T} data 要缓存的数据
 * @returns {void}
 */
export function setLocalCacheData<T = any>(config: LocalCacheConfig, data: T): void {
  try {
    const { key, validator } = config;
    
    if (typeof localStorage === 'undefined') {
      logger.warn('localStorage不可用，无法缓存数据', { key });
      return;
    }

    // 数据验证
    if (validator && !validator(data)) {
      logger.error('尝试缓存无效数据到localStorage', { key, data });
      throw new Error('数据验证失败，无法缓存');
    }

    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now()
    };

    localStorage.setItem(key, JSON.stringify(cacheData));
    logger.info('数据已缓存到localStorage', { key });
  } catch (error) {
    logger.error('缓存数据到localStorage时发生异常', { key: config.key, error });
    throw error;
  }
}

/**
 * @description 清除localStorage中的指定缓存数据
 * @function clearLocalCacheData
 * @param {string} key 缓存键名
 * @returns {void}
 */
export function clearLocalCacheData(key: string): void {
  try {
    if (typeof localStorage === 'undefined') {
      logger.warn('localStorage不可用', { key });
      return;
    }

    localStorage.removeItem(key);
    logger.info('localStorage缓存已清除', { key });
  } catch (error) {
    logger.error('清除localStorage缓存失败', { key, error });
    throw error;
  }
}

/**
 * @description 检查localStorage缓存是否存在且有效
 * @function isLocalCacheValid
 * @param {string} key 缓存键名
 * @param {number} ttl 缓存过期时间（毫秒），默认24小时
 * @returns {boolean} 返回缓存是否有效
 */
export function isLocalCacheValid(
  key: string,
  ttl: number = DEFAULT_CACHE_TTL
): boolean {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    const cached = localStorage.getItem(key);
    if (!cached) {
      return false;
    }

    const cacheData: CacheData = JSON.parse(cached);
    const { timestamp } = cacheData;
    const age = Date.now() - timestamp;
    
    return age < ttl;
  } catch (error) {
    logger.error('检查localStorage缓存有效性失败', { key, error });
    return false;
  }
}

// ============================================================================
// 加密存储操作函数
// ============================================================================

import { encryptData, decryptData } from './cryptoUtils';

/**
 * @description 加密存储配置接口
 * @interface EncryptedStorageConfig
 */
export interface EncryptedStorageConfig {
  /** 存储键名 */
  key: string;
  /** 存储类型，默认为'local' */
  storageType?: 'local' | 'sync';
  /** 数据验证函数 */
  validator?: (data: any) => boolean;
}

/**
 * @description 加密并存储数据到Chrome存储
 * @function setEncryptedStorageData
 * @template T 存储数据的类型
 * @param {EncryptedStorageConfig} config 加密存储配置
 * @param {T} data 要加密存储的数据
 * @returns {Promise<void>} 返回表示操作完成的Promise
 */
export async function setEncryptedStorageData<T = any>(
  config: EncryptedStorageConfig,
  data: T
): Promise<void> {
  try {
    const { key, storageType = 'local', validator } = config;
    
    // 数据验证
    if (validator && !validator(data)) {
      logger.error('尝试加密存储无效数据', { key, data });
      throw new Error('数据验证失败，无法加密存储');
    }

    // 序列化数据
    const serializedData = JSON.stringify(data);
    
    // 加密数据
    const encryptedData = await encryptData(serializedData);
    
    // 存储加密数据
    await chromeStorageSet({ [key]: encryptedData }, storageType);
    
    logger.info('数据已加密存储', { key, storageType });
  } catch (error) {
    logger.error('加密存储数据时发生异常', { key: config.key, error });
    throw error;
  }
}

/**
 * @description 从Chrome存储中获取并解密数据
 * @function getEncryptedStorageData
 * @template T 返回数据的类型
 * @param {EncryptedStorageConfig} config 加密存储配置
 * @returns {Promise<T | null>} 返回解密后的数据或null（如果数据不存在或解密失败）
 */
export async function getEncryptedStorageData<T = any>(
  config: EncryptedStorageConfig
): Promise<T | null> {
  try {
    const { key, storageType = 'local', validator } = config;
    
    // 获取加密数据
    const result = await chromeStorageGet<Record<string, string>>([key], storageType);
    
    if (!result || !result[key]) {
      logger.info('加密存储数据未找到', { key, storageType });
      return null;
    }

    const encryptedData = result[key];
    
    // 解密数据
    const decryptedData = await decryptData(encryptedData);
    
    if (!decryptedData) {
      logger.warn('解密后数据为空', { key, storageType });
      return null;
    }
    
    // 反序列化数据
    const data: T = JSON.parse(decryptedData);
    
    // 数据验证
    if (validator && !validator(data)) {
      logger.warn('加密存储数据验证失败，视为无效数据', { key, data });
      return null;
    }

    logger.info('从加密存储加载数据', { key, storageType });
    return data;
  } catch (error) {
    logger.error('读取加密存储数据失败', { key: config.key, error });
    return null;
  }
}

/**
 * @description 删除加密存储的数据
 * @function removeEncryptedStorageData
 * @param {string} key 存储键名
 * @param {'local' | 'sync'} storageType 存储类型，默认为'local'
 * @returns {Promise<void>} 返回表示操作完成的Promise
 */
export async function removeEncryptedStorageData(
  key: string,
  storageType: 'local' | 'sync' = 'local'
): Promise<void> {
  try {
    await chromeStorageRemove([key], storageType);
    logger.info('加密存储数据已删除', { key, storageType });
  } catch (error) {
    logger.error('删除加密存储数据失败', { key, storageType, error });
    throw error;
  }
}

/**
 * @description 检查加密存储数据是否存在
 * @function hasEncryptedStorageData
 * @param {string} key 存储键名
 * @param {'local' | 'sync'} storageType 存储类型，默认为'local'
 * @returns {Promise<boolean>} 返回数据是否存在
 */
export async function hasEncryptedStorageData(
  key: string,
  storageType: 'local' | 'sync' = 'local'
): Promise<boolean> {
  try {
    const result = await chromeStorageGet<Record<string, string>>([key], storageType);
    return !!(result && result[key]);
  } catch (error) {
    logger.error('检查加密存储数据存在性失败', { key, storageType, error });
    return false;
  }
}

// ============================================================================
// Runtime 消息通信封装函数
// ============================================================================

/**
 * @description Runtime消息接口
 * @interface RuntimeMessage
 */
export interface RuntimeMessage {
  /** 消息动作类型 */
  action: string;
  /** 消息数据 */
  data?: any;
  /** 消息ID，用于追踪 */
  messageId?: string;
}

/**
 * @description Runtime消息响应接口
 * @interface RuntimeResponse
 * @template T 响应数据的类型
 */
export interface RuntimeResponse<T = any> {
  /** 操作是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 消息ID，用于追踪 */
  messageId?: string;
}

/**
 * @description 发送Runtime消息并等待响应
 * @function sendRuntimeMessage
 * @template T 响应数据的类型
 * @param {RuntimeMessage} message 要发送的消息
 * @param {number} timeout 超时时间（毫秒），默认10秒
 * @returns {Promise<RuntimeResponse<T>>} 返回消息响应的Promise
 */
export async function sendRuntimeMessage<T = any>(
  message: RuntimeMessage,
  timeout: number = 10000
): Promise<RuntimeResponse<T>> {
  return new Promise<RuntimeResponse<T>>((resolve, reject) => {
    const messageId = message.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messageWithId = { ...message, messageId };
    
    logger.info('发送Runtime消息', { action: message.action, messageId, data: message.data });
    
    // 设置超时
    const timeoutId = setTimeout(() => {
      const error = `Runtime消息超时: ${message.action} (${timeout}ms)`;
      logger.error(error, { messageId });
      reject(new Error(error));
    }, timeout);
    
    try {
      chrome.runtime.sendMessage(messageWithId, (response: RuntimeResponse<T>) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          const error = `Runtime消息发送失败: ${chrome.runtime.lastError.message}`;
          logger.error(error, { action: message.action, messageId });
          reject(new Error(error));
          return;
        }
        
        if (!response) {
          const error = `Runtime消息无响应: ${message.action}`;
          logger.error(error, { messageId });
          reject(new Error(error));
          return;
        }
        
        logger.info('收到Runtime消息响应', {
          action: message.action,
          messageId,
          success: response.success,
          hasData: !!response.data,
          error: response.error
        });
        
        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error('Runtime消息发送异常', { action: message.action, messageId, error });
      reject(error);
    }
  });
}

/**
 * @description 发送简单的Runtime消息（只包含action）
 * @function sendSimpleRuntimeMessage
 * @template T 响应数据的类型
 * @param {string} action 消息动作类型
 * @param {any} data 消息数据（可选）
 * @param {number} timeout 超时时间（毫秒），默认10秒
 * @returns {Promise<RuntimeResponse<T>>} 返回消息响应的Promise
 */
export async function sendSimpleRuntimeMessage<T = any>(
  action: string,
  data?: any,
  timeout: number = 10000
): Promise<RuntimeResponse<T>> {
  const message: RuntimeMessage = { action, data };
  return sendRuntimeMessage<T>(message, timeout);
}

/**
 * @description 批量发送Runtime消息
 * @function sendBatchRuntimeMessages
 * @template T 响应数据的类型
 * @param {RuntimeMessage[]} messages 要发送的消息数组
 * @param {number} timeout 每个消息的超时时间（毫秒），默认10秒
 * @param {boolean} failFast 是否在第一个失败时立即停止，默认false
 * @returns {Promise<RuntimeResponse<T>[]>} 返回所有消息响应的Promise数组
 */
export async function sendBatchRuntimeMessages<T = any>(
  messages: RuntimeMessage[],
  timeout: number = 10000,
  failFast: boolean = false
): Promise<RuntimeResponse<T>[]> {
  logger.info('批量发送Runtime消息', { count: messages.length, failFast });
  
  if (failFast) {
    // 顺序执行，遇到错误立即停止
    const results: RuntimeResponse<T>[] = [];
    for (const message of messages) {
      try {
        const response = await sendRuntimeMessage<T>(message, timeout);
        results.push(response);
        if (!response.success) {
          logger.warn('Runtime消息失败，停止批量发送', { action: message.action, error: response.error });
          break;
        }
      } catch (error) {
        logger.error('Runtime消息异常，停止批量发送', { action: message.action, error });
        throw error;
      }
    }
    return results;
  } else {
    // 并行执行，收集所有结果
    const promises = messages.map(message => 
      sendRuntimeMessage<T>(message, timeout).catch(error => ({
        success: false,
        error: error.message,
        messageId: message.messageId
      } as RuntimeResponse<T>))
    );
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    logger.info('批量Runtime消息完成', {
      total: results.length,
      success: successCount,
      failure: failureCount
    });
    
    return results;
  }
}

/**
 * @description 创建Runtime消息监听器的辅助函数
 * @function createRuntimeMessageListener
 * @param {Record<string, (data: any, sender: chrome.runtime.MessageSender) => Promise<any> | any>} handlers 消息处理器映射
 * @returns {(request: RuntimeMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: RuntimeResponse) => void) => boolean} 返回消息监听器函数
 */
export function createRuntimeMessageListener(
  handlers: Record<string, (data: any, sender: chrome.runtime.MessageSender) => Promise<any> | any>
) {
  return (request: RuntimeMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: RuntimeResponse) => void): boolean => {
    const { action, data, messageId } = request;
    
    logger.info('收到Runtime消息', { action, messageId, hasData: !!data, sender: sender.tab?.url || sender.url });
    
    const handler = handlers[action];
    if (!handler) {
      const error = `未知的Runtime消息动作: ${action}`;
      logger.warn(error, { messageId });
      sendResponse({ success: false, error, messageId });
      return false;
    }
    
    try {
      const result = handler(data, sender);
      
      if (result instanceof Promise) {
        // 异步处理器
        result
          .then(responseData => {
            logger.info('Runtime消息处理成功', { action, messageId });
            sendResponse({ success: true, data: responseData, messageId });
          })
          .catch(error => {
            logger.error('Runtime消息处理失败', { action, messageId, error });
            sendResponse({ success: false, error: error.message, messageId });
          });
        return true; // 保持消息通道开放
      } else {
        // 同步处理器
        logger.info('Runtime消息处理成功', { action, messageId });
        sendResponse({ success: true, data: result, messageId });
        return false;
      }
    } catch (error: any) {
      logger.error('Runtime消息处理异常', { action, messageId, error });
      sendResponse({ success: false, error: error.message, messageId });
      return false;
    }
  };
}