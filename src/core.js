/**
 * boot.dev back-end path progress: all the data logic, with no platform APIs.
 *
 * Both entry points use this. `server.js` backs the store with a JSON file for
 * local development; `worker.js` backs it with Cloudflare KV. Nothing in here
 * touches the filesystem, so it runs unchanged on Workers.
 */

import snapshot from './path-snapshot.js';

const API = 'https://api.boot.dev/v1';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Live profile data is cheap and changes often; the curriculum barely moves.
export const USER_TTL = 60 * 1000;
export const PATH_TTL = 6 * 60 * 60 * 1000;

// What keeps a streak alive through a day with nothing solved. Embers come one
// per 15 lessons, at most 2 banked, and are always spent first. Frozen flames
// take over once the bank is empty, each covering a four-day block.
const LESSONS_PER_EMBER = 15;
const MAX_EMBERS = 2;
const FLAME_COVERS_DAYS = 4;

// How many days of history the rolling pace looks back over.
const PACE_WINDOW_DAYS = 7;
// A single noisy day is not a pace. Below this many recorded days, the lifetime
// average is the more honest projection.
const MIN_PACE_DAYS = 3;

const profileURL = (handle) => `https://www.boot.dev/u/${handle}`;
const pathURL = (slug) => `https://www.boot.dev/paths/${slug}?tech=python-golang`;

// Per-isolate best-effort cache. Losing it just means one extra upstream fetch.
const cache = { payload: null, payloadAt: 0, path: null, pathAt: 0 };

/* ------------------------------------------------------------------ fetching */

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const body = await res.json();
  return body && body.data !== undefined ? body.data : body;
}

async function getHTML(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

/**
 * boot.dev is a Nuxt app: its pages embed a flattened payload where objects
 * reference other entries by array index. This walks those references back into
 * ordinary objects.
 */
function parseNuxtPayload(html) {
  const blocks = [...html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) throw new Error('no Nuxt payload found');
  const arr = JSON.parse(blocks[0][1]);
  const WRAPPERS = /^(Ref|Reactive|EmptyRef|ShallowRef|ShallowReactive|Map|Set|Date|NuxtError)$/;

  const resolve = (i, depth = 0) => {
    if (depth > 24) return null;
    const v = arr[i];
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && WRAPPERS.test(v[0])) {
        return v.length > 1 ? resolve(v[1], depth + 1) : null;
      }
      return v.map((x) => (typeof x === 'number' ? resolve(x, depth + 1) : x));
    }
    const out = {};
    for (const k of Object.keys(v)) {
      const t = v[k];
      out[k] = typeof t === 'number' ? resolve(t, depth + 1) : t;
    }
    return out;
  };

  return { arr, resolve };
}

/** Courses the profile page reports as finished, with their completion dates. */
function parseCompletedCourses(html) {
  const { arr, resolve } = parseNuxtPayload(html);
  const seen = new Map();
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!v || Array.isArray(v) || typeof v !== 'object') continue;
    if (!('CompletedAt' in v) || !('Slug' in v)) continue;
    const c = resolve(i);
    if (c && c.Slug && c.CompletedAt) seen.set(c.Slug, c.CompletedAt);
  }
  return seen; // slug -> ISO date
}

/** The ordered Back-end path straight from the path page. */
function parsePath(html) {
  const { arr, resolve } = parseNuxtPayload(html);
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!v || Array.isArray(v) || typeof v !== 'object' || !('path' in v)) continue;
    const r = resolve(i);
    // `data` arrives either as a raw [tag, bag] tuple or already unwrapped to
    // the bag itself, depending on how the payload wrapped it.
    const bag = !r || !r.data ? null : Array.isArray(r.data) ? r.data[1] : r.data;
    if (!bag || typeof bag !== 'object') continue;
    const p = Object.values(bag).find(
      (x) => x && typeof x === 'object' && Array.isArray(x.Courses) && x.Courses.length
    );
    if (!p) continue;
    return {
      uuid: p.UUID,
      slug: p.Slug,
      title: p.Title,
      months: p.EstimatedCompletionTimeMonths,
      fetchedAt: new Date().toISOString(),
      courses: p.Courses.map((c) => ({
        uuid: c.UUID,
        slug: c.Slug,
        title: c.Title,
        type: c.TypeDescription,
        lessons: c.NumLessons,
        hours: c.EstimatedCompletionTimeHours,
        xp: c.CompletionXP,
        language: c.Language,
        thumb: c.ThumbnailURL,
        blurb: c.ShortDescription,
        chapters: (c.Chapters || []).map((ch) => ({ title: ch.Title, lessons: ch.NumLessons })),
      })),
    };
  }
  throw new Error('backend path not found in payload');
}

