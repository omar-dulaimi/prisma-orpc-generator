import chalk from 'chalk';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Note: enum members are used in the class methods below

type LoggableValue = string | number | boolean | null | undefined | object | unknown;

export class Logger {
  private level: LogLevel;

  constructor(enableDebugLogging: boolean = false) {
    this.level = this.resolveLevel(enableDebugLogging);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private resolveLevel(enableDebugLogging: boolean): LogLevel {
    // Env-based overrides (quiet by default unless explicitly enabled)
    const raw = (process.env.ORPC_LOG_LEVEL || process.env.ORPC_LOG || '').toString().toLowerCase();
    const dbg = (process.env.ORPC_DEBUG || process.env.DEBUG || '').toString().toLowerCase();

    if (raw) {
      switch (raw) {
        case 'silent':
        case 'none':
          return (LogLevel.ERROR - 1) as LogLevel; // below ERROR = effectively silent for this logger
        case 'error':
          return LogLevel.ERROR;
        case 'warn':
        case 'warning':
          return LogLevel.WARN;
        case 'info':
          return LogLevel.INFO;
        case 'debug':
          return LogLevel.DEBUG;
        case '1':
        case 'true':
          return LogLevel.INFO; // ORPC_LOG=1 enables info
        default:
          break;
      }
    }

    if (dbg.includes('orpc')) return LogLevel.DEBUG;
    if (enableDebugLogging) return LogLevel.DEBUG;

    // Default: be quiet (only errors)
    return LogLevel.ERROR;
  }

  error(message: string, ...args: LoggableValue[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(chalk.red('❌ [ERROR]'), message, ...args);
    }
  }

  warn(message: string, ...args: LoggableValue[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(chalk.yellow('⚠️  [WARN]'), message, ...args);
    }
  }

  info(message: string, ...args: LoggableValue[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log(chalk.blue('ℹ️  [INFO]'), message, ...args);
    }
  }

  debug(message: string, ...args: LoggableValue[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(chalk.gray('🐛 [DEBUG]'), message, ...args);
    }
  }

  success(message: string, ...args: LoggableValue[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log(chalk.green('✅ [SUCCESS]'), message, ...args);
    }
  }

  // Special formatting methods
  logGenerationStart(feature: string): void {
    this.info(chalk.cyan(`🚀 Generating ${feature}...`));
  }

  logGenerationComplete(feature: string, duration?: number): void {
    const durationText = duration ? ` (${duration}ms)` : '';
    this.success(chalk.green(`✨ ${feature} generated${durationText}`));
  }

  logStats(stats: Record<string, LoggableValue>): void {
    this.info(chalk.cyan('📊 Generation Statistics:'));
    Object.entries(stats).forEach(([key, value]) => {
      this.info(chalk.gray(`   ${key}: ${value}`));
    });
  }

  // Pretty print JSON objects
  logObject(label: string, obj: Record<string, LoggableValue> | LoggableValue): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(chalk.blue(`🔍 [${label}]`));
      console.log(JSON.stringify(obj, null, 2));
    }
  }

  // Progress tracking
  logProgress(current: number, total: number, item?: string): void {
    const percentage = Math.round((current / total) * 100);
    const itemText = item ? ` (${item})` : '';
    this.info(chalk.cyan(`⏳ Progress: ${current}/${total} (${percentage}%)${itemText}`));
  }

  // Error with suggestions
  errorWithSuggestion(message: string, suggestion: string): void {
    this.error(message);
    console.log(chalk.yellow('💡 Suggestion:'), suggestion);
  }

  // Performance timing
  private timers: Map<string, number> = new Map();

  startTimer(label: string): void {
    this.timers.set(label, Date.now());
    this.debug(`⏱️  Started timer: ${label}`);
  }

  endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      this.warn(`Timer '${label}' was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);
    this.debug(`⏱️  Timer '${label}' completed: ${duration}ms`);
    return duration;
  }

  // Box formatting for important messages
  logBox(title: string, content: string[]): void {
    const maxLength = Math.max(title.length, ...content.map((line) => line.length));
    const boxWidth = Math.max(50, maxLength + 4);

    const border = '═'.repeat(boxWidth - 2);
    const emptyLine = ' '.repeat(boxWidth - 2);

    console.log(chalk.cyan(`╔${border}╗`));
    console.log(
      chalk.cyan(
        `║${title.padStart((boxWidth - title.length) / 2 + title.length).padEnd(boxWidth - 2)}║`
      )
    );
    console.log(chalk.cyan(`║${emptyLine}║`));

    content.forEach((line) => {
      console.log(chalk.cyan(`║ ${line.padEnd(boxWidth - 4)} ║`));
    });

    console.log(chalk.cyan(`╚${border}╝`));
  }
}
