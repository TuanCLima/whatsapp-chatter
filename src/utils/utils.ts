import { getSaoPauloDate } from '../mcp/mcpService'
import { FALLBACK_PROMPT } from './contants'
import { assistantConfigService } from '../services/AssistantConfigService'

export const getInitialPrompt = () => {
  const currentTime = getSaoPauloDate()
  const timeAwarePrompt = `${process.env.MYPROMPT ?? FALLBACK_PROMPT}

INFORMAÇÃO DE TEMPO ATUAL:
- Data e hora atual: ${currentTime.currentDate}
- Fuso horário: ${currentTime.timezone}
- Timestamp: ${currentTime.iso8601}

IMPORTANTE: Você tem acesso a uma ferramenta chamada "getSaoPauloDate" que pode ser usada para obter informações atualizadas de data e hora sempre que necessário durante a conversa.`
  return timeAwarePrompt
}

export const getInitialPromptForPhoneNumber = async (phoneNumber: string) => {
  const currentTime = getSaoPauloDate()
  
  // Get custom prompt for this phone number, falls back to environment or default
  const basePrompt = await assistantConfigService.getPromptForPhoneNumber(phoneNumber)
  
  const timeAwarePrompt = `${basePrompt}

INFORMAÇÃO DE TEMPO ATUAL:
- Data e hora atual: ${currentTime.currentDate}
- Fuso horário: ${currentTime.timezone}
- Timestamp: ${currentTime.iso8601}

IMPORTANTE: Você tem acesso a uma ferramenta chamada "getSaoPauloDate" que pode ser usada para obter informações atualizadas de data e hora sempre que necessário durante a conversa.`
  return timeAwarePrompt
}

export const dateToTimestamp = (date: Date): string => {
  return new Date(date).toISOString().replace('T', ' ').replace('Z', '').substring(0, 23)
}