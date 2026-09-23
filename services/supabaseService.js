const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL or SUPABASE_KEY is missing in .env");
}

// We'll initialize even if keys are missing to prevent crash, but queries will fail
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// --- Bookings ---

async function getBookings() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*');

        if (error) throw error;
        
        return data.map(b => ({
            id: b.id || b.booking_id,
            booking_id: b.booking_id,
            date: b.date || b.created_at,
            guest_name: b.guest_name,
            email: b.email,
            phone: b.phone,
            check_in_date: b.check_in_date,
            check_out_date: b.check_out_date,
            guests_count: b.guests_count,
            adults: b.adults,
            children: b.children,
            booking_type: b.booking_type,
            status: b.status,
            total_amount: b.total_amount,
            payment_id: b.payment_id,
            source: b.source,
        }));
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return [];
    }
}

async function addBooking(booking) {
    if (!supabase) throw new Error("Supabase not initialized");
    try {
        const newBooking = {
            booking_id: booking.booking_id,
            date: new Date().toISOString().slice(0, 10),
            guest_name: booking.guest_name,
            email: booking.email,
            phone: booking.phone,
            check_in_date: booking.check_in_date,
            check_out_date: booking.check_out_date,
            guests_count: booking.guests_count || 0,
            adults: booking.adults || 0,
            children: booking.children || 0,
            status: booking.status || 'confirmed',
            total_amount: booking.total_amount,
            payment_id: booking.payment_id || null,
            source: booking.source || 'website',
            booking_type: booking.booking_type || null,
            room_type: booking.room_type || null,
        };

        const { data, error } = await supabase
            .from('bookings')
            .insert([newBooking])
            .select();

        if (error) throw error;

        return data[0];
    } catch (error) {
        console.error('Error adding booking:', error);
        throw error;
    }
}

async function getAllBookings() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*');

        if (error) throw error;

        return data.map(b => ({
            'Booking Id': b.booking_id || b.id || '',
            'Date': b.date || b.created_at || '',
            'Guest Name': b.guest_name || '',
            'Email': b.email || '',
            'Phone Number': b.phone || '',
            'Check In Date': b.check_in_date || '',
            'Check Out Date': b.check_out_date || '',
            'Guest Count': b.guests_count || '',
            'Guest Adults': b.adults || '',
            'Guest Children': b.children || '',
            'Booking Type': b.booking_type || '',
            'Status': b.status || '',
            'Total Amount': b.total_amount || '',
            'Payment ID': b.payment_id || '',
            'source': b.source || '',
            'Confirmation Sent': b.confirmation_sent || '',
            'Remainder Sent': b.remainder_sent || '',
            'Review Requested': b.review_requested || '',
            'Notes': b.notes || '',
        }));
    } catch (error) {
        console.error('Error fetching all bookings:', error);
        return [];
    }
}

async function getBookingById(booking_id) {
    if (!supabase) throw new Error("Supabase not initialized");
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('booking_id', booking_id)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows returned
        
        if (!data) return null;
        
        // Map back to the fields the client expects (from N8N)
        return {
            'Booking Id': data.booking_id,
            'Guest Name': data.guest_name,
            'Email': data.email,
            'Phone Number': data.phone,
            'Guest Adults': data.adults,
            'Guest Children': data.children,
            'Booking Type': data.booking_type,
            'Check In Date': data.check_in_date,
            'Check Out Date': data.check_out_date,
            'Status': data.status,
            'Total Amount': data.total_amount
        };
    } catch (error) {
        console.error('Error fetching booking by ID:', error);
        return null;
    }
}

async function updateBookingStatus(booking_id, status) {
    if (!supabase) throw new Error("Supabase not initialized");
    try {
        const { data, error } = await supabase
            .from('bookings')
            .update({ status })
            .eq('booking_id', booking_id)
            .select();
            
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error updating booking status:', error);
        throw error;
    }
}

async function updateBooking(booking_id, updates) {
    if (!supabase) throw new Error("Supabase not initialized");
    try {
        const { data, error } = await supabase
            .from('bookings')
            .update(updates)
            .eq('booking_id', booking_id)
            .select();
            
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error updating booking:', error);
        throw error;
    }
}

// --- Calendar Rules (Prices & Blocks) ---

async function getCalendarRules() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('calendar_rules')
            .select('*');

        if (error) throw error;
        return data;
    } catch (error) {
        console.warn('Error fetching calendar rules:', error.message);
        return [];
    }
}

async function updateCalendarRules(rules) {
    if (!supabase) throw new Error("Supabase not initialized");
    // rules is an array of { date, price, status }
    try {
        const { error } = await supabase
            .from('calendar_rules')
            .upsert(rules, { onConflict: 'date' }); 

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating calendar rules:', error);
        throw error;
    }
}

async function blockDatesForBooking(booking) {
    if (!booking || !booking.check_in_date || !booking.check_out_date) return;
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

// --- Reviews ---

async function addReview(reviewData) {
    if (!supabase) throw new Error("Supabase not initialized");
    try {
        const { data, error } = await supabase
            .from('reviews')
            .insert([reviewData])
            .select();

        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error adding review:', error);
        throw error;
    }
}

module.exports = { 
    getBookings, 
    getAllBookings, 
    addBooking, 
    getBookingById,
    updateBookingStatus,
    updateBooking,
    getCalendarRules, 
    updateCalendarRules,
    blockDatesForBooking,
    addReview
};
