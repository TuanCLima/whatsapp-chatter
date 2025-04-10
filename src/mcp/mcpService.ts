import moment from "moment-timezone";
import { Maybe } from "../types/types";

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

export type MCPFunctions = {
  getSaoPauloDate: {
    function: () => { currentDate: string; timezone: string; iso8601: string };
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
};

// MCP function call
export async function handlerMPCRequest(
  functionName: keyof MCPFunctions,
  parameters: Maybe<Record<string, unknown>>
) {
  if (!mcpFunctions[functionName]) {
    throw new Error(`Function ${functionName} not found`);
  }

  try {
    return mcpFunctions[functionName].function();
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    throw error;
  }
}
