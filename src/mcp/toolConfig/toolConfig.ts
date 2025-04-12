import { ChatCompletionTool } from "openai/resources/chat";

export const dateTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "getSaoPauloDate",
    description: "Get the current date and time in São Paulo, Brazil",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const fetchEventsTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "fetchCalendarEvents",
    description:
      "Fetch events from the Google Calendar within a specified time range.",
    parameters: {
      type: "object",
      properties: {
        timeMin: {
          type: "string",
          description: "The start of the time range (ISO 8601 format).",
        },
        timeMax: {
          type: "string",
          description: "The end of the time range (ISO 8601 format).",
        },
        maxResults: {
          type: "integer",
          description: "The maximum number of events to fetch.",
        },
        singleEvents: {
          type: "boolean",
          description:
            "Whether to expand recurring events into individual instances.",
        },
        orderBy: {
          type: "string",
          enum: ["startTime", "updated"],
          description: "The order of the events in the response.",
        },
      },
      required: ["timeMin", "timeMax"],
    },
  },
};

export const toolConfig = {
  dateTool,
  fetchEventsTool,
};
