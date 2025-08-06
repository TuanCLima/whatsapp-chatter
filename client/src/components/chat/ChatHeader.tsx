import { Menu, Phone, Video, Search, MoreVertical } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Contact } from '@/types'

interface ChatHeaderProps {
  contact: Contact
  setMobileMenuOpen: (open: boolean) => void
  onToggleConversation?: (phoneNumber: string, disabled: boolean) => void
}

export default function ChatHeader({
  contact,
  setMobileMenuOpen,
  onToggleConversation,
}: ChatHeaderProps) {
  const handleConversationToggle = (checked: boolean) => {
    if (onToggleConversation && contact.phoneNumber) {
      onToggleConversation(contact.phoneNumber, !checked)
    }
  }

  return (
    <div className="p-3 bg-card border-b border-border flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar>
              <AvatarImage src={contact.avatar} alt={contact.name} />
              <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
            </Avatar>
            {contact.online && (
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card"></div>
            )}
          </div>

          <div>
            <h2 className="font-medium text-sm flex items-center gap-2">
              {contact.name}
              {contact.conversationDisabled && (
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full">
                  AI Chat Disabled
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              {contact.online
                ? contact.typing
                  ? 'digitando...'
                  : 'online'
                : 'visto por último hoje às 10:30'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Conversation Toggle Switch */}
        <div className="flex items-center space-x-2">
          <Label
            htmlFor="conversation-toggle"
            className="text-xs text-muted-foreground"
          >
            Chat AI
          </Label>
          <Switch
            id="conversation-toggle"
            checked={!contact.conversationDisabled}
            onCheckedChange={handleConversationToggle}
          />
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Video className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Phone className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
