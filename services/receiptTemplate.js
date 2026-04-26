function generateReceiptHTML(booking, payment = {}) {
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const year = new Date().getFullYear();
  const roomLabel = booking.room_label ||
    (booking.room_type === 'full villa' || booking.room_type === 'full' ? 'Full Villa' :
     booking.room_type === 'half villa' || booking.room_type === 'partial' ? 'Half Villa' :
     booking.room_type === 'remaining' ? 'Remaining Room' :
     booking.room_type || 'Full Villa');

  const isAdvance = payment.payment_type === 'advance' && payment.advance_amount;
  const advancePaid = isAdvance ? Number(payment.advance_amount) : 0;
  const remaining   = isAdvance ? Number(booking.total_amount) - advancePaid : 0;
  const isUPI       = payment.payment_method === 'upi';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Booking Receipt – Krish Homestays</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f8;padding:30px 0;">
    <tr>
      <td align="center" valign="top">

        <!-- Card -->
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);max-width:640px;">

          <!-- ══ HEADER ══ -->
          <tr>
            <td style="background:linear-gradient(135deg,#1f6f43 0%,#2d9e60 100%);padding:32px 40px 24px 40px;text-align:center;">
              <img src="https://krishhomestays.com/assets/logo/logo.png"
                   alt="Krish Homestays"
                   width="120" height="auto"
                   style="display:inline-block;background:#ffffff;border-radius:10px;padding:8px 18px;box-shadow:0 2px 10px rgba(0,0,0,0.15);margin-bottom:14px;"
                   onerror="this.style.display='none'" />
              <br/>
              <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:1px;">Krish Homestays</span>
              <br/>
              <span style="color:#a8f0c6;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Munnar, Kerala, India</span>
              <br/><br/>
              <span style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:20px;padding:6px 20px;">
                <span style="color:#d1fae5;font-size:11px;letter-spacing:1px;">TAX INVOICE</span>
                <span style="color:rgba(255,255,255,0.4);margin:0 8px;">|</span>
                <span style="color:#ffffff;font-size:11px;font-weight:bold;">${date}</span>
              </span>
            </td>
          </tr>

          <!-- ══ STATUS BANNER ══ -->
          <tr>
            <td style="background:#f0faf4;border-bottom:2px solid #1f6f43;padding:14px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <span style="display:inline-block;background:${isAdvance ? '#d97706' : '#1f6f43'};color:#ffffff;font-size:12px;font-weight:bold;padding:6px 16px;border-radius:20px;letter-spacing:1px;">&#10003;&nbsp;&nbsp;${isAdvance ? 'ADVANCE RECEIVED' : 'PAYMENT CONFIRMED'}</span>
                  </td>
                  <td valign="middle" align="right" style="font-size:13px;color:#555555;">
                    Booking Ref:&nbsp;<strong style="color:#1f6f43;">${booking.booking_id}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══ BODY ══ -->
          <tr>
            <td style="padding:32px 40px;">

              <!-- ── Info Grid ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr valign="top">

                  <!-- Billed To -->
                  <td width="48%" style="background:#f8fafb;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:bold;color:#1f6f43;letter-spacing:1.5px;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;">&#128100; Billed To</div>
                    <div style="margin-bottom:8px;">
                      <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Guest Name</div>
                      <div style="font-size:13px;color:#222222;font-weight:600;">${booking.guest_name}</div>
                    </div>
                    <div style="margin-bottom:8px;">
                      <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Email</div>
                      <div style="font-size:13px;color:#222222;font-weight:600;word-break:break-all;">${booking.email}</div>
                    </div>
                    <div style="margin-bottom:8px;">
                      <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Phone</div>
                      <div style="font-size:13px;color:#222222;font-weight:600;">${booking.phone}</div>
                    </div>
                    <div>
                      <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Guests</div>
                      <div style="font-size:13px;color:#222222;font-weight:600;">${booking.adults ?? booking.guests_count} Adults${booking.children ? `, ${booking.children} Children` : ''}</div>
                    </div>
                  </td>

                  <td width="4%">&nbsp;</td>

                  <!-- Property Details -->
                  <td width="48%" style="background:#f8fafb;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:bold;color:#1f6f43;letter-spacing:1.5px;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;">&#127968; Property Details</div>
                    <div style="margin-bottom:8px;">
                      <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Property</div>
                      <div style="font-size:13px;color:#222222;font-weight:600;">Krish Homestays</div>
                    </div>
                    <div style="margin-bottom:8px;">
                      <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Location</div>
                      <div style="font-size:13px;color:#222222;font-weight:600;">Munnar, Kerala</div>
                    </div>
                    <div style="margin-bottom:8px;">
                      <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Check-in</div>
                      <div style="font-size:13px;color:#222222;font-weight:600;">&#128197; ${booking.check_in_date}</div>
                    </div>
                    <div style="margin-bottom:8px;">
                      <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Check-out</div>
                      <div style="font-size:13px;color:#222222;font-weight:600;">&#128197; ${booking.check_out_date}</div>
                    </div>
                    <div>
                      <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Room Type</div>
                      <div style="font-size:13px;color:#1f6f43;font-weight:700;">&#127968; ${roomLabel}</div>
                    </div>
                  </td>

                </tr>
              </table>

              <!-- ── Stay Charges ── -->
              <div style="font-size:10px;font-weight:bold;color:#1f6f43;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">&#128716; Stay Charges</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:28px;font-size:13px;">
                <thead>
                  <tr style="background:#1f6f43;color:#ffffff;">
                    <td style="padding:10px 12px;font-size:11px;font-weight:bold;letter-spacing:0.5px;border-radius:0;">Description</td>
                    <td style="padding:10px 12px;font-size:11px;font-weight:bold;">Check-in</td>
                    <td style="padding:10px 12px;font-size:11px;font-weight:bold;">Check-out</td>
                    <td style="padding:10px 12px;font-size:11px;font-weight:bold;">Guests</td>
                    <td style="padding:10px 12px;font-size:11px;font-weight:bold;text-align:right;">Amount</td>
                  </tr>
                </thead>
                <tbody>
                  <tr style="background:#f8fafb;border-bottom:1px solid #f0f0f0;">
                    <td style="padding:12px 12px;color:#444444;">Homestay Accommodation<br/><span style="font-size:11px;color:#1f6f43;font-weight:600;">${roomLabel}</span></td>
                    <td style="padding:12px 12px;color:#444444;">${booking.check_in_date}</td>
                    <td style="padding:12px 12px;color:#444444;">${booking.check_out_date}</td>
                    <td style="padding:12px 12px;color:#444444;">${booking.adults ?? booking.guests_count}A${booking.children ? ` + ${booking.children}C` : ''}</td>
                    <td style="padding:12px 12px;color:#1f6f43;font-weight:600;text-align:right;">&#8377;${booking.total_amount}</td>
                  </tr>
                </tbody>
              </table>

              <!-- ── Payment Summary ── -->
              <div style="font-size:10px;font-weight:bold;color:#1f6f43;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">&#128179; Payment Summary</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafb;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:${isAdvance ? '12px' : '28px'};">
                ${isAdvance ? `
                <tr>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;border-bottom:1px solid #eef0f2;">Total Stay Amount</td>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;border-bottom:1px solid #eef0f2;text-align:right;">&#8377;${booking.total_amount}</td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;border-bottom:1px solid #eef0f2;">Advance Paid</td>
                  <td style="padding:12px 20px;font-size:13px;font-weight:600;color:#1f6f43;border-bottom:1px solid #eef0f2;text-align:right;">&#8377;${advancePaid}</td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;font-size:13px;font-weight:600;color:#b45309;border-bottom:1px solid #eef0f2;">Remaining Balance</td>
                  <td style="padding:12px 20px;font-size:13px;font-weight:700;color:#b45309;border-bottom:1px solid #eef0f2;text-align:right;">&#8377;${remaining}</td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;">Taxes &amp; Fees</td>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;text-align:right;">Included</td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;font-size:15px;font-weight:bold;color:#ffffff;background:#d97706;">ADVANCE PAID</td>
                  <td style="padding:16px 20px;font-size:15px;font-weight:bold;color:#ffffff;background:#d97706;text-align:right;">&#8377;${advancePaid}</td>
                </tr>
                ` : `
                <tr>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;border-bottom:1px solid #eef0f2;">Subtotal</td>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;border-bottom:1px solid #eef0f2;text-align:right;">&#8377;${booking.total_amount}</td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;border-bottom:1px solid #eef0f2;">Taxes &amp; Fees</td>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;border-bottom:1px solid #eef0f2;text-align:right;">Included</td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;">Discount</td>
                  <td style="padding:12px 20px;font-size:13px;color:#555555;text-align:right;">&#8212;</td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;font-size:15px;font-weight:bold;color:#ffffff;background:#1f6f43;">TOTAL AMOUNT PAID</td>
                  <td style="padding:16px 20px;font-size:15px;font-weight:bold;color:#ffffff;background:#1f6f43;text-align:right;">&#8377;${booking.total_amount}</td>
                </tr>
                `}
              </table>

              ${isAdvance ? `
              <!-- ── Balance Due Banner ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                <tr>
                  <td style="padding:10px 20px;border-bottom:1px solid #fcd34d;">
                    <span style="font-size:10px;font-weight:bold;color:#92400e;letter-spacing:1.5px;text-transform:uppercase;">&#9888;&#65039; Balance Due at Check-in</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;font-size:13px;color:#78350f;line-height:1.7;">
                    Please pay the remaining balance of <strong style="color:#b45309;">&#8377;${remaining}</strong> before or during check-in on <strong>${booking.check_in_date}</strong>.
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- ── Transaction Details ── -->
              <div style="background:#f0faf4;border:1px solid #d4edda;border-radius:10px;padding:18px 20px;margin-bottom:28px;">
                <div style="font-size:10px;font-weight:bold;color:#1f6f43;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #d4edda;">&#128274; Transaction Details</div>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr valign="top">
                    <td width="50%" style="padding-bottom:12px;">
                      <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Payment Method</div>
                      <div style="font-size:12px;color:#1f6f43;font-weight:700;">${isUPI ? 'UPI' : 'Cash'}</div>
                    </td>
                    <td width="50%" style="padding-bottom:12px;">
                      <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Payment Type</div>
                      <div style="font-size:12px;color:#1f6f43;font-weight:700;">${isAdvance ? 'Advance' : 'Full Payment'}</div>
                    </td>
                  </tr>
                  ${isUPI ? `
                  <tr valign="top">
                    <td width="50%" style="padding-bottom:12px;" colspan="2">
                      <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">UPI Transaction ID</div>
                      <div style="font-size:12px;color:#222222;font-weight:600;word-break:break-all;">${payment.upi_transaction_id || '&mdash;'}</div>
                    </td>
                  </tr>
                  ` : ''}
                  <tr valign="top">
                    <td width="50%" style="padding-bottom:12px;">
                      <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Payment Status</div>
                      <div style="font-size:12px;color:${isAdvance ? '#d97706' : '#1f6f43'};font-weight:700;">&#10003; ${isAdvance ? 'ADVANCE PAID' : 'PAID IN FULL'}</div>
                    </td>
                    <td width="50%" style="padding-bottom:12px;">
                      <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Currency</div>
                      <div style="font-size:12px;color:#222222;font-weight:600;">${payment.currency || 'INR'}</div>
                    </td>
                  </tr>
                  <tr valign="top">
                    <td width="50%">
                      <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Date</div>
                      <div style="font-size:12px;color:#222222;font-weight:600;">${new Date().toLocaleDateString('en-IN')}</div>
                    </td>
                    <td width="50%"></td>
                  </tr>
                </table>
              </div>

              <!-- ── Cancellation Policy ── -->
              <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:18px 20px;margin-bottom:28px;">
                <div style="font-size:10px;font-weight:bold;color:#92400e;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">&#9888;&#65039; Cancellation &amp; Refund Policy</div>
                <table cellpadding="0" cellspacing="0" border="0" style="font-size:12px;color:#78350f;line-height:1.9;">
                  <tr><td style="padding-right:8px;vertical-align:top;">&bull;</td><td><strong>Up to 4 days before check-in</strong> &mdash; Free Cancellation (100% refund)</td></tr>
                  <tr><td style="padding-right:8px;vertical-align:top;">&bull;</td><td><strong>Within 4 days of check-in</strong> &mdash; 50% refund</td></tr>
                  <tr><td style="padding-right:8px;vertical-align:top;">&bull;</td><td><strong>No show</strong> &mdash; Full amount charged, no refund</td></tr>
                </table>
              </div>

              <!-- ── Cancel Booking ── -->
              <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:20px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 6px 0;font-size:14px;color:#333;font-weight:700;">Need to cancel your booking?</p>
                <p style="margin:0 0 16px 0;font-size:12px;color:#888;line-height:1.6;">Click below to cancel your reservation and initiate a refund as per our policy.</p>
                <a href="https://krishhomestays.com/cancellation"
                   style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:13px;font-weight:bold;">
                  &#128683; Cancel Booking
                </a>
                <p style="margin:12px 0 0 0;font-size:11px;color:#bbb;">
                  Booking ID: <strong style="color:#dc2626;">${booking.booking_id}</strong>
                </p>
              </div>

              <!-- ── Paid Stamp ── -->
              <div style="text-align:center;margin-bottom:28px;padding:10px;border:2px dashed ${isAdvance ? '#fcd34d' : '#d4edda'};border-radius:8px;color:${isAdvance ? '#d97706' : '#1f6f43'};font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">
                &#10003;&nbsp;&nbsp;${isAdvance ? 'Advance Received' : 'Paid in Full'}&nbsp;&nbsp;&#10003;
              </div>

              <!-- ── Note ── -->
              <p style="font-size:13px;color:#666666;line-height:1.7;margin-bottom:24px;">
                Thank you for choosing <strong>Krish Homestays</strong>. Please carry this receipt
                during your stay. For any queries, reply to this email or contact us on WhatsApp.
                We look forward to welcoming you!
              </p>

              <p style="font-size:13px;color:#333333;margin:0;">
                Warm regards,<br/>
                <strong style="color:#1f6f43;">The Krish Homestays Team</strong>
              </p>

            </td>
          </tr>

          <!-- ══ FOOTER ══ -->
          <tr>
            <td style="background:#f8fafb;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
              <img src="https://krishhomestays.com/assets/logo/logo.png"
                   alt="Krish Homestays"
                   width="70" height="auto"
                   style="display:inline-block;opacity:0.7;margin-bottom:10px;"
                   onerror="this.style.display='none'" />
              <div style="font-size:14px;font-weight:bold;color:#1f6f43;margin-bottom:6px;">Krish Homestays</div>
              <div style="font-size:11px;color:#999999;line-height:1.9;">
                &#128231; krishhomestays@gmail.com &nbsp;|&nbsp; &#127760; krishhomestays.com<br/>
                &#128205; Munnar, Kerala, India<br/><br/>
                This is a computer-generated receipt and does not require a physical signature.<br/>
                &copy; ${year} Krish Homestays. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

module.exports = { generateReceiptHTML };