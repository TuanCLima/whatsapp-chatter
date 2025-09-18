import { Router } from 'express'
import { sseService } from '../services/SSEService'

const sseRouter = Router()

// SSE endpoint for real-time notifications
sseRouter.get('/events', (req, res) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const userId = req.query.userId as string | undefined

  sseService.addClient(clientId, res, userId)
})

// Add SSE subscription endpoints (working around TypeScript issues)
sseRouter.post('/subscribe', (req, res) => {
  const { clientId, phoneNumber } = req.body

  if (!clientId || !phoneNumber) {
    res.status(400).json({ error: 'Client ID and phone number required' })
    return
  }

  const sseService = require('../services/SSEService').sseService
  sseService.subscribeToPhoneNumber(clientId, phoneNumber)
  res.json({ status: 'subscribed', phoneNumber, clientId })
})

sseRouter.post('/unsubscribe', (req, res) => {
  const { clientId, phoneNumber } = req.body

  if (!clientId || !phoneNumber) {
    res.status(400).json({ error: 'Client ID and phone number required' })
    return
  }

  const sseService = require('../services/SSEService').sseService
  sseService.unsubscribeFromPhoneNumber(clientId, phoneNumber)
  res.json({ status: 'unsubscribed', phoneNumber, clientId })
})

export default sseRouter
