import { and, eq, or } from 'drizzle-orm'
import moment from 'moment-timezone'
import { db } from '../db'
import { contacts } from '../db/schema-postgres'
import { twilioClientPool } from '../services/TwilioClientPool'
import { PRODUCTION_DOMAIN } from '../utils/contants'
import { noWhatsPhoneNumber } from '../utils/utils'

// Helper function to format time in São Paulo timezone
export function formatTimeInSaoPaulo(
  dateString: string,
  format: string = 'HH:mm',
): string {
  return moment.tz(dateString, 'America/Sao_Paulo').format(format)
}

// Helper function to format date in São Paulo timezone
export function formatDateInSaoPaulo(
  dateString: string,
  format: string = 'DD/MM/YYYY',
): string {
  return moment.tz(dateString, 'America/Sao_Paulo').format(format)
}

export function getSaoPauloDate() {
  try {
    const tz = 'America/Sao_Paulo'
    const momentDate = moment().tz(tz).format('YYYY-MM-DD HH:mm:ss')
    const isoDate = moment().tz('America/Sao_Paulo').toISOString()

    const date = new Date(momentDate)
    const formattedDate = date.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    return {
      currentDate: formattedDate,
      timezone: tz,
      iso8601: isoDate,
    }
  } catch (error) {
    console.error('Error fetching São Paulo date:', error)
    throw new Error('Failed to fetch São Paulo date')
  }
}

export type ForwardContactProps = {
  contactName?: string
  phoneNumberOfContactToSend: string
  phoneNumberOfSender: string
}

export async function forwardContact(params: ForwardContactProps) {
  const { contactName, phoneNumberOfContactToSend, phoneNumberOfSender } =
    params

  // Remove "whatsapp:" prefix if it exists
  const contactPhoneNumber = noWhatsPhoneNumber(phoneNumberOfContactToSend)
  const senderPhoneNumber = noWhatsPhoneNumber(phoneNumberOfSender)

  try {
    // Search for the contact by name
    const contact = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.isActive, true),
          or(
            eq(contacts.phoneNumber, contactPhoneNumber),
            eq(contacts.name, contactName || ''),
          ),
        ),
      )
      .limit(1)

    if (!contact.length) {
      return {
        success: false,
        error: 'Contact not found',
        message: `Contato "${contactName}" não encontrado. Verifique se o nome está correto ou se o contato foi cadastrado.`,
      }
    }

    const contactData = contact[0]

    // Generate the VCF URL
    const baseUrl =
      process.env.NODE_ENV === 'production'
        ? PRODUCTION_DOMAIN
        : (process.env.NGROK_URL ?? 'http://localhost:3000')
    const vcfUrl = `${baseUrl}/api/contacts/${contactData.id}/vcf`

    // Get the Twilio client for this SaaS user
    const client = await twilioClientPool.getClient(contactData.saasUserId)

    const accountPhoneNumber = noWhatsPhoneNumber(
      await twilioClientPool.getPhoneNumberInfo(contactData.saasUserId),
    )

    if (!senderPhoneNumber) {
      return {
        success: false,
        error: 'WhatsApp number not configured',
        message: 'Número do WhatsApp não configurado para este usuário.',
      }
    }

    // Send the contact via WhatsApp
    await client.messages.create({
      from: `whatsapp:${accountPhoneNumber}`,
      to: `whatsapp:${senderPhoneNumber}`,
      mediaUrl: [vcfUrl],
    })

    return {
      success: true,
      contact: {
        name: contactData.name,
        phoneNumber: contactData.phoneNumber,
        email: contactData.email,
        company: contactData.company,
      },
      message: `Contato ${contactData.name} foi enviado com sucesso para ${senderPhoneNumber}.`,
    }
  } catch (error) {
    console.error('Error forwarding contact:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message:
        'Erro ao enviar contato. Tente novamente ou verifique se as configurações do Twilio estão corretas.',
    }
  }
}

