import { useEffect, useState } from 'react'
import { Bot, LogOut, Menu, Settings, Users } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'

type HeaderProps = {
  onMenuClick?: () => void
}

const navItems = [
  { to: '/app', label: 'Chat', Icon: Bot },
  { to: '/config', label: 'Config', Icon: Settings },
  { to: '/assistant-config', label: 'Assistant', Icon: Bot },
]

export default function Header({ onMenuClick }: HeaderProps = {}) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  useEffect(() => {
    setIsMobileNavOpen(false)
  }, [location.pathname])

  if (!user) return null

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between md:w-full md:gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-white md:hidden"
              aria-label="Abrir navegação"
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-white">Chat Dashboard</h1>
            <nav className="hidden md:flex items-center gap-4">
              {navItems.map(({ to, label, Icon }) => {
                const isActive = location.pathname === to
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`text-xs flex items-center gap-1 transition-colors ${
                      isActive
                        ? 'text-white pointer-events-none cursor-default'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    aria-disabled={isActive}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {onMenuClick && (
              <Button
                variant="outline"
                size="sm"
                className="md:hidden border-white/20 text-white hover:bg-white/10"
                onClick={onMenuClick}
              >
                <Users className="mr-2 h-4 w-4" />
                Contatos
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-blue-600 text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-slate-800 border-slate-700"
                align="end"
                forceMount
              >
                <DropdownMenuLabel className="font-normal text-white">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-slate-400">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-slate-300 focus:text-white focus:bg-slate-700 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isMobileNavOpen && (
          <nav className="flex flex-col gap-2 md:hidden">
            {navItems.map(({ to, label, Icon }) => {
              const isActive = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  aria-disabled={isActive}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
            {onMenuClick && (
              <Button
                variant="outline"
                size="sm"
                className="justify-start border-white/20 text-white hover:bg-white/10"
                onClick={onMenuClick}
              >
                <Users className="mr-2 h-4 w-4" />
                Abrir contatos
              </Button>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
