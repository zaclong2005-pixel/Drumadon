import { google } from 'googleapis';

// Shared pricing lookup
function getPricing(lessonType) {
  const prices = {
    'trial': { single: 0, pack: 0, duration: 20 },
    '20': { single: 26, pack: 250, duration: 20 },
    '30': { single: 39, pack: 370, duration: 30 },
    '45': { single: 57, pack: 540, duration: 45 },
    '60': { single: 74, pack: 700, duration: 60 }
  };
  return prices[lessonType] || { single: 0, pack: 0, duration: 30 };
}

// Shared Mailgun sender
async function sendMailgunEmail(emailData) {
  const apiUrl = `https://api.eu.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(emailData),
  });

  if (!response.ok) {
    throw new Error('Email service temporarily unavailable');
  }

  return response.json();
}

// Email sending function for user confirmation
async function sendUserConfirmationEmail({ name, email, phone, age, message, selectedTime, preferredDay, eventId, type, selectedPack, invoiceUrl, invoiceNum, bookingFor, childName, grandTotal, lessonAmount }) {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error('Email service not configured');
  }

  const date = new Date(preferredDay);
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  const firstName = name.split(' ')[0] || name;
  const pricing = getPricing(type);
  const amountToShow = type === 'trial'
    ? 0
    : (!isNaN(Number(grandTotal)) && Number(grandTotal) >= 0
      ? Number(grandTotal)
      : (selectedPack === 'pack' ? Math.round(pricing.pack / 10 * Number(lessonAmount || 1)) : pricing.single * Number(lessonAmount || 1)));

  const userEmailData = {
    from: `Drumadon <noreply@${process.env.MAILGUN_DOMAIN}>`,
    to: email,
    subject: type === 'trial' ? 'Your Drumadon Trial Booking is Confirmed!' : 'Your Drumadon Lesson Booking is Confirmed!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Trial Booking Confirmation</title>
        <style>
          body { margin: 0; padding: 0; background: linear-gradient(135deg, #7b97ac 0%, #8fc4da 100%); font-family: Arial, sans-serif; page-break-inside: avoid; }
          .email-container { max-width: 500px; margin: 0 auto; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 15px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1); page-break-inside: avoid; page-break-before: avoid; page-break-after: avoid; }
          .header { background: rgba(173, 216, 230, 1.0); padding: 20px 15px; text-align: center; page-break-inside: avoid; page-break-before: avoid; page-break-after: avoid; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
          .header p { color: #ffffff; margin: 8px 0 0 0; opacity: 0.9; }
          .content { padding: 20px 15px; position: relative; page-break-inside: avoid; page-break-before: avoid; page-break-after: avoid; }
          .welcome-text { font-size: 16px; color: #111111; margin-bottom: 15px; page-break-inside: avoid; }
          .booking-card { background: rgba(123, 151, 172, 0.5); border: 1px solid rgba(123, 151, 172, 0.2); border-radius: 12px; padding: 20px; margin: 15px 0; backdrop-filter: blur(5px); page-break-inside: avoid; page-break-before: avoid; page-break-after: avoid; }
          .booking-card h2 { margin: 0 0 15px 0; font-size: 20px; color: #000000; text-shadow: 1px 1px 2px rgba(0,0,0,0.1); page-break-inside: avoid; }
          .details-table { width: 100%; border-collapse: separate; border-spacing: 0 6px; page-break-inside: avoid; }
          .details-row { display: table-row; page-break-inside: avoid; }
          .details-cell { display: table-cell; padding: 6px 0; vertical-align: top; page-break-inside: avoid; }
          .details-label { font-weight: bold; color: #000000; min-width: 100px; font-size: 14px; page-break-inside: avoid; }
          .details-value { color: #000000; font-size: 14px; page-break-inside: avoid; }
          .contact-section { background: rgba(123, 151, 172, 0.5); border: 1px solid rgba(123, 151, 172, 0.2); border-radius: 8px; padding: 15px; margin: 15px 0; backdrop-filter: blur(3px); page-break-inside: avoid; page-break-before: avoid; page-break-after: avoid; }
          .contact-section h3 { margin: 0 0 10px 0; color: #000000; font-size: 16px; page-break-inside: avoid; }
          .contact-section p { margin: 0; color: #111111; font-size: 14px; page-break-inside: avoid; }
          .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 2px solid rgba(123, 151, 172, 0.3); page-break-inside: avoid; page-break-before: avoid; page-break-after: avoid; }
          .footer p { color: #666666; margin: 3px 0; font-size: 13px; page-break-inside: avoid; }
          .footer .highlight { color: #000000; font-weight: bold; }
          .footer .address { color: #7b97ac; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <img src="https://drumadon.com.au/logo_white.png" alt="Drumadon" style="max-width: 150px; height: auto;">
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${firstName},</p>
            <p style="font-size: 14px; color: #111111; margin-bottom: 20px;">${bookingFor === 'child' ? `A ${type === 'trial' ? 'free trial' : 'lesson'} has been booked for ${childName}!` : (type === 'trial' ? 'Your free trial has been booked!' : 'Your lesson has been booked!')} Here are the details:</p>
            <div class="booking-card">
              <h2>🎯 Your Booking Details</h2>
              <div class="details-table">
                ${bookingFor === 'child' ? `
                <div class="details-row">
                  <div class="details-cell details-label">🥁 Student:</div>
                  <div class="details-cell details-value">${childName}</div>
                </div>
                ` : ''}
                <div class="details-row">
                  <div class="details-cell details-label">📅 Date:</div>
                  <div class="details-cell details-value">${formattedDate}</div>
                </div>
                <div class="details-row">
                  <div class="details-cell details-label">⏰ Time:</div>
                  <div class="details-cell details-value">${selectedTime} (${pricing.duration} minutes)</div>
                </div>
                <div class="details-row">
                  <div class="details-cell details-label">📍 Location:</div>
                  <div class="details-cell details-value">5 Arthur Rd, Lesmurdie, WA</div>
                </div>
                ${type !== 'trial' ? `
                <div class="details-row">
                  <div class="details-cell details-label">💰 Price:</div>
                  <div class="details-cell details-value">${type !== 'trial' ? `$${!isNaN(Number(grandTotal)) && Number(grandTotal) >= 0 ? Number(grandTotal) : (selectedPack === 'pack' ? Math.round(pricing.pack / 10 * Number(lessonAmount || 1)) : pricing.single * Number(lessonAmount || 1))} (${lessonAmount || 1} Lessons)` : 'Free'}</div>
                </div>
                ` : ''}
                ${message ? `
                <div class="details-row">
                  <div class="details-cell details-label">📝 Notes:</div>
                  <div class="details-cell details-value">${message}</div>
                </div>
                ` : ''}
                ${invoiceUrl ? `
                <div class="details-row">
                  <div class="details-cell details-label">🧾 Invoice:</div>
                  <div class="details-cell details-value"><a href="${invoiceUrl}" style="color:#7b97ac;font-weight:bold;">View Invoice INV-${invoiceNum}</a></div>
                </div>
                ` : ''}
              </div>
            </div>
            <div class="contact-section">
              <h3>📞 Need changes?</h3>
              <p>Contact <strong>info@drumadon.com.au</strong> to reschedule.</p>
            </div>
            <div class="footer">
              <p>Looking forward to seeing you!</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return sendMailgunEmail(userEmailData);
}

// Email sending function for admin notification
async function sendAdminEmail({ name, email, phone, age, message, selectedTime, preferredDay, eventId, type, selectedPack, invoiceUrl, invoiceNum, bookingFor, childName, grandTotal, lessonAmount }) {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error('Email service not configured');
  }

  const date = new Date(preferredDay);
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  const pricing = getPricing(type);
  const amountToShow = type === 'trial'
    ? 0
    : (!isNaN(Number(grandTotal)) && Number(grandTotal) >= 0
      ? Number(grandTotal)
      : (selectedPack === 'pack' ? Math.round(pricing.pack / 10 * Number(lessonAmount || 1)) : pricing.single * Number(lessonAmount || 1)));

  const adminEmailData = {
    from: `Drumadon Website <noreply@${process.env.MAILGUN_DOMAIN}>`,
    to: 'info@drumadon.com.au',
    subject: type === 'trial' ? 'New Trial Booking' : 'New Lesson Booking',
    html: `
      <html>
      <body>
        <h2>${type === 'trial' ? 'New Trial Booking' : 'New Lesson Booking'}</h2>
        <h3>Contact Details</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        ${bookingFor === 'child' ? `<p><strong>Student:</strong> ${childName}${age ? ` (age ${age})` : ''}</p>` : (age ? `<p><strong>Age:</strong> ${age}</p>` : '')}
        <h3>Booking Details</h3>
        <p><strong>Type:</strong> ${type === 'trial' ? 'Free Trial' : type + '-Minute Lesson'}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${selectedTime} (${pricing.duration} minutes)</p>
        ${type !== 'trial' ? `<p><strong>Pricing:</strong> $${amountToShow} (${lessonAmount || 1}× lessons, ${selectedPack === 'pack' ? 'bulk rate' : 'single rate'})</p>` : ''}
        ${invoiceUrl ? `<p><strong>Invoice:</strong> <a href="${invoiceUrl}">INV-${invoiceNum}</a></p>` : ''}
        <p><strong>Message:</strong> ${message || 'No additional information'}</p>
      </body>
      </html>
    `,
  };

  return sendMailgunEmail(adminEmailData);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function validatePreferredDay(preferredDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(preferredDay || ''))) {
    throw new Error(`preferredDay "${preferredDay}" must be in YYYY-MM-DD format`);
  }

  const parsedDate = new Date(`${preferredDay}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`preferredDay "${preferredDay}" is not a valid date`);
  }

  return preferredDay;
}

