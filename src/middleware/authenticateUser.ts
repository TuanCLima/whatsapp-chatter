import type express from 'express'
import { authService } from '../services/AuthService'

export const authenticateUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    // Accept token from Authorization header, HttpOnly cookie, or query param for flexibility
    const authHeader = req.headers.authorization
    const cookieToken = req.cookies?.auth_token as string | undefined
    const queryToken = (req.query?.t || req.query?.token) as string | undefined
    const presentedToken =
      (authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : undefined) ||
      cookieToken ||
      queryToken

    if (!presentedToken) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    // Use AuthService to verify token
    const user = await authService.verifyToken(presentedToken)

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    console.log('Authenticating user:', user.email)

    // Add user info to request for use in next middleware
    req.user = {
      userId: user.id,
      role: user.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({ error: 'Authentication failed' })
  }
}
