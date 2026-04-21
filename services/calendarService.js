const { google } = require('googleapis');
require('dotenv').config();


const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const calendar = google.calendar({ version: 'v3' });

const authConfig = {
    scopes: SCOPES,
};

if (process.env.GOOGLE_CREDENTIALS_JSON_CALENDAR) {
    authConfig.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON_CALENDAR);
} else {
    authConfig.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS_CALENDAR;
}

const auth = new google.auth.GoogleAuth(authConfig);

async function createCalendarEvent(bookingDetails) {
    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        const event = {
            summary: `Booking: ${bookingDetails.guest_name}`,
            location: 'Krish Homestays, Munnar',
            description: `Adults: ${bookingDetails.adults ?? bookingDetails.guests_count}\nChildren: ${bookingDetails.children ?? 0}\nRoom: ${bookingDetails.room_type ?? 'full'}\nPhone: ${bookingDetails.phone}\nEmail: ${bookingDetails.email}`,
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
