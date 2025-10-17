import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import {
  type InsertSaasUser,
  type SaasUser,
  saasUsers,
} from '../db/schema-postgres'
import { EmailService } from './EmailService'

interface CreateUserData {
  email: string
  name: string
  password: string
  role?: 'admin' | 'user'
}

interface LoginResult {
  user: Omit<SaasUser, 'passwordHash' | 'twilioAuthToken'>
  token: string
}

export class AuthService {
  private emailService: EmailService

  constructor() {
    this.emailService = new EmailService()
  }

  async createUser(userData: CreateUserData): Promise<{
    user: SaasUser
    verificationEmailSent: boolean
  }> {
    const { email, name, password, role = 'user' } = userData

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(saasUsers)
      .where(eq(saasUsers.email, email))
      .limit(1)

    if (existingUser.length > 0) {
      throw new Error('User already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Generate verification token
    const verificationToken = this.emailService.generateVerificationToken()
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const newUser: InsertSaasUser = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash,
      role,
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry,
      lastVerificationEmailSent: new Date(),
      webhookPath: null,
      subscriptionStatus: 'trial',
    }

    const insertedUsers = await db.insert(saasUsers).values(newUser).returning()
    const user = insertedUsers[0]

    // Send verification email
    const emailResult = await this.emailService.sendVerificationEmail({
      email,
      name,
      verificationToken,
    })

    return {
      user,
      verificationEmailSent: emailResult.success,
    }
  }

  async verifyEmail(token: string): Promise<{
    success: boolean
    message: string
    user?: Omit<SaasUser, 'passwordHash' | 'twilioAuthToken'>
  }> {
    const user = await db
      .select()
      .from(saasUsers)
      .where(eq(saasUsers.verificationToken, token))
      .limit(1)

    if (!user.length) {
      return {
        success: false,
        message: 'Invalid verification token',
      }
    }

    const userData = user[0]

    if (userData.emailVerified) {
      return {
        success: false,
        message: 'Email already verified',
      }
    }

    if (
      !userData.verificationTokenExpiry ||
      userData.verificationTokenExpiry < new Date()
    ) {
      return {
        success: false,
        message: 'Verification token expired. Please request a new one.',
      }
    }

    // Update user as verified
    const updatedUsers = await db
      .update(saasUsers)
      .set({
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(saasUsers.id, userData.id))
      .returning()

    const updatedUser = updatedUsers[0]

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      updatedUser.email,
      updatedUser.name,
    )

    // Return user data without sensitive fields
    const {
      passwordHash: _,
      twilioAuthToken: __,
      ...safeUserData
    } = updatedUser

    return {
      success: true,
      message: 'Email verified successfully',
      user: safeUserData,
    }
  }

  async resendVerificationEmail(email: string): Promise<{
    success: boolean
    message: string
  }> {
    const user = await db
      .select()
      .from(saasUsers)
      .where(eq(saasUsers.email, email))
      .limit(1)

    if (!user.length) {
      return {
        success: false,
        message: 'User not found',
      }
    }

    const userData = user[0]

    if (userData.emailVerified) {
      return {
        success: false,
        message: 'Email already verified',
      }
    }

    // Rate limiting: don't allow resending within 1 minute
    if (
      userData.lastVerificationEmailSent &&
      Date.now() - userData.lastVerificationEmailSent.getTime() < 60000
    ) {
      return {
        success: false,
        message:
          'Please wait at least 1 minute before requesting another email',
      }
    }

    // Generate new verification token
    const verificationToken = this.emailService.generateVerificationToken()
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Update user with new token
    await db
      .update(saasUsers)
      .set({
        verificationToken,
        verificationTokenExpiry,
        lastVerificationEmailSent: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(saasUsers.id, userData.id))

    // Send verification email
    const emailResult = await this.emailService.sendVerificationEmail({
      email: userData.email,
      name: userData.name,
      verificationToken,
    })

    if (!emailResult.success) {
      return {
        success: false,
        message: emailResult.error || 'Failed to send verification email',
      }
    }

    return {
      success: true,
      message: 'Verification email sent successfully',
    }
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await db
      .select()
      .from(saasUsers)
      .where(eq(saasUsers.email, email))
      .limit(1)

    if (!user.length) {
      console.log('User not found:', email)
      throw new Error('Invalid credentials')
    }

    const userData = user[0]
    const isValidPassword = await bcrypt.compare(
      password,
      userData.passwordHash,
    )

    if (!isValidPassword) {
      console.log('Invalid password for user:', email)
      throw new Error('Invalid credentials')
    }

    // Check if email is verified
    // if (!userData.emailVerified) {
    //   throw new Error('Please verify your email before logging in')
    // }

    // Create token payload
    const tokenPayload = {
      userId: userData.id,
      email: userData.email,
      role: userData.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    }

    // Create simple base64 token (in production, use proper JWT)
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64')

    // Return user data without sensitive fields
    const { passwordHash: _, twilioAuthToken: __, ...safeUserData } = userData

    return {
      user: safeUserData,
      token,
    }
  }

  async verifyToken(token: string): Promise<SaasUser | null> {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString())

      if (payload.exp < Date.now()) {
        return null // Token expired
      }

      const user = await db
        .select()
        .from(saasUsers)
        .where(eq(saasUsers.id, payload.userId))
        .limit(1)

      return user.length > 0 ? user[0] : null
    } catch {
      return null
    }
  }

  async getUserById(userId: string): Promise<SaasUser | null> {
    const user = await db
      .select()
      .from(saasUsers)
      .where(eq(saasUsers.id, userId))
      .limit(1)

    return user.length > 0 ? user[0] : null
  }

  async updateUser(
    userId: string,
    updates: Partial<SaasUser>,
  ): Promise<SaasUser> {
    const updatedUsers = await db
      .update(saasUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(saasUsers.id, userId))
      .returning()

    if (!updatedUsers.length) {
      throw new Error('User not found')
    }

    return updatedUsers[0]
  }
}

export const authService = new AuthService()
