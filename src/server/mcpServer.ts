import express, { Request, Response } from "express";
import cors from "cors";
import { MCPFunctions, mcpFunctions } from "../mcp/mcpService";
import {
  createCalendarEvent,
  getGoogleCalendarEvents,
} from "../googleCalendar/googleCalendar";
import { authorize } from "../googleCalendar/googleAuth";
import path from "path";
import fs from "fs";
import { google } from "googleapis";
import { GABE_CALENDAR_ID } from "../utils/contants";

const router = express.Router();

router.use(cors());
router.use(express.json());

router.get("/functions", (_, res) => {
  const functionsList = (
    Object.keys(mcpFunctions) as (keyof MCPFunctions)[]
  ).map((functionName) => ({
    name: functionName,
    description: mcpFunctions[functionName].description,
    parameters: mcpFunctions[functionName].parameters,
  }));

  res.json(functionsList);
});

router.post(
  "/execute",
  async (
    req: Request<{}, {}, { functionName: keyof MCPFunctions; parameters: any }>,
    res: Response
  ) => {
    const body = req.body;
    const { functionName, parameters } = body;
    if (!functionName) {
      res.status(400).json({ error: "Function name is required" });
      return;
    }

    if (!mcpFunctions[functionName]) {
      res.status(404).json({ error: "Function not found" });
      return;
    }

    let result: any;
    try {
      switch (functionName) {
        case "getSaoPauloDate":
        case "getAllServicesTable":
        case "getSalonInfo":
        case "getCalendarEventCancellationRules":
        case "getProfessionalLinkContactToAttachInAnswer":
          result = mcpFunctions[functionName].function();
          break;
        case "fetchCalendarEvents":
        case "createCalendarEvent":
          result = await mcpFunctions[functionName].function(parameters);
      }

      res.json(result);
      return;
    } catch (error) {
      console.error("Error executing function:", error);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }
);

router.post("/fetch-events", async (req, res) => {
  authorize(async (auth) => {
    const events = await getGoogleCalendarEvents({
      // calendarId: "primary",
      calendarId: GABE_CALENDAR_ID,
      timeMin: req.body.timeMin,
      timeMax: req.body.timeMax,
      maxResults: req.body.maxResults,
      singleEvents: true,
      orderBy: "startTime",
      auth,
    });

    res.json(events);
  });
});

router.post("/create-event", async (req, res) => {
  authorize(async (auth) => {
    try {
      const event = req.body.event; // Expect the event details in the request body
      if (!event) {
        res.status(400).send("Event details are required");
        return;
      }

      const createdEvent = await createCalendarEvent({
        // calendarId: "primary",
        calendarId: GABE_CALENDAR_ID,
        event,
        auth,
      });

      const {
        kind,
        id,
        summary,
        description,
        organizer,
        start,
        end,
        sequence,
      } = createdEvent;

      res.json({
        kind,
        id,
        summary,
        description,
        organizer,
        start,
        end,
        sequence,
      });
      return;
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).send("Error creating event");
      return;
    }
  });
});

router.post("/create-calendar", async (req, res) => {
  authorize(async (auth) => {
    try {
      const calendarDetails = req.body.calendar;
      if (!calendarDetails) {
        res.status(400).send("Calendar details are required");
        return;
      }

      const calendar = google.calendar({ version: "v3", auth });
      const createdCalendar = await calendar.calendars.insert({
        requestBody: calendarDetails,
      });

      const { kind, id, summary, description } = createdCalendar.data;

      res.json({ kind, id, summary, description });
      return;
    } catch (error) {
      console.error("Error creating calendar:", error);
      res.status(500).send("Error creating calendar");
      return;
    }
  });
});

const TOKEN_PATH = path.join(__dirname, "..", "token.json");

// Callback route to handle the redirect from Google
router.get("/oauth2callback", async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).send("Authorization code not found");
    return;
  }

  try {
    // Load client secrets
    const credentials = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "credentials.json"), "utf-8")
    );
    const { client_id, client_secret, redirect_uris } = credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Exchange the authorization code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Save the token to a file for future use
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log("Token stored to", TOKEN_PATH);

    res.send("Authorization successful! You can close this page.");
  } catch (error) {
    console.error("Error handling OAuth callback:", error);
    res.status(500).send("An error occurred during the authorization process.");
  }
});

export default router;
