import { google } from 'googleapis';

// Returns available time strings for a single free event block, filtered against booked events
function getAvailableSlots(freeEvent, bookedEventsForDate, timeSlotDuration, cutoffTime, defaultWorkingHours) {
  let start, end;
  if (freeEvent.start.dateTime) {
    start = new Date(freeEvent.start.dateTime);
    end = new Date(freeEvent.end.dateTime);
  } else {
    const dateStr = freeEvent.start.date;
    start = new Date(`${dateStr}T${defaultWorkingHours.start}:00`);
    end = new Date(`${dateStr}T${defaultWorkingHours.end}:00`);
  }

  const slots = [];
  for (let time = new Date(start); time < end; time.setMinutes(time.getMinutes() + timeSlotDuration)) {
    if (time <= cutoffTime) continue;

    const slotEnd = new Date(time.getTime() + timeSlotDuration * 60 * 1000);
    const isAvailable = !bookedEventsForDate.some(booked => {
      const bookedStart = new Date(booked.start.dateTime);
      const bookedEnd = new Date(booked.end.dateTime);
      return time < bookedEnd && slotEnd > bookedStart;
    });

    if (isAvailable) {
      slots.push(time.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Perth'
      }));
    }
  }
  return slots;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set. Please add your Google Service Account key JSON as a string.');
    }
    if (!process.env.GOOGLE_CALENDAR_ID) {
      throw new Error('GOOGLE_CALENDAR_ID environment variable is not set. Please add your Google Calendar ID.');
    }

    let serviceAccountKey;
    try {
      serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (parseError) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON. Please check your service account key.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const advanceBookingHours = 48;
    const { type = '30' } = req.query;
    const timeSlotDuration = 30;
    const defaultWorkingHours = { start: '09:00', end: '17:00' };

    // Perth timezone offset (UTC+8)
    const perthOffset = 8 * 60 * 60 * 1000;
    const now = new Date();
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

    const items = response.data.items;
    const freeEvents = items.filter(e => e.summary === 'Free');
    const bookedEvents = items.filter(e => e.summary && e.summary.startsWith('Drumadon'));

    const cutoffTime = new Date(nowPerth.getTime() + advanceBookingHours * 60 * 60 * 1000);

    const { date } = req.query;

    if (date) {
      // Return available times for a specific date
      const filteredFreeEvents = freeEvents.filter(e => {
        return new Date(e.start.date || e.start.dateTime).toISOString().split('T')[0] === date;
      });
      const filteredBookedEvents = bookedEvents.filter(e => {
        return new Date(e.start.dateTime).toISOString().split('T')[0] === date;
      });

      const allTimes = filteredFreeEvents.flatMap(e =>
        getAvailableSlots(e, filteredBookedEvents, timeSlotDuration, cutoffTime, defaultWorkingHours)
      );

      const uniqueTimes = [...new Set(allTimes)].sort((a, b) =>
        new Date(`1970-01-01 ${a}`).getTime() - new Date(`1970-01-01 ${b}`).getTime()
      );

      return res.status(200).json({ availableTimes: uniqueTimes, success: true });

    } else {
      // Return available dates
      const availableDates = new Set();

      freeEvents.forEach(event => {
        const dateStr = new Date(event.start.date || event.start.dateTime).toISOString().split('T')[0];
        const bookedForDate = bookedEvents.filter(e =>
          new Date(e.start.dateTime).toISOString().split('T')[0] === dateStr
        );

        const slots = getAvailableSlots(event, bookedForDate, timeSlotDuration, cutoffTime, defaultWorkingHours);
        if (slots.length > 0) {
          availableDates.add(dateStr);
        }
      });

      const sortedDates = Array.from(availableDates).sort((a, b) => new Date(a) - new Date(b));

      return res.status(200).json({ availableDates: sortedDates, success: true });
    }

  } catch (error) {
    console.error('Error fetching availability:', error);
    return res.status(500).json({
      error: 'Failed to fetch availability',
      message: 'Unable to load available dates at this time.'
    });
  }
}
