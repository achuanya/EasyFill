/**
 * @description 提供统一的日志记录功能，支持三个日志级别和颜色输出。
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-09-16
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       logger
 */

import { chromeStorageGet, chromeStorageSet, getLocalCacheData, setLocalCacheData } from './storageUtils';

/**
 * @description: 日志级别枚举
 * @enum {string}
 * @property {string} INFO - 信息级别日志
 * @property {string} WARN - 警告级别日志
 * @property {string} ERROR - 错误级别日志
 */
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * @description: 日志颜色配置接口
 * @interface LogColors
 * @property {string} info - 信息级别日志颜色
 * @property {string} warn - 警告级别日志颜色
 * @property {string} error - 错误级别日志颜色
 * @property {string} prefix - 日志前缀颜色
 * @property {string} timestamp - 日志时间戳颜色
 */
interface LogColors {
  info: string;
  warn: string;
  error: string;
  prefix: string;
  timestamp: string;
}

/**
 * @description: 日志配置接口
 * @interface LoggerConfig
 * @property {LogLevel} level - 日志级别
 * @property {string} prefix - 日志前缀
 * @property {boolean} enabled - 是否启用日志输出
 * @property {boolean} useColors - 是否启用彩色输出
 * @property {boolean} showTimestamp - 是否显示时间戳
 * @property {LogColors} colors - 日志颜色配置
 */
interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  enabled: boolean;
  useColors: boolean;
  showTimestamp: boolean;
  colors: LogColors;
}

/**
 * @description: 默认日志颜色配置
 * @constant DEFAULT_COLORS
 * @property {LogColors} info - 信息级别日志颜色
 * @property {LogColors} warn - 警告级别日志颜色
 * @property {LogColors} error - 错误级别日志颜色
 * @property {LogColors} prefix - 日志前缀颜色
 * @property {LogColors} timestamp - 日志时间戳颜色
 */
const DEFAULT_COLORS: LogColors = {
  info: 'color: #2196F3; font-weight: normal',
  warn: 'color: #FF9800; font-weight: bold',
  error: 'color: #F44336; font-weight: bold',
  prefix: 'color: #4CAF50; font-weight: bold',
  timestamp: 'color: #9E9E9E; font-weight: normal',
};

// 存储键名
const LOGGER_STORAGE_KEY = 'easyfill_logger_enabled';
const HELP_SHOWN_KEY = 'easyfill_logger_help_shown';

