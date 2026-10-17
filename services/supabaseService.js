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
            message: 'Successfully connected to Supabase and verified database tables.'
        };
    } catch (err) {
        return {
            connected: false,
            message: `Connection error: ${err.message}`
        };
    }
}

// ─── Helpers & Normalization ─────────────────────────────────────

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

// Normalize booking status to match check constraint:
// enquiry / cold / booked / visited / completed / cancelled
function normalizeStatus(st) {
    if (!st) return 'enquiry';
    const s = String(st).trim().toLowerCase();
    if (s === 'confirmed' || s === 'booked') return 'booked';
    if (s === 'enquiry' || s === 'enquery' || s === 'pending') return 'enquiry';
    if (s === 'cold') return 'cold';
    if (s === 'visited') return 'visited';
    if (s === 'completed') return 'completed';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    return 'enquiry';
}

// Normalize booking type to match check constraint:
// full_villa / half_villa
function normalizeBookingType(bt, rt) {
    const combined = `${bt || ''} ${rt || ''}`.toLowerCase();
    if (combined.includes('half') || combined.includes('partial') || combined.includes('remaining')) {
        return 'half_villa';
    }
    return 'full_villa';
}

// Normalize source to match check constraint:
// whatsapp / instagram / facebook / website / form
function normalizeSource(src) {
    if (!src) return 'website';
    const s = String(src).trim().toLowerCase();
    if (s.includes('whats')) return 'whatsapp';
    if (s.includes('insta')) return 'instagram';
    if (s.includes('face') || s === 'fb') return 'facebook';
    if (s.includes('form')) return 'form';
    return 'website';
}

// Normalize reminder sent constraint: 7d / 3d / 2d / 1d / checkin_day or null
function normalizeReminderSent(val) {
    if (!val) return null;
    const v = String(val).trim().toLowerCase();
    const valid = ['7d', '3d', '2d', '1d', 'checkin_day'];
    return valid.includes(v) ? v : null;
}

// Normalize review requested constraint: 0 to 3
function normalizeReviewRequested(val) {
    const num = parseInt(val, 10);
    if (isNaN(num)) return 0;
    return Math.max(0, Math.min(3, num));
}

