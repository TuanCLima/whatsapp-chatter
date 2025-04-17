import { ServiceItem } from "../mcp/mcpService";

export const GABE_CALENDAR_ID =
  "655f352e632432559b496c08e28b63abd11a7af04585aed6d28b19e29dd36eec@group.calendar.google.com";

export const SERVICES: ServiceItem[] = [
  {
    name: "Corte",
    description: "",
    rules: [
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
    rules: [
      "⁠Todos os procedimentos incluem finalização. ",
      "⁠Para orçamento de finalização, pedimos uma foto do seu cabelo de costas solto e seco, ou para comparecer presencialmente.",
    ],
    timeToExecuteInMinutes: 90,
  },
  {
    name: "Coloração e mechas",
    description: "⁠",
    rules: [],
    timeToExecuteInMinutes: 180,
  },
  {
    name: "Penteados",
    description: "⁠",
    rules: [],
  },
  {
    name: "Maquiagens",
    description: "⁠",
    rules: [],
  },
  {
    name: "Tranças",
    description: "⁠",
    rules: [],
  },
];