/**
 * @description: 日志系统类
 * 提供三个级别的日志记录功能：INFO, WARN, ERROR
 * 支持彩色输出和时间戳
 * @class Logger
 * @property {LoggerConfig} config - 日志配置
 * @property {LogLevel} config.level - 日志级别
 * @property {string} config.prefix - 日志前缀
 * @property {boolean} config.enabled - 是否启用日志输出
 * @property {boolean} config.useColors - 是否启用彩色输出
 * @property {boolean} config.showTimestamp - 是否显示时间戳
 * @property {LogColors} config.colors - 日志颜色配置
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    prefix: '[EasyFill]',
    enabled: false, // 默认关闭日志
    useColors: true,
    showTimestamp: true,
    colors: { ...DEFAULT_COLORS },
  };
  private isInitialized = false;

  private constructor() {
      this.initializeAsync();
  }

  /**
   * @description: 获取 Logger 实例
   * @function getInstance
   * @returns {Logger} 返回 Logger 实例
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * @description: 异步初始化Logger
   * @function initializeAsync
   * @returns {Promise<void>}
   */
  private async initializeAsync(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.loadLoggerState();
    this.setupConsoleCommands();
    this.isInitialized = true;
  }

  /**
   * @description: 确保Logger已初始化
   * @function ensureInitialized
   * @returns {Promise<void>}
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeAsync();
    }
  }

  /**
   * @description: 从存储中加载日志状态
   * @function loadLoggerState
   * @returns {Promise<void>}
   */
  private async loadLoggerState(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Chrome扩展环境
        try {
          const result = await chromeStorageGet([LOGGER_STORAGE_KEY]);
          if (result[LOGGER_STORAGE_KEY] !== undefined) {
            this.config.enabled = result[LOGGER_STORAGE_KEY];
          }
        } catch (error) {
          console.warn('无法从 Chrome 存储加载日志配置，使用 localStorage');
          // 如果 Chrome 存储失败，尝试从 localStorage 加载
           const stored = getLocalCacheData({ key: LOGGER_STORAGE_KEY });
           if (stored !== null) {
             try {
               this.config.enabled = stored;
             } catch (e) {
               console.warn('localStorage 中的日志配置格式错误，使用默认配置');
             }
           }
        }
      } else {
        // 普通网页环境
         const stored = getLocalCacheData({ key: LOGGER_STORAGE_KEY });
         if (stored !== null) {
           this.config.enabled = stored;
         }
      }
    } catch (error) {
      // 静默处理存储读取错误，保持默认状态
    }
  }

  /**
   * @description: 保存日志状态到存储
   * @function saveLoggerState
   * @returns {Promise<void>}
   */
  private async saveLoggerState(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Chrome扩展环境
        try {
          await chromeStorageSet({ [LOGGER_STORAGE_KEY]: this.config.enabled });
        } catch (error) {
          console.warn('无法保存到 Chrome 存储，使用 localStorage');
           // 如果 Chrome 存储失败，保存到 localStorage
           setLocalCacheData({ key: LOGGER_STORAGE_KEY }, this.config.enabled);
        }
      } else {
        // 普通网页环境
         setLocalCacheData({ key: LOGGER_STORAGE_KEY }, this.config.enabled);
      }
    } catch (error) {
      // 静默处理存储保存错误
    }
  }

  /**
   * @description: 检查是否已显示过帮助信息
   * @function hasShownHelp
   * @returns {boolean}
   */
  private hasShownHelp(): boolean {
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem(HELP_SHOWN_KEY) === 'true';
      }
    } catch (error) {
      // 静默处理
    }
    return false;
  }

  /**
   * @description: 标记已显示帮助信息
   * @function markHelpShown
   * @returns {void}
   */
  private markHelpShown(): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(HELP_SHOWN_KEY, 'true');
      }
    } catch (error) {
      // 静默处理
    }
  }

  /**
   * @description: 设置控制台命令
   * @function setupConsoleCommands
   * @returns {void}
   */
  private setupConsoleCommands(): void {
    // 将控制函数绑定到全局对象
    if (typeof window !== 'undefined') {
      (window as any).EasyFillLogger = {
        enable: async () => {
          await this.ensureInitialized();
          this.config.enabled = true;
          await this.saveLoggerState();
          console.log('%c[EasyFill] 日志系统已启用', 'color: #4CAF50; font-weight: bold');
          console.log('%c[EasyFill] 使用 EasyFillLogger.disable() 来关闭日志', 'color: #2196F3; font-weight: normal');
          return '日志系统已启用';
        },
        disable: async () => {
          await this.ensureInitialized();
          console.log('%c[EasyFill] 日志系统已关闭', 'color: #FF9800; font-weight: bold');
          this.config.enabled = false;
          await this.saveLoggerState();
          return '日志系统已关闭';
        },
        status: async () => {
          await this.ensureInitialized();
          const status = this.config.enabled ? '启用' : '关闭';
          console.log(`%c[EasyFill] 日志系统状态: ${status}`, 
            `color: ${this.config.enabled ? '#4CAF50' : '#FF9800'}; font-weight: bold`);
          return `日志系统状态: ${status}`;
        }
      };

      // 只在主页面（非content script）且未显示过帮助时显示命令提示
      const isContentScript = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL;
      const isMainPage = !isContentScript || window === window.top;
      
      if (isMainPage && !this.config.enabled && !this.hasShownHelp()) {
        setTimeout(() => {
          console.log('%c[EasyFill] 日志系统已关闭', 'color: #9E9E9E; font-weight: normal');
          console.log('%c[EasyFill] 使用以下命令控制日志:', 'color: #2196F3; font-weight: bold');
          console.log('%c  EasyFillLogger.enable()  - 启用日志', 'color: #4CAF50; font-weight: normal');
          console.log('%c  EasyFillLogger.disable() - 关闭日志', 'color: #FF9800; font-weight: normal');
          console.log('%c  EasyFillLogger.status()  - 查看状态', 'color: #2196F3; font-weight: normal');
          this.markHelpShown();
        }, 100);
      } else if (this.config.enabled && isMainPage) {
        // 如果日志已启用，显示启用状态
        setTimeout(() => {
          console.log('%c[EasyFill] 日志系统已启用', 'color: #4CAF50; font-weight: bold');
        }, 100);
      }
    }
  }

  /**
   * @description: 在生产环境中只显示警告和错误日志，在开发环境中显示所有日志，并启用彩色和时间戳
   * @function configureByEnvironment
   * @returns {Logger} 返回 Logger 实例
   */
  public configureByEnvironment(): Logger {
    const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
    
    if (isProd) {
      // 生产环境：只显示警告和错误
      this.setLevel(LogLevel.WARN);
    } else {
      // 开发环境：显示所有日志，启用彩色和时间戳，并自动启用日志输出
      this.setLevel(LogLevel.INFO)
          .useColors(true)
          .showTimestamp(true);
      // 在开发环境下自动启用日志输出
      this.config.enabled = true;
    }
    
    return this;
  }

  /**
   * @description: 设置日志级别
   * @function setLevel
   * @param level 日志级别
   * @returns {Logger} 返回 Logger 实例
   */
  public setLevel(level: LogLevel): Logger {
    this.config.level = level;
    return this;
  }

  /**
   * @description: 设置是否启用日志输出
   * @function setEnabled
   * @param enabled 是否启用日志输出
   * @returns {Logger} 返回 Logger 实例
   */
  public async setEnabled(enabled: boolean): Promise<Logger> {
    await this.ensureInitialized();
    this.config.enabled = enabled;
    await this.saveLoggerState();
    return this;
  }

  /**
   * @description: 设置日志前缀
   * @function setPrefix
   * @param prefix 日志前缀
   * @returns {Logger} 返回 Logger 实例
   */
  public setPrefix(prefix: string): Logger {
    this.config.prefix = prefix;
    return this;
  }

  /**
   * @description: 设置是否启用彩色输出
   * @function useColors
   * @param useColors 是否启用彩色输出
   * @returns {Logger} 返回 Logger 实例
   */
  public useColors(useColors: boolean): Logger {
    this.config.useColors = useColors;
    return this;
  }

  /**
   * @description: 设置是否显示时间戳
   * @function showTimestamp
   * @param show 是否显示时间戳
   * @returns {Logger} 返回 Logger 实例
   */
  public showTimestamp(show: boolean): Logger {
    this.config.showTimestamp = show;
    return this;
  }

  /**
   * @description: 设置日志级别颜色
   * @function setLevelColor
   * @param level 日志级别
   * @param colorStyle CSS 颜色样式
   * @return {Logger} 返回 Logger 实例
   */
  public setLevelColor(level: LogLevel, colorStyle: string): Logger {
    switch (level) {
      case LogLevel.INFO:
        this.config.colors.info = colorStyle;
        break;
      case LogLevel.WARN:
        this.config.colors.warn = colorStyle;
        break;
      case LogLevel.ERROR:
        this.config.colors.error = colorStyle;
        break;
    }
    return this;
  }

  /**
   * @description: 设置日志前缀颜色
   * @function setPrefixColor
   * @param colorStyle CSS 颜色样式
   * @return {Logger} 返回 Logger 实例
   */
  public setPrefixColor(colorStyle: string): Logger {
    this.config.colors.prefix = colorStyle;
    return this;
  }

  /**
   * @description: 设置时间戳颜色
   * @function setTimestampColor
   * @param colorStyle CSS 颜色样式
   * @return {Logger} 返回 Logger 实例
   */
  public setTimestampColor(colorStyle: string): Logger {
    this.config.colors.timestamp = colorStyle;
    return this;
  }

  /**
   * @description: 记录 INFO 级别日志
   * @function info
   * @param message 日志消息
   * @param args 附加参数
   * @return {void}
   */
  public async info(message: string, ...args: any[]): Promise<void> {
    await this.ensureInitialized();
    if (this.shouldLog(LogLevel.INFO)) {
      if (this.config.useColors) {
        this.logWithColors(LogLevel.INFO, message, ...args);
      } else {
        console.log(this.formatMessage(message), ...args);
      }
    }
  }

  /**
   * @description: 记录 WARN 级别日志
   * @function warn
   * @param message 日志消息
   * @param args 附加参数
   * @return {void}
   */
  public async warn(message: string, ...args: any[]): Promise<void> {
    await this.ensureInitialized();
    if (this.shouldLog(LogLevel.WARN)) {
      if (this.config.useColors) {
        this.logWithColors(LogLevel.WARN, message, ...args);
      } else {
        console.warn(this.formatMessage(message), ...args);
      }
    }
  }

  /**
   * @description: 记录 ERROR 级别日志
   * @function error
   * @param message 日志消息
   * @param args 附加参数
   * @return {void}
   */
  public async error(message: string, ...args: any[]): Promise<void> {
    await this.ensureInitialized();
    if (this.shouldLog(LogLevel.ERROR)) {
      if (this.config.useColors) {
        this.logWithColors(LogLevel.ERROR, message, ...args);
      } else {
        console.error(this.formatMessage(message), ...args);
      }
    }
  }

  /**
   * @description: 使用颜色输出日志
   * @function logWithColors
   * @param level 日志级别
   * @param message 日志消息
   * @param args 附加参数
   * @return {void}
   */
  private logWithColors(level: LogLevel, message: string, ...args: any[]): void {
    const { prefix, timestamp } = this.getParts();
    let colorStyles = [];
    let formatParts = [];
    
    // 添加时间戳
    if (this.config.showTimestamp && timestamp) {
      formatParts.push('%c%s');
      colorStyles.push(this.config.colors.timestamp, timestamp);
    }
    
    // 添加前缀
    formatParts.push('%c%s');
    colorStyles.push(this.config.colors.prefix, prefix);
    
    // 添加日志级别和消息
    const levelColor = this.getLevelColor(level);
    formatParts.push('%c%s');
    colorStyles.push(levelColor, ` [${level}] ${message}`);
    
    // 根据日志级别使用不同的 console 方法
    switch (level) {
      case LogLevel.INFO:
        console.log(formatParts.join(' '), ...colorStyles, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formatParts.join(' '), ...colorStyles, ...args);
        break;
      case LogLevel.ERROR:
        console.error(formatParts.join(' '), ...colorStyles, ...args);
        break;
    }
  }

  /**
   * @description: 获取日志级别对应的颜色样式
   * @function getLevelColor
   * @param {LogLevel} level 日志级别
   * @return {string} 日志级别对应的颜色样式
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.INFO:
        return this.config.colors.info;
      case LogLevel.WARN:
        return this.config.colors.warn;
      case LogLevel.ERROR:
        return this.config.colors.error;
      default:
        return this.config.colors.info;
    }
  }

  /**
   * @description: 获取日志各个部分
   * @function getParts
   * @property {string} prefix - 日志前缀
   * @property {string} timestamp - 日志时间戳
   * @returns {Object} 日志各个部分
   */
  private getParts(): { prefix: string, timestamp: string } {
    const timestamp = this.config.showTimestamp ? `[${this.getTimestamp()}]` : '';
    return {
      prefix: this.config.prefix,
      timestamp
    };
  }


  /**
   * @description: 格式化日志消息
   * @function formatMessage
   * @param message 日志消息
   * @return {string} 格式化后的日志消息
   */
  private formatMessage(message: string): string {
    const { prefix, timestamp } = this.getParts();
    return `${timestamp ? timestamp + ' ' : ''}${prefix} ${message}`;
  }

  /**
   * @description 获取当前时间戳字符串
   * @function getTimestamp
   * @param {string} 格式化后的时间戳
   * @return {string} 当前时间戳字符串
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString();
  }

  /**
   * @description: 判断是否应该记录日志
   * @param level 目标日志级别
   * @return {boolean} 是否应该记录日志
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    
    const levels = [LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const targetLevelIndex = levels.indexOf(level);
    
    // 只输出大于等于当前设置级别的日志
    return targetLevelIndex >= currentLevelIndex;
  }
}

export const logger = Logger.getInstance();