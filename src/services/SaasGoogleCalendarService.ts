import { and, eq } from 'drizzle-orm'
import type { OAuth2Client } from 'google-auth-library'
import { type calendar_v3, google } from 'googleapis'
import moment from 'moment-timezone'
import { db } from '../db'
import { predefinedToolsConfig, saasUsers } from '../db/schema-postgres'
import {
  type AvailableTimeSpan,
  findAvailableTimeSpans,
  formatDateInSaoPaulo,
  formatTimeInSaoPaulo,
  type TimeSuggestion,
} from '../mcp/mcpService'

interface CalendarConfig {
  defaultCalendarId: string
  workingHours: { start: string; end: string }
  lunchTime: { start: string; end: string }
  allowedWeekDays: {
    monday: boolean
    tuesday: boolean
    wednesday: boolean
    thursday: boolean
    friday: boolean
    saturday: boolean
    sunday: boolean
  }
  bufferTimeBetweenEvents: number // in minutes
  timeZone: string
}

/**
 * Google Calendar service for SaaS users with per-user authentication
 */
export class SaasGoogleCalendarService {
  private static instance: SaasGoogleCalendarService
  private credentials: {
    web: { client_secret: string; client_id: string; redirect_uris: string[] }
  } | null = null

  constructor() {
    this.initializeCredentials()
  }

  static getInstance(): SaasGoogleCalendarService {
    if (!SaasGoogleCalendarService.instance) {
      SaasGoogleCalendarService.instance = new SaasGoogleCalendarService()
    }
    return SaasGoogleCalendarService.instance
  }

  /**
   * Helper method to check if a day is allowed based on configuration
   */
  private isDayAllowed(
    dayOfWeek: number,
    allowedWeekDays: CalendarConfig['allowedWeekDays'],
  ): boolean {
    const dayMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    } as const

