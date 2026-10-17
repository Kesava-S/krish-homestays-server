const ical = require('node-ical');

function formatIcalDate(dt) {
    if (!dt) return null;
    if (typeof dt === 'string') return dt.split('T')[0];
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function fetchMMTBookings() {
    const events = await ical.async.fromURL(process.env.MMT_ICAL_URL);

    const bookings = [];

    for (const key in events) {
        const event = events[key];

        if (event.type !== 'VEVENT') continue;
        if (!event.start || !event.end) continue;

        // Treat every event in the MMT calendar as a blocked period.
        // MMT only exports events for occupied dates — there are no "available" events.
        bookings.push({
            start: formatIcalDate(event.start),
            end: formatIcalDate(event.end),
            type: 'makemytrip'
        });
    }

    return bookings;
}

module.exports = { fetchMMTBookings };
