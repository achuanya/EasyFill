/**
 * @description  字段匹配系统
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       utils/fieldMatcher
 */

import { KeywordSets } from './keywordService';

/**
 * @description 匹配结果接口
 * @interface MatchResult
 * @property {boolean} matched - 是否匹配
 * @property {string} fieldType - 字段类型 (name, email, url 等)
 * @property {number} confidence - 置信度 (0-1)
 * @property {MatchMethod} method - 使用的匹配方法
 * @property {string} [keyword] - 匹配到的关键字 (如果有)
 */
export interface MatchResult {
  matched: boolean;
  fieldType: string;
  confidence: number;
  method: MatchMethod;
  keyword?: string;
}

/**
 * @description 匹配方法枚举
 * @enum MatchMethod
 * @property {string} EXACT - 精确匹配
 * @property {string} FUZZY - 模糊匹配
 * @property {string} LEVENSHTEIN - 编辑距离匹配
 * @property {string} SUBSTRING - 子字符串匹配
 * @property {string} SEMANTIC - 语义匹配
 * @property {string} CONTEXT - 上下文匹配
 * @property {string} PATTERN - 模式匹配
 */
export enum MatchMethod {
  EXACT = 'exact',
  FUZZY = 'fuzzy',
  LEVENSHTEIN = 'levenshtein',
  SUBSTRING = 'substring',
  SEMANTIC = 'semantic',
  CONTEXT = 'context',
  PATTERN = 'pattern'
}

/**
 * @description  匹配选项接口
 * @interface MatchOptions
 * @property {number} threshold - 模糊匹配阈值 (0-1)
 * @property {boolean} enableFuzzy - 启用模糊匹配
 * @property {boolean} enableSubstring - 启用子字符串匹配
 * @property {boolean} enableContextual - 启用上下文匹配
 * @property {boolean} prioritizeExact - 优先考虑精确匹配
 * @property {number} maxDistance - 最大编辑距离
 * @property {boolean} caseSensitive - 区分大小写
 * @property {FormContext} formContext - 表单上下文信息
 */
export interface MatchOptions {
  threshold: number;
  enableFuzzy: boolean;
  enableSubstring: boolean;
  enableContextual: boolean;
  prioritizeExact: boolean;
  maxDistance: number;
  caseSensitive: boolean;
  formContext?: FormContext;
}

/**
 * @description 默认匹配选项
 * @constant DEFAULT_OPTIONS
 * @property {number} threshold - 默认模糊匹配阈值
 * @property {boolean} enableFuzzy - 默认启用模糊匹配
 * @property {boolean} enableSubstring - 默认启用子字符串匹配
 * @property {boolean} enableContextual - 默认启用上下文匹配
 * @property {boolean} prioritizeExact - 默认优先考虑精确匹配
 * @property {number} maxDistance - 默认最大编辑距离
 * @property {boolean} caseSensitive - 默认不区分大小写
 */
const DEFAULT_OPTIONS: MatchOptions = {
  threshold: 0.7,
  enableFuzzy: true,
  enableSubstring: true,
  enableContextual: true,
  prioritizeExact: true,
  maxDistance: 3,
  caseSensitive: false
};

/**
 * @description 表单上下文信息接口
 * @interface FormContext
 * @property {string} formId - 表单ID
 * @property {string} formAction - 表单提交地址
 * @property {string[]} nearbyLabels - 附近的标签文本
 * @property {string[]} nearbyFields - 附近的字段名称
 * @property {string} formType - 表单类型（评论、登录、注册等）
 * @property {string} pageUrl - 页面URL
 * @property {string} pageType - 页面类型
 */
export interface FormContext {
  formId?: string;
  formAction?: string;
  nearbyLabels: string[];
  nearbyFields: string[];
  formType?: string;
  pageUrl: string;
  pageType?: string;
}

/**
 * @description 计算两个字符串的相似度
 * @function stringSimilarity
 * @param str1 第一个字符串
 * @param str2 第二个字符串 
 * @returns 相似度 (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // 完全相等，直接返回1
  if (s1 === s2) return 1;
  
  // 子字符串匹配
  if (s1.includes(s2) || s2.includes(s1)) {
    const longerLength = Math.max(s1.length, s2.length);
    const shorterLength = Math.min(s1.length, s2.length);
    return shorterLength / longerLength * 0.9; // 子字符串匹配给0.9的最高分
  }

  // 莱文斯坦距离计算
  const matrix: number[][] = [];
  
  // 初始化矩阵
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  // 填充矩阵
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1.charAt(i - 1) === s2.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // 删除
        matrix[i][j - 1] + 1,       // 插入
        matrix[i - 1][j - 1] + cost // 替换
      );
    }
  }
  
  // 计算相似度
  const maxLength = Math.max(s1.length, s2.length);
  const distance = matrix[s1.length][s2.length];
  return 1 - distance / maxLength;
}

/**
 * @description 获取表单上下文信息
 * @function getFormContext
 * @param element DOM元素
 * @returns 表单上下文
 */
