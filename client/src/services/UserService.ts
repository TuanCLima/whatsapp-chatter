// Service to handle user-related API operations
import { API_BASE_URL } from '@/config/api'

class UserService {
  private apiUrl: string

  constructor() {
    this.apiUrl = API_BASE_URL
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