async function loadPath(slug) {
  if (cache.path && Date.now() - cache.pathAt < PATH_TTL) return cache.path;
  try {
    const p = parsePath(await getHTML(pathURL(slug)));
    if (!p.courses.length) throw new Error('empty course list');
    cache.path = p;
    cache.pathAt = Date.now();
    return p;
  } catch (err) {
    // The curriculum is stable enough that a bundled snapshot beats a dead page.
    console.warn('[path] live fetch failed, using snapshot:', err.message);
    const snap = { ...snapshot, stale: true };
    cache.path = snap;
    cache.pathAt = Date.now();
    return snap;
  }
}

/* -------------------------------------------------------------------- dates */

/**
 * Day boundaries decide what "today" and a streak mean, so they follow a fixed
 * timezone rather than wherever the code happens to run. A Worker is UTC.
 */
export function dayKey(date = new Date(), tz = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const keyToUTC = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const daysBetweenKeys = (a, b) => Math.round((keyToUTC(b) - keyToUTC(a)) / 86400000);

function shiftKey(key, delta) {
  const t = keyToUTC(key) + delta * 86400000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ history */

/**
 * boot.dev exposes only lifetime totals, so pace has to be measured here: each
 * run stamps today's totals into the store, and the day-over-day deltas become
 * the daily progress the estimates key off.
 *
 * Writes only when a value actually changed. Polling every minute would
 * otherwise burn through a KV write quota for no new information.
 */
async function recordToday(store, { xp, lessons, hours }, today) {
  const days = await store.read();
  const row = { date: today, xp, lessons, hours: Number(hours.toFixed(2)) };
  const i = days.findIndex((d) => d.date === today);

  if (i >= 0) {
    const prev = days[i];
    if (prev.xp === row.xp && prev.lessons === row.lessons && prev.hours === row.hours) {
      return { days, wrote: false };
    }
    days[i] = row;
  } else {
    days.push(row);
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  await store.write(days);
  return { days, wrote: true };
}

/** Per-day gains over the trailing window. */
function computePace(days, { hoursDone, lessonsDone, daysActive }, today) {
  // Consecutive rows can be several days apart if nothing recorded in between,
  // so spread each gain across the days it covers rather than spiking one day.
  const series = [];
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const cur = days[i];
    const span = Math.max(1, daysBetweenKeys(prev.date, cur.date));
    const gain = {
      lessons: Math.max(0, cur.lessons - prev.lessons),
      hours: Math.max(0, cur.hours - prev.hours),
      xp: Math.max(0, cur.xp - prev.xp),
    };
    for (let k = span; k >= 1; k--) {
      series.push({
        date: shiftKey(cur.date, -(k - 1)),
        lessons: Math.round((gain.lessons / span) * 10) / 10,
        hours: Number((gain.hours / span).toFixed(2)),
        xp: Math.round(gain.xp / span),
        // True when the value is a share of a multi-day gap, not an observed day.
        spread: span > 1,
      });
    }
  }

  const window = series.slice(-PACE_WINDOW_DAYS);
  const lifetimeHours = daysActive ? hoursDone / daysActive : 0;
  const lifetimeLessons = daysActive ? lessonsDone / daysActive : 0;

  const lifetime = {
    source: 'lifetime',
    windowDays: daysActive || 0,
    hoursPerDay: lifetimeHours,
    lessonsPerDay: lifetimeLessons,
    xpPerDay: 0,
    series,
    lifetimeHoursPerDay: lifetimeHours,
    recordedDays: series.length,
  };

  if (window.length < MIN_PACE_DAYS) return lifetime;

  const sum = (k) => window.reduce((a, d) => a + d[k], 0);
  return {
    source: 'recent',
    windowDays: window.length,
    hoursPerDay: sum('hours') / window.length,
    lessonsPerDay: sum('lessons') / window.length,
    xpPerDay: sum('xp') / window.length,
    series,
    lifetimeHoursPerDay: lifetimeHours,
    recordedDays: series.length,
  };
}

/* ------------------------------------------------------------------- streak */

/**
 * Replay what carried the streak over the recorded days. Embers bank one per 15
 * lessons solved (never more than MAX_EMBERS held) and are always spent first.
 * With the bank empty a frozen flame catches the day and covers a block of
 * FLAME_COVERS_DAYS from there; an unburnt remainder is not carried, so a later
 * quiet day starts a fresh flame.
 *
 * A day counts as quiet only when it gained neither lessons nor XP, since XP
 * catches the activity that never touches the path.
 *
 * Today is skipped: the day is still open, and nothing solved *yet* is not a
 * quiet day. The first recorded day is skipped too, since with no day before it
 * there is no delta to judge it by.
 *
 * Two things are unknowable from outside. The ember bank is seeded full, since
 * history begins well after the streak did. And flames are assumed available on
 * demand: the count is auth-gated, they arrive at random, and nothing caps them.
 * That second assumption is why nothing here declares a streak dead - with
 * unbounded cover that cannot be read, a break is not provable from the public
 * side. `BOOTDEV_STREAK_SINCE` is the correction if one ever happens.
 *
 * Only the ember/flame split rests on those guesses. The streak count does not:
 * a covered day fails to advance it whichever resource paid for it.
 */
function simulateProtection(days, startKey, today) {
  let banked = MAX_EMBERS;
  let emberDays = 0;
  let flameDays = 0;
  let flamesUsed = 0;
  let flameUntil = null;

  for (let i = 1; i < days.length; i++) {
    const cur = days[i];
    const prev = days[i - 1];
    if (keyToUTC(cur.date) < keyToUTC(startKey)) continue;

    const gainedLessons = cur.lessons - prev.lessons;
    const gainedXP = (cur.xp || 0) - (prev.xp || 0);

    if (gainedLessons > 0) {
      const earned =
        Math.floor(cur.lessons / LESSONS_PER_EMBER) -
        Math.floor(prev.lessons / LESSONS_PER_EMBER);
      banked = Math.min(MAX_EMBERS, banked + earned);
    }

    // boot.dev counts days with *activity*, not days with path lessons solved.
    // Boss fights and training grounds earn XP without touching the path, so XP
    // is the wider signal: any at all means the day stood on its own and cost
    // nothing to keep.
    if (gainedLessons > 0 || gainedXP > 0) continue;

    // Lessons solved today still bank embers, but a day that is merely unfinished
    // is not a quiet one, so only past days can spend anything.
    if (cur.date === today) continue;

    if (flameUntil && keyToUTC(cur.date) <= keyToUTC(flameUntil)) {
      flameDays += 1; // still inside a flame already burning
    } else if (banked > 0) {
      banked -= 1;
      emberDays += 1;
    } else {
      flamesUsed += 1;
      flameUntil = shiftKey(cur.date, FLAME_COVERS_DAYS - 1);
      flameDays += 1;
    }
  }

  const solved = days.length ? days[days.length - 1].lessons : 0;
  return {
    banked,
    emberDays,
    flameDays,
    flamesUsed,
    emberCap: MAX_EMBERS,
    nextEmberIn: LESSONS_PER_EMBER - (solved % LESSONS_PER_EMBER),
  };
}

/**
 * The live streak counter and the ember balance that protects it are both
 * behind auth: every public boot.dev endpoint exposes lifetime totals only.
 * So the streak start is either told to us (`streakSince`) or estimated from
 * the public streak achievements.
 *
 * The estimate is the weaker of the two. Achievement unlock times arrive in
 * backfill batches (several share a timestamp to the millisecond), so "study
 * 8 days" unlocking on a given date does not reliably place day one, and the
 * derived start can sit a couple of days off either way. A start date supplied
 * by config is therefore trusted over it, and over the locked-tier cap.
 *
 * `simulateProtection` walks the recorded history for what carried the quiet
 * days. A covered day keeps the streak alive but does not count towards it, so
 * the number always trails the calendar span by the days that were carried.
 */
function deriveStreak(achievements, days, today, tz, streakSince = '') {
  const streaks = (achievements || []).filter((a) => a.category === 'streak');
  const unlocked = streaks.filter((a) => a.unlockedAt);
  const nextTier = streaks
    .filter((a) => !a.unlockedAt)
    .sort((a, b) => a.unlockAtVal - b.unlockAtVal)[0];
  const tier = nextTier
    ? { title: nextTier.title, at: nextTier.unlockAtVal, thumb: nextTier.thumbnailURL }
    : null;

  const pinned = DAY_KEY_RE.test(streakSince) && keyToUTC(streakSince) <= keyToUTC(today);

  let startKey = null;
  let floor = 0;
  if (pinned) {
    startKey = streakSince;
  } else if (unlocked.length) {
    const best = unlocked.reduce((a, b) => (b.unlockAtVal > a.unlockAtVal ? b : a));
    floor = best.unlockAtVal;
    startKey = shiftKey(dayKey(new Date(best.unlockedAt), tz), -(best.unlockAtVal - 1));
  }

  if (!startKey) {
    return {
      days: null,
      since: null,
      floor: 0,
      capped: false,
      estimated: true,
      pinned: false,
      emberDays: 0,
      flameDays: 0,
      flamesUsed: 0,
      embers: MAX_EMBERS,
      emberCap: MAX_EMBERS,
      nextEmberIn: LESSONS_PER_EMBER,
      nextTier: tier,
    };
  }

  const { banked, emberDays, flameDays, flamesUsed, emberCap, nextEmberIn } = simulateProtection(
    days,
    startKey,
    today
  );

  // A protected day keeps the streak alive without advancing it, so the count
  // is the calendar span since day one less every day that was carried.
  let count = daysBetweenKeys(startKey, today) + 1 - emberDays - flameDays;
  // An unreached tier caps a guess, but never a start date we were handed.
  let capped = false;
  if (!pinned && tier && count >= tier.at) {
    count = tier.at - 1;
    capped = true;
  }
  count = Math.max(count, floor, 1);

  return {
    days: count,
    since: `${startKey}T00:00:00.000Z`,
    floor,
    capped,
    estimated: !pinned,
    pinned,
    emberDays,
    flameDays,
    flamesUsed,
    embers: banked,
    emberCap,
    nextEmberIn,
    nextTier: tier,
  };
}

/* ----------------------------------------------------------------- deriving */

/**
 * boot.dev publishes total lessons solved but not which lesson you are on, so
 * position within the path is derived: completed courses are known exactly, and
 * the leftover lessons are walked forward through the remaining courses in path
 * order. Everything derived this way is flagged `estimated` for the UI.
 */
function derive({ build, pathData, user, stats, achievements, completedMap, days, pace, streak, handle }) {
  const courses = pathData.courses;
  const totalLessons = courses.reduce((a, c) => a + c.lessons, 0);
  const totalHours = courses.reduce((a, c) => a + c.hours, 0);

  const done = courses.filter((c) => completedMap.has(c.slug));
  const doneSlugs = new Set(done.map((c) => c.slug));

  const lessonsInDone = done.reduce((a, c) => a + c.lessons, 0);
  let spill = Math.max(0, (stats.LessonsCompleted || 0) - lessonsInDone);

  let current = null;
  for (const c of courses) {
    if (doneSlugs.has(c.slug)) continue;
    if (spill <= 0) {
      current = { course: c, lessonsDone: 0, started: false };
      break;
    }
    if (spill < c.lessons) {
      current = { course: c, lessonsDone: spill, started: true };
      spill = 0;
      break;
    }
    spill -= c.lessons;
  }

  let chapter = null;
  if (current && current.course.chapters.length) {
    let acc = 0;
    for (let i = 0; i < current.course.chapters.length; i++) {
      const ch = current.course.chapters[i];
      if (current.lessonsDone < acc + ch.lessons) {
        chapter = {
          index: i + 1,
          of: current.course.chapters.length,
          title: ch.title,
          lessonInChapter: current.lessonsDone - acc + 1,
          chapterLessons: ch.lessons,
        };
        break;
      }
      acc += ch.lessons;
    }
  }

  const lessonsDone = Math.min(stats.LessonsCompleted || 0, totalLessons);
  const hoursDone =
    done.reduce((a, c) => a + c.hours, 0) +
    (current && current.started
      ? (current.lessonsDone / current.course.lessons) * current.course.hours
      : 0);
  const hoursLeft = Math.max(0, totalHours - hoursDone);

  const joined = user.CreatedAt ? new Date(user.CreatedAt) : null;
  const daysActive = joined ? Math.max(1, Math.round((Date.now() - joined) / 86400000)) : null;

  const hoursPerDay = pace.hoursPerDay > 0 ? pace.hoursPerDay : pace.lifetimeHoursPerDay;
  const etaDays = hoursPerDay > 0 ? Math.round(hoursLeft / hoursPerDay) : null;
  const etaDate = etaDays !== null ? new Date(Date.now() + etaDays * 86400000).toISOString() : null;

  const todayKey = days.length ? days[days.length - 1].date : null;
  const lastSeries = pace.series[pace.series.length - 1];
  const today =
    lastSeries && lastSeries.date === todayKey
      ? lastSeries
      : { date: todayKey, lessons: 0, hours: 0, xp: 0 };

  const unlocked = (achievements || []).filter((a) => a.unlockedAt);
  const nextUp = (achievements || [])
    .filter((a) => !a.unlockedAt && a.unlockAtVal > 0)
    .sort((a, b) => a.unlockAtVal - b.unlockAtVal)
    .slice(0, 4);

  return {
    build,
    updatedAt: new Date().toISOString(),
    stale: !!pathData.stale,
    user: {
      handle: user.Handle,
      name: [user.FirstName, user.LastName].filter(Boolean).join(' ') || user.Handle,
      github: user.GithubHandle,
      level: user.Level,
      role: user.Role,
      xp: user.XP,
      gems: user.Gems,
      isMember: user.IsMember,
      xpIntoLevel: user.XPForLevel,
      xpForNextLevel: user.XPTotalForLevel,
      joined: user.CreatedAt,
      daysActive,
      profileURL: profileURL(handle),
    },
    stats: {
      lessonsDone,
      totalLessons,
      pctLessons: totalLessons ? (lessonsDone / totalLessons) * 100 : 0,
      rank: stats.LeaderboardXPRankAlltime,
      karma: stats.Karma,
      coursesDone: done.length,
      totalCourses: courses.length,
    },
    streak,
    time: {
      totalHours,
      hoursDone,
      hoursLeft,
      pct: totalHours ? (hoursDone / totalHours) * 100 : 0,
      pathMonths: pathData.months,
      hoursPerDay,
      etaDays,
      etaDate,
      estimated: true,
      pace: {
        source: pace.source,
        windowDays: pace.windowDays,
        hoursPerDay: pace.hoursPerDay,
        lessonsPerDay: pace.lessonsPerDay,
        xpPerDay: pace.xpPerDay,
        lifetimeHoursPerDay: pace.lifetimeHoursPerDay,
        recordedDays: pace.recordedDays,
        minDays: MIN_PACE_DAYS,
      },
      today,
      daily: pace.series.slice(-30),
    },
    current: current && {
      slug: current.course.slug,
      title: current.course.title,
      type: current.course.type,
      language: current.course.language,
      thumb: current.course.thumb,
      blurb: current.course.blurb,
      hours: current.course.hours,
      lessonsDone: current.lessonsDone,
      lessons: current.course.lessons,
      pct: (current.lessonsDone / current.course.lessons) * 100,
      started: current.started,
      chapter,
      url: `https://www.boot.dev/courses/${current.course.slug}`,
      estimated: true,
    },
    courses: courses.map((c) => {
      const isDone = doneSlugs.has(c.slug);
      const isCurrent = current && current.course.slug === c.slug;
      return {
        slug: c.slug,
        title: c.title,
        type: c.type,
        language: c.language,
        thumb: c.thumb,
        lessons: c.lessons,
        hours: c.hours,
        xp: c.xp,
        status: isDone ? 'done' : isCurrent ? 'current' : 'locked',
        completedAt: completedMap.get(c.slug) || null,
        lessonsDone: isDone ? c.lessons : isCurrent ? current.lessonsDone : 0,
      };
    }),
    achievements: {
      unlocked: unlocked
        .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
        .map((a) => ({
          title: a.title,
          description: a.description,
          thumb: a.thumbnailURL,
          at: a.unlockedAt,
        })),
      total: (achievements || []).length,
      next: nextUp.map((a) => ({
        title: a.title,
        description: a.description,
        thumb: a.thumbnailURL,
        target: a.unlockAtVal,
      })),
      streak: (achievements || [])
        .filter((a) => a.category === 'streak')
        .sort((a, b) => a.unlockAtVal - b.unlockAtVal)
        .map((a) => ({
          title: a.title,
          description: a.description,
          thumb: a.thumbnailURL,
          target: a.unlockAtVal,
          at: a.unlockedAt,
        })),
    },
  };
}

/* -------------------------------------------------------------------- entry */

/**
 * Fetch everything, record today's totals, and return the dashboard payload.
 * `store` needs `read()` and `write(days)`; `fresh` bypasses the response cache.
 */
export async function buildPayload({
  store,
  handle = 'the_baaneh',
  pathSlug = 'backend',
  tz = 'UTC',
  streakSince = '',
  build = 'dev',
  fresh = false,
}) {
  if (!fresh && cache.payload && Date.now() - cache.payloadAt < USER_TTL) return cache.payload;

  const [user, stats, achievements, profileHTML, pathData] = await Promise.all([
    getJSON(`${API}/users/public/${handle}`),
    getJSON(`${API}/users/public/${handle}/stats`),
    getJSON(`${API}/users/public/${handle}/achievements`).catch(() => []),
    getHTML(profileURL(handle)),
    loadPath(pathSlug),
  ]);

  let completedMap = new Map();
  try {
    completedMap = parseCompletedCourses(profileHTML);
  } catch (err) {
    console.warn('[profile] could not read completed courses:', err.message);
  }

  const courses = pathData.courses;
  const done = courses.filter((c) => completedMap.has(c.slug));
  const lessonsInDone = done.reduce((a, c) => a + c.lessons, 0);
  let spill = Math.max(0, (stats.LessonsCompleted || 0) - lessonsInDone);
  let hoursDone = done.reduce((a, c) => a + c.hours, 0);
  for (const c of courses) {
    if (done.includes(c)) continue;
    if (spill <= 0) break;
    if (spill < c.lessons) {
      hoursDone += (spill / c.lessons) * c.hours;
      break;
    }
    spill -= c.lessons;
  }

  const today = dayKey(new Date(), tz);
  const { days } = await recordToday(
    store,
    { xp: user.XP, lessons: Math.min(stats.LessonsCompleted || 0, 1e6), hours: hoursDone },
    today
  );

  const joined = user.CreatedAt ? new Date(user.CreatedAt) : null;
  const daysActive = joined ? Math.max(1, Math.round((Date.now() - joined) / 86400000)) : null;

  const pace = computePace(
    days,
    { hoursDone, lessonsDone: stats.LessonsCompleted || 0, daysActive },
    today
  );
  const streak = deriveStreak(achievements, days, today, tz, streakSince);

  // Stamped so a client holding a pre-deploy copy can tell it is obsolete.
  const payload = derive({
    build,
    pathData,
    user,
    stats,
    achievements,
    completedMap,
    days,
    pace,
    streak,
    handle,
  });

  cache.payload = payload;
  cache.payloadAt = Date.now();
  return payload;
}

/** Used by the scheduled run: record totals without building the full payload. */
export async function recordSnapshotOnly({ store, handle = 'the_baaneh', pathSlug = 'backend', tz = 'UTC' }) {
  const payload = await buildPayload({ store, handle, pathSlug, tz, fresh: true });
  return {
    date: dayKey(new Date(), tz),
    lessons: payload.stats.lessonsDone,
    xp: payload.user.xp,
    hours: Number(payload.time.hoursDone.toFixed(2)),
  };
}
