import moment from "moment-timezone";
import { Maybe } from "../types/types";
import { authorize } from "../googleCalendar/googleAuth";
import { getGoogleCalendarEvents } from "../googleCalendar/googleCalendar";

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

export type FetchCalendarEventsProps = {
  timeMin: string;
  timeMax: string;
  maxResults?: number;
  singleEvents?: boolean;
  orderBy?: "startTime" | "updated";
};

export type MCPFunctions = {
  getSaoPauloDate: {
    function: () => { currentDate: string; timezone: string; iso8601: string };
    description: string;
    parameters: Record<string, unknown>;
  };
  fetchCalendarEvents: {
    function: (params: FetchCalendarEventsProps) => Promise<any>;
    description: string;
    parameters: Record<string, unknown>;
  };
};

// MCP functions registry
export const mcpFunctions: MCPFunctions = {
  getSaoPauloDate: {
    function: getSaoPauloDate,
    description: "Get the current date and time in São Paulo, Brazil",
    parameters: {},
  },
  fetchCalendarEvents: {
    function: async (params) => {
      return new Promise((resolve, reject) => {
        authorize(async (auth) => {
          try {
            const events = await getGoogleCalendarEvents({
              ...params,
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
        return mcpFunctions[functionName].function();
      case "fetchCalendarEvents":
        return mcpFunctions[functionName].function(
          parameters as FetchCalendarEventsProps
        );
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    throw error;
  }
}
