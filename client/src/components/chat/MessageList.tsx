import { Message } from '@/types';
import MessageBubble from './MessageBubble';
import { AnimatePresence, motion } from 'framer-motion';

interface MessageListProps {
  messages: Message[];
  contactId: string;
}

export default function MessageList({ messages, contactId }: MessageListProps) {
  // Group messages by day
  const groupedMessages: { [key: string]: Message[] } = {};
  let currentDay = '';

  messages?.forEach((message) => {
    const date = new Date(message.timestamp);
    const day = new Intl.DateTimeFormat('pt-BR', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);

    if (day !== currentDay) {
      currentDay = day; 
      groupedMessages[day] = [];
    }

    groupedMessages[day].push(message);
  });

  return (
    <div className="space-y-6">
      {Object.entries(groupedMessages).map(([day, dayMessages]) => (
        <div key={day} className="space-y-2">
          <div className="flex justify-center">
            <span className="bg-secondary text-muted-foreground text-xs px-3 py-1 rounded-full">
              {day === new Intl.DateTimeFormat('pt-BR', { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }).format(new Date()) ? 'HOJE' : day}
            </span>
          </div>
          
          <AnimatePresence>
            {dayMessages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageBubble 
                  message={message} 
                  isSent={message.sender === 'user'} 
                  contactId={contactId}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}