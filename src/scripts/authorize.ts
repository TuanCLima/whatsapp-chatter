import { authorize } from "../googleCalendar/googleAuth";
import { getGoogleCalendarEvents } from "../googleCalendar/googleCalendar";

authorize(async (auth) => {
  try {
    const events = await getGoogleCalendarEvents({
      calendarId: "primary",
      timeMin: "2025-01-12T12:14:00.324Z",
      timeMax: "2025-04-12T12:14:00.324Z",
      maxResults: 20,
      singleEvents: true,
      orderBy: "startTime",
      auth,
    });

    return;
  } catch (error) {
    console.error(error);
    return;
  }
});
