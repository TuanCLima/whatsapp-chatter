import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { predefinedToolsConfig, saasUsers } from '../db/schema-postgres'
import { forwardContact } from '../mcp/mcpService'
import { getSaasGoogleCalendarService } from './SaasGoogleCalendarService'

export interface PredefinedToolConfig {
  id?: number
  toolType: string
  enabled: boolean
  configData?: Record<string, unknown>
}

export interface CalendarToolConfig {
  defaultCalendarId?: string
  workingHours?: {
    start: string
    end: string
  }
  timeZone?: string
}

export interface CalendarFunctionParameters {
  timeMin?: string
  timeMax?: string
  maxResults?: number
  calendarId?: string
  summary?: string
  description?: string
  startTime?: string
  endTime?: string
  attendees?: string[]
  eventId?: string
  duration?: number
  preferredDate?: string
  workingHours?: {
    start: string
    end: string
  }
  serviceDurationMinutes?: number
  daysToConsider?: number
  event?: {
    summary?: string
    location?: string
    description?: string
    start?: {
      dateTime: string
      timeZone?: string
    }
    end?: {
      dateTime: string
      timeZone?: string
    }
    attendees?: Array<{ email: string }>
  }
  userPhone?: string
  proposedStartTime?: string
  proposedEndTime?: string
  contactName?: string
  phoneNumberOfContactToSend?: string
}

