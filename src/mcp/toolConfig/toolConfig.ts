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
