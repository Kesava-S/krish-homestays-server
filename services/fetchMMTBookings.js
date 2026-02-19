const ical = require('node-ical');

async function fetchMMTBookings() {
    const events = await ical.async.fromURL(process.env.MMT_ICAL_URL);

    const bookings = [];

    for (const key in events) {
        const event = events[key];

        if (event.type !== 'VEVENT') continue;

        const summary = (event.summary || '').toLowerCase();

        // Log this first to confirm MakeMyTrip's exact summary wording
        // console.log('MMT event summary:', event.summary);

        const isRealBooking = summary.includes('reserved') || summary.includes('makemytrip') || summary.includes('confirmed');
        const isBlocked = summary.includes('not available') || summary.includes('blocked') || summary.includes('closed');

        if (isRealBooking && !isBlocked) {
            bookings.push({
                start: event.start.toISOString().split('T')[0],
                end: event.end.toISOString().split('T')[0],
                type: 'makemytrip'
            });
        }
    }

    return bookings;
}

module.exports = { fetchMMTBookings };