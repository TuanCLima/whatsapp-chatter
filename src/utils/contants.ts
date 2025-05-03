import {
  CancellationRules,
  LinkInfo,
  SalonInfo,
  ServiceItem,
} from "../mcp/mcpService";

export const GABE_CALENDAR_ID =
  "655f352e632432559b496c08e28b63abd11a7af04585aed6d28b19e29dd36eec@group.calendar.google.com";

export const SERVICES: ServiceItem[] = [
  {
    name: "Corte",
    description: "",
    details: [
      "⁠O valor de corte é fixo, independente da quantidade e tamanho do cabelo.",
      "Por enquanto não trabalhamos com cortes curtos estilo tapered cut, que precisem do acabamento da máquina no geral.",
    ],
    timeToExecuteInMinutes: 120,
    priceInReais: 135,
  },
  {
    name: "Finalização",
    description:
      "⁠A finalização é composta por lavagem, finalização com cremes, mousses, gelatinas e a secagem no difusor",
    details: [
      "⁠Todos os procedimentos incluem finalização. ",
      /* "⁠Para orçamento de finalização, pedimos uma foto do seu cabelo de costas solto e seco, ou para comparecer presencialmente.", */
    ],
    timeToExecuteInMinutes: 90,
  },
  {
    name: "Coloração e mechas",
    description: "⁠",
    details: [],
    timeToExecuteInMinutes: 180,
  },
  {
    name: "Penteados",
    description: "⁠",
    details: [],
  },
  {
    name: "Maquiagens",
    description: "⁠",
    details: [],
  },
  {
    name: "Tranças",
    description: "⁠",
    details: [],
  },
];

const {
  SALON_ADDR,
  SALON_PHONE,
  SALON_EMAIL,
  SALON_INSTAGRAM_HANDLE,
  SALON_INSTAGRAM_URL,
} = process.env;

export const SALON_INFO: SalonInfo = {
  Endereço: SALON_ADDR!,
  "Profissionais integrantes": ["Gabe", "Rafa", "Karina"],
  "Telefone para contato": SALON_PHONE!,
  Email: SALON_EMAIL!,
  Instagram: SALON_INSTAGRAM_URL!,
  InstagramHandle: SALON_INSTAGRAM_HANDLE!,
};

export const LINK_INFO: LinkInfo = [
  {
    professionalLink: "",
    professionalName: "Gabe",
  },
  {
    professionalLink: "",
    professionalName: "Rafa",
  },
  {
    professionalLink: "",
    professionalName: "Karina",
  },
];

export const CALENDAR_EVENT_CANCELLATION_RULES: CancellationRules = {
  userRules: [
    "Cancelamentos devem ser realizados pelo menos 24 horas antes do horário agendamento",
    "Busque chegar no horário",
    "Para cancelar o procedimento, entre em contato direto com o profissional que ira te atender",
  ],
  assistanteRules: [
    "Em caso de cancelamento, encaminhe o contato do profissional que irá atender o cliente",
  ],
};
