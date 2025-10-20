import { Check, CheckCheck, Link } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useChat } from '@/context/ChatContext'
import { formatMessageTime } from '@/lib/utils'
import type { Message } from '@/types'

interface MessageBubbleProps {
  message: Message
  isSent: boolean
  contactId: string
}

export default function MessageBubble({
  message,
  isSent,
  contactId,
}: MessageBubbleProps) {
  const { contacts } = useChat()
  const contact = contacts.find((c) => c.id === contactId)

  return (
    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-2`}>
      {!isSent && (
        <div className="flex flex-col justify-center">
          <Avatar className="h-6 w-6">
            <AvatarImage src={contact?.avatar} alt={contact?.name} />
            <AvatarFallback
              className={
                message.sender === 'whatsapp:+5511966443841'
                  ? 'bg-blue-700'
                  : ''
              }
            >
              {message.sender === 'whatsapp:+5511966443841'
                ? 'H'
                : contact?.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div
        className={`relative min-w-[70%] max-w-[70%] px-3 py-2 rounded-lg 
        ${
          isSent
            ? 'bg-green-500/20 dark:bg-green-900/30 text-foreground'
            : 'bg-card text-foreground'
        }`}
      >
        {message.isForwardedContact && (
          <div className="flex items-center space-x-1 mb-2 text-muted-foreground">
            <Link className="h-3 w-3" />
            <span className="text-xs italic">Forwarded Contact</span>
          </div>
        )}

        {message.isMedia && message.mediaType === 'image' && (
          <div className="mb-2 rounded-md overflow-hidden">
            <img src={message.mediaUrl} alt="Media" className="w-full h-auto" />
          </div>
        )}

        <p className="text-sm">{message.text}</p>

        <div
          className={`flex items-center space-x-1 text-xs text-muted-foreground borderabsolute bottom-1 ${isSent ? 'right-3' : 'right-3'}`}
        >
          <span className="text-right text-[10px] mt-1">
            {formatMessageTime(message.timestamp)}
          </span>

          {isSent && (
            <span className="ml-1">
              {message.status === 'sent' && (
                <Check className="h-3 w-3 inline" />
              )}
              {message.status === 'delivered' && (
                <CheckCheck className="h-3 w-3 inline" />
              )}
              {message.status === 'read' && (
                <CheckCheck className="h-3 w-3 inline text-blue-500" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
