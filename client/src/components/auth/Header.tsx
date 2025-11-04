import { Bot, LogOut, Settings } from 'lucide-react'
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

export default function Header() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (!user) return null

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-white">Chat Dashboard</h1>
          {/* <Link
            to="/data"
            className="text-xs text-slate-300 hover:text-white flex items-center gap-1"
          >
            <Database className="h-4 w-4" /> Data
          </Link> */}
          <Link
            to="/app"
            className={`text-xs flex items-center gap-1 ${
              location.pathname === '/app'
                ? 'text-white pointer-events-none cursor-default'
                : 'text-slate-300 hover:text-white'
            }`}
            aria-disabled={location.pathname === '/app'}
          >
            <Bot className="h-4 w-4" /> Chat
          </Link>
          <Link
            to="/config"
            className={`text-xs flex items-center gap-1 ${
              location.pathname === '/config'
                ? 'text-white pointer-events-none cursor-default'
                : 'text-slate-300 hover:text-white'
            }`}
            aria-disabled={location.pathname === '/config'}
          >
            <Settings className="h-4 w-4" /> Config
          </Link>
          <Link
            to="/assistant-config"
            className={`text-xs flex items-center gap-1 ${
              location.pathname === '/assistant-config'
                ? 'text-white pointer-events-none cursor-default'
                : 'text-slate-300 hover:text-white'
            }`}
            aria-disabled={location.pathname === '/assistant-config'}
          >
            <Bot className="h-4 w-4" /> Assistant
          </Link>
        </div>

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
    </header>
  )
}
