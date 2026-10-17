const ical = require('node-ical');

function formatIcalDate(dt) {
    if (!dt) return null;
    if (typeof dt === 'string') return dt.split('T')[0];
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

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
            start: formatIcalDate(event.start),
            end: formatIcalDate(event.end),
            type: 'airbnb'
        });
    }

    return bookings;
}

module.exports = { fetchAirbnbBookings };
