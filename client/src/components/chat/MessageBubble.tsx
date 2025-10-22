/** biome-ignore-all lint/suspicious/noArrayIndexKey: none */
import {
  Check,
  CheckCheck,
  Image as ImageIcon,
  Link,
  Volume2,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { API_BASE_URL } from '@/config/api'
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

  // Parse metadata if it's a string
  const metadata =
    typeof message.metadata === 'string'
      ? JSON.parse(message.metadata)
      : message.metadata

  // Determine media items from metadata
  const mediaItems = metadata?.type === 'media' ? metadata.media : []

  const renderMediaContent = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mediaItems.map((media: any, index: number) => {
      const isImage = media.contentType.startsWith('image/')
      const isAudio = media.contentType.startsWith('audio/')
      const proxyUrl = `${API_BASE_URL || 'http://localhost:3000'}/api/media/${metadata.messageSid}/${media.mediaSid}`

      if (isImage) {
        return (
          <div key={index} className="mb-2 rounded-md overflow-hidden">
            <img
              src={proxyUrl}
              alt="Media"
              className="max-w-[300px] max-h-[400px] object-contain"
              loading="lazy"
            />
          </div>
        )
      }

      if (isAudio) {
        return (
          <div key={index} className="mb-2 flex items-center space-x-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <audio controls className="max-w-[250px]">
              <source src={proxyUrl} type={media.contentType} />
              <track kind="captions" src="" label="Audio captions" />
              Your browser does not support the audio element.
            </audio>
          </div>
        )
      }

      return (
        <div
          key={index}
          className="mb-2 flex items-center space-x-2 text-muted-foreground"
        >
          <ImageIcon className="h-4 w-4" />
          <span className="text-xs">
            Unsupported media type: {media.contentType}
          </span>
        </div>
      )
    })
  }

  return (
    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-2`}>
      {!isSent && (
        <div className="flex flex-col justify-center">
          <Avatar className="h-6 w-6">
            <AvatarImage src={contact?.avatar} alt={contact?.name} />
            <AvatarFallback className={isSent ? 'bg-blue-700' : ''}>
              {isSent ? 'A' : contact?.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div
        className={`relative max-w-[65%] px-3 py-2 rounded-lg 
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

        {mediaItems.length > 0 && renderMediaContent()}

        {message.isMedia &&
          message.mediaType === 'image' &&
          message.mediaUrl && (
            <div className="mb-2 rounded-md overflow-hidden">
              <img
                src={message.mediaUrl}
                alt="Media"
                className="max-w-[300px] max-h-[400px]"
              />
            </div>
          )}

        {message.text && message.text !== '[Media message]' && (
          <p className="text-sm">{message.text}</p>
        )}

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
