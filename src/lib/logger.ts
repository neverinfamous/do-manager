/**
 * Centralized logger utility for do-manager
 *
 * Provides structured logging with consistent formatting across the application.
 * Uses console methods internally but provides a single point of control for
 * logging behavior, making it ESLint-compliant and easier to modify.
 */

interface LogContext {
  module?: string;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Format log message with optional context
 */
function formatMessage(message: string, context?: LogContext): string {
  if (!context) return message;

  const { module, operation, ...rest } = context;
  const prefix = module ? `[${module}]` : "";
  const op = operation ? ` ${operation}:` : "";
  const contextStr =
    Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";

  return `${prefix}${op} ${message}${contextStr}`;
}

/**
 * Logger singleton with methods for each log level
 */
export const logger = {
  /**
   * Log error message - for application errors and exceptions
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const formattedMessage = formatMessage(message, context);
    if (error instanceof Error) {
      console.error(formattedMessage, error);
    } else if (error !== undefined) {
      console.error(formattedMessage, error);
    } else {
      console.error(formattedMessage);
    }
  },

  /**
   * Log warning message - for non-critical issues
   */
  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage(message, context));
  },

  /**
   * Log info message - for general application flow
   */
  info(message: string, context?: LogContext): void {
    console.info(formatMessage(message, context));
  },

  /**
   * Log debug message - for development debugging
   */
  debug(message: string, context?: LogContext): void {
    console.debug(formatMessage(message, context));
  },

  /**
   * Create a scoped logger with a preset module name
   */
  scope(module: string): {
    error: (message: string, error?: unknown, context?: LogContext) => void;
    warn: (message: string, context?: LogContext) => void;
    info: (message: string, context?: LogContext) => void;
    debug: (message: string, context?: LogContext) => void;
  } {
    return {
      error: (message: string, error?: unknown, context?: LogContext) =>
        logger.error(message, error, { module, ...context }),
      warn: (message: string, context?: LogContext) =>
        logger.warn(message, { module, ...context }),
      info: (message: string, context?: LogContext) =>
        logger.info(message, { module, ...context }),
      debug: (message: string, context?: LogContext) =>
        logger.debug(message, { module, ...context }),
    };
  },
};
