const express = require('express');
const router = express.Router();
const { getBookings, addBooking, getCalendarRules, updateCalendarRules } = require('../services/sheetsService');
const { createCalendarEvent } = require('../services/calendarService');
const { sendConfirmationEmail, sendReceiptEmail } = require('../services/emailService');
const { createPaymentIntent } = require('../services/paymentService');

const { fetchAirbnbBookings } = require('../services/fetchAirbnbBookings')

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
    const [bookings, rules, airbnb] = await Promise.all([
      getBookings(),
      getCalendarRules(),
      fetchAirbnbBookings()
    ]);

    const websiteBookings = bookings
      .filter(b => b.status === 'booked')
      .map(b => ({
        start: b.check_in_date,
        end: b.check_out_date,
        guests_count: b.guests_count,
        booking_type: b.booking_type,
        type: 'website'
      }));

    const allBookedDates = [
      ...websiteBookings,
      ...airbnb
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



// router.get("/test-sheet", async (req, res) => {
//     try {
//         const result = await sheets.spreadsheets.values.get({
//             spreadsheetId: "1IywqWahk1IgrDT3m2bgmybqDT55OlPi-EYAOS_FJBDE",
//             range: "Bookings!A1"
//         });

//         res.json(result.data);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: err.message });
//     }
// });


module.exports = router;
