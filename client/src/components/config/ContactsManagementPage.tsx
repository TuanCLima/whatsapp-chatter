import {
  Building,
  Check,
  Edit,
  Mail,
  Phone,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  type Contact,
  type ContactsToolStatus,
  predefinedToolsService,
} from '@/services/PredefinedToolsService'

export default function ContactsManagementPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsStatus, setContactsStatus] = useState<ContactsToolStatus>({
    enabled: false,
    contactCount: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    company: '',
  })
  const { toast } = useToast()

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const [contactsResponse, statusResponse] = await Promise.all([
          predefinedToolsService.getContacts(),
          predefinedToolsService.getContactsStatus(),
        ])

        setContacts(contactsResponse.contacts)
        setContactsStatus(statusResponse)
      } catch (error) {
        console.error('Error loading contacts data:', error)
        toast({
          title: 'Error',
          description: 'Failed to load contacts data',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [toast])

  const toggleContactsTool = async () => {
    try {
      setIsLoading(true)
      const newStatus = !contactsStatus.enabled

      await predefinedToolsService.toggleContactsTool(newStatus)

      setContactsStatus((prev) => ({
        ...prev,
        enabled: newStatus,
      }))

      toast({
        title: 'Success',
        description: `Contact management ${
          newStatus ? 'enabled' : 'disabled'
        } successfully`,
      })
    } catch (error) {
      console.error('Error toggling contacts tool:', error)
      toast({
        title: 'Error',
        description: 'Failed to toggle contact management tool',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditingContact(null)
    setFormData({
      name: '',
      phoneNumber: '',
      email: '',
      company: '',
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact)
    setFormData({
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      email: contact.email || '',
      company: contact.company || '',
    })
    setIsDialogOpen(true)
  }

  const handleSaveContact = async () => {
    if (!formData.name || !formData.phoneNumber) {
      toast({
        title: 'Error',
        description: 'Name and phone number are required',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)

      if (editingContact) {
        // Update existing contact
        const response = await predefinedToolsService.updateContact(
          editingContact.id,
          formData,
        )
        setContacts((prev) =>
          prev.map((c) => (c.id === editingContact.id ? response.contact : c)),
        )
        toast({
          title: 'Success',
          description: 'Contact updated successfully',
        })
      } else {
        // Create new contact
        const response = await predefinedToolsService.createContact(formData)
        setContacts((prev) => [...prev, response.contact])
        toast({
          title: 'Success',
          description: 'Contact created successfully',
        })
      }

      setIsDialogOpen(false)
      setContactsStatus((prev) => ({
        ...prev,
        contactCount: editingContact
          ? prev.contactCount
          : prev.contactCount + 1,
      }))
    } catch (error) {
      console.error('Error saving contact:', error)
      toast({
        title: 'Error',
        description: `Failed to ${editingContact ? 'update' : 'create'} contact`,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteContact = async (contactId: number) => {
    try {
      setIsLoading(true)
      await predefinedToolsService.deleteContact(contactId)
      setContacts((prev) => prev.filter((c) => c.id !== contactId))
      setContactsStatus((prev) => ({
        ...prev,
        contactCount: prev.contactCount - 1,
      }))
      toast({
        title: 'Success',
        description: 'Contact deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting contact:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete contact',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tool Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Tool Status
          </CardTitle>
          <CardDescription>
            Enable or disable the contact management functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Contact Management Tool</span>
                {contactsStatus.enabled ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-red-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {contactsStatus.enabled
                  ? `Active with ${contactsStatus.contactCount} contacts`
                  : 'Disabled'}
              </p>
            </div>
            <Button
              onClick={toggleContactsTool}
              disabled={isLoading}
              variant={contactsStatus.enabled ? 'destructive' : 'default'}
            >
              {contactsStatus.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>
                Manage contacts that can be shared through WhatsApp
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog} disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">No contacts yet</h4>
              <p className="text-muted-foreground mb-4">
                Add your first contact to enable the forwardContact tool
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{contact.name}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contact.phoneNumber}
                      </div>
                      {contact.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                      )}
                      {contact.company && (
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {contact.company}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(contact)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteContact(contact.id)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Contact Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'Add New Contact'}
            </DialogTitle>
            <DialogDescription>
              {editingContact
                ? 'Update the contact information'
                : 'Create a new contact that can be shared through WhatsApp'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Contact name"
              />
            </div>
            <div>
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                placeholder="+5511999999999"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="contact@example.com"
              />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, company: e.target.value }))
                }
                placeholder="Company name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveContact} disabled={isLoading}>
              {editingContact ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
