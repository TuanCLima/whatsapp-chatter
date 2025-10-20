import { createContext, useContext } from 'react'
import type { Contact, Conversation, Maybe } from '@/types'

interface ChatContextType {
  contacts: Contact[]
  conversation: Maybe<Conversation>
  activeContactId: string | null
  setActiveContactId: (id: string | null) => void
  sendMessage: (text: string) => void
  searchContacts: (query: string) => void
  filteredContacts: Contact[]
  toggleConversation: (phoneNumber: string, disabled: boolean) => void
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
