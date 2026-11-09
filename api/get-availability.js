import { google } from 'googleapis';
import { getPricing, getGoogleAuth, formatCalendarError } from './_shared.js';

const SLOT_STEP_MINUTES = 30;
const WORKING_HOURS = { start: '09:00', end: '17:00' };

function toPerthDateKey(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Perth', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function eventStart(event) {
  if (event?.start?.dateTime) return new Date(event.start.dateTime);
  if (event?.start?.date) return new Date(`${event.start.date}T${WORKING_HOURS.start}:00`);
  return null;
}

function eventEnd(event) {
  if (event?.end?.dateTime) return new Date(event.end.dateTime);
  const date = event?.end?.date || event?.start?.date;
  return date ? new Date(`${date}T${WORKING_HOURS.end}:00`) : null;
}

// Available start times inside one "Free" block that don't overlap a booked event.
function getAvailableSlots(freeEvent, bookedEvents, lessonDuration, cutoffTime) {
  const start = eventStart(freeEvent);
  const end = eventEnd(freeEvent);
  if (!start || !end) throw new Error('Free event is missing valid start/end data');

  const slots = [];
  for (let time = new Date(start); time < end; time.setMinutes(time.getMinutes() + SLOT_STEP_MINUTES)) {
    if (time <= cutoffTime) continue;
    const slotEnd = new Date(time.getTime() + lessonDuration * 60 * 1000);
    const clashes = bookedEvents.some((booked) => {
      const bookedStart = eventStart(booked);
      const bookedEnd = eventEnd(booked);
      return bookedStart && bookedEnd && time < bookedEnd && slotEnd > bookedStart;
    });
    if (!clashes) {
      slots.push(time.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Perth',
      }));
    }
  }
  return slots;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type = '30', date } = req.query;

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).json({ error: 'Invalid date', message: 'date must be in YYYY-MM-DD format.' });
  }
  if (type !== 'trial' && !(Number(type) > 0)) {
    return res.status(400).json({ error: 'Invalid type', message: `type "${type}" must be a positive number of minutes or "trial"` });
  }
  const lessonDuration = type === 'trial' ? getPricing('trial').duration : Number(type);

  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/calendar.readonly']);
    const calendar = google.calendar({ version: 'v3', auth });

    // Trials need 48h notice within a 9-day window; paid lessons 24h within 60 days.
    const isTrial = type === 'trial';
    const advanceBookingHours = isTrial ? 48 : 24;
    const bookingWindowDays = isTrial ? 9 : 60;

    // Perth timezone offset (UTC+8)
    const nowPerth = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const bookingEndDate = new Date(nowPerth);
    bookingEndDate.setDate(nowPerth.getDate() + bookingWindowDays);
    const cutoffTime = new Date(nowPerth.getTime() + advanceBookingHours * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: nowPerth.toISOString(),
      timeMax: bookingEndDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const items = response.data.items || [];
    const freeEvents = items.filter((e) => e.summary === 'Free');
    const bookedEvents = items.filter((e) => e.summary && e.summary !== 'Free');
    const bookedOn = (dateKey) => bookedEvents.filter((e) => toPerthDateKey(eventStart(e)) === dateKey);

    if (date) {
      const booked = bookedOn(date);
      const times = freeEvents
        .filter((e) => toPerthDateKey(eventStart(e)) === date)
        .flatMap((e) => getAvailableSlots(e, booked, lessonDuration, cutoffTime));
      const availableTimes = [...new Set(times)].sort(
        (a, b) => new Date(`1970-01-01 ${a}`) - new Date(`1970-01-01 ${b}`)
      );
      return res.status(200).json({ availableTimes, success: true });
    }

    const availableDates = new Set();
    for (const event of freeEvents) {
      const dateKey = toPerthDateKey(eventStart(event));
      if (dateKey && getAvailableSlots(event, bookedOn(dateKey), lessonDuration, cutoffTime).length > 0) {
        availableDates.add(dateKey);
      }
    }

    return res.status(200).json({ availableDates: [...availableDates].sort(), success: true });
  } catch (error) {
    const formatted = formatCalendarError(error);
    console.error('Error fetching availability:', formatted);
    return res.status(502).json({ error: 'Failed to fetch availability', message: formatted.message });
  }
}
