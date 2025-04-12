import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

/**
 * Parameters for fetching Google Calendar events.
 */
interface GetGoogleCalendarEventsParams {
  calendarId?: string;
  timeMin: string;
  timeMax: string;
  maxResults?: number;
  singleEvents?: boolean;
  orderBy?: "startTime" | "updated";
  auth: OAuth2Client | string; // string if using API key or service account client
}

async function getGoogleCalendarEvents({
  calendarId = "primary",
  timeMin,
  timeMax,
  maxResults = 10,
  singleEvents = true,
  orderBy = "startTime",
  auth,
}: GetGoogleCalendarEventsParams): Promise<calendar_v3.Schema$Event[]> {
  const calendar = google.calendar({ version: "v3", auth });

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents,
      orderBy,
    });

    return response.data.items || [];
  } catch (error) {
    console.error("Error fetching Google Calendar events:", error);
    throw error;
  }
}

async function createGoogleCalendarEvent({
  calendarId = "primary",
  event,
  auth,
}: {
  calendarId?: string;
  event: calendar_v3.Schema$Event;
  auth: OAuth2Client | string;
}): Promise<calendar_v3.Schema$Event> {
  const calendar = google.calendar({ version: "v3", auth });

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return response.data;
  } catch (error) {
    console.error("Error creating Google Calendar event:", error);
    throw error;
  }
}

export { getGoogleCalendarEvents, createGoogleCalendarEvent };
