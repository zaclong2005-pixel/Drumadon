const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ---------- Fade sections in as they scroll into view ---------- */
document.documentElement.classList.add('js');
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
$$('main section > .wrap').forEach((el) => {
  el.classList.add('reveal');
  revealer.observe(el);
});

/* ---------- FAQ level meters ----------
   Each bar rises and falls slowly over 2–4 beats of 120 bpm, so the row moves loosely with the moving line. */
const eq = document.createElement('div');
eq.className = 'eq';
eq.setAttribute('aria-hidden', 'true');
const BEATS = ['1s', '2s', '1.5s'];
for (let i = 0; i < 40; i++) {
  const bar = document.createElement('i');
  const shape = Math.sin(i * 0.45) * 0.5 + 0.5; // gentle hills across the row
  bar.style.setProperty('--h', `${30 + shape * 70}%`);
  bar.style.setProperty('--t', BEATS[(i * 7) % 3]);
  bar.style.setProperty('--d', `${-((i * 13) % 8) * 0.125}s`);
  eq.appendChild(bar);
}
$('#faq').appendChild(eq);

/* ---------- Resources record ----------
   Drawn here so the grooves can be made in a loop. The disc turns once a minute;
   the light reflections and tone arm sit on top and stay still, like a real turntable. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const BLUE = '#1f8fff';
const CREAM = '#f2eee6';
const DARK = '#060a13';

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  parent.appendChild(el);
  return el;
}
const ring = (parent, r, opacity, width = 0.35) =>
  svgEl('circle', { cx: 100, cy: 100, r, fill: 'none', stroke: BLUE, 'stroke-opacity': opacity, 'stroke-width': width }, parent);
const noise = (i) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1; // fixed pseudo-random, same every load

function buildRecord(container) {
  // Spinning disc
  const disc = svgEl('svg', { class: 'disc', viewBox: '0 0 200 200' }, container);
  svgEl('circle', { cx: 100, cy: 100, r: 99, fill: DARK }, disc);
  ring(disc, 99, 0.12, 0.6); // outer edge
  ring(disc, 97.6, 0.05); // bevelled rim, smooth lead-in beyond it

  const trackGaps = [80, 66, 53];
  for (let r = 94.5, i = 0; r > 40; r -= 0.85, i++) {
    if (trackGaps.some((gap) => Math.abs(r - gap) < 1)) continue;
    ring(disc, r.toFixed(2), (0.012 + noise(i) * 0.028).toFixed(3)); // grooves vary like real pressings
  }
  trackGaps.forEach((gap) => ring(disc, gap, 0.06, 0.8)); // smooth bands between songs
  for (let r = 39; r > 35; r -= 1.5) ring(disc, r, 0.025); // wide run-out grooves

  // Label with printed lines and the spindle hole
  svgEl('circle', { cx: 100, cy: 100, r: 33, fill: BLUE, 'fill-opacity': 0.07 }, disc);
  ring(disc, 31.5, 0.1, 0.5);
  ring(disc, 12, 0.06);
  [[86, 76, 28, 2.4], [90, 82, 20, 1.6], [92, 117, 16, 1.6], [95, 121, 10, 1.2]].forEach(([x, y, width, height]) =>
    svgEl('rect', { x, y, width, height, rx: height / 2, fill: CREAM, 'fill-opacity': 0.1 }, disc));
  svgEl('circle', { cx: 100, cy: 100, r: 2.2, fill: DARK, stroke: CREAM, 'stroke-opacity': 0.2, 'stroke-width': 0.4 }, disc);

  // Light reflection: a still sheen layer (conic gradient in style.css) sits between disc and arm
  const sheen = document.createElement('div');
  sheen.className = 'sheen';
  container.appendChild(sheen);

  // Still layer
  const still = svgEl('svg', { viewBox: '0 0 200 200' }, container);

  // Tone arm: base, pivot, counterweight, arm, headshell resting in a groove
  const arm = svgEl('g', { fill: 'none', stroke: BLUE, 'stroke-opacity': 0.14, 'stroke-linecap': 'round' }, still);
  svgEl('circle', { cx: 14, cy: 14, r: 10 }, arm);
  svgEl('circle', { cx: 14, cy: 14, r: 4.5 }, arm);
  svgEl('path', { d: 'M14 14L11 4', 'stroke-width': 3.2 }, arm);
  svgEl('path', { d: 'M14 14L22 68Q24 84 31 94', 'stroke-width': 1.4 }, arm);
  svgEl('rect', { x: 27, y: 92, width: 9, height: 6, rx: 1, transform: 'rotate(55 31.5 95)', fill: BLUE, 'fill-opacity': 0.12, stroke: 'none' }, arm);
}
buildRecord($('#record'));

/* ---------- Mobile menu ---------- */
const nav = $('#nav');
const menuBtn = $('#menuBtn');
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
nav.addEventListener('click', (e) => {
  if (e.target.closest('a')) nav.classList.remove('open');
});

