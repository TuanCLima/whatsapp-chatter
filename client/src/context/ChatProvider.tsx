import { Contact, Conversation, Maybe } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { ChatContext } from "./ChatContext";

export function ChatProvider({ children }: Readonly<{ children: ReactNode }>) {
    const { data: contacts = [] } = useQuery<Contact[]>({queryKey: ['contacts'], queryFn: async () => {
      const response = await fetch('http://localhost:3000/db/contacts');
      if (!response.ok) {
        throw new Error('Error fetching contacts');
      }
      return response.json();
    }});
    const [activeContactId, setActiveContactId] = useState<string | null>(null);
    const { data: conversation } = useQuery<Maybe<Conversation>>({
      queryKey: ['conversation', activeContactId],
      queryFn: async () => {
      if (!activeContactId) return [];
      const response = await fetch(`http://localhost:3000/db/conversations/${activeContactId}`);
      if (!response.ok) {
        throw new Error('Error fetching conversation');
      }
      return response.json();
      },
      enabled: !!activeContactId, // Only fetch when activeContactId is not null
    });
  
    
    
    const [conversations] = useState<Conversation[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>(contacts);
    
    useEffect(() => {
      setFilteredContacts(contacts);
    }, [contacts]);

   /*  const sendMessageMutation = useMutation(
      async (text: string) => {
        if (!activeContactId || !text.trim()) return;
  
        const response = await fetch('/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationSid: activeContactId,
            body: text,
          }),
        });
  
        if (!response.ok) {
          throw new Error('Error sending message');
        }
  
        return text;
      },
      {
        onSuccess: (text) => {
          const newMessage: Message = {
            id: Date.now().toString(),
            text,
            sender: 'user',
            timestamp: new Date().toISOString(),
            status: 'sent',
          };
  
          setConversations((prevConversations) => {
            const conversationIndex = prevConversations.findIndex(
              (conv) => conv.contactId === activeContactId
            );
  
            if (conversationIndex === -1) {
              return [
                ...prevConversations,
                {
                  id: Date.now().toString(),
                  contactId: activeContactId,
                  messages: [newMessage],
                },
              ];
            }
  
            const updatedConversations = [...prevConversations];
            updatedConversations[conversationIndex] = {
              ...updatedConversations[conversationIndex],
              messages: [...updatedConversations[conversationIndex].messages, newMessage],
            };
  
            return updatedConversations;
          });
        },
      }
    );
  
    const sendMessage = (text: string) => {
      sendMessageMutation.mutate(text);
    }; */
  
    return (
      <ChatContext.Provider
        value={useMemo(
          () => ({
            contacts,
            conversations,
            activeContactId,
            setActiveContactId,
            sendMessage: () => {},
            searchContacts: (query: string) => {
              if (!query) {
                setFilteredContacts(contacts);
                return;
              }
              const filtered = contacts.filter((contact) =>
                contact.name.toLowerCase().includes(query.toLowerCase())
              );
              setFilteredContacts(filtered);
            },
            filteredContacts,
            conversation
          }),
          [contacts, conversations, activeContactId, filteredContacts, conversation/* , sendMessage */]
        )}
      >
        {children}
      </ChatContext.Provider>
    );
  }