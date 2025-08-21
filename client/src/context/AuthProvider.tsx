import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/hooks/use-toast'
import { AuthContext, type User } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('admin_token')
        if (token) {
          // Verify token with backend
          const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (response.ok) {
            const userData = await response.json()
            setUser(userData)
          } else {
            localStorage.removeItem('admin_token')
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        localStorage.removeItem('admin_token')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setIsLoading(true)
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // Allow Set-Cookie from backend so server-side admin auth works on /admin/drizzle
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Login failed')
        }

        const { user: userData, token } = await response.json()

        // Only allow admin users
        // if (userData.role !== 'admin') {
        //   throw new Error('Access denied. Admin privileges required.')
        // }

        localStorage.setItem('admin_token', token)
        setUser(userData)

        toast({
          title: 'Welcome back!',
          description: `Logged in as ${userData.name}`,
        })
      } catch (error) {
        console.error('Login error:', error)
        toast({
          title: 'Login Failed',
          description:
            error instanceof Error
              ? error.message
              : 'An error occurred during login',
          variant: 'destructive',
        })
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [toast],
  )

  const logout = useCallback(async () => {
    try {
      // Clear server cookie
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (e) {
      console.warn('Logout request failed (continuing):', e)
    }
    localStorage.removeItem('admin_token')
    setUser(null)
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out',
    })
  }, [toast])

  const isAuthenticated = user !== null /* && user.role === 'admin' */

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
