import { google } from 'npm:googleapis';

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
async function sendUserConfirmationEmail({ name, email, phone, age, message, selectedTime, preferredDay, type, selectedPack, invoiceUrl, invoiceNum, bookingFor, childName }) {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error('Email service not configured');
  }

  const date = new Date(preferredDay);
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  const pricing = getPricing(type);

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
            <p class="welcome-text">Hi ${name},</p>
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
                  <div class="details-cell details-value">${selectedPack === 'pack' ? `$${pricing.pack} (10× Bulk)` : `$${pricing.single} (Single Lesson)`}</div>
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
async function sendAdminEmail({ name, email, phone, age, message, selectedTime, preferredDay, eventId, type, selectedPack, invoiceUrl, invoiceNum, bookingFor, childName }) {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error('Email service not configured');
  }

  const date = new Date(preferredDay);
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  const pricing = getPricing(type);

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
        ${type !== 'trial' ? `<p><strong>Pricing:</strong> $${bookingAmount} (${lessonAmount || 1}× lessons, ${selectedPack === 'pack' ? 'bulk rate' : 'single rate'})</p>` : ''}
        ${invoiceUrl ? `<p><strong>Invoice:</strong> <a href="${invoiceUrl}">INV-${invoiceNum}</a></p>` : ''}
        <p><strong>Message:</strong> ${message || 'No additional information'}</p>
      </body>
      </html>
    `,
  };

  return sendMailgunEmail(adminEmailData);
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

    const { name, email, phone, age, message, selectedTime, preferredDay, type, selectedPack, lessonAmount, bookingFor, childName } = data;

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

    // Compute pricing and date (needed for invoice and calendar)
    const pricing = getPricing(type);
    const bookingDate = new Date(preferredDay);
    const formattedDate = `${bookingDate.getDate().toString().padStart(2, '0')}/${(bookingDate.getMonth() + 1).toString().padStart(2, '0')}/${bookingDate.getFullYear()}`;
    const bookingAmount = type === 'trial' ? 0 : selectedPack === 'pack' ? Math.round((pricing.pack / 10) * Number(lessonAmount || 1)) : pricing.single * Number(lessonAmount || 1);

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

        // Find the first empty row (top-left most free box in column A)
        let targetRow = 1; // 1-based
        for (let i = 0; i < values.length; i++) {
          if (!values[i] || values[i][0] === '' || values[i][0] === undefined) {
            targetRow = i + 1;
            break;
          }
        }
        if (targetRow === 1 && values.length > 0 && values[0] && values[0][0]) {
          // All rows filled, use next row
          targetRow = values.length + 1;
        }
        invoiceNum = String(targetRow).padStart(4, '0');
        console.log('Target row for booking:', targetRow, 'Invoice number:', invoiceNum);

        // Update the target row with booking details
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: `Sheet1!A${targetRow}:H${targetRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              `INV-${invoiceNum}`, name, email, phone,
              type === 'trial' ? 'Free Trial' : `${type}-Minute Lesson (${lessonAmount || 1} lessons${selectedPack === 'pack' ? ' - Bulk Rate' : ''})`,
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
            requests: [{
              setDataValidation: {
                range: { sheetId: 0, startRowIndex: 1, startColumnIndex: 7, endColumnIndex: 8 },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'Unpaid' },
                      { userEnteredValue: 'Paid' },
                      { userEnteredValue: 'Canceled' },
                    ],
                  },
                  showCustomUi: true,
                  strict: true,
                },
              },
            }],
          },
        });
      } catch (sheetErr) {
        console.error('Sheet invoice numbering unavailable, using random fallback:', sheetErr.message);
        invoiceNum = String(Math.floor(1000 + Math.random() * 9000));
      }
      const invoiceToken = Buffer.from(JSON.stringify({
        inv: invoiceNum, name, email, phone, age, type,
        selectedTime, preferredDay, selectedPack,
        bookingFor, childName,
      })).toString('base64url');
      invoiceUrl = `https://www.drumadon.com.au/api/invoice?d=${invoiceToken}`;
    }

    // Step 1: Send user confirmation email — must succeed before proceeding
    try {
      await sendUserConfirmationEmail({ name, email, phone, age, message, selectedTime, preferredDay, type, selectedPack, invoiceUrl, invoiceNum, bookingFor, childName });
      console.log('✅ User confirmation email sent successfully');
    } catch (emailError) {
      console.error('❌ CRITICAL: User confirmation email failed:', emailError);
      return res.status(500).json({
        error: 'Email service unavailable',
        message: 'We cannot confirm your booking at this time. Please try again later or contact us directly.'
      });
    }

    // Step 2: Create calendar event(s)
    const perthOffset = 8;
    const offsetString = `+${perthOffset.toString().padStart(2, '0')}:00`;

    const time24h = selectedTime.replace(' AM', '').replace(' PM', '');
    const isPM = selectedTime.includes(' PM');
    const is12 = selectedTime.startsWith('12');

    let [hours, minutes] = time24h.split(':').map(Number);
    if (isPM && !is12) {
      hours += 12;
    } else if (!isPM && is12) {
      hours = 0;
    }

    const isoString = `${preferredDay}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00${offsetString}`;
    const durationMinutes = type === 'trial' ? 20 : parseInt(type);
    const endHours = Math.floor((hours * 60 + minutes + durationMinutes) / 60);
    const endMinutes = (hours * 60 + minutes + durationMinutes) % 60;
    const endTimeString = `${preferredDay}T${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00+08:00`;

    let calendarResponse;

    if (selectedPack === 'pack') {
      const totalLessons = 10;
      console.log(`Creating ${totalLessons} calendar events for regular 10-pack bulk booking`);

      const events = [];
      const startDate = new Date(preferredDay);

      for (let i = 0; i < totalLessons; i++) {
        const lessonDate = new Date(startDate);
        lessonDate.setDate(startDate.getDate() + (i * 7));

        const lessonDateString = lessonDate.toISOString().split('T')[0];
        const lessonStartString = `${lessonDateString}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00${offsetString}`;
        const lessonEndString = `${lessonDateString}T${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00+08:00`;

        const currentLessonNumber = i + 1;
        const packDescription = '10-Pack';

        const bulkEvent = {
          summary: `Drumadon ${type}-Minute Lesson (Lesson ${currentLessonNumber} out of ${totalLessons}) - ${name}`,
          description: `
            ${type}-Minute Lesson - ${packDescription} (Lesson ${currentLessonNumber} of ${totalLessons})
            ${bookingFor === 'child' ? `Student: ${childName}${age ? ` (age ${age})` : ''}\nParent/Guardian: ${name}` : `Name: ${name}`}
            Email: ${email}
            Phone: ${phone}
            Message: ${message || 'No additional information'}
            Total Cost: $${pricing.pack}
          `,
          start: { dateTime: lessonStartString, timeZone: 'Australia/Perth' },
          end: { dateTime: lessonEndString, timeZone: 'Australia/Perth' },
          colorId: '11',
        };

        const eventResponse = await calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          resource: bulkEvent,
        });

        events.push(eventResponse.data);
        console.log(`Bulk event ${currentLessonNumber}/${totalLessons} created:`, eventResponse.data.id);
      }

      calendarResponse = { data: { id: events.map(e => e.id).join(',') } };
      console.log(`All ${totalLessons} bulk calendar events created`);

    } else {
      const event = {
        summary: `Drumadon ${type === 'trial' ? 'Trial' : type + '-Minute Lesson'} - ${name}`,
        description: `
          ${type === 'trial' ? 'Trial' : type + '-Minute Lesson'} Booking Details:
          ${bookingFor === 'child' ? `Student: ${childName}${age ? ` (age ${age})` : ''}\nParent/Guardian: ${name}` : `Name: ${name}`}
          Email: ${email}
          Phone: ${phone}
          Message: ${message || 'No additional information'}
        `,
        start: { dateTime: isoString, timeZone: 'Australia/Perth' },
        end: { dateTime: endTimeString, timeZone: 'Australia/Perth' },
        colorId: type === 'trial' ? '6' : '11',
      };

      calendarResponse = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: event,
      });

      console.log('Single calendar event created:', calendarResponse.data.id);
    }

    // Step 3: Send admin notification
    try {
      await sendAdminEmail({ name, email, phone, age, message, selectedTime, preferredDay, eventId: calendarResponse.data.id, type, selectedPack, invoiceUrl, invoiceNum, bookingFor, childName });
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
      message: 'We encountered an issue processing your booking. Please try again or contact us directly.',
      details: error.message || 'Unknown server error'
    });
  }
};
