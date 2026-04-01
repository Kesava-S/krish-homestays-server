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
      ['Guests',     `${booking.guests_count} Guests`],
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
    doc.text(String(booking.guests_count),M + 328, cy + 7, { width: 50  });
    doc.fillColor(green).font('Helvetica-Bold')
       .text(`Rs.${booking.total_amount}`, M + 378, cy + 7, { width: CW - 386, align: 'right' });
    cy += 30;

    // ─────────────────────────────────────────
    // PAYMENT SUMMARY
    // ─────────────────────────────────────────
    doc.fillColor(green).fontSize(9).font('Helvetica-Bold')
       .text('PAYMENT SUMMARY', M, cy, { characterSpacing: 1 });
    doc.rect(M, cy + 12, CW, 1).fill(borderGreen);
    cy += 16;

    const summaryBox = [
      ['Subtotal',      `Rs.${booking.total_amount}`],
      ['Taxes & Fees',  'Included'],
      ['Discount',      '—'],
    ];
    doc.roundedRect(M, cy, CW, summaryBox.length * 20 + 30, 6)
       .fill(lightGray).stroke(borderGray);

    summaryBox.forEach(([label, val], i) => {
      const ry = cy + 8 + i * 20;
      if (i > 0) doc.rect(M + 8, ry - 1, CW - 16, 0.5).fill(borderGray);
      doc.fillColor(gray).fontSize(9).font('Helvetica').text(label, M + 12, ry + 4);
      doc.fillColor('#333').text(val, M, ry + 4, { width: CW - 12, align: 'right' });
    });
    cy += summaryBox.length * 20 + 12;

    // Total row
    doc.roundedRect(M, cy, CW, 28, 6).fill(green);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
       .text('TOTAL AMOUNT PAID', M + 12, cy + 8);
    doc.text(`Rs.${booking.total_amount}`, M, cy + 8, { width: CW - 12, align: 'right' });
    cy += 36;

    // ─────────────────────────────────────────
    // TRANSACTION DETAILS (2-column grid)
    // ─────────────────────────────────────────
    doc.fillColor(green).fontSize(9).font('Helvetica-Bold')
       .text('TRANSACTION DETAILS', M, cy, { characterSpacing: 1 });
    doc.rect(M, cy + 12, CW, 1).fill(borderGreen);
    cy += 16;

    const txItems = [
      ['Payment ID',      payment.payment_id || '—'],
      ['Order ID',        payment.order_id   || '—'],
      ['Payment Method',  payment.gateway    || 'Razorpay'],
      ['Payment Status',  'PAID'],
      ['Currency',        payment.currency   || 'INR'],
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
      const isStatus = label === 'Payment Status';
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
       .dash(4, { space: 3 }).stroke(borderGreen).undash();
    doc.fillColor(green).fontSize(11).font('Helvetica-Bold')
       .text('✓   PAID IN FULL   ✓', M, cy + 7, { width: CW, align: 'center' });
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