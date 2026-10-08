import { useState, KeyboardEvent } from 'react'
import { Smile, Paperclip, Mic, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChat } from '@/context/ChatContext'

export default function MessageInput() {
  const [message, setMessage] = useState('')
  const { sendMessage } = useChat()

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage(message)
      setMessage('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="p-3 bg-card border-t border-border">
      <div className="flex items-end space-x-2">
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 rounded-lg bg-background border border-border">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem"
            className="w-full bg-transparent border-0 resize-none p-2 focus:outline-none text-sm min-h-[40px] max-h-[120px]"
            rows={1}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleSendMessage}
          disabled={!message.trim()}
        >
          {message.trim() ? (
            <Send className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  )
}
