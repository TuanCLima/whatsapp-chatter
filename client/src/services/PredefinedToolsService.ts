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
}

export const predefinedToolsService = new PredefinedToolsService()
