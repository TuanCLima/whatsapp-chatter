import moment from "moment-timezone";
import { Maybe } from "../types/types";
import { authorize } from "../googleCalendar/googleAuth";
import {
  cancelCalendarEvent,
  createCalendarEvent,
  getGoogleCalendarEvents,
} from "../googleCalendar/googleCalendar";
import {
  CALENDAR_EVENT_CANCELLATION_RULES,
  GABE_CALENDAR_ID,
  LINK_INFO,
  SALON_INFO,
  SERVICES,
} from "../utils/contants";

export function getSaoPauloDate() {
  try {
    const tz = "America/Sao_Paulo";
    const momentDate = moment().tz(tz).format("YYYY-MM-DD HH:mm:ss");
    const isoDate = moment().tz("America/Sao_Paulo").toISOString();

    const date = new Date(momentDate);
    const formattedDate = date.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      currentDate: formattedDate,
      timezone: tz,
      iso8601: isoDate,
    };
  } catch (error) {
    console.error("Error fetching São Paulo date:", error);
    throw new Error("Failed to fetch São Paulo date");
  }
}

export function getAllServicesTable() {
  return SERVICES;
}

export function getSalonInfo() {
  return SALON_INFO;
}

export function getProfessionalLinkContactToAttachInAnswer() {
  return LINK_INFO;
}

export function getCalendarEventCancellationRules() {
  return CALENDAR_EVENT_CANCELLATION_RULES;
}

