// Helpers shared by the API routes. Vercel does not deploy files starting with "_" as endpoints.
import { google } from 'googleapis';

const PRICES = {
  trial: { single: 0, pack: 0, duration: 20 },
  '20': { single: 26, pack: 250, duration: 20 },
  '30': { single: 39, pack: 370, duration: 30 },
  '45': { single: 57, pack: 540, duration: 45 },
  '60': { single: 74, pack: 700, duration: 60 },
};

export function getPricing(type) {
  return PRICES[type] || { single: 0, pack: 0, duration: 30 };
}

// Total charged for a booking. An explicit grandTotal (set on the booking form) wins.
export function getBookingTotal({ type, selectedPack, lessonAmount, grandTotal }) {
  if (type === 'trial') return 0;
  const explicit = Number(grandTotal);
  if (grandTotal !== undefined && grandTotal !== '' && Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  const lessons = Number(lessonAmount || 1);
  const pricing = getPricing(type);
  return selectedPack === 'pack' ? Math.round((pricing.pack / 10) * lessons) : pricing.single * lessons;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// "2026-11-09" or a Date -> "09/11/2026"
export function formatDateDMY(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export function getGoogleAuth(scopes) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }
  if (!process.env.GOOGLE_CALENDAR_ID) {
    throw new Error('GOOGLE_CALENDAR_ID environment variable is not set.');
  }
  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }
  return new google.auth.GoogleAuth({ credentials, scopes });
}

export function formatCalendarError(error) {
  const errors = Array.isArray(error?.errors)
    ? error.errors.map(({ domain, reason, message }) => ({ domain, reason, message }))
    : undefined;
  return {
    message: error?.message || 'Unknown Calendar API error',
    code: error?.code,
    status: error?.response?.status,
    reason: errors?.[0]?.reason,
    errors,
    responseData: error?.response?.data,
  };
}
