import type { OAuth2Client } from 'google-auth-library'
import { type calendar_v3, google } from 'googleapis'
import moment from 'moment-timezone'
import { GABE_CALENDAR_ID } from '../utils/contants'

/**
 * Parameters for fetching Google Calendar events.
 */
interface GetGoogleCalendarEventsParams {
  calendarId?: string
  timeMin: string
  timeMax: string
  maxResults?: number
  singleEvents?: boolean
  orderBy?: 'startTime' | 'updated'
  auth: OAuth2Client | string // string if using API key or service account client
}

async function getGoogleCalendarEvents({
  calendarId = 'primary',
  timeMin,
  timeMax,
  maxResults = 100,
  singleEvents = true,
  orderBy = 'startTime',
  auth,
}: GetGoogleCalendarEventsParams): Promise<calendar_v3.Schema$Event[]> {
  const calendar = google.calendar({ version: 'v3', auth })

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents,
      orderBy,
    })

    return response.data.items || []
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error)
    throw error
  }
}

async function createCalendarEvent({
  calendarId = 'primary',
  event,
  auth,
}: {
  calendarId?: string
  event: calendar_v3.Schema$Event
  auth: OAuth2Client | string
}): Promise<calendar_v3.Schema$Event> {
  const calendar = google.calendar({ version: 'v3', auth })

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    })

    const { kind, id, summary, description, organizer, start, end, sequence } =
      response.data

    return { kind, id, summary, description, organizer, start, end, sequence }
  } catch (error) {
    console.error('Error creating Google Calendar event:', error)
    throw error
  }
}

// get calendar event by id
export async function getCalendarEventById({
  calendarId = 'primary',
  eventId,
  auth,
}: {
  calendarId?: string
  eventId: string
  auth: OAuth2Client | string
}): Promise<calendar_v3.Schema$Event | null> {
  const calendar = google.calendar({ version: 'v3', auth })

  try {
    const response = await calendar.events.get({
      calendarId,
      eventId,
    })

    return response.data
  } catch (error) {
    console.error('Error fetching Google Calendar event:', error)
    return null
  }
}

export async function cancelCalendarEvent({
  calendarId = GABE_CALENDAR_ID,
  eventId,
  auth,
}: {
  calendarId?: string
  eventId: string
  auth: OAuth2Client | string
}): Promise<{ error: string } | { sucess: boolean }> {
  const calendar = google.calendar({ version: 'v3', auth })

  const event = await getCalendarEventById({
    calendarId,
    eventId,
    auth,
  })

  if (!event) {
    return { error: 'Event not found' }
  }

  // Check if event end date is before 24 hours from now (using São Paulo timezone)
  const nowSP = moment().tz('America/Sao_Paulo')

  const endDate = event.end?.dateTime ?? event.end?.date

  if (!endDate) {
    return { error: 'Event end date not found' }
  }

  const eventEndDateSP = moment.tz(endDate, 'America/Sao_Paulo')
  const twentyFourHoursFromNowSP = nowSP.clone().add(24, 'hours')

  if (eventEndDateSP.isBefore(twentyFourHoursFromNowSP)) {
    return {
      error:
        'Não é possível cancelar eventos com menos de 24 horas de antecedência.',
    }
  }

  try {
    await calendar.events.delete({
      calendarId: GABE_CALENDAR_ID,
      eventId,
    })
    return { sucess: true }
  } catch (error) {
    console.error('Error canceling Google Calendar event:', error)
    return { error: 'Error canceling Google Calendar event' }
  }
}

export { getGoogleCalendarEvents, createCalendarEvent }