export async function checkEventAvailability(params: CheckEventAvailabilityProps) {
  const { proposedStartTime, proposedEndTime, serviceDurationMinutes } = params;

  try {
    // Parse the proposed times
    const startDate = new Date(proposedStartTime);
    const endDate = new Date(proposedEndTime);
    
    // Check if the proposed time is valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return {
        available: false,
        message: "Horário inválido fornecido. Por favor, forneça um horário válido.",
        conflicts: [],
      };
    }

    // Check forbidden hours (12h-13h / lunch time)
    const startHour = startDate.getHours();
    const endHour = endDate.getHours();
    const startMinutes = startDate.getMinutes();
    const endMinutes = endDate.getMinutes();
    
    // Check if event overlaps with lunch time (12:00-13:00)
    const isStartInLunch = (startHour === 12) || (startHour === 11 && startMinutes > 45);
    const isEndInLunch = (endHour === 12) || (endHour === 13 && endMinutes === 0);
    const spansLunch = startHour < 12 && endHour >= 13;
    
    if (isStartInLunch || isEndInLunch || spansLunch) {
      return {
        available: false,
        message: "Este horário não está disponível pois conflita com o horário de almoço (12:00-13:00). Por favor, escolha um horário antes das 12:00 ou após as 13:00.",
        conflicts: ["lunch_time"],
      };
    }

    // Check if it's outside business hours (assuming 9h-19h)
    if (startHour < 9 || startHour >= 19 || endHour > 19) {
      return {
        available: false,
        message: "Este horário está fora do horário de funcionamento (09:00-19:00). Por favor, escolha um horário dentro do período de atendimento.",
        conflicts: ["outside_business_hours"],
      };
    }

    // Fetch existing events to check for conflicts
    const dayStart = new Date(startDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startDate);
    dayEnd.setHours(23, 59, 59, 999);

    return new Promise((resolve, reject) => {
      authorize(async (auth) => {
        try {
          const events = await getGoogleCalendarEvents({
            calendarId: GABE_CALENDAR_ID,
            timeMin: dayStart.toISOString(),
            timeMax: dayEnd.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            auth,
          });

          const conflicts: string[] = [];
          const conflictingEvents: any[] = [];

          for (const event of events) {
            if (!event.start?.dateTime || !event.end?.dateTime) continue;

            const eventStart = new Date(event.start.dateTime);
            const eventEnd = new Date(event.end.dateTime);

            // Check for overlaps with 0-minute buffer
            const bufferMinutes = 0;
            const eventStartWithBuffer = new Date(eventStart.getTime() - bufferMinutes * 60000);
            const eventEndWithBuffer = new Date(eventEnd.getTime() + bufferMinutes * 60000);

            // Check if proposed event overlaps with existing event (considering buffer)
            const hasOverlap =
              (startDate < eventEndWithBuffer && endDate > eventStartWithBuffer) || (startDate < eventEnd && endDate > eventStart);

            if (hasOverlap) {
              conflicts.push(`event_${event.id}`);
              conflictingEvents.push({
                id: event.id,
                summary: event.summary,
                start: event.start.dateTime,
                end: event.end.dateTime,
              });
            }
          }

          if (conflicts.length > 0) {
            const conflictDetails = conflictingEvents
              .map(e => `${e.summary || 'Evento'} (${new Date(e.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}-${new Date(e.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`)
              .join(', ');

            resolve({
              available: false,
              message: `Este horário não está disponível pois conflita com: ${conflictDetails}. Por favor, escolha outro horário.`,
              conflicts,
              conflictingEvents,
            });
          } else {
            resolve({
              available: true,
              message: `Horário disponível! O agendamento pode ser feito das ${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} no dia ${startDate.toLocaleDateString('pt-BR')}.`,
              conflicts: [],
            });
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("Error checking event availability:", error);
    return {
      available: false,
      message: "Erro ao verificar disponibilidade. Por favor, tente novamente.",
      conflicts: [],
    };
  }
}

export type FetchCalendarEventsProps = {
  timeMin: string;
  timeMax: string;
  maxResults?: number;
  singleEvents?: boolean;
  orderBy?: "startTime" | "updated";
};

export type CreateCalendarEventProps = {
  calendarId: string;
  event: {
    summary: string;
    location: string;
    description: string;
    start: {
      dateTime: string;
      timeZone: string;
    };
    end: {
      dateTime: string;
      timeZone: string;
    };
    // attendees?: { email: string }[];
  };
};

export type CancelCalendarEventProps = {
  calendarId: "string";
  eventId: "string";
};

export type CheckEventAvailabilityProps = {
  proposedStartTime: string;
  proposedEndTime: string;
  serviceDurationMinutes: number;
};

export type ServiceItem = {
  name: string;
  timeToExecuteInMinutes?: number;
  details: string[];
  description?: string;
  priceInReais?: number;
};

export type LinkInfo = {
  professionalName: string;
  professionalLink: string;
}[];

export type SalonInfo = {
  Endereço: string;
  "Profissionais integrantes": string[];
  "Telefone para contato": string;
  Email: string;
  Instagram: string;
  InstagramHandle: string;
};

export type CancellationRules = {
  userRules: string[];
  assistantRules: string[];
};

export type MCPFunctions = {
  getSaoPauloDate: {
    function: () => { currentDate: string; timezone: string; iso8601: string };
    description: string;
    parameters: Record<string, unknown>;
  };
  getSalonInfo: {
    function: () => SalonInfo;
    description: string;
    parameters: Record<string, unknown>;
  };
  getProfessionalLinkContactToAttachInAnswer: {
    function: () => LinkInfo;
    description: string;
    parameters: Record<string, unknown>;
  };
  getCalendarEventCancellationRules: {
    function: () => CancellationRules;
    description: string;
    parameters: Record<string, unknown>;
  };
  getAllServicesTable: {
    function: () => ServiceItem[];
    description: string;
    parameters: Record<string, unknown>;
  };
  fetchCalendarEvents: {
    function: (params: FetchCalendarEventsProps) => Promise<any>;
    description: string;
    parameters: Record<string, unknown>;
  };
  checkEventAvailability: {
    function: (params: CheckEventAvailabilityProps) => Promise<any>;
    description: string;
    parameters: CheckEventAvailabilityProps;
  };
  createCalendarEvent: {
    function: (params: CreateCalendarEventProps) => Promise<any>;
    description: string;
    parameters: CreateCalendarEventProps;
  };
  cancelCalendarEvent: {
    function: (params: CancelCalendarEventProps) => Promise<any>;
    description: string;
    parameters: CancelCalendarEventProps;
  };
};

// MCP functions registry
export const mcpFunctions: MCPFunctions = {
  getSaoPauloDate: {
    function: getSaoPauloDate,
    description: "Get the current date and time in São Paulo, Brazil",
    parameters: {},
  },
  getSalonInfo: {
    function: getSalonInfo,
    description: "Consultar informações gerais sobre o salão",
    parameters: {},
  },
  getProfessionalLinkContactToAttachInAnswer: {
    function: getProfessionalLinkContactToAttachInAnswer,
    description:
      "Buscar o link de contato do profissional para incluir na resposta",
    parameters: {},
  },
  getCalendarEventCancellationRules: {
    function: getCalendarEventCancellationRules,
    description: "Regras para cancelamento",
    parameters: {},
  },
  getAllServicesTable: {
    function: getAllServicesTable,
    description:
      "Consultar a lista de todos os serviços (procedimentos) oferecidos pelo salão, bem como seus preços e tempo necessário para execução. Nota: A duração do evento deve ser de pelo menos a duração do serviço",
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
            });

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
              })
            );

            resolve(simplifiedEvents);
          } catch (error) {
            reject(error as Error);
          }
        });
      });
    },
    description:
      "Fetch events from the Google Calendar within a specified time range.",
    parameters: {
      timeMin: "string",
      timeMax: "string",
      maxResults: "number",
      singleEvents: "boolean",
      orderBy: "string",
    },
  },
  checkEventAvailability: {
    function: checkEventAvailability,
    description: "Verificar se um horário proposto está disponível e não conflita com outros eventos ou restrições",
    parameters: {
      proposedStartTime: "string",
      proposedEndTime: "string", 
      serviceDurationMinutes: 120, // example number, will be overridden by actual parameter
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
            });
            resolve(event);
          } catch (error) {
            reject(error as Error);
          }
        });
      });
    },
    description: "Create a new event in the Google Calendar.",
    parameters: {
      calendarId: "string",
      event: {
        summary: "string",
        location: "string",
        description: "string",
        start: {
          dateTime: "string",
          timeZone: "string",
        },
        end: {
          dateTime: "string",
          timeZone: "string",
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
            });
            resolve(res);
          } catch (error) {
            reject(error as Error);
          }
        });
      });
    },
    description: "Cancelar um evento existente no Google Calendar.",
    parameters: {
      calendarId: "string",
      eventId: "string",
    },
  },
};

// MCP function call
export async function handlerMPCRequest(
  functionName: keyof MCPFunctions,
  parameters: Maybe<Record<string, unknown>> | FetchCalendarEventsProps | CheckEventAvailabilityProps
) {
  if (!mcpFunctions[functionName]) {
    throw new Error(`Function ${functionName} not found`);
  }

  try {
    switch (functionName) {
      case "getSaoPauloDate":
      case "getAllServicesTable":
      case "getSalonInfo":
      case "getCalendarEventCancellationRules":
      case "getProfessionalLinkContactToAttachInAnswer":
        return mcpFunctions[functionName].function();
      case "fetchCalendarEvents":
        return mcpFunctions[functionName].function(
          parameters as FetchCalendarEventsProps
        );
      case "checkEventAvailability":
        return mcpFunctions[functionName].function(
          parameters as CheckEventAvailabilityProps
        );
      case "createCalendarEvent":
        return mcpFunctions[functionName].function(
          parameters as CreateCalendarEventProps
        );
      case "cancelCalendarEvent":
        return mcpFunctions[functionName].function(
          parameters as CancelCalendarEventProps
        );
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    throw error;
  }
}
