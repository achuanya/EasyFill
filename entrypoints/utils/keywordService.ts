/**
 * @description  关键字处理, 用于处理关键字集合的获取、缓存和转换等操作
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-09-16
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       utils/keywordService
 */

import { logger } from './logger';
import {
  getCacheData,
  setCacheData,
  CacheConfig
} from './storageUtils';
import { sendRuntimeMessage } from './storageUtils';

// 关键字集合的类型定义
export interface KeywordSets {
  name: Set<string>;
  email: Set<string>;
  url: Set<string>;
  [key: string]: Set<string>;
}

// 缓存配置
const CACHE_KEY = 'easyfill_keywords_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时

// 关键字缓存配置
const KEYWORDS_CACHE_CONFIG: CacheConfig = {
  key: CACHE_KEY,
  ttl: CACHE_TTL,
  validator: (data: any) => data && typeof data === 'object' && data.name && data.email && data.url
};

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
    // 确保 jsonData[key] 是一个数组
    if (Array.isArray(jsonData[key])) {
      result[key] = new Set(jsonData[key]);
    } else {
      logger.warn(`关键字数据格式警告：键 "${key}" 的值不是数组，已跳过。`, { value: jsonData[key] });
      result[key] = new Set(); // 创建一个空 Set 以保持类型一致性
    }
  }

  return result as KeywordSets;
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
    const jsonData = await sendRuntimeMessage({ action: 'fetchLocalKeywords' })
      .then(response => {
        if (response && response.success && response.data) {
          return response.data;
        } else {
          throw new Error(response?.error || '获取本地关键字失败');
        }
      });

    logger.info('已加载本地关键字文件');
    return convertJsonToKeywordSets(jsonData);
  } catch (error) {
    logger.error('加载本地关键字文件失败，返回空集合', error);
    // 返回一个空的结构，而不是抛出错误，确保后续逻辑可以继续
    return {
      name: new Set<string>(),
      email: new Set<string>(),
      url: new Set<string>()
    };
  }
}

/**
 * @description 从缓存中获取原始关键字数据，如果缓存过期则返回null
 * @function getKeywordSetsFromCache
 * @returns {Promise<Record<string, string[]> | null>} 返回原始关键字数据或null
 */
export async function getKeywordSetsFromCache(): Promise<Record<string, string[]> | null> {
  try {
    const cachedData = await getCacheData<Record<string, string[]>>(KEYWORDS_CACHE_CONFIG);
    if (cachedData) {
      logger.info('从缓存加载关键字集合');
    }
    return cachedData;
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
    await setCacheData(KEYWORDS_CACHE_CONFIG, data);
    logger.info('关键字集合已缓存');
  } catch (error) {
    logger.error('缓存关键字集合时发生异常', error);
    throw error;
  }
}

/**
 * @description 请求后台脚本同步并获取最新的关键字数据
 * @function triggerBackgroundSyncAndFetch
 * @returns {Promise<KeywordSets | null>} 返回关键字集合或null
 */
async function triggerBackgroundSyncAndFetch(): Promise<KeywordSets | null> {
  try {
    // 请求后台执行同步（如果需要）并返回最新数据
    const response = await sendRuntimeMessage({ action: 'getOrSyncKeywords' });
    
    if (response && response.success && response.data) {
      logger.info('后台同步/获取关键字成功');
      return convertJsonToKeywordSets(response.data);
    } else {
      logger.warn('后台同步/获取关键字失败或无数据返回', { error: response?.error });
      // 即使同步失败，也尝试返回 null，让 getKeywordSets 继续尝试本地数据
      return null;
    }
  } catch (error) {
    logger.error('请求后台同步关键字失败', error);
    // 即使同步失败，也尝试返回 null，让 getKeywordSets 继续尝试本地数据
    return null;
  }
}

