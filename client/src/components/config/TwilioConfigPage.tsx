import {
  AlertTriangle,
  CheckCircle,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/hooks/use-toast'

interface TwilioCredentials {
  configured: boolean
  accountSid?: string
  whatsappNumber?: string
  webhookPath?: string
}

export default function TwilioConfigPage() {
  const [credentials, setCredentials] = useState<TwilioCredentials>({
    configured: false,
  })
  const [formData, setFormData] = useState({
    accountSid: '',
    authToken: '',
    whatsappNumber: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const fetchCredentials = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`${API_BASE_URL}/api/twilio/credentials`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCredentials(data)
        setFormData((prev) => ({
          ...prev,
          accountSid: data.accountSid || '',
          whatsappNumber: data.whatsappNumber || '',
        }))
      }
    } catch (error) {
      console.error('Error fetching credentials:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch Twilio credentials',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])

  const handleSave = async () => {
    if (
      !formData.accountSid ||
      !formData.authToken ||
      !formData.whatsappNumber
    ) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`${API_BASE_URL}/api/twilio/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Twilio credentials saved successfully',
        })
        await fetchCredentials() // Refresh the data
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save credentials')
      }
    } catch (error) {
      console.error('Error saving credentials:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save credentials',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const copyWebhookUrl = () => {
    if (credentials.webhookPath) {
      const webhookUrl = `${window.location.origin}${credentials.webhookPath}`
      navigator.clipboard.writeText(webhookUrl)
      toast({
        title: 'Copied!',
        description: 'Webhook URL copied to clipboard',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Twilio Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Configure your Twilio credentials to enable WhatsApp messaging for
          your chatbot.
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {credentials.configured ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert
            className={
              credentials.configured ? 'border-green-200' : 'border-yellow-200'
            }
          >
            <AlertDescription>
              {credentials.configured
                ? 'Your Twilio credentials are configured and ready to use.'
                : 'You need to configure your Twilio credentials before you can use the chatbot.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Webhook URL Card */}
      {credentials.webhookPath && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook URL</CardTitle>
            <CardDescription>
              Use this URL in your Twilio WhatsApp Sandbox webhook
              configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                value={`${window.location.origin}${credentials.webhookPath}`}
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    'https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox',
                    '_blank',
                  )
                }
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Copy this URL and paste it in your Twilio Console → WhatsApp
              Sandbox Settings → Webhook URL
            </p>
          </CardContent>
        </Card>
      )}

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Twilio Credentials</CardTitle>
          <CardDescription>
            Enter your Twilio Account SID, Auth Token, and WhatsApp number. You
            can find these in your{' '}
            <a
              href="https://console.twilio.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Twilio Console
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountSid">Account SID</Label>
            <Input
              id="accountSid"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={formData.accountSid}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, accountSid: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authToken">Auth Token</Label>
            <Input
              id="authToken"
              type="password"
              placeholder="Enter your Twilio Auth Token"
              value={formData.authToken}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, authToken: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
            <Input
              id="whatsappNumber"
              placeholder="whatsapp:+14155238886"
              value={formData.whatsappNumber}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  whatsappNumber: e.target.value,
                }))
              }
            />
            <p className="text-sm text-muted-foreground">
              Include the 'whatsapp:' prefix (e.g., whatsapp:+14155238886)
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Credentials'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium">1. Get your Twilio credentials</h4>
              <p className="text-sm text-muted-foreground">
                Visit your{' '}
                <a
                  href="https://console.twilio.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Twilio Console
                </a>{' '}
                and copy your Account SID and Auth Token.
              </p>
            </div>

            <div>
              <h4 className="font-medium">2. Set up WhatsApp Sandbox</h4>
              <p className="text-sm text-muted-foreground">
                Go to{' '}
                <a
                  href="https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  WhatsApp Sandbox Settings
                </a>{' '}
                and configure your webhook URL.
              </p>
            </div>

            <div>
              <h4 className="font-medium">3. Configure webhook</h4>
              <p className="text-sm text-muted-foreground">
                Copy the webhook URL from above and paste it in the "When a
                message comes in" field.
              </p>
            </div>

            <div>
              <h4 className="font-medium">4. Test your setup</h4>
              <p className="text-sm text-muted-foreground">
                Send a message to your WhatsApp Sandbox number to test the
                integration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
