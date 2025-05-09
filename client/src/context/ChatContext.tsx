import { createContext, useContext } from 'react';
import { Contact, Conversation, Maybe } from '@/types';
interface ChatContextType {
  contacts: Contact[];
  conversations: Conversation[];
  conversation: Maybe<Conversation>;
  activeContactId: string | null;
  setActiveContactId: (id: string | null) => void;
  sendMessage: (text: string) => void;
  searchContacts: (query: string) => void;
  filteredContacts: Contact[];
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}