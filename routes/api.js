const express = require('express');
const router = express.Router();
const { 
  getBookings, 
  getAllBookings, 
  addBooking, 
  updateBooking, 
  updateBookingStatus,
  getBookingById, 
  getCalendarRules, 
  updateCalendarRules,
  deleteCalendarRule,
  blockDatesForBooking,
  unblockDatesForBooking,
  addReview,
  getReviews,
  testConnection,
  appendNote,
  logApp,
  logAppError,
  logUser
} = require('../services/supabaseService');
const { createCalendarEvent } = require('../services/calendarService');
const { sendConfirmationEmail, sendReceiptEmail, sendCancellationEmail } = require('../services/emailService');
const { createPaymentIntent } = require('../services/paymentService');

const { fetchAirbnbBookings } = require('../services/fetchAirbnbBookings');
const { fetchMMTBookings } = require('../services/fetchMMTBookings');

// Database Connection Health Check
router.get('/db-health', async (req, res) => {
  try {
    const result = await testConnection();
    res.status(result.connected ? 200 : 503).json(result);
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// Admin Login
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    logUser({ action: 'admin_login_success', userIdentifier: username, userType: 'admin', req });
    logApp('info', 'auth', 'admin_login', `Admin user "${username}" logged in successfully`);
    res.json({ success: true, token: 'admin-session-token' });
  } else {
    logUser({ action: 'admin_login_failed', userIdentifier: username, userType: 'admin', req });
    logApp('warn', 'auth', 'admin_login_failed', `Failed admin login attempt for username: ${username}`);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.get('/calendar-data', async (req, res) => {
  try {
    const [bookings, rules, airbnb, mmt] = await Promise.all([
      getBookings(),
      getCalendarRules(),
      fetchAirbnbBookings().catch(() => []),
      fetchMMTBookings().catch(() => []),
    ]);

    const activeWebsiteBookings = bookings
      .filter(b => b.status === 'booked' || b.status === 'confirmed');

    const websiteBookings = activeWebsiteBookings.map(b => ({
      booking_id: b.booking_id || b['Booking Id'] || b['Booking ID'],
      guest_name: b.guest_name || b['Guest Name'],
      phone: b.phone || b.phone_number || b['Phone Number'],
      email: b.email || b['Email'],
      start: b.check_in_date,
      end: b.check_out_date,
      guests_count: b.guests_count || b['Guest Count'],
      booking_type: b.booking_type || b['Booking Type'] || 'full villa',
      room_type: b.room_type || (String(b.booking_type || '').toLowerCase().includes('half') ? 'partial' : 'full'),
      status: b.status || 'confirmed',
      source: b.source || 'website',
      total_amount: b.total_amount || b['Total Amount'],
      type: 'website'
    }));

    const allBookedDates = [
      ...websiteBookings,
      ...airbnb,
      ...mmt,
    ];

    // Filter rules so orphaned/stale auto-booked dates (with no matching confirmed booking) don't ghost-block dates
    const ruleData = rules.reduce((acc, rule) => {
      if (rule.status === 'booked' && !rule.price) {
        const hasActiveBooking = activeWebsiteBookings.some(b => {
          const start = new Date(b.check_in_date);
          const end = new Date(b.check_out_date);
          const d = new Date(rule.date);
          return d >= start && d < end;
        });
        if (!hasActiveBooking) return acc;
      }

      acc[rule.date] = {
        id: rule.id,
        rule_id: rule.rule_id || rule.id,
        booking_id: rule.booking_id,
        reason: rule.reason,
        price: rule.price,
        status: rule.status,
        unit: rule.unit,
        room_type: rule.room_type || 'full'
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
      const uid = `${b.booking_id || b.id || b.date}-website@krishhomestays.com`;
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

// Create a new booking (Admin)
router.post('/admin/add-booking', async (req, res) => {
  try {
    const body = req.body;
    const guest_name = body['Guest Name'] || body.guest_name;
    const email = body['Email'] || body.email;
    const phone = body['Phone Number'] || body.phone;
    const check_in_date = body['Check In Date'] || body.check_in_date;
    const check_out_date = body['Check Out Date'] || body.check_out_date;
    const status = body['Status'] || body.status || 'confirmed';
    const total_amount = body['Total Amount'] || body.total_amount;
    const booking_type = body['Booking Type'] || body.booking_type || 'full villa';
    const room_type = body.room_type || (booking_type === 'half villa' ? 'half' : booking_type === 'remaining' ? 'remaining' : 'full');
    const adults = body['Guest Adults'] != null ? body['Guest Adults'] : (body.adults || 1);
    const children = body['Guest Children'] != null ? body['Guest Children'] : (body.children || 0);
    const guests_count = body['Guest Count'] != null ? body['Guest Count'] : (Number(adults) + Number(children));
    const notes = body['Notes'] || body.notes || null;
    const payment_id = body['Payment ID'] || body.payment_id || null;
    const source = body['source'] || body.source || 'admin';

    if (!guest_name || !check_in_date || !check_out_date) {
      return res.status(400).json({ success: false, error: 'Guest name, check-in, and check-out dates are required' });
    }

    const isConfirmed = status === 'confirmed' || status === 'booked';

    if (isConfirmed) {
      const allBookings = await getBookings();
      const newStart = new Date(check_in_date); newStart.setHours(0, 0, 0, 0);
      const newEnd = new Date(check_out_date); newEnd.setHours(0, 0, 0, 0);

      const reqType = String(booking_type || room_type || 'full villa').toLowerCase();
      const isIncomingPartial = reqType.includes('half') || reqType.includes('partial');
      const isIncomingRemaining = reqType.includes('remaining');
      const isIncomingFull = !isIncomingPartial && !isIncomingRemaining;

      const conflict = allBookings.find(b => {
        if (b.status !== 'confirmed' && b.status !== 'booked') return false;
        const bStart = new Date(b.check_in_date); bStart.setHours(0, 0, 0, 0);
        const bEnd = new Date(b.check_out_date); bEnd.setHours(0, 0, 0, 0);
        const overlaps = (newStart < bEnd && newEnd > bStart);
        if (!overlaps) return false;

        const bType = String(b.booking_type || b.room_type || 'full villa').toLowerCase();
        const isExistingPartial = bType.includes('half') || bType.includes('partial');
        const isExistingRemaining = bType.includes('remaining');
        const isExistingFull = !isExistingPartial && !isExistingRemaining;

        if (isIncomingFull) return true;
        if (isIncomingPartial && (isExistingFull || isExistingPartial)) return true;
        if (isIncomingRemaining && (isExistingFull || isExistingRemaining)) return true;

        return false;
      });

      if (conflict) {
        const cId = conflict.booking_id || conflict['Booking Id'] || 'Booking';
        const cName = conflict.guest_name || conflict['Guest Name'] || 'Guest';
        return res.status(409).json({
          success: false,
          error: `Already booked at that particular date by ${cName} (Booking ID: ${cId})`,
          conflict: {
            booking_id: cId,
            guest_name: cName
          }
        });
      }
    }

    let initialNotes = notes;
    if (isConfirmed) {
      initialNotes = appendNote(initialNotes, `Manual booking created by Admin for ${guest_name}`);
    }
    const newBooking = await addBooking({
      guest_name,
      email: email || '',
      phone: phone || '',
      check_in_date: new Date(check_in_date).toISOString(),
      check_out_date: new Date(check_out_date).toISOString(),
      guests_count: Number(guests_count) || 1,
      adults: Number(adults) || 1,
      children: Number(children) || 0,
      room_type,
      booking_type,
      status,
      total_amount: total_amount != null && total_amount !== '' ? Number(total_amount) : 0,
      payment_id,
      source,
      confirmation_sent: isConfirmed ? 'yes' : 'no',
      notes: initialNotes
    });

    if (newBooking && isConfirmed) {
      await blockDatesForBooking(newBooking);

      // Send confirmation & receipt email to both Guest and Admin
      sendReceiptEmail(newBooking, { 
        payment_method: payment_id ? 'online' : 'admin_manual',
        payment_id: payment_id || null,
        amount: newBooking.total_amount
      }).catch(err => {
        console.error('Error sending confirmation email on admin add-booking:', err);
      });
    }

    logUser({ action: 'admin_add_booking', userIdentifier: 'admin', userType: 'admin', req, metadata: { booking_id: newBooking.booking_id, guest_name: newBooking.guest_name } });
    logApp('info', 'booking', 'admin_add_booking', `Admin created booking ${newBooking.booking_id} for ${newBooking.guest_name}`, { booking_id: newBooking.booking_id });

    res.status(201).json({ success: true, booking: newBooking });
  } catch (err) {
    console.error('Error adding booking by admin:', err);
    logAppError({ endpoint: '/api/admin/add-booking', req, error: err });
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Get all calendar rules (Admin)
router.get('/admin/calendar-rules', async (req, res) => {
  try {
    const rules = await getCalendarRules();
    res.json(rules);
  } catch (err) {
    console.error('Error fetching calendar rules for admin:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Calendar Rules (Admin - batch)
router.post('/admin/rules', async (req, res) => {
  try {
    const { rules, rule } = req.body;
    const rulesToUpdate = rules || (rule ? [rule] : [req.body]);

    // Check against active confirmed bookings to protect booked dates
    const bookings = await getBookings();
    const activeBookings = bookings.filter(b => b.status === 'booked' || b.status === 'confirmed');

    const safeRules = [];
    const skippedBooked = [];

    for (const r of rulesToUpdate) {
      const rDateStr = r.date || r.start_date;
      if (!rDateStr) continue;
      const rDate = new Date(rDateStr);
      rDate.setHours(0, 0, 0, 0);

      const conflictBooking = activeBookings.find(b => {
        const start = new Date(b.check_in_date);
        const end = new Date(b.check_out_date);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return rDate >= start && rDate < end;
      });

      if (conflictBooking) {
        skippedBooked.push({
          date: rDateStr,
          booking_id: conflictBooking.booking_id,
          guest_name: conflictBooking.guest_name
        });
      } else {
        safeRules.push(r);
      }
    }

    if (safeRules.length > 0) {
      await updateCalendarRules(safeRules);
    }

    if (skippedBooked.length > 0 && safeRules.length === 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot apply rule: Date(s) ${skippedBooked.map(s => s.date).join(', ')} are already booked by ${skippedBooked[0].guest_name} (${skippedBooked[0].booking_id}). Rules cannot override active bookings.`,
        skipped: skippedBooked
      });
    }

    res.json({
      success: true,
      message: skippedBooked.length > 0 
        ? `Rules updated for ${safeRules.length} date(s). ${skippedBooked.length} already booked date(s) were protected and skipped.`
        : 'Calendar rules updated successfully',
      updatedCount: safeRules.length,
      skippedBooked
    });
  } catch (err) {
    console.error('Error updating calendar rules:', err);
    logAppError({ endpoint: '/api/admin/rules', req, error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create or Update Calendar Rule (Admin)
router.post('/admin/calendar-rules', async (req, res) => {
  try {
    const { rules, rule } = req.body;
    const rulesToUpdate = rules || (rule ? [rule] : [req.body]);
    await updateCalendarRules(rulesToUpdate);
    res.json({ success: true, message: 'Calendar rule saved successfully' });
  } catch (err) {
    console.error('Error saving calendar rule:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Calendar Rule (Admin)
router.post('/admin/calendar-rules/delete', async (req, res) => {
  try {
    const { id, date } = req.body;
    if (!id && !date) {
      return res.status(400).json({ success: false, error: 'Rule ID or Date is required' });
    }
    await deleteCalendarRule(id || date);
    res.json({ success: true, message: 'Calendar rule deleted successfully' });
  } catch (err) {
    console.error('Error deleting calendar rule:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Booking (Admin)
router.post('/admin/update-booking', async (req, res) => {
  try {
    const booking = req.body;
    const bookingId = (booking['Booking Id'] || booking.booking_id || '').trim().toUpperCase();
    if (!bookingId) {
      return res.status(400).json({ success: false, error: 'Booking ID is required' });
    }

    const existing = await getBookingById(bookingId);
    const prevStatus = (existing?.status || '').toLowerCase();
    const newStatus = (booking['Status'] || booking.status || '').toLowerCase();

    if (prevStatus !== newStatus) {
      const guestName = booking['Guest Name'] || booking.guest_name || existing?.guest_name || 'Guest';
      if (newStatus === 'confirmed' || newStatus === 'booked') {
        booking.notes = appendNote(booking.notes || booking['Notes'] || existing?.notes, `${bookingId} - ${guestName}: Confirmed booking`);
      } else if (newStatus === 'cancelled') {
        booking.notes = appendNote(booking.notes || booking['Notes'] || existing?.notes, `${bookingId} - Cancelled (by Admin)`);
      }
    }

    const updated = await updateBooking(bookingId, booking);

    if (prevStatus !== newStatus) {
      if (newStatus === 'confirmed' || newStatus === 'booked') {
        await blockDatesForBooking(updated || existing);
        sendReceiptEmail(updated || existing, { payment_method: 'admin_confirmed' }).catch(err => {
          console.error('Error sending confirmation email on admin update:', err);
        });
      } else if (newStatus === 'cancelled') {
        await unblockDatesForBooking(existing || updated);
        sendCancellationEmail(updated || existing, { eligible: false, refundAmount: 0 }, 'Cancelled by Administrator').catch(err => {
          console.error('Error sending cancellation email on admin update:', err);
        });
      }
    }

    logUser({ action: 'admin_update_booking', userIdentifier: 'admin', userType: 'admin', req, metadata: { booking_id: bookingId, status: newStatus } });
    logApp('info', 'booking', 'admin_update_booking', `Admin updated booking ${bookingId} to status: ${newStatus}`);

    res.json({ success: true, booking: updated });
  } catch (err) {
    console.error('Error updating booking in Supabase:', err);
    logAppError({ endpoint: '/api/admin/update-booking', req, error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single booking by Booking ID
router.get('/bookings/:bookingId', async (req, res) => {
  try {
    const booking = await getBookingById(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ 
      success: true, 
      booking,
      data: {
        ...booking,
        'Booking Id': booking.booking_id,
        'Guest Name': booking.guest_name,
        'Email': booking.email,
        'Phone Number': booking.phone,
        'Check In Date': booking.check_in_date,
        'Check Out Date': booking.check_out_date,
        'Total Amount': booking.total_amount,
        'Payment ID': booking.payment_id,
        'Status': booking.status
      }
    });
  } catch (err) {
    console.error('Error fetching booking from Supabase:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reviews endpoints
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await getReviews();
    res.json({ success: true, reviews });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reviews', async (req, res) => {
  try {
    const review = await addReview(req.body);
    res.json({ success: true, review });
  } catch (err) {
    console.error('Error adding review:', err);
    res.status(500).json({ success: false, error: err.message });
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


// Create or update booking in Supabase
router.post('/bookings', async (req, res) => {
  const { 
    guest_name, 
    email, 
    phone, 
    check_in_date, 
    check_out_date, 
    guests_count, 
    adults, 
    children, 
    room_type, 
    booking_type,
    total_amount, 
    booking_id, 
    status,
    payment_id,
    source,
    notes 
  } = req.body;

  if (!guest_name || !email || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const phoneDigits = String(phone || '').replace(/\D/g, '');
  if (!phone || phoneDigits.length < 10) {
    return res.status(400).json({ error: 'Please provide a valid phone number with at least 10 digits' });
  }

  const targetStatus = status || 'confirmed';

  try {
    const bookings = await getBookings();
    const rules = await getCalendarRules(); // Check for blocked dates too

    const effectiveRoomType = room_type || (booking_type === 'half villa' ? 'partial' : booking_type === 'remaining' ? 'remaining' : 'full');
    const isIncomingRemaining = effectiveRoomType === 'remaining';
    const numAdults = Number(adults) || 1;
    const numChildren = Number(children) || 0;
    const totalGuests = Number(guests_count) || (numAdults + numChildren);

    if (isIncomingRemaining) {
      if (numAdults < 1) {
        return res.status(400).json({ error: 'At least 1 adult is required for the remaining room' });
      }
      if (numAdults + numChildren > 3) {
        return res.status(400).json({ error: 'Remaining room allows 1 to 3 members total' });
      }
    } else {
      if (numAdults < 3) {
        return res.status(400).json({ error: 'Minimum 3 adults required' });
      }
    }

    // Check overlap with bookings
    const newStart = new Date(check_in_date);
    const newEnd = new Date(check_out_date);

    const hasBookingOverlap = bookings.some(booking => {
      // Don't conflict with itself if updating the same booking_id
      if (booking_id && booking.booking_id === booking_id) return false;
      if (booking.status !== 'confirmed' && booking.status !== 'booked') return false;
      const start = new Date(booking.check_in_date);
      const end = new Date(booking.check_out_date);
      const overlaps = (newStart < end && newEnd > start);
      if (!overlaps) return false;

      const bType = String(booking.booking_type || booking.room_type || '').toLowerCase();
      const isExistingPartial = bType.includes('half') || bType.includes('partial');
      const isExistingRemaining = bType.includes('remaining');

      if (isIncomingRemaining) {
        // Remaining room can overlap with a partial booking!
        // But CANNOT overlap with another remaining booking or full villa
        if (isExistingRemaining || !isExistingPartial) {
          return true;
        }
        return false;
      }

      // Non-remaining bookings conflict with any existing booking
      return true;
    });

    // Check overlap with blocked dates / calendar rules
    let currentDate = new Date(newStart);
    let hasBlockOverlap = false;
    while (currentDate < newEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const rule = rules.find(r => r.date === dateStr);
      if (rule) {
        if (rule.status === 'blocked') {
          hasBlockOverlap = true;
          break;
        }
        if (rule.status === 'booked') {
          const rType = String(rule.room_type || '').toLowerCase();
          const isRulePartial = rType.includes('half') || rType.includes('partial');
          if (isIncomingRemaining && isRulePartial) {
            // Allowed to overlap with partial booking rule
          } else {
            hasBlockOverlap = true;
            break;
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (targetStatus === 'confirmed' && (hasBookingOverlap || hasBlockOverlap)) {
      return res.status(409).json({ error: 'Dates not available' });
    }

    let initialNotes = notes || null;
    if (targetStatus === 'confirmed') {
      const gName = guest_name || 'Guest';
      initialNotes = appendNote(initialNotes, `${booking_id || 'Booking'} - ${gName}: Confirmed booking`);
    }

    // Add / Upsert to Supabase
    const newBooking = {
      booking_id,
      guest_name,
      email,
      phone,
      check_in_date,
      check_out_date,
      guests_count,
      adults,
      children,
      room_type: room_type || 'full',
      booking_type: booking_type || (room_type === 'partial' ? 'half villa' : room_type === 'remaining' ? 'remaining' : 'full villa'),
      status: targetStatus,
      total_amount,
      payment_id: payment_id || null,
      source: source || 'website',
      notes: initialNotes
    };

    const savedBooking = await addBooking(newBooking);

    // Sync to calendar_rules
    if (savedBooking && (savedBooking.status === 'confirmed' || savedBooking.status === 'booked')) {
        await blockDatesForBooking(savedBooking);
    }

    logUser({ action: 'booking_created', userIdentifier: email || phone, userType: 'guest', req, metadata: { booking_id: savedBooking.booking_id, amount: total_amount } });
    logApp('info', 'booking', 'create_booking', `New booking created ${savedBooking.booking_id} for ${guest_name}`, { booking_id: savedBooking.booking_id });

    res.status(201).json({ success: true, booking: savedBooking });
  } catch (err) {
    console.error('Error creating booking:', err);
    logAppError({ endpoint: '/api/bookings', req, error: err });
    res.status(500).json({ success: false, error: 'Server error' });
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
    const booking_id = (req.query.booking_id || '').trim().toUpperCase();
    if (!booking_id) return res.status(400).json({ success: false, error: 'Missing booking_id' });
    
    const booking = await getBookingById(booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    
    res.json({ 
      success: true, 
      data: {
        ...booking,
        booking_id: booking.booking_id,
        guest_name: booking.guest_name,
        email: booking.email,
        phone: booking.phone,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        total_amount: booking.total_amount,
        status: booking.status,
        payment_id: booking.payment_id,
        'Booking Id': booking.booking_id,
        'Guest Name': booking.guest_name,
        'Email': booking.email,
        'Phone Number': booking.phone,
        'Check In Date': booking.check_in_date,
        'Check Out Date': booking.check_out_date,
        'Total Amount': booking.total_amount,
        'Payment ID': booking.payment_id,
        'Status': booking.status
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/registration', async (req, res) => {
  try {
    const payload = req.body;
    let booking;
    
    // Payload could be nested { booking: {}, payment: {}, meta: {} } from payment or flat from enquiry
    if (payload.booking) {
       // It's an update/confirm from payment
       const bookingData = payload.booking;
       const paymentData = payload.payment;
       
       const isSuccess = paymentData.status === 'booked' || paymentData.status === 'confirmed';
       const targetStatus = isSuccess ? 'confirmed' : 'failed';

       const existing = await getBookingById(bookingData.booking_id);
       let updatedNotes = existing?.notes || bookingData.notes || null;
       if (targetStatus === 'confirmed') {
           const guestName = bookingData.guest_name || existing?.guest_name || 'Guest';
           updatedNotes = appendNote(updatedNotes, `${bookingData.booking_id} - ${guestName}: Confirmed booking`);
       }

       if (existing) {
           booking = await updateBooking(bookingData.booking_id, {
               status: targetStatus,
               payment_id: paymentData.payment_id,
               total_amount: paymentData.amount || bookingData.total_amount,
               source: payload.meta?.source || 'website',
               notes: updatedNotes
           });
       } else {
           booking = await addBooking({
               ...bookingData,
               status: targetStatus,
               payment_id: paymentData.payment_id,
               total_amount: paymentData.amount || bookingData.total_amount,
               source: payload.meta?.source || 'website',
               notes: updatedNotes
           });
       }
       
    } else {
       // It's a new enquiry when user clicks "Proceed to Payment"
       booking = await addBooking({
           ...payload,
           status: 'Enquery'
       });
    }
    
    // Sync to calendar_rules only if payment was confirmed
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
    const cleanBookingId = (bookingId || '').trim().toUpperCase();
    
    await addReview({
        booking_id: cleanBookingId,
        experience,
        rating,
        source: source || 'website',
        created_at: timestamp || new Date().toISOString()
    });

    if (cleanBookingId) {
      try {
        const existing = await getBookingById(cleanBookingId);
        if (existing) {
          const reviewText = experience ? `"${experience}"` : 'No text';
          const reviewNote = appendNote(existing.notes, `${cleanBookingId} - Review (${rating || 5}/5★): ${reviewText}`);
          await updateBooking(cleanBookingId, { notes: reviewNote });
        }
      } catch (err) {
        console.warn('Could not append review to booking notes:', err);
      }
    }
    
    res.json({ success: true, message: 'Review submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/booking-cancellation', async (req, res) => {
  try {
    const booking_id = (req.query.booking_id || '').trim().toUpperCase();
    if (!booking_id) return res.status(400).json({ success: false, error: 'Missing booking_id' });
    
    const booking = await getBookingById(booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    
    // Return both snake_case and Title Case properties for robust client compatibility
    res.json({ 
        success: true, 
        data: {
            booking_id: booking.booking_id,
            guest_name: booking.guest_name,
            email: booking.email,
            phone: booking.phone,
            check_in_date: booking.check_in_date,
            check_out_date: booking.check_out_date,
            total_amount: booking.total_amount,
            status: booking.status,
            payment_id: booking.payment_id,
            'Booking Id': booking.booking_id,
            'Guest Name': booking.guest_name,
            'Email': booking.email,
            'Phone Number': booking.phone,
            'Check In Date': booking.check_in_date,
            'Check Out Date': booking.check_out_date,
            'Total Amount': booking.total_amount,
            'Payment ID': booking.payment_id,
            'Status': booking.status
        }
    });
  } catch (err) {
    console.error('Error fetching booking for cancellation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/cancel-booking', async (req, res) => {
  try {
    const bookingId = (req.body.booking_id || req.body.bookingId || '').trim().toUpperCase();
    const reason = req.body.reason || 'Cancelled by guest via website';
    const refundInfo = {
      refundAmount: req.body.refund_amount != null ? Number(req.body.refund_amount) : 0,
      refundPercent: req.body.refund_percent != null ? Number(req.body.refund_percent) : 0,
      eligible: req.body.refund_eligible != null ? Boolean(req.body.refund_eligible) : (Number(req.body.refund_amount) > 0)
    };

    if (!bookingId) {
      return res.status(400).json({ success: false, error: 'Booking ID is required' });
    }

    const existing = await getBookingById(bookingId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (existing.status === 'cancelled') {
      return res.json({ success: true, status: 'exist', message: 'Booking is already cancelled' });
    }

    const cancelNote = appendNote(existing.notes, `${bookingId} - Cancelled${reason ? ` (${reason})` : ''}`);
    const updatedBooking = await updateBooking(bookingId, { 
      status: 'cancelled',
      notes: cancelNote
    });

    // Unblock dates in calendar
    await unblockDatesForBooking(existing);

    // Send cancellation emails to Guest and Admin (Option B - Direct Backend)
    const bookingForEmail = { ...existing, ...updatedBooking, booking_id: bookingId };
    sendCancellationEmail(bookingForEmail, refundInfo, reason).catch(err => {
      console.error('Failed to send cancellation email:', err);
    });

    logUser({ action: 'booking_cancelled', userIdentifier: bookingId, userType: 'guest', req, metadata: { booking_id: bookingId, reason } });
    logApp('info', 'booking', 'cancel_booking', `Booking ${bookingId} was cancelled (${reason})`);

    res.json({ success: true, message: 'Booking cancelled successfully', booking: updatedBooking });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    logAppError({ endpoint: '/api/cancel-booking', req, error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/update-booking', async (req, res) => {
  try {
    const { booking_id, updates } = req.body;
    const bookingId = (booking_id || req.body['Booking Id'] || '').trim().toUpperCase();
    if (!bookingId) {
      return res.status(400).json({ success: false, error: 'Booking ID is required' });
    }

    const existing = await getBookingById(bookingId);
    const mergedUpdates = updates || req.body;
    const prevStatus = (existing?.status || '').toLowerCase();
    const newStatus = (mergedUpdates.status || mergedUpdates['Status'] || '').toLowerCase();

    if (prevStatus !== newStatus) {
      const guestName = mergedUpdates['Guest Name'] || mergedUpdates.guest_name || existing?.guest_name || 'Guest';
      if (newStatus === 'confirmed' || newStatus === 'booked') {
        mergedUpdates.notes = appendNote(mergedUpdates.notes || mergedUpdates['Notes'] || existing?.notes, `${bookingId} - ${guestName}: Confirmed booking`);
      } else if (newStatus === 'cancelled') {
        mergedUpdates.notes = appendNote(mergedUpdates.notes || mergedUpdates['Notes'] || existing?.notes, `${bookingId} - Cancelled`);
      }
    }

    const updated = await updateBooking(bookingId, mergedUpdates);

    if (prevStatus !== newStatus) {
      if (newStatus === 'confirmed' || newStatus === 'booked') {
        await blockDatesForBooking(updated || existing);
        sendReceiptEmail(updated || existing, { payment_method: 'update_booking' }).catch(err => {
          console.error('Error sending confirmation email on update-booking:', err);
        });
      } else if (newStatus === 'cancelled') {
        await unblockDatesForBooking(existing || updated);
        sendCancellationEmail(updated || existing, { eligible: false, refundAmount: 0 }, 'Cancelled by Administrator').catch(err => {
          console.error('Error sending cancellation email on update-booking:', err);
        });
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error in /update-booking:', err);
    logAppError({ endpoint: '/api/update-booking', req, error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global unhandled error logger middleware
router.use((err, req, res, next) => {
  try {
    if (typeof logAppError === 'function') {
      logAppError({ endpoint: req.originalUrl || req.url, method: req.method, error: err, req });
    }
  } catch (logErr) {
    console.error('Failed to log app error in router error middleware:', logErr);
  }
  console.error('Unhandled API error:', err);
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({ success: false, error: err.message || 'Internal server error' });
});

module.exports = router;
