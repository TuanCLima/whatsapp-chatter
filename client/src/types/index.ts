export type Maybe<T> = T | undefined | null

export interface Contact {
  id: string
  name: string
  avatar: string
  phoneNumber?: string
  conversationDisabled?: boolean
  lastMessage?: {
    text: string
    timestamp: string
    status: 'sent' | 'delivered' | 'read'
    unread?: number
  }
  online?: boolean
  typing?: boolean
}

export interface Message {
  id: string
  text: string
  sender: string
  timestamp: string
  status?: 'sent' | 'delivered' | 'read'
  isMedia?: boolean
  mediaUrl?: string
  mediaType?: 'image' | 'document' | 'audio'
  isForwardedContact?: boolean
}

export interface Conversation {
  id: string
  contactId: string
  messages: Message[]
}

export interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  name: string
}
