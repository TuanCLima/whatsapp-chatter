import moment from 'moment-timezone'
import { authorize } from '../googleCalendar/googleAuth'
import {
  cancelCalendarEvent,
  createCalendarEvent,
  getCalendarEventById,
  getGoogleCalendarEvents,
} from '../googleCalendar/googleCalendar'
import type { Maybe } from '../types/types'
import {
  type Atendentes,
  CALENDAR_EVENT_CANCELLATION_RULES,
  GABE_CALENDAR_ID,
  LINK_INFO,
  SALON_INFO,
  SERVICES,
} from '../utils/contants'

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

export function getAllServicesTable() {
  return SERVICES
}

export function getSalonInfo() {
  return SALON_INFO
}

export function getProfessionalLinkContactToAttachInAnswer() {
  return LINK_INFO
}

export function getCalendarEventCancellationRules() {
  return CALENDAR_EVENT_CANCELLATION_RULES
}

export async function checkEventCancellationEligibility(
  params: CheckEventCancellationEligibilityProps,
) {
  const { eventId, userPhone } = params

  try {
    return new Promise((resolve, reject) => {
      authorize(async (auth) => {
        try {
          // Fetch the specific event from the calendar
          const event = await getCalendarEventById({
            calendarId: GABE_CALENDAR_ID,
            eventId,
            auth,
          })

          if (!event) {
            resolve({
              eligible: false,
              reason: 'event_not_found',
              message: 'Evento não encontrado no calendário.',
              shouldSendContactCard: true,
            })
            return
          }

          // Check if event has start time
          if (!event.start?.dateTime) {
            resolve({
              eligible: false,
              reason: 'invalid_event',
              message: 'Evento inválido - sem horário de início definido.',
              shouldSendContactCard: true,
            })
            return
          }

          const eventStartTime = new Date(event.start.dateTime)
          const currentTime = new Date()
          const timeDifferenceHours =
            (eventStartTime.getTime() - currentTime.getTime()) /
            (1000 * 60 * 60)

          // Check if event starts in more than 48 hours
          if (timeDifferenceHours <= 48) {
            resolve({
              eligible: false,
              reason: 'insufficient_time',
              message: `O evento só pode ser cancelado com pelo menos 48 horas de antecedência. Faltam ${Math.round(timeDifferenceHours)} horas para o evento.`,
              shouldSendContactCard: true,
              eventDetails: {
                summary: event.summary,
                start: event.start.dateTime,
                description: event.description,
              },
            })
            return
          }

          // Check if event description contains the user's phone
          const eventDescription = event.description || ''
          const normalizedUserPhone = userPhone.replace(/\D/g, '') // Remove non-digits
          const normalizedEventDescription = eventDescription.replace(/\D/g, '') // Remove non-digits from description

          if (!normalizedEventDescription.includes(normalizedUserPhone)) {
            resolve({
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
            })
            return
          }

          // Event is eligible for cancellation
          resolve({
            eligible: true,
            reason: 'eligible',
            message: `Evento elegível para cancelamento. O evento "${event.summary}" pode ser cancelado.`,
            shouldSendContactCard: false,
            eventDetails: {
              id: event.id,
              summary: event.summary,
              start: event.start.dateTime,
              description: event.description,
            },
          })
        } catch (error) {
          reject(error)
        }
      })
    })
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

export async function checkAndCancelEventIfEligible(
  params: CheckEventCancellationEligibilityProps,
) {
  const { eventId, userPhone } = params

  try {
    // First check if the event is eligible for cancellation
    const eligibilityResult = (await checkEventCancellationEligibility(
      params,
    )) as any

    if (!eligibilityResult.eligible) {
      return {
        success: false,
        cancelled: false,
        ...eligibilityResult,
      }
    }

    // If eligible, proceed with cancellation
    return new Promise((resolve, reject) => {
      authorize(async (auth) => {
        try {
          const cancellationResult = await cancelCalendarEvent({
            calendarId: GABE_CALENDAR_ID,
            eventId,
            auth,
          })

          if ('error' in cancellationResult) {
            resolve({
              success: false,
              cancelled: false,
              eligible: true,
              reason: 'cancellation_failed',
              message: `Evento é elegível para cancelamento, mas houve um erro ao cancelar: ${cancellationResult.error}`,
              shouldSendContactCard: true,
              eventDetails: eligibilityResult.eventDetails,
            })
          } else {
            resolve({
              success: true,
              cancelled: true,
              eligible: true,
              reason: 'cancelled',
              message: `Evento "${eligibilityResult.eventDetails?.summary}" foi cancelado com sucesso.`,
              shouldSendContactCard: false,
              eventDetails: eligibilityResult.eventDetails,
            })
          }
        } catch (error) {
          reject(error)
        }
      })
    })
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

export async function checkEventAvailability(
  params: CheckEventAvailabilityProps,
) {
  const { proposedStartTime, proposedEndTime, serviceDurationMinutes } = params

  try {
    // Parse the proposed times
    const startDate = new Date(proposedStartTime)
    const endDate = new Date(proposedEndTime)

    // Check if the proposed time is valid
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return {
        available: false,
        message:
          'Horário inválido fornecido. Por favor, forneça um horário válido.',
        conflicts: [],
        availableTimeSpans: [],
      }
    }

    // Check if salon is closed (Sundays and Mondays)
    // Use São Paulo timezone for day of week check
    const dayOfWeek = moment.tz(startDate, 'America/Sao_Paulo').day() // 0 = Sunday, 1 = Monday
    if (dayOfWeek === 0 || dayOfWeek === 1) {
      return {
        available: false,
        message:
          'O salão está fechado aos domingos e segundas-feiras. Por favor, escolha um horário entre terça e sábado.',
        conflicts: ['salon_closed'],
        availableTimeSpans: [],
      }
    }

    // Check forbidden hours (12h-13h / lunch time)
    // Convert to São Paulo timezone for hour/minute checks
    const startDateSP = moment.tz(startDate, 'America/Sao_Paulo')
    const endDateSP = moment.tz(endDate, 'America/Sao_Paulo')
    const startHour = startDateSP.hour()
    const endHour = endDateSP.hour()
    const startMinutes = startDateSP.minute()
    const endMinutes = endDateSP.minute()

    // Check if event overlaps with lunch time (12:00-13:00)
    const isStartInLunch =
      startHour === 12 || (startHour === 11 && startMinutes > 45)
    const isEndInLunch =
      (endHour === 12 && endMinutes > 0) || (endHour === 13 && endMinutes === 0)
    const spansLunch = startHour < 12 && endHour >= 13

    // Check if it's outside business hours (assuming 9h-18h)
    const isOutsideBusinessHours =
      startHour < 9 || startHour >= 18 || endHour > 18

    // Fetch existing events to check for conflicts and find available time spans
    // Use São Paulo timezone for day boundaries
    const dayStartSP = moment.tz(startDate, 'America/Sao_Paulo').startOf('day')
    const dayEndSP = moment.tz(startDate, 'America/Sao_Paulo').endOf('day')
    const dayStart = dayStartSP.toDate()
    const dayEnd = dayEndSP.toDate()

    return new Promise((resolve, reject) => {
      authorize(async (auth) => {
        try {
          const events = await getGoogleCalendarEvents({
            calendarId: GABE_CALENDAR_ID,
            timeMin: dayStart.toISOString(),
            timeMax: dayEnd.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            auth,
          })

          // Find available time spans for the requested day
          const availableTimeSpans = findAvailableTimeSpans(
            startDate,
            serviceDurationMinutes,
            events,
          )

          const conflicts: string[] = []
          const conflictingEvents: any[] = []

          // Check for conflicts with existing events
          for (const event of events) {
            if (!event.start?.dateTime || !event.end?.dateTime) continue

            const eventStart = new Date(event.start.dateTime)
            const eventEnd = new Date(event.end.dateTime)

            // Check for overlaps with 0-minute buffer
            const bufferMinutes = 0
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
          if (isStartInLunch || isEndInLunch || spansLunch) {
            conflicts.push('lunch_time')
          }

          // Check for business hours conflict
          if (isOutsideBusinessHours) {
            conflicts.push('outside_business_hours')
          }

          if (conflicts.length > 0) {
            let conflictMessage = ''

            if (conflicts.includes('lunch_time')) {
              conflictMessage =
                'Este horário não está disponível pois conflita com o horário de almoço (12:00-13:00).'
            } else if (conflicts.includes('outside_business_hours')) {
              conflictMessage =
                'Este horário está fora do horário de funcionamento (09:00-18:00).'
            } else {
              const conflictDetails = conflictingEvents
                .map(
                  (e) =>
                    `${e.summary || 'Evento'} (${formatTimeInSaoPaulo(e.start)}-${formatTimeInSaoPaulo(e.end)})`,
                )
                .join(', ')
              conflictMessage = `Este horário não está disponível pois conflita com: ${conflictDetails}.`
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

            resolve({
              available: false,
              message: conflictMessage + availableSpansMessage,
              conflicts,
              conflictingEvents,
              availableTimeSpans,
            })
          } else {
            resolve({
              available: true,
              message: `Horário disponível! O agendamento pode ser feito das ${formatTimeInSaoPaulo(startDate.toISOString())} às ${formatTimeInSaoPaulo(endDate.toISOString())} no dia ${formatDateInSaoPaulo(startDate.toISOString())}.`,
              conflicts: [],
              availableTimeSpans,
            })
          }
        } catch (error) {
          reject(error)
        }
      })
    })
  } catch (error) {
    console.error('Error checking event availability:', error)
    return {
      available: false,
      message: 'Erro ao verificar disponibilidade. Por favor, tente novamente.',
      conflicts: [],
      availableTimeSpans: [],
    }
  }
}

export async function suggestEventTimes(params: SuggestEventTimesProps) {
  const { serviceDurationMinutes, daysToConsider = 14 } = params

  try {
    const currentDateSP = moment().tz('America/Sao_Paulo')
    const endDateSP = currentDateSP.clone().add(daysToConsider, 'days')

    const timeMin = currentDateSP.startOf('day').toISOString()
    const timeMax = endDateSP.endOf('day').toISOString()

    return new Promise((resolve, reject) => {
      authorize(async (auth) => {
        try {
          // Fetch all events in the time range
          const events = await getGoogleCalendarEvents({
            calendarId: GABE_CALENDAR_ID,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            auth,
          })

          const availableChunks: AvailableTimeSpan[] = []
          const suggestions: TimeSuggestion[] = []

          // Group events by date for processing
          const eventsByDate: Record<string, unknown[]> = {}
          for (const event of events) {
            if (!event.start?.dateTime) continue
            const eventDate = moment
              .tz(event.start.dateTime, 'America/Sao_Paulo')
              .format('YYYY-MM-DD')
            if (!eventsByDate[eventDate]) {
              eventsByDate[eventDate] = []
            }
            eventsByDate[eventDate].push(event)
          }

          // Process each day in the range
          for (let i = 0; i < daysToConsider; i++) {
            const currentDay = currentDateSP.clone().add(i, 'days')
            const dayOfWeek = currentDay.day() // 0 = Sunday, 6 = Saturday
            const dateString = currentDay.format('YYYY-MM-DD')

            // Skip Sundays and Mondays (salon is closed)
            if (dayOfWeek === 0 || dayOfWeek === 1) {
              continue
            }

            // Skip dates in the past (if current time is past business hours)
            if (currentDay.isBefore(moment().tz('America/Sao_Paulo'), 'day')) {
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
              const spanStart = moment.tz(span.startTime, 'America/Sao_Paulo')
              const spanEnd = moment.tz(span.endTime, 'America/Sao_Paulo')

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
                    'America/Sao_Paulo',
                  )
                  const eventEnd = moment.tz(
                    eventData.end.dateTime,
                    'America/Sao_Paulo',
                  )

                  // Suggest time right after this event (if it fits in the span)
                  const afterEvent = eventEnd.clone().add(0, 'minutes') // 0-minute buffer
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
                  const beforeEventEnd = eventStart
                    .clone()
                    .subtract(0, 'minutes')
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

          // Format suggestions with São Paulo timezone
          const formattedSuggestions = limitedSuggestions.map((suggestion) => ({
            ...suggestion,
            startTime: moment
              .tz(suggestion.startTime, 'America/Sao_Paulo')
              .format('YYYY-MM-DD HH:mm:ss'),
            endTime: moment
              .tz(suggestion.endTime, 'America/Sao_Paulo')
              .format('YYYY-MM-DD HH:mm:ss'),
          }))

          // Format available chunks with São Paulo timezone
          const formattedAvailableChunks = availableChunks
            .slice(0, 20)
            .map((chunk) => ({
              ...chunk,
              startTime: moment
                .tz(chunk.startTime, 'America/Sao_Paulo')
                .format('YYYY-MM-DD HH:mm:ss'),
              endTime: moment
                .tz(chunk.endTime, 'America/Sao_Paulo')
                .format('YYYY-MM-DD HH:mm:ss'),
            }))
          // Limit to a reasonable number of suggestions (e.g., 20)

          resolve({
            success: true,
            serviceDurationMinutes,
            daysConsidered: daysToConsider,
            availableChunks: formattedAvailableChunks, // Limit available chunks to prevent overwhelming response
            suggestions: formattedSuggestions,
            summary: {
              totalAvailableChunks: availableChunks.length,
              totalSuggestions: formattedSuggestions.length,
              weekdaySuggestions: formattedSuggestions.filter(
                (s) => !s.isWeekend,
              ).length,
              weekendSuggestions: formattedSuggestions.filter(
                (s) => s.isWeekend,
              ).length,
            },
          })
        } catch (error) {
          reject(error)
        }
      })
    })
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

export type CheckEventCancellationEligibilityProps = {
  eventId: string
  userPhone: string
}

export type SuggestEventTimesProps = {
  serviceDurationMinutes: number
  daysToConsider?: number // defaults to 14 days if not provided
}

export type TimeSuggestion = {
  startTime: string
  endTime: string
  date: string
  dayOfWeek: string
  isWeekend: boolean
}

export type ServiceItem = {
  name: string
  timeToExecuteInMinutes?: number
  details: string[]
  description?: string
  // priceInReais?: number
  performedBy?: Atendentes[]
  options?: string[]
  // sendContactCard?: boolean;
  // scheduleCalendarEvent?: boolean;
}

export type LinkInfo = {
  professionalName: string
  professionalLink: string
}[]

export type SalonInfo = {
  Endereço: string
  'Profissionais integrantes': string[]
  'Telefone para contato': string
  Email: string
  Instagram: string
  InstagramHandle: string
}

export type CancellationRules = {
  userRules: string[]
  assistantRules: string[]
}

export type MCPFunctions = {
  getSaoPauloDate: {
    function: () => { currentDate: string; timezone: string; iso8601: string }
    description: string
    parameters: Record<string, unknown>
  }
  getSalonInfo: {
    function: () => SalonInfo
    description: string
    parameters: Record<string, unknown>
  }
  getProfessionalLinkContactToAttachInAnswer: {
    function: () => LinkInfo
    description: string
    parameters: Record<string, unknown>
  }
  getCalendarEventCancellationRules: {
    function: () => CancellationRules
    description: string
    parameters: Record<string, unknown>
  }
  getAllServicesTable: {
    function: () => ServiceItem[]
    description: string
    parameters: Record<string, unknown>
  }
  fetchCalendarEvents: {
    function: (params: FetchCalendarEventsProps) => Promise<any>
    description: string
    parameters: Record<string, unknown>
  }
  checkEventAvailability: {
    function: (params: CheckEventAvailabilityProps) => Promise<any>
    description: string
    parameters: CheckEventAvailabilityProps
  }
  checkEventCancellationEligibility: {
    function: (params: CheckEventCancellationEligibilityProps) => Promise<any>
    description: string
    parameters: CheckEventCancellationEligibilityProps
  }
  checkAndCancelEventIfEligible: {
    function: (params: CheckEventCancellationEligibilityProps) => Promise<any>
    description: string
    parameters: CheckEventCancellationEligibilityProps
  }
  createCalendarEvent: {
    function: (params: CreateCalendarEventProps) => Promise<any>
    description: string
    parameters: CreateCalendarEventProps
  }
  cancelCalendarEvent: {
    function: (params: CancelCalendarEventProps) => Promise<any>
    description: string
    parameters: CancelCalendarEventProps
  }
  suggestEventTimes: {
    function: (params: SuggestEventTimesProps) => Promise<any>
    description: string
    parameters: SuggestEventTimesProps
  }
}

// MCP functions registry
export const mcpFunctions: MCPFunctions = {
  getSaoPauloDate: {
    function: getSaoPauloDate,
    description: 'Get the current date and time in São Paulo, Brazil',
    parameters: {},
  },
  getSalonInfo: {
    function: getSalonInfo,
    description: 'Consultar informações gerais sobre o salão',
    parameters: {},
  },
  getProfessionalLinkContactToAttachInAnswer: {
    function: getProfessionalLinkContactToAttachInAnswer,
    description:
      'Buscar o link de contato do profissional para incluir na resposta',
    parameters: {},
  },
  getCalendarEventCancellationRules: {
    function: getCalendarEventCancellationRules,
    description: 'Regras para cancelamento',
    parameters: {},
  },
  getAllServicesTable: {
    function: getAllServicesTable,
    description:
      'Consultar a lista de todos os serviços (procedimentos) oferecidos pelo salão e tempo necessário para execução. Nota: A duração do evento deve ser de pelo menos a duração do serviço',
    parameters: {},
  },
  fetchCalendarEvents: {
    function: async (params) => {
      return new Promise((resolve, reject) => {
        authorize(async (auth) => {
          try {
            const events = await getGoogleCalendarEvents({
              ...params,
              calendarId: GABE_CALENDAR_ID,
              auth,
            })

            const simplifiedEvents = events.map(
              ({
                id,
                status,
                created,
                summary,
                // creator,
                // organizer,
                start,
                end,
                // sequence,
                // attendees,
                // eventType,
              }) => ({
                id,
                status,
                created,
                summary,
                // creator,
                // organizer,
                start,
                end,
                // sequence,
                // attendees,
                // eventType,
              }),
            )

            resolve(simplifiedEvents)
          } catch (error) {
            reject(error as Error)
          }
        })
      })
    },
    description:
      'Fetch events from the Google Calendar within a specified time range.',
    parameters: {
      timeMin: 'string',
      timeMax: 'string',
      singleEvents: 'boolean',
      orderBy: 'string',
    },
  },
  checkEventAvailability: {
    function: checkEventAvailability,
    description:
      'Verificar se um horário proposto está disponível e não conflita com outros eventos ou restrições. Quando há conflitos, retorna os períodos de tempo disponíveis no dia para agendamento do serviço solicitado.',
    parameters: {
      proposedStartTime: 'string',
      proposedEndTime: 'string',
      serviceDurationMinutes: 120, // example number, will be overridden by actual parameter
    },
  },
  checkEventCancellationEligibility: {
    function: checkEventCancellationEligibility,
    description:
      'Verificar se um evento é elegível para cancelamento baseado nas regras de cancelamento (48h de antecedência, telefone correspondente, evento existente)',
    parameters: {
      eventId: 'string',
      userPhone: 'string',
    },
  },
  checkAndCancelEventIfEligible: {
    function: checkAndCancelEventIfEligible,
    description:
      'Verificar elegibilidade e cancelar evento automaticamente se estiver elegível. Retorna informações sobre o processo e se deve enviar cartão de contato do Gabe.',
    parameters: {
      eventId: 'string',
      userPhone: 'string',
    },
  },
  createCalendarEvent: {
    function: async (params) => {
      return new Promise((resolve, reject) => {
        authorize(async (auth) => {
          try {
            const event = await createCalendarEvent({
              ...params,
              calendarId: GABE_CALENDAR_ID,
              auth,
            })
            resolve(event)
          } catch (error) {
            reject(error as Error)
          }
        })
      })
    },
    description: 'Create a new event in the Google Calendar.',
    parameters: {
      calendarId: 'string',
      event: {
        summary: 'string',
        location: 'string',
        description: 'string',
        start: {
          dateTime: 'string',
          timeZone: 'string',
        },
        end: {
          dateTime: 'string',
          timeZone: 'string',
        },
        // attendees: [
        //   {
        //     email: "string",
        //   },
        // ],
      },
    },
  },
  cancelCalendarEvent: {
    function: async (params) => {
      return new Promise((resolve, reject) => {
        authorize(async (auth) => {
          try {
            const res = await cancelCalendarEvent({
              ...params,
              auth,
            })
            resolve(res)
          } catch (error) {
            reject(error as Error)
          }
        })
      })
    },
    description: 'Cancelar um evento existente no Google Calendar.',
    parameters: {
      calendarId: 'string',
      eventId: 'string',
    },
  },
  suggestEventTimes: {
    function: suggestEventTimes,
    description:
      'Sugerir horários disponíveis para agendamento considerando a disponibilidade da agenda, duração do serviço e preferências de agrupamento de eventos. Evita sugerir sábados quando possível e agrupa eventos próximos uns dos outros.',
    parameters: {
      serviceDurationMinutes: 120, // example number, will be overridden by actual parameter
      daysToConsider: 14, // optional, defaults to 14
    },
  },
}

// MCP function call
export async function handlerMPCRequest(
  functionName: keyof MCPFunctions,
  parameters:
    | Maybe<Record<string, unknown>>
    | FetchCalendarEventsProps
    | CheckEventAvailabilityProps
    | CheckEventCancellationEligibilityProps
    | SuggestEventTimesProps,
) {
  if (!mcpFunctions[functionName]) {
    throw new Error(`Function ${functionName} not found`)
  }

  try {
    switch (functionName) {
      case 'getSaoPauloDate':
      case 'getAllServicesTable':
      case 'getSalonInfo':
      case 'getCalendarEventCancellationRules':
      case 'getProfessionalLinkContactToAttachInAnswer':
        return mcpFunctions[functionName].function()
      case 'fetchCalendarEvents':
        return mcpFunctions[functionName].function(
          parameters as FetchCalendarEventsProps,
        )
      case 'checkEventAvailability':
        return mcpFunctions[functionName].function(
          parameters as CheckEventAvailabilityProps,
        )
      case 'checkEventCancellationEligibility':
      case 'checkAndCancelEventIfEligible':
        return mcpFunctions[functionName].function(
          parameters as CheckEventCancellationEligibilityProps,
        )
      case 'createCalendarEvent':
        return mcpFunctions[functionName].function(
          parameters as CreateCalendarEventProps,
        )
      case 'cancelCalendarEvent':
        return mcpFunctions[functionName].function(
          parameters as CancelCalendarEventProps,
        )
      case 'suggestEventTimes':
        return mcpFunctions[functionName].function(
          parameters as SuggestEventTimesProps,
        )
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error)
    throw error
  }
}
