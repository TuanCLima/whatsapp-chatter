import { AnimatePresence, motion } from 'framer-motion'
import { Check, CheckCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useChat } from '@/context/ChatContext'

interface ContactListProps {
  activeTab: 'all' | 'unread' | 'favorites' | 'groups'
  setMobileMenuOpen: (open: boolean) => void
}

export default function ContactList({
  activeTab,
  setMobileMenuOpen,
}: Readonly<ContactListProps>) {
  const { filteredContacts, activeContactId, setActiveContactId } = useChat()

  const handleContactClick = (contactId: string) => {
    setActiveContactId(contactId)
    setMobileMenuOpen(false)
  }

  // Filter contacts based on active tab
  const displayedContacts = filteredContacts
    .filter((contact) => {
      if (activeTab === 'all') return true
      if (activeTab === 'unread')
        return contact.lastMessage?.unread && contact.lastMessage.unread > 0
      if (activeTab === 'favorites') return false // Implement favorites logic
      if (activeTab === 'groups') return false // Implement groups logic
      return true
    })
    .sort((a, b) => {
      // Prioritize unread messages
      const aHasUnread = a.lastMessage?.unread && a.lastMessage.unread > 0
      const bHasUnread = b.lastMessage?.unread && b.lastMessage.unread > 0

      if (aHasUnread && !bHasUnread) return -1
      if (!aHasUnread && bHasUnread) return 1

      const aTimestamp = a.lastMessage?.timestamp
      const bTimestamp = b.lastMessage?.timestamp

      if (aTimestamp && bTimestamp) {
        return new Date(bTimestamp).getTime() - new Date(aTimestamp).getTime()
      }

      if (aTimestamp) return -1
      if (bTimestamp) return 1
      return 0
    })


  return (
    <div className="flex-1 overflow-y-auto">
      <AnimatePresence>
        {displayedContacts.map((contact) => {
          const hasUnread =
            contact.lastMessage?.unread && contact.lastMessage.unread > 0

          return (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => handleContactClick(contact.id)}
              className={`px-3 py-3 flex items-start space-x-3 cursor-pointer hover:bg-secondary ${
                activeContactId === contact.id ? 'bg-secondary' : ''
              } ${
                hasUnread ? 'bg-accent/30 hover:bg-accent/50' : ''
              } border-b border-border last:border-b-0 transition-colors duration-200`}
            >
              <div className="relative">
                <Avatar
                  className={`h-10 w-10 ${hasUnread ? 'ring-2 ring-green-500/50' : ''}`}
                >
                  <AvatarImage src={contact.avatar} alt={contact.name} />
                  <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                </Avatar>
                {contact.online && (
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card"></div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3
                    className={`text-sm truncate ${
                      hasUnread
                        ? 'font-semibold text-foreground'
                        : 'font-medium'
                    }`}
                  >
                    {contact.name}
                  </h3>
                  {contact.lastMessage && (
                    <span
                      className={`text-xs ${
                        hasUnread
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(contact.lastMessage.timestamp).toLocaleString(
                        'pt-BR',
                        {
                          timeZone: 'America/Sao_Paulo',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center mt-1">
                  <p
                    className={`text-xs truncate mr-2 ${
                      hasUnread
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {contact.typing ? (
                      <span className="text-green-500">digitando...</span>
                    ) : (
                      contact.lastMessage?.text
                    )}
                  </p>

                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {contact.lastMessage?.status === 'sent' && (
                      <Check className="h-3 w-3 text-muted-foreground" />
                    )}
                    {contact.lastMessage?.status === 'delivered' && (
                      <CheckCheck className="h-3 w-3 text-muted-foreground" />
                    )}
                    {contact.lastMessage?.status === 'read' && (
                      <CheckCheck className="h-3 w-3 text-blue-500" />
                    )}

                    {(typeof hasUnread === 'number' ? hasUnread > 0 : hasUnread) && (
                      <div className="bg-green-500 text-white rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-semibold shadow-md">
                        {contact.lastMessage?.unread && contact.lastMessage.unread > 99
                          ? '99+'
                          : contact.lastMessage?.unread}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
