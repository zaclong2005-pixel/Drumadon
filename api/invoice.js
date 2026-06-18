const prices = {
  'trial': { single: 0, pack: 0, duration: 20 },
  '20': { single: 26, pack: 250, duration: 20 },
  '30': { single: 39, pack: 370, duration: 30 },
  '45': { single: 57, pack: 540, duration: 45 },
  '60': { single: 74, pack: 700, duration: 60 },
};

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const { d } = req.query;
  if (!d) {
    return res.status(400).send('Invalid invoice link.');
  }

  let booking;
  try {
    booking = JSON.parse(Buffer.from(d, 'base64url').toString('utf8'));
  } catch {
    return res.status(400).send('Invalid invoice data.');
  }

  const {
    inv, name, email, phone, age, type,
    selectedTime, preferredDay, selectedPack,
    lessonAmount, grandTotal,
    bookingFor, childName,
  } = booking;

  const pricing = prices[type] || { single: 0, pack: 0, duration: 30 };

  const lessonDate = new Date(preferredDay);
  const formattedDate = `${lessonDate.getDate().toString().padStart(2, '0')}/${(lessonDate.getMonth() + 1).toString().padStart(2, '0')}/${lessonDate.getFullYear()}`;

  const invoiceDateObj = new Date();
  const dueDateObj = new Date(preferredDay);
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  if (dueDateObj - invoiceDateObj < oneWeekMs) {
    dueDateObj.setTime(invoiceDateObj.getTime() + oneWeekMs);
  }

  const invoiceDate = invoiceDateObj.toLocaleDateString('en-AU', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Australia/Perth',
  });
  const dueDate = dueDateObj.toLocaleDateString('en-AU', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Australia/Perth',
  });

  let description, amount, subtotalAmount, discountAmount = 0, discountLabel = 'Discount';
  if (type === 'trial') {
    description = 'Free Trial Lesson (20 minutes)';
    amount = 0;
    subtotalAmount = 0;
  } else {
    const numLessons = Number(lessonAmount || 1);
    const singlePricePerLesson = pricing.single;
    const packPricePerLesson = Math.round(pricing.pack / 10);
    const totalFromForm = Number(grandTotal);
    const standardTotal = singlePricePerLesson * numLessons;

    amount = !isNaN(totalFromForm) && totalFromForm >= 0
      ? totalFromForm
      : (selectedPack === 'pack' ? packPricePerLesson : singlePricePerLesson) * numLessons;

    subtotalAmount = standardTotal;
    discountAmount = Math.max(0, subtotalAmount - amount);
    discountLabel = selectedPack === 'pack' ? 'Bulk Discount' : 'Discount';

    description = `${numLessons}x ${type} min lesson${selectedPack === 'pack' ? ' (Bulk Rate)' : ''}`;
  }

  const amountDisplay = amount === 0 ? 'Free' : `$${amount}`;
  const subtotalDisplay = subtotalAmount === 0 ? 'Free' : `$${subtotalAmount}`;
  const discountDisplay = discountAmount === 0 ? null : `-$${discountAmount}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice INV-${inv} - Drumadon</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Candara, 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 1.65; color: #111111; background: #e0e0e0; padding: 36px 20px; }
    .invoice { background: #fff; max-width: 720px; margin: 0 auto; border-radius: 12px; box-shadow: 0 6px 32px rgba(0,0,0,0.15); overflow: hidden; }

    /* ── Header ── */
    .header-band { background: #000000; padding: 22px 36px; display: flex; justify-content: space-between; align-items: center; }
    .header-band img { height: 50px; display: block; }
    .invoice-title-block { text-align: right; }
    .invoice-title-block .word { font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #fff; }
    .invoice-title-block .inv-num { font-size: 18px; color: white; margin-top: 4px; letter-spacing: 1px; }

    /* ── Accent strip ── */
    .accent-strip { height: 3px; background: linear-gradient(90deg, #7b97ac, #8fc4da); }

    /* ── Body ── */
    .body-content { padding: 28px 36px; }

    /* ── From block ── */
    .meta-row { margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid #e8e8e8; }
    .from-block .company { font-size: 16px; font-weight: bold; color: #111111; margin-bottom: 4px; }
    .from-block p { margin: 1px 0; color: #555; font-size: 14px; }
    .from-block .abn { font-size: 13px; color: #666; margin-top: 4px; }

    /* ── Info cards ── */
    .info-section { display: flex; gap: 16px; margin-bottom: 20px; }
    .info-card { flex: 1; background: #f4f7fa; border-radius: 8px; padding: 16px 18px; border-top: 3px solid #7b97ac; }
    .info-card h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #7b97ac; margin-bottom: 8px; font-weight: bold; }
    .info-card p { margin: 2px 0; font-size: 14px; color: #333; }
    .info-card p strong { color: #111111; font-size: 14px; }

    /* ── Line items section ── */
    .line-item { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 16px 0; border-bottom: 1px solid #e8e8e8; margin-bottom: 12px; }
    .line-item-desc { flex: 1; font-size: 14px; color: #333; line-height: 1.4; }
    .line-item-price { text-align: right; font-weight: 600; color: #111111; font-size: 14px; white-space: nowrap; }

    /* ── Totals ── */
    .totals { display: flex; justify-content: flex-start; margin-bottom: 24px; margin-top: 8px; }
    .totals-inner { width: 100%; max-width: 280px; background: transparent; border: none; overflow: hidden; box-shadow: none; padding: 0; }
    .totals-inner table { margin-bottom: 0; width: 100%; border-collapse: collapse; }
    .totals-inner tbody td { padding: 8px 0; font-size: 12px; color: #111; border: none; }
    .totals-inner tbody tr:not(:last-child) td { border-bottom: none; }
    .totals-inner tbody td:first-child { color: #666; font-weight: 500; }
    .totals-inner tbody td:last-child, .totals-inner tfoot td:last-child { text-align: right; }
    .totals-inner tbody td:last-child { color: #666; font-weight: 500; }
    .totals-inner tfoot td { padding: 10px 16px; font-size: 13px; font-weight: 700; background: #000000; color: #fff; border: none; }
    .totals-inner tfoot td:first-child { letter-spacing: 0.03em; text-transform: uppercase; font-weight: 700; padding-left: 0; }
    .totals-inner tfoot td:last-child { padding-right: 0; }
    .amount-text { display: inline-block; min-width: 60px; text-align: right; }
    .amount-text.total { font-size: 13px; }
    .amount-text.discount { color: #111; font-weight: 400; }
    .gst-note { font-size: 10px; color: #fff; text-align: left; display: inline-block; margin-top: 3px; font-style: normal; opacity: 0.9; }
    .gst-note::before { content: '• '; color: #7b97ac; }


    /* ── Payment box ── */
    .payment-box { background: #f4f7fa; border-left: 4px solid #7b97ac; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
    .payment-box h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1.8px; color: #7b97ac; margin-bottom: 14px; font-weight: bold; }
    .payment-grid { display: grid; grid-template-columns: 95px 1fr; gap: 9px 0; font-size: 15px; }
    .payment-grid .label { color: #333; }
    .payment-grid .value { color: #111111; font-weight: bold; }

    /* ── Footer ── */
    .footer { background: #000000; padding: 16px 36px; text-align: center; }
    .footer span { color: #fff; font-size: 14px; font-weight: bold; }

    /* ── Print button ── */
    .print-btn { display: block; width: 220px; margin: 28px auto 0; padding: 12px 0; background: #000000; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-family: Candara, sans-serif; font-weight: bold; cursor: pointer; letter-spacing: 0.5px; transition: background 0.2s; }
    .print-btn:hover { background: #7b97ac; }

    @media print {
      @page { size: A4; margin: 12mm 10mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { background: #fff !important; padding: 0 !important; margin: 0 !important; font-size: 13px !important; line-height: 1.5 !important; }
      .invoice { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; width: 100% !important; overflow: visible !important; }
      .header-band { padding: 18px 32px !important; }
      .header-band img { height: 38px !important; }
      .invoice-title-block .word { font-size: 22px !important; }
      .invoice-title-block .inv-num { font-size: 14px !important; }
      .body-content { padding: 20px 28px !important; }
      .meta-row { margin-bottom: 18px !important; padding-bottom: 16px !important; }
      .from-block .company { font-size: 15px !important; }
      .from-block p, .from-block .abn { font-size: 12px !important; }
      .info-section { margin-bottom: 20px !important; }
      .info-card { padding: 12px 16px !important; }
      .info-card h3 { font-size: 10px !important; margin-bottom: 6px !important; }
      .info-card p, .info-card p strong { font-size: 13px !important; }
      .line-item { padding: 14px 0 !important; margin-bottom: 16px !important; }
      .line-item-desc { font-size: 13px !important; }
      .line-item-price { font-size: 13px !important; }
      .totals { margin-bottom: 20px !important; }
      .totals-inner { overflow: visible !important; width: 240px !important; }
      .totals-inner tbody td { font-size: 11px !important; padding: 6px 0 !important; }
      .totals-inner tfoot td { font-size: 12px !important; padding: 8px 12px !important; }
      .gst-note { font-size: 9px !important; margin-top: 4px !important; color: #fff !important; }
      .payment-box { padding: 14px 18px !important; margin-bottom: 20px !important; }
      .payment-box h3 { font-size: 11px !important; margin-bottom: 10px !important; }
      .payment-grid { font-size: 13px !important; }
      .footer { padding: 16px 32px !important; }
      .print-btn { display: none !important; }
      .header-band, .accent-strip, .info-section, .meta-row, .totals, .payment-box { page-break-inside: avoid; }
      tbody tr { page-break-inside: avoid; }
    }
    @media (max-width: 560px) {
      .header-band, .body-content, .footer { padding-left: 22px; padding-right: 22px; }
      .info-section { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="invoice">

    <!-- Header -->
    <div class="header-band">
      <img src="https://www.drumadon.com.au/logo_white.png" alt="Drumadon" />
      <div class="invoice-title-block">
        <div class="word">INVOICE</div>
        <div class="inv-num">INV-${inv}</div>
      </div>
    </div>
    <div class="accent-strip"></div>

    <div class="body-content">

      <!-- Drumadon info -->
      <div class="meta-row">
        <div class="from-block">
          <div class="company">Drumadon</div>
          <p>5 Arthur Rd, Lesmurdie WA 6076</p>
          <p>info@drumadon.com.au</p>
          <p class="abn">ABN 28 472 806 002</p>
        </div>
      </div>

      <!-- Bill To + Invoice ref cards -->
      <div class="info-section">
        <div class="info-card">
          <h3>Bill To</h3>
          <p><strong>${name}</strong></p>
          <p>${email}</p>
          <p>${phone}</p>
          ${bookingFor === 'child' ? `<p style="margin-top:8px;color:#555;font-size:14px;">Student: ${childName}</p>` : ''}
        </div>
        <div class="info-card">
          <h3>Invoice Details</h3>
          <p><strong>Invoice Number:</strong> INV-${inv}</p>
          <p><strong>Issued:</strong> ${invoiceDate}</p>
          <p><strong>Due:</strong> ${dueDate}</p>
        </div>
      </div>

      <!-- Line items -->
      <div class="line-item">
        <div class="line-item-desc">${description}</div>
      </div>

      <!-- Totals -->
      <div class="totals">
        <table class="totals-inner">
          <tbody>
            <tr>
              <td>Subtotal</td>
              <td><span class="amount-text">${subtotalDisplay}</span></td>
            </tr>
            ${discountDisplay ? `
            <tr>
              <td>${discountLabel}</td>
              <td><span class="amount-text discount">${discountDisplay}</span></td>
            </tr>
            ` : ''}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="text-align: center; font-weight: 700; font-size: 14px; padding: 12px 16px;">Total Due: ${amountDisplay}</td>
            </tr>
            <tr class="gst-row">
              <td colspan="2"><span class="gst-note">No GST charged - not registered</span></td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${amount > 0 ? `
      <!-- Payment details -->
      <div class="payment-box">
        <h3>Payment Details</h3>
        <div class="payment-grid">
          <span class="label">Bank</span><span class="value">Westpac</span>
          <span class="label">BSB</span><span class="value">036-062</span>
          <span class="label">Account</span><span class="value">327003</span>
        </div>
      </div>
      ` : ''}

    </div><!-- /body-content -->

    <!-- Footer -->
    <div class="footer">
      <span>Thank you for booking with Drumadon!</span>
    </div>

  </div><!-- /invoice -->
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;

  res.setHeader('Content-Type', 'application/pdf; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="INV-${inv}.pdf"`);
  return res.status(200).send(html);
}