// Format a database row into a rich object providing both snake_case and Title Case properties
function formatBookingOutput(row) {
    if (!row) return null;
    const isBooked = row.status === 'booked';
    const displayStatus = isBooked ? 'confirmed' : row.status;
    const roomType = row.booking_type === 'half_villa' ? 'partial' : 'full';
    const displayBookingType = row.booking_type === 'half_villa' ? 'half villa' : 'full villa';

    return {
        id: row.booking_id || row.id,
        db_id: row.id,
        booking_id: row.booking_id,
        date: toDateStr(row.created_at),
        guest_name: row.guest_name,
        email: row.email,
        phone: row.phone_number,
        phone_number: row.phone_number,
        check_in_date: toDateStr(row.check_in_date),
        check_out_date: toDateStr(row.check_out_date),
        guest_count: row.guest_count,
        guests_count: row.guest_count,
        adults: row.guest_adults,
        guest_adults: row.guest_adults,
        children: row.guest_children,
        guest_children: row.guest_children,
        booking_type: displayBookingType,
        room_type: roomType,
        status: displayStatus,
        db_status: row.status,
        total_amount: row.total_amount != null ? Number(row.total_amount) : 0,
        payment_id: row.payment_id,
        calendar_id: row.calendar_id,
        source: row.source || 'website',
        confirmation_sent: row.confirmation_sent ? 'yes' : 'no',
        reminder_sent: row.reminder_sent,
        review_requested: row.review_requested != null ? row.review_requested : 0,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,

        // Legacy Title Case object properties for client/admin views
        'Booking Id': row.booking_id || '',
        'Date': toDateStr(row.created_at) || '',
        'Guest Name': row.guest_name || '',
        'Email': row.email || '',
        'Phone Number': row.phone_number || '',
        'Check In Date': toDateStr(row.check_in_date) || '',
        'Check Out Date': toDateStr(row.check_out_date) || '',
        'Guest Count': row.guest_count != null ? row.guest_count : '',
        'Guest Adults': row.guest_adults != null ? row.guest_adults : '',
        'Guest Children': row.guest_children != null ? row.guest_children : '',
        'Booking Type': displayBookingType,
        'Status': displayStatus,
        'Total Amount': row.total_amount != null ? row.total_amount : '',
        'Payment ID': row.payment_id || '',
        'source': row.source || 'website',
        'Confirmation Sent': row.confirmation_sent ? 'yes' : 'no',
        'Remainder Sent': row.reminder_sent || '',
        'Review Requested': row.review_requested != null ? row.review_requested : 0,
        'Notes': row.notes || ''
    };
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
            .in('status', ['booked', 'confirmed'])
            .order('check_in_date', { ascending: true });

        if (error) {
            console.error('Error fetching bookings from Supabase:', error);
            return [];
        }

        return (data || []).map(formatBookingOutput);
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

        return (data || []).map(formatBookingOutput);
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
        const bookingId = booking.booking_id || booking['Booking Id'] || generateBookingId();
        const checkIn = toDateStr(booking.check_in_date || booking['Check In Date']);
        const checkOut = toDateStr(booking.check_out_date || booking['Check Out Date']);
        const adults = Number(booking.guest_adults != null ? booking.guest_adults : (booking.adults != null ? booking.adults : (booking['Guest Adults'] != null ? booking['Guest Adults'] : 1))) || 1;
        const children = Number(booking.guest_children != null ? booking.guest_children : (booking.children != null ? booking.children : (booking['Guest Children'] != null ? booking['Guest Children'] : 0))) || 0;
        const guestsCount = Number(booking.guest_count != null ? booking.guest_count : (booking.guests_count != null ? booking.guests_count : (booking['Guest Count'] != null ? booking['Guest Count'] : (adults + children)))) || (adults + children);

        const status = normalizeStatus(booking.status || booking['Status'] || 'enquiry');
        const bookingType = normalizeBookingType(booking.booking_type || booking['Booking Type'], booking.room_type);
        const source = normalizeSource(booking.source || booking['source']);
        const isConfirmed = status === 'booked';
        const confirmationSent = booking.confirmation_sent != null ? Boolean(booking.confirmation_sent === true || booking.confirmation_sent === 'yes' || booking.confirmation_sent === 'true') : isConfirmed;
        const reminderSent = normalizeReminderSent(booking.reminder_sent || booking['Remainder Sent']);
        const reviewRequested = normalizeReviewRequested(booking.review_requested || booking['Review Requested']);

        const payload = {
            booking_id: bookingId,
            booking_type: bookingType,
            guest_name: booking.guest_name || booking['Guest Name'] || '',
            phone_number: booking.phone_number || booking.phone || booking['Phone Number'] || null,
            email: booking.email || booking['Email'] || null,
            check_in_date: checkIn,
            check_out_date: checkOut,
            guest_adults: adults,
            guest_children: children,
            guest_count: guestsCount,
            total_amount: booking.total_amount != null ? Number(booking.total_amount) : (booking['Total Amount'] != null ? Number(booking['Total Amount']) : 0),
            payment_id: booking.payment_id || booking['Payment ID'] || null,
            calendar_id: booking.calendar_id || null,
            status: status,
            source: source,
            confirmation_sent: confirmationSent,
            reminder_sent: reminderSent,
            review_requested: reviewRequested,
            notes: booking.notes || booking['Notes'] || null,
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

        return formatBookingOutput(data);
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
        const payload = { updated_at: new Date().toISOString() };

        if (updates.guest_name !== undefined || updates['Guest Name'] !== undefined) {
            payload.guest_name = updates.guest_name || updates['Guest Name'];
        }
        if (updates.email !== undefined || updates['Email'] !== undefined) {
            payload.email = updates.email || updates['Email'];
        }
        if (updates.phone !== undefined || updates.phone_number !== undefined || updates['Phone Number'] !== undefined) {
            payload.phone_number = updates.phone_number || updates.phone || updates['Phone Number'];
        }
        if (updates.check_in_date !== undefined || updates['Check In Date'] !== undefined) {
            payload.check_in_date = toDateStr(updates.check_in_date || updates['Check In Date']);
        }
        if (updates.check_out_date !== undefined || updates['Check Out Date'] !== undefined) {
            payload.check_out_date = toDateStr(updates.check_out_date || updates['Check Out Date']);
        }
        if (updates.status !== undefined || updates['Status'] !== undefined) {
            payload.status = normalizeStatus(updates.status || updates['Status']);
        }
        if (updates.booking_type !== undefined || updates['Booking Type'] !== undefined || updates.room_type !== undefined) {
            payload.booking_type = normalizeBookingType(updates.booking_type || updates['Booking Type'], updates.room_type);
        }
        if (updates.adults !== undefined || updates.guest_adults !== undefined || updates['Guest Adults'] !== undefined) {
            payload.guest_adults = Number(updates.guest_adults || updates.adults || updates['Guest Adults']) || 1;
        }
        if (updates.children !== undefined || updates.guest_children !== undefined || updates['Guest Children'] !== undefined) {
            payload.guest_children = Number(updates.guest_children || updates.children || updates['Guest Children']) || 0;
        }
        if (updates.guest_count !== undefined || updates.guests_count !== undefined || updates['Guest Count'] !== undefined) {
            payload.guest_count = Number(updates.guest_count || updates.guests_count || updates['Guest Count']) || 1;
        }
        if (updates.total_amount !== undefined || updates['Total Amount'] !== undefined) {
            payload.total_amount = Number(updates.total_amount || updates['Total Amount']) || 0;
        }
        if (updates.payment_id !== undefined || updates['Payment ID'] !== undefined) {
            payload.payment_id = updates.payment_id || updates['Payment ID'] || null;
        }
        if (updates.calendar_id !== undefined) {
            payload.calendar_id = updates.calendar_id || null;
        }
        if (updates.source !== undefined || updates['source'] !== undefined) {
            payload.source = normalizeSource(updates.source || updates['source']);
        }
        if (updates.confirmation_sent !== undefined || updates['Confirmation Sent'] !== undefined) {
            const cs = updates.confirmation_sent !== undefined ? updates.confirmation_sent : updates['Confirmation Sent'];
            payload.confirmation_sent = Boolean(cs === true || cs === 'yes' || cs === 'true');
        }
        if (updates.reminder_sent !== undefined || updates['Remainder Sent'] !== undefined) {
            payload.reminder_sent = normalizeReminderSent(updates.reminder_sent || updates['Remainder Sent']);
        }
        if (updates.review_requested !== undefined || updates['Review Requested'] !== undefined) {
            payload.review_requested = normalizeReviewRequested(updates.review_requested || updates['Review Requested']);
        }
        if (updates.notes !== undefined || updates['Notes'] !== undefined) {
            payload.notes = updates.notes !== undefined ? updates.notes : updates['Notes'];
        }

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

        return formatBookingOutput(data);
    } catch (err) {
        console.error('Exception updating booking:', err);
        throw err;
    }
}

