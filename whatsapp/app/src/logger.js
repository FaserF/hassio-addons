import pino from 'pino';

// --- Log Level ---
const RAW_LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVEL_MAP = {
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  notice: 'info',
  warning: 'warn',
  error: 'error',
  fatal: 'fatal',
};
const LOG_LEVEL = LOG_LEVEL_MAP[RAW_LOG_LEVEL.toLowerCase()] || 'info';

// --- Global Logger ---
export const logger = pino({
  level: LOG_LEVEL,
  base: null, // Remove pid/hostname for cleaner logs
});

logger.info(`📝 Log Level set to: ${LOG_LEVEL} (from: ${RAW_LOG_LEVEL})`);
export { LOG_LEVEL, RAW_LOG_LEVEL };
