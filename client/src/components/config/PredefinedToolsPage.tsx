import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ExternalLink,
  Settings,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  type CalendarToolConfig,
  type CalendarToolStatus,
  predefinedToolsService,
} from '@/services/PredefinedToolsService'
import ContactsManagementPage from './ContactsManagementPage'

export default function PredefinedToolsPage() {
  const [calendarStatus, setCalendarStatus] = useState<CalendarToolStatus>({
    ready: false,
    hasAuth: false,
    enabled: false,
  })
  const [calendarConfig, setCalendarConfig] = useState<CalendarToolConfig>({
    defaultCalendarId: 'primary',
    workingHours: { start: '09:00', end: '17:00' },
    lunchTime: { start: '12:00', end: '13:00' },
    allowedWeekDays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false,
    },
    bufferTimeBetweenEvents: 0,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const { toast } = useToast()

  // Load data on component mount
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [toolsResponse, statusResponse] = await Promise.all([
        predefinedToolsService.getPredefinedTools(),
        predefinedToolsService.getCalendarStatus(),
      ])

      setCalendarStatus(statusResponse)

      // Load calendar config if it exists
      const calendarTool = toolsResponse.tools.find(
        (tool) => tool.toolType === 'calendar_management',
      )
      if (calendarTool?.configData) {
        setCalendarConfig((prev) => ({ ...prev, ...calendarTool.configData }))
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load predefined tools data',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCalendarAuth = async () => {
    setIsAuthenticating(true)
    try {
      const { authUrl } = await predefinedToolsService.getCalendarAuthUrl()

      // Open auth URL in a new popup window
      const popup = window.open(
        authUrl,
        'google_auth',
        'width=500,height=600,scrollbars=yes,resizable=yes',
      )

      // Listen for the auth completion message
      const handleMessage = async (event: MessageEvent) => {
        // Accept messages from backend (OAuth callback) origin
        const backendOrigin = import.meta.env.PROD
          ? 'https://hono-api-2w97.onrender.com/'
          : 'http://localhost:3000'

        if (
          event.origin !== backendOrigin &&
          event.origin !== window.location.origin
        ) {
          return
        }

        if (event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.code) {
          try {
            await predefinedToolsService.completeCalendarAuth(event.data.code)
            toast({
              title: 'Success',
              description: 'Google Calendar connected successfully!',
            })
            popup?.close()
            loadData() // Refresh status
          } catch (error) {
            console.error('Error completing auth:', error)
            toast({
              title: 'Error',
              description: 'Failed to complete Google Calendar authentication',
              variant: 'destructive',
            })
          }
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          console.error('Auth error:', event.data.error)
          toast({
            title: 'Error',
            description: `Authentication failed: ${event.data.error}`,
            variant: 'destructive',
          })
          popup?.close()
        }
      }

      window.addEventListener('message', handleMessage)

      // Clean up listener when popup closes
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          setIsAuthenticating(false)
        }
      }, 1000)
    } catch (error) {
      console.error('Error starting auth:', error)
      toast({
        title: 'Error',
        description: 'Failed to start Google Calendar authentication',
        variant: 'destructive',
      })
      setIsAuthenticating(false)
    }
  }

  const handleRevokeCalendarAccess = async () => {
    try {
      await predefinedToolsService.revokeCalendarAccess()
      toast({
        title: 'Success',
        description: 'Google Calendar access revoked successfully',
      })
      loadData() // Refresh status
    } catch (error) {
      console.error('Error revoking access:', error)
      toast({
        title: 'Error',
        description: 'Failed to revoke Google Calendar access',
        variant: 'destructive',
      })
    }
  }

  const handleToggleCalendarTool = async (enabled: boolean) => {
    try {
      await predefinedToolsService.toggleCalendarTool(enabled, calendarConfig)
      toast({
        title: 'Success',
        description: `Calendar management tool ${enabled ? 'enabled' : 'disabled'} successfully`,
      })
      loadData() // Refresh status
    } catch (error) {
      console.error('Error toggling calendar tool:', error)
      toast({
        title: 'Error',
        description: 'Failed to update calendar tool configuration',
        variant: 'destructive',
      })
    }
  }

  const handleSaveCalendarConfig = async () => {
    try {
      await predefinedToolsService.toggleCalendarTool(
        calendarStatus.enabled,
        calendarConfig,
      )
      toast({
        title: 'Success',
        description: 'Calendar configuration saved successfully',
      })
    } catch (error) {
      console.error('Error saving config:', error)
      toast({
        title: 'Error',
        description: 'Failed to save calendar configuration',
        variant: 'destructive',
      })
    }
  }

  const getStatusBadge = (status: CalendarToolStatus) => {
    if (status.ready) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ready
        </Badge>
      )
    } else if (status.hasAuth && !status.enabled) {
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Connected, Not Enabled
        </Badge>
      )
    } else if (!status.hasAuth) {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Not Connected
        </Badge>
      )
    }
    return <Badge variant="outline">Unknown</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        Loading predefined tools...
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Predefined Tools</h1>
          <p className="text-muted-foreground">
            Enable and configure powerful predefined tools for your assistant
          </p>
        </div>
      </div>

      {/* Calendar Management Tool */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <CardTitle>Calendar Management</CardTitle>
              {getStatusBadge(calendarStatus)}
            </div>
            <Switch
              checked={calendarStatus.enabled}
              onCheckedChange={handleToggleCalendarTool}
              disabled={!calendarStatus.hasAuth}
            />
          </div>
          <CardDescription>
            Enable your assistant to manage Google Calendar events, check
            availability, and schedule meetings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authentication Section */}
          <div className="space-y-3">
            <h4 className="font-semibold">Google Calendar Authentication</h4>
            {!calendarStatus.hasAuth ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Connect your Google Calendar to enable calendar management
                  features.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Google Calendar is connected and ready to use.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              {!calendarStatus.hasAuth ? (
                <Button
                  onClick={handleCalendarAuth}
                  disabled={isAuthenticating}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  {isAuthenticating
                    ? 'Connecting...'
                    : 'Connect Google Calendar'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleRevokeCalendarAccess}
                  className="flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Disconnect Calendar
                </Button>
              )}
            </div>
          </div>

          {/* Configuration Section */}
          {calendarStatus.hasAuth && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configuration
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultCalendarId">
                      Default Calendar ID
                    </Label>
                    <Input
                      id="defaultCalendarId"
                      value={calendarConfig.defaultCalendarId || ''}
                      onChange={(e) =>
                        setCalendarConfig((prev) => ({
                          ...prev,
                          defaultCalendarId: e.target.value,
                        }))
                      }
                      placeholder="primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use 'primary' for your main calendar
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeZone">Time Zone</Label>
                    <Input
                      id="timeZone"
                      value={calendarConfig.timeZone || ''}
                      onChange={(e) =>
                        setCalendarConfig((prev) => ({
                          ...prev,
                          timeZone: e.target.value,
                        }))
                      }
                      placeholder="America/New_York"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workingHoursStart">
                      Working Hours Start
                    </Label>
                    <Input
                      id="workingHoursStart"
                      type="time"
                      value={calendarConfig.workingHours?.start || '09:00'}
                      onChange={(e) =>
                        setCalendarConfig((prev) => ({
                          ...prev,
                          workingHours: {
                            ...prev.workingHours!,
                            start: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workingHoursEnd">Working Hours End</Label>
                    <Input
                      id="workingHoursEnd"
                      type="time"
                      value={calendarConfig.workingHours?.end || '17:00'}
                      onChange={(e) =>
                        setCalendarConfig((prev) => ({
                          ...prev,
                          workingHours: {
                            ...prev.workingHours!,
                            end: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lunchTimeStart">Lunch Time Start</Label>
                    <Input
                      id="lunchTimeStart"
                      type="time"
                      value={calendarConfig.lunchTime?.start || '12:00'}
                      onChange={(e) =>
                        setCalendarConfig((prev) => ({
                          ...prev,
                          lunchTime: {
                            ...prev.lunchTime!,
                            start: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lunchTimeEnd">Lunch Time End</Label>
                    <Input
                      id="lunchTimeEnd"
                      type="time"
                      value={calendarConfig.lunchTime?.end || '13:00'}
                      onChange={(e) =>
                        setCalendarConfig((prev) => ({
                          ...prev,
                          lunchTime: {
                            ...prev.lunchTime!,
                            end: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bufferTime">
                      Buffer Time Between Events (minutes)
                    </Label>
                    <Input
                      id="bufferTime"
                      type="number"
                      min="0"
                      value={calendarConfig.bufferTimeBetweenEvents || 0}
                      onChange={(e) =>
                        setCalendarConfig((prev) => ({
                          ...prev,
                          bufferTimeBetweenEvents:
                            parseInt(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Buffer time to leave between scheduled events
                    </p>
                  </div>
                </div>

                {/* Allowed Week Days */}
                <div className="space-y-3">
                  <Label>Allowed Days for Scheduling</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: 'monday', label: 'Monday' },
                      { key: 'tuesday', label: 'Tuesday' },
                      { key: 'wednesday', label: 'Wednesday' },
                      { key: 'thursday', label: 'Thursday' },
                      { key: 'friday', label: 'Friday' },
                      { key: 'saturday', label: 'Saturday' },
                      { key: 'sunday', label: 'Sunday' },
                    ].map((day) => (
                      <div
                        key={day.key}
                        className="flex items-center space-x-2"
                      >
                        <Switch
                          id={day.key}
                          checked={
                            calendarConfig.allowedWeekDays?.[
                              day.key as keyof typeof calendarConfig.allowedWeekDays
                            ] || false
                          }
                          onCheckedChange={(checked) =>
                            setCalendarConfig((prev) => ({
                              ...prev,
                              allowedWeekDays: {
                                ...prev.allowedWeekDays!,
                                [day.key]: checked,
                              },
                            }))
                          }
                        />
                        <Label htmlFor={day.key} className="text-sm">
                          {day.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select which days of the week are available for scheduling
                    events
                  </p>
                </div>

                <Button
                  onClick={handleSaveCalendarConfig}
                  className="w-full md:w-auto"
                >
                  Save Configuration
                </Button>
              </div>
            </>
          )}

          {/* Available Functions */}
          {calendarStatus.ready && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold">Available Functions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>fetchCalendarEvents</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>createCalendarEvent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>checkEventAvailability</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>suggestEventTimes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>cancelCalendarEvent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>checkAndCancelEventIfEligible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>checkEventCancellationEligibility</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact Management Tool */}
      <ContactsManagementPage />

      {/* Future tools can be added here */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-muted-foreground">
              More Tools Coming Soon
            </h3>
            <p className="text-sm text-muted-foreground">
              Additional predefined tools like email automation, CRM
              integration, and more will be available soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
