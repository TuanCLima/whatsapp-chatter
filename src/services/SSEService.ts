import type { Response } from 'express'

interface SSEClient {
  id: string
  response: Response
  userId?: string
  phoneNumber?: string
}

interface MessageNotification {
  type: 'new_message'
  phoneNumber: string
  message: {
    id: string
    content: string
    role: 'user' | 'assistant'
    timestamp: string
    profileName?: string
  }
}

interface ContactUpdateNotification {
  type: 'contact_update'
  phoneNumber: string
  profileName?: string
}

type NotificationData = MessageNotification | ContactUpdateNotification

class SSEService {
  private clients: Map<string, SSEClient> = new Map()
  private phoneNumberToClients: Map<string, Set<string>> = new Map()

  addClient(clientId: string, response: Response, userId?: string) {
    // Set SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    // Send initial connection confirmation
    response.write(`data: {"type":"connected","clientId":"${clientId}"}\n\n`)

    const client: SSEClient = {
      id: clientId,
      response,
      userId,
    }

    this.clients.set(clientId, client)

    // Handle client disconnect
    response.on('close', () => {
      this.removeClient(clientId)
    })

    response.on('error', (error) => {
      console.error('SSE client error:', error)
      this.removeClient(clientId)
    })

    console.log(`SSE client connected: ${clientId}`)
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId)
    if (client) {
      // Remove from phone number mapping
      this.phoneNumberToClients.forEach((clientSet, phoneNumber) => {
        clientSet.delete(clientId)
        if (clientSet.size === 0) {
          this.phoneNumberToClients.delete(phoneNumber)
        }
      })

      this.clients.delete(clientId)
      console.log(`SSE client disconnected: ${clientId}`)
    }
  }

  subscribeToPhoneNumber(clientId: string, phoneNumber: string) {
    const client = this.clients.get(clientId)
    if (!client) return

    client.phoneNumber = phoneNumber

    if (!this.phoneNumberToClients.has(phoneNumber)) {
      this.phoneNumberToClients.set(phoneNumber, new Set())
    }
    this.phoneNumberToClients.get(phoneNumber)!.add(clientId)
  }

  unsubscribeFromPhoneNumber(clientId: string, phoneNumber: string) {
    const clientSet = this.phoneNumberToClients.get(phoneNumber)
    if (clientSet) {
      clientSet.delete(clientId)
      if (clientSet.size === 0) {
        this.phoneNumberToClients.delete(phoneNumber)
      }
    }

    const client = this.clients.get(clientId)
    if (client && client.phoneNumber === phoneNumber) {
      client.phoneNumber = undefined
    }
  }

  broadcastToPhoneNumber(phoneNumber: string, data: NotificationData) {
    const clientSet = this.phoneNumberToClients.get(phoneNumber)
    if (!clientSet || clientSet.size === 0) {
      console.log(`No SSE clients subscribed to phone number: ${phoneNumber}`)
      return
    }

    const message = `data: ${JSON.stringify(data)}\n\n`

    clientSet.forEach((clientId) => {
      const client = this.clients.get(clientId)
      if (client && !client.response.destroyed) {
        try {
          client.response.write(message)
        } catch (error) {
          console.error('Error writing to SSE client:', error)
          this.removeClient(clientId)
        }
      } else {
        this.removeClient(clientId)
      }
    })

    console.log(
      `Broadcasted message to ${clientSet.size} clients for phone: ${phoneNumber}`,
    )
  }

  broadcastToAll(data: NotificationData) {
    const message = `data: ${JSON.stringify(data)}\n\n`

    this.clients.forEach((client, clientId) => {
      if (!client.response.destroyed) {
        try {
          client.response.write(message)
        } catch (error) {
          console.error('Error writing to SSE client:', error)
          this.removeClient(clientId)
        }
      } else {
        this.removeClient(clientId)
      }
    })

    console.log(`Broadcasted message to ${this.clients.size} clients`)
  }

  // Notify about new message
  notifyNewMessage(
    phoneNumber: string,
    message: MessageNotification['message'],
  ) {
    this.broadcastToPhoneNumber(phoneNumber, {
      type: 'new_message',
      phoneNumber,
      message,
    })
  }

  // Notify about contact updates
  notifyContactUpdate(phoneNumber: string, profileName?: string) {
    this.broadcastToPhoneNumber(phoneNumber, {
      type: 'contact_update',
      phoneNumber,
      profileName,
    })
  }

  getClientCount(): number {
    return this.clients.size
  }

  getSubscriptionCount(): number {
    return this.phoneNumberToClients.size
  }
}

export const sseService = new SSEService()
