import { and, eq, or } from 'drizzle-orm'
import moment from 'moment-timezone'
import { db } from '../db'
import { contacts } from '../db/schema-postgres'
import { twilioClientPool } from '../services/TwilioClientPool'
import { DEPLOYMENT_URL } from '../utils/contants'
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
  callersPhoneNumber: string
  userId: string
}

export async function forwardContact(params: ForwardContactProps) {
  const {
    contactName,
    phoneNumberOfContactToSend,
    phoneNumberOfSender,
    callersPhoneNumber,
    userId,
  } = params

  // Remove "whatsapp:" prefix if it exists
  const contactPhoneNumber = noWhatsPhoneNumber(phoneNumberOfContactToSend)
  const senderPhoneNumber = noWhatsPhoneNumber(phoneNumberOfSender)
  const callerPhoneNumber = noWhatsPhoneNumber(callersPhoneNumber)

  try {
    // Search for the contact by name
    const contact = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.isActive, true),
          eq(contacts.saasUserId, userId),
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
        ? DEPLOYMENT_URL
        : (process.env.DEPLOYMENT_URL ?? 'http://localhost:3000')
    const vcfUrl = `${baseUrl}/api/contacts/${contactData.id}/vcf`

    // Get the Twilio client for this SaaS user
    const client = await twilioClientPool.getClient(contactData.saasUserId)

    if (!senderPhoneNumber) {
      return {
        success: false,
        error: 'WhatsApp number not configured',
        message: 'Número do WhatsApp não configurado para este usuário.',
      }
    }

    // Send the contact via WhatsApp
    await client.messages.create({
      from: `whatsapp:${senderPhoneNumber}`,
      to: `whatsapp:${callerPhoneNumber}`,
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

export type AvailableTimeSpan = {
  startTime: string
  endTime: string
  duration: number // in minutes
}

export type TimeBlock = {
  id: string
  start: number // minutes from midnight (0-1440)
  end: number // minutes from midnight (0-1440)
  type?: 'regular' | 'tentative' // regular = guaranteed availability, tentative = potential availability
}

// Helper function to find available time spans in a day based on configured blocks
export function findAvailableTimeSpans(
  targetDate: Date,
  serviceDurationMinutes: number,
  existingEvents: any[],
  configuredBlocks: TimeBlock[],
  bufferMinutes: number = 0,
  timeZone: string = 'America/Sao_Paulo',
): AvailableTimeSpan[] {
  const availableSpans: AvailableTimeSpan[] = []

  // Get current time in the configured timezone
  const currentTime = moment.tz(timeZone).toDate()

  // If no configured blocks, return empty array
  if (!configuredBlocks || configuredBlocks.length === 0) {
    return availableSpans
  }

  // Process each configured block
  for (const block of configuredBlocks) {
    // Convert block start/end (minutes from midnight) to actual Date objects in the target timezone
    const blockStartMoment = moment
      .tz(targetDate, timeZone)
      .startOf('day')
      .add(block.start, 'minutes')
    const blockStart = blockStartMoment.toDate()

    const blockEndMoment = moment
      .tz(targetDate, timeZone)
      .startOf('day')
      .add(block.end, 'minutes')
    const blockEnd = blockEndMoment.toDate()

    // Collect all blocked time periods within this block (existing events)
    const blockedPeriods = []

    // Add existing events as blocked periods (with buffer)
    for (const event of existingEvents) {
      if (!event.start?.dateTime || !event.end?.dateTime) continue

      const eventStart = new Date(event.start.dateTime)
      const eventEnd = new Date(event.end.dateTime)

      // Add buffer to existing events
      const bufferedStart = new Date(
        eventStart.getTime() - bufferMinutes * 60000,
      )
      const bufferedEnd = new Date(eventEnd.getTime() + bufferMinutes * 60000)

      // Only include events that overlap with this block
      if (bufferedEnd > blockStart && bufferedStart < blockEnd) {
        blockedPeriods.push({
          start: new Date(
            Math.max(bufferedStart.getTime(), blockStart.getTime()),
          ),
          end: new Date(Math.min(bufferedEnd.getTime(), blockEnd.getTime())),
        })
      }
    }

    // Sort blocked periods by start time
    blockedPeriods.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Find available gaps between blocked periods within this block
    let currentTimeInBlock = blockStart

    for (const blockedPeriod of blockedPeriods) {
      // Check if there's a gap before this blocked period
      if (currentTimeInBlock < blockedPeriod.start) {
        const gapDuration =
          (blockedPeriod.start.getTime() - currentTimeInBlock.getTime()) /
          (1000 * 60)

        // Only add the span if it's long enough AND starts after current time
        if (
          gapDuration >= serviceDurationMinutes &&
          blockedPeriod.start > currentTime
        ) {
          // If the gap starts before current time, adjust it to start from current time
          const adjustedStartTime =
            currentTimeInBlock > currentTime ? currentTimeInBlock : currentTime
          const adjustedGapDuration =
            (blockedPeriod.start.getTime() - adjustedStartTime.getTime()) /
            (1000 * 60)

          if (adjustedGapDuration >= serviceDurationMinutes) {
            availableSpans.push({
              startTime: adjustedStartTime.toISOString(),
              endTime: blockedPeriod.start.toISOString(),
              duration: Math.floor(adjustedGapDuration),
            })
          }
        }
      }

      // Move current time to after this blocked period
      currentTimeInBlock = new Date(
        Math.max(currentTimeInBlock.getTime(), blockedPeriod.end.getTime()),
      )
    }

    // Check if there's available time after the last blocked period in this block
    if (currentTimeInBlock < blockEnd) {
      const gapDuration =
        (blockEnd.getTime() - currentTimeInBlock.getTime()) / (1000 * 60)

      // Only add the span if it's long enough AND starts after current time
      if (gapDuration >= serviceDurationMinutes && blockEnd > currentTime) {
        // If the gap starts before current time, adjust it to start from current time
        const adjustedStartTime =
          currentTimeInBlock > currentTime ? currentTimeInBlock : currentTime
        const adjustedGapDuration =
          (blockEnd.getTime() - adjustedStartTime.getTime()) / (1000 * 60)

        if (adjustedGapDuration >= serviceDurationMinutes) {
          availableSpans.push({
            startTime: adjustedStartTime.toISOString(),
            endTime: blockEnd.toISOString(),
            duration: Math.floor(adjustedGapDuration),
          })
        }
      }
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
