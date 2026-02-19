const ical = require('node-ical');

async function fetchAirbnbBookings() {
    const events = await ical.async.fromURL(process.env.AIRBNB_ICAL_URL);

    const bookings = [];

    for (const key in events) {
        const event = events[key];

        if (event.type !== 'VEVENT') continue;

        const summary = (event.summary || '').toLowerCase();

        // Skip owner blocks, unavailable dates — keep only real guest bookings
        const isRealBooking = summary.includes('reserved') || summary.includes('airbnb');
        const isBlocked = summary.includes('not available') || summary.includes('closed') || summary.includes('blocked');

        if (isRealBooking && !isBlocked) {
            bookings.push({
                start: event.start.toISOString().split('T')[0],
                end: event.end.toISOString().split('T')[0],
                type: 'airbnb'
            });
        }
    }

    return bookings;
}

module.exports = { fetchAirbnbBookings };