/* ---------- About: More... / Less ---------- */
$('#bioBtn').addEventListener('click', (e) => {
  const more = $('#bioMore');
  more.hidden = !more.hidden;
  e.currentTarget.textContent = more.hidden ? 'More' : 'Less';
  e.currentTarget.setAttribute('aria-expanded', String(!more.hidden));
});

/* ---------- Admin mode: click "Lesson Plans" 5 times quickly ---------- */
let adminClicks = 0;
let adminTimer;
$('#lessonsHeading').addEventListener('click', () => {
  clearTimeout(adminTimer);
  if (++adminClicks === 5) {
    document.body.classList.toggle('admin-mode');
    adminClicks = 0;
  } else {
    adminTimer = setTimeout(() => { adminClicks = 0; }, 1000);
  }
});

/* ---------- Shared helpers ---------- */
async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.success !== false, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function setStatus(container, text, bad = false) {
  const p = document.createElement('p');
  p.className = `status${bad ? ' bad' : ''}`;
  p.textContent = text;
  container.replaceChildren(p);
}

/* ---------- Student resources ---------- */
let manualUrl = '';

$('#unlockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('#unlockStatus');
  status.className = 'status';
  status.textContent = 'Checking…';

  try {
    const { ok, status: code, data } = await fetchJson('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('#password').value }),
    });
    if (!ok) {
      status.textContent = code === 401 ? 'Incorrect password. Please try again.' : 'Could not unlock right now. Please try again.';
      status.classList.add('bad');
      $('#password').value = '';
      return;
    }

    manualUrl = data.manual;
    $('#manualDownload').href = manualUrl;
    $('#viewerDownload').href = manualUrl;
    $('#manualActions').hidden = false;
    $$('.locked-label').forEach((el) => el.remove());

    const list = $('#chartList');
    list.replaceChildren();
    if (!data.charts.length) {
      const li = document.createElement('li');
      li.textContent = 'No transcriptions yet.';
      list.appendChild(li);
    }
    data.charts.forEach((chart) => {
      const li = document.createElement('li');
      const label = document.createElement('div');
      label.textContent = chart.title;
      if (chart.artist) {
        const artist = document.createElement('span');
        artist.textContent = chart.artist;
        label.appendChild(artist);
      }
      const link = document.createElement('a');
      link.className = 'btn outline small';
      link.href = chart.url;
      link.download = '';
      link.textContent = 'Download';
      li.append(label, link);
      list.appendChild(li);
    });
    list.hidden = false;

    $('#unlockForm').hidden = true;
    status.textContent = '';
  } catch (err) {
    console.error('Unlock failed:', err);
    status.textContent = 'Could not unlock right now. Please try again.';
    status.classList.add('bad');
  }
});

