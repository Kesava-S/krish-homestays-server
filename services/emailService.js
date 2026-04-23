const nodemailer = require('nodemailer');
const { generateReceiptHTML } = require('./receiptTemplate');
const { generateReceiptPDF } = require('./pdfService');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // krishhomestays@gmail.com
    pass: process.env.EMAIL_PASS, // App Password (NOT the regular password)
  },
});

async function sendConfirmationEmail(bookingDetails) {
  const roomLabel = bookingDetails.room_label ||
    (bookingDetails.room_type === 'full villa' || bookingDetails.room_type === 'full' ? 'Full Villa' :
     bookingDetails.room_type === 'half villa' || bookingDetails.room_type === 'partial' ? 'Half Villa' :
     bookingDetails.room_type === 'remaining' ? 'Remaining Room' :
     bookingDetails.room_type || 'Full Villa');

  const mailOptions = {
    from: `"Krish Homestays" <${process.env.EMAIL_USER}>`,
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
                      <tr>
                        <td style="color:#888; padding: 10px 0 0 0;">💳 Amount Paid</td>
                        <td style="font-weight:bold; font-size:17px; color:#1f6f43; padding: 10px 0 0 0;">₹ ${bookingDetails.total_amount}</td>
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
                    <a href="https://krishhomestays.com/cancellation"
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

async function sendReceiptEmail(booking, payment = {}) {
  const pdfBuffer = await generateReceiptPDF(booking, payment);

  const roomLabel = booking.room_label ||
    (booking.room_type === 'full villa' || booking.room_type === 'full' ? 'Full Villa' :
     booking.room_type === 'half villa' || booking.room_type === 'partial' ? 'Half Villa' :
     booking.room_type === 'remaining' ? 'Remaining Room' :
     booking.room_type || 'Full Villa');

  const customerMail = {
    from: `"Krish Homestays" <${process.env.EMAIL_USER}>`,
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
    from: `"Krish Homestays" <${process.env.EMAIL_USER}>`,
    to: 'admin@krishhomestays.com',
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

            <p style="font-size:13px;color:#888;margin:0;">This is an automated internal notification. The customer's receipt has been sent to <strong>${booking.email}</strong>.</p>
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
    await Promise.all([
      transporter.sendMail(customerMail),
      transporter.sendMail(adminMail)
    ]);
    return { success: true };
  } catch (error) {
    console.error('Error sending receipt email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendConfirmationEmail, sendReceiptEmail };
