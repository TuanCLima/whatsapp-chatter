import { useChat } from '@/context/ChatContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCheck, Check } from 'lucide-react'

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
  const displayedContacts = filteredContacts.filter((contact) => {
    if (activeTab === 'all') return true
    if (activeTab === 'unread')
      return contact.lastMessage?.unread && contact.lastMessage.unread > 0
    if (activeTab === 'favorites') return false // Implement favorites logic
    if (activeTab === 'groups') return false // Implement groups logic
    return true
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <AnimatePresence>
        {displayedContacts.map((contact) => (
          <motion.div
            key={contact.id}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => handleContactClick(contact.id)}
            className={`px-3 py-3 flex items-start space-x-3 cursor-pointer hover:bg-secondary ${
              activeContactId === contact.id ? 'bg-secondary' : ''
            } border-b border-border last:border-b-0`}
          >
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={contact.avatar} alt={contact.name} />
                <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
              </Avatar>
              {contact.online && (
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card"></div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className="font-medium text-sm truncate">{contact.name}</h3>
                {contact.lastMessage && (
                  <span className="text-xs text-muted-foreground">
                    {contact.lastMessage.timestamp}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-muted-foreground truncate mr-2">
                  {contact.typing ? (
                    <span className="text-green-500">digitando...</span>
                  ) : (
                    contact.lastMessage?.text
                  )}
                </p>

                <div className="flex items-center space-x-1">
                  {contact.lastMessage?.status === 'sent' && (
                    <Check className="h-3 w-3 text-muted-foreground" />
                  )}
                  {contact.lastMessage?.status === 'delivered' && (
                    <CheckCheck className="h-3 w-3 text-muted-foreground" />
                  )}
                  {contact.lastMessage?.status === 'read' && (
                    <CheckCheck className="h-3 w-3 text-blue-500" />
                  )}

                  {contact.lastMessage?.unread &&
                    contact.lastMessage.unread > 0 && (
                      <div className="bg-green-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">
                        {contact.lastMessage.unread}
                      </div>
                    )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
