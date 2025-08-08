import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { API_BASE_URL } from '@/config/api'
import { userService } from '@/services/UserService'
import type { Contact, Conversation, Maybe } from '@/types'
import { ChatContext } from './ChatContext'

export function ChatProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient()

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/db/contacts`)
      if (!response.ok) {
        throw new Error('Error fetching contacts')
      }
      return response.json()
    },
  })
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const { data: conversation } = useQuery<Maybe<Conversation>>({
    queryKey: ['conversation', activeContactId],
    queryFn: async () => {
      if (!activeContactId) return []
      const response = await fetch(
        `${API_BASE_URL}/db/conversations/${activeContactId}`,
      )
      if (!response.ok) {
        throw new Error('Error fetching conversation')
      }
      return response.json()
    },
    enabled: !!activeContactId, // Only fetch when activeContactId is not null
  })

  const [conversations] = useState<Conversation[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>(contacts)

  useEffect(() => {
    setFilteredContacts(contacts)
  }, [contacts])

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      console.log('Sending message:', text, activeContactId)

      if (!activeContactId || !text.trim()) {
        throw new Error('No active contact or empty message')
      }

      const response = await fetch(`${API_BASE_URL}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: activeContactId,
          body: text,
        }),
      })

      if (!response.ok) {
        throw new Error('Error sending message')
      }

      return await response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch conversation data
      queryClient.invalidateQueries({
        queryKey: ['conversation', activeContactId],
      })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })

  const sendMessage = useCallback(
    (text: string) => {
      sendMessageMutation.mutate(text)
    },
    [sendMessageMutation],
  )

  const toggleConversationMutation = useMutation({
    mutationFn: async ({
      phoneNumber,
      disabled,
    }: {
      phoneNumber: string
      disabled: boolean
    }) => {
      return await userService.toggleConversation(phoneNumber, disabled)
    },
    onSuccess: () => {
      // Invalidate and refetch contacts to update the conversation status
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })

  const toggleConversation = useCallback(
    (phoneNumber: string, disabled: boolean) => {
      toggleConversationMutation.mutate({ phoneNumber, disabled })
    },
    [toggleConversationMutation],
  )

  return (
    <ChatContext.Provider
      value={useMemo(
        () => ({
          contacts,
          conversations,
          activeContactId,
          setActiveContactId,
          sendMessage,
          searchContacts: (query: string) => {
            if (!query) {
              setFilteredContacts(contacts)
              return
            }
            const filtered = contacts.filter((contact) =>
              contact.name.toLowerCase().includes(query.toLowerCase()),
            )
            setFilteredContacts(filtered)
          },
          filteredContacts,
          conversation,
          toggleConversation,
        }),
        [
          contacts,
          conversations,
          activeContactId,
          filteredContacts,
          conversation,
          sendMessage,
          toggleConversation,
        ],
      )}
    >
      {children}
    </ChatContext.Provider>
  )
}
