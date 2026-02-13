import { google } from 'googleapis';

// Email sending function for user confirmation
async function sendUserConfirmationEmail({ name, email, phone, age, message, selectedTime, preferredDay }) {
  // Validate Mailgun environment variables
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error('Email service not configured');
  }

  // Format date to Australian format (DD/MM/YYYY)
  const date = new Date(preferredDay);
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

  const sendMailgunEmail = async (emailData) => {
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
  };

  // Email to user
  const userEmailData = {
    from: `Drumadon <noreply@${process.env.MAILGUN_DOMAIN}>`,
    to: email,
    subject: 'Your Drumadon Trial Booking is Confirmed!',
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
          .details-label { font-weight: bold; color: #7b97ac; min-width: 100px; font-size: 14px; page-break-inside: avoid; }
          .details-value { color: #111111; font-size: 14px; page-break-inside: avoid; }
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
          
          <!-- Header -->
          <div class="header">
            <img src="https://drumadon.com.au/logo_white.png" alt="Drumadon" style="max-width: 150px; height: auto;">
          </div>
          
          <!-- Main Content -->
          <div class="content">
            <p class="welcome-text">Hi ${name},</p>
            <p style="font-size: 14px; color: #666666; margin-bottom: 20px;">Your free trial has been booked! Here are the details:</p>
            
            <!-- Booking Details Card -->
            <div class="booking-card">
              <h2>🎯 Your Booking Details</h2>
              
              <div class="details-table">
                <div class="details-row">
                  <div class="details-cell details-label">📅 Date:</div>
                  <div class="details-cell details-value">${formattedDate}</div>
                </div>
                <div class="details-row">
                  <div class="details-cell details-label">⏰ Time:</div>
                  <div class="details-cell details-value">${selectedTime} (30 minutes)</div>
                </div>
                <div class="details-row">
                  <div class="details-cell details-label">📍 Location:</div>
                  <div class="details-cell details-value">5 Arthur Rd, Lesmurdie, WA</div>
                </div>
              </div>
              
            </div>
            
            <!-- Contact Info -->
            <div class="contact-section">
              <h3>📞 Need changes?</h3>
              <p>Contact <strong>info@drumadon.com.au</strong> to reschedule.</p>
            </div>
            
            <!-- Footer -->
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
async function sendAdminEmail({ name, email, phone, age, message, selectedTime, preferredDay, eventId }) {
  // Validate Mailgun environment variables
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error('Email service not configured');
  }

  // Format date to Australian format (DD/MM/YYYY)
  const date = new Date(preferredDay);
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

  const sendMailgunEmail = async (emailData) => {
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
  };

  // Email to admin
  const adminEmailData = {
    from: `Drumadon Website <noreply@${process.env.MAILGUN_DOMAIN}>`,
    to: 'info@drumadon.com.au',
    subject: 'New Trial Booking',
    html: `
      <html>
      <body>
        <h2>New Trial Booking</h2>
        
        <h3>Student Details</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        ${age ? `<p><strong>Age:</strong> ${age}</p>` : ''}
        
        <h3>Booking Details</h3>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${selectedTime} (30 minutes)</p>
        <p><strong>Message:</strong> ${message || 'No additional information'}</p>
        

        
      </body>
      </html>
    `,
  };

  return sendMailgunEmail(adminEmailData);
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
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
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Parse form data
    const params = new URLSearchParams(req.body);
    const data = {};
    for (let [key, value] of params) {
      data[key] = value;
    }

    const { name, email, phone, age, message, selectedTime, preferredDay } = data;

    // Validate required fields
    if (!name || !email || !phone || !selectedTime || !preferredDay) {
      return res.status(400).json({
        error: 'Missing information',
        message: 'Please fill in all required fields and try again.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please enter a valid email address.'
      });
    }

    console.log('Processing booking request:', { name, email, phone, selectedTime, preferredDay });

    // CRITICAL: Step 1 - Send user confirmation email FIRST
    // This is the ONLY step that must succeed before proceeding
    // If user email fails, NO calendar event and NO admin email will be created
    try {
      await sendUserConfirmationEmail({ name, email, phone, age, message, selectedTime, preferredDay });
      console.log('✅ User confirmation email sent successfully - proceeding with booking');
    } catch (emailError) {
      console.error('❌ CRITICAL: User confirmation email failed - aborting booking process:', emailError);
      return res.status(500).json({
        error: 'Email service unavailable',
        message: 'We cannot confirm your booking at this time. Please try again later or contact us directly.'
      });
    }

    // Step 2: User email confirmed - now safe to create calendar event and notify admin
    console.log('🔄 Proceeding with calendar event creation and admin notification...');

    // CONFIRMED: User has received their confirmation email
    // Now we can safely create the calendar event and notify admin
    // Combine date and time into a proper datetime string
    // preferredDay is in YYYY-MM-DD format, selectedTime is like "1:30 PM"
    
    const time24h = selectedTime.replace(' AM', '').replace(' PM', '');
    const isPM = selectedTime.includes(' PM');
    const is12 = selectedTime.startsWith('12');
    
    let [hours, minutes] = time24h.split(':').map(Number);
    
    // Convert to 24-hour format
    if (isPM && !is12) {
      hours += 12;
    } else if (!isPM && is12) {
      hours = 0; // 12 AM = 0
    }
    
    // Create the date in Perth timezone (Western Australia)
    // Perth is UTC+8 year-round (no DST)
    const perthOffset = 8;
    const offsetString = `+${perthOffset.toString().padStart(2, '0')}:00`;
    
    // Create ISO string with Perth timezone
    const isoString = `${preferredDay}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00${offsetString}`;
    const eventStart = new Date(isoString);
    const eventEnd = new Date(eventStart.getTime() + 30 * 60 * 1000); // 30 minutes
    
    // Calculate end time (30 minutes later)
    const endHours = Math.floor((hours * 60 + minutes + 30) / 60);
    const endMinutes = (hours * 60 + minutes + 30) % 60;
    const endTimeString = `${preferredDay}T${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00+08:00`;

    // Create calendar event
    const event = {
      summary: `Drumadon Trial - ${name}`,
      description: `
        Trial Booking Details:
        Name: ${name}
        Email: ${email}
        Phone: ${phone}
        Age: ${age}
        Message: ${message || 'No additional information'}
      `,
      start: {
        dateTime: isoString, // Use Perth time directly, not UTC conversion
        timeZone: 'Australia/Perth',
      },
      end: {
        dateTime: endTimeString, // 30 minutes later in Perth timezone
        timeZone: 'Australia/Perth',
      },
      colorId: '6', // Tangerine color (orange, vibrant)
      // Note: Attendees removed due to service account limitations
      // The event will be created in the calendar with booking details
    };

    const calendarResponse = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: event,
    });

    console.log('Calendar event created:', calendarResponse.data.id);

    // Send admin email (only because user confirmation email already succeeded)
    try {
      await sendAdminEmail({ name, email, phone, age, message, selectedTime, preferredDay, eventId: calendarResponse.data.id });
      console.log('Admin notification email sent successfully');
    } catch (adminEmailError) {
      console.error('Admin email failed, but booking is confirmed:', adminEmailError);
      // Don't fail the request since user email and calendar creation succeeded
    }

    return res.status(200).json({ 
      message: 'Booking confirmed and calendar event created',
      eventId: calendarResponse.data.id
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Booking failed',
      message: 'We encountered an issue processing your booking. Please try again or contact us directly.'
    });
  }
};