async function updateBookingStatus(bookingId, status) {
    return updateBooking(bookingId, { status });
}

/**
 * Delete a booking by booking_id and clean up calendar rules
 */
async function deleteBooking(bookingId) {
    if (!supabase || !bookingId) return false;
    const cleanId = String(bookingId).trim().toUpperCase();

    try {
        const existing = await getBookingById(cleanId);
        if (existing) {
            await unblockDatesForBooking(existing);
        }

        const { error } = await supabase
            .from('bookings')
            .delete()
            .eq('booking_id', cleanId);

        if (error) {
            console.error(`[Supabase] Error deleting booking ${cleanId}:`, error);
            throw error;
        }

        return true;
    } catch (err) {
        console.error('Exception deleting booking:', err);
        throw err;
    }
}

/**
 * Append an entry to notes preserving chronological history with bullet point and newline
 */
function appendNote(existingNotes, noteText) {
    if (!noteText) return existingNotes || '';
    const dateStr = new Date().toISOString().split('T')[0];
    const cleanNote = String(noteText).replace(/^[•\-\*]\s*/, '').trim();
    const newEntry = `• [${dateStr}] ${cleanNote}`;
    if (!existingNotes || !String(existingNotes).trim()) {
        return newEntry;
    }
    const cleanExisting = String(existingNotes).trim();
    return `${cleanExisting}\n${newEntry}`;
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
        return formatBookingOutput(data);
    } catch (err) {
        console.error(`Error fetching booking ${bookingId}:`, err);
        return null;
    }
}

