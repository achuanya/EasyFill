/**
 * @description  关键字处理, 用于处理关键字集合的获取、缓存和转换等操作
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-04-13
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       utils/keywordService
 */

import { logger } from './logger';

// 关键字集合的类型定义
export interface KeywordSets {
  name: Set<string>;
  email: Set<string>;
  url: Set<string>;
  [key: string]: Set<string>;
}

// 缓存配置
const CACHE_KEY = 'easyfill_keywords_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const KEYWORDS_URL_KEY = 'easyfill_keywords_url';
const DEFAULT_KEYWORDS_URL = 'https://cos.lhasa.icu/EasyFill/keywords.json';

// 默认的关键字集合（备用）
let defaultKeywordSets: KeywordSets | null = null;

/**
 * @description: 将JSON数据转换为关键字集合
 * @function convertJsonToKeywordSets
 * @param jsonData JSON数据对象
 * @returns 关键字集合对象
 */
function convertJsonToKeywordSets(jsonData: Record<string, string[]>): KeywordSets {
  const result: Record<string, Set<string>> = {};
  
  for (const key in jsonData) {
    result[key] = new Set(jsonData[key]);
  }
  
  return result as KeywordSets;
}

/**
 * @description: 获取存储的关键字URL
 * @function getKeywordsUrl
 * @returns {Promise<string>} 返回存储的关键字URL，如果没有存储则返回默认值
 */
export async function getKeywordsUrl(): Promise<string> {
  return new Promise<string>((resolve) => {
    chrome.storage.sync.get([KEYWORDS_URL_KEY], (result) => {
      resolve(result[KEYWORDS_URL_KEY] || DEFAULT_KEYWORDS_URL);
    });
  });
}

/**
 * @description 加载本地关键字集合，优先使用本地文件，如果加载失败则使用内置备份
 * @function loadDefaultKeywordSets
 * @returns {Promise<KeywordSets>} 返回一个包含关键字集合的Promise对象
 */
async function loadDefaultKeywordSets(): Promise<KeywordSets> {
  try {
    logger.info('尝试加载本地关键字文件');
    
    // 通过后台脚本获取本地关键字
    const jsonData = await new Promise<Record<string, string[]>>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'fetchLocalKeywords' },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || '获取本地关键字失败'));
          }
        }
      );
    });
    
    logger.info('已加载本地关键字文件', { data: jsonData });
    return convertJsonToKeywordSets(jsonData);
  } catch (error) {
    logger.error('加载本地关键字文件发生异常', error);
    return {
      name: new Set<string>(),
      email: new Set<string>(),
      url: new Set<string>()
    };
  }
}

/**
 * @description 从缓存中获取关键字集合，如果缓存过期则返回null
 * @function getKeywordSetsFromCache
 * @returns {Promise<KeywordSets | null>} 返回关键字集合或null
 */
async function getKeywordSetsFromCache(): Promise<KeywordSets | null> {
  try {
    return new Promise<KeywordSets | null>((resolve) => {
      chrome.storage.local.get([CACHE_KEY], (result) => {
        if (result && result[CACHE_KEY]) {
          const { data, timestamp } = result[CACHE_KEY];
          const now = Date.now();
          
          // 检查缓存是否过期
          if (now - timestamp < CACHE_TTL) {
            logger.info('从缓存加载关键字集合', { 
              source: 'cache', 
              cacheAge: Math.floor((now - timestamp) / 1000) + '秒',
              validFor: Math.floor((CACHE_TTL - (now - timestamp)) / 1000) + '秒'
            });
            resolve(convertJsonToKeywordSets(data));
          } else {
            logger.info('缓存已过期', { 
              age: Math.floor((now - timestamp) / 1000) + '秒',
              ttl: Math.floor(CACHE_TTL / 1000) + '秒'
            });
            resolve(null);
          }
        } else {
          logger.info('未找到关键字缓存');
          resolve(null);
        }
      });
    });
  } catch (error) {
    logger.error('读取关键字缓存失败', error);
    return null;
  }
}

/**
 * @description 将关键字集合保存到缓存中
 * @function saveKeywordSetsToCache
 * @param {Record<string, string[]>} data 关键字集合数据
 * @return {Promise<void>} 返回一个Promise对象，表示保存操作完成
 */
export async function saveKeywordSetsToCache(data: Record<string, string[]>): Promise<void> {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ [CACHE_KEY]: cacheData }, () => {
        logger.info('关键字集合已缓存', { cacheData });
        resolve();
      });
    });
  } catch (error) {
    logger.error('缓存关键字集合失败', error);
    throw error; // 添加错误抛出
  }
}

/**
 * @description 从远程获取关键字集合，支持重试和指数退避
 * @function fetchKeywordSetsFromRemote
 * @returns {Promise<KeywordSets | null>} 返回关键字集合或null
 */
