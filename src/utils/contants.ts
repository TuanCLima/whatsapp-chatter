export const DEPLOYMENT_URL = process.env.DEPLOYMENT_URL || ''

export const FRONTEND_LOCALHOST = 'http://localhost:5173'

export const IS_DEV = process.env.NODE_ENV === 'development'

export const FALLBACK_PROMPT =
  "You are a helpful AI assistant that helps people find information. But right now the system is down, so you can only respond with (translated to the language of the request) 'Sorry, the system is currently down. Please try again later, but follow the language in which you are spoken to.'"