function parseSelectedTime(selectedTime) {
  const trimmed = String(selectedTime || '').trim();
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed);

  if (!match) {
    throw new Error(`selectedTime "${selectedTime}" is not a valid 12-hour time`);
  }

  const [, hoursPart, minutesPart, meridiem] = match;
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    throw new Error(`selectedTime "${selectedTime}" is out of range`);
  }

  let normalizedHours = hours % 12;
  if (meridiem.toUpperCase() === 'PM') {
    normalizedHours += 12;
  }

  return { hours: normalizedHours, minutes };
}

function buildPerthLocalIso(preferredDay, hours, minutes, addMinutes = 0) {
  const [year, month, day] = preferredDay.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  date.setUTCMinutes(date.getUTCMinutes() + addMinutes);

  return `${pad2(date.getUTCFullYear())}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:00`;
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    let params;
    if (typeof req.body === 'string') {
      params = new URLSearchParams(req.body);
    } else if (req.body instanceof URLSearchParams) {
      params = req.body;
    } else if (req.body && typeof req.body === 'object') {
      params = new URLSearchParams(req.body);
    } else {
      params = new URLSearchParams();
    }

    const data = {};
    for (let [key, value] of params) {
      data[key] = value;
    }

    const { name, email, phone, age, message, selectedTime, preferredDay, type, selectedPack, lessonAmount, grandTotal, bookingFor, childName } = data;

    if (!name || !email || !phone || !selectedTime || !preferredDay) {
      return res.status(400).json({
        error: 'Missing information',
        message: 'Please fill in all required fields and try again.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please enter a valid email address.'
      });
    }

    console.log('Processing booking request:', { name, email, phone, selectedTime, preferredDay, type, selectedPack, lessonAmount });

    let parsedSelectedTime;
    let bookingDate;
    try {
      parsedSelectedTime = parseSelectedTime(selectedTime);
      bookingDate = validatePreferredDay(preferredDay);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Invalid booking data',
        message: validationError.message,
      });
    }

    // Compute pricing and date (needed for invoice and calendar)
    const pricing = getPricing(type);
    const durationMinutes = Number(pricing.duration);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new Error(`Pricing duration for type "${type}" is invalid`);
    }

    const formattedDate = `${new Date(`${bookingDate}T00:00:00`).getDate().toString().padStart(2, '0')}/${(new Date(`${bookingDate}T00:00:00`).getMonth() + 1).toString().padStart(2, '0')}/${new Date(`${bookingDate}T00:00:00`).getFullYear()}`;
    const rawGrandTotal = Number(grandTotal);
    const defaultBookingAmount = type === 'trial' ? 0 : selectedPack === 'pack' ? Math.round((pricing.pack / 10) * Number(lessonAmount || 1)) : pricing.single * Number(lessonAmount || 1);
    const bookingAmount = type === 'trial' ? 0 : (!Number.isNaN(rawGrandTotal) && rawGrandTotal >= 0 ? rawGrandTotal : defaultBookingAmount);

    // Generate invoice number and URL (trials don't need invoices)
    let invoiceNum, invoiceUrl;
    if (type !== 'trial') {
      try {
        if (!process.env.GOOGLE_SHEET_ID) throw new Error('GOOGLE_SHEET_ID not configured');
        const sheets = google.sheets({ version: 'v4', auth });

        console.log('Fetching existing rows from Google Sheet for invoice numbering...');
        const getRes = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'Sheet1!A:A',
        });
        const values = getRes.data.values || [];
        console.log('Sheet values in column A:', values.length, 'rows');

        // Start invoice rows at spreadsheet row 50.
        // Row 50 maps to INV-0001, row 51 -> INV-0002, etc.
        const invoiceStartRow = 50;
        let targetRow = invoiceStartRow;

        for (let i = invoiceStartRow - 1; i < values.length; i++) {
          const cellValue = values[i] && values[i][0];
          if (!cellValue || cellValue === '') {
            targetRow = i + 1;
            break;
          }
          targetRow = i + 2;
        }

        if (values.length < invoiceStartRow) {
          targetRow = invoiceStartRow;
        }

        invoiceNum = String(targetRow - invoiceStartRow + 1).padStart(4, '0');
        console.log('Target row for booking:', targetRow, 'Invoice number:', invoiceNum);

        // Update the target row with booking details
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: `Sheet1!A${targetRow}:H${targetRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              `INV-${invoiceNum}`, name, email, phone,
              type === 'trial' ? 'Free Trial' : `${lessonAmount || 1}x ${type} min lesson${selectedPack === 'pack' ? ' - Bulk Rate' : ''}`,
              bookingAmount === 0 ? 'Free' : `$${bookingAmount}`,
              new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' }),
              'Unpaid',
            ]],
          },
        });

        console.log('Successfully updated Google Sheet with booking at row', targetRow, 'invoice number:', invoiceNum);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: 0,
                    startRowIndex: 1,
                    endRowIndex: 2,
                    startColumnIndex: 7,
                    endColumnIndex: 8,
                  },
                  cell: {
                    userEnteredFormat: {
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                },
              },
              {
                repeatCell: {
                  range: {
                    sheetId: 0,
                    startRowIndex: targetRow - 1,
                    endRowIndex: targetRow,
                    startColumnIndex: 0,
                    endColumnIndex: 8,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 1, green: 0.95, blue: 0.86 },
                      horizontalAlignment: 'LEFT',
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,horizontalAlignment)',
                },
              },
            ],
          },
        });
      } catch (sheetErr) {
        console.error('Sheet invoice numbering unavailable, using random fallback:', sheetErr.message);
        invoiceNum = String(Math.floor(1000 + Math.random() * 9000));
      }
      const invoiceToken = Buffer.from(JSON.stringify({
        inv: invoiceNum, name, email, phone, age, type,
        selectedTime, preferredDay, selectedPack,
        lessonAmount, grandTotal: bookingAmount,
        bookingFor, childName,
      })).toString('base64url');
      invoiceUrl = `https://www.drumadon.com.au/api/invoice?d=${invoiceToken}`;
    }

    // Step 1: Send user confirmation email — must succeed before proceeding
    try {
      await sendUserConfirmationEmail({ name, email, phone, age, message, selectedTime, preferredDay, type, selectedPack, invoiceUrl, invoiceNum, bookingFor, childName, grandTotal: bookingAmount, lessonAmount });
      console.log('✅ User confirmation email sent successfully');
    } catch (emailError) {
      console.error('❌ CRITICAL: User confirmation email failed:', emailError);
      return res.status(500).json({
        error: 'Email service unavailable',
        message: 'We cannot confirm your booking at this time. Please try again later or contact us directly.'
      });
    }

    // Step 2: Create calendar event(s)
    const isoString = buildPerthLocalIso(bookingDate, parsedSelectedTime.hours, parsedSelectedTime.minutes);
    const endTimeString = buildPerthLocalIso(bookingDate, parsedSelectedTime.hours, parsedSelectedTime.minutes, durationMinutes);

    let calendarResponse = null;

    const totalLessons = Number(lessonAmount) || 1;
    const recurring = totalLessons > 1;

    if (recurring) {
      const titleSuffix = selectedPack === 'pack' ? `${totalLessons}-Pack` : `${totalLessons} Session${totalLessons === 1 ? '' : 's'}`;
      console.log(`Creating recurring ${titleSuffix} booking event`, { start: isoString, end: endTimeString, totalLessons });

      const recurringEvent = {
        summary: `${name} (${type === 'trial' ? 'Drumadon Trial' : 'Drumadon Lesson'})`,
        description: `
          ${type}-Minute Lesson - ${titleSuffix} (Weekly recurring)
          ${bookingFor === 'child' ? `Student: ${childName}${age ? ` (age ${age})` : ''}\nParent/Guardian: ${name}` : `Name: ${name}`}
          Email: ${email}
          Phone: ${phone}
          Message: ${message || 'No additional information'}
          Total Cost: $${bookingAmount}
        `,
        start: { dateTime: isoString, timeZone: 'Australia/Perth' },
        end: { dateTime: endTimeString, timeZone: 'Australia/Perth' },
        recurrence: [`RRULE:FREQ=WEEKLY;COUNT=${totalLessons}`],
        colorId: '7',
      };

      try {
        calendarResponse = await calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          resource: recurringEvent,
        });
      } catch (calendarError) {
        const formattedCalendarError = formatCalendarError(calendarError);
        console.error('Google Calendar insert failed for recurring booking:', formattedCalendarError);
        return res.status(502).json({
          error: 'Calendar service unavailable',
          message: 'We could not save your recurring booking to Google Calendar. Please try again later.',
          details: formattedCalendarError.message,
          calendarError: formattedCalendarError,
        });
      }

      console.log(`Recurring ${titleSuffix} calendar event created:`, calendarResponse.data.id);
    } else {
      const event = {
        summary: `${name} (${type === 'trial' ? 'Drumadon Trial' : 'Drumadon Lesson'})`,
        description: `
          ${type === 'trial' ? 'Trial Lesson' : type + '-Minute Lesson'} Booking Details:
          ${bookingFor === 'child' ? `Student: ${childName}${age ? ` (age ${age})` : ''}\nParent/Guardian: ${name}` : `Name: ${name}`}
          Email: ${email}
          Phone: ${phone}
          Message: ${message || 'No additional information'}
        `,
        start: { dateTime: isoString, timeZone: 'Australia/Perth' },
        end: { dateTime: endTimeString, timeZone: 'Australia/Perth' },
        colorId: type === 'trial' ? '6' : '7',
      };

      try {
        calendarResponse = await calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          resource: event,
        });
      } catch (calendarError) {
        const formattedCalendarError = formatCalendarError(calendarError);
        console.error('Google Calendar insert failed for single booking:', formattedCalendarError);
        return res.status(502).json({
          error: 'Calendar service unavailable',
          message: 'We could not save your booking to Google Calendar. Please try again later.',
          details: formattedCalendarError.message,
          calendarError: formattedCalendarError,
        });
      }

      console.log('Single calendar event created:', calendarResponse.data.id);
    }

    if (!calendarResponse?.data?.id) {
      throw new Error('Calendar API returned no event ID after insert');
    }

    // Step 3: Send admin notification
    try {
      await sendAdminEmail({ name, email, phone, age, message, selectedTime, preferredDay, eventId: calendarResponse.data.id, type, selectedPack, invoiceUrl, invoiceNum, bookingFor, childName, grandTotal: bookingAmount, lessonAmount });
      console.log('Admin notification email sent successfully');
    } catch (adminEmailError) {
      console.error('Admin email failed, but booking is confirmed:', adminEmailError);
    }

    return res.status(200).json({
      message: 'Booking confirmed and calendar event created',
      eventId: calendarResponse.data.id
    });

  } catch (error) {
    console.error('Booking failed:', error);
    return res.status(500).json({
      error: 'Booking failed',
      message: error.message || 'We encountered an issue processing your booking. Please try again or contact us directly.',
      details: error.message || 'Unknown server error'
    });
  }
};
