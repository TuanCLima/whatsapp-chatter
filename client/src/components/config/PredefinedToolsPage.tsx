import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ExternalLink,
  MessageSquare,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  type CalendarToolConfig,
  type CalendarToolStatus,
  predefinedToolsService,
  type RefereeContactToolStatus,
} from '@/services/PredefinedToolsService'
import ContactsManagementPage from './ContactsManagementPage'
import WeeklyScheduler, { type WeekSchedule } from './WeeklyScheduler'

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
    weeklySchedule: {
      monday: { enabled: true, blocks: [{ id: '1', start: 540, end: 1020 }] },
      tuesday: { enabled: true, blocks: [{ id: '2', start: 540, end: 1020 }] },
      wednesday: {
        enabled: true,
        blocks: [{ id: '3', start: 540, end: 1020 }],
      },
      thursday: { enabled: true, blocks: [{ id: '4', start: 540, end: 1020 }] },
      friday: { enabled: true, blocks: [{ id: '5', start: 540, end: 1020 }] },
      saturday: { enabled: false, blocks: [] },
      sunday: { enabled: false, blocks: [] },
    },
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [showCalendarSelector, setShowCalendarSelector] = useState(false)
  const [availableCalendars, setAvailableCalendars] = useState<
    Array<{
      id: string
      summary: string
      description?: string
      primary?: boolean
      accessRole?: string
      backgroundColor?: string
    }>
  >([])
  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [refereeContactStatus, setRefereeContactStatus] =
    useState<RefereeContactToolStatus>({
      ready: false,
      enabled: false,
      configured: false,
    })
  const [refereePhoneNumber, setRefereePhoneNumber] = useState('')
  const { toast } = useToast()

  // Load data on component mount
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [toolsResponse, statusResponse, refereeStatus] = await Promise.all([
        predefinedToolsService.getPredefinedTools(),
        predefinedToolsService.getCalendarStatus(),
        predefinedToolsService.getRefereeContactStatus(),
      ])

      setCalendarStatus(statusResponse)
      setRefereeContactStatus(refereeStatus)

      // Load calendar config if it exists
      const calendarTool = toolsResponse.tools.find(
        (tool) => tool.toolType === 'calendar_management',
      )
      if (calendarTool?.configData) {
        const configData = calendarTool.configData as CalendarToolConfig

        // Migrate old format to new if needed
        if (!configData.weeklySchedule && configData.allowedWeekDays) {
          // Create default weekly schedule from old format
          const defaultSchedule: WeekSchedule = {
            monday: {
              enabled: configData.allowedWeekDays.monday,
              blocks: configData.allowedWeekDays.monday
                ? [
                    { id: 'mon-morning', start: 540, end: 720 },
                    { id: 'mon-afternoon', start: 780, end: 1020 },
                  ]
                : [],
            },
            tuesday: {
              enabled: configData.allowedWeekDays.tuesday,
              blocks: configData.allowedWeekDays.tuesday
                ? [
                    { id: 'tue-morning', start: 540, end: 720 },
                    { id: 'tue-afternoon', start: 780, end: 1020 },
                  ]
                : [],
            },
            wednesday: {
              enabled: configData.allowedWeekDays.wednesday,
              blocks: configData.allowedWeekDays.wednesday
                ? [
                    { id: 'wed-morning', start: 540, end: 720 },
                    { id: 'wed-afternoon', start: 780, end: 1020 },
                  ]
                : [],
            },
            thursday: {
              enabled: configData.allowedWeekDays.thursday,
              blocks: configData.allowedWeekDays.thursday
                ? [
                    { id: 'thu-morning', start: 540, end: 720 },
                    { id: 'thu-afternoon', start: 780, end: 1020 },
                  ]
                : [],
            },
            friday: {
              enabled: configData.allowedWeekDays.friday,
              blocks: configData.allowedWeekDays.friday
                ? [
                    { id: 'fri-morning', start: 540, end: 720 },
                    { id: 'fri-afternoon', start: 780, end: 1020 },
                  ]
                : [],
            },
            saturday: {
              enabled: configData.allowedWeekDays.saturday,
              blocks: configData.allowedWeekDays.saturday
                ? [
                    { id: 'sat-morning', start: 540, end: 720 },
                    { id: 'sat-afternoon', start: 780, end: 1020 },
                  ]
                : [],
            },
            sunday: {
              enabled: configData.allowedWeekDays.sunday,
              blocks: configData.allowedWeekDays.sunday
                ? [
                    { id: 'sun-morning', start: 540, end: 720 },
                    { id: 'sun-afternoon', start: 780, end: 1020 },
                  ]
                : [],
            },
          }
          configData.weeklySchedule = defaultSchedule
        }
        setCalendarConfig((prev) => ({ ...prev, ...configData }))
      }

      // Load referee contact config if it exists
      const refereeTool = toolsResponse.tools.find(
        (tool) => tool.toolType === 'referee_contact',
      )
      if (refereeTool?.configData) {
        const configData = refereeTool.configData as {
          refereePhoneNumber?: string
        }
        if (configData.refereePhoneNumber) {
          setRefereePhoneNumber(configData.refereePhoneNumber)
        }
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

  const handleOpenCalendarSelector = async () => {
    setLoadingCalendars(true)
    setShowCalendarSelector(true)
    try {
      const { calendars } = await predefinedToolsService.listCalendars()
      setAvailableCalendars(calendars)
    } catch (error) {
      console.error('Error loading calendars:', error)
      toast({
        title: 'Error',
        description: 'Failed to load calendar list',
        variant: 'destructive',
      })
      setShowCalendarSelector(false)
    } finally {
      setLoadingCalendars(false)
    }
  }

  const handleSelectCalendar = (calendarId: string) => {
    setCalendarConfig((prev) => ({
      ...prev,
      defaultCalendarId: calendarId,
    }))
    setShowCalendarSelector(false)
    toast({
      title: 'Calendar Selected',
      description:
        'Calendar has been updated. Remember to save your configuration.',
    })
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

  const getRefereeStatusBadge = (status: RefereeContactToolStatus) => {
    if (status.ready) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ready
        </Badge>
      )
    } else if (status.enabled && !status.configured) {
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Not Configured
        </Badge>
      )
    } else {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Disabled
        </Badge>
      )
    }
  }

  const handleToggleRefereeContact = async (enabled: boolean) => {
    if (enabled && !refereePhoneNumber) {
      toast({
        title: 'Error',
        description: 'Please enter a referee phone number first',
        variant: 'destructive',
      })
      return
    }

    try {
      await predefinedToolsService.toggleRefereeContactTool(
        enabled,
        refereePhoneNumber,
      )
      toast({
        title: 'Success',
        description: `Referee contact tool ${enabled ? 'enabled' : 'disabled'} successfully`,
      })
      loadData() // Refresh status
    } catch (error) {
      console.error('Error toggling referee contact tool:', error)
      toast({
        title: 'Error',
        description: 'Failed to update referee contact tool',
        variant: 'destructive',
      })
    }
  }

  const handleSaveRefereeConfig = async () => {
    if (!refereePhoneNumber) {
      toast({
        title: 'Error',
        description: 'Please enter a referee phone number',
        variant: 'destructive',
      })
      return
    }

    try {
      await predefinedToolsService.toggleRefereeContactTool(
        refereeContactStatus.enabled,
        refereePhoneNumber,
      )
      toast({
        title: 'Success',
        description: 'Referee contact configuration saved successfully',
      })
      loadData() // Refresh status
    } catch (error) {
      console.error('Error saving referee config:', error)
      toast({
        title: 'Error',
        description: 'Failed to save referee contact configuration',
        variant: 'destructive',
      })
    }
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
                    <Label htmlFor="defaultCalendarId">Selected Calendar</Label>
                    <div className="flex gap-2">
                      <Input
                        id="defaultCalendarId"
                        value={calendarConfig.defaultCalendarId || ''}
                        readOnly
                        placeholder="No calendar selected"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleOpenCalendarSelector}
                      >
                        Select
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click "Select" to choose from your available calendars
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

                {/* Weekly Scheduler */}
                <div className="space-y-3 pt-4">
                  <WeeklyScheduler
                    schedule={calendarConfig.weeklySchedule!}
                    onChange={(weeklySchedule) =>
                      setCalendarConfig((prev) => ({
                        ...prev,
                        weeklySchedule,
                      }))
                    }
                  />
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

      {/* Referee Contact Tool */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <CardTitle>Referee Contact</CardTitle>
              {getRefereeStatusBadge(refereeContactStatus)}
            </div>
            <Switch
              checked={refereeContactStatus.enabled}
              onCheckedChange={handleToggleRefereeContact}
            />
          </div>
          <CardDescription>
            Allow your assistant to send messages to a designated
            referee/supervisor number when it needs help answering questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Configuration Section */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configuration
            </h4>

            <div className="space-y-2">
              <Label htmlFor="refereePhoneNumber">
                Referee WhatsApp Number
              </Label>
              <Input
                id="refereePhoneNumber"
                type="tel"
                placeholder="+5511999999999"
                value={refereePhoneNumber}
                onChange={(e) => setRefereePhoneNumber(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Enter the WhatsApp number (with country code) that should
                receive questions from the assistant. Format: +5511999999999
              </p>
            </div>

            <Button
              onClick={handleSaveRefereeConfig}
              className="w-full md:w-auto"
            >
              Save Configuration
            </Button>
          </div>

          {/* Available Functions */}
          {refereeContactStatus.ready && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold">Available Functions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>contactReferee</span>
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

      {/* Calendar Selection Dialog */}
      <Dialog
        open={showCalendarSelector}
        onOpenChange={setShowCalendarSelector}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select a Calendar</DialogTitle>
            <DialogDescription>
              Choose which calendar you want to use for managing events
            </DialogDescription>
          </DialogHeader>

          {loadingCalendars ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading calendars...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableCalendars.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No calendars found</p>
                </div>
              ) : (
                availableCalendars.map((calendar) => (
                  <button
                    key={calendar.id}
                    type="button"
                    className={`w-full p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors text-left ${
                      calendarConfig.defaultCalendarId === calendar.id
                        ? 'border-primary bg-accent'
                        : ''
                    }`}
                    onClick={() => handleSelectCalendar(calendar.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{calendar.summary}</h4>
                          {calendar.primary && (
                            <Badge variant="default" className="text-xs">
                              Primary
                            </Badge>
                          )}
                        </div>
                        {calendar.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {calendar.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Access: {calendar.accessRole || 'N/A'}
                        </p>
                      </div>
                      {calendar.backgroundColor && (
                        <div
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: calendar.backgroundColor }}
                        />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
