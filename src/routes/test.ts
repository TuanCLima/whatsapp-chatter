import express from 'express'

const router = express.Router()

import { authenticateUser } from '../middleware/authenticateUser'
import { getSaasGoogleCalendarService } from '../services/SaasGoogleCalendarService'

// Development-only test route for suggestEventTimes
if (process.env.NODE_ENV !== 'production') {
  router.post('/suggest-event-times', authenticateUser, async (req, res) => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' })
        return
      }

      const { serviceDurationMinutes, startDate, endDate } = req.body

      if (!serviceDurationMinutes) {
        res.status(400).json({ error: 'serviceDurationMinutes is required' })
        return
      }

      const calendarService = getSaasGoogleCalendarService()

      const result = await calendarService.suggestEventTimes(
        userId,
        serviceDurationMinutes,
        startDate,
        endDate,
      )

      res.json(result)
    } catch (error) {
      console.error('Error suggesting event times:', error)
      res.status(500).json({
        error: 'Failed to suggest event times',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.post(
    '/check-event-availability',
    authenticateUser,
    async (req, res) => {
      try {
        const userId = req.user?.userId
        if (!userId) {
          res.status(401).json({ error: 'User not authenticated' })
          return
        }

        const { proposedStartTime, proposedEndTime, calendarId } = req.body

        if (!proposedStartTime || !proposedEndTime) {
          res.status(400).json({
            error: 'proposedStartTime and proposedEndTime are required',
          })
          return
        }

        const calendarService = getSaasGoogleCalendarService()

        const result = await calendarService.checkEventAvailability(
          userId,
          proposedStartTime,
          proposedEndTime,
          calendarId,
        )

        res.json(result)
      } catch (error) {
        console.error('Error checking event availability:', error)
        res.status(500).json({
          error: 'Failed to check event availability',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  )
}

export default router
