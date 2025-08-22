import { API_BASE_URL } from '../config/api'

export interface Tool {
  id: string
  name: string
  description: string
  parameters: ToolParameter[]
  implementation: string
}

export interface ToolParameter {
  name: string
  type: string
  description: string
  required: boolean
}

export interface PromptResponse {
  prompt: string
  id?: number
}

export interface ToolsResponse {
  tools: Tool[]
}

export interface ApiResponse<T> {
  data?: T
  message?: string
  error?: string
}

class AssistantConfigService {
  private async getAuthHeaders() {
    const token = localStorage.getItem('token')
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  async getPrompt(): Promise<PromptResponse> {
    const response = await fetch(`${API_BASE_URL}/api/assistant/prompt`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch prompt')
    }

    return response.json()
  }

  async savePrompt(prompt: string): Promise<ApiResponse<PromptResponse>> {
    const response = await fetch(`${API_BASE_URL}/api/assistant/prompt`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      throw new Error('Failed to save prompt')
    }

    return response.json()
  }

  async getTools(): Promise<ToolsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/assistant/tools`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch tools')
    }

    return response.json()
  }

  async getTool(id: string): Promise<{ tool: Tool }> {
    const response = await fetch(`${API_BASE_URL}/api/assistant/tools/${id}`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch tool')
    }

    return response.json()
  }

  async createTool(tool: Omit<Tool, 'id'>): Promise<{ tool: Tool; message?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/assistant/tools`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(tool),
    })

    if (!response.ok) {
      throw new Error('Failed to create tool')
    }

    return response.json()
  }

  async updateTool(id: string, tool: Omit<Tool, 'id'>): Promise<{ tool: Tool; message?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/assistant/tools/${id}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(tool),
    })

    if (!response.ok) {
      throw new Error('Failed to update tool')
    }

    return response.json()
  }

  async deleteTool(id: string): Promise<ApiResponse<null>> {
    const response = await fetch(`${API_BASE_URL}/api/assistant/tools/${id}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete tool')
    }

    return response.json()
  }
}

export const assistantConfigService = new AssistantConfigService()
