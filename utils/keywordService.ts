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
 * 从本地文件加载默认关键字集合
 */

/**
 * @description 加载本地关键字集合，优先使用本地文件，如果加载失败则使用内置备份
 * @function loadDefaultKeywordSets
 * @returns {Promise<KeywordSets>} 返回一个包含关键字集合的Promise对象
 */
async function loadDefaultKeywordSets(): Promise<KeywordSets> {
  const response = await fetch(chrome.runtime.getURL('data/keywords.json'));
  if (!response.ok) {
    logger.error(`加载本地关键字文件失败: ${response.status}`);
  }
  
  const jsonData = await response.json();
  logger.info('已加载本地关键字文件');
  return convertJsonToKeywordSets(jsonData);
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
async function saveKeywordSetsToCache(data: Record<string, string[]>): Promise<void> {
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
  }
}

/**
 * @function fetchKeywordSetsFromRemote
 * @description 从远程获取关键字集合
 * @returns {Promise<KeywordSets | null>} 返回关键字集合或null
 */
async function fetchKeywordSetsFromRemote(): Promise<KeywordSets | null> {
  try {
    const keywordsUrl = await getKeywordsUrl();
    logger.info('正在从远程获取关键字集合', { url: keywordsUrl });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
    
    const response = await fetch(keywordsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const jsonData = await response.json();
    
    if (!jsonData.name || !jsonData.email || !jsonData.url) {
      throw new Error('关键字数据格式不正确');
    }
    
    // 缓存获取的数据
    await saveKeywordSetsToCache(jsonData);
    
    logger.info('远程关键字获取成功并已缓存', { data: jsonData });
    return convertJsonToKeywordSets(jsonData);
  } catch (error) {
    logger.error('获取远程关键字集合失败', error);
    return null;
  }
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