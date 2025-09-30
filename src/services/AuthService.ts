import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import {
  type InsertSaasUser,
  type SaasUser,
  saasUsers,
} from '../db/schema-postgres'

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
  async createUser(userData: CreateUserData): Promise<SaasUser> {
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

    const newUser: InsertSaasUser = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash,
      role,
      webhookPath: null, // No longer using dynamic webhook paths
      subscriptionStatus: 'trial',
    }

    const insertedUsers = await db.insert(saasUsers).values(newUser).returning()
    return insertedUsers[0]
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await db
      .select()
      .from(saasUsers)
      .where(eq(saasUsers.email, email))
      .limit(1)

    if (!user.length) {
      throw new Error('Invalid credentials')
    }

    const userData = user[0]
    const isValidPassword = await bcrypt.compare(
      password,
      userData.passwordHash,
    )

    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

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
