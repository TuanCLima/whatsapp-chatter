import type { ChatCompletionTool } from 'openai/resources/chat'

enum FunctionName {
  getSaoPauloDate = 'getSaoPauloDate',
  sendServicePrices = 'sendServicePrices',
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

const sendServicePricesTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: FunctionName.sendServicePrices,
    description:
      'Enviar imagem com os preços dos serviços para o cliente via WhatsApp. Use esta ferramenta quando o cliente solicitar informações sobre preços dos serviços.',
    parameters: {
      type: 'object',
      properties: {
        userPhoneNumber: {
          type: 'string',
          description:
            'O número de telefone do cliente (formato WhatsApp com whatsapp: prefix)',
        },
      },
      required: ['userPhoneNumber'],
    },
  },
}

export { dateTool, sendServicePricesTool }
