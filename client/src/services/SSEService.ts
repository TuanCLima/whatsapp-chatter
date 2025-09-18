import { API_BASE_URL } from '@/config/api'

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

interface ConnectionNotification {
  type: 'connected'
  clientId: string
}

type NotificationData =
  | MessageNotification
  | ContactUpdateNotification
  | ConnectionNotification

type MessageEventHandler = (notification: MessageNotification) => void
type ContactEventHandler = (notification: ContactUpdateNotification) => void
type ConnectionEventHandler = (notification: ConnectionNotification) => void

class SSEService {
  private eventSource: EventSource | null = null
  private clientId: string | null = null
  private isConnected = false
  private messageHandlers: MessageEventHandler[] = []
  private contactHandlers: ContactEventHandler[] = []
  private connectionHandlers: ConnectionEventHandler[] = []
  private subscribedPhoneNumbers: Set<string> = new Set()

  connect(userId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.eventSource) {
        this.disconnect()
      }

      const url = new URL(`${API_BASE_URL}/api/sse/events`)
      if (userId) {
        url.searchParams.append('userId', userId)
      }

      this.eventSource = new EventSource(url.toString())

      this.eventSource.onopen = () => {
        console.log('SSE connection opened')
        this.isConnected = true
      }

      this.eventSource.onmessage = (event) => {
        try {
          const data: NotificationData = JSON.parse(event.data)
          this.handleNotification(data)

          if (data.type === 'connected') {
            this.clientId = data.clientId
            resolve(data.clientId)
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error)
        }
      }

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        this.isConnected = false

        if (!this.clientId) {
          reject(error)
        }

        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (!this.isConnected) {
            console.log('Attempting to reconnect SSE...')
            this.connect(userId)
          }
        }, 3000)
      }

      // Timeout if connection takes too long
      setTimeout(() => {
        if (!this.clientId) {
          reject(new Error('SSE connection timeout'))
        }
      }, 10000)
    })
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
      this.isConnected = false
      this.clientId = null
      this.subscribedPhoneNumbers.clear()
      console.log('SSE connection closed')
    }
  }

  async subscribeToPhoneNumber(phoneNumber: string): Promise<void> {
    if (!this.clientId) {
      throw new Error('Not connected to SSE')
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/sse/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: this.clientId,
          phoneNumber,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to subscribe to phone number')
      }

      this.subscribedPhoneNumbers.add(phoneNumber)
      console.log(`Subscribed to phone number: ${phoneNumber}`)
    } catch (error) {
      console.error('Error subscribing to phone number:', error)
      throw error
    }
  }

  async unsubscribeFromPhoneNumber(phoneNumber: string): Promise<void> {
    if (!this.clientId) {
      throw new Error('Not connected to SSE')
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/sse/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: this.clientId,
          phoneNumber: phoneNumber,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to unsubscribe from phone number')
      }

      this.subscribedPhoneNumbers.delete(phoneNumber)
      console.log(`Unsubscribed from phone number: ${phoneNumber}`)
    } catch (error) {
      console.error('Error unsubscribing from phone number:', error)
      throw error
    }
  }

  onMessage(handler: MessageEventHandler) {
    this.messageHandlers.push(handler)
    return () => {
      const index = this.messageHandlers.indexOf(handler)
      if (index > -1) {
        this.messageHandlers.splice(index, 1)
      }
    }
  }

  onContactUpdate(handler: ContactEventHandler) {
    this.contactHandlers.push(handler)
    return () => {
      const index = this.contactHandlers.indexOf(handler)
      if (index > -1) {
        this.contactHandlers.splice(index, 1)
      }
    }
  }

  onConnection(handler: ConnectionEventHandler) {
    this.connectionHandlers.push(handler)
    return () => {
      const index = this.connectionHandlers.indexOf(handler)
      if (index > -1) {
        this.connectionHandlers.splice(index, 1)
      }
    }
  }

  private handleNotification(data: NotificationData) {
    switch (data.type) {
      case 'new_message':
        this.messageHandlers.forEach((handler) => handler(data))
        break
      case 'contact_update':
        this.contactHandlers.forEach((handler) => handler(data))
        break
      case 'connected':
        this.connectionHandlers.forEach((handler) => handler(data))
        break
      default:
        console.warn('Unknown notification type:', data)
    }
  }

  get connected(): boolean {
    return this.isConnected
  }

  get getClientId(): string | null {
    return this.clientId
  }
}

// Export singleton instance
export const sseService = new SSEService()
