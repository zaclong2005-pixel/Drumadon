import { google } from 'googleapis';
import {
  getPricing, getBookingTotal, escapeHtml, formatDateDMY, getGoogleAuth, formatCalendarError,
} from './_shared.js';

async function sendMailgunEmail(emailData) {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error('Email service not configured');
  }
  const response = await fetch(`https://api.eu.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(emailData),
  });
  if (!response.ok) throw new Error('Email service temporarily unavailable');
  return response.json();
}

function detailRow(label, value) {
  return `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;color:#0b0b12;vertical-align:top;">${label}</td><td style="padding:6px 0;color:#0b0b12;">${value}</td></tr>`;
}

// `b` holds booking fields that are already HTML-escaped.
function sendUserConfirmationEmail(b, rawEmail) {
  const isTrial = b.type === 'trial';
  const firstName = b.name.split(' ')[0] || b.name;
  const intro = b.bookingFor === 'child'
    ? `A ${isTrial ? 'free trial' : 'lesson'} has been booked for ${b.childName}!`
    : `Your ${isTrial ? 'free trial' : 'lesson'} has been booked!`;

  const rows = [
    b.bookingFor === 'child' ? detailRow('Student', b.childName) : '',
    detailRow('Date', b.formattedDate),
    detailRow('Time', `${b.selectedTime} (${b.duration} minutes)`),
    detailRow('Location', '5 Arthur Rd, Lesmurdie, WA'),
    isTrial ? '' : detailRow('Price', `$${b.total} (${b.lessonAmount} lesson${b.lessonAmount === 1 ? '' : 's'})`),
    b.message ? detailRow('Notes', b.message) : '',
    b.invoiceUrl ? detailRow('Invoice', `<a href="${b.invoiceUrl}" style="color:#1f8fff;font-weight:bold;">View invoice INV-${b.invoiceNum}</a>`) : '',
  ].join('');

  return sendMailgunEmail({
    from: `Drumadon <noreply@${process.env.MAILGUN_DOMAIN}>`,
    to: rawEmail,
    subject: isTrial ? 'Your Drumadon Trial Booking is Confirmed!' : 'Your Drumadon Lesson Booking is Confirmed!',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:24px 12px;background:#05080f;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-top:4px solid #1f8fff;">
    <div style="background:#05080f;padding:24px;text-align:center;">
      <img src="https://www.drumadon.com.au/logo_white.png" alt="Drumadon" style="max-width:160px;height:auto;">
    </div>
    <div style="padding:24px;">
      <p style="font-size:16px;color:#0b0b12;margin:0 0 12px;">Hi ${firstName},</p>
      <p style="font-size:14px;color:#0b0b12;margin:0 0 16px;">${intro} Here are the details:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;background:#eef4ff;border-left:3px solid #1f8fff;">${rows}</table>
      <p style="font-size:14px;color:#0b0b12;margin:20px 0 0;">Need changes? Email <strong>info@drumadon.com.au</strong> to reschedule.</p>
      <p style="font-size:13px;color:#666;margin:20px 0 0;text-align:center;">Looking forward to seeing you!</p>
    </div>
  </div>
</body></html>`,
  });
}

function sendAdminEmail(b) {
  const isTrial = b.type === 'trial';
  const title = isTrial ? 'New Trial Booking' : 'New Lesson Booking';
  const student = b.bookingFor === 'child'
    ? `<p><strong>Student:</strong> ${b.childName}${b.age ? ` (age ${b.age})` : ''}</p>`
    : (b.age ? `<p><strong>Age:</strong> ${b.age}</p>` : '');

  return sendMailgunEmail({
    from: `Drumadon Website <noreply@${process.env.MAILGUN_DOMAIN}>`,
    to: 'info@drumadon.com.au',
    subject: title,
    html: `<html><body>
      <h2>${title}</h2>
      <h3>Contact Details</h3>
      <p><strong>Name:</strong> ${b.name}</p>
      <p><strong>Email:</strong> ${b.email}</p>
      <p><strong>Phone:</strong> ${b.phone}</p>
      ${student}
      <h3>Booking Details</h3>
      <p><strong>Type:</strong> ${isTrial ? 'Free Trial' : `${b.type}-Minute Lesson`}</p>
      <p><strong>Date:</strong> ${b.formattedDate}</p>
      <p><strong>Time:</strong> ${b.selectedTime} (${b.duration} minutes)</p>
      ${isTrial ? '' : `<p><strong>Pricing:</strong> $${b.total} (${b.lessonAmount}× lessons, ${b.selectedPack === 'pack' ? 'bulk rate' : 'single rate'})</p>`}
      ${b.invoiceUrl ? `<p><strong>Invoice:</strong> <a href="${b.invoiceUrl}">INV-${b.invoiceNum}</a></p>` : ''}
      <p><strong>Message:</strong> ${b.message || 'No additional information'}</p>
    </body></html>`,
  });
}

function parseSelectedTime(selectedTime) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(selectedTime || '').trim());
  if (!match) throw new Error(`selectedTime "${selectedTime}" is not a valid 12-hour time`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 1 || hours > 12 || minutes > 59) throw new Error(`selectedTime "${selectedTime}" is out of range`);
  return { hours: (hours % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0), minutes };
}

function validatePreferredDay(preferredDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(preferredDay || ''))
    || Number.isNaN(new Date(`${preferredDay}T00:00:00`).getTime())) {
    throw new Error(`preferredDay "${preferredDay}" must be a valid YYYY-MM-DD date`);
  }
  return preferredDay;
}

// Local Perth wall-clock time as "YYYY-MM-DDTHH:MM:00" (timezone is sent separately to Calendar).
function buildPerthLocalIso(day, hours, minutes, addMinutes = 0) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, hours, minutes + addMinutes));
  return date.toISOString().slice(0, 19);
}

// Invoice number = the sheet row it is written to (row 46 -> INV-0046). Fills gaps in the invoice block.
async function recordInvoiceRow(auth, rowValues) {
  if (!process.env.GOOGLE_SHEET_ID) throw new Error('GOOGLE_SHEET_ID not configured');
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sheet1!A:A' });
  const values = data.values || [];
  const cell = (i) => String(values[i]?.[0] ?? '').trim();
  const isInvoice = (v) => /^INV-\d+$/i.test(v);

  const firstInvoiceIndex = values.findIndex((_, i) => isInvoice(cell(i)));
  let targetRow;
  if (firstInvoiceIndex === -1) {
    let lastFilled = 0;
    values.forEach((_, i) => { if (cell(i)) lastFilled = i + 1; });
    targetRow = lastFilled + 1;
  } else {
    let gap = -1;
    for (let i = firstInvoiceIndex; i < values.length; i++) {
      if (!cell(i)) { gap = i; break; }
    }
    targetRow = gap === -1 ? values.length + 1 : gap + 1;
  }

  const existing = new Set(values.map((_, i) => cell(i)).filter(isInvoice).map((v) => v.replace(/^INV-/i, '')));
  const pad = (n) => String(n).padStart(4, '0');
  let invoiceNum = pad(targetRow);
  if (existing.has(invoiceNum)) {
    if (!existing.has(pad(targetRow + 1))) {
      targetRow += 1;
      invoiceNum = pad(targetRow);
    } else {
      invoiceNum = String(Math.floor(1000 + Math.random() * 9000));
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Sheet1!A${targetRow}:H${targetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[`INV-${invoiceNum}`, ...rowValues]] },
  });

  // Cosmetic formatting only; failure must not affect the invoice number.
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 7, endColumnIndex: 8 },
              cell: { userEnteredFormat: { verticalAlignment: 'MIDDLE' } },
              fields: 'userEnteredFormat(verticalAlignment)',
            },
          },
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: targetRow - 1, endRowIndex: targetRow, startColumnIndex: 0, endColumnIndex: 8 },
              cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 }, horizontalAlignment: 'LEFT' } },
              fields: 'userEnteredFormat(backgroundColor,horizontalAlignment)',
            },
          },
        ],
      },
    });
  } catch (formatErr) {
    console.error('Row formatting failed (non-fatal):', formatErr.message);
  }

  return invoiceNum;
}

function parseBody(body) {
  if (typeof body === 'string' || body instanceof URLSearchParams) return Object.fromEntries(new URLSearchParams(body));
  return body && typeof body === 'object' ? { ...body } : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = parseBody(req.body);
    const { name, email, phone, age, message, selectedTime, preferredDay, selectedPack, bookingFor, childName } = data;
    const type = data.type || 'trial';

    if (!name || !email || !phone || !selectedTime || !preferredDay) {
      return res.status(400).json({ error: 'Missing information', message: 'Please fill in all required fields and try again.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email', message: 'Please enter a valid email address.' });
    }

    let time;
    let bookingDate;
    try {
      time = parseSelectedTime(selectedTime);
      bookingDate = validatePreferredDay(preferredDay);
    } catch (validationError) {
      return res.status(400).json({ error: 'Invalid booking data', message: validationError.message });
    }

    const auth = getGoogleAuth([
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/spreadsheets',
    ]);
    const calendar = google.calendar({ version: 'v3', auth });

    const duration = getPricing(type).duration;
    const lessonAmount = Number(data.lessonAmount) || 1;
    const total = getBookingTotal({ type, selectedPack, lessonAmount, grandTotal: data.grandTotal });

    // Paid lessons get an invoice (trials don't).
    let invoiceNum;
    let invoiceUrl;
    if (type !== 'trial') {
      try {
        invoiceNum = await recordInvoiceRow(auth, [
          name, email, phone,
          `${lessonAmount}x ${type} min lesson${selectedPack === 'pack' ? ' - Bulk Rate' : ''}`,
          total === 0 ? 'Free' : `$${total}`,
          new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' }),
          'Unpaid',
        ]);
      } catch (sheetErr) {
        console.error('Sheet invoice numbering unavailable, using random fallback:', sheetErr.message);
        invoiceNum = String(Math.floor(1000 + Math.random() * 9000));
      }
      const token = Buffer.from(JSON.stringify({
        inv: invoiceNum, name, email, phone, type, preferredDay, selectedPack,
        lessonAmount, grandTotal: total, bookingFor, childName,
      })).toString('base64url');
      invoiceUrl = `https://www.drumadon.com.au/api/invoice?d=${token}`;
    }

    // Escaped copy for anything rendered into email HTML.
    const safe = {
      name: escapeHtml(name), email: escapeHtml(email), phone: escapeHtml(phone),
      age: escapeHtml(age), message: escapeHtml(message), childName: escapeHtml(childName),
      selectedTime: escapeHtml(selectedTime), type: escapeHtml(type), selectedPack, bookingFor,
      formattedDate: formatDateDMY(bookingDate), duration, total, lessonAmount, invoiceUrl, invoiceNum,
    };

    // Step 1: user confirmation email must succeed before the booking is saved.
    try {
      await sendUserConfirmationEmail(safe, email);
    } catch (emailError) {
      console.error('User confirmation email failed:', emailError);
      return res.status(500).json({
        error: 'Email service unavailable',
        message: 'We cannot confirm your booking at this time. Please try again later or contact us directly.',
      });
    }

    // Step 2: calendar event (weekly recurring when more than one lesson).
    const start = buildPerthLocalIso(bookingDate, time.hours, time.minutes);
    const end = buildPerthLocalIso(bookingDate, time.hours, time.minutes, duration);
    const recurring = lessonAmount > 1;
    const who = bookingFor === 'child'
      ? `Student: ${childName}${age ? ` (age ${age})` : ''}\nParent/Guardian: ${name}`
      : `Name: ${name}`;
    const heading = recurring
      ? `${type}-Minute Lesson - ${selectedPack === 'pack' ? `${lessonAmount}-Pack` : `${lessonAmount} Sessions`} (Weekly recurring)`
      : `${type === 'trial' ? 'Trial Lesson' : `${type}-Minute Lesson`} Booking Details:`;

    const event = {
      summary: `${name} (${type === 'trial' ? 'Drumadon Trial' : 'Drumadon Lesson'})`,
      description: [
        heading, who, `Email: ${email}`, `Phone: ${phone}`,
        `Message: ${message || 'No additional information'}`,
        recurring ? `Total Cost: $${total}` : '',
      ].filter(Boolean).join('\n'),
      start: { dateTime: start, timeZone: 'Australia/Perth' },
      end: { dateTime: end, timeZone: 'Australia/Perth' },
      colorId: type === 'trial' ? '6' : '7',
      ...(recurring && { recurrence: [`RRULE:FREQ=WEEKLY;COUNT=${lessonAmount}`] }),
    };

    let calendarResponse;
    try {
      calendarResponse = await calendar.events.insert({ calendarId: process.env.GOOGLE_CALENDAR_ID, resource: event });
    } catch (calendarError) {
      const formatted = formatCalendarError(calendarError);
      console.error('Google Calendar insert failed:', formatted);
      return res.status(502).json({
        error: 'Calendar service unavailable',
        message: 'We could not save your booking to Google Calendar. Please try again later.',
      });
    }
    if (!calendarResponse?.data?.id) {
      throw new Error('Calendar API returned no event ID after insert');
    }

    // Step 3: admin notification (non-fatal).
    try {
      await sendAdminEmail(safe);
    } catch (adminEmailError) {
      console.error('Admin email failed, but booking is confirmed:', adminEmailError);
    }

    return res.status(200).json({ message: 'Booking confirmed', eventId: calendarResponse.data.id });
  } catch (error) {
    console.error('Booking failed:', error);
    return res.status(500).json({
      error: 'Booking failed',
      message: 'We encountered an issue processing your booking. Please try again or contact us directly.',
    });
  }
}
