# boot.dev Back-end Path Dashboard

Tracks progress on the boot.dev **Back-end Developer Path** for
[@the_baaneh](https://www.boot.dev/u/the_baaneh). No dependencies, no build step.

**Live:** <https://bootdev-progress.bootdev-progress.workers.dev>

Runs as a single Cloudflare Worker: static dashboard, a server-side API that
reads boot.dev, Workers KV for daily history, and an hourly Cron Trigger that
records totals even on days you never open the page.

## Run locally

```bash
node server.js
```

Then open <http://localhost:4173>. `PORT`, `BOOTDEV_HANDLE`, `BOOTDEV_PATH` and
`BOOTDEV_TZ` all override the defaults.

To run the deployed Worker instead, with a simulated KV store:

```bash
npx wrangler dev
```

## Why this needs a backend

A static upload cannot work. boot.dev's API answers with:

```
access-control-allow-origin: https://www.boot.dev
```

That is their own origin, not a wildcard, so a browser on any other domain is
refused. The profile and path pages send no CORS headers at all, so the HTML
parsing cannot move into the browser either. Both have to happen server-side,
where CORS does not apply.

There is no server to run, though. It deploys as one Cloudflare Worker:

| Piece | Role |
|---|---|
| `src/core.js` | all the data logic, no platform APIs |
| `src/worker.js` | Cloudflare entry: `/api/progress`, static assets, hourly cron |
| `server.js` | local dev adapter, same core, history in a JSON file |
| Workers KV | daily history in production (serverless has no writable disk) |
| Cron Trigger | records totals hourly so pace and streak survive days you do not visit |

Writes only happen when your XP or lesson count actually changed, which keeps the
hourly job well inside KV's free write allowance.

## Deploy

Authenticate first. Both commands open a browser, so use whichever account you
want for each:

```bash
npx wrangler login
```

Create the KV namespace and copy the printed id into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_KV_NAMESPACE_ID`:

```bash
npx wrangler kv namespace create HISTORY
```

Set `name` in `wrangler.toml` to whatever subdomain you want, and set
`BOOTDEV_TZ` to your own IANA zone (for example `Africa/Cairo`) so a day rolls
over when yours does rather than at UTC midnight. Then:

```bash
npx wrangler deploy
```

Check that the schedule and the live logs look right with:

```bash
npx wrangler tail
```

### Free-tier limits

Comfortably inside them: Workers allow 100k requests/day, KV allows 1,000
writes and 100k reads/day. The hourly cron is 24 runs/day, and most of those
write nothing.

## Layout

Three tabs:

- **Overview** - four KPI cards, the path completion ring, the current course,
  the streak and the projected finish, then four charts (lessons per day,
  cumulative lessons, hours remaining by language, path make-up by course type).
- **Roadmap** - all 23 courses in a sortable table, filterable by status, type,
  language and name. On phones each row becomes a card and sorting moves to a
  control above the list.
- **Achievements** - unlocked, next up, and the full streak milestone ladder.

## Light and dark mode

The button in the top right cycles **Auto -> Light -> Dark**. Auto follows your
operating system setting; Light and Dark override it. The choice is saved in
`localStorage`, so it survives a reload.

Both modes are audited against WCAG AA (4.5:1 for normal text, 3:1 for large).
Small text uses separate `--accent-text` / `--good-text` / `--warning-text`
tokens, because a color bright enough to read as a 20px chart bar can fail as
11px type on a light surface.

Charts use Chart.js, vendored into `public/vendor/` so the page still works with
no internet connection. Colors are read from the CSS custom properties, so light
and dark mode stay in sync with the stylesheet. The categorical palette is
capped at three slots (the validated all-pairs limit); the by-language chart uses
a single hue and a value axis instead, since eight colors could not stay
distinguishable for colorblind readers.

## How it stays current

The page re-polls every 60 seconds, on tab focus, and on the ↻ button. The server
caches profile data for 60s and the curriculum for 6h, so refreshing is cheap.

Data comes from boot.dev's public endpoints:

| Source | Gives |
|---|---|
| `api.boot.dev/v1/users/public/<handle>` | XP, level, role, gems |
| `…/stats` | lessons solved, leaderboard rank, karma |
| `…/achievements` | unlocked + locked achievements |
| `boot.dev/u/<handle>` | completed courses and their completion dates |
| `boot.dev/paths/backend` | the ordered 23-course curriculum |

If the path page can't be parsed, the server falls back to `path-snapshot.json`
and the UI keeps working.

## About the estimated figures

boot.dev publishes **totals**, not per-lesson progress - there is no public
endpoint for "which lesson am I on". So two things are derived, and both are
labelled `estimated` in the UI:

- **Current course and lesson.** Completed courses are known exactly. The
  remaining lessons from your solved count are walked forward through the path in
  order, which lands on a course and a chapter. This is right as long as you work
  through the path roughly in order.
- **Hours spent / left.** boot.dev doesn't track your real study time either.
  Hours come from each course's own `EstimatedCompletionTimeHours`: finished
  courses count in full, the current one pro-rated by lessons done.
- **Current streak.** The live counter is behind login, but the streak
  *achievements* are public and pin it down. "Study consistently for 8 days"
  unlocking on Jul 31 means the streak began Jul 24; the next tier (Silver, 13
  days) still being locked caps it below 13. Local daily history extends it
  forward, and a recorded day with no lessons resets it.

## Daily pace

Since boot.dev exposes only lifetime totals, the server stamps your totals into
`history.json` on each refresh - one row per day. Day-over-day deltas become the
daily progress bars, and a rolling **7-day average** drives the hours/day figure
and the projected finish date. So the "time left" and ETA move with how much you
actually get done, rather than sitting on a lifetime average.

Two guards keep this honest rather than noisy:

- **A single day is not a pace.** Below three recorded days the projection uses
  the lifetime average and the chart caption says how many days it has.
- **Gaps are spread, not spiked.** The server is not always running, so two rows
  can be days apart. Each gain is divided across the days it actually covers
  instead of landing as one huge day, and those bars are marked in the tooltip.

Leave the server running (or just open the page daily) to build history.

`history.json` is generated - delete it to reset tracking.
