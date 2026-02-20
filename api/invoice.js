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
    alignWithTerm, calculatedWeeks, calculatedCost,
  } = booking;

  const pricing = prices[type] || { single: 0, pack: 0, duration: 30 };

  const lessonDate = new Date(preferredDay);
  const formattedDate = `${lessonDate.getDate().toString().padStart(2, '0')}/${(lessonDate.getMonth() + 1).toString().padStart(2, '0')}/${lessonDate.getFullYear()}`;

  const invoiceDate = new Date().toLocaleDateString('en-AU', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Australia/Perth',
  });

  let description, amount;
  if (type === 'trial') {
    description = 'Free Trial Lesson (20 minutes)';
    amount = 0;
  } else if (selectedPack === 'pack') {
    if (alignWithTerm === 'true') {
      description = `${type}-Minute Drum Lessons &times; ${calculatedWeeks} (Term Aligned Pack)`;
      amount = Number(calculatedCost);
    } else {
      description = `${type}-Minute Drum Lessons &times; 10 (10-Lesson Pack)`;
      amount = pricing.pack;
    }
  } else {
    description = `${type}-Minute Drum Lesson`;
    amount = pricing.single;
  }

  const amountDisplay = amount === 0 ? 'Free' : `$${amount}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice INV-${inv} - Drumadon</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 14px; color: #111; background: #f0f0f0; padding: 30px 20px; }
    .invoice { background: #fff; max-width: 700px; margin: 0 auto; padding: 50px; border-radius: 8px; box-shadow: 0 2px 16px rgba(0,0,0,0.12); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 3px solid #000; margin-bottom: 30px; }
    .from-block p { margin: 3px 0; color: #444; font-size: 13px; }
    .from-block .brand { font-size: 26px; font-weight: bold; color: #000; margin-bottom: 6px; }
    .invoice-meta { text-align: right; }
    .invoice-meta h1 { font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #000; }
    .invoice-meta .inv-num { font-size: 15px; color: #555; margin-top: 4px; }
    .invoice-meta .dates { margin-top: 12px; font-size: 13px; color: #444; }
    .invoice-meta .dates p { margin: 3px 0; }
    .bill-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .bill-block h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; }
    .bill-block p { margin: 2px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #000; color: #fff; }
    thead th { padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: bold; }
    thead th:last-child { text-align: right; }
    tbody td { padding: 14px; border-bottom: 1px solid #eee; font-size: 13px; }
    tbody td:last-child { text-align: right; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .totals-inner { width: 260px; }
    .totals-inner tr td { padding: 6px 14px; font-size: 13px; }
    .totals-inner tr td:last-child { text-align: right; }
    .totals-inner .total-row td { padding-top: 10px; font-size: 15px; font-weight: bold; border-top: 2px solid #000; }
    .payment-box { background: #f7f7f7; border: 1px solid #ddd; border-radius: 6px; padding: 18px 20px; margin-bottom: 28px; }
    .payment-box h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 10px; }
    .payment-box p { margin: 4px 0; font-size: 13px; }
    .footer-note { text-align: center; color: #999; font-size: 12px; padding-top: 20px; border-top: 1px solid #eee; }
    .print-btn { display: block; width: 200px; margin: 24px auto 0; padding: 11px 0; background: #000; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer; text-align: center; letter-spacing: 0.5px; }
    .print-btn:hover { background: #333; }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice { box-shadow: none; border-radius: 0; padding: 30px; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="from-block">
        <div class="brand">Drumadon</div>
        <p>5 Arthur Rd, Lesmurdie WA 6076</p>
        <p>info@drumadon.com.au</p>
        <p>ABN 28 472 806 002</p>
      </div>
      <div class="invoice-meta">
        <h1>TAX INVOICE</h1>
        <div class="inv-num">INV-${inv}</div>
        <div class="dates">
          <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
          <p><strong>Due Date:</strong> ${formattedDate}</p>
        </div>
      </div>
    </div>

    <div class="bill-section">
      <div class="bill-block">
        <h3>Bill To</h3>
        <p><strong>${name}</strong></p>
        <p>${email}</p>
        <p>${phone}</p>
        ${age ? `<p>Age: ${age}</p>` : ''}
      </div>
      <div class="bill-block" style="text-align:right;">
        <h3>Lesson Details</h3>
        <p><strong>${type === 'trial' ? 'Free Trial' : type + '-Minute Lesson'}</strong></p>
        <p>${formattedDate} at ${selectedTime}</p>
        <p>5 Arthur Rd, Lesmurdie WA 6076</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${description}</td>
          <td>${amountDisplay}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <table class="totals-inner">
        <tr>
          <td>GST</td>
          <td>N/A</td>
        </tr>
        <tr class="total-row">
          <td>Total Due</td>
          <td>${amountDisplay}</td>
        </tr>
      </table>
    </div>

    ${amount > 0 ? `
    <div class="payment-box">
      <h3>Payment Details</h3>
      <p><strong>Bank:</strong> ANZ</p>
      <p><strong>BSB:</strong> 036-062</p>
      <p><strong>Account:</strong> 327003</p>
      <p><strong>Reference:</strong> INV-${inv} / ${name}</p>
    </div>
    ` : ''}

    <div class="footer-note">
      <p>Thank you for booking with Drumadon!</p>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
