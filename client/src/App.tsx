import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AdminDataPage from '@/components/auth/AdminDataPage'
import AdminHeader from '@/components/auth/AdminHeader'
import LoadingScreen from '@/components/auth/LoadingScreen'
import LoginScreen from '@/components/auth/LoginScreen'
import ChatArea from '@/components/chat/ChatArea'
import TwilioConfigPage from '@/components/config/TwilioConfigPage'
import TwilioGuard from '@/components/guards/TwilioGuard'
import Sidebar from '@/components/sidebar/Sidebar'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/context/AuthContext'
import { AuthProvider } from '@/context/AuthProvider'
import { ChatProvider } from '@/context/ChatProvider'
import './App.css'

function ProtectedChatLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <TwilioGuard>
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
    </TwilioGuard>
  )
}

function ProtectedDataLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LoginScreen />
  return (
    <TwilioGuard>
      <div className="h-screen flex flex-col bg-background">
        <AdminHeader />
        <div className="flex-1 overflow-hidden">
          <AdminDataPage />
        </div>
      </div>
    </TwilioGuard>
  )
}

function ProtectedConfigLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LoginScreen />
  return (
    <div className="h-screen flex flex-col bg-background">
      <AdminHeader />
      <div className="flex-1 overflow-hidden">
        <TwilioConfigPage />
      </div>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="whatsapp-theme">
      <AuthProvider>
        <BrowserRouter>
          <ChatProvider>
            <Routes>
              <Route path="/data" element={<ProtectedDataLayout />} />
              <Route path="/config" element={<ProtectedConfigLayout />} />
              <Route path="/*" element={<ProtectedChatLayout />} />
            </Routes>
          </ChatProvider>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
