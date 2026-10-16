const nodemailer = require('nodemailer');
const { generateReceiptHTML } = require('./receiptTemplate');
const { generateReceiptPDF } = require('./pdfService');
require('dotenv').config();

const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || 'krishhomestays@gmail.com';
const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
const adminEmail = process.env.ADMIN_EMAIL || smtpUser || 'krishhomestays@gmail.com';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

async function sendConfirmationEmail(bookingDetails) {
  const booking = {
    ...bookingDetails,
    booking_id: bookingDetails.booking_id || bookingDetails['Booking Id'],
    guest_name: bookingDetails.guest_name || bookingDetails['Guest Name'],
    email: bookingDetails.email || bookingDetails['Email'],
    phone: bookingDetails.phone || bookingDetails['Phone Number'],
    check_in_date: bookingDetails.check_in_date || bookingDetails['Check In Date'],
    check_out_date: bookingDetails.check_out_date || bookingDetails['Check Out Date'],
    total_amount: bookingDetails.total_amount || bookingDetails['Total Amount'] || 0,
    room_type: bookingDetails.room_type || bookingDetails['Booking Type'] || 'full',
    guests_count: bookingDetails.guests_count || bookingDetails['Guest Count'] || 1,
    adults: bookingDetails.adults || bookingDetails['Guest Adults'] || 1,
    children: bookingDetails.children || bookingDetails['Guest Children'] || 0,
  };

  const payment = bookingDetails.payment || {};
  const isAdvance = payment.payment_type === 'advance' && payment.advance_amount;
  const advancePaid = isAdvance ? Number(payment.advance_amount) : 0;
  const remaining = isAdvance ? Number(booking.total_amount) - advancePaid : 0;
  const isUPI = payment.payment_method === 'upi';

  const roomLabel = booking.room_label ||
    (booking.room_type === 'full villa' || booking.room_type === 'full' ? 'Full Villa' :
     booking.room_type === 'half villa' || booking.room_type === 'partial' ? 'Half Villa' :
     booking.room_type === 'remaining' ? 'Remaining Room' :
     booking.room_type || 'Full Villa');

  const mailOptions = {
    from: `"Krish Homestays" <${smtpUser}>`,
    to: bookingDetails.email,
    subject: 'Booking Confirmed – Krish Homestays 🎉',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; background-color:#f0f4f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

          <tr>
            <td style="background: linear-gradient(135deg, #1f6f43 0%, #2d9e60 100%); padding: 30px 40px; text-align:center;">
              <div style="margin-bottom: 16px;">
                <img src="https://krishhomestays.com/assets/logo/logo.png" alt="Krish Homestays" width="120"
                  style="height:auto; display:inline-block; background:#ffffff; border-radius:10px; padding:8px 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.15);"
                  onerror="this.style.display='none'" />
              </div>
              <h1 style="margin:0; color:#ffffff; font-size:24px; letter-spacing:1px;">Krish Homestays</h1>
              <p style="margin:6px 0 0 0; color:#a8f0c6; font-size:12px; letter-spacing:2px; text-transform:uppercase;">Munnar, Kerala</p>
            </td>
          </tr>

          <tr>
            <td style="background:#f0faf4; padding: 20px 40px; border-bottom: 1px solid #d4edda;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="40" valign="middle">
                    <div style="width:36px; height:36px; background:#1f6f43; border-radius:50%; text-align:center; line-height:36px; font-size:18px; color:#fff;">✓</div>
                  </td>
                  <td valign="middle" style="padding-left:12px;">
                    <p style="margin:0; font-size:17px; font-weight:bold; color:#1f6f43;">Booking Confirmed!</p>
                    <p style="margin:3px 0 0 0; font-size:13px; color:#555;">Your reservation is all set. We look forward to hosting you.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 35px 40px;">
              <p style="margin:0 0 20px 0; font-size:15px; color:#333;">
                Hi <strong>${bookingDetails.guest_name}</strong>,
              </p>
              <p style="margin:0 0 24px 0; font-size:15px; color:#555; line-height:1.7;">
                Thank you for choosing <strong>Krish Homestays</strong>. Your booking has been
                <strong style="color:#1f6f43;">successfully confirmed</strong> and your payment receipt
                is attached to this email.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafb; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:28px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin:0; font-size:13px; font-weight:bold; color:#1f6f43; letter-spacing:1px; text-transform:uppercase;">📋 Booking Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px; color:#333;">
                      <tr>
                        <td width="45%" style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">📋 Booking ID</td>
                        <td style="font-weight:bold; color:#1f6f43; padding: 8px 0; border-bottom:1px solid #eef0f2;">${bookingDetails.booking_id}</td>
                      </tr>
                      <tr>
                        <td style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">👤 Guest Name</td>
                        <td style="font-weight:600; padding: 8px 0; border-bottom:1px solid #eef0f2;">${bookingDetails.guest_name}</td>
                      </tr>
                      <tr>
                        <td style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">📅 Check-in</td>
                        <td style="font-weight:600; padding: 8px 0; border-bottom:1px solid #eef0f2;">${bookingDetails.check_in_date}</td>
                      </tr>
                      <tr>
                        <td style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">📅 Check-out</td>
                        <td style="font-weight:600; padding: 8px 0; border-bottom:1px solid #eef0f2;">${bookingDetails.check_out_date}</td>
                      </tr>
                      <tr>
                        <td style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">👥 Guests</td>
                        <td style="font-weight:600; padding: 8px 0; border-bottom:1px solid #eef0f2;">${bookingDetails.adults ?? bookingDetails.guests_count} Adults${bookingDetails.children ? `, ${bookingDetails.children} Children` : ''}</td>
                      </tr>
                      <tr>
                        <td style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">🏠 Room Type</td>
                        <td style="font-weight:600; color:#1f6f43; padding: 8px 0; border-bottom:1px solid #eef0f2;">${roomLabel}</td>
                      </tr>
                      ${isAdvance ? `
                      <tr>
                        <td style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">💰 Total Amount</td>
                        <td style="font-weight:600; padding: 8px 0; border-bottom:1px solid #eef0f2;">₹ ${booking.total_amount}</td>
                      </tr>
                      <tr>
                        <td style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">✅ Advance Paid</td>
                        <td style="font-weight:bold; color:#1f6f43; padding: 8px 0; border-bottom:1px solid #eef0f2;">₹ ${advancePaid}</td>
                      </tr>
                      <tr>
                        <td style="color:#b45309; font-weight:600; padding: 8px 0; border-bottom:1px solid #eef0f2;">⚠️ Remaining Balance</td>
                        <td style="font-weight:bold; color:#b45309; padding: 8px 0; border-bottom:1px solid #eef0f2;">₹ ${remaining} <span style="font-size:11px;font-weight:400;">(due at check-in)</span></td>
                      </tr>
                      ` : `
                      <tr>
                        <td style="color:#888; padding: 10px 0 0 0;">💳 Amount Paid</td>
                        <td style="font-weight:bold; font-size:17px; color:#1f6f43; padding: 10px 0 0 0;">₹ ${bookingDetails.total_amount}</td>
                      </tr>
                      `}
                      <tr>
                        <td style="color:#888; padding: 8px 0 0 0;">💳 Payment Method</td>
                        <td style="font-weight:600; color:#1f6f43; padding: 8px 0 0 0;">${isUPI ? 'UPI' : 'Cash'}${isUPI && payment.upi_transaction_id ? ` &nbsp;<span style="font-size:11px;color:#555;font-weight:400;">Txn: ${payment.upi_transaction_id}</span>` : ''}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb; border:1px solid #fcd34d; border-radius:10px; margin-bottom:28px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #fcd34d;">
                    <p style="margin:0; font-size:13px; font-weight:bold; color:#92400e; letter-spacing:1px; text-transform:uppercase;">⚠️ Cancellation & Refund Policy</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="5" cellspacing="0" style="font-size:13px; color:#78350f;">
                      <tr><td width="14" valign="top">•</td><td><strong>Up to 4 days before check-in</strong> — Free Cancellation (100% refund)</td></tr>
                      <tr><td valign="top">•</td><td><strong>Within 4 days of check-in</strong> — 50% refund</td></tr>
                      <tr><td valign="top">•</td><td><strong>No show</strong> — Full amount charged, no refund</td></tr>
                      <tr><td valign="top">•</td><td>Refunds processed within <strong>5–7 business days</strong></td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#fff5f5; border:1px solid #fecaca; border-radius:10px; padding:24px 20px; text-align:center;">
                    <p style="margin:0 0 6px 0; font-size:15px; color:#333; font-weight:700;">Need to cancel your booking?</p>
                    <p style="margin:0 0 18px 0; font-size:13px; color:#888; line-height:1.6;">
                      Click below to cancel your reservation and initiate a refund as per our policy.
                    </p>
                    <a href="${CLIENT_URL}/cancellation?booking_id=${booking.booking_id || bookingDetails.booking_id}"
                       style="display:inline-block; background:#dc2626; color:#ffffff; text-decoration:none; padding:13px 36px; border-radius:8px; font-size:14px; font-weight:bold;">
                      🚫 Cancel Booking
                    </a>
                    <p style="margin:14px 0 0 0; font-size:11px; color:#bbb;">
                      Booking ID: <strong style="color:#dc2626;">${bookingDetails.booking_id}</strong><br/>
                      Link expires 24 hours before check-in.
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#f0faf4; border:1px solid #d4edda; border-radius:10px; padding:20px;">
                    <p style="margin:0 0 14px 0; font-size:13px; font-weight:bold; color:#1f6f43; text-transform:uppercase; letter-spacing:1px;">🏡 What to Expect</p>
                    <table cellpadding="6" cellspacing="0" style="font-size:13px; color:#444; width:100%;">
                      <tr><td width="24">🕐</td><td>Check-in from <strong>12:00 PM</strong> onwards</td></tr>
                      <tr><td>🕙</td><td>Check-out by <strong>10:00 AM</strong></td></tr>
                      <tr><td>📍</td><td>Location details shared <strong>24 hours before arrival</strong></td></tr>
                      <tr><td>📱</td><td>WhatsApp us anytime for assistance</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size:15px; color:#333; margin:0;">
                Warm regards,<br/>
                <strong style="color:#1f6f43;">The Krish Homestays Team</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafb; border-top:1px solid #e2e8f0; padding: 24px 40px; text-align:center;">
              <p style="margin:0 0 6px 0; font-size:13px; color:#888;">
                📧 krishhomestays@gmail.com &nbsp;|&nbsp; 🌐 krishhomestays.com
              </p>
              <p style="margin:0 0 6px 0; font-size:12px; color:#aaa;">📍 Munnar, Kerala, India</p>
              <p style="margin:12px 0 0 0; font-size:11px; color:#bbb; line-height:1.7;">
                This is an automated confirmation email. Receipt is attached as PDF.<br/>
                © ${new Date().getFullYear()} Krish Homestays. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return null;
  }
}

