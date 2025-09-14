import cors from 'cors'
import express, { type Request, type Response } from 'express'
import { google } from 'googleapis'
import { authorize } from '../googleCalendar/googleAuth'
import {
  cancelCalendarEvent,
  createCalendarEvent,
  getGoogleCalendarEvents,
} from '../googleCalendar/googleCalendar'
import {
  getSaoPauloDate,
  type MCPFunctions,
  mcpFunctions,
} from '../mcp/mcpService'
import { GABE_CALENDAR_ID } from '../utils/contants'

const router = express.Router()

router.use(cors())
router.use(express.json())

router.get('/functions', (_, res) => {
  const functionsList = (
    Object.keys(mcpFunctions) as (keyof MCPFunctions)[]
  ).map((functionName) => ({
    name: functionName,
    description: mcpFunctions[functionName].description,
    parameters: mcpFunctions[functionName].parameters,
  }))

  res.json(functionsList)
})

router.get('/date', (_, res) => {
  const body = getSaoPauloDate()
  res.json(body)
})

router.post(
  '/execute',
  async (
    req: Request<{}, {}, { functionName: keyof MCPFunctions; parameters: any }>,
    res: Response,
  ) => {
    const body = req.body
    const { functionName, parameters } = body
    if (!functionName) {
      res.status(400).json({ error: 'Function name is required' })
      return
    }

    if (!mcpFunctions[functionName]) {
      res.status(404).json({ error: 'Function not found' })
      return
    }

    let result: any
    try {
      switch (functionName) {
        case 'getSaoPauloDate':
        // case 'getAllServicesTable':
        case 'getSalonInfo':
          // case 'getCalendarEventCancellationRules':
          // case 'getProfessionalLinkContactToAttachInAnswer':
          result = mcpFunctions[functionName].function()
          break
        // case 'fetchCalendarEvents':
        // case 'checkEventAvailability':
        // case 'checkEventCancellationEligibility':
        // case 'checkAndCancelEventIfEligible':
        // case 'createCalendarEvent':
        // case 'cancelCalendarEvent':
        // case 'suggestEventTimes':
        // case 'forwardContact':
        //   result = await mcpFunctions[functionName].function(parameters)
      }

      res.json(result)
      return
    } catch (error) {
      console.error('Error executing function:', error)
      res.status(500).json({ error: 'Internal server error' })
      return
    }
  },
)

router.post('/fetch-events', async (req, res) => {
  authorize(async (auth) => {
    const events = await getGoogleCalendarEvents({
      // calendarId: "primary",
      calendarId: GABE_CALENDAR_ID,
      timeMin: req.body.timeMin,
      timeMax: req.body.timeMax,
      maxResults: req.body.maxResults,
      singleEvents: true,
      orderBy: 'startTime',
      auth,
    })

    res.json(events)
  })
})

router.post('/create-event', async (req, res) => {
  authorize(async (auth) => {
    try {
      const event = req.body.event // Expect the event details in the request body
      if (!event) {
        res.status(400).send('Event details are required')
        return
      }

      const createdEvent = await createCalendarEvent({
        // calendarId: "primary",
        calendarId: GABE_CALENDAR_ID,
        event,
        auth,
      })

      const {
        kind,
        id,
        summary,
        description,
        organizer,
        start,
        end,
        sequence,
      } = createdEvent

      res.json({
        kind,
        id,
        summary,
        description,
        organizer,
        start,
        end,
        sequence,
      })
      return
    } catch (error) {
      console.error('Error creating event:', error)
      res.status(500).send('Error creating event')
      return
    }
  })
})

router.post('/create-calendar', async (req, res) => {
  authorize(async (auth) => {
    try {
      const calendarDetails = req.body.calendar
      if (!calendarDetails) {
        res.status(400).send('Calendar details are required')
        return
      }

      const calendar = google.calendar({ version: 'v3', auth })
      const createdCalendar = await calendar.calendars.insert({
        requestBody: calendarDetails,
      })

      const { kind, id, summary, description } = createdCalendar.data

      res.json({ kind, id, summary, description })
      return
    } catch (error) {
      console.error('Error creating calendar:', error)
      res.status(500).send('Error creating calendar')
      return
    }
  })
})

router.post('/cancel-event', async (req, res) => {
  console.log('"Cancel event route hit"); ')
  authorize(async (auth) => {
    try {
      const body = req.body
      if (!body) {
        res.status(400).send('Cancellation details are required')
        return
      }

      await cancelCalendarEvent({
        calendarId: GABE_CALENDAR_ID,
        eventId: body.eventId,
        auth,
      })

      res.json({ message: 'Event canceled successfully' })
      return
    } catch (error) {
      console.error('Error cancelling event:', error)
      res.status(500).send('Error creating calendar')
      return
    }
  })
})

export default router
