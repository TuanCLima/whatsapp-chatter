import { useState } from 'react'
import { Menu, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/theme/ModeToggle'

interface SidebarHeaderProps {
  searchQuery: string
  onSearch: (query: string) => void
}

export default function SidebarHeader({
  searchQuery,
  onSearch,
}: SidebarHeaderProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  return (
    <div className="p-2 bg-card border-b border-border flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold">WhatsApp</h1>
        </div>
        <div className="flex items-center space-x-1">
          <ModeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <div
          className={`absolute inset-y-0 left-3 flex items-center pointer-events-none transition-opacity ${isSearchFocused || searchQuery ? 'opacity-0' : 'opacity-100'}`}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <input
          type="text"
          placeholder="Pesquisar ou começar uma nova conversa"
          className="w-full bg-secondary rounded-md py-2 pl-10 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
        {searchQuery && (
          <button
            className="absolute inset-y-0 right-3 flex items-center"
            onClick={() => onSearch('')}
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    </div>
  )
}
