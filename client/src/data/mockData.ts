import { Contact, Conversation } from '@/types'

export const mockContacts: Contact[] = [
  {
    id: '1',
    name: 'Gabriela C Lima',
    avatar:
      'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastMessage: {
      text: 'eu só queria saber se era um plano possível ainda',
      timestamp: '19:59',
      status: 'read',
    },
    online: true,
  },
  {
    id: '2',
    name: '+5511981524850',
    avatar:
      'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastMessage: {
      text: 'Entra',
      timestamp: '19:38',
      status: 'delivered',
    },
  },
  {
    id: '3',
    name: 'Viviane Cristina Vieira Santos',
    avatar:
      'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastMessage: {
      text: 'Tá melhor de saúde?',
      timestamp: '18:52',
      status: 'read',
    },
    online: true,
  },
  {
    id: '4',
    name: 'Twilio Sandbox',
    avatar:
      'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastMessage: {
      text: 'Olá! Eu sou assistente virtual do Espaço Hermanas. Posso te ajudar?',
      timestamp: '16:03',
      status: 'read',
    },
  },
  {
    id: '5',
    name: 'Cândida-Limão',
    avatar:
      'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastMessage: {
      text: 'Herla: https://www.facebook.com/share/v/12K8NZ6GMnU/',
      timestamp: '15:25',
      status: 'read',
    },
  },
  {
    id: '6',
    name: 'Herla Claro',
    avatar:
      'https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastMessage: {
      text: 'vou não',
      timestamp: 'Ontem',
      status: 'read',
    },
  },
]

export const mockConversations: Conversation[] = [
  {
    id: '1',
    contactId: '1',
    messages: [
      {
        id: '101',
        text: 'Oi, tudo bem?',
        sender: '1',
        timestamp: '2023-03-01T14:05:00Z',
      },
      {
        id: '102',
        text: 'Tudo ótimo, e você?',
        sender: 'user',
        timestamp: '2023-03-01T14:07:00Z',
        status: 'read',
      },
      {
        id: '103',
        text: 'Bem também! Estava querendo saber sobre aquele plano que conversamos...',
        sender: '1',
        timestamp: '2023-03-01T14:10:00Z',
      },
      {
        id: '104',
        text: 'pra mim mandar pra ela tbm',
        sender: '1',
        timestamp: '2023-03-01T14:12:00Z',
      },
      {
        id: '105',
        text: 'eu só queria saber se era um plano possível ainda',
        sender: '1',
        timestamp: '2023-03-01T19:59:00Z',
      },
    ],
  },
  {
    id: '2',
    contactId: '4',
    messages: [
      {
        id: '201',
        text: 'Olá! Eu sou assistente virtual do Espaço Hermanas. Posso te ajudar?',
        sender: '4',
        timestamp: '2023-03-02T16:03:00Z',
      },
      {
        id: '202',
        text: 'Sim, gostaria de agendar um horário',
        sender: 'user',
        timestamp: '2023-03-02T16:05:00Z',
        status: 'read',
      },
      {
        id: '203',
        text: 'Perfeito! Para qual serviço você deseja agendar?',
        sender: '4',
        timestamp: '2023-03-02T16:06:00Z',
      },
      {
        id: '204',
        text: 'o print da planilha',
        sender: '4',
        timestamp: '2023-03-02T16:12:00Z',
      },
    ],
  },
]
