import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/context/AuthContext'

interface DbUser {
  id: number
  phoneNumber: string
  profileName: string
  conversationDisabled: number | boolean
  createdAt: string
  updatedAt: string | null
}

interface DbMessage {
  id: number
  phoneNumber: string
  role: string
  content: string | null
  timestamp: string
  toolCallId: string | null
  toolCalls: string | null
}

export function DataPage() {
  const { isAuthenticated } = useAuth()
  const [users, setUsers] = useState<DbUser[]>([])
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneFilter, setPhoneFilter] = useState('')
  const [search, setSearch] = useState('')
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

  useEffect(() => {
    if (!isAuthenticated) return
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true)
        const res = await fetch(`${API_BASE_URL}/api/db/users`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error('Failed to load users')
        setUsers(await res.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [isAuthenticated, token])

  const fetchMessages = useCallback(
    async (pn?: string) => {
      try {
        setLoadingMessages(true)
        const base =
          typeof window !== 'undefined'
            ? window.location.origin
            : 'http://localhost'
        const url = new URL(`${API_BASE_URL}/api/db/messages`, base)
        if (pn) url.searchParams.set('phoneNumber', pn)
        url.searchParams.set('limit', '500')
        const apiUrl = base ? url.toString().replace(base, '') : url.toString()
        const res = await fetch(apiUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error('Failed to load messages')
        setMessages(await res.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoadingMessages(false)
      }
    },
    [token],
  )

  useEffect(() => {
    if (isAuthenticated) fetchMessages()
  }, [isAuthenticated, fetchMessages])

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (phoneFilter && m.phoneNumber !== phoneFilter) return false
      if (
        search &&
        !(m.content || '').toLowerCase().includes(search.toLowerCase())
      )
        return false
      return true
    })
  }, [messages, phoneFilter, search])

  async function clearAllMessages() {
    if (!confirm('Delete ALL messages? This cannot be undone.')) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/db/clear-all-messages`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Failed to clear all messages')
      setMessages([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  async function clearAllUsersAndMessages() {
    if (!confirm('Delete ALL users and messages? This cannot be undone.'))
      return
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/db/clear-all-users-and-messages`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) throw new Error('Failed to clear all users and messages')
      setUsers([])
      setMessages([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  async function clearUserData(phoneNumber: string) {
    if (!confirm(`Delete user ${phoneNumber} and their messages?`)) return
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/db/messages-per-user?phoneNumber=${encodeURIComponent(phoneNumber)}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) throw new Error('Failed to clear user data')
      setUsers((prev) => prev.filter((u) => u.phoneNumber !== phoneNumber))
      setMessages((prev) => prev.filter((m) => m.phoneNumber !== phoneNumber))
      if (phoneFilter === phoneNumber) setPhoneFilter('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Filter phone"
          value={phoneFilter}
          onChange={(e) => setPhoneFilter(e.target.value)}
          className="w-48"
        />
        <Input
          placeholder="Search text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Button
          variant="secondary"
          onClick={() => fetchMessages(phoneFilter || undefined)}
          disabled={loadingMessages}
        >
          Refresh Messages
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setPhoneFilter('')
            setSearch('')
          }}
        >
          Clear Filters
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={clearAllMessages}
          disabled={!users.length}
        >
          Clear All Messages
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={clearAllUsersAndMessages}
          disabled={!users.length}
        >
          Clear All Users and Messages
        </Button>
      </div>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <Tabs
        defaultValue="users"
        className="flex flex-col flex-1 overflow-hidden"
      >
        <TabsList className="w-fit">
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="messages">
            Messages ({filteredMessages.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="flex-1 overflow-hidden mt-2">
          <Card className="h-full flex flex-col">
            <CardContent className="flex-1 overflow-hidden p-0">
              {loadingUsers ? (
                <div className="p-4">Loading users...</div>
              ) : (
                <ScrollArea className="h-full">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background/80 backdrop-blur border-b">
                      <tr className="text-left">
                        <th className="p-2">ID</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2">Profile</th>
                        <th className="p-2">Disabled</th>
                        <th className="p-2">Created</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          className="border-b last:border-b-0 hover:bg-muted/40 cursor-pointer"
                          onClick={(e) => {
                            // Avoid row click when clicking button
                            if ((e.target as HTMLElement).closest('button'))
                              return
                            setPhoneFilter(u.phoneNumber)
                          }}
                        >
                          <td className="p-2 font-mono text-xs">{u.id}</td>
                          <td className="p-2 font-mono text-xs">
                            {u.phoneNumber}
                          </td>
                          <td className="p-2">{u.profileName}</td>
                          <td className="p-2">
                            {u.conversationDisabled ? 'Yes' : 'No'}
                          </td>
                          <td className="p-2 text-xs">
                            {new Date(u.createdAt).toLocaleString()}
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => clearUserData(u.phoneNumber)}
                            >
                              Clear
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="messages" className="flex-1 overflow-hidden mt-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Messages</CardTitle>
              <div className="text-xs text-muted-foreground">
                Showing newest first
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              {loadingMessages ? (
                <div className="p-4">Loading messages...</div>
              ) : (
                <ScrollArea className="h-full">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background/80 backdrop-blur border-b">
                      <tr className="text-left">
                        <th className="p-2">ID</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Content</th>
                        <th className="p-2">Time</th>
                        <th className="p-2">Meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMessages.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b last:border-b-0 hover:bg-muted/40"
                        >
                          <td className="p-2 font-mono">{m.id}</td>
                          <td className="p-2 font-mono whitespace-nowrap">
                            <Button
                              variant="link"
                              className="p-0 h-auto"
                              onClick={() => setPhoneFilter(m.phoneNumber)}
                            >
                              {m.phoneNumber}
                            </Button>
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={
                                m.role === 'user' ? 'secondary' : 'outline'
                              }
                            >
                              {m.role}
                            </Badge>
                          </td>
                          <td className="p-2 max-w-[320px] whitespace-pre-line">
                            {m.content}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {new Date(m.timestamp).toLocaleString()}
                          </td>
                          <td className="p-2">
                            <div className="flex flex-col gap-1">
                              {m.toolCallId && (
                                <span className="font-mono text-[10px] bg-muted px-1 rounded">
                                  toolCallId:{m.toolCallId}
                                </span>
                              )}
                              {m.toolCalls && (
                                <span className="font-mono text-[10px] bg-muted px-1 rounded">
                                  toolCalls:{m.toolCalls.slice(0, 40)}
                                  {m.toolCalls.length > 40 ? '…' : ''}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default DataPage
