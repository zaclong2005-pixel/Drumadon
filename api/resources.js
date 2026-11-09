// Checks the student password and lists the manual plus every PDF in /charts.
// Drop a PDF named "Song_Artist.pdf" into /charts and it appears on the site after the next deploy.
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const MANUAL = 'Drumadon_Essentials_Book_22_06_2026.pdf';

function toTitle(text) {
  // Capitalise the first letter of each word only (so "can't" becomes "Can't", not "Can'T")
  return text.trim().replace(/(^|\s)(\S)/g, (_, space, c) => space + c.toUpperCase());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const expected = (process.env.STUDENT_PASSWORD || 'drumadon').toLowerCase();
  if (String(body.password || '').trim().toLowerCase() !== expected) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  let files = [];
  try {
    files = await readdir(path.join(process.cwd(), 'charts'));
  } catch (err) {
    console.error('Could not read charts folder:', err.message);
  }

  const charts = files
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((file) => {
      const [song, ...artist] = file.slice(0, -4).split('_');
      return { url: `/charts/${encodeURIComponent(file)}`, title: toTitle(song), artist: artist.join(' ').trim() };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return res.status(200).json({ manual: `/${MANUAL}`, charts });
}
