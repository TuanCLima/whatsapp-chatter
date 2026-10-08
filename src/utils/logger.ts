import type { Logger } from 'pino'
import pino from 'pino'

const IS_DEV = process.env.NODE_ENV === 'development'
const LOGFLARE_API_KEY = process.env.LOGFLARE_API_KEY
const LOGFLARE_SOURCE_TOKEN = process.env.LOGFLARE_SOURCE_TOKEN

// Determine if we should send logs to Logflare
const shouldUseLogflare = !IS_DEV && LOGFLARE_API_KEY && LOGFLARE_SOURCE_TOKEN

/**
 * Create a Pino logger instance configured for both development and production.
 *
 * In development:
 * - Uses pino-pretty for human-readable console output
 *
 * In production:
 * - Sends structured JSON logs to Logflare
 * - Falls back to console JSON if Logflare credentials are not configured
 */
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL || (IS_DEV ? 'debug' : 'info'),

  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'chat-webhook',
  },

  // Timestamp in ISO format
  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  // Transport configuration for development (pretty print) or production (Logflare)
  transport: IS_DEV
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : shouldUseLogflare
      ? {
          target: 'pino-logflare',
          options: {
            apiKey: LOGFLARE_API_KEY,
            sourceToken: LOGFLARE_SOURCE_TOKEN,
          },
        }
      : undefined, // Use default JSON output if no Logflare config
})

/**
 * Child logger for webhook operations
 */
export const webhookLogger = logger.child({ module: 'webhook' })

/**
 * Child logger for message processing operations
 */
export const messageLogger = logger.child({ module: 'messages' })

/**
 * Child logger for tool execution operations
 */
export const toolLogger = logger.child({ module: 'tools' })

/**
 * Child logger for Twilio operations
 */
export const twilioLogger = logger.child({ module: 'twilio' })

/**
 * Child logger for database operations
 */
export const dbLogger = logger.child({ module: 'database' })

/**
 * Log an error with context
 */
export function logError(
  logger: Logger,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const errorDetails = {
    ...context,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
  }

  logger.error(errorDetails, 'Error occurred')
}

// Log startup information
if (IS_DEV) {
  logger.info('Logger initialized in DEVELOPMENT mode with pino-pretty')
} else if (shouldUseLogflare) {
  logger.info('Logger initialized in PRODUCTION mode with Logflare transport')
} else {
  logger.warn(
    'Logger initialized in PRODUCTION mode without Logflare (missing API key or source token)',
  )
}