/**
 * @description 从远程获取关键字集合（通过后台脚本），支持重试和指数退避
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
    // 网络错误、超时错误、后台通信错误可以重试
    const message = error?.message?.toLowerCase() || '';
    return (
      error?.name === 'AbortError' ||                 // 超时
      message.includes('network') ||                  // 网络错误
      message.includes('failed to fetch') ||          // fetch 失败
      message.includes('timeout') ||                  // 超时相关错误
      message.includes('通信失败') ||                 // 后台通信错误
      message.includes('后台脚本通信失败')
    );
  }

  // 计算下一次重试延迟（指数退避 + 抖动）
  function getBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      MAX_DELAY,
      INITIAL_DELAY * Math.pow(2, attempt)
    );
    const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() - 0.5) * 2; // -jitter to +jitter
    return Math.max(0, exponentialDelay + jitter); // Ensure delay is not negative
  }

  let retryCount = 0;
  let lastError: any;

  while (retryCount <= MAX_RETRIES) {
    try {
      if (retryCount > 0) {
        logger.info(`正在进行第 ${retryCount} 次重试获取关键字数据`, {
          lastError: lastError?.message || '未知错误'
        });
      } else {
        logger.info('正在请求后台同步/获取关键字数据');
      }

      // 请求后台脚本进行同步（如果需要）并获取数据
      const keywordSets = await triggerBackgroundSyncAndFetch();

      // 如果成功获取到数据 (keywordSets 不为 null)
      if (keywordSets) {
         logger.info('通过后台获取远程关键字成功', { retryCount });
         // 注意：不再在这里调用 saveKeywordSetsToCache，由 background 脚本负责
         return keywordSets;
      } else {
         // 如果 triggerBackgroundSyncAndFetch 返回 null，说明后台未能提供数据
         // 这可能不是一个可重试的错误（例如，后台同步逻辑判断无需同步且缓存无效）
         // 或者是一个后台内部错误。我们在这里将其视为失败，但不一定是可重试的。
         logger.warn('后台未能提供关键字数据', { retryCount });
         // 决定是否将此视为可重试错误，或者直接跳出循环
         // 为简单起见，如果后台明确返回 null 而不是抛出错误，我们认为不需要重试
         lastError = new Error('后台未能提供关键字数据');
         break; // 跳出重试循环
      }

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

      // 如果不应该重试，或者已达到最大重试次数，记录错误并跳出循环
      logger.error('获取远程关键字集合失败，已达最大重试次数或错误不可重试', {
        error: error.message,
        errorName: error.name,
        retriesAttempted: retryCount
      });
      break; // 跳出重试循环
    }
  }

  return null; // 达到最大重试次数或遇到不可重试错误后仍然失败
}

/**
 * @description 获取关键字集合，优先使用缓存，其次请求后台同步/获取，最后使用默认值
 * @function getKeywordSets
 * @returns {Promise<KeywordSets>} 返回关键字集合
 */
export async function getKeywordSets(): Promise<KeywordSets> {
  try {
    // 1. 尝试从缓存获取原始数据
    const cachedRawData = await getKeywordSetsFromCache();
    if (cachedRawData) {
      logger.info('使用缓存的关键字集合');
      // 在这里转换成 KeywordSets (Set<string>)
      return convertJsonToKeywordSets(cachedRawData);
    }
    logger.info('缓存未命中或已过期');

    // 2. 尝试请求后台同步/获取 (fetchKeywordSetsFromRemote 返回 KeywordSets | null)
    const remoteSets = await fetchKeywordSetsFromRemote();
    if (remoteSets) {
      logger.info('使用后台提供的关键字集合', {
        source: 'background',
        timestamp: Date.now()
      });
      return remoteSets; // 直接返回，已经是 KeywordSets 类型
    }
    logger.warn('无法从后台获取关键字集合');

    // 3. 如果网络不可用或远程获取失败，加载本地默认值 (loadDefaultKeywordSets 返回 KeywordSets)
    logger.info('尝试加载本地默认关键字集合');
    if (!defaultKeywordSets) {
      defaultKeywordSets = await loadDefaultKeywordSets();
    }

    if (defaultKeywordSets && (defaultKeywordSets.name.size > 0 || defaultKeywordSets.email.size > 0 || defaultKeywordSets.url.size > 0)) {
       logger.info('使用本地默认的关键字集合', {
         source: 'local_default',
         url: chrome.runtime.getURL('data/keywords.json'),
         timestamp: Date.now()
       });
       return defaultKeywordSets; // 直接返回，已经是 KeywordSets 类型
    } else {
       logger.warn('本地默认关键字集合为空或加载失败');
       return { name: new Set<string>(), email: new Set<string>(), url: new Set<string>() };
    }

  } catch (error) {
    logger.error('获取关键字集合过程中发生严重错误，返回空集合', error);
    return { name: new Set<string>(), email: new Set<string>(), url: new Set<string>() };
  }
}