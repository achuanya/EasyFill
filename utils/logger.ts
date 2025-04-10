/**
 * @description: 提供统一的日志记录功能，支持三个日志级别。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2025-4-10
 */

// 定义日志级别枚举
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// 日志配置接口
interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  enabled: boolean;
}

/**
 * 日志系统类
 * 提供三个级别的日志记录功能：INFO, WARN, ERROR
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig = {
    level: LogLevel.INFO, // 默认级别为 INFO
    prefix: '[EasyFill]', // 默认前缀
    enabled: true,       // 默认启用日志
  };

  private constructor() {}

  /**
   * 获取日志系统单例
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 设置日志级别
   * @param level 日志级别
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 启用或禁用日志输出
   * @param enabled 是否启用
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 设置日志前缀
   * @param prefix 日志前缀
   */
  public setPrefix(prefix: string): void {
    this.config.prefix = prefix;
  }

  /**
   * 记录 INFO 级别日志
   * @param message 日志消息
   * @param args 附加参数
   */
  public info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`${this.config.prefix} ${message}`, ...args);
    }
  }

  /**
   * 记录 WARN 级别日志
   * @param message 日志消息
   * @param args 附加参数
   */
  public warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`${this.config.prefix} ${message}`, ...args);
    }
  }

  /**
   * 记录 ERROR 级别日志
   * @param message 日志消息
   * @param args 附加参数
   */
  public error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`${this.config.prefix} ${message}`, ...args);
    }
  }

  /**
   * 判断是否应该记录指定级别的日志
   * @param level 目标日志级别
   * @returns 是否应该记录
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

// 导出日志系统单例，方便其他文件直接使用
export const logger = Logger.getInstance();