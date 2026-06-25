import { google } from 'googleapis';

function formatCalendarError(error) {
  const responseData = error?.response?.data;
  const errors = Array.isArray(error?.errors)
    ? error.errors.map((item) => ({
        domain: item.domain,
        reason: item.reason,
        message: item.message,
      }))
    : undefined;

  return {
    message: error?.message || 'Unknown Calendar API error',
    code: error?.code,
    status: error?.response?.status,
    reason: errors?.[0]?.reason,
    errors,
    responseData,
  };
}

function toPerthDateKey(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Perth',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getEventDateTime(event) {
  if (event?.start?.dateTime) {
    return new Date(event.start.dateTime);
  }

  if (event?.start?.date) {
    return new Date(`${event.start.date}T00:00:00`);
  }

  return null;
}

function parseLessonDuration(type) {
  if (type === 'trial') {
    return 20;
  }

  const duration = Number(type);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`type "${type}" must be a positive number of minutes or "trial"`);
  }

  return duration;
}

function getEventStartDateTime(event, defaultWorkingHours) {
  if (event?.start?.dateTime) {
    return new Date(event.start.dateTime);
  }

  if (event?.start?.date) {
    return new Date(`${event.start.date}T${defaultWorkingHours.start}:00`);
  }

  return null;
}

function getEventEndDateTime(event, defaultWorkingHours) {
  if (event?.end?.dateTime) {
    return new Date(event.end.dateTime);
  }

  if (event?.end?.date) {
    return new Date(`${event.end.date}T${defaultWorkingHours.end}:00`);
  }

  if (event?.start?.date) {
    return new Date(`${event.start.date}T${defaultWorkingHours.end}:00`);
  }

  return null;
}

// Returns available time strings for a single free event block, filtered against booked events
function getAvailableSlots(freeEvent, occupiedEventsForDate, timeSlotDuration, lessonDuration, cutoffTime, defaultWorkingHours) {
  const start = getEventStartDateTime(freeEvent, defaultWorkingHours);
  const end = getEventEndDateTime(freeEvent, defaultWorkingHours);

  if (!start || !end) {
    throw new Error('Free event is missing valid start/end data');
  }

  const slots = [];
  for (let time = new Date(start); time < end; time.setMinutes(time.getMinutes() + timeSlotDuration)) {
    if (time <= cutoffTime) continue;

    const slotEnd = new Date(time.getTime() + lessonDuration * 60 * 1000);
    const isAvailable = !occupiedEventsForDate.some(booked => {
      const bookedStart = getEventStartDateTime(booked, defaultWorkingHours);
      const bookedEnd = getEventEndDateTime(booked, defaultWorkingHours);
      if (!bookedStart || !bookedEnd) {
        return false;
      }

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

    const { type = '30', date } = req.query;
    const timeSlotDuration = 30;
    const defaultWorkingHours = { start: '09:00', end: '17:00' };

    // Different restrictions for trial vs actual lessons
    const isTrialLesson = type === 'trial';
    const advanceBookingHours = isTrialLesson ? 48 : 24; // Trial requires 48 hours, actual lessons need 24 hours
    const bookingWindowDays = isTrialLesson ? 9 : 60; // Trial is 9 days, actual lessons are 60 days

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'date must be in YYYY-MM-DD format.'
      });
    }

    let lessonDuration;
    try {
      lessonDuration = parseLessonDuration(type);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Invalid type',
        message: validationError.message,
      });
    }

    // Perth timezone offset (UTC+8)
    const perthOffset = 8 * 60 * 60 * 1000;
    const now = new Date();
    const nowPerth = new Date(now.getTime() + perthOffset);
    const bookingEndDate = new Date(nowPerth);
    bookingEndDate.setDate(nowPerth.getDate() + bookingWindowDays);

    console.log('Fetching availability from Google Calendar:', {
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: nowPerth.toISOString(),
      timeMax: bookingEndDate.toISOString(),
      type,
      date: date || null,
    });

    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: nowPerth.toISOString(),
      timeMax: bookingEndDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const items = response.data.items || [];
    const freeEvents = items.filter(e => e.summary === 'Free');
    const occupiedEvents = items.filter(e => e.summary && e.summary !== 'Free');

    const cutoffTime = new Date(nowPerth.getTime() + advanceBookingHours * 60 * 60 * 1000);

    if (date) {
      const filteredFreeEvents = freeEvents.filter(e => toPerthDateKey(getEventDateTime(e)) === date);
      const filteredOccupiedEvents = occupiedEvents.filter(e => toPerthDateKey(getEventDateTime(e)) === date);

      const allTimes = filteredFreeEvents.flatMap(e =>
        getAvailableSlots(e, filteredOccupiedEvents, timeSlotDuration, lessonDuration, cutoffTime, defaultWorkingHours)
      );

      const uniqueTimes = [...new Set(allTimes)].sort((a, b) =>
        new Date(`1970-01-01 ${a}`).getTime() - new Date(`1970-01-01 ${b}`).getTime()
      );

      return res.status(200).json({ availableTimes: uniqueTimes, success: true });
    }

    const availableDates = new Set();

    freeEvents.forEach(event => {
      const dateStr = toPerthDateKey(getEventDateTime(event));
      if (!dateStr) {
        return;
      }

      const bookedForDate = occupiedEvents.filter(e => toPerthDateKey(getEventDateTime(e)) === dateStr);
      const slots = getAvailableSlots(event, bookedForDate, timeSlotDuration, lessonDuration, cutoffTime, defaultWorkingHours);
      if (slots.length > 0) {
        availableDates.add(dateStr);
      }
    });

    const sortedDates = Array.from(availableDates).sort((a, b) => new Date(a) - new Date(b));

    return res.status(200).json({ availableDates: sortedDates, success: true });

  } catch (error) {
    const formattedCalendarError = formatCalendarError(error);
    console.error('Error fetching availability:', formattedCalendarError);
    return res.status(502).json({
      error: 'Failed to fetch availability',
      message: formattedCalendarError.message,
      details: formattedCalendarError,
    });
  }
}
