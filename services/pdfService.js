const PDFDocument = require('pdfkit');

function generateReceiptPDF(booking, payment = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width;   // 595
    const H = doc.page.height;  // 842
    const M = 36; // side margin
    const CW = W - M * 2;       // content width

    const green      = '#1f6f43';
    const greenLight = '#2d9e60';
    const bgGreen    = '#f0faf4';
    const borderGreen= '#d4edda';
    const gray       = '#555555';
    const lightGray  = '#f8fafb';
    const borderGray = '#e2e8f0';
    const amber      = '#fffbeb';
    const amberBorder= '#fcd34d';
    const amberText  = '#78350f';
    const amberTitle = '#92400e';

    // ─────────────────────────────────────────
    // HEADER — green gradient block
    // ─────────────────────────────────────────
    doc.rect(0, 0, W, 110).fill(green);

    // Subtle diagonal stripe for gradient feel
    doc.save();
    doc.rect(0, 0, W, 110).clip();
    for (let i = 0; i < 12; i++) {
      doc.moveTo(W * 0.4 + i * 30, 0).lineTo(W + i * 30, 110)
         .lineWidth(18).strokeColor(greenLight).strokeOpacity(0.25).stroke();
    }
    doc.restore();
    doc.strokeOpacity(1);

    // Logo circle placeholder
    doc.circle(M + 22, 36, 22).fill('white');
    doc.fillColor(green).fontSize(10).font('Helvetica-Bold').text('KH', M + 14, 31);

    // Title
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
       .text('Krish Homestays', M + 54, 22);
    doc.fontSize(9).font('Helvetica').fillColor('#a8f0c6')
       .text('MUNNAR, KERALA, INDIA', M + 54, 46, { characterSpacing: 1.5 });

    // Invoice pill
    const pillText = `TAX INVOICE  |  ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    doc.roundedRect(M + 54, 62, 220, 18, 9).fillOpacity(0.15).fill('white').fillOpacity(1);
    doc.fillColor('white').fontSize(8).font('Helvetica')
       .text(pillText, M + 62, 67);

    // ─────────────────────────────────────────
    // STATUS BANNER
    // ─────────────────────────────────────────
    doc.rect(0, 110, W, 36).fill(bgGreen);
    doc.rect(0, 146, W, 1).fill(borderGreen);

    // Green check circle
    doc.circle(M + 14, 128, 12).fill(green);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text('✓', M + 10, 123);

    doc.fillColor(green).fontSize(12).font('Helvetica-Bold')
       .text('Booking Confirmed!', M + 32, 121);
    doc.fillColor(gray).fontSize(8).font('Helvetica')
       .text('Your reservation is all set. We look forward to hosting you.', M + 32, 134);

    // Booking ref — right side
    doc.fillColor(gray).fontSize(9).font('Helvetica')
       .text(`Booking Ref: `, W - M - 160, 121, { continued: true });
    doc.fillColor(green).font('Helvetica-Bold')
       .text(booking.booking_id, { continued: false });

    // ─────────────────────────────────────────
    // TWO COLUMN INFO BOXES
    // ─────────────────────────────────────────
    const boxY = 158;
    const boxH = 120;
    const halfW = (CW - 10) / 2;

    // Left box — Billed To
    doc.roundedRect(M, boxY, halfW, boxH, 6).fill(lightGray).stroke(borderGray);
    // Box header bar
    doc.rect(M, boxY, halfW, 20).fill(green).undash();
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
       .text('BILLED TO', M + 10, boxY + 6, { characterSpacing: 1 });

    const bRows = [
      ['Guest Name', booking.guest_name],
      ['Email',      booking.email],
      ['Phone',      booking.phone],
      ['Guests', `${booking.adults ?? booking.guests_count} Adults${booking.children ? ` + ${booking.children} Children` : ''}`],
    ];
    bRows.forEach(([label, val], i) => {
      const ry = boxY + 26 + i * 22;
      doc.fillColor('#999').fontSize(7.5).font('Helvetica')
         .text(label.toUpperCase(), M + 10, ry, { characterSpacing: 0.4 });
      doc.fillColor('#222').fontSize(9).font('Helvetica-Bold')
         .text(String(val), M + 10, ry + 9, { width: halfW - 20 });
    });

    // Right box — Property Details
    const rx = M + halfW + 10;
    doc.roundedRect(rx, boxY, halfW, boxH, 6).fill(lightGray).stroke(borderGray);
    doc.rect(rx, boxY, halfW, 20).fill(green);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
       .text('PROPERTY DETAILS', rx + 10, boxY + 6, { characterSpacing: 1 });

    const pRows = [
      ['Property',  'Krish Homestays'],
      ['Location',  'Munnar, Kerala'],
      ['Check-in',  booking.check_in_date],
      ['Check-out', booking.check_out_date],
    ];
    pRows.forEach(([label, val], i) => {
      const ry = boxY + 26 + i * 22;
      doc.fillColor('#999').fontSize(7.5).font('Helvetica')
         .text(label.toUpperCase(), rx + 10, ry, { characterSpacing: 0.4 });
      doc.fillColor('#222').fontSize(9).font('Helvetica-Bold')
         .text(String(val), rx + 10, ry + 9, { width: halfW - 20 });
    });

    // ─────────────────────────────────────────
    // STAY CHARGES TABLE
    // ─────────────────────────────────────────
    let cy = boxY + boxH + 14;

    // Section label
    doc.fillColor(green).fontSize(9).font('Helvetica-Bold')
       .text('STAY CHARGES', M, cy, { characterSpacing: 1 });
    doc.rect(M, cy + 12, CW, 1).fill(borderGreen);
    cy += 16;

    // Table header
    doc.rect(M, cy, CW, 20).fill(green);
    const cols = [
      { label: 'Description',           x: M + 8,   w: 160 },
      { label: 'Check-in',              x: M + 168,  w: 80  },
      { label: 'Check-out',             x: M + 248,  w: 80  },
      { label: 'Guests',                x: M + 328,  w: 50  },
      { label: 'Amount',                x: M + 378,  w: CW - 386, align: 'right' },
    ];
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
    cols.forEach(c => doc.text(c.label, c.x, cy + 6, { width: c.w, align: c.align || 'left' }));
    cy += 20;

    // Table row
    doc.rect(M, cy, CW, 22).fill(lightGray).stroke(borderGray);
    doc.fillColor('#333').fontSize(8.5).font('Helvetica');
    doc.text('Homestay Accommodation',    M + 8,   cy + 7, { width: 160 });
    doc.text(booking.check_in_date,       M + 168, cy + 7, { width: 80  });
    doc.text(booking.check_out_date,      M + 248, cy + 7, { width: 80  });
    doc.text(`${booking.adults ?? booking.guests_count}A${booking.children ? `+${booking.children}C` : ''}`, M + 328, cy + 7, { width: 50 });
    doc.fillColor(green).font('Helvetica-Bold')
       .text(`Rs.${booking.total_amount}`, M + 378, cy + 7, { width: CW - 386, align: 'right' });
    cy += 30;

    // ─────────────────────────────────────────
    // PAYMENT SUMMARY
    // ─────────────────────────────────────────
    const isAdvance = payment.payment_type === 'advance' && payment.advance_amount;
    const advancePaid = isAdvance ? Number(payment.advance_amount) : 0;
    const remaining   = isAdvance ? Number(booking.total_amount) - advancePaid : 0;
    const amber2      = '#f59e0b';
    const amberDeep   = '#b45309';
    const amberBg2    = '#fffbeb';
    const amberBdr2   = '#fcd34d';

    doc.fillColor(green).fontSize(9).font('Helvetica-Bold')
       .text('PAYMENT SUMMARY', M, cy, { characterSpacing: 1 });
    doc.rect(M, cy + 12, CW, 1).fill(borderGreen);
    cy += 16;

    const summaryBox = isAdvance
      ? [
          ['Total Stay Amount',  `Rs.${booking.total_amount}`],
          ['Advance Paid',       `Rs.${advancePaid}`],
          ['Remaining Balance',  `Rs.${remaining}`],
          ['Taxes & Fees',       'Included'],
        ]
      : [
          ['Subtotal',     `Rs.${booking.total_amount}`],
          ['Taxes & Fees', 'Included'],
          ['Discount',     '—'],
        ];

    doc.roundedRect(M, cy, CW, summaryBox.length * 20 + 30, 6)
       .fill(lightGray).stroke(borderGray);

    summaryBox.forEach(([label, val], i) => {
      const ry = cy + 8 + i * 20;
      if (i > 0) doc.rect(M + 8, ry - 1, CW - 16, 0.5).fill(borderGray);
      const isRemainder = label === 'Remaining Balance';
      doc.fillColor(isRemainder ? amberDeep : gray).fontSize(9).font('Helvetica')
         .text(label, M + 12, ry + 4);
      doc.fillColor(isRemainder ? amberDeep : '#333').font(isRemainder ? 'Helvetica-Bold' : 'Helvetica')
         .text(val, M, ry + 4, { width: CW - 12, align: 'right' });
    });
    cy += summaryBox.length * 20 + 12;

    // Total row — green for full payment, amber for advance
    if (isAdvance) {
      doc.roundedRect(M, cy, CW, 28, 6).fill(amber2);
      doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
         .text('ADVANCE PAID', M + 12, cy + 8);
      doc.text(`Rs.${advancePaid}`, M, cy + 8, { width: CW - 12, align: 'right' });
    } else {
      doc.roundedRect(M, cy, CW, 28, 6).fill(green);
      doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
         .text('TOTAL AMOUNT PAID', M + 12, cy + 8);
      doc.text(`Rs.${booking.total_amount}`, M, cy + 8, { width: CW - 12, align: 'right' });
    }
    cy += 36;

    // Balance due banner — shown only for advance payments
    if (isAdvance) {
      const bannerH = 48;
      doc.roundedRect(M, cy, CW, bannerH, 6).fill(amberBg2).stroke(amberBdr2);
      doc.fillColor('#92400e').fontSize(8.5).font('Helvetica-Bold')
         .text('BALANCE DUE AT CHECK-IN', M + 12, cy + 8, { characterSpacing: 0.5 });
      doc.fillColor(amberDeep).fontSize(9).font('Helvetica')
         .text(
           `Please pay the remaining balance of Rs.${remaining} before or during check-in on ${booking.check_in_date}.`,
           M + 12, cy + 22, { width: CW - 24 }
         );
      cy += bannerH + 10;
    }

    // ─────────────────────────────────────────
    // TRANSACTION DETAILS (2-column grid)
    // ─────────────────────────────────────────
    doc.fillColor(green).fontSize(9).font('Helvetica-Bold')
       .text('TRANSACTION DETAILS', M, cy, { characterSpacing: 1 });
    doc.rect(M, cy + 12, CW, 1).fill(borderGreen);
    cy += 16;

    const isUPI = payment.payment_method === 'upi';
    const txItems = [
      ['Payment Method',  isUPI ? 'UPI' : 'Cash'],
      ...(isUPI ? [['UPI Transaction ID', payment.upi_transaction_id || '—']] : []),
      ['Payment Type',    isAdvance ? 'Advance' : 'Full Payment'],
      ['Payment Status',  isAdvance ? 'ADVANCE PAID' : 'PAID IN FULL'],
      ['Currency',        payment.currency || 'INR'],
      ['Date',            new Date().toLocaleDateString('en-IN')],
    ];

    const txBoxH = Math.ceil(txItems.length / 2) * 36 + 16;
    doc.roundedRect(M, cy, CW, txBoxH, 6).fill(bgGreen).stroke(borderGreen);

    txItems.forEach(([label, val], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ix = M + 12 + col * (CW / 2);
      const iy = cy + 10 + row * 36;
      doc.fillColor('#888').fontSize(7.5).font('Helvetica')
         .text(label.toUpperCase(), ix, iy, { characterSpacing: 0.4 });
      const isStatus = label === 'Payment Status' || label === 'Payment Type' || label === 'Payment Method';
      doc.fillColor(isStatus ? green : '#222').fontSize(9)
         .font('Helvetica-Bold').text(val, ix, iy + 10, { width: CW / 2 - 20 });
    });
    cy += txBoxH + 12;

    // ─────────────────────────────────────────
    // CANCELLATION POLICY
    // ─────────────────────────────────────────
    const policyH = 72;
    doc.roundedRect(M, cy, CW, policyH, 6).fill(amber).stroke(amberBorder);
    doc.fillColor(amberTitle).fontSize(8).font('Helvetica-Bold')
       .text('CANCELLATION & REFUND POLICY', M + 12, cy + 10, { characterSpacing: 1 });
    const policies = [
      'Up to 4 days before check-in — Free Cancellation (100% refund)',
      'Within 4 days of check-in — 50% refund',
      'No show — Full amount charged, no refund',
    ];
    doc.fillColor(amberText).fontSize(8.5).font('Helvetica');
    policies.forEach((p, i) => {
      doc.text(`• ${p}`, M + 12, cy + 24 + i * 14, { width: CW - 24 });
    });
    cy += policyH + 10;

    // ─────────────────────────────────────────
    // PAID STAMP
    // ─────────────────────────────────────────
    doc.roundedRect(M, cy, CW, 26, 13)
       .dash(4, { space: 3 }).stroke(isAdvance ? amberBdr2 : borderGreen).undash();
    doc.fillColor(isAdvance ? amber2 : green).fontSize(11).font('Helvetica-Bold')
       .text(isAdvance ? '✓   ADVANCE RECEIVED   ✓' : '✓   PAID IN FULL   ✓', M, cy + 7, { width: CW, align: 'center' });
    cy += 34;

    // ─────────────────────────────────────────
    // SIGN OFF
    // ─────────────────────────────────────────
    doc.fillColor(gray).fontSize(8.5).font('Helvetica')
       .text(
         'Thank you for choosing Krish Homestays. Please carry this receipt during your stay.\nFor any queries, reply to this email or contact us on WhatsApp.',
         M, cy, { width: CW }
       );
    cy += 36;
    doc.fillColor('#333').fontSize(9).font('Helvetica')
       .text('Warm regards,', M, cy);
    doc.fillColor(green).font('Helvetica-Bold')
       .text('The Krish Homestays Team', M, cy + 12);

    // ─────────────────────────────────────────
    // FOOTER
    // ─────────────────────────────────────────
    const footerY = H - 58;
    doc.rect(0, footerY - 4, W, 62).fill('#f8fafb');
    doc.rect(0, footerY - 4, W, 1).fill(borderGray);

    doc.fillColor(green).fontSize(11).font('Helvetica-Bold')
       .text('Krish Homestays', M, footerY + 4);
    doc.fillColor(gray).fontSize(8).font('Helvetica')
       .text('krishhomestays@gmail.com  |  krishhomestays.com  |  Munnar, Kerala, India',
             M, footerY + 18);
    doc.text(
      `This is a computer-generated receipt and does not require a physical signature.  © ${new Date().getFullYear()} Krish Homestays.`,
      M, footerY + 30
    );

    doc.end();
  });
}

module.exports = { generateReceiptPDF };