// ─── Calendar Rules (Ranges & Blocks) ───────────────────────────

/**
 * Fetch calendar rules.
 * Expands range entries into daily objects for calendar UI availability checks,
 * while also attaching the root rule metadata.
 */
async function getCalendarRules() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('calendar_rules')
            .select('*')
            .order('start_date', { ascending: true });

        if (error) {
            console.error('Error fetching calendar rules from Supabase:', error);
            return [];
        }

        const expanded = [];
        (data || []).forEach(rule => {
            const start = new Date(rule.start_date);
            const end = new Date(rule.end_date);
            const roomType = rule.unit === 'half_villa' ? 'partial' : 'full';
            const rulePrice = rule.price != null && rule.price !== '' ? Number(rule.price) : null;

            if (rule.start_date === rule.end_date) {
                expanded.push({
                    id: rule.id,
                    rule_id: rule.id,
                    booking_id: rule.booking_id,
                    date: rule.start_date,
                    start_date: rule.start_date,
                    end_date: rule.end_date,
                    price: rulePrice,
                    status: rule.rule_type,
                    rule_type: rule.rule_type,
                    unit: rule.unit,
                    room_type: roomType,
                    reason: rule.reason,
                    created_at: rule.created_at,
                    updated_at: rule.updated_at
                });
                return;
            }

            const curr = new Date(start);
            while (curr < end) {
                const dateStr = curr.toISOString().split('T')[0];
                expanded.push({
                    id: `${rule.id}_${dateStr}`,
                    rule_id: rule.id,
                    booking_id: rule.booking_id,
                    date: dateStr,
                    start_date: rule.start_date,
                    end_date: rule.end_date,
                    price: rulePrice,
                    status: rule.rule_type,
                    rule_type: rule.rule_type,
                    unit: rule.unit,
                    room_type: roomType,
                    reason: rule.reason,
                    created_at: rule.created_at,
                    updated_at: rule.updated_at
                });
                curr.setDate(curr.getDate() + 1);
            }
        });

        return expanded;
    } catch (err) {
        console.error('Exception fetching calendar rules:', err);
        return [];
    }
}

/**
 * Delete a calendar rule by UUID or Date
 */
async function deleteCalendarRule(idOrDate) {
    if (!supabase) return false;
    try {
        const str = String(idOrDate).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        
        if (isUuid) {
            const { error } = await supabase.from('calendar_rules').delete().eq('id', str);
            if (error) throw error;
            return true;
        }

        if (str.includes('_')) {
            const baseId = str.split('_')[0];
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseId)) {
                const { error } = await supabase.from('calendar_rules').delete().eq('id', baseId);
                if (error) throw error;
                return true;
            }
        }

        const date = toDateStr(str);
        if (date) {
            const { error } = await supabase
                .from('calendar_rules')
                .delete()
                .lte('start_date', date)
                .gte('end_date', date);
            if (error) throw error;
            return true;
        }

        return false;
    } catch (err) {
        console.error('Exception deleting calendar rule:', err);
        throw err;
    }
}

/**
 * Upsert calendar rules into calendar_rules table
 */
