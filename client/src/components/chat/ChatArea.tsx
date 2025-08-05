import { useChat } from '@/context/ChatContext';
import { useEffect, useRef } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import EmptyChat from './EmptyChat';

interface ChatAreaProps {
  setMobileMenuOpen: (open: boolean) => void;
}

export default function ChatArea({ setMobileMenuOpen }: ChatAreaProps) {
  const { activeContactId, contacts, conversations, conversation, toggleConversation } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find active contact and conversation
  const activeContact = activeContactId
    ? contacts.find((contact) => contact.id === activeContactId)
    : null;
    
  const activeConversation = activeContactId
    ? conversations.find((conv) => conv.contactId === activeContactId)
    : null;

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages]);

  if (!activeContact || !conversation) {
    return <EmptyChat />;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative">
      <ChatHeader 
        contact={activeContact} 
        setMobileMenuOpen={setMobileMenuOpen}
        onToggleConversation={toggleConversation}
      />
      
      <div 
        className="flex-1 overflow-y-auto p-4 bg-[url('/whatsapp-bg.png')]
        dark:bg-[url('/whatsapp-bg-dark.png')] bg-repeat bg-opacity-5"
      >
        <MessageList 
          messages={conversation.messages} 
          contactId={activeContact.id} 
        />
        <div ref={messagesEndRef} />
      </div>
      
      <MessageInput />
    </div>
  );
}