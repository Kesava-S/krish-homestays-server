const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('⚠️ SUPABASE_URL or SUPABASE_KEY is missing in environment variables.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// Helper to generate booking ID (e.g., KH-20261013-ABCDE)
function generateBookingId() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `KH-${dateStr}-${randomChars}`;
}

// Format Date string to YYYY-MM-DD
function toDateStr(d) {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).split('T')[0];
}

// ─── Bookings ───────────────────────────────────────────────────

/**
 * Get active/confirmed bookings for calendar blocking and overlap check
 */
async function getBookings() {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .in('status', ['confirmed', 'booked'])
            .order('check_in_date', { ascending: true });

        if (error) {
            console.error('Error fetching bookings from Supabase:', error);
            return [];
        }

        return (data || []).map(b => ({
            id: b.id,
            booking_id: b.booking_id,
            date: toDateStr(b.date),
            guest_name: b.guest_name,
            email: b.email,
            phone: b.phone,
            check_in_date: toDateStr(b.check_in_date),
            check_out_date: toDateStr(b.check_out_date),
            guests_count: b.guests_count != null ? Number(b.guests_count) : 1,
            adults: b.adults != null ? Number(b.adults) : 1,
            children: b.children != null ? Number(b.children) : 0,
            booking_type: b.booking_type || 'full villa',
            room_type: b.room_type || 'full',
            status: b.status || 'confirmed',
            total_amount: b.total_amount != null ? Number(b.total_amount) : 0,
            payment_id: b.payment_id,
            source: b.source || 'website',
            confirmation_sent: b.confirmation_sent,
            remainder_sent: b.remainder_sent,
            review_requested: b.review_requested,
            notes: b.notes,
        }));
    } catch (err) {
        console.error('Exception fetching bookings:', err);
        return [];
    }
}

/**
 * Get all bookings for Admin panel (with compatibility keys for BookingList.jsx)
 */
async function getAllBookings() {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching all bookings from Supabase:', error);
            return [];
        }

        return (data || []).map(row => {
            const checkIn = toDateStr(row.check_in_date);
            const checkOut = toDateStr(row.check_out_date);
            const bookingDate = toDateStr(row.date);

            return {
                id: row.id,
                booking_id: row.booking_id,
                date: bookingDate,
                guest_name: row.guest_name,
                email: row.email,
                phone: row.phone,
                check_in_date: checkIn,
                check_out_date: checkOut,
                guests_count: row.guests_count,
                adults: row.adults,
                children: row.children,
                booking_type: row.booking_type,
                room_type: row.room_type,
                status: row.status,
                total_amount: row.total_amount,
                payment_id: row.payment_id,
                source: row.source,
                confirmation_sent: row.confirmation_sent,
                remainder_sent: row.remainder_sent,
                review_requested: row.review_requested,
                notes: row.notes,
                created_at: row.created_at,
                updated_at: row.updated_at,

                // Legacy title-case properties for direct compatibility with BookingList.jsx
                'Booking Id': row.booking_id || '',
                'Date': bookingDate || '',
                'Guest Name': row.guest_name || '',
                'Email': row.email || '',
                'Phone Number': row.phone || '',
                'Check In Date': checkIn || '',
                'Check Out Date': checkOut || '',
                'Guest Count': row.guests_count != null ? row.guests_count : '',
                'Guest Adults': row.adults != null ? row.adults : '',
                'Guest Children': row.children != null ? row.children : '',
                'Booking Type': row.booking_type || '',
                'Status': row.status || '',
                'Total Amount': row.total_amount != null ? row.total_amount : '',
                'Payment ID': row.payment_id || '',
                'source': row.source || 'website',
                'Confirmation Sent': row.confirmation_sent || '',
                'Remainder Sent': row.remainder_sent || '',
                'Review Requested': row.review_requested || '',
                'Notes': row.notes || '',
            };
        });
    } catch (err) {
        console.error('Exception fetching all bookings:', err);
        return [];
    }
}

/**
 * Add a new booking to Supabase
 */