    return allowedWeekDays[dayMap[dayOfWeek as keyof typeof dayMap]]
  }

  /**
   * Helper method to parse time string (HH:mm) and return hour and minute
   */
  private parseTime(timeString: string): { hour: number; minute: number } {
    const [hour, minute] = timeString.split(':').map(Number)
    return { hour, minute }
  }

  /**
   * Helper method to check if a time overlaps with lunch time
   */
  private isInLunchTime(
    startTime: moment.Moment,
    endTime: moment.Moment,
    lunchConfig: CalendarConfig['lunchTime'],
  ): boolean {
    const lunchStart = this.parseTime(lunchConfig.start)
    const lunchEnd = this.parseTime(lunchConfig.end)

    // Use format('H') and format('m') to get 24-hour format values
    const eventStartMinutes =
      parseInt(startTime.format('H')) * 60 + parseInt(startTime.format('m'))
    const eventEndMinutes =
      parseInt(endTime.format('H')) * 60 + parseInt(endTime.format('m'))
    const lunchStartMinutes = lunchStart.hour * 60 + lunchStart.minute
    const lunchEndMinutes = lunchEnd.hour * 60 + lunchEnd.minute

    // Check if event overlaps with lunch time
    // Two time intervals overlap if: max(start1, start2) < min(end1, end2)
    return (
      Math.max(eventStartMinutes, lunchStartMinutes) <
      Math.min(eventEndMinutes, lunchEndMinutes)
    )
  }

  /**
   * Helper method to check if a time is outside business hours
   */
  private isOutsideBusinessHours(
    startTime: moment.Moment,
    endTime: moment.Moment,
    workingHours: CalendarConfig['workingHours'],
  ): boolean {
    const workStart = this.parseTime(workingHours.start)
    const workEnd = this.parseTime(workingHours.end)

    // Use format('H') and format('m') to get 24-hour format values
    const startHour = parseInt(startTime.format('H'))
    const startMinutes = parseInt(startTime.format('m'))
    const endHour = parseInt(endTime.format('H'))
    const endMinutes = parseInt(endTime.format('m'))

    // Check if start is before business hours
    const isStartTooEarly =
      startHour < workStart.hour ||
      (startHour === workStart.hour && startMinutes < workStart.minute)

    // Check if end is after business hours
    const isEndTooLate =
      endHour > workEnd.hour ||
      (endHour === workEnd.hour && endMinutes > workEnd.minute)

    return isStartTooEarly || isEndTooLate
  }

  private async initializeCredentials() {
    try {
      // Try environment variable first, then file
      let file: string
      if (process.env.GOOGLE_CREDENTIALS) {
        try {
          file = Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString(
            'utf-8',
          )
        } catch {
          file = process.env.GOOGLE_CREDENTIALS
        }
        this.credentials = JSON.parse(file)
      } else {
        console.warn(
          'GOOGLE_CREDENTIALS environment variable not set. Google Calendar features will not be available.',
        )
        // Set dummy credentials for development
        this.credentials = {
          web: {
            client_id: 'dummy',
            client_secret: 'dummy',
            redirect_uris: ['http://localhost:3000/oauth/callback'],
          },
        }
      }
    } catch (error) {
      console.error(
        'Failed to initialize Google credentials for SaaS calendar service:',
        error,
      )
      // Set dummy credentials as fallback
      this.credentials = {
        web: {
          client_id: 'dummy',
          client_secret: 'dummy',
          redirect_uris: ['http://localhost:3000/oauth/callback'],
        },
      }
    }
  }

  /**
   * Create OAuth2 client for a specific user
   */
  private createOAuth2Client(userTokens?: {
    accessToken: string
    refreshToken: string
    expiry?: Date
  }): OAuth2Client {
    if (!this.credentials?.web) {
      throw new Error('Google credentials not properly initialized')
    }

    const { client_secret, client_id, redirect_uris } = this.credentials.web
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      process.env.NODE_ENV === 'production'
        ? redirect_uris[1]
        : redirect_uris[0],
    )

    if (userTokens) {
      oAuth2Client.setCredentials({
        access_token: userTokens.accessToken,
        refresh_token: userTokens.refreshToken,
        expiry_date: userTokens.expiry?.getTime(),
      })
    }

    return oAuth2Client
  }

  /**
   * Generate authorization URL for a user
   */
  generateAuthUrl(): string {
    const oAuth2Client = this.createOAuth2Client()
    console.log('Google OAuth credentials:', {
      client_id: this.credentials?.web?.client_id,
      redirect_uris: this.credentials?.web?.redirect_uris,
    })
    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar'],
    })
  }

  /**
   * Exchange authorization code for tokens and save to database
   */
  async exchangeCodeForTokens(code: string, saasUserId: string): Promise<void> {
    const oAuth2Client = this.createOAuth2Client()

    console.log('Exchanging code for tokens:', {
      code: `${code.substring(0, 20)}...`, // Log first 20 chars for debugging
      saasUserId,
      redirect_uri:
        this.credentials?.web?.redirect_uris?.[
          process.env.NODE_ENV === 'production' ? 1 : 0
        ],
    })

    try {
      const { tokens } = await oAuth2Client.getToken(code)

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain valid tokens from Google')
      }

      // Save tokens to database
      await db
        .update(saasUsers)
        .set({
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token,
          googleTokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null,
          googleCalendarEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(saasUsers.id, saasUserId))
    } catch (error) {
      console.error('Error exchanging code for tokens:', error)
      throw error
    }
  }

  /**
   * Get user's calendar configuration from database
   */
  private async getUserCalendarConfig(
    saasUserId: string,
  ): Promise<CalendarConfig> {
    try {
      const config = await db
        .select({
          configData: predefinedToolsConfig.configData,
        })
        .from(predefinedToolsConfig)
        .where(
          and(
            eq(predefinedToolsConfig.saasUserId, saasUserId),
            eq(predefinedToolsConfig.toolType, 'calendar_management'),
          ),
        )
        .limit(1)

      if (config.length > 0 && config[0].configData) {
        const parsedConfig = JSON.parse(config[0].configData)
        const configuredCalendarId =
          decodeURIComponent(parsedConfig.defaultCalendarId) || 'primary'
        const result = {
          defaultCalendarId: configuredCalendarId,
          workingHours: parsedConfig.workingHours || {
            start: '09:00',
            end: '17:00',
          },
          lunchTime: parsedConfig.lunchTime || {
            start: '12:00',
            end: '13:00',
          },
          allowedWeekDays: parsedConfig.allowedWeekDays || {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true,
            sunday: false,
          },
          bufferTimeBetweenEvents: parsedConfig.bufferTimeBetweenEvents || 0,
          timeZone:
            parsedConfig.timeZone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        }
        console.log('Retrieved user calendar config from DB:', result)
        return result
      }
    } catch (error) {
      console.error('Error fetching user calendar config:', error)
    }

    // Return default config if none found or error occurred
    const defaultConfig = {
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
    }
    console.log('Using default calendar config:', defaultConfig)
    return defaultConfig
  }

  /**
   * Get user's tokens from database and refresh if needed
   */
  private async getUserTokens(
    saasUserId: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiry?: Date }> {
    const user = await db
      .select({
        googleAccessToken: saasUsers.googleAccessToken,
        googleRefreshToken: saasUsers.googleRefreshToken,
        googleTokenExpiry: saasUsers.googleTokenExpiry,
      })
      .from(saasUsers)
      .where(eq(saasUsers.id, saasUserId))
      .limit(1)

    if (
      !user.length ||
      !user[0].googleAccessToken ||
      !user[0].googleRefreshToken
    ) {
      throw new Error('User has not authorized Google Calendar access')
    }

    const userData = user[0]
    const accessToken = userData.googleAccessToken!
    const refreshToken = userData.googleRefreshToken!
    const now = new Date()
    const expiry = userData.googleTokenExpiry

    // Check if token needs refresh (5 minutes buffer)
    if (expiry && expiry.getTime() <= now.getTime() + 5 * 60 * 1000) {
      const oAuth2Client = this.createOAuth2Client({
        accessToken,
        refreshToken,
        expiry: expiry,
      })

      try {
        const { credentials } = await oAuth2Client.refreshAccessToken()

        // Update database with new tokens
        await db
          .update(saasUsers)
          .set({
            googleAccessToken: credentials.access_token!,
            googleTokenExpiry: credentials.expiry_date
              ? new Date(credentials.expiry_date)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(saasUsers.id, saasUserId))

        return {
          accessToken: credentials.access_token!,
          refreshToken,
          expiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : undefined,
        }
      } catch (error: unknown) {
        console.error('Error refreshing token:', error)

        // Handle specific invalid_grant error
        if (error && typeof error === 'object' && 'response' in error) {
          const gaxiosError = error as any
          if (gaxiosError.response?.data?.error === 'invalid_grant') {
            // Clear invalid tokens from database
            await db
              .update(saasUsers)
              .set({
                googleAccessToken: null,
                googleRefreshToken: null,
                googleTokenExpiry: null,
                updatedAt: new Date(),
              })
              .where(eq(saasUsers.id, saasUserId))

            throw new Error(
              'Google Calendar authorization has expired. Please re-connect your Google Calendar account.',
            )
          }
        }

        throw new Error('Failed to refresh Google Calendar access token')
      }
    }

    return {
      accessToken,
      refreshToken,
      expiry: expiry || undefined,
    }
  }

  /**
   * Fetch calendar events for a user
   */
  async fetchCalendarEvents(
    saasUserId: string,
    timeMin?: string,
    timeMax?: string,
    maxResults?: number,
    calendarId?: string,
  ): Promise<calendar_v3.Schema$Event[]> {
    const tokens = await this.getUserTokens(saasUserId)
    const oAuth2Client = this.createOAuth2Client(tokens)
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

    // Get user's calendar configuration if calendarId not provided
    const userConfig = await this.getUserCalendarConfig(saasUserId)
    const effectiveCalendarId = calendarId || userConfig.defaultCalendarId

    try {
      const response = await calendar.events.list({
        calendarId: effectiveCalendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax || moment().add(1, 'month').toISOString(),
        maxResults: maxResults || 100,
        singleEvents: true,
        orderBy: 'startTime',
      })

      return response.data.items || []
    } catch (error: unknown) {
      console.error('Calendar ID that failed:', effectiveCalendarId)

      // Handle authorization errors
      if (error && typeof error === 'object' && 'response' in error) {
        const gaxiosError = error as any
        if (
          gaxiosError.response?.status === 401 ||
          gaxiosError.response?.data?.error === 'invalid_grant'
        ) {
          // Clear invalid tokens from database
          await db
            .update(saasUsers)
            .set({
              googleAccessToken: null,
              googleRefreshToken: null,
              googleTokenExpiry: null,
              updatedAt: new Date(),
            })
            .where(eq(saasUsers.id, saasUserId))

          throw new Error(
            'Google Calendar authorization has expired. Please re-connect your Google Calendar account.',
          )
        }
      }

      throw error
    }
  }

  /**
   * Create a calendar event for a user
   */
  async createCalendarEvent(
    saasUserId: string,
    event: calendar_v3.Schema$Event,
    calendarId?: string,
  ): Promise<calendar_v3.Schema$Event> {
    const tokens = await this.getUserTokens(saasUserId)
    const oAuth2Client = this.createOAuth2Client(tokens)
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

    // Get user's calendar configuration if calendarId not provided
    const userConfig = await this.getUserCalendarConfig(saasUserId)
    const effectiveCalendarId = calendarId || userConfig.defaultCalendarId

    try {
      const response = await calendar.events.insert({
        calendarId: effectiveCalendarId,
        requestBody: event,
      })

      return response.data
    } catch (error) {
      console.error('Error creating calendar event:', error)
      throw error
    }
  }

  /**
   * Check event availability for a user
   */
  async checkEventAvailability(
    saasUserId: string,
    proposedStartTime: string,
    proposedEndTime: string,
    serviceDurationMinutes: number,
    calendarId?: string,
  ) {
    try {
      // Get user's calendar configuration if calendarId not provided
      const userConfig = await this.getUserCalendarConfig(saasUserId)
      const effectiveCalendarId = calendarId || userConfig.defaultCalendarId

      // Parse the proposed times
      const startDate = new Date(proposedStartTime)
      const endDate = new Date(proposedEndTime)

      // Check if the proposed time is valid
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return {
          available: false,
          message:
            'Horário inválido fornecido. Por favor, forneça um horário válido.',
          conflicts: [],
          availableTimeSpans: [],
        }
      }

      // Check if day is allowed based on configuration
      // Use timezone for day of week check
      const dayOfWeek = moment.tz(startDate, userConfig.timeZone).day() // 0 = Sunday, 1 = Monday
      if (!this.isDayAllowed(dayOfWeek, userConfig.allowedWeekDays)) {
        const dayNames = [
          'domingo',
          'segunda',
          'terça',
          'quarta',
          'quinta',
          'sexta',
          'sábado',
        ]
        const allowedDays = Object.entries(userConfig.allowedWeekDays)
          .filter(([_, allowed]) => allowed)
          .map(([day, _]) => {
            const dayIndex = [
              'sunday',
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
            ].indexOf(day)
            return dayNames[dayIndex]
          })
          .join(', ')

        return {
          available: false,
          message: `Este dia não está disponível para agendamentos. Dias permitidos: ${allowedDays}.`,
          conflicts: ['day_not_allowed'],
          availableTimeSpans: [],
        }
      }

      // Convert to user's configured timezone for hour/minute checks
      const startDateTZ = moment.tz(startDate, userConfig.timeZone)
      const endDateTZ = moment.tz(endDate, userConfig.timeZone)

      // Check if event overlaps with lunch time
      const isLunchConflict = this.isInLunchTime(
        startDateTZ,
        endDateTZ,
        userConfig.lunchTime,
      )

      // Check if it's outside business hours
      const isOutsideHours = this.isOutsideBusinessHours(
        startDateTZ,
        endDateTZ,
        userConfig.workingHours,
      )

      // Fetch existing events to check for conflicts and find available time spans
      // Use user's configured timezone for day boundaries
      const dayStartTZ = moment
        .tz(startDate, userConfig.timeZone)
        .startOf('day')
      const dayEndTZ = moment.tz(startDate, userConfig.timeZone).endOf('day')
      const dayStart = dayStartTZ.toDate()
      const dayEnd = dayEndTZ.toDate()

      try {
        const events = await this.fetchCalendarEvents(
          saasUserId,
          dayStart.toISOString(),
          dayEnd.toISOString(),
          100,
          effectiveCalendarId,
        )

        // Find available time spans for the requested day
        const availableTimeSpans = findAvailableTimeSpans(
          startDate,
          serviceDurationMinutes,
          events,
        )

        const conflicts: string[] = []
        const conflictingEvents: Array<{
          id?: string | null
          summary?: string | null
          start: string
          end: string
        }> = []

        // Check for conflicts with existing events
        for (const event of events) {
          if (!event.start?.dateTime || !event.end?.dateTime) continue

          const eventStart = new Date(event.start.dateTime)
          const eventEnd = new Date(event.end.dateTime)

          // Use configured buffer time between events
          const bufferMinutes = userConfig.bufferTimeBetweenEvents
          const eventStartWithBuffer = new Date(
            eventStart.getTime() - bufferMinutes * 60000,
          )
          const eventEndWithBuffer = new Date(
            eventEnd.getTime() + bufferMinutes * 60000,
          )

          // Check if proposed event overlaps with existing event (considering buffer)
          const hasOverlap =
            (startDate < eventEndWithBuffer &&
              endDate > eventStartWithBuffer) ||
            (startDate < eventEnd && endDate > eventStart)

          if (hasOverlap) {
            conflicts.push(`event_${event.id}`)
            conflictingEvents.push({
              id: event.id,
              summary: event.summary,
              start: event.start.dateTime,
              end: event.end.dateTime,
            })
          }
        }

        // Check for lunch time conflict
        if (isLunchConflict) {
          conflicts.push('lunch_time')
        }

        // Check for business hours conflict
        if (isOutsideHours) {
          conflicts.push('outside_business_hours')
        }

        if (conflicts.length > 0) {
          let conflictMessage = ''

          if (conflicts.includes('lunch_time')) {
            conflictMessage = `Este horário não está disponível pois conflita com o horário de almoço (${userConfig.lunchTime.start}-${userConfig.lunchTime.end}).`
          } else if (conflicts.includes('outside_business_hours')) {
            conflictMessage = `Este horário está fora do horário de funcionamento (${userConfig.workingHours.start}-${userConfig.workingHours.end}).`
          } else {
            const conflictDetails = conflictingEvents
              .map(
                (e) =>
                  `${e.summary || 'Evento'} (${formatTimeInSaoPaulo(e.start)}-${formatTimeInSaoPaulo(e.end)})`,
              )
              .join(', ')
            const bufferMessage =
              userConfig.bufferTimeBetweenEvents > 0
                ? ` (incluindo ${userConfig.bufferTimeBetweenEvents} minutos de intervalo entre eventos)`
                : ''
            conflictMessage = `Este horário não está disponível pois conflita com: ${conflictDetails}${bufferMessage}.`
          }

          // Format available time spans for the message
          const availableSpansMessage =
            availableTimeSpans.length > 0
              ? ` Horários disponíveis no dia ${formatDateInSaoPaulo(startDate.toISOString())}: ${availableTimeSpans
                  .map(
                    (span) =>
                      `${formatTimeInSaoPaulo(span.startTime)}-${formatTimeInSaoPaulo(span.endTime)} (${span.duration} minutos disponíveis)`,
                  )
                  .join(', ')}.`
              : ' Não há horários disponíveis neste dia.'

          return {
            available: false,
            message: conflictMessage + availableSpansMessage,
            conflicts,
            conflictingEvents,
            availableTimeSpans,
          }
        } else {
          return {
            available: true,
            message: `Horário disponível! O agendamento pode ser feito das ${formatTimeInSaoPaulo(startDate.toISOString())} às ${formatTimeInSaoPaulo(endDate.toISOString())} no dia ${formatDateInSaoPaulo(startDate.toISOString())}.`,
            conflicts: [],
            availableTimeSpans,
          }
        }
      } catch (error) {
        return {
          available: false,
          message: `Erro ao verificar disponibilidade. Por favor, tente novamente. error.message: ${(error as Error).message}`,
          conflicts: [],
          availableTimeSpans: [],
        }
      }
    } catch {
      return {
        available: false,
        message:
          'Erro ao verificar disponibilidade. Por favor, tente novamente.',
        conflicts: [],
        availableTimeSpans: [],
      }
    }
  }

  async suggestEventTimes(
    saasUserId: string,
    serviceDurationMinutes: number, // in minutes
    startDate?: string,
    endDate?: string,
    _workingHours?: { start: string; end: string } | undefined,
    calendarId?: string,
  ) {
    try {
      const userConfig = await this.getUserCalendarConfig(saasUserId)

      // Use provided parameters or fall back to user config
      const effectiveCalendarId = calendarId || userConfig.defaultCalendarId

      const currentDateTZ = startDate
        ? moment.tz(startDate, userConfig.timeZone)
        : moment.tz(new Date(), userConfig.timeZone)
      const endDateTZ = endDate
        ? moment.tz(endDate, userConfig.timeZone)
        : currentDateTZ.clone().add(14, 'days')

      const daysToConsider = endDateTZ.diff(currentDateTZ, 'days') + 1

      const timeMin = currentDateTZ.startOf('day').toISOString()
      const timeMax = endDateTZ.endOf('day').toISOString()

      const events = await this.fetchCalendarEvents(
        saasUserId,
        timeMin,
        timeMax,
        100,
        effectiveCalendarId,
      )

      try {
        // Fetch all events in the time range
        const availableChunks: AvailableTimeSpan[] = []
        const suggestions: TimeSuggestion[] = []

        // Group events by date for processing
        const eventsByDate: Record<string, unknown[]> = {}
        for (const event of events) {
          if (!event.start?.dateTime) continue
          const eventDate = moment
            .tz(event.start.dateTime, userConfig.timeZone)
            .format('YYYY-MM-DD')
          if (!eventsByDate[eventDate]) {
            eventsByDate[eventDate] = []
          }
          eventsByDate[eventDate].push(event)
        }

        // Process each day in the range
        for (let i = 0; i < daysToConsider; i++) {
          const currentDay = currentDateTZ.clone().add(i, 'days')
          const dayOfWeek = currentDay.day() // 0 = Sunday, 6 = Saturday
          const dateString = currentDay.format('YYYY-MM-DD')

          // Skip days not allowed based on configuration
          if (!this.isDayAllowed(dayOfWeek, userConfig.allowedWeekDays)) {
            continue
          }

          // Skip dates in the past (if current time is past business hours)
          if (currentDay.isBefore(moment().tz(userConfig.timeZone), 'day')) {
            continue
          }

          const dayEvents = eventsByDate[dateString] || []
          const targetDate = currentDay.toDate()

          // Find available time spans for this day
          const dayAvailableSpans = findAvailableTimeSpans(
            targetDate,
            serviceDurationMinutes,
            dayEvents as unknown[],
          )

          // Add to overall available chunks
          availableChunks.push(...dayAvailableSpans)

          // Generate suggestions based on available spans
          for (const span of dayAvailableSpans) {
            const spanStart = moment.tz(span.startTime, userConfig.timeZone)
            const spanEnd = moment.tz(span.endTime, userConfig.timeZone)

            // Generate suggestions within this span
            // Try to suggest times that group events together (prefer times that are close to existing events)
            const existingEventsInDay = dayEvents.filter((e: unknown) => {
              const event = e as {
                start?: { dateTime?: string }
                end?: { dateTime?: string }
              }
              return event.start?.dateTime && event.end?.dateTime
            })

            // If there are existing events, try to suggest times adjacent to them
            if (existingEventsInDay.length > 0) {
              for (const event of existingEventsInDay) {
                const eventData = event as {
                  start: { dateTime: string }
                  end: { dateTime: string }
                }
                const eventStart = moment.tz(
                  eventData.start.dateTime,
                  userConfig.timeZone,
                )
                const eventEnd = moment.tz(
                  eventData.end.dateTime,
                  userConfig.timeZone,
                )

                // Suggest time right after this event (considering buffer time)
                const afterEvent = eventEnd
                  .clone()
                  .add(userConfig.bufferTimeBetweenEvents, 'minutes')
                const afterEventEnd = afterEvent
                  .clone()
                  .add(serviceDurationMinutes, 'minutes')

                if (
                  afterEvent.isSameOrAfter(spanStart) &&
                  afterEventEnd.isSameOrBefore(spanEnd)
                ) {
                  suggestions.push({
                    startTime: afterEvent.toISOString(),
                    endTime: afterEventEnd.toISOString(),
                    date: dateString,
                    dayOfWeek: currentDay.format('dddd'),
                    isWeekend: dayOfWeek === 6, // Saturday
                  })
                }

                // Suggest time right before this event (if it fits in the span)
                const beforeEventEnd = eventStart.clone().subtract(0, 'minutes')
                const beforeEvent = beforeEventEnd
                  .clone()
                  .subtract(serviceDurationMinutes, 'minutes')

                if (
                  beforeEvent.isSameOrAfter(spanStart) &&
                  beforeEventEnd.isSameOrBefore(spanEnd)
                ) {
                  suggestions.push({
                    startTime: beforeEvent.toISOString(),
                    endTime: beforeEventEnd.toISOString(),
                    date: dateString,
                    dayOfWeek: currentDay.format('dddd'),
                    isWeekend: dayOfWeek === 6,
                  })
                }
              }
            }

            // Always suggest the earliest available time in the span
            const earliestEnd = spanStart
              .clone()
              .add(serviceDurationMinutes, 'minutes')
            if (earliestEnd.isSameOrBefore(spanEnd)) {
              suggestions.push({
                startTime: spanStart.toISOString(),
                endTime: earliestEnd.toISOString(),
                date: dateString,
                dayOfWeek: currentDay.format('dddd'),
                isWeekend: dayOfWeek === 6,
              })
            }

            // Suggest times at regular intervals (every 30 minutes)
            // const suggestionTime = spanStart.clone()
            // while (
            //   suggestionTime
            //     .clone()
            //     .add(serviceDurationMinutes, 'minutes')
            //     .isSameOrBefore(spanEnd)
            // ) {
            //   const suggestionEnd = suggestionTime
            //     .clone()
            //     .add(serviceDurationMinutes, 'minutes')

            //   suggestions.push({
            //     startTime: suggestionTime.toISOString(),
            //     endTime: suggestionEnd.toISOString(),
            //     date: dateString,
            //     dayOfWeek: currentDay.format('dddd'),
            //     isWeekend: dayOfWeek === 6,
            //   })

            //   suggestionTime.add(30, 'minutes')
            // }
          }
        }

        // Remove duplicate suggestions and sort them
        const uniqueSuggestions = suggestions.filter(
          (suggestion, index, self) =>
            index ===
            self.findIndex((s) => s.startTime === suggestion.startTime),
        )

        // Sort suggestions: weekdays first, then by date and time
        uniqueSuggestions.sort((a, b) => {
          // Prioritize weekdays over weekends (Saturday)
          if (a.isWeekend !== b.isWeekend) {
            return a.isWeekend ? 1 : -1
          }

          // Then sort by start time
          return (
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          )
        })

        // Limit to a reasonable number of suggestions (e.g., 10)
        const limitedSuggestions = uniqueSuggestions.slice(0, 10)

        // Format suggestions with user's configured timezone
        const formattedSuggestions = limitedSuggestions.map((suggestion) => ({
          ...suggestion,
          startTime: moment
            .tz(suggestion.startTime, userConfig.timeZone)
            .format('YYYY-MM-DD HH:mm:ss'),
          endTime: moment
            .tz(suggestion.endTime, userConfig.timeZone)
            .format('YYYY-MM-DD HH:mm:ss'),
        }))

        // Format available chunks with user's configured timezone
        const formattedAvailableChunks = availableChunks
          .slice(0, 20)
          .map((chunk) => ({
            ...chunk,
            startTime: moment
              .tz(chunk.startTime, userConfig.timeZone)
              .format('YYYY-MM-DD HH:mm:ss'),
            endTime: moment
              .tz(chunk.endTime, userConfig.timeZone)
              .format('YYYY-MM-DD HH:mm:ss'),
          }))
        // Limit to a reasonable number of suggestions (e.g., 20)

        return {
          success: true,
          serviceDurationMinutes,
          daysConsidered: daysToConsider,
          availableChunks: formattedAvailableChunks, // Limit available chunks to prevent overwhelming response
          suggestions: formattedSuggestions,
          summary: {
            totalAvailableChunks: availableChunks.length,
            totalSuggestions: formattedSuggestions.length,
            weekdaySuggestions: formattedSuggestions.filter((s) => !s.isWeekend)
              .length,
            weekendSuggestions: formattedSuggestions.filter((s) => s.isWeekend)
              .length,
          },
        }
      } catch (error) {
        return {
          success: false,
          error: `Erro ao sugerir horários. Por favor, tente novamente. Error.message: ${(error as Error).message}`,
          availableChunks: [],
          suggestions: [],
        }
      }
    } catch (error) {
      console.error('Error suggesting event times:', error)
      return {
        success: false,
        error: 'Erro ao sugerir horários. Por favor, tente novamente.',
        availableChunks: [],
        suggestions: [],
      }
    }
  }

  /**
   * Cancel a calendar event
   */
  async cancelCalendarEvent(
    saasUserId: string,
    eventId: string,
    calendarId?: string,
  ): Promise<void> {
    const tokens = await this.getUserTokens(saasUserId)
    const oAuth2Client = this.createOAuth2Client(tokens)
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

    // Get user's calendar configuration if calendarId not provided
    const userConfig = await this.getUserCalendarConfig(saasUserId)
    const effectiveCalendarId = calendarId || userConfig.defaultCalendarId

    try {
      await calendar.events.delete({
        calendarId: effectiveCalendarId,
        eventId,
      })
    } catch (error) {
      console.error('Error canceling calendar event:', error)
      throw error
    }
  }

  /**
   * Check event cancellation eligibility
   */
  async checkEventCancellationEligibility(
    saasUserId: string,
    eventId: string,
    userPhone?: string,
    calendarId?: string,
  ): Promise<{
    eligible: boolean
    reason: string
    message: string
    shouldSendContactCard: boolean
    eventDetails?: {
      id?: string
      summary?: string | null
      start?: string
      description?: string | null
    }
  }> {
    try {
      const tokens = await this.getUserTokens(saasUserId)
      const oAuth2Client = this.createOAuth2Client(tokens)
      const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

      // Get user's calendar configuration if calendarId not provided
      const userConfig = await this.getUserCalendarConfig(saasUserId)
      const effectiveCalendarId = calendarId || userConfig.defaultCalendarId

      try {
        const response = await calendar.events.get({
          calendarId: effectiveCalendarId,
          eventId,
        })

        const event = response.data

        if (!event) {
          return {
            eligible: false,
            reason: 'event_not_found',
            message: 'Evento não encontrado no calendário.',
            shouldSendContactCard: true,
          }
        }

        // Check if event has start time
        if (!event.start?.dateTime) {
          return {
            eligible: false,
            reason: 'invalid_event',
            message: 'Evento inválido - sem horário de início definido.',
            shouldSendContactCard: true,
          }
        }

        const eventStartTime = new Date(event.start.dateTime)
        const currentTime = new Date()
        const timeDifferenceHours =
          (eventStartTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60)

        // Check if event starts in more than 48 hours
        if (timeDifferenceHours <= 48) {
          return {
            eligible: false,
            reason: 'insufficient_time',
            message: `O evento só pode ser cancelado com pelo menos 48 horas de antecedência. Faltam ${Math.round(timeDifferenceHours)} horas para o evento.`,
            shouldSendContactCard: true,
            eventDetails: {
              summary: event.summary,
              start: event.start.dateTime,
              description: event.description,
            },
          }
        }

        // Check if event description contains the user's phone (if provided)
        if (userPhone) {
          const eventDescription = event.description || ''
          const normalizedUserPhone = userPhone.replace(/\D/g, '') // Remove non-digits
          const normalizedEventDescription = eventDescription.replace(/\D/g, '') // Remove non-digits from description

          if (!normalizedEventDescription.includes(normalizedUserPhone)) {
            return {
              eligible: false,
              reason: 'phone_mismatch',
              message:
                'O telefone fornecido não corresponde ao telefone registrado no evento.',
              shouldSendContactCard: true,
              eventDetails: {
                summary: event.summary,
                start: event.start.dateTime,
                description: event.description,
              },
            }
          }
        }

        // Event is eligible for cancellation
        return {
          eligible: true,
          reason: 'eligible',
          message: `Evento elegível para cancelamento. O evento "${event.summary}" pode ser cancelado.`,
          shouldSendContactCard: false,
          eventDetails: {
            id: event.id || undefined,
            summary: event.summary,
            start: event.start.dateTime,
            description: event.description,
          },
        }
      } catch (error) {
        console.error('Error fetching event:', error)
        return {
          eligible: false,
          reason: 'event_not_found',
          message: 'Evento não encontrado no calendário.',
          shouldSendContactCard: true,
        }
      }
    } catch (error) {
      console.error('Error checking event cancellation eligibility:', error)
      return {
        eligible: false,
        reason: 'error',
        message:
          'Erro ao verificar elegibilidade para cancelamento. Por favor, tente novamente.',
        shouldSendContactCard: true,
      }
    }
  }

  /**
   * Check and cancel event if eligible
   */
  async checkAndCancelEventIfEligible(
    saasUserId: string,
    eventId: string,
    userPhone?: string,
    calendarId?: string,
  ): Promise<{
    success: boolean
    cancelled: boolean
    eligible: boolean
    reason: string
    message: string
    shouldSendContactCard: boolean
    eventDetails?: {
      id?: string
      summary?: string | null
      start?: string
      description?: string | null
    }
  }> {
    try {
      // First check if the event is eligible for cancellation
      const eligibilityResult = await this.checkEventCancellationEligibility(
        saasUserId,
        eventId,
        userPhone,
        calendarId,
      )

      if (!eligibilityResult.eligible) {
        return {
          success: false,
          cancelled: false,
          ...eligibilityResult,
        }
      }

      // If eligible, proceed with cancellation
      try {
        await this.cancelCalendarEvent(saasUserId, eventId, calendarId)

        return {
          success: true,
          cancelled: true,
          eligible: true,
          reason: 'cancelled',
          message: `Evento "${eligibilityResult.eventDetails?.summary}" foi cancelado com sucesso.`,
          shouldSendContactCard: false,
          eventDetails: eligibilityResult.eventDetails,
        }
      } catch (cancellationError) {
        console.error('Error cancelling event:', cancellationError)
        return {
          success: false,
          cancelled: false,
          eligible: true,
          reason: 'cancellation_failed',
          message: `Evento é elegível para cancelamento, mas houve um erro ao cancelar: ${cancellationError instanceof Error ? cancellationError.message : 'Erro desconhecido'}`,
          shouldSendContactCard: true,
          eventDetails: eligibilityResult.eventDetails,
        }
      }
    } catch (error) {
      console.error('Error checking and cancelling event:', error)
      return {
        success: false,
        cancelled: false,
        eligible: false,
        reason: 'error',
        message:
          'Erro ao verificar e cancelar evento. Por favor, tente novamente.',
        shouldSendContactCard: true,
      }
    }
  }

  /**
   * Revoke user's Google Calendar access
   */
  async revokeAccess(saasUserId: string): Promise<void> {
    try {
      const tokens = await this.getUserTokens(saasUserId)
      const oAuth2Client = this.createOAuth2Client(tokens)

      // Revoke the token
      await oAuth2Client.revokeCredentials()

      // Clear tokens from database
      await db
        .update(saasUsers)
        .set({
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiry: null,
          googleCalendarEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(saasUsers.id, saasUserId))
    } catch (error) {
      console.error('Error revoking Google Calendar access:', error)
      throw error
    }
  }

  /**
   * List all calendars available to the user
   */
  async listCalendars(saasUserId: string): Promise<
    Array<{
      id: string
      summary: string
      description?: string
      primary?: boolean
      accessRole?: string
      backgroundColor?: string
    }>
  > {
    try {
      const tokens = await this.getUserTokens(saasUserId)
      const oAuth2Client = this.createOAuth2Client(tokens)
      const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

      const response = await calendar.calendarList.list({
        minAccessRole: 'writer', // Only show calendars the user can write to
      })

      if (!response.data.items) {
        return []
      }

      return response.data.items.map((cal) => ({
        id: cal.id || '',
        summary: cal.summary || '',
        description: cal.description || undefined,
        primary: cal.primary || false,
        accessRole: cal.accessRole || undefined,
        backgroundColor: cal.backgroundColor || undefined,
      }))
    } catch (error) {
      console.error('Error listing calendars:', error)
      throw new Error('Failed to fetch calendar list')
    }
  }
}

export const getSaasGoogleCalendarService = () =>
  SaasGoogleCalendarService.getInstance()
