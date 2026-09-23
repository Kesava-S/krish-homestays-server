const express = require('express');
const router = express.Router();
const { getBookings, getAllBookings, addBooking, getCalendarRules, updateCalendarRules, getBookingById, updateBookingStatus, updateBooking, blockDatesForBooking, addReview } = require('../services/supabaseService');
const { createCalendarEvent } = require('../services/calendarService');
const { sendConfirmationEmail, sendReceiptEmail } = require('../services/emailService');
const { createPaymentIntent } = require('../services/paymentService');

const { fetchAirbnbBookings } = require('../services/fetchAirbnbBookings');
const { fetchMMTBookings } = require('../services/fetchMMTBookings');

// Admin Login
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, token: 'admin-session-token' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Get Calendar Data (Bookings + Rules)
// router.get('/calendar-data', async (req, res) => {
//   try {
//     const [bookings, rules] = await Promise.all([getBookings(), getCalendarRules()]);

//     // Process Bookings
//     const bookedDates = bookings
//       .filter(b => b.status === 'booked')
//       .map(b => ({
//         start: b.check_in_date,
//         end: b.check_out_date,
//         type: 'booked'
//       }));

//     // Process Rules (Price & Blocks)
//     const ruleData = rules.reduce((acc, rule) => {
//       acc[rule.date] = {
//         price: rule.price,
//         status: rule.status
//       };
//       return acc;
//     }, {});

//     res.json({ bookedRanges: bookedDates, rules: ruleData });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