async function updateCalendarRules(rules) {
    if (!supabase) return true;
    if (!Array.isArray(rules) || rules.length === 0) return true;

    try {
        for (const r of rules) {
            const startDate = toDateStr(r.start_date || r.date);
            const endDate = toDateStr(r.end_date || r.date);
            if (!startDate) continue;

            const rawStatus = String(r.rule_type || r.status || 'available').toLowerCase();
            const ruleType = rawStatus === 'booked' ? 'booked' : rawStatus === 'blocked' ? 'blocked' : 'available';
            const unit = String(r.unit || r.room_type || '').toLowerCase().includes('half') ? 'half_villa' : 'full_villa';
            const rulePrice = r.price !== '' && r.price != null ? Number(r.price) : null;
            const reason = r.reason || (ruleType === 'blocked' ? 'Blocked by administrator' : ruleType === 'booked' ? 'Booking block' : 'Custom price rule');
            const bookingId = r.booking_id || null;

            // Check if rule already exists for this exact range and unit
            const { data: existingList } = await supabase
                .from('calendar_rules')
                .select('id')
                .eq('start_date', startDate)
                .eq('end_date', endDate)
                .eq('unit', unit)
                .limit(1);

            const existing = existingList && existingList.length > 0 ? existingList[0] : null;

            if (existing && existing.id) {
                await supabase.from('calendar_rules').update({
                    rule_type: ruleType,
                    price: rulePrice,
                    reason: reason,
                    booking_id: bookingId,
                    updated_at: new Date().toISOString()
                }).eq('id', existing.id);
            } else {
                await supabase.from('calendar_rules').insert([{
                    start_date: startDate,
                    end_date: endDate,
                    rule_type: ruleType,
                    price: rulePrice,
                    unit: unit,
                    reason: reason,
                    booking_id: bookingId
                }]);
            }
        }

        return true;
    } catch (err) {
        console.error('Exception updating calendar rules:', err);
        throw err;
    }
}

/**
 * Block dates for a booking in calendar_rules
 */
async function blockDatesForBooking(booking) {
    if (!supabase || !booking) return;
    const checkIn = toDateStr(booking.check_in_date || booking['Check In Date']);
    const checkOut = toDateStr(booking.check_out_date || booking['Check Out Date']);
    const bookingId = booking.booking_id || booking['Booking Id'];
    if (!checkIn || !checkOut) return;

    try {
        const unit = normalizeBookingType(booking.booking_type, booking.room_type);
        const reason = `Booking ${bookingId || ''}: ${booking.guest_name || booking['Guest Name'] || ''}`.trim();

        // Check if rule already exists for this booking_id
        let existingId = null;
        if (bookingId) {
            const { data } = await supabase
                .from('calendar_rules')
                .select('id')
                .eq('booking_id', bookingId)
                .maybeSingle();
            if (data) existingId = data.id;
        }

        const payload = {
            booking_id: bookingId || null,
            start_date: checkIn,
            end_date: checkOut,
            rule_type: 'booked',
            unit: unit,
            reason: reason,
            updated_at: new Date().toISOString()
        };

        if (existingId) {
            await supabase.from('calendar_rules').update(payload).eq('id', existingId);
        } else {
            await supabase.from('calendar_rules').insert([payload]);
        }
    } catch (error) {
        console.error('Error blocking dates for booking in calendar_rules:', error);
    }
}

/**
 * Unblock dates for a booking in calendar_rules
 */
async function unblockDatesForBooking(booking) {
    if (!supabase || !booking) return;
    const bookingId = booking.booking_id || booking['Booking Id'];
    const checkIn = toDateStr(booking.check_in_date || booking['Check In Date']);
    const checkOut = toDateStr(booking.check_out_date || booking['Check Out Date']);

    try {
        let query = supabase.from('calendar_rules').delete();
        if (bookingId) {
            await query.eq('booking_id', bookingId);
        } else if (checkIn && checkOut) {
            await query.eq('start_date', checkIn).eq('end_date', checkOut).eq('rule_type', 'booked');
        }
    } catch (error) {
        console.error('Error unblocking dates for booking:', error);
    }
}

// ─── Reviews ────────────────────────────────────────────────────

/**
 * Add a review matching reviews table schema
 */
