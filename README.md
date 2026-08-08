# boot.dev Back-end Path Dashboard

Tracks progress on the boot.dev **Back-end Developer Path** for
[@the_baaneh](https://www.boot.dev/u/the_baaneh). No dependencies, no build step.

**Live:** <https://tech.bootdev-progress.workers.dev>

Runs as a single Cloudflare Worker: static dashboard, a server-side API that
reads boot.dev, Workers KV for daily history, and an hourly Cron Trigger that
records totals even on days you never open the page.

## Run locally

```bash
node server.js
```

Then open <http://localhost:4173>. `PORT`, `BOOTDEV_HANDLE`, `BOOTDEV_PATH`,
`BOOTDEV_TZ` and `BOOTDEV_STREAK_SINCE` all override the defaults.

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

## Continuous deployment

Every push to `main` deploys automatically via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml). The workflow
validates the build with `--dry-run` first, so a broken `wrangler.toml` fails CI
instead of reaching the live Worker.

It needs one repository secret. Create a Cloudflare API token from the
**Edit Cloudflare Workers** template at
<https://dash.cloudflare.com/profile/api-tokens>, then add it to the repo without
it passing through anyone else:

```bash
gh secret set CLOUDFLARE_API_TOKEN
```

That prompts for the value locally and uploads it encrypted. Until the secret
exists the deploy step skips with a warning rather than failing.

## Deploy manually

Authenticate first. Both commands open a browser, so use whichever account you
want for each:

```bash
npx wrangler login
```

The KV namespace id is already committed in `wrangler.toml`. To point a different
Cloudflare account at it, create a new namespace and swap the printed id in:

```bash
npx wrangler kv namespace create HISTORY
```

The live host is `<name>.<account subdomain>.workers.dev`, so `name` in
`wrangler.toml` controls the first label. Changing the account subdomain itself
is a one-time setting in the Cloudflare dashboard under Workers & Pages. Then:

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

## Icons and installing

The favicon and app icons are the tree-of-life mark on solid black, generated
from `assets/tree-of-life.png` into `public/icons/`. The generated files are
committed; rebuild them only if the artwork changes:

```bash
npm install --no-save sharp png-to-ico && node scripts/build-icons.mjs
```

The icons are round badges: the black sits behind the artwork as a disc and the
corners stay transparent, so they read as a circle rather than a square tile.

Two exceptions are deliberate, because those platforms mask the icon themselves:

- **Maskable (Android)** must fill the whole square, since the launcher crops it.
  Its circular mask is what makes the installed icon round. The art sits inside
  the central 80% safe zone so no mask shape clips the outer ring.
- **Apple touch icon** is also full bleed. iOS composites transparency to black
  and applies its own rounded-square mask, so a disc would just become a black
  tile. iOS always shows a squircle; that cannot be changed from the icon.

`manifest.webmanifest` makes it installable on phones and desktops, with black as
both the theme and splash colour.

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

The theme is automatic: it follows your operating system setting, and switches
live if you change that setting. There is no in-page toggle.

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

The page refetches **once an hour**, matching the Worker cron. That is the only
trigger. Nothing refreshes on tab focus, there is no manual refresh control, and
**reloading the page does not sync either**: the last payload is cached in
`localStorage` with the time it was fetched, so a reload inside the hour renders
from that copy and fetches nothing from boot.dev. The hourly cycle resumes where
it left off rather than restarting.

One exception, because age alone cannot tell a cached copy it is **wrong**: a
deploy can change what the payload means minutes after it was stored, and a
reload would happily redraw the stale copy for the rest of the hour. So each
payload carries the `build` that produced it, and a reload asks
**`/api/version`** which build is live. On a mismatch it refetches and restarts
the hour. That check is a few bytes off the Worker with no upstream call, so a
reload still is not a sync.

The build id comes from Cloudflare's `[version_metadata]` binding, which stamps
every deploy - no build step, nothing to bump by hand. Locally it reads `dev`,
so nothing invalidates during development.

To force a sync, load **`/?fresh=1`**, which skips both the cached copy and the
Worker's own cache.

The **Last synced** stamp in the header shows the wall-clock time of the last
successful fetch, in the **viewer's own device timezone**, plus how long ago that
was. The relative part re-renders every minute without any network request, and a
red bar appears if a fetch fails.

One consequence worth knowing: browsers throttle timers in background tabs, so a
tab left open for a long time can sync late and the stamp will show it (for
example "4h ago"). That affects only the display. Recorded history is unaffected,
because the Worker's hourly cron writes it server-side whether or not any tab is
open. Reloading the page always fetches immediately.

Server-side, profile data is cached for 60s and the curriculum for 6h, so a
reload is cheap.

Data comes from boot.dev's public endpoints:

| Source | Gives |
|---|---|
| `api.boot.dev/v1/users/public/<handle>` | XP, level, role, gems |
| `…/stats` | lessons solved, leaderboard rank, karma |
| `…/achievements` | unlocked + locked achievements |
| `boot.dev/u/<handle>` | completed courses and their completion dates |
| `boot.dev/paths/backend` | the ordered 23-course curriculum |

If the path page cannot be parsed, it falls back to the bundled
`src/path-snapshot.js` and the UI keeps working.

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
- **Current streak.** Both the live counter and the ember balance that protects
  it are behind login, so set `BOOTDEV_STREAK_SINCE` to the day the streak began
  (`YYYY-MM-DD`) and the dashboard counts forward from there on its own. Read it
  off boot.dev once: today minus (streak - 1) days.

  Left unset, it falls back to estimating from the public streak achievements:
  "study consistently for 8 days" unlocking on Jul 31 implying a Jul 24 start,
  with the next locked tier capping the guess. Treat that as rough: unlock times
  arrive in **backfill batches** (several share a timestamp to the millisecond),
  so the derived start can be a couple of days out either way.

- **Embers.** These are what keep a streak alive through a day with no lessons,
  and the rules are simple enough to replay from the public lesson count: one
  ember per **15 lessons** solved, **at most 2 banked**, one spent per quiet day.
  So the dashboard walks its recorded history forward, banking and spending as
  it goes, and a quiet day only breaks the streak when the bank is already
  empty. The tile shows what is left and how far off the next one is.

  A covered day keeps the streak **alive but does not advance it**, so the
  number trails the calendar span by however many embers have been spent: Jul 24
  to Aug 9 is 17 days, one of them on an ember, which boot.dev shows as 16. This
  is why `BOOTDEV_STREAK_SINCE` is not just today minus the streak.

- **Frozen flames** take over once the ember bank is empty - embers are always
  spent first. One flame covers a **four-day block** from the day it catches,
  and an unburnt remainder is not carried, so a later quiet day starts a fresh
  flame. Flame days do not count towards the streak either.

  They arrive at random with no cap, and the count is auth-gated, so the
  dashboard assumes one is available whenever the bank runs dry. **That is why
  nothing here ever declares a streak dead**: with unbounded cover that cannot
  be read, a break is not provable from the public side. If one really happens,
  `BOOTDEV_STREAK_SINCE` is the correction.

  The ember bank is also **seeded full** at the first recorded day, since
  history begins well after the streak did.

  Only the ember/flame split rests on those assumptions. The streak count does
  not: a covered day fails to advance it whichever resource paid for it, so it
  is simply the calendar span less every quiet day.

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

In production the hourly Cron Trigger builds this history on its own, so you do
not need to visit the page for the pace to stay accurate. Locally, `history.json`
is generated by the dev server; delete it to reset tracking.
