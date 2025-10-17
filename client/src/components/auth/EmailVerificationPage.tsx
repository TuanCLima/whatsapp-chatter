import { CheckCircle2, Loader2, Mail, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { useToast } from '@/hooks/use-toast'

export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [status, setStatus] = useState<
    'verifying' | 'success' | 'error' | 'expired'
  >('verifying')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const token = searchParams.get('token')

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus('success')
        setMessage(data.message)
        setEmail(data.user?.email || '')

        toast({
          title: 'Email Verified! ✓',
          description: 'You can now log in to your account.',
        })

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 3000)
      } else {
        if (data.error?.includes('expired')) {
          setStatus('expired')
          // Try to extract email from error message or token if possible
        } else {
          setStatus('error')
        }
        setMessage(data.error || 'Verification failed')
      }
    } catch {
      setStatus('error')
      setMessage('Failed to verify email. Please try again.')
    }
  }

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Invalid verification link')
      return
    }

    verifyEmail(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        title: 'Error',
        description: 'Unable to resend. Please contact support.',
        variant: 'destructive',
      })
      return
    }

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
        toast({
          title: 'Success',
          description: 'Verification email sent. Please check your inbox.',
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to resend email',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to resend email. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-blue-600 rounded-full">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white">Verifying...</h2>
            <p className="text-slate-400">
              Please wait while we verify your email address
            </p>
          </div>
        )

      case 'success':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-600 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white">
              Email Verified! 🎉
            </h2>
            <p className="text-slate-300">{message}</p>
            <div className="pt-4">
              <Alert className="border-green-600 bg-green-900/20">
                <AlertDescription className="text-green-200">
                  Redirecting you to login in a few seconds...
                </AlertDescription>
              </Alert>
            </div>
            <Button
              onClick={() => navigate('/', { replace: true })}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Go to Login Now
            </Button>
          </div>
        )

      case 'expired':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-yellow-600 rounded-full">
                <Mail className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white">Link Expired</h2>
            <p className="text-slate-300">{message}</p>
            <div className="pt-4">
              <Alert
                variant="destructive"
                className="border-yellow-600 bg-yellow-900/20"
              >
                <AlertDescription className="text-yellow-200">
                  Your verification link has expired. Please request a new one.
                </AlertDescription>
              </Alert>
            </div>
            {email && (
              <Button
                onClick={handleResendEmail}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Resend Verification Email
              </Button>
            )}
            <Button
              onClick={() => navigate('/', { replace: true })}
              variant="outline"
              className="bg-transparent border-slate-600 text-white hover:bg-slate-700"
            >
              Back to Login
            </Button>
          </div>
        )

      case 'error':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-600 rounded-full">
                <XCircle className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white">
              Verification Failed
            </h2>
            <p className="text-slate-300">{message}</p>
            <div className="pt-4">
              <Alert
                variant="destructive"
                className="border-red-600 bg-red-900/20"
              >
                <AlertDescription className="text-red-200">
                  We couldn't verify your email. The link may be invalid or
                  expired.
                </AlertDescription>
              </Alert>
            </div>
            <Button
              onClick={() => navigate('/', { replace: true })}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Back to Login
            </Button>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-white">
              Email Verification
            </CardTitle>
            <CardDescription className="text-center text-slate-400">
              Confirming your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">{renderContent()}</CardContent>
        </Card>
      </div>
    </div>
  )
}
