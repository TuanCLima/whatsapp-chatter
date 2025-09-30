import { getSaoPauloDate } from '../mcp/mcpService'
import { assistantConfigService } from '../services/AssistantConfigService'

export const getInitialPromptForPhoneNumber = async (phoneNumber: string) => {
  const currentTime = getSaoPauloDate()

  // Get custom prompt for this phone number, falls back to environment or default
  const basePrompt =
    await assistantConfigService.getPromptForPhoneNumber(phoneNumber)

  const timeAwarePrompt = `${basePrompt}

INFORMAÇÃO DE TEMPO ATUAL:
- Data e hora atual: ${currentTime.currentDate}
- Fuso horário: ${currentTime.timezone}
- Timestamp: ${currentTime.iso8601}

IMPORTANTE: Você tem acesso a uma ferramenta chamada "getSaoPauloDate" que pode ser usada para obter informações atualizadas de data e hora sempre que necessário durante a conversa.`
  return timeAwarePrompt
}

export const noWhatsPhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.replace('whatsapp:', '')
}
