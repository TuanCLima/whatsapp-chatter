import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
// import DataPage from '@/components/auth/DataPage'
import EmailVerificationPage from '@/components/auth/EmailVerificationPage'
import LandingPage from '@/components/marketing/LandingPage'
import Header from '@/components/auth/Header'
import LoadingScreen from '@/components/auth/LoadingScreen'
import LoginScreen from '@/components/auth/LoginScreen'
import ChatArea from '@/components/chat/ChatArea'
import AssistantConfigPage from '@/components/config/AssistantConfigPage'
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
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
          {mobileMenuOpen && (
            <div
              className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
          )}
          <Sidebar
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
          />
          <div className="flex-1 h-full overflow-hidden w-full md:w-auto">
            <ChatArea setMobileMenuOpen={setMobileMenuOpen} />
          </div>
        </div>
      </div>
    </TwilioGuard>
  )
}

// function ProtectedDataLayout() {
//   const { isAuthenticated, isLoading } = useAuth()
//   if (isLoading) return <LoadingScreen />
//   if (!isAuthenticated) return <LoginScreen />
//   return (
//     <TwilioGuard>
//       <div className="h-screen flex flex-col bg-background">
//         <Header />
//         <div className="flex-1 overflow-hidden">
//           <DataPage />
//         </div>
//       </div>
//     </TwilioGuard>
//   )
// }

function ProtectedConfigLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LoginScreen />
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-hidden">
        <TwilioConfigPage />
      </div>
    </div>
  )
}

function ProtectedAssistantConfigLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LoginScreen />
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-hidden">
        <AssistantConfigPage />
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
              <Route path="/" element={<LandingPage />} />
              <Route path="/verify-email" element={<EmailVerificationPage />} />
              {/* <Route path="/data" element={<ProtectedDataLayout />} /> */}
              <Route path="/config" element={<ProtectedConfigLayout />} />
              <Route
                path="/assistant-config"
                element={<ProtectedAssistantConfigLayout />}
              />
              <Route path="/app/*" element={<ProtectedChatLayout />} />
            </Routes>
          </ChatProvider>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
