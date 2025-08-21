import { AlertTriangle, Loader2, Settings } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import TwilioConfigPage from '@/components/config/TwilioConfigPage'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { API_BASE_URL } from '@/config/api'

interface TwilioGuardProps {
  children: React.ReactNode
}

interface TwilioStatus {
  configured: boolean
  loading: boolean
  error?: string
}

export default function TwilioGuard({ children }: TwilioGuardProps) {
  const [status, setStatus] = useState<TwilioStatus>({
    configured: false,
    loading: true,
  })
  const [showConfig, setShowConfig] = useState(false)

  const checkTwilioStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`${API_BASE_URL}/api/twilio/credentials`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStatus({
          configured: data.configured,
          loading: false,
        })
      } else {
        throw new Error('Failed to check Twilio status')
      }
    } catch (error) {
      console.error('Error checking Twilio status:', error)
      setStatus({
        configured: false,
        loading: false,
        error: 'Failed to check Twilio configuration',
      })
    }
  }, [])

  useEffect(() => {
    checkTwilioStatus()
  }, [checkTwilioStatus])

  // Remove unused handleConfigSuccess function

  if (status.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Checking Twilio configuration...
          </p>
        </div>
      </div>
    )
  }

  if (showConfig) {
    return <TwilioConfigPage />
  }

  if (!status.configured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-yellow-500 rounded-full">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Twilio Setup Required</CardTitle>
            <CardDescription>
              You need to configure your Twilio credentials before you can use
              the WhatsApp chatbot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status.error && (
              <Alert variant="destructive">
                <AlertDescription>{status.error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                To get started, you'll need:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Twilio Account SID</li>
                  <li>Twilio Auth Token</li>
                  <li>WhatsApp Sandbox Number</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button onClick={() => setShowConfig(true)} className="w-full">
              Configure Twilio Credentials
            </Button>

            <Button
              variant="outline"
              onClick={checkTwilioStatus}
              className="w-full"
            >
              Refresh Configuration Status
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
