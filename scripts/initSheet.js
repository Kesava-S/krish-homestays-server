const { google } = require('googleapis');
require('dotenv').config(); // Load env from current dir

const calendarAuthConfig = {
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
};

if (process.env.GOOGLE_CREDENTIALS_JSON_CALENDAR) {
    calendarAuthConfig.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON_CALENDAR);
} else {
    calendarAuthConfig.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS_CALENDAR;
}

const auth = new google.auth.GoogleAuth(calendarAuthConfig);

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.CALENDAR_SPREADSHEET_ID;

async function initSheet() {
    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const sheetExists = spreadsheet.data.sheets.some(
            s => s.properties.title === 'CalendarRules'
        );

        if (sheetExists) {
            console.log('CalendarRules sheet already exists.');
        } else {
            console.log('Creating CalendarRules sheet...');
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: 'CalendarRules',
                                },
                            },
                        },
                    ],
                },
            });
            console.log('CalendarRules sheet created.');

            // Add Headers
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'CalendarRules!A1:C1',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['Date', 'Price', 'Status']],
                },
            });
            console.log('Headers added.');
        }
    } catch (error) {
        console.error('Error initializing sheet:', error);
    }
}

initSheet();
