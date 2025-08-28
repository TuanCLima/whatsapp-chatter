import type {
  CancellationRules,
  LinkInfo,
  SalonInfo,
  ServiceItem,
} from '../mcp/mcpService'

export const GABE_CALENDAR_ID =
  '655f352e632432559b496c08e28b63abd11a7af04585aed6d28b19e29dd36eec@group.calendar.google.com'

export const FALLBACK_PROMPT =
  'Você é um assistente de salão de baleza. Responda sempre em português. Atualmente o salão está em manutenção. Se entrarem em contato. Diga que o atendimento por whatsapp está temporariamente fora de serviço.'

export const PRODUCTION_DOMAIN = 'https://hono-api-2w97.onrender.com/'
export const FRONTEND_LOCALHOST = 'http://localhost:5173'

export const SERVICES: ServiceItem[] = [
  {
    name: 'Corte',
    description: '',
    details: [
      'Inclui a finalização',
      '⁠O valor de corte é fixo, independente da quantidade e tamanho do cabelo.',
      'Por enquanto não trabalhamos com cortes curtos estilo tapered cut, que precisem do acabamento da máquina no geral.',
    ],
    timeToExecuteInMinutes: 90,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Combo corte e tratamento',
    description: '',
    options: ['hidratação', 'nutrição'],
    details: ['Inclui uma das opções descritas'],
    timeToExecuteInMinutes: 105,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Combo corte e tratamento 2',
    description: '',
    options: ['reconstrução', 'acidificação'],
    details: ['Inclui uma das opções descritas'],
    timeToExecuteInMinutes: 110,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Finalização',
    description:
      '⁠A finalização é composta por lavagem, finalização com cremes, mousses, gelatinas e a secagem no difusor',
    details: [
      '⁠Todos os procedimentos incluem finalização. ',
      /* "⁠Para orçamento de finalização, pedimos uma foto do seu cabelo de costas solto e seco, ou para comparecer presencialmente.", */
    ],
    timeToExecuteInMinutes: 60,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Hidratação',
    description: '⁠',
    details: ['Inclui uma finalização'],
    timeToExecuteInMinutes: 75,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Nutrição',
    description: '⁠',
    details: ['Inclui uma finalização'],
    timeToExecuteInMinutes: 75,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Reconstrução',
    description: '⁠',
    details: ['Inclui uma finalização'],
    timeToExecuteInMinutes: 75,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Acidificação',
    description: '⁠',
    details: ['Inclui uma finalização'],
    timeToExecuteInMinutes: 90,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Detox capilar',
    description: '⁠',
    details: ['Inclui uma finalização'],
    timeToExecuteInMinutes: 90,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Pacote de cronograma capilar',
    description: '⁠',
    details: [
      'O pacote é composto por 4 sessões de tratamentos personalizados de acordo com a necessidade do fio',
      'Inclui uma finalização em cada sessão',
      'A duração especificada é por sessão',
    ],
    timeToExecuteInMinutes: 80,
    performedBy: ['Gabe', 'Rafa'],
  },
  {
    name: 'Coloração: Iluminado',
    description: '⁠',
    details: ['Inclui tratamento, tonalização, finalização e secagem'],
    performedBy: ['Rafa'],
  },
  {
    name: 'Coloração: Loiro',
    description: '⁠',
    details: ['Inclui tratamento, tonalização, finalização e secagem'],
    performedBy: ['Rafa'],
  },
  {
    name: 'Coloração: Ruivo',
    description: '⁠',
    details: ['Inclui tratamento, tonalização, finalização e secagem'],
    performedBy: ['Rafa'],
  },
  {
    name: 'Retoque de Raiz',
    description: '⁠',
    details: ['Inclui lavagem, finalização e secagem'],
    performedBy: ['Rafa'],
  },
  {
    name: 'Penteados',
    description: '⁠',
    details: [],
    performedBy: ['Karina'],
  },
  {
    name: 'Maquiagens',
    description: '⁠',
    details: [],
    performedBy: ['Karina'],
  },
  {
    name: 'Tranças',
    description: '⁠',
    details: [],
    performedBy: ['Karina'],
  },
]

const {
  SALON_ADDR,
  SALON_PHONE,
  SALON_EMAIL,
  SALON_INSTAGRAM_HANDLE,
  SALON_INSTAGRAM_URL,
} = process.env

export const SALON_INFO: SalonInfo = {
  Endereço: SALON_ADDR!,
  'Profissionais integrantes': ['Gabe', 'Rafa', 'Karina'],
  'Telefone para contato': SALON_PHONE!,
  Email: SALON_EMAIL!,
  Instagram: SALON_INSTAGRAM_URL!,
  InstagramHandle: SALON_INSTAGRAM_HANDLE!,
}

export const LINK_INFO: LinkInfo = [
  {
    professionalLink: '',
    professionalName: 'Gabe',
  },
  {
    professionalLink: '',
    professionalName: 'Rafa',
  },
  {
    professionalLink: '',
    professionalName: 'Karina',
  },
]

export const CALENDAR_EVENT_CANCELLATION_RULES: CancellationRules = {
  userRules: [
    'Cancelamentos devem ser realizados pelo menos 24 horas antes do horário do agendamento',
  ],
  assistantRules: [
    'Em caso de cancelamento, confirme se o telefone e o nome do cliente correspondem aos dados constantes no corpo do evento',
  ],
}

export const IS_DEV = process.env.NODE_ENV === 'development'
