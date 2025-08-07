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
function findAvailableTimeSpans(
  targetDate: Date,
  serviceDurationMinutes: number,
  existingEvents: any[],
): AvailableTimeSpan[] {
  const availableSpans: AvailableTimeSpan[] = []

  // Business hours: 9:00 - 19:00
  const businessStart = new Date(targetDate)
  businessStart.setHours(9, 0, 0, 0)

  const businessEnd = new Date(targetDate)
  businessEnd.setHours(19, 0, 0, 0)

  // Lunch break: 12:00 - 13:00
  const lunchStart = new Date(targetDate)
  lunchStart.setHours(12, 0, 0, 0)

  const lunchEnd = new Date(targetDate)
  lunchEnd.setHours(13, 0, 0, 0)

  // Collect all blocked time periods (events + lunch + outside business hours)
  const blockedPeriods = []

  // Add lunch break as blocked period
  blockedPeriods.push({
    start: lunchStart,
    end: lunchEnd,
    type: 'lunch',
  })

  // Add existing events as blocked periods (with 5-minute buffer)
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
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return {
        available: false,
        message:
          'Horário inválido fornecido. Por favor, forneça um horário válido.',
        conflicts: [],
        availableTimeSpans: [],
      }
    }

    // Check if salon is closed (Sundays and Mondays)
    const dayOfWeek = startDate.getDay() // 0 = Sunday, 1 = Monday
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
    const startHour = startDate.getHours()
    const endHour = endDate.getHours()
    const startMinutes = startDate.getMinutes()
    const endMinutes = endDate.getMinutes()

    // Check if event overlaps with lunch time (12:00-13:00)
    const isStartInLunch =
      startHour === 12 || (startHour === 11 && startMinutes > 45)
    const isEndInLunch =
      (endHour === 12 && endMinutes > 0) || (endHour === 13 && endMinutes === 0)
    const spansLunch = startHour < 12 && endHour >= 13

    // Check if it's outside business hours (assuming 9h-19h)
    const isOutsideBusinessHours =
      startHour < 9 || startHour >= 19 || endHour > 19

    // Fetch existing events to check for conflicts and find available time spans
    const dayStart = new Date(startDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(startDate)
    dayEnd.setHours(23, 59, 59, 999)

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
                'Este horário está fora do horário de funcionamento (09:00-19:00).'
            } else {
              const conflictDetails = conflictingEvents
                .map(
                  (e) =>
                    `${e.summary || 'Evento'} (${new Date(e.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}-${new Date(e.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`,
                )
                .join(', ')
              conflictMessage = `Este horário não está disponível pois conflita com: ${conflictDetails}.`
            }

            // Format available time spans for the message
            const availableSpansMessage =
              availableTimeSpans.length > 0
                ? ` Horários disponíveis no dia ${startDate.toLocaleDateString('pt-BR')}: ${availableTimeSpans
                    .map(
                      (span) =>
                        `${new Date(span.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}-${new Date(span.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${span.duration} minutos disponíveis)`,
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
              message: `Horário disponível! O agendamento pode ser feito das ${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} no dia ${startDate.toLocaleDateString('pt-BR')}.`,
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

export type ServiceItem = {
  name: string
  timeToExecuteInMinutes?: number
  details: string[]
  description?: string
  priceInReais?: number
  performedBy?: Atendentes[]
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
      'Consultar a lista de todos os serviços (procedimentos) oferecidos pelo salão, bem como seus preços e tempo necessário para execução. Nota: A duração do evento deve ser de pelo menos a duração do serviço',
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
                creator,
                organizer,
                start,
                end,
                sequence,
                attendees,
                eventType,
              }) => ({
                id,
                status,
                created,
                summary,
                creator,
                organizer,
                start,
                end,
                sequence,
                attendees,
                eventType,
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
}

// MCP function call
export async function handlerMPCRequest(
  functionName: keyof MCPFunctions,
  parameters:
    | Maybe<Record<string, unknown>>
    | FetchCalendarEventsProps
    | CheckEventAvailabilityProps
    | CheckEventCancellationEligibilityProps,
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
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error)
    throw error
  }
}
