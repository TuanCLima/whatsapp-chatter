import moment from "moment-timezone";
import { Maybe } from "../types/types";
import { authorize } from "../googleCalendar/googleAuth";
import {
  createCalendarEvent,
  getGoogleCalendarEvents,
} from "../googleCalendar/googleCalendar";
import { GABE_CALENDAR_ID, SERVICES } from "../utils/contants";

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
    attendees?: { email: string }[];
  };
};

export type ServiceItem = {
  name: string;
  timeToExecuteInMinutes?: number;
  rules: string[];
  description?: string;
  priceInReais?: number;
};

export type MCPFunctions = {
  getSaoPauloDate: {
    function: () => { currentDate: string; timezone: string; iso8601: string };
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
  createCalendarEvent: {
    function: (params: CreateCalendarEventProps) => Promise<any>;
    description: string;
    parameters: CreateCalendarEventProps;
  };
};

// MCP functions registry
export const mcpFunctions: MCPFunctions = {
  getSaoPauloDate: {
    function: getSaoPauloDate,
    description: "Get the current date and time in São Paulo, Brazil",
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
            resolve(events);
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
        attendees: [
          {
            email: "string",
          },
        ],
      },
    },
  },
};

// MCP function call
export async function handlerMPCRequest(
  functionName: keyof MCPFunctions,
  parameters: Maybe<Record<string, unknown>> | FetchCalendarEventsProps
) {
  if (!mcpFunctions[functionName]) {
    throw new Error(`Function ${functionName} not found`);
  }

  try {
    switch (functionName) {
      case "getSaoPauloDate":
      case "getAllServicesTable":
        return mcpFunctions[functionName].function();
      case "fetchCalendarEvents":
        return mcpFunctions[functionName].function(
          parameters as FetchCalendarEventsProps
        );
      case "createCalendarEvent":
        return mcpFunctions[functionName].function(
          parameters as CreateCalendarEventProps
        );
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    throw error;
  }
}
