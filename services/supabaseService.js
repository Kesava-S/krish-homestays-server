const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

const isConfigured = SUPABASE_URL && 
    SUPABASE_KEY && 
    !SUPABASE_URL.includes('your-project-id') &&
    SUPABASE_URL.startsWith('http');

let supabase = null;

if (isConfigured) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });
        console.log(`[Supabase] Initialized client for ${SUPABASE_URL}`);
    } catch (err) {
        console.error("[Supabase] Failed to initialize client:", err.message);
    }
} else if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[Supabase] Missing SUPABASE_URL or SUPABASE_KEY in .env. Database queries will return empty results until configured.");
} else {
    console.warn("[Supabase] SUPABASE_URL contains placeholder values. Please update server/.env with your real Supabase credentials.");
}

async function testConnection() {
    if (!supabase) {
        return {
            connected: false,
            configured: Boolean(isConfigured),
            message: 'Supabase client is not initialized. Please verify SUPABASE_URL and SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY in server/.env.'
        };
    }
    try {
        const { data, error } = await supabase.from('bookings').select('id').limit(1);
        if (error) {
            if (error.code === '42P01') {
                return {
                    connected: true,
                    tablesFound: false,
                    message: 'Connected to Supabase, but the "bookings" table was not found. Please run server/supabase_schema.sql in the Supabase SQL editor.'
                };
            }
            return {
                connected: false,
                message: `Supabase query error: ${error.message} (code: ${error.code})`
            };
        }
        return {
            connected: true,
            tablesFound: true,
            message: 'Successfully connected to Supabase and verified "bookings" table.'
        };
    } catch (err) {
        return {
            connected: false,
            message: `Connection error: ${err.message}`
        };
    }
}

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
    if (!supabase) return [];
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
            id: b.booking_id || b.id,
            booking_id: b.booking_id,
            date: toDateStr(b.date || b.created_at),
            guest_name: b.guest_name,
            email: b.email,
            phone: b.phone,
            check_in_date: toDateStr(b.check_in_date),
            check_out_date: toDateStr(b.check_out_date),
            guests_count: b.guests_count,
            adults: b.adults,
            children: b.children,
            booking_type: b.booking_type || 'full villa',
            room_type: b.room_type || 'full',
            status: b.status,
            total_amount: b.total_amount,
            payment_id: b.payment_id,
            source: b.source || 'website',
        }));
    } catch (err) {
        console.error('Exception fetching bookings:', err);
        return [];
    }
}

/**
 * Get all bookings (including pending/enquiry/cancelled) for admin dashboard
 */
async function getAllBookings() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all bookings from Supabase:', error);
            return [];
        }

        return (data || []).map(row => {
            return {
                'Booking Id': row.booking_id || row.id || '',
                'Date': toDateStr(row.date || row.created_at) || '',
                'Guest Name': row.guest_name || '',
                'Email': row.email || '',
                'Phone Number': row.phone || '',
                'Check In Date': toDateStr(row.check_in_date) || '',
                'Check Out Date': toDateStr(row.check_out_date) || '',
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
    if (!supabase) throw new Error("Supabase not initialized");
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
            status: booking.status || 'Enquery',
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
    if (!supabase) throw new Error("Supabase not initialized");
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

async function updateBookingStatus(bookingId, status) {
    return updateBooking(bookingId, { status });
}

/**
 * Find booking by booking_id
 */
async function getBookingById(bookingId) {
    if (!supabase) return null;
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
    if (!supabase) return [];
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
    if (!supabase) return true;
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

async function blockDatesForBooking(booking) {
    if (!supabase || !booking || !booking.check_in_date || !booking.check_out_date) return;
    try {
        const rules = [];
        let currentDate = new Date(booking.check_in_date);
        const endDate = new Date(booking.check_out_date);
        
        while (currentDate < endDate) {
            rules.push({
                date: currentDate.toISOString().split('T')[0],
                status: 'booked',
                room_type: booking.room_type || 'full villa'
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        if (rules.length > 0) {
            await updateCalendarRules(rules);
        }
    } catch (error) {
        console.error('Error blocking dates for booking:', error);
    }
}

async function unblockDatesForBooking(booking) {
    if (!supabase || !booking || !booking.check_in_date || !booking.check_out_date) return;
    try {
        let currentDate = new Date(booking.check_in_date);
        const endDate = new Date(booking.check_out_date);
        const datesToDelete = [];
        
        while (currentDate < endDate) {
            datesToDelete.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        if (datesToDelete.length > 0) {
            await supabase
                .from('calendar_rules')
                .delete()
                .in('date', datesToDelete)
                .is('price', null); // Only remove auto-generated blocks, preserve custom prices
        }
    } catch (error) {
        console.error('Error unblocking dates for booking:', error);
    }
}

// ─── Reviews ────────────────────────────────────────────────────

/**
 * Add a review
 */
async function addReview(reviewData) {
    if (!supabase) throw new Error("Supabase not initialized");
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
    if (!supabase) return [];
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
    testConnection,
    getBookings,
    getAllBookings,
    addBooking,
    updateBooking,
    updateBookingStatus,
    getBookingById,
    getCalendarRules,
    updateCalendarRules,
    blockDatesForBooking,
    unblockDatesForBooking,
    addReview,
    getReviews
};
