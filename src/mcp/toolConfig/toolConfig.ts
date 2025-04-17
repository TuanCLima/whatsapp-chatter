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

export const servicesTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "getAllServicesTable",
    description:
      "Consultar a lista de todos os serviços (procedimentos) oferecidos pelo salão, bem como seus preços e tempo necessário para execução. Nota: A duração do evento deve ser de pelo menos a duração do serviço",
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

export const createEventTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "createCalendarEvent",
    description: "Create a new event in the Google Calendar.",
    parameters: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description:
            "The ID of the calendar where the event will be created.",
        },
        event: {
          type: "object",
          description: "The event details.",
          properties: {
            summary: {
              type: "string",
              description:
                "Aqui vai o nome do cliente. Não pergunte a ele sobre esse campo",
            },
            location: { type: "string", description: "Não preencher" },
            description: {
              type: "string",
              description:
                "Aqui vai metadados como o serviço escolhido pela cliente. Exemplo: corte e/ou finalização. Importante: Não pergunte ao cliente sobre o campo. Pergunte sobre o serviço de interesse e deduza-o o campo a partir dele",
            },
            start: {
              type: "object",
              description:
                "Início do evento. O evento deve começar pelo menos 15 minutos do anterior terminar",
              properties: {
                dateTime: {
                  type: "string",
                  description: "Start time (ISO 8601).",
                },
                timeZone: { type: "string", description: "Time zone." },
              },
              required: ["dateTime", "timeZone"],
            },
            end: {
              type: "object",
              description:
                "Horário de término. Deduza este a partir da duração do evento, que por sua vez você deve deduzir a partir da duração do serviço escolhido. O evento deve terminar pelo menos 15 minutos antes do próximo começar",
              properties: {
                dateTime: {
                  type: "string",
                  description: "End time (ISO 8601).",
                },
                timeZone: { type: "string", description: "Time zone." },
              },
              required: ["dateTime", "timeZone"],
            },
            attendees: {
              type: "array",
              description:
                "Lista de convidados. Optional. Perguntar ao cliente se deseja incluir email para recever evento no calendário. Confirmar validade do email",
              items: {
                type: "object",
                properties: {
                  email: { type: "string", description: "Email do convidado." },
                },
              },
            },
          },
          required: ["summary", "start", "end"],
        },
      },
      required: ["calendarId", "event"],
    },
  },
};

export const toolConfig = {
  dateTool,
  fetchEventsTool,
  createEventTool,
};
