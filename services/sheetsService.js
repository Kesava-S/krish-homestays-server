const { google } = require('googleapis');
require('dotenv').config();

const authConfig = {
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
};

if (process.env.GOOGLE_CREDENTIALS_JSON) {
    authConfig.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
} else {
    authConfig.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const auth = new google.auth.GoogleAuth(authConfig);

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// --- Bookings ---

async function getBookings() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Bookings!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return [];

        return rows.slice(1).map(row => ({
            id: row[0],
            date: row[1],
            guest_name: row[2],
            email: row[3],
            phone: row[4],
            check_in_date: row[5],
            check_out_date: row[6],
            guests_count: parseInt(row[7]),
            status: row[8],
            total_amount: row[9]
        }));
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return [];
    }
}

async function addBooking(booking) {
    try {
        const values = [[
            Date.now().toString(),
            booking.guest_name,
            booking.email,
            booking.phone,
            booking.check_in_date,
            booking.check_out_date,
            booking.guests_count,
            'confirmed',
            booking.total_amount
        ]];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Bookings!A:K',
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
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
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
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CalendarRules!A:C',
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
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