export function getFormContext(element: HTMLElement): FormContext {
  // 尝试获取元素所在的表单
  const form = element.closest('form');
  
  // 收集附近的标签文本
  const nearbyLabels: string[] = [];
  
  // 查找与此输入字段关联的标签
  if (element.id) {
    const associatedLabel = document.querySelector(`label[for="${element.id}"]`);
    if (associatedLabel) {
      nearbyLabels.push(associatedLabel.textContent?.trim().toLowerCase() || '');
    }
  }
  
  // 查找元素的父级标签，可能包含描述性文本
  let parent = element.parentElement;
  while (parent && nearbyLabels.length < 3) {
    const labelElements = parent.querySelectorAll('label, span, div');
    labelElements.forEach(el => {
      if (el !== element && el.textContent) {
        const text = el.textContent.trim().toLowerCase();
        if (text && text.length < 50) { // 避免获取过长的文本
          nearbyLabels.push(text);
        }
      }
    });
    parent = parent.parentElement;
  }
  
  // 收集表单中附近的字段名称
  const nearbyFields: string[] = [];
  if (form) {
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (input instanceof HTMLElement && input !== element) {
        const name = input.getAttribute('name');
        const id = input.getAttribute('id');
        if (name) nearbyFields.push(name.toLowerCase());
        if (id) nearbyFields.push(id.toLowerCase());
      }
    });
  }
  
  return {
    formId: form?.id || undefined,
    formAction: form?.getAttribute('action') || undefined,
    nearbyLabels,
    nearbyFields,
    pageUrl: window.location.href,
    formType: determineFormType(form, window.location.href),
  };
}

/**
 * 尝试确定表单类型
 * @param form 表单元素
 * @param url 页面URL
 * @returns 表单类型
 */
function determineFormType(form: HTMLFormElement | null, url: string): string | undefined {
  if (!form) return undefined;
  
  // 查找表单内的关键元素
  const hasPasswordField = !!form.querySelector('input[type="password"]');
  const hasEmailField = !!form.querySelector('input[type="email"]');
  const hasSubmitWithText = Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]'))
    .some(el => {
      const text = el.textContent?.toLowerCase() || 
                   (el instanceof HTMLInputElement ? el.value.toLowerCase() : '');
      return text.includes('login') || text.includes('sign in') || 
             text.includes('register') || text.includes('submit') || 
             text.includes('comment') || text.includes('评论') ||
             text.includes('登录') || text.includes('注册');
    });
  
  // 分析URL路径
  const path = new URL(url).pathname.toLowerCase();
  
  // 判断表单类型
  if (hasPasswordField && hasEmailField) {
    return path.includes('register') || path.includes('signup') || path.includes('注册') 
           ? 'registration' : 'login';
  } else if (path.includes('comment') || path.includes('评论')) {
    return 'comment';
  } else if (path.includes('contact') || path.includes('联系')) {
    return 'contact';
  } else if (hasSubmitWithText) {
    // 基于提交按钮文本的推断
    const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
    for (const button of Array.from(submitButtons)) {
      const text = button.textContent?.toLowerCase() || 
                  (button instanceof HTMLInputElement ? button.value.toLowerCase() : '');
      if (text.includes('comment') || text.includes('评论')) return 'comment';
      if (text.includes('login') || text.includes('sign in') || text.includes('登录')) return 'login';
      if (text.includes('register') || text.includes('sign up') || text.includes('注册')) return 'registration';
      if (text.includes('contact') || text.includes('send') || text.includes('联系')) return 'contact';
    }
  }
  
  return 'unknown';
}

/**
 * @description 智能匹配
 * @function enhancedMatchKeywords
 * @param keywordSets 关键字集合
 * @param attributes 要匹配的属性数组
 * @param options 匹配选项
 * @returns 匹配结果
 */