// Helper function to find available time spans in a day
export function findAvailableTimeSpans(
  targetDate: Date,
  serviceDurationMinutes: number,
  existingEvents: any[],
): AvailableTimeSpan[] {
  const availableSpans: AvailableTimeSpan[] = []

  // Business hours: 9:00 - 18:00 in São Paulo timezone
  const businessStartSP = moment
    .tz(targetDate, 'America/Sao_Paulo')
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0)
  const businessStart = businessStartSP.toDate()

  const businessEndSP = moment
    .tz(targetDate, 'America/Sao_Paulo')
    .hour(18)
    .minute(0)
    .second(0)
    .millisecond(0)
  const businessEnd = businessEndSP.toDate()

  // Lunch break: 12:00 - 13:00 in São Paulo timezone
  const lunchStartSP = moment
    .tz(targetDate, 'America/Sao_Paulo')
    .hour(12)
    .minute(0)
    .second(0)
    .millisecond(0)
  const lunchStart = lunchStartSP.toDate()

  const lunchEndSP = moment
    .tz(targetDate, 'America/Sao_Paulo')
    .hour(13)
    .minute(0)
    .second(0)
    .millisecond(0)
  const lunchEnd = lunchEndSP.toDate()

  // Collect all blocked time periods (events + lunch + outside business hours)
  const blockedPeriods = []

  // Add lunch break as blocked period
  blockedPeriods.push({
    start: lunchStart,
    end: lunchEnd,
    type: 'lunch',
  })

  // Add existing events as blocked periods (with 0-minute buffer)
  const bufferMinutes = 0
  for (const event of existingEvents) {
    if (!event.start?.dateTime || !event.end?.dateTime) continue

    const eventStart = new Date(event.start.dateTime)
    const eventEnd = new Date(event.end.dateTime)

    // Add buffer to existing events
    const bufferedStart = new Date(eventStart.getTime() - bufferMinutes * 60000)
    const bufferedEnd = new Date(eventEnd.getTime() + bufferMinutes * 60000)

    blockedPeriods.push({
      start: bufferedStart,
      end: bufferedEnd,
      type: 'event',
    })
  }

  // Sort blocked periods by start time
  blockedPeriods.sort((a, b) => a.start.getTime() - b.start.getTime())

  // Find available gaps between blocked periods
  let currentTime = businessStart

  for (const blockedPeriod of blockedPeriods) {
    // Skip blocked periods that are outside business hours or before current time
    if (
      blockedPeriod.end <= businessStart ||
      blockedPeriod.start >= businessEnd
    ) {
      continue
    }

    // Adjust blocked period to business hours
    const adjustedStart = new Date(
      Math.max(blockedPeriod.start.getTime(), businessStart.getTime()),
    )
    const adjustedEnd = new Date(
      Math.min(blockedPeriod.end.getTime(), businessEnd.getTime()),
    )

    // Check if there's a gap before this blocked period
    if (currentTime < adjustedStart) {
      const gapDuration =
        (adjustedStart.getTime() - currentTime.getTime()) / (1000 * 60)

      if (gapDuration >= serviceDurationMinutes) {
        availableSpans.push({
          startTime: currentTime.toISOString(),
          endTime: adjustedStart.toISOString(),
          duration: Math.floor(gapDuration),
        })
      }
    }

    // Move current time to after this blocked period
    currentTime = new Date(
      Math.max(currentTime.getTime(), adjustedEnd.getTime()),
    )
  }

  // Check if there's available time after the last blocked period
  if (currentTime < businessEnd) {
    const gapDuration =
      (businessEnd.getTime() - currentTime.getTime()) / (1000 * 60)

    if (gapDuration >= serviceDurationMinutes) {
      availableSpans.push({
        startTime: currentTime.toISOString(),
        endTime: businessEnd.toISOString(),
        duration: Math.floor(gapDuration),
      })
    }
  }

  return availableSpans
}

export type FetchCalendarEventsProps = {
  timeMin: string
  timeMax: string
  // maxResults?: number
  singleEvents?: boolean
  orderBy?: 'startTime' | 'updated'
}

export type CreateCalendarEventProps = {
  calendarId: string
  event: {
    summary: string
    location: string
    description: string
    start: {
      dateTime: string
      timeZone: string
    }
    end: {
      dateTime: string
      timeZone: string
    }
    // attendees?: { email: string }[];
  }
}

export type CancelCalendarEventProps = {
  calendarId: 'string'
  eventId: 'string'
}

export type CheckEventAvailabilityProps = {
  proposedStartTime: string
  proposedEndTime: string
  serviceDurationMinutes: number
}

export type AvailableTimeSpan = {
  startTime: string
  endTime: string
  duration: number // in minutes
}

export type SuggestEventTimesProps = {
  serviceDurationMinutes: number
  startDate: string // optional start date, defaults to today
  endDate?: string // optional end date, defaults to 7 days from start date
}

export type TimeSuggestion = {
  startTime: string
  endTime: string
  date: string
  dayOfWeek: string
  isWeekend: boolean
}

export type MCPFunctions = {
  getSaoPauloDate: {
    function: () => { currentDate: string; timezone: string; iso8601: string }
    description: string
    parameters: Record<string, unknown>
  }
}

// MCP functions registry
export const mcpFunctions: MCPFunctions = {
  getSaoPauloDate: {
    function: getSaoPauloDate,
    description: 'Get the current date and time in São Paulo, Brazil',
    parameters: {},
  },
}
