import { useState } from 'react';
import Sidebar from '@/components/sidebar/Sidebar';
import ChatArea from '@/components/chat/ChatArea';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ChatProvider } from '@/context/ChatProvider';
import { Toaster } from '@/components/ui/toaster';
import './App.css';

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="whatsapp-theme">
      <ChatProvider>
        <div className="h-screen flex flex-col bg-background">
          <div className="flex-1 flex overflow-hidden">
            <Sidebar 
              mobileMenuOpen={mobileMenuOpen} 
              setMobileMenuOpen={setMobileMenuOpen} 
            />
            <ChatArea 
              setMobileMenuOpen={setMobileMenuOpen} 
            />
          </div>
        </div>
        <Toaster />
      </ChatProvider>
    </ThemeProvider>
  );
}

export default App;