export function enhancedMatchKeywords(
  keywordSets: KeywordSets, 
  attributes: string[], 
  options: Partial<MatchOptions> = {}
): MatchResult {
  // 合并默认选项
  const opts: MatchOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // 创建一个空的结果对象
  const result: MatchResult = {
    matched: false,
    fieldType: '',
    confidence: 0,
    method: MatchMethod.EXACT
  };
  
  // 处理空属性
  if (!attributes || attributes.length === 0) {
    return result;
  }
  
  // 过滤无效属性
  const validAttributes = attributes.filter(attr => attr && typeof attr === 'string');
  if (validAttributes.length === 0) {
    return result;
  }
  
  // 规范化处理属性
  const normalizedAttributes = opts.caseSensitive 
    ? validAttributes 
    : validAttributes.map(attr => attr.toLowerCase());
  
  // 遍历所有字段类型
  for (const fieldType of Object.keys(keywordSets)) {
    const keywordSet = keywordSets[fieldType];
    
    // 精确匹配检查（优先级最高）
    if (opts.prioritizeExact) {
      for (const attr of normalizedAttributes) {
        if (keywordSet.has(opts.caseSensitive ? attr : attr.toLowerCase())) {
          return {
            matched: true,
            fieldType,
            confidence: 1.0,
            method: MatchMethod.EXACT,
            keyword: attr
          };
        }
      }
    }
    
    // 检查子字符串匹配
    if (opts.enableSubstring) {
      for (const attr of normalizedAttributes) {
        for (const keyword of keywordSet) {
          const normalizedKeyword = opts.caseSensitive ? keyword : keyword.toLowerCase();
          
          // 关键字作为子字符串
          if (attr.includes(normalizedKeyword)) {
            const confidence = normalizedKeyword.length / attr.length * 0.9;
            if (confidence > result.confidence) {
              result.matched = true;
              result.fieldType = fieldType;
              result.confidence = confidence;
              result.method = MatchMethod.SUBSTRING;
              result.keyword = keyword;
            }
          }
          // 属性作为子字符串
          else if (normalizedKeyword.includes(attr)) {
            const confidence = attr.length / normalizedKeyword.length * 0.85;
            if (confidence > result.confidence) {
              result.matched = true;
              result.fieldType = fieldType;
              result.confidence = confidence;
              result.method = MatchMethod.SUBSTRING;
              result.keyword = keyword;
            }
          }
        }
      }
    }
    
    // 模糊匹配
    if (opts.enableFuzzy) {
      for (const attr of normalizedAttributes) {
        for (const keyword of keywordSet) {
          const normalizedKeyword = opts.caseSensitive ? keyword : keyword.toLowerCase();
          const similarity = stringSimilarity(attr, normalizedKeyword);
          
          if (similarity >= opts.threshold && similarity > result.confidence) {
            result.matched = true;
            result.fieldType = fieldType;
            result.confidence = similarity;
            result.method = MatchMethod.FUZZY;
            result.keyword = keyword;
          }
        }
      }
    }
    
    // 上下文匹配
    if (opts.enableContextual && opts.formContext) {
      const contextConfidence = evaluateContextMatch(fieldType, opts.formContext, keywordSet);
      if (contextConfidence > result.confidence) {
        result.matched = true;
        result.fieldType = fieldType;
        result.confidence = contextConfidence;
        result.method = MatchMethod.CONTEXT;
      }
    }
  }
  
  // 最终判定：置信度超过阈值才算匹配成功
  if (result.confidence < opts.threshold) {
    result.matched = false;
  }
  
  return result;
}

/**
 * @description 评估上下文匹配
 * @function evaluateContextMatch
 * @param fieldType 字段类型
 * @param context 表单上下文
 * @param keywordSet 关键字集合
 * @returns 置信度
 */
