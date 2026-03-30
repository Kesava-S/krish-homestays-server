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
  <title>Booking Receipt – Krish Homestays</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f0f4f8;
      padding: 30px 20px;
      color: #333;
    }

    .container {
      max-width: 720px;
      margin: auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #1f6f43 0%, #2d9e60 100%);
      padding: 30px 40px 24px 40px;
      text-align: center;
      position: relative;
    }
    .header-logo {
      display: block;
      margin: 0 auto 14px auto;
      height: 70px;
      width: auto;
      object-fit: contain;
      /* White background pill for logo visibility on green */
      background: #ffffff;
      border-radius: 10px;
      padding: 8px 18px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
    }
    .header h1 {
      color: #ffffff;
      font-size: 22px;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .header .header-sub {
      color: #a8f0c6;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    .header-invoice-row {
      display: inline-flex;
      align-items: center;
      gap: 16px;
      background: rgba(255,255,255,0.12);
      border-radius: 20px;
      padding: 6px 20px;
      margin-top: 6px;
    }
    .header-invoice-row .inv-label {
      color: #d1fae5;
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .header-invoice-row .inv-divider {
      color: rgba(255,255,255,0.3);
      font-size: 16px;
    }
    .header-invoice-row .inv-date {
      color: #ffffff;
      font-size: 12px;
      font-weight: bold;
    }

    /* ── Status Banner ── */
    .status-banner {
      background: #f0faf4;
      border-bottom: 2px solid #1f6f43;
      padding: 14px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #1f6f43;
      color: #fff;
      font-size: 13px;
      font-weight: bold;
      padding: 6px 16px;
      border-radius: 20px;
      letter-spacing: 1px;
    }
    .status-banner .booking-ref {
      font-size: 13px;
      color: #555;
    }
    .status-banner .booking-ref span {
      font-weight: bold;
      color: #1f6f43;
    }

    /* ── Body ── */
    .body {
      padding: 36px 40px;
    }

    /* ── Guest + Property Info ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .info-box {
      background: #f8fafb;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px 20px;
    }
    .info-box .box-title {
      font-size: 11px;
      font-weight: bold;
      color: #1f6f43;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-box .info-row {
      display: flex;
      flex-direction: column;
      margin-bottom: 8px;
    }
    .info-box .info-row:last-child { margin-bottom: 0; }
    .info-box .info-label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .info-box .info-value {
      font-size: 14px;
      color: #222;
      font-weight: 600;
    }

    /* ── Section Title ── */
    .section-title {
      font-size: 11px;
      font-weight: bold;
      color: #1f6f43;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }

    /* ── Stay Table ── */
    .stay-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 28px;
      font-size: 14px;
    }
    .stay-table thead tr {
      background: #1f6f43;
      color: #fff;
    }
    .stay-table thead td {
      padding: 10px 14px;
      font-size: 12px;
      letter-spacing: 0.5px;
      font-weight: bold;
    }
    .stay-table tbody tr {
      border-bottom: 1px solid #f0f0f0;
    }
    .stay-table tbody tr:nth-child(even) {
      background: #f8fafb;
    }
    .stay-table tbody td {
      padding: 12px 14px;
      color: #444;
    }
    .stay-table tbody td:last-child {
      text-align: right;
      font-weight: 600;
      color: #1f6f43;
    }

    /* ── Payment Summary ── */
    .payment-summary {
      background: #f8fafb;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 28px;
    }
    .payment-summary .ps-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 20px;
      font-size: 14px;
      border-bottom: 1px solid #eef0f2;
      color: #555;
    }
    .payment-summary .ps-row:last-child { border-bottom: none; }
    .payment-summary .ps-total {
      background: #1f6f43;
      color: #fff;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
      font-weight: bold;
    }

    /* ── Payment Info ── */
    .payment-info {
      background: #f0faf4;
      border: 1px solid #d4edda;
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 28px;
    }
    .payment-info .pi-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      font-size: 13px;
    }
    .payment-info .pi-item .pi-label {
      color: #888;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .payment-info .pi-item .pi-value {
      color: #222;
      font-weight: 600;
    }

    /* ── Refund Policy ── */
    .policy-box {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 28px;
    }
    .policy-box .policy-title {
      font-size: 11px;
      font-weight: bold;
      color: #92400e;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .policy-box ul {
      padding-left: 18px;
      font-size: 13px;
      color: #78350f;
      line-height: 1.8;
    }

    /* ── Watermark ── */
    .watermark {
      text-align: center;
      margin: 0 0 28px 0;
      padding: 10px;
      border: 2px dashed #d4edda;
      border-radius: 8px;
      color: #1f6f43;
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    /* ── Note ── */
    .note {
      font-size: 13px;
      color: #666;
      line-height: 1.7;
      margin-bottom: 24px;
    }

    /* ── Footer ── */
    .footer {
      background: #f8fafb;
      border-top: 1px solid #e2e8f0;
      padding: 20px 40px;
      text-align: center;
    }
    .footer-logo {
      display: block;
      margin: 0 auto 10px auto;
      height: 36px;
      width: auto;
      object-fit: contain;
      opacity: 0.7;
    }
    .footer p {
      font-size: 12px;
      color: #999;
      line-height: 1.8;
    }
    .footer .footer-brand {
      font-size: 14px;
      font-weight: bold;
      color: #1f6f43;
      margin-bottom: 6px;
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- ── Header with Logo ── -->
    <div class="header">

      <!-- 🔁 Replace this src with your actual logo URL -->
      <img
        class="header-logo"
        src="https://krishhomestays.com/assets/logo/logo.png"
        alt="Krish Homestays Logo"
        onerror="this.style.display='none'"
      />

      <h1>Krish Homestays</h1>
      <p class="header-sub">Munnar, Kerala, India</p>

      <div class="header-invoice-row">
        <span class="inv-label">TAX INVOICE</span>
        <span class="inv-divider">|</span>
        <span class="inv-date">${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}</span>
      </div>

    </div>

    <!-- ── Status Banner ── -->
    <div class="status-banner">
      <div class="status-badge">✓ &nbsp;PAYMENT CONFIRMED</div>
      <div class="booking-ref">
        Booking Ref: <span>${booking.booking_id}</span>
      </div>
    </div>

    <div class="body">

      <!-- ── Guest + Property Info ── -->
      <div class="info-grid">
        <div class="info-box">
          <div class="box-title">👤 Billed To</div>
          <div class="info-row">
            <span class="info-label">Guest Name</span>
            <span class="info-value">${booking.guest_name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email</span>
            <span class="info-value">${booking.email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone</span>
            <span class="info-value">${booking.phone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Guests</span>
            <span class="info-value">${booking.guests_count} Guests</span>
          </div>
        </div>

        <div class="info-box">
          <div class="box-title">🏡 Property Details</div>
          <div class="info-row">
            <span class="info-label">Property</span>
            <span class="info-value">Krish Homestays</span>
          </div>
          <div class="info-row">
            <span class="info-label">Location</span>
            <span class="info-value">Munnar, Kerala</span>
          </div>
          <div class="info-row">
            <span class="info-label">Check-in</span>
            <span class="info-value">📅 ${booking.check_in_date}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Check-out</span>
            <span class="info-value">📅 ${booking.check_out_date}</span>
          </div>
        </div>
      </div>

      <!-- ── Stay Charges ── -->
      <div class="section-title">🛏 Stay Charges</div>
      <table class="stay-table">
        <thead>
          <tr>
            <td>Description</td>
            <td>Check-in</td>
            <td>Check-out</td>
            <td>Guests</td>
            <td style="text-align:right;">Amount</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Homestay Accommodation</td>
            <td>${booking.check_in_date}</td>
            <td>${booking.check_out_date}</td>
            <td>${booking.guests_count}</td>
            <td>₹${booking.total_amount}</td>
          </tr>
        </tbody>
      </table>

      <!-- ── Payment Summary ── -->
      <div class="section-title">💳 Payment Summary</div>
      <div class="payment-summary">
        <div class="ps-row">
          <span>Subtotal</span>
          <span>₹${booking.total_amount}</span>
        </div>
        <div class="ps-row">
          <span>Taxes & Fees</span>
          <span>Included</span>
        </div>
        <div class="ps-row">
          <span>Discount</span>
          <span>—</span>
        </div>
        <div class="ps-total">
          <span>TOTAL AMOUNT PAID</span>
          <span>₹${booking.total_amount}</span>
        </div>
      </div>

      <!-- ── Transaction Details ── -->
      <div class="payment-info">
        <div class="section-title" style="margin-bottom:14px;">🔐 Transaction Details</div>
        <div class="pi-grid">
          <div class="pi-item">
            <div class="pi-label">Payment ID</div>
            <div class="pi-value">${payment.payment_id || '—'}</div>
          </div>
          <div class="pi-item">
            <div class="pi-label">Order ID</div>
            <div class="pi-value">${payment.order_id || '—'}</div>
          </div>
          <div class="pi-item">
            <div class="pi-label">Payment Method</div>
            <div class="pi-value">${payment.method || 'Razorpay'}</div>
          </div>
          <div class="pi-item">
            <div class="pi-label">Payment Status</div>
            <div class="pi-value" style="color:#1f6f43;">✓ PAID</div>
          </div>
          <div class="pi-item">
            <div class="pi-label">Currency</div>
            <div class="pi-value">${payment.currency || 'INR'}</div>
          </div>
          <div class="pi-item">
            <div class="pi-label">Date</div>
            <div class="pi-value">${new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>
      </div>

      <!-- ── Refund Policy ── -->
      <div class="policy-box">
        <div class="policy-title">⚠️ Cancellation & Refund Policy</div>
        <ul>
          <li><strong>Up to 4 days before check-in</strong> — Free Cancellation</li>
          <li><strong>Within 4 days</strong> — 50% refund</li>
          <li><strong>No show</strong> — Full Amount Charged</li>
        </ul>
      </div>

      <!-- ── Paid Stamp ── -->
      <div class="watermark">✓ &nbsp; Paid in Full &nbsp; ✓</div>

      <!-- ── Note ── -->
      <p class="note">
        Thank you for choosing <strong>Krish Homestays</strong>. Please carry this receipt
        during your stay. For any queries, reply to this email or contact us on WhatsApp.
        We look forward to welcoming you!
      </p>

      <p style="font-size:14px; color:#333; margin-bottom: 0;">
        Warm regards,<br/>
        <strong style="color:#1f6f43;">The Krish Homestays Team</strong>
      </p>

    </div>

    <!-- ── Footer ── -->
    <div class="footer">

      <!-- 🔁 Same logo repeated smaller in footer -->
      <img
        class="footer-logo"
        src="https://krishhomestays.com/assets/logo/logo.png"
        alt="Krish Homestays"
        onerror="this.style.display='none'"
      />

      <p class="footer-brand">Krish Homestays</p>
      <p>
        📧 krishhomestays@gmail.com &nbsp;|&nbsp; 🌐 krishhomestays.com<br/>
        📍 Munnar, Kerala, India<br/><br/>
        This is a computer-generated receipt and does not require a physical signature.<br/>
        © ${new Date().getFullYear()} Krish Homestays. All rights reserved.
      </p>
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
