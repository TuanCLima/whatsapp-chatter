import { API_BASE_URL } from '@/config/api'

export interface PredefinedToolConfig {
  id?: number
  toolType: string
  enabled: boolean
  configData?: Record<string, unknown>
}

export interface CalendarToolConfig {
  defaultCalendarId?: string
  workingHours?: {
    start: string
    end: string
  }
  lunchTime?: {
    start: string
    end: string
  }
  allowedWeekDays?: {
    monday: boolean
    tuesday: boolean
    wednesday: boolean
    thursday: boolean
    friday: boolean
    saturday: boolean
    sunday: boolean
  }
  bufferTimeBetweenEvents?: number // in minutes
  timeZone?: string
}

export interface CalendarToolStatus {
  ready: boolean
  hasAuth: boolean
  enabled: boolean
}

export interface Contact {
  id: number
  saasUserId: string
  name: string
  phoneNumber: string
  email?: string | null
  company?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ContactsToolConfig {
  contacts?: Contact[]
}

export interface ContactsToolStatus {
  enabled: boolean
  contactCount: number
}

export class PredefinedToolsService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    return {
      'Content-Type': 'application/json',
    }
  }

  /**
   * Get all predefined tools configuration for the user
   */
  async getPredefinedTools(): Promise<{ tools: PredefinedToolConfig[] }> {
    const response = await fetch(`${API_BASE_URL}/api/predefined-tools`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch predefined tools')
    }

    return response.json()
  }

  /**
   * Get specific tool configuration
   */
  async getToolConfig(
    toolType: string,
  ): Promise<{ config: PredefinedToolConfig | null }> {
    const response = await fetch(
      `${API_BASE_URL}/api/predefined-tools/${toolType}`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    if (!response.ok) {
      throw new Error('Failed to fetch tool config')
    }

    return response.json()
  }

  /**
   * Update tool configuration
   */
  async updateToolConfig(
    toolType: string,
    enabled: boolean,
    configData?: Record<string, unknown>,
  ): Promise<{ config: PredefinedToolConfig }> {
    const response = await fetch(
      `${API_BASE_URL}/api/predefined-tools/${toolType}`,
      {
        method: 'PUT',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          enabled,
          configData,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to update tool config')
    }

    return response.json()
  }

  /**
   * Get Google Calendar authorization URL
   */
  async getCalendarAuthUrl(): Promise<{ authUrl: string }> {
    const response = await fetch(
      `${API_BASE_URL}/api/predefined-tools/calendar/auth-url`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    if (!response.ok) {
      throw new Error('Failed to get calendar auth URL')
    }

    return response.json()
  }

  /**
   * Complete Google Calendar OAuth flow
   */
  async completeCalendarAuth(
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${API_BASE_URL}/api/predefined-tools/calendar/oauth-callback`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ code }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to complete calendar auth')
    }

    return response.json()
  }

  /**
   * Get calendar tool status
   */
  async getCalendarStatus(): Promise<CalendarToolStatus> {
    const response = await fetch(
      `${API_BASE_URL}/api/predefined-tools/calendar/status`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    if (!response.ok) {
      throw new Error('Failed to get calendar status')
    }

    return response.json()
  }

  /**
   * Revoke Google Calendar access
   */
  async revokeCalendarAccess(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${API_BASE_URL}/api/predefined-tools/calendar/access`,
      {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    if (!response.ok) {
      throw new Error('Failed to revoke calendar access')
    }

    return response.json()
  }

  /**
   * List available Google Calendars
   */
  async listCalendars(): Promise<{
    calendars: Array<{
      id: string
      summary: string
      description?: string
      primary?: boolean
      accessRole?: string
      backgroundColor?: string
    }>
  }> {
    const response = await fetch(
      `${API_BASE_URL}/api/predefined-tools/calendar/list`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
      },
    )

    if (!response.ok) {
      throw new Error('Failed to fetch calendar list')
    }

    return response.json()
  }

  /**
   * Enable/disable calendar management tool
   */
  async toggleCalendarTool(
    enabled: boolean,
    config?: CalendarToolConfig,
  ): Promise<{ config: PredefinedToolConfig }> {
    return this.updateToolConfig(
      'calendar_management',
      enabled,
      config as Record<string, unknown>,
    )
  }

  // ===== CONTACTS MANAGEMENT =====

  /**
   * Get all contacts for the authenticated user
   */
  async getContacts(): Promise<{ contacts: Contact[] }> {
    const response = await fetch(`${API_BASE_URL}/api/contacts`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch contacts')
    }

    return response.json()
  }

  /**
   * Create a new contact
   */
  async createContact(contact: {
    name: string
    phoneNumber: string
    email?: string
    company?: string
  }): Promise<{ contact: Contact }> {
    const response = await fetch(`${API_BASE_URL}/api/contacts`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(contact),
    })

    if (!response.ok) {
      throw new Error('Failed to create contact')
    }

    return response.json()
  }

  /**
   * Update an existing contact
   */
  async updateContact(
    contactId: number,
    updates: {
      name?: string
      phoneNumber?: string
      email?: string
      company?: string
    },
  ): Promise<{ contact: Contact }> {
    const response = await fetch(`${API_BASE_URL}/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error('Failed to update contact')
    }

    return response.json()
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: number): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/contacts/${contactId}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete contact')
    }

    return response.json()
  }

  /**
   * Get contacts tool status
   */
  async getContactsStatus(): Promise<ContactsToolStatus> {
    try {
      const contactsResponse = await this.getContacts()
      const toolConfig = await this.getToolConfig('contact_management')

      return {
        enabled: toolConfig.config?.enabled || false,
        contactCount: contactsResponse.contacts.length,
      }
    } catch {
      return {
        enabled: false,
        contactCount: 0,
      }
    }
  }

  /**
   * Enable/disable contacts management tool
   */
  async toggleContactsTool(
    enabled: boolean,
    config?: ContactsToolConfig,
  ): Promise<{ config: PredefinedToolConfig }> {
    return this.updateToolConfig(
      'contact_management',
      enabled,
      config as Record<string, unknown>,
    )
  }
}

export const predefinedToolsService = new PredefinedToolsService()