async function sendReceiptEmail(bookingDetails, payment = {}) {
  const booking = {
    ...bookingDetails,
    booking_id: bookingDetails.booking_id || bookingDetails['Booking Id'],
    guest_name: bookingDetails.guest_name || bookingDetails['Guest Name'],
    email: bookingDetails.email || bookingDetails['Email'],
    phone: bookingDetails.phone || bookingDetails['Phone Number'],
    check_in_date: bookingDetails.check_in_date || bookingDetails['Check In Date'],
    check_out_date: bookingDetails.check_out_date || bookingDetails['Check Out Date'],
    total_amount: bookingDetails.total_amount || bookingDetails['Total Amount'] || 0,
    room_type: bookingDetails.room_type || bookingDetails['Booking Type'] || 'full',
    guests_count: bookingDetails.guests_count || bookingDetails['Guest Count'] || 1,
    adults: bookingDetails.adults || bookingDetails['Guest Adults'] || 1,
    children: bookingDetails.children || bookingDetails['Guest Children'] || 0,
  };

  const pdfBuffer = await generateReceiptPDF(booking, payment);

  const roomLabel = booking.room_label ||
    (booking.room_type === 'full villa' || booking.room_type === 'full' ? 'Full Villa' :
     booking.room_type === 'half villa' || booking.room_type === 'partial' ? 'Half Villa' :
     booking.room_type === 'remaining' ? 'Remaining Room' :
     booking.room_type || 'Full Villa');

  const isAdvance  = payment.payment_type === 'advance' && payment.advance_amount;
  const advancePaid = isAdvance ? Number(payment.advance_amount) : 0;
  const remaining   = isAdvance ? Number(booking.total_amount) - advancePaid : 0;
  const isUPI       = payment.payment_method === 'upi';

  const customerMail = {
    from: `"Krish Homestays" <${smtpUser}>`,
    to: booking.email,
    subject: `Booking Confirmation & Receipt – ${booking.booking_id}`,
    html: generateReceiptHTML(booking, payment),
    attachments: [
      {
        filename: `receipt_${booking.booking_id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  const adminMail = {
    from: `"Krish Homestays" <${smtpUser}>`,
    to: adminEmail,
    subject: `🏡 New Booking – ${booking.booking_id}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f0f4f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#1f6f43 0%,#2d9e60 100%);padding:24px 36px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">🏡 New Booking Arrived</p>
            <p style="margin:6px 0 0 0;color:#a8f0c6;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Krish Homestays – Internal Notification</p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 36px;">
            <p style="margin:0 0 20px 0;font-size:15px;color:#333;">A new booking has been confirmed. Details below:</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafb;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#333;margin-bottom:20px;">
              <tr><td style="padding:16px 20px;border-bottom:1px solid #eef0f2;"><strong style="color:#1f6f43;">📋 Booking ID</strong></td><td style="padding:16px 20px;border-bottom:1px solid #eef0f2;font-weight:700;color:#1f6f43;">${booking.booking_id}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">👤 Guest Name</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;font-weight:600;">${booking.guest_name}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">📧 Email</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;">${booking.email}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">📱 Phone</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;">${booking.phone}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">📅 Check-in</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;">${booking.check_in_date}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">📅 Check-out</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;">${booking.check_out_date}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">👥 Guests</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;">${booking.adults ?? booking.guests_count} Adults${booking.children ? `, ${booking.children} Children` : ''}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">🏠 Room Type</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;font-weight:700;color:#1f6f43;">${roomLabel}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">💳 Amount Paid</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;font-weight:700;font-size:16px;color:#1f6f43;">₹${booking.total_amount}</td></tr>
              <tr><td style="padding:12px 20px;color:#666;">🔑 Payment ID</td><td style="padding:12px 20px;font-size:12px;word-break:break-all;">${payment.payment_id || '—'}</td></tr>
            </table>

            <p style="font-size:13px;color:#888;margin:0;">This is an automated internal notification.${booking.email ? ` The customer's receipt has been sent to <strong>${booking.email}</strong>.` : ' (No customer email provided)'}</p>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafb;border-top:1px solid #e2e8f0;padding:16px 36px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#aaa;">© ${new Date().getFullYear()} Krish Homestays – Internal Use Only</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
  };

  try {
    const sends = [];
    if (booking.email && String(booking.email).trim()) {
      sends.push(transporter.sendMail(customerMail));
    }
    sends.push(transporter.sendMail(adminMail));
    await Promise.all(sends);
    return { success: true };
  } catch (error) {
    console.error('Error sending receipt email:', error);
    return { success: false, error: error.message };
  }
}

async function sendCancellationEmail(bookingDetails, refundInfo = {}, reason = '') {
  const refundAmount = refundInfo.refundAmount || 0;
  const isEligible = Boolean(refundInfo.eligible || refundAmount > 0);

  const booking = {
    ...bookingDetails,
    booking_id: bookingDetails.booking_id || bookingDetails['Booking Id'],
    guest_name: bookingDetails.guest_name || bookingDetails['Guest Name'],
    email: bookingDetails.email || bookingDetails['Email'],
    phone: bookingDetails.phone || bookingDetails['Phone Number'],
    check_in_date: bookingDetails.check_in_date || bookingDetails['Check In Date'],
    check_out_date: bookingDetails.check_out_date || bookingDetails['Check Out Date'],
    total_amount: bookingDetails.total_amount || bookingDetails['Total Amount'] || 0,
  };

  const customerMail = {
    from: `"Krish Homestays" <${smtpUser}>`,
    to: booking.email,
    subject: `Booking Cancellation Confirmed – ${booking.booking_id} | Krish Homestays`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; background-color:#f0f4f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); padding: 30px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; letter-spacing:1px;">Krish Homestays</h1>
              <p style="margin:6px 0 0 0; color:#fee2e2; font-size:12px; letter-spacing:2px; text-transform:uppercase;">Munnar, Kerala</p>
            </td>
          </tr>
          <tr>
            <td style="background:#fef2f2; padding: 20px 40px; border-bottom: 1px solid #fecaca;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="40" valign="middle">
                    <div style="width:36px; height:36px; background:#dc2626; border-radius:50%; text-align:center; line-height:36px; font-size:18px; color:#fff;">✕</div>
                  </td>
                  <td valign="middle" style="padding-left:12px;">
                    <p style="margin:0; font-size:17px; font-weight:bold; color:#dc2626;">Booking Cancelled</p>
                    <p style="margin:3px 0 0 0; font-size:13px; color:#555;">Your reservation has been successfully cancelled as requested.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 35px 40px;">
              <p style="margin:0 0 20px 0; font-size:15px; color:#333;">
                Hi <strong>${booking.guest_name}</strong>,
              </p>
              <p style="margin:0 0 24px 0; font-size:15px; color:#555; line-height:1.7;">
                This email confirms that your booking <strong>${booking.booking_id}</strong> has been cancelled.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafb; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:24px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin:0; font-size:13px; font-weight:bold; color:#1e293b; text-transform:uppercase;">Cancelled Reservation Summary</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px; color:#333;">
                      <tr>
                        <td width="45%" style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">📋 Booking ID</td>
                        <td style="font-weight:bold; color:#dc2626; padding: 8px 0; border-bottom:1px solid #eef0f2;">${booking.booking_id}</td>
                      </tr>
                      <tr>
                        <td style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">📅 Check-in</td>
                        <td style="font-weight:600; padding: 8px 0; border-bottom:1px solid #eef0f2;">${booking.check_in_date}</td>
                      </tr>
                      <tr>
                        <td style="color:#888; padding: 8px 0; border-bottom:1px solid #eef0f2;">📅 Check-out</td>
                        <td style="font-weight:600; padding: 8px 0; border-bottom:1px solid #eef0f2;">${booking.check_out_date}</td>
                      </tr>
                      <tr>
                        <td style="color:#888; padding: 8px 0;">💳 Total Amount Paid</td>
                        <td style="font-weight:600; padding: 8px 0;">₹${booking.total_amount || 0}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="background:${isEligible ? '#ecfdf5' : '#f8fafc'}; border:1px solid ${isEligible ? '#a7f3d0' : '#e2e8f0'}; border-radius:10px; padding:20px; margin-bottom:28px;">
                <p style="margin:0 0 6px 0; font-size:15px; font-weight:bold; color:${isEligible ? '#065f46' : '#334155'};">
                  ${isEligible ? '💰 Refund Information' : 'ℹ️ Refund Policy Notice'}
                </p>
                <p style="margin:0; font-size:14px; color:${isEligible ? '#047857' : '#64748b'}; line-height:1.6;">
                  ${isEligible
                    ? `A refund of <strong>₹${refundAmount}</strong> (${refundInfo.refundPercent || ''}%) will be credited to your original payment method within <strong>5–7 business days</strong>.`
                    : `As per our cancellation policy, no refund is applicable for this cancellation.`}
                </p>
              </div>

              <p style="margin:0; font-size:14px; color:#666; line-height:1.6;">
                If you have questions, reply directly to this email or reach us on WhatsApp at <strong>+91 94473 12345</strong>. We hope to welcome you at Krish Homestays in the future!
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafb; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#aaa;">📍 Munnar, Kerala, India • © ${new Date().getFullYear()} Krish Homestays</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  };

  const adminMail = {
    from: `"Krish Homestays" <${smtpUser}>`,
    to: adminEmail,
    subject: `⚠️ Booking Cancelled – ${booking.booking_id} (${booking.guest_name})`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f0f4f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#b91c1c 0%,#dc2626 100%);padding:24px 36px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">⚠️ Booking Cancelled</p>
            <p style="margin:6px 0 0 0;color:#fee2e2;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Krish Homestays – Admin Alert</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px;">
            <p style="margin:0 0 20px 0;font-size:15px;color:#333;">The following booking has been marked <strong>Cancelled</strong> and calendar dates have been freed:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafb;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#333;margin-bottom:20px;">
              <tr><td style="padding:14px 20px;border-bottom:1px solid #eef0f2;color:#666;">📋 Booking ID</td><td style="padding:14px 20px;border-bottom:1px solid #eef0f2;font-weight:700;color:#dc2626;">${booking.booking_id}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">👤 Guest Name</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;font-weight:600;">${booking.guest_name}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">📧 Email</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;">${booking.email}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">📱 Phone</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;">${booking.phone || '—'}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">📅 Dates</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;">${booking.check_in_date} to ${booking.check_out_date}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">💳 Amount Paid</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;font-weight:600;">₹${booking.total_amount || 0}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;color:#666;">💰 Refund to Process</td><td style="padding:12px 20px;border-bottom:1px solid #eef0f2;font-weight:700;color:${isEligible ? '#dc2626' : '#64748b'};">${isEligible ? `₹${refundAmount} (${refundInfo.refundPercent || 0}%)` : 'No refund'}</td></tr>
              <tr><td style="padding:12px 20px;color:#666;">📝 Cancellation Reason</td><td style="padding:12px 20px;">${reason || 'Customer initiated via website'}</td></tr>
            </table>
            <p style="font-size:13px;color:#888;margin:0;">The dates have been unblocked automatically in your calendar. If a refund is due, please process it through your Razorpay dashboard.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  };

  try {
    await Promise.all([
      transporter.sendMail(customerMail),
      transporter.sendMail(adminMail)
    ]);
    return { success: true };
  } catch (error) {
    console.error('Error sending cancellation email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendConfirmationEmail, sendReceiptEmail, sendCancellationEmail };
