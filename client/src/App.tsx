import { useState } from 'react'
import Sidebar from '@/components/sidebar/Sidebar'
import ChatArea from '@/components/chat/ChatArea'
import LoginScreen from '@/components/auth/LoginScreen'
import LoadingScreen from '@/components/auth/LoadingScreen'
import AdminHeader from '@/components/auth/AdminHeader'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { ChatProvider } from '@/context/ChatProvider'
import { AuthProvider } from '@/context/AuthProvider'
import { useAuth } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import './App.css'

function AppContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <AdminHeader />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        <ChatArea setMobileMenuOpen={setMobileMenuOpen} />
      </div>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="whatsapp-theme">
      <AuthProvider>
        <ChatProvider>
          <AppContent />
          <Toaster />
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
