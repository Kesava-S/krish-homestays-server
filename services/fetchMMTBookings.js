const ical = require('node-ical');

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
            start: event.start.toISOString().split('T')[0],
            end: event.end.toISOString().split('T')[0],
            type: 'makemytrip'
        });
    }

    return bookings;
}

module.exports = { fetchMMTBookings };
