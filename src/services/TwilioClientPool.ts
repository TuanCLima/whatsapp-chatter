import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { LRUCache } from 'lru-cache'
import Twilio from 'twilio'
import { db } from '../db'
import { saasUsers } from '../db/schema-postgres'

interface UserTwilioCredentials {
  accountSid: string
  authToken: string
  whatsappNumber: string
  userId: string
}

class TwilioClientPool {
  private clients = new LRUCache<string, ReturnType<typeof Twilio>>({
    max: 100, // Maximum number of cached clients
    ttl: 1000 * 60 * 60, // 1 hour TTL
  })

  private credentials = new LRUCache<string, UserTwilioCredentials>({
    max: 100,
    ttl: 1000 * 60 * 30, // 30 minutes TTL for credentials
  })

  private encryptionKey =
    process.env.ENCRYPTION_KEY || 'default-key-chat-webhook'

  private encrypt(text: string): string {
    const algorithm = 'aes-256-gcm'
    const iv = crypto.randomBytes(16)
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32)
    const cipher = crypto.createCipheriv(algorithm, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }

  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-gcm'
    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32)
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  async getClient(userId: string): Promise<ReturnType<typeof Twilio>> {
    let client = this.clients.get(userId)

    if (!client) {
      const credentials = await this.getUserCredentials(userId)
      client = Twilio(credentials.accountSid, credentials.authToken)
      this.clients.set(userId, client)
    }

    return client
  }

  async getPhoneNumberInfo(userId: string): Promise<string> {
    const credentials = await this.getUserCredentials(userId)
    return credentials.whatsappNumber
  }

  async getClientByWebhookPath(webhookPath: string): Promise<{
    client: ReturnType<typeof Twilio>
    credentials: UserTwilioCredentials
  }> {
    // Find user by webhook path
    const user = await db
      .select()
      .from(saasUsers)
      .where(eq(saasUsers.webhookPath, webhookPath))
      .limit(1)

    if (!user.length) {
      throw new Error('User not found for webhook path')
    }

    const credentials = await this.getUserCredentials(user[0].id)
    const client = await this.getClient(user[0].id)

    return { client, credentials }
  }

  private async getUserCredentials(
    userId: string,
  ): Promise<UserTwilioCredentials> {
    // Check cache first
    let credentials = this.credentials.get(userId)

    if (!credentials) {
      // Fetch from database
      const user = await db
        .select()
        .from(saasUsers)
        .where(eq(saasUsers.id, userId))
        .limit(1)

      if (!user.length) {
        throw new Error('User not found')
      }

      const userData = user[0]

      if (
        !userData.twilioAccountSid ||
        !userData.twilioAuthToken ||
        !userData.twilioWhatsappNumber
      ) {
        throw new Error('Twilio credentials not configured for user')
      }

      credentials = {
        accountSid: userData.twilioAccountSid,
        authToken: this.decrypt(userData.twilioAuthToken),
        whatsappNumber: userData.twilioWhatsappNumber,
        userId: userData.id,
      }

      this.credentials.set(userId, credentials)
    }

    return credentials
  }

  async saveUserCredentials(
    userId: string,
    accountSid: string,
    authToken: string,
    whatsappNumber: string,
  ): Promise<void> {
    const encryptedAuthToken = this.encrypt(authToken)

    await db
      .update(saasUsers)
      .set({
        twilioAccountSid: accountSid,
        twilioAuthToken: encryptedAuthToken,
        twilioWhatsappNumber: whatsappNumber,
        updatedAt: new Date(),
      })
      .where(eq(saasUsers.id, userId))

    // Invalidate cache
    this.invalidateUser(userId)
  }

  async validateCredentials(
    accountSid: string,
    authToken: string,
  ): Promise<boolean> {
    try {
      const client = Twilio(accountSid, authToken)
      // Test the credentials by making a simple API call
      await client.api.accounts(accountSid).fetch()
      return true
    } catch (error) {
      console.error('Twilio credential validation failed:', error)
      return false
    }
  }

  // Method to invalidate cache when user updates credentials
  invalidateUser(userId: string): void {
    this.clients.delete(userId)
    this.credentials.delete(userId)
  }

  // Get user ID from webhook path
  async getUserIdFromWebhookPath(webhookPath: string): Promise<string | null> {
    const user = await db
      .select({ id: saasUsers.id })
      .from(saasUsers)
      .where(eq(saasUsers.webhookPath, webhookPath))
      .limit(1)

    return user.length > 0 ? user[0].id : null
  }
}

export const twilioClientPool = new TwilioClientPool()
