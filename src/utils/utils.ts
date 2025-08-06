import { getSaoPauloDate } from '../mcp/mcpService'
import { FALLBACK_PROMPT } from './contants'

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
