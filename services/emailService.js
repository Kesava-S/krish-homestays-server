const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // krishhomestays@gmail.com
        pass: process.env.EMAIL_PASS, // App Password (NOT the regular password)
    },
});

async function sendConfirmationEmail(bookingDetails) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: bookingDetails.email,
        subject: 'Booking Confirmation - Krish Homestay',
        html: `
<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; padding: 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">

    <!-- Header -->
    <tr>
      <td style="background-color: #2c7be5; padding: 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0;">Krish Homestay</h1>
        <p style="color: #e8f0ff; margin: 5px 0 0;">Your stay is confirmed 🎉</p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 25px; color: #333333;">
        <h2 style="margin-top: 0;">Hello ${bookingDetails.guest_name},</h2>

        <p style="font-size: 15px; line-height: 1.6;">
          Thank you for choosing <strong>Krish Homestay</strong>.  
          We are delighted to confirm your room reservation and look forward to welcoming you.
        </p>

        <!-- Booking Card -->
        <div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: 15px; margin: 20px 0; background-color: #fafafa;">
          <h3 style="margin-top: 0; color: #2c7be5;">📋 Booking Details</h3>

          <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td><strong>Check-in</strong></td>
              <td>${bookingDetails.check_in_date}</td>
            </tr>
            <tr>
              <td><strong>Check-out</strong></td>
              <td>${bookingDetails.check_out_date}</td>
            </tr>
            <tr>
              <td><strong>Guests</strong></td>
              <td>${bookingDetails.guests_count}</td>
            </tr>
            <tr>
              <td><strong>Total Amount</strong></td>
              <td><strong>₹ ${bookingDetails.total_amount}</strong></td>
            </tr>
          </table>
        </div>

        <!-- Info -->
        <p style="font-size: 14px; line-height: 1.6;">
          🕒 <strong>Check-in time:</strong> 12:00 PM  
          <br>
          🕚 <strong>Check-out time:</strong> 11:00 AM
        </p>

        <p style="font-size: 14px; line-height: 1.6;">
          If you need any assistance, feel free to contact us anytime.
        </p>

        <!-- CTA -->
        <div style="text-align: center; margin: 25px 0;">
            <a href="tel:+917305395094"
                style="background-color: #2c7be5; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 4px; font-size: 14px; display: inline-block;">
                📞 Contact Us
            </a>
            <br><br>
            <a href="https://www.google.com/maps/place/Krish+Homestay/@10.0383318,77.0479832,16z/data=!4m9!3m8!1s0x3b07991e63ff0a19:0x52c476aa988430f1!5m2!4m1!1i2!8m2!3d10.0380809!4d77.0511524!16s%2Fg%2F11ymshxzn1?authuser=0&entry=ttu&g_ep=EgoyMDI1MTIwOS4wIKXMDSoKLDEwMDc5MjA3MUgBUAM%3D"
                target="_blank"
                style="background-color: #ff6f00; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 4px; font-size: 14px; display: inline-block;">
                📍 View on Google Maps
            </a>
        </div>

        <!-- Upsell -->
        <div style="background-color: #f0f7ff; padding: 15px; border-radius: 6px;">
          <p style="margin: 0; font-size: 14px;">
            ⭐ <strong>Make your stay special!</strong><br>
            Ask us about local sightseeing, extended stays, and special discounts on your next visit.
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f4f6f8; padding: 15px; text-align: center; font-size: 12px; color: #777;">
        <p style="margin: 0;">
          Krish Homestay • Comfortable • Peaceful • Affordable
        </p>
        <p style="margin: 5px 0 0;">
          © ${new Date().getFullYear()} Krish Homestay. All rights reserved.
        </p>
      </td>
    </tr>

  </table>
</div>


    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        return null;
    }
}

module.exports = { sendConfirmationEmail };