/* ---------- Manual viewer with single-page printing ---------- */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const viewer = $('#viewer');
const viewerPages = $('#viewerPages');
const printArea = $('#printArea');
let pdfDoc = null;

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS}pdf.min.js`;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error('Could not load the PDF viewer'));
    document.head.appendChild(script);
  });
}

async function renderPage(num, cssWidth) {
  const page = await pdfDoc.getPage(num);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: cssWidth / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

async function openManual() {
  viewer.showModal();
  if (pdfDoc) return;
  setStatus(viewerPages, 'Loading manual…');
  try {
    const pdfjsLib = await loadPdfJs();
    pdfDoc = await pdfjsLib.getDocument(manualUrl).promise;
    viewerPages.replaceChildren();
    const width = Math.min(720, viewerPages.clientWidth - 48) * (window.devicePixelRatio || 1);

    for (let num = 1; num <= pdfDoc.numPages; num++) {
      const figure = document.createElement('figure');
      figure.className = 'page';
      figure.appendChild(await renderPage(num, width));
      const caption = document.createElement('figcaption');
      caption.textContent = `Page ${num}`;
      const printBtn = document.createElement('button');
      printBtn.type = 'button';
      printBtn.className = 'btn outline small';
      printBtn.textContent = 'Print Page';
      printBtn.addEventListener('click', () => printPage(num, printBtn));
      caption.appendChild(printBtn);
      figure.appendChild(caption);
      viewerPages.appendChild(figure);
    }
  } catch (err) {
    console.error('Manual failed to load:', err);
    pdfDoc = null;
    setStatus(viewerPages, 'Could not load the manual. Use Download instead.', true);
  }
}

// Renders one page at print resolution into #printArea; print CSS hides everything else.
async function printPage(num, btn) {
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    const canvas = await renderPage(num, 2400);
    const img = new Image();
    img.alt = `Drumadon Manual page ${num}`;
    img.src = canvas.toDataURL('image/png');
    await img.decode();
    printArea.replaceChildren(img);
    window.print();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Print Page';
  }
}
addEventListener('afterprint', () => printArea.replaceChildren());

$('#openManual').addEventListener('click', openManual);
$('#viewerClose').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.close(); });

/* ---------- Booking ---------- */
const params = new URLSearchParams(location.search);
const lessonType = ['20', '30', '45', '60'].includes(params.get('type')) ? params.get('type') : 'trial';
const isTrial = lessonType === 'trial';
const form = $('#bookingForm');
const dayChips = $('#dayChips');
const timeChips = $('#timeChips');

$('#type').value = lessonType;

if (!isTrial) {
  $('#bookTitle').textContent = `${lessonType}-Minute Lesson Booking`;
  $('#submitBtn').textContent = 'Book My Lesson';
  const me = $('[data-for="me"]');
  me.textContent = 'Adult';
  me.dataset.for = 'adult';
  $('[data-for="child"]').textContent = 'Child';
  $('#paidFields').hidden = false;
} else {
  $$('#paidFields input').forEach((input) => { input.disabled = true; });
}

// Old links like /trial.html?type=30 redirect here; jump straight to booking.
if (params.has('type')) {
  addEventListener('load', () => $('#book').scrollIntoView());
}

function selectChip(container, chip) {
  container.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
  chip.classList.add('selected');
}

function makeChip(label, sub, onClick) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = label;
  if (sub) {
    const small = document.createElement('small');
    small.textContent = sub;
    chip.prepend(small);
  }
  chip.addEventListener('click', () => onClick(chip));
  return chip;
}

async function loadDays() {
  try {
    const { ok, data } = await fetchJson(`/api/get-availability?type=${lessonType}`);
    if (!ok) throw new Error(data.message || 'Availability request failed');

    if (!data.availableDates.length) {
      setStatus(dayChips, "There are no dates available right now but don't worry. Let's arrange something: info@drumadon.com.au");
      return;
    }
    dayChips.replaceChildren();
    data.availableDates.forEach((dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const weekday = date.toLocaleDateString('en-AU', { weekday: 'short' });
      const label = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
      dayChips.appendChild(makeChip(label, weekday, (chip) => pickDay(chip, dateStr)));
    });
  } catch (err) {
    console.error('Could not load days:', err);
    setStatus(dayChips, 'Could not load available days. Please refresh or email info@drumadon.com.au.', true);
  }
}

async function pickDay(chip, dateStr) {
  selectChip(dayChips, chip);
  $('#preferredDay').value = dateStr;
  $('#selectedTime').value = '';
  $('#timeStep').hidden = false;
  $('#forStep').hidden = true;
  form.hidden = true;
  setStatus(timeChips, 'Loading times…');

  let data = null;
  for (let attempt = 0; attempt < 3 && !data; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetchJson(`/api/get-availability?date=${encodeURIComponent(dateStr)}&type=${lessonType}`);
      if (res.ok) data = res.data;
    } catch (err) {
      console.error('Times request failed:', err);
    }
  }
  if ($('#preferredDay').value !== dateStr) return; // another day was picked meanwhile

  if (!data) {
    setStatus(timeChips, 'Could not load times. Please select a day again.', true);
    return;
  }
  if (!data.availableTimes.length) {
    setStatus(timeChips, 'No times left on this day. Please select another day.');
    return;
  }
  timeChips.replaceChildren();
  data.availableTimes.forEach((time) => {
    timeChips.appendChild(makeChip(time, '', (c) => {
      selectChip(timeChips, c);
      $('#selectedTime').value = time;
      $('#forStep').hidden = false;
      $$('#forChips .chip').forEach((b) => b.classList.remove('selected'));
      form.hidden = true;
    }));
  });
}

$('#forChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  selectChip($('#forChips'), chip);
  const forChild = chip.dataset.for === 'child';
  $('#bookingFor').value = chip.dataset.for;
  $('#childFields').hidden = !forChild;
  if (!forChild) {
    $('#childName').value = '';
    $('#age').value = '';
  }
  form.hidden = false;
});

// Paid lesson pricing (admin bookings)
const STANDARD_RATES = { 20: 26, 30: 39, 45: 57, 60: 74 };
const PACK_RATES = { 20: 25, 30: 37, 45: 54, 60: 70 };
const amountInput = $('#lessonAmount');
const rateInput = $('#lessonRate');
const totalInput = $('#grandTotal');
const lessonCount = () => Number(amountInput.value) || 1;

function resetRate() {
  const pack = $('#bulkToggle').checked;
  $('#selectedPack').value = pack ? 'pack' : 'single';
  const rate = (pack ? PACK_RATES : STANDARD_RATES)[lessonType] || 0;
  rateInput.value = rate.toFixed(2);
  totalInput.value = (rate * lessonCount()).toFixed(2);
}
if (!isTrial) {
  resetRate();
  $('#bulkToggle').addEventListener('change', resetRate);
  const totalFromRate = () => { totalInput.value = ((Number(rateInput.value) || 0) * lessonCount()).toFixed(2); };
  amountInput.addEventListener('input', totalFromRate);
  rateInput.addEventListener('input', totalFromRate);
  totalInput.addEventListener('input', () => {
    rateInput.value = ((Number(totalInput.value) || 0) / lessonCount()).toFixed(2);
  });
}

form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('error'));

function validate() {
  const required = ['name', 'email', 'phone'];
  if ($('#bookingFor').value === 'child') required.push('childName', 'age');
  let valid = true;
  required.forEach((id) => {
    const input = $(`#${id}`);
    const value = input.value.trim();
    const bad = !value || (id === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
    input.closest('.field').classList.toggle('error', bad);
    if (bad) valid = false;
  });
  return valid;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('#formStatus');
  status.className = 'status';
  status.textContent = '';
  if (!$('#preferredDay').value || !$('#selectedTime').value) {
    status.textContent = 'Please select a date and time.';
    status.classList.add('bad');
    return;
  }
  if (!validate()) return;

  const btn = $('#submitBtn');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Booking…';

  try {
    const { ok, data } = await fetchJson('/api/create-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)),
    }, 30000);
    if (!ok) throw new Error(data.message || 'Booking failed');

    const done = document.createElement('div');
    done.innerHTML = '<h3>Booking Confirmed!</h3><p></p><p class="muted"></p>';
    done.children[1].textContent = isTrial
      ? 'Your free trial lesson has been successfully booked!'
      : 'Your lesson has been successfully booked!';
    done.children[2].textContent = isTrial
      ? 'You should receive a confirmation email shortly with all the details.'
      : 'You should receive a confirmation email shortly with all the details, including your invoice.';
    $('#booking').replaceChildren(done);
  } catch (err) {
    console.error('Booking error:', err);
    status.textContent = 'Sorry, there was an error processing your booking. Please try again or contact us directly.';
    status.classList.add('bad');
    btn.disabled = false;
    btn.textContent = label;
  }
});

loadDays();
