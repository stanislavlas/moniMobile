/**
 * Centralized logging utility for debugging
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.info('component', 'User logged in', { userId: '123' });
 *   logger.error('api', 'Request failed', error);
 *
 * To disable logs in production, set ENABLE_DEBUG_LOGS to false
 */

const ENABLE_DEBUG_LOGS = true; // Set to false to disable all debug logs

const LOG_COLORS = {
  auth: '🔐',
  api: '🌐',
  storage: '💾',
  ui: '🎨',
  network: '📡',
  data: '📊',
  household: '🏠',
  categories: '🏷️',
  entries: '📝',
  error: '🔴',
  warning: '⚠️',
  success: '✅',
  info: 'ℹ️',
};

class Logger {
  constructor() {
    this.enabled = ENABLE_DEBUG_LOGS;
  }

  _log(level, category, message, data) {
    if (!this.enabled) return;

    const icon = LOG_COLORS[category] || LOG_COLORS[level] || '📌';
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS

    if (data !== undefined) {
      console[level](`[${timestamp}] ${icon} ${category}: ${message}`, data);
    } else {
      console[level](`[${timestamp}] ${icon} ${category}: ${message}`);
    }
  }

  info(category, message, data) {
    this._log('log', category, message, data);
  }

  error(category, message, data) {
    this._log('error', category, message, data);
  }

  warn(category, message, data) {
    this._log('warn', category, message, data);
  }

  debug(category, message, data) {
    this._log('log', category, message, data);
  }

  // Convenience methods for common categories
  auth(message, data) {
    this.info('auth', message, data);
  }

  api(message, data) {
    this.info('api', message, data);
  }

  network(message, data) {
    this.info('network', message, data);
  }

  ui(message, data) {
    this.info('ui', message, data);
  }

  // Log section separators for better readability
  section(title) {
    if (!this.enabled) return;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  ${title}`);
    console.log(`${'='.repeat(50)}\n`);
  }

  // Log method call with timing
  async timed(category, operationName, fn) {
    const startTime = Date.now();
    this.info(category, `${operationName} started`);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.info(category, `${operationName} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(category, `${operationName} failed after ${duration}ms`, error.message);
      throw error;
    }
  }
}

export const logger = new Logger();

// Export convenience function to enable/disable logs at runtime
export function setLoggingEnabled(enabled) {
  logger.enabled = enabled;
}