async function addReview(reviewData) {
    if (!supabase) throw new Error("Supabase not initialized");
    try {
        const starRating = Math.max(1, Math.min(5, Math.round(Number(reviewData.star_rating || reviewData.rating || 5))));
        const payload = {
            booking_id: reviewData.booking_id || reviewData.bookingId || null,
            reviewer_name: reviewData.reviewer_name || reviewData.name || reviewData.guest_name || 'Guest',
            star_rating: starRating,
            review_text: reviewData.review_text || reviewData.experience || reviewData.review || '',
            review_date: toDateStr(reviewData.review_date || new Date()),
            alert_sent: Boolean(reviewData.alert_sent || false)
        };

        const { data, error } = await supabase
            .from('reviews')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        return {
            ...data,
            name: data.reviewer_name,
            rating: data.star_rating,
            experience: data.review_text
        };
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

        return (data || []).map(r => ({
            id: r.id,
            booking_id: r.booking_id,
            reviewer_name: r.reviewer_name,
            name: r.reviewer_name,
            star_rating: r.star_rating,
            rating: r.star_rating,
            review_text: r.review_text,
            experience: r.review_text,
            review_date: r.review_date,
            alert_sent: r.alert_sent,
            created_at: r.created_at,
            updated_at: r.updated_at
        }));
    } catch (err) {
        console.error('Exception fetching reviews:', err);
        return [];
    }
}

// ─── Application & User Logging ─────────────────────────────────

/**
 * Log application events to app_logs table
 */
async function logApp(level, category, action, message, details = null) {
    if (!supabase) return;
    try {
        const validLevels = ['info', 'warn', 'error', 'debug'];
        const lvl = validLevels.includes(String(level || '').toLowerCase()) ? String(level).toLowerCase() : 'info';
        await supabase.from('app_logs').insert([{
            level: lvl,
            category: category || 'general',
            action: action || null,
            message: String(message || ''),
            details: details || null,
            source: 'server'
        }]);
    } catch (err) {
        console.error('[Supabase Logger] Failed to write app log:', err.message);
    }
}

/**
 * Log application errors to app_error_logs table (separate from n8n error_logs)
 */
async function logAppError({ endpoint, method, error, req, requestBody = null }) {
    if (!supabase) return;
    try {
        const ip = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || null;
        const userAgent = req?.headers?.['user-agent'] || null;
        const reqBody = requestBody || req?.body || null;

        await supabase.from('app_error_logs').insert([{
            endpoint: endpoint || req?.originalUrl || req?.url || null,
            method: method || req?.method || null,
            error_name: error?.name || 'Error',
            error_message: error?.message || String(error || 'Unknown error'),
            stack_trace: error?.stack || null,
            request_body: reqBody ? (typeof reqBody === 'object' ? reqBody : { raw: reqBody }) : null,
            ip_address: ip,
            user_agent: userAgent
        }]);
    } catch (err) {
        console.error('[Supabase Logger] Failed to write app error log:', err.message);
    }
}

/**
 * Log user activity to user_logs table
 */
async function logUser({ action, userIdentifier, userType = 'guest', req, metadata = null }) {
    if (!supabase) return;
    try {
        const validUserTypes = ['guest', 'admin', 'customer', 'anonymous'];
        const uType = validUserTypes.includes(String(userType || '').toLowerCase()) ? String(userType).toLowerCase() : 'guest';
        const ip = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || null;
        const userAgent = req?.headers?.['user-agent'] || null;

        await supabase.from('user_logs').insert([{
            user_type: uType,
            user_identifier: userIdentifier ? String(userIdentifier) : null,
            action: action || 'activity',
            ip_address: ip,
            user_agent: userAgent,
            metadata: metadata || null
        }]);
    } catch (err) {
        console.error('[Supabase Logger] Failed to write user log:', err.message);
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
    deleteBooking,
    getBookingById,
    getCalendarRules,
    updateCalendarRules,
    deleteCalendarRule,
    blockDatesForBooking,
    unblockDatesForBooking,
    addReview,
    getReviews,
    appendNote,
    logApp,
    logAppError,
    logUser,
    normalizeStatus,
    normalizeBookingType,
    normalizeSource
};
