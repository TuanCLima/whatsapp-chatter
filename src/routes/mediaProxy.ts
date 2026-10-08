import { eq } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { db } from '../db'
import { messages, saasUsers } from '../db/schema-postgres'
import { twilioClientPool } from '../services/TwilioClientPool'
import { logError, webhookLogger } from '../utils/logger'

/**
 * Proxy media requests through Twilio authentication
 * GET /api/media/:messageSid/:mediaSid
 */
export async function getMedia(req: Request, res: Response) {
  const { messageSid, mediaSid } = req.params

  try {
    // Find the message to get the phone number and determine which SaaS user
    const message = await db
      .select()
      .from(messages)
      .where(eq(messages.messageSid, messageSid))
      .limit(1)

    if (!message.length) {
      res.status(404).json({ error: 'Message not found' })
      return
    }

    // Get SaaS user from phone number (you may need to adjust this based on your schema)
    // For now, we'll use the first SaaS user as a fallback
    const allSaasUsers = await db.select().from(saasUsers).limit(1)

    if (!allSaasUsers.length) {
      res.status(404).json({ error: 'No SaaS user found' })
      return
    }

    // Get authenticated Twilio client
    const { client } = await twilioClientPool.getClientBySaasUserId(
      allSaasUsers[0].id,
    )

    // Fetch media from Twilio
    // In the future, if hardcoding certain parts of the URL is an issue, use full URL from message metadata
    const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${client.accountSid}/Messages/${messageSid}/Media/${mediaSid}`

    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${client.accountSid}:${client.password}`).toString('base64')}`,
      },
    })

    if (!response.ok) {
      webhookLogger.error(
        { messageSid, mediaSid, status: response.status },
        'Failed to fetch media from Twilio',
      )
      res.status(response.status).json({ error: 'Failed to fetch media' })
      return
    }

    // Get content type from response
    const contentType =
      response.headers.get('content-type') || 'application/octet-stream'

    // Stream the media to the client
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000')

    const buffer = await response.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (error) {
    logError(webhookLogger, error, {
      context: 'media_proxy',
      messageSid,
      mediaSid,
    })
    res.status(500).json({ error: 'Internal server error' })
  }
}
