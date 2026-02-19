const { google } = require('googleapis');
require('dotenv').config();

// Initialize the Google Calendar API
// You need to set up a Service Account in Google Cloud Console
// and download the credentials JSON file.
// Then set GOOGLE_APPLICATION_CREDENTIALS in .env to point to that file.
// OR use OAuth2 if you prefer.

// For simplicity, we'll assume a Service Account approach here as it's better for backend automation.
// 1. Create Service Account.
// 2. Share your main calendar (krishhomestays@gmail.com) with the Service Account email.
// 3. Use the Service Account to insert events.


const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const calendar = google.calendar({ version: 'v3' });

// This authentication strategy depends on how you want to configure it.
// Using a Service Account is recommended for server-to-server apps.
const authConfig = {
    scopes: SCOPES,
};

if (process.env.GOOGLE_CREDENTIALS_JSON) {
    authConfig.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
} else {
    authConfig.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const auth = new google.auth.GoogleAuth(authConfig);

async function createCalendarEvent(bookingDetails) {
    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        const event = {
            summary: `Booking: ${bookingDetails.guest_name}`,
            location: 'Krish Homestay, Munnar',
            description: `Guests: ${bookingDetails.guests_count}\nPhone: ${bookingDetails.phone}\nEmail: ${bookingDetails.email}`,
            start: {
                date: bookingDetails.check_in_date, // YYYY-MM-DD
                timeZone: 'Asia/Kolkata',
            },
            end: {
                date: bookingDetails.check_out_date, // YYYY-MM-DD
                timeZone: 'Asia/Kolkata',
            },
        };

        const response = await calendar.events.insert({
            calendarId: process.env.CALENDAR_ID || 'primary', // 'primary' if using OAuth, or the specific email if shared
            resource: event,
        });

        console.log('Event created: %s', response.data.htmlLink);
        return response.data;
    } catch (error) {
        console.error('Error creating calendar event:', error);
        // Don't throw, just log. We don't want to fail the booking if calendar fails.
        return null;
    }
}

module.exports = { createCalendarEvent };