async function addBooking(booking) {
    try {
        const bookingId = booking.booking_id || generateBookingId();
        const checkIn = toDateStr(booking.check_in_date);
        const checkOut = toDateStr(booking.check_out_date);
        const today = toDateStr(booking.date || new Date());

        const payload = {
            booking_id: bookingId,
            date: today,
            guest_name: booking.guest_name,
            email: booking.email,
            phone: booking.phone || null,
            check_in_date: checkIn,
            check_out_date: checkOut,
            guests_count: booking.guests_count != null ? Number(booking.guests_count) : ((Number(booking.adults) || 1) + (Number(booking.children) || 0)),
            adults: booking.adults != null ? Number(booking.adults) : 1,
            children: booking.children != null ? Number(booking.children) : 0,
            booking_type: booking.booking_type || 'full villa',
            room_type: booking.room_type || 'full',
            status: booking.status || 'confirmed',
            total_amount: booking.total_amount != null ? Number(booking.total_amount) : 0,
            payment_id: booking.payment_id || null,
            source: booking.source || 'website',
            notes: booking.notes || null,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('bookings')
            .upsert(payload, { onConflict: 'booking_id' })
            .select()
            .single();

        if (error) {
            console.error('Error inserting booking into Supabase:', error);
            throw error;
        }

        return { ...booking, ...data, booking_id: data.booking_id, status: data.status };
    } catch (err) {
        console.error('Exception adding booking:', err);
        throw err;
    }
}

/**
 * Update an existing booking by booking_id
 */
async function updateBooking(bookingId, updates) {
    try {
        const payload = { ...updates, updated_at: new Date().toISOString() };
        if (payload['Check In Date']) payload.check_in_date = toDateStr(payload['Check In Date']);
        if (payload['Check Out Date']) payload.check_out_date = toDateStr(payload['Check Out Date']);
        if (payload['Booking Type']) payload.booking_type = payload['Booking Type'];
        if (payload['Status']) payload.status = payload['Status'];
        if (payload['Total Amount']) payload.total_amount = Number(payload['Total Amount']);
        if (payload['Notes']) payload.notes = payload['Notes'];

        // Clean out any custom legacy non-column keys
        delete payload['Booking Id'];
        delete payload['Date'];
        delete payload['Guest Name'];
        delete payload['Email'];
        delete payload['Phone Number'];
        delete payload['Check In Date'];
        delete payload['Check Out Date'];
        delete payload['Guest Count'];
        delete payload['Guest Adults'];
        delete payload['Guest Children'];
        delete payload['Booking Type'];
        delete payload['Status'];
        delete payload['Total Amount'];
        delete payload['Payment ID'];
        delete payload['Confirmation Sent'];
        delete payload['Remainder Sent'];
        delete payload['Review Requested'];
        delete payload['Notes'];

        const { data, error } = await supabase
            .from('bookings')
            .update(payload)
            .eq('booking_id', bookingId)
            .select()
            .single();

        if (error) {
            console.error(`Error updating booking ${bookingId}:`, error);
            throw error;
        }

        return data;
    } catch (err) {
        console.error('Exception updating booking:', err);
        throw err;
    }
}

/**
 * Find booking by booking_id
 */
async function getBookingById(bookingId) {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('booking_id', bookingId)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error(`Error fetching booking ${bookingId}:`, err);
        return null;
    }
}

// ─── Calendar Rules (Prices & Blocks) ──────────────────────────

/**
 * Fetch all calendar rules (prices and block states)
 */
async function getCalendarRules() {
    try {
        const { data, error } = await supabase
            .from('calendar_rules')
            .select('*')
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching calendar rules from Supabase:', error);
            return [];
        }

        return (data || []).map(r => ({
            date: toDateStr(r.date),
            price: r.price != null ? Number(r.price) : null,
            status: r.status || 'available',
            room_type: r.room_type || 'full'
        }));
    } catch (err) {
        console.error('Exception fetching calendar rules:', err);
        return [];
    }
}

/**
 * Upsert calendar rules into Supabase (updates existing dates or inserts new ones)
 */
async function updateCalendarRules(rules) {
    if (!Array.isArray(rules) || rules.length === 0) return true;

    try {
        const payload = rules.map(r => ({
            date: toDateStr(r.date),
            price: r.price != null && r.price !== '' ? Number(r.price) : null,
            status: r.status || 'available',
            room_type: r.room_type || 'full',
            updated_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
            .from('calendar_rules')
            .upsert(payload, { onConflict: 'date' });

        if (error) {
            console.error('Error updating calendar rules in Supabase:', error);
            throw error;
        }

        return true;
    } catch (err) {
        console.error('Exception updating calendar rules:', err);
        throw err;
    }
}

// ─── Reviews ────────────────────────────────────────────────────

/**
 * Add a review
 */
async function addReview(reviewData) {
    try {
        const { data, error } = await supabase
            .from('reviews')
            .insert([{
                booking_id: reviewData.bookingId || reviewData.booking_id || null,
                experience: reviewData.experience,
                rating: reviewData.rating ? Number(reviewData.rating) : null,
                source: reviewData.source || 'website',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Exception adding review:', err);
        throw err;
    }
}

/**
 * Get all reviews
 */
async function getReviews() {
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Exception fetching reviews:', err);
        return [];
    }
}

module.exports = {
    supabase,
    getBookings,
    getAllBookings,
    addBooking,
    updateBooking,
    getBookingById,
    getCalendarRules,
    updateCalendarRules,
    addReview,
    getReviews
};
