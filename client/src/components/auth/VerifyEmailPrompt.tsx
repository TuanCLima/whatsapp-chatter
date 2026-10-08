import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { useState } from 'react'
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

interface VerifyEmailPromptProps {
  email: string
  onBackToLogin: () => void
}

export default function VerifyEmailPrompt({
  email,
  onBackToLogin,
}: VerifyEmailPromptProps) {
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(false)

  const handleResendEmail = async () => {
    setIsResending(true)
    setError('')
    setResendSuccess(false)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResendSuccess(true)
        setResendCooldown(true)

        // Enable resend button after 60 seconds
        setTimeout(() => {
          setResendCooldown(false)
        }, 60000)
      } else {
        setError(data.error || 'Failed to resend verification email')
      }
    } catch {
      setError('Failed to resend email. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-blue-600 rounded-full">
                <Mail className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Check Your Email
            </CardTitle>
            <CardDescription className="text-slate-400">
              We've sent a verification link to your email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert
                variant="destructive"
                className="border-red-600 bg-red-900/20"
              >
                <AlertDescription className="text-red-200">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {resendSuccess && (
              <Alert className="border-green-600 bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-200" />
                <AlertDescription className="text-green-200">
                  Verification email sent successfully! Please check your inbox.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label className="text-white">Email Address</Label>
              <Input
                type="email"
                value={email}
                disabled
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
              <h3 className="text-white font-semibold mb-2 flex items-center">
                <Mail className="h-4 w-4 mr-2 text-blue-400" />
                What's Next?
              </h3>
              <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
                <li>Open the email we sent to {email}</li>
                <li>Click the verification link in the email</li>
                <li>Come back here to log in</li>
              </ol>
            </div>

            <div className="text-sm text-slate-400 text-center">
              Didn't receive the email? Check your spam folder or request a new
              one.
            </div>

            <Button
              onClick={handleResendEmail}
              disabled={isResending || resendCooldown}
              variant="outline"
              className="w-full bg-transparent border-slate-600 text-white hover:bg-slate-700"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : resendCooldown ? (
                'Email sent - wait 1 minute to resend'
              ) : (
                'Resend Verification Email'
              )}
            </Button>

            <Button
              onClick={onBackToLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Back to Login
            </Button>

            <div className="text-xs text-slate-500 text-center">
              The verification link will expire in 24 hours
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