async function fetchKeywordSetsFromRemote(): Promise<KeywordSets | null> {
  const MAX_RETRIES = 3;             // 最大重试次数
  const INITIAL_DELAY = 1000;        // 初始延迟时间（毫秒）
  const MAX_DELAY = 10000;           // 最大延迟时间（毫秒）
  const JITTER_FACTOR = 0.25;        // 抖动因子（0-1之间）
  
  // 判断是否应该重试的错误类型
  function isRetryableError(error: any): boolean {
    // 网络错误、超时错误、服务器错误（5xx）可以重试
    return (
      error.name === 'AbortError' ||                 // 超时
      error.message.includes('network') ||           // 网络错误
      (error.status >= 500 && error.status < 600) || // 服务器错误
      error.message.includes('fetch') ||             // fetch相关错误
      error.message.includes('timeout')              // 超时相关错误
    );
  }
  
  // 计算下一次重试延迟（指数退避 + 抖动）
  function getBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      MAX_DELAY,
      INITIAL_DELAY * Math.pow(2, attempt)
    );
    
    // 添加抖动以避免请求同步
    const jitter = exponentialDelay * JITTER_FACTOR * Math.random();
    
    return exponentialDelay + jitter;
  }
  
  /**
   * @description 通过后台脚本获取远程关键字数据
   * @function fetchThroughBackground
   * @param url 远程URL
   * @returns {Promise<Record<string, string[]>>} 返回关键字数据
   */
  async function fetchThroughBackground(url: string): Promise<Record<string, string[]>> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'fetchRemoteKeywords', url },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || '获取关键字失败'));
          }
        }
      );
    });
  }
  
  let retryCount = 0;
  let lastError: any;

  while (retryCount <= MAX_RETRIES) {
    try {
      const keywordsUrl = await getKeywordsUrl();
      
      if (retryCount > 0) {
        logger.info(`正在进行第 ${retryCount} 次重试获取关键字数据`, { 
          url: keywordsUrl,
          lastError: lastError?.message || '未知错误'
        });
      } else {
        logger.info('正在从远程获取关键字数据', { url: keywordsUrl });
      }
      
      // 获取ETag和Last-Modified
      let etag = '';
      let lastModified = '';
      
      await new Promise<void>(resolve => {
        chrome.storage.local.get([
          'easyfill_keywords_etag',
          'easyfill_keywords_last_modified'
        ], (result) => {
          etag = result['easyfill_keywords_etag'] || '';
          lastModified = result['easyfill_keywords_last_modified'] || '';
          resolve();
        });
      });
      
      // 构建请求头，使用条件请求减少带宽使用
      const headers: Record<string, string> = {};
      
      if (etag) {
        headers['If-None-Match'] = etag;
      }
      
      if (lastModified) {
        headers['If-Modified-Since'] = lastModified;
      }
      
      // 通过后台脚本获取数据，避免CORS问题
      const jsonData = await fetchThroughBackground(keywordsUrl);
      
      if (!jsonData.name || !jsonData.email || !jsonData.url) {
        throw new Error('关键字数据格式不正确');
      }
      
      // 缓存获取的数据
      await saveKeywordSetsToCache(jsonData);
      
      logger.info('远程关键字获取成功并已缓存', { 
        retryCount,
        data: jsonData
      });
      return convertJsonToKeywordSets(jsonData);
      
    } catch (error: any) {
      lastError = error;
      const shouldRetry = isRetryableError(error) && retryCount < MAX_RETRIES;
      
      if (shouldRetry) {
        retryCount++;
        const delay = getBackoffDelay(retryCount);
        
        logger.warn(`获取关键字失败，将在 ${Math.round(delay / 1000)} 秒后重试 (${retryCount}/${MAX_RETRIES})`, {
          error: error.message,
          errorName: error.name,
          retryDelay: delay
        });
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 如果不应该重试，或者已达到最大重试次数，记录错误并返回null
      logger.error('获取远程关键字集合失败', {
        error,
        retriesAttempted: retryCount
      });
      return null;
    }
  }
  
  return null; // 达到最大重试次数后仍然失败
}

/**
 * @description 获取关键字集合，优先使用缓存，其次使用远程获取，最后使用默认值
 * @function getKeywordSets
 * @returns {Promise<KeywordSets>} 返回关键字集合
 */
export async function getKeywordSets(): Promise<KeywordSets> {
  try {
    // 尝试从缓存获取
    const cachedSets = await getKeywordSetsFromCache();
    if (cachedSets) {
      logger.info('使用缓存的关键字集合');
      return cachedSets;
    }
    
    // 尝试从远程获取
    const remoteUrl = await getKeywordsUrl();
    const remoteSets = await fetchKeywordSetsFromRemote();
    if (remoteSets) {
      logger.info('使用远程的关键字集合', { 
        source: 'remote', 
        url: remoteUrl,
        timestamp: Date.now() 
      });
      return remoteSets;
    }
    
    // 如果网络不可用或远程获取失败，使用默认值
    if (!defaultKeywordSets) {
      defaultKeywordSets = await loadDefaultKeywordSets();
    }
    
    logger.info('使用本地默认的关键字集合', { 
      source: 'local', 
      url: chrome.runtime.getURL('data/keywords.json'),
      timestamp: Date.now() 
    });
    return defaultKeywordSets;
  } catch (error) {
    logger.error('获取关键字集合失败，使用默认值', error);
    // 确保即使出错也能返回一个空集合
    return {
      name: new Set<string>(),
      email: new Set<string>(),
      url: new Set<string>()
    };
  }
}