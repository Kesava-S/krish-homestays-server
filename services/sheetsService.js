const { google } = require('googleapis');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const bookingAuthConfig = { scopes: SCOPES };
if (process.env.GOOGLE_CREDENTIALS_JSON_BOOKING) {
    bookingAuthConfig.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON_BOOKING);
} else {
    bookingAuthConfig.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS_BOOKING;
}

const calendarAuthConfig = { scopes: SCOPES };
if (process.env.GOOGLE_CREDENTIALS_JSON_CALENDAR) {
    calendarAuthConfig.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON_CALENDAR);
} else {
    calendarAuthConfig.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS_CALENDAR;
}

const bookingAuth  = new google.auth.GoogleAuth(bookingAuthConfig);
const calendarAuth = new google.auth.GoogleAuth(calendarAuthConfig);

const bookingSheets = google.sheets({ version: 'v4', auth: bookingAuth });
const calendarSheets = google.sheets({ version: 'v4', auth: calendarAuth });

const BOOKING_SPREADSHEET_ID = process.env.BOOKING_SPREADSHEET_ID;
const CALENDAR_SPREADSHEET_ID = process.env.CALENDAR_SPREADSHEET_ID;

console.log(BOOKING_SPREADSHEET_ID);


// --- Bookings ---

async function getBookings() {
    try {
        const response = await bookingSheets.spreadsheets.values.get({
            spreadsheetId: BOOKING_SPREADSHEET_ID,
            range: "'Bookings Sheet'!A:R",
        });

        console.log("Booking:\n", response.data.values);

        const rows = response.data.values;
        if (!rows || rows.length === 0) return [];

        // A  B     C           D       E      F              G               H            I       J         K       L             M           N       O                  P                Q                R
        // Id Date  Guest Name  Email   Phone  Check In Date  Check Out Date  Guest Count  Adults  Children  Status  Total Amount  Payment ID  source  Confirmation Sent  Remainder Sent   Review Requested Notes
        return rows.slice(1).map(row => ({
            id: row[0],
            date: row[1],
            guest_name: row[2],
            email: row[3],
            phone: row[4],
            check_in_date: row[5],
            check_out_date: row[6],
            guests_count: row[7] ? parseInt(row[7]) : null,
            adults: row[8] ? parseInt(row[8]) : null,
            children: row[9] ? parseInt(row[9]) : null,
            status: row[10] || null,
            total_amount: row[11] ? parseInt(row[11]) : null,
            payment_id: row[12] || null,
            source: row[13] || null,
        }));
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return [];
    }
}

async function addBooking(booking) {
    try {
        // A           B                   C                 D              E             F                     G                      H                    I                    J                     K         L                    M   N
        // Booking Id  Date                Guest Name        Email          Phone Number  Check In Date         Check Out Date         Guest Count          Guest Adults         Guest Children        Status    Total Amount         PaymentId  source
        const values = [[
            booking.booking_id,
            new Date().toISOString().slice(0, 10),
            booking.guest_name,
            booking.email,
            booking.phone,
            booking.check_in_date,
            booking.check_out_date,
            booking.guests_count ?? '',
            booking.adults ?? '',
            booking.children ?? '',
            'confirmed',
            booking.total_amount,
            '',
            booking.source ?? 'website',
        ]];

        await bookingSheets.spreadsheets.values.append({
            spreadsheetId: BOOKING_SPREADSHEET_ID,
            range: "'Bookings Sheet'!A:N",
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values },
        });

        return { ...booking, status: 'confirmed' };
    } catch (error) {
        console.error('Error adding booking:', error);
        throw error;
    }
}

// --- Calendar Rules (Prices & Blocks) ---

async function getCalendarRules() {
    try {
        // We assume a sheet named 'CalendarRules' exists with columns: Date, Price, Status
        const response = await calendarSheets.spreadsheets.values.get({
            spreadsheetId: CALENDAR_SPREADSHEET_ID,
            range: 'CalendarRules!A:C',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return [];

        // Skip header
        return rows.slice(1).map(row => ({
            date: row[0],
            price: row[1] ? parseInt(row[1]) : null,
            status: row[2] // 'available' or 'blocked'
        }));
    } catch (error) {
        console.warn('Error fetching calendar rules (Sheet might not exist yet):', error.message);
        return [];
    }
}

async function updateCalendarRules(rules) {
    // rules is an array of { date, price, status }
    // This is a naive implementation: It reads all, updates in memory, and rewrites the sheet.
    // For a small homestay (365 days), this is fine and safer than complex batch updates.

    try {
        const currentRules = await getCalendarRules();
        const ruleMap = new Map();

        // Load existing
        currentRules.forEach(r => ruleMap.set(r.date, r));

        // Apply updates
        rules.forEach(r => {
            if (ruleMap.has(r.date)) {
                const existing = ruleMap.get(r.date);
                ruleMap.set(r.date, { ...existing, ...r });
            } else {
                ruleMap.set(r.date, r);
            }
        });

        // Convert back to array
        const newRows = [['Date', 'Price', 'Status']];
        for (const [date, rule] of ruleMap) {
            newRows.push([date, rule.price || '', rule.status || 'available']);
        }

        // Clear and Write
        await calendarSheets.spreadsheets.values.clear({
            spreadsheetId: CALENDAR_SPREADSHEET_ID,
            range: 'CalendarRules!A:C',
        });

        await calendarSheets.spreadsheets.values.update({
            spreadsheetId: CALENDAR_SPREADSHEET_ID,
            range: 'CalendarRules!A:C',
            valueInputOption: 'USER_ENTERED',
            resource: { values: newRows },
        });

        return true;
    } catch (error) {
        console.error('Error updating calendar rules:', error);
        throw error;
    }
}

module.exports = { getBookings, addBooking, getCalendarRules, updateCalendarRules };
