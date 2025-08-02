import { Menu, Phone, Video, Search, MoreVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Contact } from '@/types';

interface ChatHeaderProps {
  contact: Contact;
  setMobileMenuOpen: (open: boolean) => void;
}

export default function ChatHeader({ contact, setMobileMenuOpen }: ChatHeaderProps) {
  return (
    <div className="p-3 bg-card border-b border-border flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar>
              <AvatarImage src={contact.avatar} alt={contact.name} />
              <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
            </Avatar>
            {contact.online && (
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card"></div>
            )}
          </div>
          
          <div>
            <h2 className="font-medium text-sm">{contact.name}</h2>
            <p className="text-xs text-muted-foreground">
              {contact.online ? (
                contact.typing ? 'digitando...' : 'online'
              ) : (
                'visto por último hoje às 10:30'
              )}
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-1">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Video className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Phone className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Search className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}