export interface CalendarTool {
  type: string
  function: {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export class PredefinedToolsService {
  /**
   * Get all predefined tools configuration for a user
   */
  async getUserPredefinedTools(
    saasUserId: string,
  ): Promise<PredefinedToolConfig[]> {
    try {
      const configs = await db
        .select({
          id: predefinedToolsConfig.id,
          toolType: predefinedToolsConfig.toolType,
          enabled: predefinedToolsConfig.enabled,
          configData: predefinedToolsConfig.configData,
        })
        .from(predefinedToolsConfig)
        .where(eq(predefinedToolsConfig.saasUserId, saasUserId))

      return configs.map((config) => ({
        id: config.id,
        toolType: config.toolType,
        enabled: config.enabled,
        configData: config.configData
          ? JSON.parse(config.configData)
          : undefined,
      }))
    } catch (error) {
      console.error('Error fetching predefined tools config:', error)
      throw error
    }
  }

  /**
   * Get specific tool configuration for a user
   */
  async getToolConfig(
    saasUserId: string,
    toolType: string,
  ): Promise<PredefinedToolConfig | null> {
    try {
      const config = await db
        .select({
          id: predefinedToolsConfig.id,
          toolType: predefinedToolsConfig.toolType,
          enabled: predefinedToolsConfig.enabled,
          configData: predefinedToolsConfig.configData,
        })
        .from(predefinedToolsConfig)
        .where(
          and(
            eq(predefinedToolsConfig.saasUserId, saasUserId),
            eq(predefinedToolsConfig.toolType, toolType),
          ),
        )
        .limit(1)

      if (!config.length) {
        return null
      }

      const result = config[0]
      return {
        id: result.id,
        toolType: result.toolType,
        enabled: result.enabled,
        configData: result.configData
          ? JSON.parse(result.configData)
          : undefined,
      }
    } catch (error) {
      console.error('Error fetching tool config:', error)
      throw error
    }
  }

  /**
   * Update or create tool configuration for a user
   */
  async updateToolConfig(
    saasUserId: string,
    toolType: string,
    enabled: boolean,
    configData?: Record<string, unknown>,
  ): Promise<PredefinedToolConfig> {
    try {
      const existingConfig = await this.getToolConfig(saasUserId, toolType)
      const configDataString = configData ? JSON.stringify(configData) : null

      if (existingConfig) {
        // Update existing config
        await db
          .update(predefinedToolsConfig)
          .set({
            enabled,
            configData: configDataString,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(predefinedToolsConfig.saasUserId, saasUserId),
              eq(predefinedToolsConfig.toolType, toolType),
            ),
          )

        return {
          id: existingConfig.id,
          toolType,
          enabled,
          configData,
        }
      } else {
        // Create new config
        const result = await db
          .insert(predefinedToolsConfig)
          .values({
            saasUserId,
            toolType,
            enabled,
            configData: configDataString,
          })
          .returning({ id: predefinedToolsConfig.id })

        return {
          id: result[0].id,
          toolType,
          enabled,
          configData,
        }
      }
    } catch (error) {
      console.error('Error updating tool config:', error)
      throw error
    }
  }

  /**
   * Enable/disable calendar management tool
   */
  async toggleCalendarTool(
    saasUserId: string,
    enabled: boolean,
    config?: CalendarToolConfig,
  ): Promise<void> {
    try {
      await this.updateToolConfig(
        saasUserId,
        'calendar_management',
        enabled,
        config as Record<string, unknown>,
      )
    } catch (error) {
      console.error('Error toggling calendar tool:', error)
      throw error
    }
  }

  /**
   * Check if user has Google Calendar authenticated and tool enabled
   */
  async isCalendarToolReady(
    saasUserId: string,
  ): Promise<{ ready: boolean; hasAuth: boolean; enabled: boolean }> {
    try {
      // Check if user has Google Calendar authentication
      const user = await db
        .select({
          googleCalendarEnabled: saasUsers.googleCalendarEnabled,
          googleRefreshToken: saasUsers.googleRefreshToken,
        })
        .from(saasUsers)
        .where(eq(saasUsers.id, saasUserId))
        .limit(1)

      const hasAuth =
        user.length > 0 &&
        user[0].googleCalendarEnabled &&
        !!user[0].googleRefreshToken

      // Check if tool is enabled
      const toolConfig = await this.getToolConfig(
        saasUserId,
        'calendar_management',
      )
      const enabled = toolConfig?.enabled || false

      return {
        ready: hasAuth && enabled,
        hasAuth,
        enabled,
      }
    } catch (error) {
      console.error('Error checking calendar tool readiness:', error)
      return { ready: false, hasAuth: false, enabled: false }
    }
  }

  /**
   * Get calendar tools for LLM context
   */
  async getCalendarToolsForLLM(saasUserId: string): Promise<CalendarTool[]> {
    const status = await this.isCalendarToolReady(saasUserId)

    if (!status.ready) {
      return []
    }

    const toolConfig = await this.getToolConfig(
      saasUserId,
      'calendar_management',
    )
    const config = (toolConfig?.configData as CalendarToolConfig) || {}

    return [
      {
        type: 'function',
        function: {
          name: 'fetchCalendarEvents',
          description:
            'Use esta ferramenta para consultar a disponibilidade da agenda da Gabe antes de agendar qualquer coisa. Outros nomes para esta funcionalidade são: consultar agenda, consultar disponibilidade, consultar horários disponíveis',
          parameters: {
            type: 'object',
            properties: {
              timeMin: {
                type: 'string',
                description: 'The start of the time range (ISO 8601 format).',
              },
              timeMax: {
                type: 'string',
                description: 'The end of the time range (ISO 8601 format).',
              },
              maxResults: {
                type: 'integer',
                description: 'The maximum number of events to fetch.',
              },
              singleEvents: {
                type: 'boolean',
                description:
                  'Whether to expand recurring events into individual instances.',
              },
              orderBy: {
                type: 'string',
                enum: ['startTime', 'updated'],
                description: 'The order of the events in the response.',
              },
              calendarId: {
                type: 'string',
                description: 'Calendar ID to query (default: primary)',
                default: config.defaultCalendarId || 'primary',
              },
            },
            required: ['timeMin', 'timeMax'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'createCalendarEvent',
          description:
            'Criar um novo evento/agendamento/horário no calendário da Gabe. IMPORTANTE: SEMPRE use a ferramenta checkEventAvailability ANTES de criar qualquer evento para garantir disponibilidade. Não esqueça de adicionar o link do contato do whatsapp.',
          parameters: {
            type: 'object',
            properties: {
              event: {
                type: 'object',
                description: 'Detalhes do evento/agendamento a ser criado',
                properties: {
                  summary: {
                    type: 'string',
                    description:
                      'Aqui vai o nome do cliente. Não pergunte a ele sobre esse campo',
                  },
                  location: {
                    type: 'string',
                    description:
                      'Adicionar link do usuário (que é o campo phoneNumber da mensagem inicial do sistema) que está falando com o assistente no seguinte formato, de forma que quando clicado abra o whatsapp. O formato é https://wa.me/[numero do telefone]. Exemplo: https://wa.me/5511999999999',
                  },
                  description: {
                    type: 'string',
                    description:
                      'Aqui vai metadados 3 metadados: 1) o serviço escolhido pela cliente. Exemplo: corte e/ou finalização. 2) o telefone do cliente. 3) o nome do cliente (ProfileName). Importante: Não pergunte ao cliente sobre o campo. Pergunte sobre o serviço de interesse e deduza-o o campo a partir dele',
                  },
                  start: {
                    type: 'object',
                    description: 'Início do evento',
                    properties: {
                      dateTime: {
                        type: 'string',
                        description: 'Start time (ISO 8601).',
                      },
                      timeZone: { type: 'string', description: 'Time zone.' },
                    },
                    required: ['dateTime', 'timeZone'],
                  },
                  end: {
                    type: 'object',
                    description:
                      'Horário de término. Deduza este a partir da duração do evento, que por sua vez você deve deduzir a partir da duração do serviço escolhido',
                    properties: {
                      dateTime: {
                        type: 'string',
                        description: 'End time (ISO 8601).',
                      },
                      timeZone: { type: 'string', description: 'Time zone.' },
                    },
                    required: ['dateTime', 'timeZone'],
                  },
                },
                required: ['summary', 'start', 'end'],
              },
              calendarId: {
                type: 'string',
                description:
                  'Calendar ID to create event in (default: primary)',
                default: config.defaultCalendarId || 'primary',
              },
            },
            required: ['event'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'checkEventAvailability',
          description:
            'OBRIGATÓRIO: SEMPRE use esta ferramenta ANTES de sugerir ou confirmar qualquer agendamento ao cliente. Verifica se o horário proposto está disponível, não tem conflitos com outros eventos e respeita as restrições de horário (como não agendar entre 12h-13h). Use esta ferramenta para validar QUALQUER horário antes de oferecer ao cliente ou criar o evento.',
          parameters: {
            type: 'object',
            properties: {
              proposedStartTime: {
                type: 'string',
                description:
                  'Horário de início proposto para o evento (ISO 8601 format).',
              },
              proposedEndTime: {
                type: 'string',
                description:
                  'Horário de fim proposto para o evento (ISO 8601 format).',
              },
              serviceDurationMinutes: {
                type: 'integer',
                description: 'Duração do serviço em minutos.',
              },
              calendarId: {
                type: 'string',
                description: 'Calendar ID to check (default: primary)',
                default: config.defaultCalendarId || 'primary',
              },
            },
            required: [
              'proposedStartTime',
              'proposedEndTime',
              'serviceDurationMinutes',
            ],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'suggestEventTimes',
          description:
            'Sugerir horários disponíveis para agendamento considerando a agenda atual, duração do serviço e preferências inteligentes de agrupamento. Esta ferramenta analisa a disponibilidade em múltiplos dias, evita sugerir sábados quando possível (por ser o dia mais procurado), e tenta agrupar eventos para otimizar a agenda.',
          parameters: {
            type: 'object',
            properties: {
              serviceDurationMinutes: {
                type: 'integer',
                description:
                  'Duração do serviço em minutos para o qual se deseja sugerir horários.',
              },
              daysToConsider: {
                type: 'integer',
                description:
                  'Número de dias a partir de hoje para considerar na busca por horários. Se não fornecido, considera 14 dias por padrão.',
                default: 14,
              },
              workingHours: {
                type: 'object',
                properties: {
                  start: {
                    type: 'string',
                    description: 'Working hours start (HH:MM format)',
                    default: config.workingHours?.start || '09:00',
                  },
                  end: {
                    type: 'string',
                    description: 'Working hours end (HH:MM format)',
                    default: config.workingHours?.end || '17:00',
                  },
                },
              },
              calendarId: {
                type: 'string',
                description: 'Calendar ID to check (default: primary)',
                default: config.defaultCalendarId || 'primary',
              },
            },
            required: ['serviceDurationMinutes'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'cancelCalendarEvent',
          description:
            'Cancelar um evento/agendamento existente no calendário da Gabe. Chame a ferramenta fetchCalendarEvents para obter a id do evento a ser cancelado. Importante: Não é possível cancelar eventos com menos de 24 horas de antecedência',
          parameters: {
            type: 'object',
            properties: {
              eventId: {
                type: 'string',
                description: 'ID of the event to cancel',
              },
              calendarId: {
                type: 'string',
                description:
                  'Calendar ID containing the event (default: primary)',
                default: config.defaultCalendarId || 'primary',
              },
            },
            required: ['eventId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'checkEventCancellationEligibility',
          description:
            'Verificar se um evento é elegível para cancelamento baseado nas regras: evento deve existir, deve começar em mais de 48 horas, e o telefone deve corresponder ao registrado no evento. Use esta ferramenta apenas para verificar elegibilidade sem cancelar.',
          parameters: {
            type: 'object',
            properties: {
              eventId: {
                type: 'string',
                description: 'ID of the event to check',
              },
              calendarId: {
                type: 'string',
                description:
                  'Calendar ID containing the event (default: primary)',
                default: config.defaultCalendarId || 'primary',
              },
              userPhone: {
                type: 'string',
                description:
                  'O número de telefone do usuário solicitando o cancelamento (será comparado com o telefone registrado no evento).',
              },
            },
            required: ['eventId', 'userPhone'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'checkAndCancelEventIfEligible',
          description:
            'RECOMENDADO para cancelamentos: Verifica automaticamente se um evento é elegível para cancelamento e o cancela se todas as regras forem atendidas (evento existe, mais de 48h de antecedência, telefone corresponde). Se não for elegível, retorna instruções para enviar cartão de contato do Gabe. Não pergunte dados do evento ao usuário, use os dados do evento já fornecidos pela função fetchCalendarEvents',
          parameters: {
            type: 'object',
            properties: {
              eventId: {
                type: 'string',
                description: 'ID of the event to cancel',
              },
              calendarId: {
                type: 'string',
                description:
                  'Calendar ID containing the event (default: primary)',
                default: config.defaultCalendarId || 'primary',
              },
              userPhone: {
                type: 'string',
                description:
                  'O número de telefone do usuário solicitando o cancelamento (será comparado com o telefone registrado no evento).',
              },
            },
            required: ['eventId', 'userPhone'],
          },
        },
      },
    ]
  }

  /**
   * Check if user has contact management tool enabled
   */
  async isContactToolReady(
    saasUserId: string,
  ): Promise<{ ready: boolean; enabled: boolean }> {
    try {
      // Check if tool is enabled
      const toolConfig = await this.getToolConfig(
        saasUserId,
        'contact_management',
      )
      const enabled = toolConfig?.enabled || false

      return {
        ready: enabled,
        enabled,
      }
    } catch (error) {
      console.error('Error checking contact tool readiness:', error)
      return { ready: false, enabled: false }
    }
  }

  /**
   * Get contact management tools for LLM context
   */
  async getContactToolsForLLM(saasUserId: string): Promise<CalendarTool[]> {
    const status = await this.isContactToolReady(saasUserId)

    if (!status.ready) {
      return []
    }

    return [
      {
        type: 'function',
        function: {
          name: 'forwardContact',
          description:
            'Encaminhar contato. Use esta ferramenta de forma síncrona. Isto é, exemplo: para mandar: 1. Mensagem, 2. Encaminhamento, 3. Mensagem. Chame esta ferramenta após enviar a mensagem 1 e antes de enviar a mensagem 3.',
          parameters: {
            type: 'object',
            properties: {
              contactName: {
                type: 'string',
                description: 'The name of the contact to forward/share',
              },
              phoneNumberOfContactToSend: {
                type: 'string',
                description:
                  'Número do contato a ser enviado: example: +5511911112222',
              },
            },
            required: ['phoneNumberOfContactToSend'],
          },
        },
      },
    ]
  }

  /**
   * Execute calendar tool function
   */
  async executeCalendarFunction(
    saasUserId: string,
    functionName: string,
    parameters: CalendarFunctionParameters,
    twilioSenderNumber: string,
  ): Promise<unknown> {
    const status = await this.isCalendarToolReady(saasUserId)

    if (!status.ready) {
      throw new Error(
        'Calendar tool is not ready. Please ensure Google Calendar is authenticated and the tool is enabled.',
      )
    }

    try {
      switch (functionName) {
        case 'fetchCalendarEvents':
          try {
            return await getSaasGoogleCalendarService().fetchCalendarEvents(
              saasUserId,
              parameters.timeMin,
              parameters.timeMax,
              parameters.maxResults,
              parameters.calendarId,
            )
          } catch {
            return {
              success: false,
              message: 'Failed to fetch calendar events',
            }
          }

        case 'createCalendarEvent':
          if (parameters.event) {
            // New structure: event object with nested properties
            const event = {
              summary: parameters.event.summary,
              location: parameters.event.location,
              description: parameters.event.description,
              start: {
                dateTime: parameters.event.start?.dateTime,
                timeZone: parameters.event.start?.timeZone,
              },
              end: {
                dateTime: parameters.event.end?.dateTime,
                timeZone: parameters.event.end?.timeZone,
              },
              attendees: parameters.event.attendees,
            }
            return await getSaasGoogleCalendarService().createCalendarEvent(
              saasUserId,
              event,
              parameters.calendarId,
            )
          }
          break

        case 'checkEventAvailability':
          return await getSaasGoogleCalendarService().checkEventAvailability(
            saasUserId,
            parameters.proposedStartTime!,
            parameters.proposedEndTime!,
            parameters.serviceDurationMinutes!,
            parameters.calendarId,
          )

        case 'suggestEventTimes':
          return await getSaasGoogleCalendarService().suggestEventTimes(
            saasUserId,
            parameters.serviceDurationMinutes!,
            parameters.daysToConsider,
            parameters.workingHours,
            parameters.calendarId,
          )

        case 'cancelCalendarEvent':
          try {
            await getSaasGoogleCalendarService().cancelCalendarEvent(
              saasUserId,
              parameters.eventId!,
              parameters.calendarId,
            )
            return { success: true, message: 'Event cancelled successfully' }
          } catch {
            return { success: false, message: 'Failed to cancel event' }
          }

        case 'checkEventCancellationEligibility':
          return await getSaasGoogleCalendarService().checkEventCancellationEligibility(
            saasUserId,
            parameters.eventId!,
            parameters.userPhone!,
            parameters.calendarId,
          )

        case 'checkAndCancelEventIfEligible':
          return await getSaasGoogleCalendarService().checkAndCancelEventIfEligible(
            saasUserId,
            parameters.eventId!,
            parameters.calendarId,
          )

        case 'forwardContact':
          return await forwardContact({
            contactName: parameters.contactName,
            phoneNumberOfContactToSend: parameters.phoneNumberOfContactToSend!,
            phoneNumberOfSender: twilioSenderNumber,
          })

        default:
          throw new Error(`Unknown calendar function: ${functionName}`)
      }
    } catch (error) {
      console.error(`Error executing calendar function ${functionName}:`, error)
      throw error
    }
  }
}

export const predefinedToolsService = new PredefinedToolsService()