function evaluateContextMatch(
  fieldType: string, 
  context: FormContext, 
  keywordSet: Set<string>
): number {
  let maxConfidence = 0;
  
  // 检查附近标签
  for (const label of context.nearbyLabels) {
    for (const keyword of keywordSet) {
      const similarity = stringSimilarity(label, keyword.toLowerCase());
      if (similarity > maxConfidence) {
        maxConfidence = similarity;
      }
    }
  }
  
  // 特定表单类型的调整
  if (context.formType) {
    switch(context.formType) {
      case 'comment':
        if (fieldType === 'name') maxConfidence *= 1.1; // 增加名称匹配的权重
        if (fieldType === 'email') maxConfidence *= 1.1; // 增加邮箱匹配的权重
        if (fieldType === 'url') maxConfidence *= 1.2; // 评论表单中网址字段更常见
        break;
      case 'contact':
        if (fieldType === 'email') maxConfidence *= 1.2; // 联系表单中邮箱很重要
        break;
      case 'login':
        if (fieldType === 'email' || fieldType === 'name') maxConfidence *= 1.1;
        break;
      case 'registration':
        // 注册表单各字段都很常见
        maxConfidence *= 1.05;
        break;
    }
  }
  
  // 页面URL影响（如果URL包含相关字段类型的指示）
  if (context.pageUrl) {
    const lowerUrl = context.pageUrl.toLowerCase();
    if (lowerUrl.includes('comment') && fieldType === 'name') maxConfidence *= 1.05;
    if (lowerUrl.includes('profile') && (fieldType === 'name' || fieldType === 'url')) maxConfidence *= 1.05;
    if (lowerUrl.includes('contact') && fieldType === 'email') maxConfidence *= 1.05;
  }
  
  return maxConfidence;
}

/**
 * @description 模式匹配（检查输入是否符合某些预定义的模式）
 * @function patternMatch
 * @param value 输入值
 * @returns 匹配结果
 */
export function patternMatch(value: string): MatchResult | null {
  if (!value) return null;
  
  // 邮箱模式
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(value)) {
    return {
      matched: true,
      fieldType: 'email',
      confidence: 0.95,
      method: MatchMethod.PATTERN
    };
  }
  
  // URL模式
  const urlRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
  if (urlRegex.test(value)) {
    return {
      matched: true,
      fieldType: 'url',
      confidence: 0.95,
      method: MatchMethod.PATTERN
    };
  }
  
  return null;
}

/**
 * 自动缓存使用的标识符键
 */
type CacheKey = string;

/**
 * @description 匹配结果缓存类
 * @class MatchCache
 * @property {Map<CacheKey, MatchResult>} cache - 缓存对象
 */
class MatchCache {
  private static cache = new Map<CacheKey, MatchResult>();
  private static readonly MAX_SIZE = 500; // 最大缓存条目数
  
  /**
   * @description 创建缓存键
   * @function createKey
   * @param attributes 属性数组
   * @param options 匹配选项
   * @returns 缓存键
   */
  private static createKey(attributes: string[], options: Partial<MatchOptions>): CacheKey {
    const sortedAttrs = [...attributes].sort().filter(Boolean).join('|');
    const optionsKey = JSON.stringify({
      threshold: options.threshold,
      enableFuzzy: options.enableFuzzy,
      enableSubstring: options.enableSubstring,
      caseSensitive: options.caseSensitive,
    });
    return `${sortedAttrs}:${optionsKey}`;
  }
  
  /**
   * @description 获取缓存结果
   * @function get
   * @param attributes 属性数组
   * @param options 匹配选项
   * @return 匹配结果或undefined
   */
  static get(attributes: string[], options: Partial<MatchOptions>): MatchResult | undefined {
    const key = this.createKey(attributes, options);
    return this.cache.get(key);
  }
  
  /**
   * @description 设置缓存结果
   * @function set
   * @param attributes 属性数组
   * @param options 匹配选项
   * @param result 匹配结果
   * @return void
   */
  static set(attributes: string[], options: Partial<MatchOptions>, result: MatchResult): void {
    // 缓存管理：如果达到最大容量，清除一半的缓存
    if (this.cache.size >= this.MAX_SIZE) {
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < this.MAX_SIZE / 2; i++) {
        this.cache.delete(keys[i]);
      }
    }
    
    const key = this.createKey(attributes, options);
    this.cache.set(key, result);
  }
  
  /**
   * @description 清除所有缓存
   * @function clear
   * @return void
   */
  static clear(): void {
    this.cache.clear();
  }
}

/**
 * @description 智能匹配关键字
 * @function smartMatchKeywords
 * @param keywordSets 关键字集合
 * @param attributes 属性数组
 * @param options 匹配选项
 * @returns 匹配结果
 */
export function smartMatchKeywords(
  keywordSets: KeywordSets,
  attributes: string[],
  options: Partial<MatchOptions> = {}
): MatchResult {
  // 检查缓存
  const cachedResult = MatchCache.get(attributes, options);
  if (cachedResult) {
    return cachedResult;
  }
  
  // 执行匹配
  const result = enhancedMatchKeywords(keywordSets, attributes, options);
  
  // 缓存结果
  MatchCache.set(attributes, options, result);
  
  return result;
}