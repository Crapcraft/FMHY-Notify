'use strict';

const Parser = require('rss-parser');
const fs     = require('fs');
const path   = require('path');

// ── Load .env if present (no extra dependencies needed) ──────────────────
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    });
}

// ── Config (all overridable via environment / .env) ───────────────────────
const FEED_URL         = process.env.FEED_URL             || 'https://fmhy-tracker.pages.dev/feed.xml';
const WEBHOOK_URL      = process.env.DISCORD_WEBHOOK_URL  || '';
const STATE_FILE       = path.resolve(process.env.STATE_FILE || path.join(__dirname, 'rss-seen.json'));
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MIN || 15) * 60 * 1000;
const MAX_SEEN         = 500;
const POST_DELAY_MS    = 1500;
const MAX_POST_PER_RUN = 10;

// ── Helpers ───────────────────────────────────────────────────────────────

/** Pick an embed colour based on keywords in the title. */
function embedColor(title = '') {
  const t = title.toLowerCase();
  if (t.includes('remov') || t.includes('dead') || t.includes('down')) return 0xED4245; // red
  if (t.includes('updat') || t.includes('chang') || t.includes('edit'))  return 0xFEE75C; // yellow
  return 0x57F287; // green
}

/** Load the set of already-seen item IDs from disk. */
function loadSeen() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

/** Persist seen IDs, keeping only the most recent MAX_SEEN entries. */
function saveSeen(seen) {
  const trimmed = [...seen].slice(-MAX_SEEN);
  fs.writeFileSync(STATE_FILE, JSON.stringify(trimmed, null, 2));
}

/** Best available stable identifier for a feed item. */
function itemId(item) {
  return item.guid || item.id || item.link || item.title || null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Discord webhook ───────────────────────────────────────────────────────

async function postEmbed(item) {
  const description = (item.contentSnippet || item.summary || item.content || '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 2048);

  const embed = {
    title:       (item.title || 'FMHY Update').slice(0, 256),
    url:         item.link   || undefined,
    description: description || undefined,
    color:       embedColor(item.title),
    timestamp:   item.isoDate || new Date().toISOString(),
    footer:      { text: 'FMHY Tracker' },
  };

  const res = await fetch(WEBHOOK_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ embeds: [embed] }),
  });

  // Respect Discord rate-limit headers
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') || 5) * 1000;
    console.warn(`Rate-limited. Retrying in ${retryAfter}ms…`);
    await sleep(retryAfter);
    return postEmbed(item);
  }

  if (!res.ok) {
    throw new Error(`Webhook returned ${res.status}: ${await res.text().catch(() => '')}`);
  }
}

// ── Main poll loop ────────────────────────────────────────────────────────

const parser = new Parser({ timeout: 10_000 });

async function checkFeed() {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Polling ${FEED_URL}`);

  let feed;
  try {
    feed = await parser.parseURL(FEED_URL);
  } catch (err) {
    console.error(`[${ts}] Feed error: ${err.message}`);
    return;
  }

  const seen       = loadSeen();
  const firstRun   = !fs.existsSync(STATE_FILE);
  const unseen     = feed.items.filter(item => {
    const id = itemId(item);
    return id && !seen.has(id);
  });

  // On first run just seed the state so we don't flood the channel
  if (firstRun) {
    unseen.forEach(item => seen.add(itemId(item)));
    saveSeen(seen);
    console.log(`[${ts}] First run — seeded ${unseen.length} item(s), nothing posted.`);
    return;
  }

  if (!unseen.length) {
    console.log(`[${ts}] No new items.`);
    return;
  }

  // Post oldest-first; cap to avoid webhook spam after long downtime
  const toPost = unseen.reverse().slice(0, MAX_POST_PER_RUN);
  if (unseen.length > MAX_POST_PER_RUN) {
    console.warn(`[${ts}] ${unseen.length} new items — capping at ${MAX_POST_PER_RUN}.`);
  }

  let posted = 0;
  for (let i = 0; i < toPost.length; i++) {
    const item = toPost[i];
    try {
      await postEmbed(item);
      posted++;
      if (i < toPost.length - 1) await sleep(POST_DELAY_MS);
    } catch (err) {
      console.error(`[${ts}] Failed to post "${item.title}": ${err.message}`);
    }
    seen.add(itemId(item));
  }

  saveSeen(seen);
  console.log(`[${ts}] Posted ${posted}/${toPost.length} item(s).`);
}

// ── Entry point ───────────────────────────────────────────────────────────

if (!WEBHOOK_URL) {
  console.error('ERROR: DISCORD_WEBHOOK_URL is not set.');
  console.error('Copy .env.example → .env and fill in your webhook URL.');
  process.exit(1);
}

console.log(`FMHY RSS → Discord  |  feed: ${FEED_URL}  |  interval: ${POLL_INTERVAL_MS / 60_000} min`);
checkFeed();
setInterval(checkFeed, POLL_INTERVAL_MS);
