import { google } from 'googleapis';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Validate environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set. Please add your Google Service Account key JSON as a string.');
    }
    if (!process.env.GOOGLE_CALENDAR_ID) {
      throw new Error('GOOGLE_CALENDAR_ID environment variable is not set. Please add your Google Calendar ID.');
    }

    // Parse the service account key
    let serviceAccountKey;
    try {
      serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (parseError) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON. Please check your service account key.');
    }

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Configuration
    const advanceBookingHours = 48;
    const { type = '30' } = req.query;
    const timeSlotDuration = type === 'trial' ? 30 : parseInt(type);
    const defaultWorkingHours = { start: '09:00', end: '17:00' };

    // Perth timezone offset (UTC+8)
    const perthOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

    const now = new Date();
    // Convert current time to Perth time
    const nowPerth = new Date(now.getTime() + perthOffset);
    const nineDaysLater = new Date(nowPerth);
    nineDaysLater.setDate(nowPerth.getDate() + 9);

    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: nowPerth.toISOString(),
      timeMax: nineDaysLater.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const data = response.data;

    // Separate free events and booked events
    const freeEvents = data.items.filter(event => event.summary === 'Free');
    const bookedEvents = data.items.filter(event => event.summary && event.summary.startsWith('Drumadon'));

    const { date } = req.query;

    if (date) {
      // Return available times for specific date
      const availableTimes = [];
      const filteredFreeEvents = freeEvents.filter(event => {
        const eventDate = new Date(event.start.date || event.start.dateTime).toISOString().split('T')[0];
        return eventDate === date;
      });

      // Get booked events for this date
      const filteredBookedEvents = bookedEvents.filter(event => {
        const eventDate = new Date(event.start.dateTime).toISOString().split('T')[0];
        return eventDate === date;
      });

      filteredFreeEvents.forEach(event => {
        let start, end;
        if (event.start.dateTime) {
          start = new Date(event.start.dateTime);
          end = new Date(event.end.dateTime);
        } else {
          const dateStr = event.start.date;
          start = new Date(`${dateStr}T${defaultWorkingHours.start}:00`);
          end = new Date(`${dateStr}T${defaultWorkingHours.end}:00`);
        }

        const fortyEightHoursLater = new Date(nowPerth.getTime() + advanceBookingHours * 60 * 60 * 1000);

        for (let time = new Date(start); time < end; time.setMinutes(time.getMinutes() + timeSlotDuration)) {
          if (time > fortyEightHoursLater) {
            // Check if this time slot overlaps with any booked events
            const slotEnd = new Date(time.getTime() + timeSlotDuration * 60 * 1000);
            let isAvailable = true;

            for (const bookedEvent of filteredBookedEvents) {
              const bookedStart = new Date(bookedEvent.start.dateTime);
              const bookedEnd = new Date(bookedEvent.end.dateTime);

              // Check for overlap: slot overlaps with booking if slot starts before booking ends AND slot ends after booking starts
              if (time < bookedEnd && slotEnd > bookedStart) {
                isAvailable = false;
                break;
              }
            }

            if (isAvailable) {
              availableTimes.push(time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Perth' }));
            }
          }
        }
      });

      const uniqueTimes = [...new Set(availableTimes)].sort((a, b) => {
        const timeA = new Date(`1970-01-01 ${a}`).getTime();
        const timeB = new Date(`1970-01-01 ${b}`).getTime();
        return timeA - timeB;
      });

      return res.status(200).json({
        availableTimes: uniqueTimes,
        success: true
      });
    } else {
      // Return available dates
      const availableDates = new Set();
      const fortyEightHoursLater = new Date(nowPerth.getTime() + advanceBookingHours * 60 * 60 * 1000);

      freeEvents.forEach(event => {
        let hasAvailableTime = false;
        let start, end;
        if (event.start.dateTime) {
          start = new Date(event.start.dateTime);
          end = new Date(event.end.dateTime);
        } else {
          const dateStr = event.start.date;
          start = new Date(`${dateStr}T${defaultWorkingHours.start}:00`);
          end = new Date(`${dateStr}T${defaultWorkingHours.end}:00`);
        }

        // Get booked events for this date
        const eventDate = new Date(event.start.date || event.start.dateTime);
        const dateStr = eventDate.toISOString().split('T')[0];
        const filteredBookedEvents = bookedEvents.filter(event => {
          const bookedDate = new Date(event.start.dateTime).toISOString().split('T')[0];
          return bookedDate === dateStr;
        });

        for (let time = new Date(start); time < end; time.setMinutes(time.getMinutes() + timeSlotDuration)) {
          if (time > fortyEightHoursLater) {
            // Check if this time slot overlaps with any booked events
            const slotEnd = new Date(time.getTime() + timeSlotDuration * 60 * 1000);
            let isAvailable = true;

            for (const bookedEvent of filteredBookedEvents) {
              const bookedStart = new Date(bookedEvent.start.dateTime);
              const bookedEnd = new Date(bookedEvent.end.dateTime);

              // Check for overlap: slot overlaps with booking if slot starts before booking ends AND slot ends after booking starts
              if (time < bookedEnd && slotEnd > bookedStart) {
                isAvailable = false;
                break;
              }
            }

            if (isAvailable) {
              hasAvailableTime = true;
              break; // Found at least one available slot, no need to check more
            }
          }
        }

        if (hasAvailableTime) {
          const eventDate = new Date(event.start.date || event.start.dateTime);
          const dateStr = eventDate.toISOString().split('T')[0];
          availableDates.add(dateStr);
        }
      });

      const sortedDates = Array.from(availableDates).sort((a, b) => new Date(a) - new Date(b));

      return res.status(200).json({
        availableDates: sortedDates,
        success: true
      });
    }

  } catch (error) {
    console.error('Error fetching availability:', error);
    return res.status(500).json({
      error: 'Failed to fetch availability',
      message: 'Unable to load available dates at this time.'
    });
  }
}