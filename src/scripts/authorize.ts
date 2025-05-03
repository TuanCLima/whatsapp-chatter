import { gaxios } from "google-auth-library";
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
    if (error instanceof gaxios.GaxiosError) {
      const { code, config, message, name, status } = error;
      console.log("GaxiosError: ", { code, config, message, name, status });
      return;
    }

    const err = error as Error;

    console.log("Auth Error: ", {
      name: err.name,
      message: err.message,
    });

    return;
  }
});
