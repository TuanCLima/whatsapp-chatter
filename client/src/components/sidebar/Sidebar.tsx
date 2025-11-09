import { useState } from 'react'
import { useChat } from '@/context/ChatContext'
import ContactList from './ContactList'
import SidebarHeader from './SidebarHeader'

interface SidebarProps {
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
}

export default function Sidebar({
  mobileMenuOpen,
  setMobileMenuOpen,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<
    'all' | 'unread' | 'favorites' | 'groups'
  >('all')
  const [searchQuery, setSearchQuery] = useState('')
  const { searchContacts } = useChat()

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    searchContacts(query)
  }

  return (
    <div
      className={`${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } transition-transform duration-300 ease-in-out bg-card border-r border-border flex flex-col z-30 absolute inset-y-0 left-0 md:relative md:inset-auto w-full max-w-sm md:max-w-none md:w-[30%] lg:w-[25%] xl:w-[20%] shadow-xl md:shadow-none h-full`}
    >
      <SidebarHeader
        searchQuery={searchQuery}
        onSearch={handleSearch}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="px-2 py-2 border-b border-border">
        <div className="flex space-x-1 bg-secondary rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-sm ${
              activeTab === 'all'
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tudo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-sm ${
              activeTab === 'unread'
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Não lidas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-sm ${
              activeTab === 'favorites'
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Favoritas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-sm ${
              activeTab === 'groups'
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Grupos
          </button>
        </div>
      </div>

      <ContactList
        activeTab={activeTab}
        setMobileMenuOpen={setMobileMenuOpen}
      />
    </div>
  )
}
