/**
 * Cloudflare Worker entry point.
 *
 * Serves the static dashboard from the ASSETS binding, answers /api/progress by
 * fetching boot.dev server-side (the browser cannot: boot.dev's API only allows
 * its own origin), and keeps daily history in KV.
 *
 * The hourly Cron Trigger records totals even when nobody opens the page, so the
 * pace and streak stay accurate through days you do not visit.
 */

import { buildPayload, recordSnapshotOnly } from './core.js';

const HISTORY_KEY = 'history';

/** KV-backed store matching the interface core.js expects. */
function kvStore(env) {
  return {
    async read() {
      if (!env.HISTORY) return [];
      const raw = await env.HISTORY.get(HISTORY_KEY, { type: 'json' });
      return raw && Array.isArray(raw.days) ? raw.days : [];
    },
    async write(days) {
      if (!env.HISTORY) return;
      await env.HISTORY.put(HISTORY_KEY, JSON.stringify({ days }));
    },
  };
}

// Cloudflare stamps each deploy with its own version id, so no build step is
// needed to tell one release from the next. Absent the binding (local dev),
// every response claims the same build and nothing invalidates.
const buildId = (env) => (env.CF_VERSION_METADATA && env.CF_VERSION_METADATA.id) || 'dev';

const settings = (env) => ({
  store: kvStore(env),
  handle: env.BOOTDEV_HANDLE || 'the_baaneh',
  pathSlug: env.BOOTDEV_PATH || 'backend',
  tz: env.BOOTDEV_TZ || 'UTC',
  streakSince: env.BOOTDEV_STREAK_SINCE || '',
  build: buildId(env),
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Deliberately tiny and upstream-free: a reload hits this to find out
    // whether its cached payload predates the current deploy, and that check
    // must not cost a boot.dev round trip.
    if (url.pathname === '/api/version') {
      return Response.json({ build: buildId(env) }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (url.pathname === '/api/progress') {
      try {
        const data = await buildPayload({
          ...settings(env),
          fresh: url.searchParams.get('fresh') === '1',
        });
        return Response.json(data, {
          headers: {
            // The Worker already caches internally; keep browsers honest.
            'Cache-Control': 'no-store',
          },
        });
      } catch (err) {
        console.error('[api]', err.message);
        return Response.json({ error: err.message }, { status: 502 });
      }
    }

    // Everything else is the static dashboard.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('assets binding missing', { status: 500 });
  },

  async scheduled(event, env, ctx) {
    // Recording is a write path, so let it finish even after the handler returns.
    ctx.waitUntil(
      recordSnapshotOnly(settings(env))
        .then((row) => console.log('[cron] recorded', JSON.stringify(row)))
        .catch((err) => console.error('[cron] failed:', err.message))
    );
  },
};
