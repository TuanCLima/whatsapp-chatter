import type { ChatCompletionTool } from 'openai/resources/chat'

enum FunctionName {
  getSaoPauloDate = 'getSaoPauloDate',
}

const dateTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: FunctionName.getSaoPauloDate,
    description: 'Get the current date and time in São Paulo, Brazil',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
}

export { dateTool }