router.get('/calendar-data', async (req, res) => {
  try {
    const [bookings, rules, airbnb, mmt] = await Promise.all([
      getBookings(),
      getCalendarRules(),
      fetchAirbnbBookings().catch(() => []),
      fetchMMTBookings().catch(() => []),
    ]);

    const websiteBookings = bookings
      .filter(b => b.status === 'booked' || b.status === 'confirmed')
      .map(b => ({
        start: b.check_in_date,
        end: b.check_out_date,
        guests_count: b.guests_count,
        booking_type: b.booking_type,
        type: 'website'
      }));

    const allBookedDates = [
      ...websiteBookings,
      ...airbnb,
      ...mmt,
    ];

    const ruleData = rules.reduce((acc, rule) => {
      acc[rule.date] = {
        price: rule.price,
        status: rule.status
      };
      return acc;
    }, {});

    res.json({
      bookedRanges: allBookedDates,
      rules: ruleData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Website iCal feed — give this URL to MMT / any OTA to import website bookings
router.get('/calendar.ics', async (req, res) => {
  try {
    const [bookings, rules] = await Promise.all([getBookings(), getCalendarRules()]);

    const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

    const toICalDate = (dateStr) => String(dateStr).split('T')[0].replace(/-/g, '');

    const events = [];

    // Confirmed website bookings
    for (const b of bookings) {
      if (b.status !== 'booked' && b.status !== 'confirmed') continue;
      const uid = `${b.id || b.date}-website@krishhomestays.com`;
      events.push([
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${toICalDate(b.check_in_date)}`,
        `DTEND;VALUE=DATE:${toICalDate(b.check_out_date)}`,
        `SUMMARY:Booked`,
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        'END:VEVENT',
      ].join('\r\n'));
    }

    // Admin-blocked dates from calendar rules
    for (const rule of rules) {
      if (rule.status !== 'blocked' && rule.status !== 'booked') continue;
      const uid = `rule-${rule.date}@krishhomestays.com`;
      const next = new Date(rule.date);
      next.setDate(next.getDate() + 1);
      const endDate = next.toISOString().split('T')[0].replace(/-/g, '');
      events.push([
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${toICalDate(rule.date)}`,
        `DTEND;VALUE=DATE:${endDate}`,
        `SUMMARY:Not Available`,
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        'END:VEVENT',
      ].join('\r\n'));
    }

    const icsBody = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Krish Homestays//Website Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Krish Homestays',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="krish-homestays.ics"');
    res.send(icsBody);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating calendar');
  }
});

// Get all bookings (Admin)
router.get('/admin/bookings', async (req, res) => {
  try {
    const bookings = await getAllBookings();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Calendar Rules (Admin)
router.post('/admin/rules', async (req, res) => {
  try {
    const { rules } = req.body; // Array of { date, price, status }
    await updateCalendarRules(rules);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Payment Intent
router.post('/create-payment-intent', async (req, res) => {
  const { amount } = req.body;
  try {
    const order = await createPaymentIntent(amount);
    res.json({ success: true, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/verify-payment", (req, res) => {
  const crypto = require("crypto");

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body;

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generatedSignature === razorpay_signature) {
    return res.json({
      success: true,
      message: "Payment verified"
    });
  } else {
    return res.status(400).json({
      success: false,
      message: "Invalid signature"
    });
  }
});


// Create booking
router.post('/bookings', async (req, res) => {
  const { guest_name, email, phone, check_in_date, check_out_date, guests_count, adults, children, room_type, total_amount } = req.body;

  if (!guest_name || !email || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const bookings = await getBookings();
    const rules = await getCalendarRules(); // Check for blocked dates too

    // Check overlap with bookings
    const newStart = new Date(check_in_date);
    const newEnd = new Date(check_out_date);

    const hasBookingOverlap = bookings.some(booking => {
      if (booking.status !== 'confirmed') return false;
      const start = new Date(booking.check_in_date);
      const end = new Date(booking.check_out_date);
      return (newStart < end && newEnd > start);
    });

    // Check overlap with blocked dates
    // We iterate through each day of the requested stay
    let currentDate = new Date(newStart);
    let hasBlockOverlap = false;
    while (currentDate < newEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const rule = rules.find(r => r.date === dateStr);
      if (rule && (rule.status === 'blocked' || rule.status === 'booked')) {
        hasBlockOverlap = true;
        break;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (hasBookingOverlap || hasBlockOverlap) {
      return res.status(409).json({ error: 'Dates not available' });
    }

    // Add to Google Sheet
    const newBooking = {
      guest_name,
      email,
      phone,
      check_in_date,
      check_out_date,
      guests_count,
      adults,
      children,
      room_type,
      total_amount
    };

    const savedBooking = await addBooking(newBooking);

    // Sync to calendar_rules
    if (savedBooking && savedBooking.status === 'confirmed') {
        await blockDatesForBooking(savedBooking);
    }

    // Send Email
    // await sendConfirmationEmail(savedBooking);

    // Create Calendar Event
    // await createCalendarEvent(savedBooking);

    res.status(201).json(savedBooking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


const path = require('path');
const { generateReceiptPDF } = require('../services/pdfService');
router.use('/receipts', express.static(path.join(__dirname, 'receipts')));

router.post('/generate-receipt', async (req, res) => {
  try {
    const { booking, payment } = req.body;

    const pdfBuffer = await generateReceiptPDF(booking, payment || {});

    res.json({
      success: true,
      booking_id: booking.booking_id,
      fileName: `receipt_${booking.booking_id}.pdf`,
      pdfBase64: pdfBuffer.toString('base64')
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

router.post('/send-receipt', async (req, res) => {
  try {
    const { booking, payment } = req.body;

    // ✅ Send both emails in parallel
    // await Promise.all([
    // sendConfirmationEmail(booking),
    await sendReceiptEmail(booking, payment || {})
    // ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});



// --- N8N Webhook Replacements ---

router.get('/booking-enquiry', async (req, res) => {
  try {
    const booking_id = req.query.booking_id;
    if (!booking_id) return res.status(400).json({ success: false, error: 'Missing booking_id' });
    
    const booking = await getBookingById(booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/registration', async (req, res) => {
  try {
    const payload = req.body;
    let booking;
    
    // N8N payload could be nested { booking: {}, payment: {}, meta: {} } or flat
    if (payload.booking) {
       // It's an update/confirm from payment
       const bookingData = payload.booking;
       const paymentData = payload.payment;
       
       booking = await updateBooking(bookingData.booking_id, {
           status: paymentData.status === 'booked' ? 'confirmed' : 'failed',
           payment_id: paymentData.payment_id,
           total_amount: paymentData.amount,
           source: payload.meta?.source || 'website'
       });
       
    } else {
       // It's a new enquiry
       booking = await addBooking(payload);
    }
    
    // Sync to calendar_rules
    if (booking && booking.status === 'confirmed') {
        await blockDatesForBooking(booking);
    }
    
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/review', async (req, res) => {
  try {
    const { bookingId, experience, rating, source, timestamp } = req.body;
    
    await addReview({
        booking_id: bookingId,
        experience,
        rating,
        source: source || 'website',
        created_at: timestamp || new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Review submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/booking-cancellation', async (req, res) => {
  try {
    const booking_id = req.query.booking_id;
    if (!booking_id) return res.status(400).json({ success: false, error: 'Missing booking_id' });
    
    const booking = await getBookingById(booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    
    // Format for Cancellation component which expects specific N8N map keys
    res.json({ 
        success: true, 
        data: {
            'Guest Name': booking['Guest Name'],
            'Check In Date': booking['Check In Date'],
            'Check Out Date': booking['Check Out Date'],
            'Total Amount': booking['Total Amount'],
            'Status': booking['Status']
        }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/cancel-booking', async (req, res) => {
  try {
    const { bookingId, reason, timestamp } = req.body;
    
    const booking = await updateBookingStatus(bookingId, 'cancelled');
    
    // Might want to save reason to notes or a separate table if needed
    if (reason) {
        await updateBooking(bookingId, { notes: `Cancelled: ${reason}` });
    }
    
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/update-booking', async (req, res) => {
  try {
    const { booking_id, updates } = req.body;
    
    const booking = await updateBooking(booking_id, updates);
    
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});



module.exports = router;
