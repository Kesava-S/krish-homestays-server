const express = require('express');
const router = express.Router();
const { getBookings, addBooking, getCalendarRules, updateCalendarRules } = require('../services/sheetsService');
const { createCalendarEvent } = require('../services/calendarService');
const { sendConfirmationEmail } = require('../services/emailService');
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

    console.log("airbnb----", airbnb);

    const websiteBookings = bookings
      .filter(b => b.status === 'booked')
      .map(b => ({
        start: b.check_in_date,
        end: b.check_out_date,
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

  console.log("Request data in verify:...", req.body);

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
  const { guest_name, email, phone, check_in_date, check_out_date, guests_count, total_amount } = req.body;

  console.log("Booking data:", req.body);


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
      if (rule && rule.status === 'blocked') {
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
      total_amount
    };

    const savedBooking = await addBooking(newBooking);

    // Send Email
    // await sendConfirmationEmail(savedBooking);

    // Create Calendar Event
    // await createCalendarEvent(savedBooking);

    console.log(`Booking confirmed for ${email}`);

    res.status(201).json(savedBooking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


const htmlToPdf = require('html-pdf-node');
const path = require('path')
const fs = require('fs')
router.use('/receipts', express.static(path.join(__dirname, 'receipts')));

router.post('/generate-receipt', async (req, res) => {
  try {
    const { booking, payment } = req.body;

    const html = generateReceiptHTML(booking, payment || {});

    const pdfBuffer = await htmlToPdf.generatePdf(
      { content: html },
      { format: 'A4', printBackground: true }
    );

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



function generateReceiptHTML(booking, payment) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Booking Receipt</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f4f6f8;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 700px;
      margin: auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: #1f6f43;
      color: #ffffff;
      padding: 20px;
      text-align: center;
    }
    .header h2 {
      margin: 5px 0 0 0;
    }
    .content {
      padding: 30px;
      color: #333;
      font-size: 14px;
      line-height: 1.6;
    }
    .section-title {
      margin-top: 20px;
      margin-bottom: 10px;
      font-weight: bold;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    td {
      padding: 8px 4px;
      vertical-align: top;
    }
    .label {
      font-weight: bold;
      width: 40%;
    }
    .amount-box {
      margin-top: 20px;
      padding: 15px;
      background: #f8fafc;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 16px;
    }
    .footer {
      background: #f1f5f9;
      padding: 15px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>

  <div class="container">

    <div class="header">
      <h2>Krish Homestay</h2>
      <p>Booking Receipt</p>
    </div>

    <div class="content">
      <p>Hi <strong>${booking.guest_name}</strong>,</p>

      <p>Thank you for booking with <strong>Krish Homestay</strong>.  
      This is your official payment receipt.</p>

      <div class="section-title">Booking Details</div>

      <table>
        <tr>
          <td class="label">Booking ID</td>
          <td>${booking.booking_id}</td>
        </tr>
        <tr>
          <td class="label">Guest Name</td>
          <td>${booking.guest_name}</td>
        </tr>
        <tr>
          <td class="label">Email</td>
          <td>${booking.email}</td>
        </tr>
        <tr>
          <td class="label">Phone</td>
          <td>${booking.phone}</td>
        </tr>
        <tr>
          <td class="label">Check-in Date</td>
          <td>${booking.check_in_date}</td>
        </tr>
        <tr>
          <td class="label">Check-out Date</td>
          <td>${booking.check_out_date}</td>
        </tr>
        <tr>
          <td class="label">Guests</td>
          <td>${booking.guests_count}</td>
        </tr>
      </table>

      <div class="section-title">Payment Details</div>

      <table>
        <tr>
          <td class="label">Payment ID</td>
          <td>${payment.payment_id || '-'}</td>
        </tr>
        <tr>
          <td class="label">Payment Method</td>
          <td>${payment.method || 'Razorpay'}</td>
        </tr>
        <tr>
          <td class="label">Status</td>
          <td><strong style="color:green;">PAID</strong></td>
        </tr>
      </table>

      <div class="amount-box">
        <strong>Total Amount Paid: ₹${booking.total_amount}</strong>
      </div>

      <p style="margin-top:25px;">
        Please keep this receipt for your records.  
        We look forward to hosting you.
      </p>

      <p>
        Warm regards,<br />
        <strong>Krish Homestay</strong>
      </p>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} Krish Homestay. All rights reserved.
    </div>

  </div>

</body>
</html>
`;
}



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
