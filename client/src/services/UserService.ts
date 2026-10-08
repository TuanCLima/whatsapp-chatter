// Service to handle user-related API operations
import { API_BASE_URL } from '@/config/api'

class UserService {
  private apiUrl: string

  constructor() {
    this.apiUrl = API_BASE_URL
  }

  async markConversationViewed(
    phoneNumber: string,
  ): Promise<{
    success: boolean
    phoneNumber: string
    lastViewedAt: string
  }> {
    try {
      const response = await fetch(
        `${this.apiUrl}/users/${encodeURIComponent(phoneNumber)}/mark-viewed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.ok) {
        console.error('Mark viewed failed with status:', response.status)
        throw new Error('Failed to mark conversation as viewed')
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error marking conversation as viewed:', error)
      throw error
    }
  }

  async toggleConversation(
    phoneNumber: string,
    disabled: boolean,
  ): Promise<{
    success: boolean
    phoneNumber: string
    conversationDisabled: boolean
  }> {
    try {
      console.log(
        'Toggling conversation for:',
        phoneNumber,
        'disabled:',
        disabled,
        `${this.apiUrl}/users/${encodeURIComponent(phoneNumber)}/conversation`,
      )
      const response = await fetch(
        `${this.apiUrl}/users/${encodeURIComponent(phoneNumber)}/conversation`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ disabled }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to toggle conversation status')
      }

      return await response.json()
    } catch (error) {
      console.error('Error toggling conversation status:', error)
      throw error
    }
  }
}

export const userService = new UserService()
export default UserService
