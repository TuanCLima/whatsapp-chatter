import express from 'express'
import { authenticateUser } from '../middleware/authenticateUser'
import { predefinedToolsService } from '../services/PredefinedToolsService'
import { getSaasGoogleCalendarService } from '../services/SaasGoogleCalendarService'

const router = express.Router()

/**
 * Get all predefined tools configuration for the authenticated user
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const tools =
      await predefinedToolsService.getUserPredefinedTools(saasUserId)
    res.json({ tools })
  } catch (error) {
    console.error('Error fetching predefined tools:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Get specific tool configuration
 */
router.get('/:toolType', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId
    const { toolType } = req.params

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const config = await predefinedToolsService.getToolConfig(
      saasUserId,
      toolType,
    )
    res.json({ config })
  } catch (error) {
    console.error('Error fetching tool config:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Update tool configuration
 */
router.put('/:toolType', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId
    const { toolType } = req.params
    const { enabled, configData } = req.body

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const config = await predefinedToolsService.updateToolConfig(
      saasUserId,
      toolType,
      enabled,
      configData,
    )

    res.json({ config })
  } catch (error) {
    console.error('Error updating tool config:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Get Google Calendar authorization URL
 */
router.get('/calendar/auth-url', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const authUrl = getSaasGoogleCalendarService().generateAuthUrl()
    res.json({ authUrl })
  } catch (error) {
    console.error('Error generating auth URL:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Handle Google Calendar OAuth callback
 */
router.post('/calendar/oauth-callback', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId
    const { code } = req.body

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    if (!code) {
      res.status(400).json({ error: 'Authorization code is required' })
      return
    }

    await getSaasGoogleCalendarService().exchangeCodeForTokens(code, saasUserId)
    res.json({
      success: true,
      message: 'Google Calendar authorized successfully',
    })
  } catch (error) {
    console.error('Error handling OAuth callback:', error)
    res.status(500).json({ error: 'Failed to authorize Google Calendar' })
  }
})

/**
 * Check calendar tool status
 */
router.get('/calendar/status', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const status = await predefinedToolsService.isCalendarToolReady(saasUserId)
    res.json(status)
  } catch (error) {
    console.error('Error checking calendar status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Revoke Google Calendar access
 */
router.delete('/calendar/access', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    await getSaasGoogleCalendarService().revokeAccess(saasUserId)
    res.json({
      success: true,
      message: 'Google Calendar access revoked successfully',
    })
  } catch (error) {
    console.error('Error revoking calendar access:', error)
    res.status(500).json({ error: 'Failed to revoke calendar access' })
  }
})

/**
 * List available calendars for the authenticated user
 */
router.get('/calendar/list', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const calendars =
      await getSaasGoogleCalendarService().listCalendars(saasUserId)
    res.json({ calendars })
  } catch (error) {
    console.error('Error listing calendars:', error)
    res.status(500).json({ error: 'Failed to fetch calendar list' })
  }
})

/**
 * Check referee contact tool status
 */
router.get('/referee/status', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const status =
      await predefinedToolsService.isRefereeContactToolReady(saasUserId)
    res.json(status)
  } catch (error) {
    console.error('Error checking referee contact status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Toggle referee contact tool and update configuration
 */
router.post('/referee/toggle', authenticateUser, async (req, res) => {
  try {
    const saasUserId = req.user?.userId
    const { enabled, refereePhoneNumber } = req.body

    if (!saasUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    if (enabled && !refereePhoneNumber) {
      res
        .status(400)
        .json({
          error: 'Referee phone number is required when enabling the tool',
        })
      return
    }

    await predefinedToolsService.updateToolConfig(
      saasUserId,
      'referee_contact',
      enabled,
      { refereePhoneNumber },
    )

    res.json({
      success: true,
      message: `Referee contact tool ${enabled ? 'enabled' : 'disabled'} successfully`,
    })
  } catch (error) {
    console.error('Error toggling referee contact tool:', error)
    res.status(500).json({ error: 'Failed to update referee contact tool' })
  }
})

export default router
