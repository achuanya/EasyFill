/**
 * @description: 提供统一的日志记录功能，支持三个日志级别和颜色输出。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2025-4-10
 */

// 定义日志级别枚举
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// 定义日志颜色
interface LogColors {
  info: string;
  warn: string;
  error: string;
  prefix: string;
  timestamp: string;
}

// 日志配置接口
interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  enabled: boolean;
  useColors: boolean;
  showTimestamp: boolean;
  colors: LogColors;
}

// 默认颜色配置
const DEFAULT_COLORS: LogColors = {
  info: 'color: #2196F3; font-weight: normal',
  warn: 'color: #FF9800; font-weight: bold',
  error: 'color: #F44336; font-weight: bold',
  prefix: 'color: #4CAF50; font-weight: bold',
  timestamp: 'color: #9E9E9E; font-weight: normal',
};

/**
 * 日志系统类
 * 提供三个级别的日志记录功能：INFO, WARN, ERROR
 * 支持彩色输出和时间戳
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    prefix: '[EasyFill]',
    enabled: true,
    useColors: true,
    showTimestamp: true,
    colors: { ...DEFAULT_COLORS },
  };

  /**
   * 根据环境变量配置日志系统
   */
  private constructor() {
      this.configureByEnvironment();
  }

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
   * 根据环境变量配置日志系统
   */
  public configureByEnvironment(): Logger {
    const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
    
    if (isProd) {
      // 生产环境：只显示警告和错误
      this.setLevel(LogLevel.WARN);
    } else {
      // 开发环境：显示所有日志，并启用彩色和时间戳
      this.setLevel(LogLevel.INFO)
          .useColors(true)
          .showTimestamp(true);
      
      // 在开发环境下输出初始化信息（但避免在构造函数中调用info方法造成递归）
      setTimeout(() => {
        this.info('已自动启用开发环境日志配置');
      }, 0);
    }
    
    return this;
  }

  /**
   * 设置日志级别
   * @param level 日志级别
   */
  public setLevel(level: LogLevel): Logger {
    this.config.level = level;
    return this;
  }

  /**
   * 启用或禁用日志输出
   * @param enabled 是否启用
   */
  public setEnabled(enabled: boolean): Logger {
    this.config.enabled = enabled;
    return this;
  }

  /**
   * 设置日志前缀
   * @param prefix 日志前缀
   */
  public setPrefix(prefix: string): Logger {
    this.config.prefix = prefix;
    return this;
  }

  /**
   * 启用或禁用彩色输出
   * @param useColors 是否启用彩色输出
   */
  public useColors(useColors: boolean): Logger {
    this.config.useColors = useColors;
    return this;
  }

  /**
   * 启用或禁用时间戳
   * @param show 是否显示时间戳
   */
  public showTimestamp(show: boolean): Logger {
    this.config.showTimestamp = show;
    return this;
  }

  /**
   * 设置指定级别的日志颜色
   * @param level 日志级别
   * @param colorStyle CSS 颜色样式
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
   * 设置前缀颜色
   * @param colorStyle CSS 颜色样式
   */
  public setPrefixColor(colorStyle: string): Logger {
    this.config.colors.prefix = colorStyle;
    return this;
  }

  /**
   * 设置时间戳颜色
   * @param colorStyle CSS 颜色样式
   */
  public setTimestampColor(colorStyle: string): Logger {
    this.config.colors.timestamp = colorStyle;
    return this;
  }

  /**
   * 记录 INFO 级别日志
   * @param message 日志消息
   * @param args 附加参数
   */
  public info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      if (this.config.useColors) {
        this.logWithColors(LogLevel.INFO, message, ...args);
      } else {
        console.log(this.formatMessage(message), ...args);
      }
    }
  }

  /**
   * 记录 WARN 级别日志
   * @param message 日志消息
   * @param args 附加参数
   */
  public warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      if (this.config.useColors) {
        this.logWithColors(LogLevel.WARN, message, ...args);
      } else {
        console.warn(this.formatMessage(message), ...args);
      }
    }
  }

  /**
   * 记录 ERROR 级别日志
   * @param message 日志消息
   * @param args 附加参数
   */
  public error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      if (this.config.useColors) {
        this.logWithColors(LogLevel.ERROR, message, ...args);
      } else {
        console.error(this.formatMessage(message), ...args);
      }
    }
  }

  /**
   * 使用颜色输出日志
   * @param level 日志级别
   * @param message 日志消息
   * @param args 附加参数
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
   * 获取指定级别的颜色样式
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
   * 获取日志的各个部分（前缀、时间戳）
   */
  private getParts(): { prefix: string, timestamp: string } {
    const timestamp = this.config.showTimestamp ? `[${this.getTimestamp()}]` : '';
    return {
      prefix: this.config.prefix,
      timestamp
    };
  }

  /**
   * 生成无颜色的格式化消息
   */
  private formatMessage(message: string): string {
    const { prefix, timestamp } = this.getParts();
    return `${timestamp ? timestamp + ' ' : ''}${prefix} ${message}`;
  }

  /**
   * 获取当前时间戳
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString();
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

export const logger = Logger.getInstance();