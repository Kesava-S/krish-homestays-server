const ical = require('node-ical');

async function fetchAirbnbBookings() {
    const events = await ical.async.fromURL(process.env.AIRBNB_ICAL_URL);

    const bookings = [];

    for (const key in events) {
        const event = events[key];

        if (event.type !== 'VEVENT') continue;
        if (!event.start || !event.end) continue;

        // Treat every event in the Airbnb calendar as a blocked period.
        // Airbnb only exports events for occupied/unavailable dates:
        //   - "Reserved"        → real guest booking
        //   - "Not available"   → owner-blocked dates
        //   - "Airbnb (Not available)" → platform-held dates
        // All of them mean the property is unavailable → block on the website too.
        bookings.push({
            start: event.start.toISOString().split('T')[0],
            end: event.end.toISOString().split('T')[0],
            type: 'airbnb'
        });
    }

    return bookings;
}

module.exports = { fetchAirbnbBookings };
