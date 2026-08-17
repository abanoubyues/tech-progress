/* boot.dev progress dashboard
   Charts use Chart.js (vendored locally so the page works offline).
   Every chart reads its colors from the CSS custom properties so light and dark
   mode stay in sync with the stylesheet rather than hardcoding hex here. */

/* Hourly, on the same wall clock as the Worker's cron rather than an hour from
   whenever a tab happened to open. boot.dev totals move slowly, so polling more
   often just spends requests without showing anything new.

   Cron minutes are UTC, so these are too: a viewer on a half-hour offset (IST,
   NPT) would otherwise land 30 minutes off the tick. The lag gives the cron's
   own upstream fetch and KV write room to land, so the page reads the row the
   cron just wrote instead of racing it. */
const HOUR_MS = 60 * 60 * 1000;
const TICK_MINUTE = 59;
const TICK_LAG_MS = 45 * 1000;
const $ = (id) => document.getElementById(id);

/** When the most recent cron tick landed, at or before `now`. */
function lastTickAt(now = Date.now()) {
  const t = new Date(now);
  t.setUTCMinutes(TICK_MINUTE, 0, 0);
  const at = t.getTime() + TICK_LAG_MS;
  return at <= now ? at : at - HOUR_MS;
}

/** How long to wait for the next one. */
const msUntilNextTick = (now = Date.now()) => lastTickAt(now) + HOUR_MS - now;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -------------------------------------------------------------- helpers */

const fmt = (n) => Math.round(n).toLocaleString();
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Chart.js needs concrete colors, so resolve the theme tokens on each build. */
function theme() {
  return {
    s1: cssVar('--series-1'),
    s2: cssVar('--series-2'),
    s3: cssVar('--series-3'),
    grid: cssVar('--grid'),
    axis: cssVar('--axis'),
    muted: cssVar('--muted'),
    ink: cssVar('--ink'),
    ink2: cssVar('--ink-2'),
    surface: cssVar('--surface'),
    surface2: cssVar('--surface-2'),
    border: cssVar('--border'),
  };
}

function relTime(iso) {
  const secs = (Date.now() - new Date(iso)) / 1000;
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const shortDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Counts a number up to its target. The final value is written immediately and
 * the animation only plays over the top: requestAnimationFrame is throttled in
 * background tabs, and painting solely from inside the callback used to leave
 * every figure showing 0 until the tab was focused.
 */
function countUp(el, to, render) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  el.innerHTML = render(to);
  if (from === to || reduceMotion) return;

  const dur = 700;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.innerHTML = render(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setRing(el, pct) {
  const c = 2 * Math.PI * Number(el.getAttribute('r'));
  el.style.strokeDasharray = String(c);
  el.style.strokeDashoffset = String(c * (1 - Math.min(1, Math.max(0, pct / 100))));
}

/* ---------------------------------------------------------- chart setup */

Chart.defaults.font.family =
  'system-ui, -apple-system, "Segoe UI", sans-serif';
Chart.defaults.font.size = 11;
// Four charts on one screen: entry animation is off per the dashboard perf
// guidance, and it also removes any dependency on Chart.js's shared animator,
// which stalls when every chart is destroyed and rebuilt in the same tick.
Chart.defaults.animation = false;

/** Shared tooltip/scale chrome so all four charts read as one system. */
function baseOptions(t) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.surface2,
        titleColor: t.ink,
        bodyColor: t.ink2,
        borderColor: t.border,
        borderWidth: 1,
        padding: 11,
        cornerRadius: 8,
        displayColors: false,
        titleFont: { weight: '700', size: 12 },
        bodySpacing: 5,
        caretSize: 5,
      },
    },
    // Hovering anywhere in a column counts, not just on the mark itself.
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    scales: {
      x: {
        grid: { display: false },
        border: { color: t.axis },
        ticks: { color: t.muted },
      },
      y: {
        beginAtZero: true,
        grid: { color: t.grid, drawTicks: false },
        border: { display: false },
        ticks: { color: t.muted, precision: 0 },
      },
    },
  };
}

const charts = {};

function destroyCharts() {
  Object.keys(charts).forEach((k) => {
    if (charts[k]) charts[k].destroy();
    delete charts[k];
  });
}

/**
 * Re-creating a chart on a canvas that was just destroyed leaves the new
 * instance believing it is already sized, so it never performs its first draw
 * and the canvas stays blank. Swapping in a clean canvas avoids that entirely.
 */
function freshCanvas(id) {
  const old = document.getElementById(id);
  const next = old.cloneNode(false);
  next.removeAttribute('width');
  next.removeAttribute('height');
  next.removeAttribute('style');
  old.replaceWith(next);
  return next;
}

function buildCharts(d) {
  const t = theme();
  // Chart.js falls back to its own dark grey for any text we do not colour
  // explicitly, which is unreadable on the dark surface. Anchor the default.
  Chart.defaults.color = t.ink2;
  Chart.defaults.borderColor = t.grid;
  destroyCharts();

  const days = d.time.daily || [];
  const hasTrend = days.length >= 2;

  // An empty-state message stands in for a chart with nothing to plot.
  $('chartDaily').style.display = days.length ? '' : 'none';
  $('chartCumulative').style.display = hasTrend ? '' : 'none';

  /* Lessons per day: single series, so no legend. XP belongs to the same day but
     runs in the thousands against single-digit lesson counts, so plotting it
     would need a second axis and flatten these bars; it reads in the tooltip
     instead, where it is the thing that tells an idle day from a quiet one. */
  $('emptyDaily').hidden = days.length > 0;
  if (days.length) {
    charts.daily = new Chart(freshCanvas('chartDaily'), {
      type: 'bar',
      data: {
        labels: days.map((x) => shortDate(x.date)),
        datasets: [
          {
            data: days.map((x) => x.lessons),
            backgroundColor: t.s1,
            borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
            maxBarThickness: 46,
          },
        ],
      },
      options: {
        ...baseOptions(t),
        plugins: {
          ...baseOptions(t).plugins,
          tooltip: {
            ...baseOptions(t).plugins.tooltip,
            callbacks: {
              title: (items) => {
                const row = days[items[0].dataIndex];
                return new Date(row.date).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                });
              },
              label: (c) => {
                const row = days[c.dataIndex];
                const lines = [
                  `${row.lessons} lesson${row.lessons === 1 ? '' : 's'} solved`,
                  `${row.hours.toFixed(1)} hours of course time`,
                ];
                lines.push(row.xp ? `${fmt(row.xp)} XP earned` : 'no XP earned');
                const avg = d.time.pace.lessonsPerDay;
                if (avg > 0) {
                  const diff = row.lessons - avg;
                  lines.push(
                    `${Math.abs(diff).toFixed(1)} ${diff >= 0 ? 'above' : 'below'} your average`
                  );
                }
                if (row.spread) lines.push('Averaged across days with no recording');
                return lines;
              },
            },
          },
        },
      },
    });
  }

  /* Cumulative lessons against the path total. */
  $('emptyCumulative').hidden = hasTrend;
  if (hasTrend) {
    let run = d.stats.lessonsDone - days.reduce((a, x) => a + x.lessons, 0);
    const cum = days.map((x) => (run += x.lessons));
    charts.cumulative = new Chart(freshCanvas('chartCumulative'), {
      type: 'line',
      data: {
        labels: days.map((x) => shortDate(x.date)),
        datasets: [
          {
            data: cum,
            borderColor: t.s1,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 8,
            pointBackgroundColor: t.s1,
            pointBorderColor: t.surface,
            pointBorderWidth: 2,
            tension: 0.25,
          },
        ],
      },
      options: {
        ...baseOptions(t),
        interaction: { mode: 'index', intersect: false },
        scales: {
          ...baseOptions(t).scales,
          y: {
            ...baseOptions(t).scales.y,
            suggestedMax: Math.min(d.stats.totalLessons, Math.max(...cum) * 1.25),
            ticks: { ...baseOptions(t).scales.y.ticks, callback: (v) => fmt(v) },
          },
        },
        plugins: {
          ...baseOptions(t).plugins,
          tooltip: {
            ...baseOptions(t).plugins.tooltip,
            callbacks: {
              title: (items) =>
                new Date(days[items[0].dataIndex].date).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                }),
              label: (c) => {
                const total = d.stats.totalLessons;
                const doneHere = c.parsed.y;
                const lines = [
                  `${fmt(doneHere)} of ${fmt(total)} lessons`,
                  `${((doneHere / total) * 100).toFixed(1)}% of the path`,
                  `${fmt(total - doneHere)} lessons remaining`,
                ];
                if (c.dataIndex > 0) {
                  const gain = doneHere - charts.cumulative.data.datasets[0].data[c.dataIndex - 1];
                  lines.push(`${gain > 0 ? '+' : ''}${gain.toFixed(1)} since the day before`);
                }
                return lines;
              },
            },
          },
        },
      },
    });
  }

  /* Hours remaining by language: 8 categories, so one hue and a value axis
     rather than a colour-per-slice that no palette could keep distinct. */
  const langMap = new Map();
  d.courses.forEach((c) => {
    if (c.status === 'done') return;
    const key = c.language === 'any' ? 'no language' : c.language;
    const remaining = c.status === 'current' ? c.hours * (1 - c.lessonsDone / c.lessons) : c.hours;
    const row = langMap.get(key) || { hours: 0, courses: 0, lessons: 0, titles: [] };
    row.hours += remaining;
    row.courses += 1;
    row.lessons += c.lessons - c.lessonsDone;
    row.titles.push(c.title);
    langMap.set(key, row);
  });
  const langs = [...langMap.entries()].sort((a, b) => b[1].hours - a[1].hours);
  const langTotal = langs.reduce((a, [, v]) => a + v.hours, 0);
  charts.lang = new Chart(freshCanvas('chartLang'), {
    type: 'bar',
    data: {
      labels: langs.map(([k]) => k),
      datasets: [
        {
          data: langs.map(([, v]) => Math.round(v.hours)),
          backgroundColor: t.s1,
          borderRadius: { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 },
          borderSkipped: false,
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      ...baseOptions(t),
      indexAxis: 'y',
      interaction: { mode: 'nearest', axis: 'y', intersect: false },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: t.grid, drawTicks: false },
          border: { display: false },
          ticks: { color: t.muted, callback: (v) => `${v}h` },
        },
        y: {
          grid: { display: false },
          border: { color: t.axis },
          ticks: { color: t.ink2 },
        },
      },
      plugins: {
        ...baseOptions(t).plugins,
        tooltip: {
          ...baseOptions(t).plugins.tooltip,
          callbacks: {
            title: (items) => items[0].label,
            label: (c) => {
              const v = langs[c.dataIndex][1];
              const perDay = d.time.pace.hoursPerDay || d.time.pace.lifetimeHoursPerDay;
              const lines = [
                `${Math.round(v.hours)} hours left`,
                `${((v.hours / langTotal) * 100).toFixed(0)}% of everything remaining`,
                `${v.courses} course${v.courses === 1 ? '' : 's'}, ${fmt(v.lessons)} lessons`,
              ];
              if (perDay > 0) lines.push(`about ${Math.round(v.hours / perDay)} days at your pace`);
              // Name the courses, up to a readable limit.
              lines.push('');
              v.titles.slice(0, 4).forEach((title) => lines.push(title));
              if (v.titles.length > 4) lines.push(`and ${v.titles.length - 4} more`);
              return lines;
            },
          },
        },
      },
    },
  });

  /* Course-type split: 3 slots, which is the validated all-pairs limit for a
     form where every segment gets compared against every other. */
  const typeMap = new Map();
  d.courses.forEach((c) => {
    const row = typeMap.get(c.type) || { hours: 0, courses: 0, lessons: 0, done: 0 };
    row.hours += c.hours;
    row.courses += 1;
    row.lessons += c.lessons;
    if (c.status === 'done') row.done += 1;
    typeMap.set(c.type, row);
  });
  const types = [...typeMap.entries()].sort((a, b) => b[1].hours - a[1].hours);
  charts.type = new Chart(freshCanvas('chartType'), {
    type: 'doughnut',
    data: {
      labels: types.map(([k]) => k),
      datasets: [
        {
          data: types.map(([, v]) => v.hours),
          backgroundColor: [t.s1, t.s2, t.s3],
          borderColor: t.surface,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        // Direct labels are the relief for the light-mode contrast warning.
        legend: {
          // A side legend has no room on a phone, so it moves under the ring.
          position: window.innerWidth < 620 ? 'bottom' : 'right',
          labels: {
            color: t.ink2,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 14,
            generateLabels: (chart) =>
              chart.data.labels.map((label, i) => ({
                text: `${label}  ${chart.data.datasets[0].data[i]}h`,
                fillStyle: chart.data.datasets[0].backgroundColor[i],
                strokeStyle: 'transparent',
                // Custom items bypass labels.color, so set it per item.
                fontColor: t.ink2,
                index: i,
              })),
          },
        },
        tooltip: {
          backgroundColor: t.surface2,
          titleColor: t.ink,
          bodyColor: t.ink2,
          borderColor: t.border,
          borderWidth: 1,
          padding: 11,
          cornerRadius: 8,
          displayColors: false,
          titleFont: { weight: '700', size: 12 },
          bodySpacing: 5,
          callbacks: {
            title: (items) => items[0].label,
            label: (c) => {
              const total = c.dataset.data.reduce((a, b) => a + b, 0);
              const v = types[c.dataIndex][1];
              return [
                `${v.hours} hours (${((v.hours / total) * 100).toFixed(0)}% of the path)`,
                `${v.courses} course${v.courses === 1 ? '' : 's'}, ${fmt(v.lessons)} lessons`,
                `${v.done} of ${v.courses} finished`,
              ];
            },
          },
        },
      },
    },
  });

  // Paint now rather than waiting on a queued frame, so a theme switch or a
  // tab switch never leaves an empty canvas behind.
  Object.values(charts).forEach((c) => c && c.draw());
}

/* ------------------------------------------------------- roadmap table */

const table = { sort: 'index', dir: 'asc' };
let rows = [];

function populateFilter(id, values) {
  const sel = $(id);
  const keep = sel.value;
  sel.innerHTML = '<option value="all">All</option>';
  values.forEach((v) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
}

function visibleRows() {
  const status = $('fStatus').value;
  const type = $('fType').value;
  const lang = $('fLang').value;
  const q = $('fSearch').value.trim().toLowerCase();

  return rows.filter((r) => {
    if (status !== 'all' && r.statusLabel !== status) return false;
    if (type !== 'all' && r.type !== type) return false;
    if (lang !== 'all' && r.language !== lang) return false;
    if (q && !r.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderTable() {
  const data = visibleRows();
  const dir = table.dir === 'asc' ? 1 : -1;
  const sorted = [...data].sort((a, b) => {
    const av = a[table.sort];
    const bv = b[table.sort];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  $('roadBody').innerHTML = sorted
    .map(
      (r) => `<tr class="${r.status === 'current' ? 'row-current' : ''}">
      <td class="num t-index" data-label="Step">${r.index}</td>
      <td class="t-title" data-label="Course">${r.title}</td>
      <td data-label="Type">${r.type}</td>
      <td class="t-lang" data-label="Language">${r.language}</td>
      <td class="num" data-label="Lessons">${fmt(r.lessons)}</td>
      <td class="num" data-label="Hours">${r.hours}</td>
      <td class="num" data-label="XP">${fmt(r.xp)}</td>
      <td data-label="Status"><span class="pill pill-${r.status}">${r.statusLabel}</span></td>
      <td class="num" data-label="Progress">${
        r.pct > 0
          ? `<span class="mini"><i style="width:${Math.max(2, r.pct * 0.42)}px"></i>${r.pct.toFixed(0)}%</span>`
          : '<span class="muted">0%</span>'
      }</td>
    </tr>`
    )
    .join('');

  $('emptyTable').hidden = sorted.length > 0;
  const hoursShown = sorted.reduce((a, r) => a + r.hours, 0);
  $('tableMeta').textContent =
    `Showing ${sorted.length} of ${rows.length} courses, ${fmt(hoursShown)} estimated hours`;

  document.querySelectorAll('#roadTable thead th').forEach((th) => {
    if (th.dataset.sort === table.sort) th.setAttribute('aria-sort', table.dir === 'asc' ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  });

  // Keep the phone-only sort control showing the same state as the headers.
  $('fSort').value = table.sort;
  $('fSortDir').textContent = table.dir === 'asc' ? 'Ascending' : 'Descending';
}

/* --------------------------------------------------------------- render */

function render(d) {
  /* identity */
  $('name').textContent = d.user.name;
  $('handle').textContent = '@' + d.user.handle;
  $('handle').href = d.user.profileURL;
  $('footLink').href = d.user.profileURL;
  $('role').textContent = d.user.role;
  $('member').hidden = !d.user.isMember;
  $('lvlNum').textContent = d.user.level;

  // XPForLevel is XP earned into the current level; XPTotalForLevel is the band.
  const lvlPct = d.user.xpForNextLevel ? (d.user.xpIntoLevel / d.user.xpForNextLevel) * 100 : 0;
  setRing($('lvlRing'), lvlPct);
  $('avatarRing').title =
    `${fmt(d.user.xpIntoLevel)} of ${fmt(d.user.xpForNextLevel)} XP into level ${d.user.level}. ` +
    `${fmt(d.user.xpForNextLevel - d.user.xpIntoLevel)} XP to level ${d.user.level + 1}.`;

  $('pfCourses').textContent = d.stats.totalCourses;
  $('pfLessons').textContent = fmt(d.stats.totalLessons);
  $('pfHours').textContent = fmt(d.time.totalHours);
  $('pfMonths').textContent = `${d.time.pathMonths} months`;

  /* KPI row */
  const today = d.time.today || { lessons: 0, hours: 0 };
  const gainedToday = today.lessons > 0;

  countUp($('kpiPct'), d.stats.pctLessons, (v) => `${v.toFixed(1)}<span class="u">%</span>`);
  $('kpiPctChange').textContent = `${fmt(d.stats.totalLessons - d.stats.lessonsDone)} lessons remaining`;

  countUp($('kpiLessons'), d.stats.lessonsDone, (v) => fmt(v));
  $('kpiLessonsChange').textContent = gainedToday
    ? `+${today.lessons} today`
    : `of ${fmt(d.stats.totalLessons)} on the path`;
  $('kpiLessonsChange').className = `kpi-change${gainedToday ? ' positive' : ''}`;

  countUp($('kpiSpent'), d.time.hoursDone, (v) => `${Math.round(v)}<span class="u">h</span>`);
  $('kpiSpentChange').textContent = gainedToday
    ? `+${today.hours.toFixed(1)}h today`
    : `over ${d.user.daysActive} days`;
  $('kpiSpentChange').className = `kpi-change${gainedToday ? ' positive' : ''}`;

  countUp($('kpiLeft'), d.time.hoursLeft, (v) => `${Math.round(v)}<span class="u">h</span>`);
  // The same etaDays the projection uses. Dividing hours left by hours per day
  // looks equivalent but is not: hours left comes from whole-course accounting
  // and hours per day from lessons, so the two put a different number of days
  // on the same screen.
  $('kpiLeftChange').textContent =
    d.time.etaDays !== null ? `${fmt(d.time.etaDays)} days at current pace` : 'no pace recorded yet';

  /* path ring */
  setRing($('pathRing'), d.stats.pctLessons);
  countUp($('pathPct'), d.stats.pctLessons, (v) => `${v.toFixed(1)}<span>%</span>`);
  countUp($('lessonsDone'), d.stats.lessonsDone, (v) => fmt(v));
  countUp($('lessonsLeft'), d.stats.totalLessons - d.stats.lessonsDone, (v) => fmt(v));
  $('coursesDone').textContent = `${d.stats.coursesDone} / ${d.stats.totalCourses}`;

  /* projection */
  if (d.time.etaDays) {
    const months = d.time.etaDays / 30.44;
    $('eta').innerHTML =
      months >= 2
        ? `${months.toFixed(1)}<span class="u">months</span>`
        : `${d.time.etaDays}<span class="u">days</span>`;
    $('etaSub').textContent =
      `around ${shortDate(d.time.etaDate)}, from your ` +
      (d.time.pace.source === 'recent'
        ? `last ${d.time.pace.windowDays} day${d.time.pace.windowDays === 1 ? '' : 's'}`
        : 'lifetime average');
  } else {
    $('eta').textContent = 'n/a';
    $('etaSub').textContent = 'needs a day of recorded activity';
  }
  $('paceLessons').textContent = d.time.pace.lessonsPerDay.toFixed(1);
  $('paceHours').textContent = d.time.pace.hoursPerDay.toFixed(1);
  $('paceToday').textContent = `${today.lessons} lessons`;
  // This caption sits on the chart, so it has to describe the bars actually
  // drawn - all of them - and not just the shorter window the pace averages
  // over, which read as a claim that only 7 bars were shown.
  const p = d.time.pace;
  const avg = `${p.lessonsPerDay.toFixed(1)} lessons/day`;
  const recorded = `${p.recordedDays || 0} day${p.recordedDays === 1 ? '' : 's'} recorded`;
  $('paceNote').textContent =
    p.source === 'recent'
      ? `${recorded}, last ${p.windowDays} average ${avg}`
      : `${recorded}, lifetime average ${avg}`;

  /* current course */
  if (d.current) {
    $('currentCard').hidden = false;
    $('curThumb').src = d.current.thumb || '';
    $('curThumb').alt = d.current.title;
    $('curTitle').textContent = d.current.title;
    $('curBlurb').textContent = d.current.blurb || '';
    $('curLink').href = d.current.url;
    $('curChapter').textContent = d.current.chapter
      ? `Chapter ${d.current.chapter.index} of ${d.current.chapter.of}, ${d.current.chapter.title}` +
        ` (lesson ${d.current.chapter.lessonInChapter} of ${d.current.chapter.chapterLessons})`
      : d.current.started
        ? 'In progress'
        : 'Not started yet';
    $('curBar').style.width = `${d.current.pct}%`;
    $('curLessons').textContent = `${d.current.lessonsDone} of ${d.current.lessons} lessons`;
    $('curPct').textContent = `${d.current.pct.toFixed(0)}%`;
  } else {
    $('currentCard').hidden = true;
  }

  /* streak */
  const s = d.streak;
  if (s && s.days !== null) {
    $('streakTile').hidden = false;
    countUp($('streakDays'), s.days, (v) => Math.round(v));
    // A configured start date is known, not guessed: drop the "est." marker.
    $('streakEst').hidden = !s.estimated;
    // What carried a quiet day is not shown: the bank is simulated from public
    // totals and boot.dev disagrees with it. The start date is derivable, so
    // that is all the tile claims.
    $('streakSub').textContent = s.since
      ? `unbroken since ${shortDate(s.since)}`
      : 'tracking from today';
    if (s.nextTier) {
      $('streakBar').style.width = `${Math.min(100, (s.days / s.nextTier.at) * 100)}%`;
      $('streakBadge').src = s.nextTier.thumb || '';
      // A known streak is no longer capped by the locked tier, so it can pass
      // the target while the achievement is still catching up.
      const gap = s.nextTier.at - s.days;
      $('streakNext').textContent =
        gap > 0
          ? `${gap} more day${gap === 1 ? '' : 's'} to ${s.nextTier.title}`
          : `${s.nextTier.title} earned, waiting on boot.dev`;
      $('streakGoal').textContent = `${s.days} / ${s.nextTier.at}`;
    } else {
      $('streakBar').style.width = '100%';
      $('streakNext').textContent = 'every streak milestone earned';
      $('streakGoal').textContent = '';
    }
  } else {
    $('streakTile').hidden = true;
  }

  /* charts */
  buildCharts(d);

  /* roadmap rows + filters */
  const label = { done: 'Done', current: 'Current', locked: 'Upcoming' };
  rows = d.courses.map((c, i) => ({
    index: i + 1,
    title: c.title,
    type: c.type,
    language: c.language === 'any' ? 'no language' : c.language,
    lessons: c.lessons,
    hours: c.hours,
    xp: c.xp,
    status: c.status,
    statusLabel: label[c.status],
    pct: c.status === 'done' ? 100 : (c.lessonsDone / c.lessons) * 100,
  }));
  $('tabRoadCount').textContent = `${d.stats.coursesDone}/${d.stats.totalCourses}`;
  populateFilter('fStatus', ['Done', 'Current', 'Upcoming']);
  populateFilter('fType', [...new Set(rows.map((r) => r.type))].sort());
  populateFilter('fLang', [...new Set(rows.map((r) => r.language))].sort());
  renderTable();

  /* achievements */
  /* Grouped by category, and a group is only rendered once something in it has
     actually been unlocked - an empty section says nothing and a category the
     user has never touched is noise. Streak is the exception: it shows the whole
     ladder, locked tiers included, because the point of it is what comes next.
     Anything outside the known set collects under "Other", so a category
     boot.dev adds later still appears the first time one is earned. */
  const achArt = (a) => `<img src="${a.thumb}" alt="" loading="lazy" />`;
  const unlocked = d.achievements.unlocked || [];
  const streakLadder = d.achievements.streak || [];

  const tile = (a, sub, locked) =>
    `<div class="ach ${locked ? 'locked' : ''}" data-tip="${a.description}" tabindex="0">
      ${achArt(a)}
      <div><div class="ach-t">${a.title}</div><div class="ach-d">${sub}</div></div>
    </div>`;

  const card = (title, note, body) =>
    `<section class="card">
      <div class="sec-head"><h2>${title}</h2><span class="muted">${note}</span></div>
      <div class="ach-grid">${body}</div>
    </section>`;

  const byCategory = (key) => unlocked.filter((a) => a.category === key);
  const count = (n) => `${n} unlocked`;
  const earned = (a) => tile(a, shortDate(a.at), false);

  // Streak sits between the plain categories and Showdown; Other always last.
  const KNOWN = ['role', 'sharpshooter', 'milestone', 'streak', 'boss'];
  const sections = [];

  for (const [key, label] of [
    ['role', 'Role'],
    ['sharpshooter', 'Sharpshooter'],
    ['milestone', 'Milestone'],
  ]) {
    const items = byCategory(key);
    if (items.length) sections.push(card(label, count(items.length), items.map(earned).join('')));
  }

  if (streakLadder.length) {
    const note = s && s.days !== null ? `currently at ${s.days} days` : '';
    sections.push(
      card(
        'Streak',
        note,
        streakLadder
          .map((a) => tile(a, a.at ? shortDate(a.at) : `${a.target} days`, !a.at))
          .join('')
      )
    );
  }

  const showdown = byCategory('boss');
  if (showdown.length) {
    sections.push(card('Showdown', count(showdown.length), showdown.map(earned).join('')));
  }

  const other = unlocked.filter((a) => !KNOWN.includes(a.category));
  if (other.length) {
    sections.push(card('Other', count(other.length), other.map(earned).join('')));
  }

  $('achCount').textContent = `${unlocked.length} of ${d.achievements.total} unlocked`;
  $('tabAchCount').textContent = unlocked.length;
  $('achSections').innerHTML = sections.join('');

  showSynced(d.updatedAt);
}

/** Wall-clock time of the last successful fetch, plus how long ago that was. */
function showSynced(iso) {
  const at = new Date(iso);
  $('syncedTime').textContent = at.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  $('syncedRel').textContent = relTime(iso);
  // toLocaleString with no timeZone renders in the viewer's own device timezone.
  $('synced').title =
    `Last synced ${at.toLocaleString()} (your device time). ` +
    'The page refreshes itself hourly, just after each hourly recording.';
}

/* ---------------------------------------------------------------- fetch */

let last = null;
// When the payload on screen was fetched, cache hits included. Compared against
// the tick clock to tell a current copy from one the cron has since superseded.
let lastFetchedAt = 0;

/* Reloading the page must not count as a sync, so the last payload is kept in
   localStorage with the time it was fetched. Until the next tick a reload
   renders straight from that copy and makes no request at all, which is why the
   Last synced stamp keeps showing the original time instead of jumping to now.
   Once a tick has passed, a reload does fetch, so the page never shows a figure
   the cron has already superseded.
   Bump CACHE_V whenever the payload shape changes, so old copies are discarded. */
const CACHE_KEY = 'bootdev-progress-cache';
const CACHE_V = 1;

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!c || c.v !== CACHE_V || !c.payload || !c.fetchedAt) return null;
    // Guard against a clock that moved backwards.
    if (c.fetchedAt > Date.now()) return null;
    return c;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ v: CACHE_V, fetchedAt: Date.now(), payload })
    );
  } catch {
    /* storage full or blocked: caching is an optimisation, not a requirement */
  }
}

function reveal() {
  $('boot').hidden = true;
  $('app').hidden = false;
}

/* Silent by design: no status pill, no manual refresh. The Last synced stamp is
   the freshness signal and errbar surfaces failures. */
async function load(fresh = false) {
  try {
    const res = await fetch(`/api/progress${fresh ? '?fresh=1' : ''}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    last = data;
    lastFetchedAt = Date.now();
    writeCache(data);
    // Reveal first: charts built inside a hidden container measure zero.
    reveal();
    render(data);
    $('errbar').hidden = true;
  } catch (err) {
    const bar = $('errbar');
    bar.textContent = `Could not reach boot.dev: ${err.message}`;
    bar.hidden = false;
    // A failed poll must not leave a blank page when a cached copy exists.
    if (last) reveal();
  }
}

/* ------------------------------------------------------------ listeners */

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.panel').forEach((p) => {
      p.hidden = p.id !== `panel-${tab.dataset.panel}`;
    });
    // A canvas built inside a hidden panel measures zero, so re-measure once the
    // panel is actually laid out, then repaint at the new size.
    requestAnimationFrame(() =>
      Object.values(charts).forEach((c) => {
        if (!c) return;
        c.resize();
        c.draw();
      })
    );
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});

['fStatus', 'fType', 'fLang'].forEach((id) =>
  $(id).addEventListener('change', renderTable)
);
$('fSearch').addEventListener('input', renderTable);
$('fSort').addEventListener('change', () => {
  table.sort = $('fSort').value;
  renderTable();
});
$('fSortDir').addEventListener('click', () => {
  table.dir = table.dir === 'asc' ? 'desc' : 'asc';
  renderTable();
});
$('fReset').addEventListener('click', () => {
  $('fStatus').value = 'all';
  $('fType').value = 'all';
  $('fLang').value = 'all';
  $('fSearch').value = '';
  renderTable();
});

document.querySelectorAll('#roadTable thead th').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (table.sort === key) table.dir = table.dir === 'asc' ? 'desc' : 'asc';
    else {
      table.sort = key;
      table.dir = typeof rows[0]?.[key] === 'number' ? 'desc' : 'asc';
    }
    renderTable();
  });
});

// The page follows the OS light/dark setting. Chart colors are read from CSS, so
// they need rebuilding when that setting flips.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (last) buildCharts(last);
});

// Chart.js resizes its own canvas, but the doughnut legend has to move between
// side and bottom, so rebuild only when that breakpoint is actually crossed.
let wasNarrow = window.innerWidth < 620;
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const narrow = window.innerWidth < 620;
    if (narrow !== wasNarrow && last) {
      wasNarrow = narrow;
      buildCharts(last);
    }
  }, 180);
});

// Keep the "ago" part honest between polls. Text only, no network.
setInterval(() => {
  if (last) $('syncedRel').textContent = relTime(last.updatedAt);
}, 60_000);

/* The hourly tick is the only refetch. Deliberately nothing on reload while the
   cached copy is still current, so the sync cadence stays hourly rather than
   once per page view.

   Recomputed from the clock after every run rather than chained as a fixed
   hour, so a run that fires late (see the throttling note below) lands the next
   one back on the tick instead of dragging the whole cycle off it. */
let nextTimer;
function scheduleNext(delay = msUntilNextTick()) {
  clearTimeout(nextTimer);
  nextTimer = setTimeout(async () => {
    await load();
    scheduleNext();
  }, Math.max(0, delay));
}

/* Browsers throttle timers in background tabs, so the tick above can fire long
   after the cron wrote, leaving a stale screen on a tab nobody reloaded. Coming
   back to the tab is the one moment that reliably gets execution time, so catch
   up there - but only when a tick actually came and went, which keeps this from
   turning into a sync on every glance at the tab. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden || lastFetchedAt >= lastTickAt()) return;
  load().then(() => scheduleNext());
});

/**
 * Age alone cannot tell a cached payload it is obsolete: a deploy can change
 * what the payload means minutes after it was stored, and reloading would keep
 * redrawing the old copy for the rest of the hour. So ask the Worker which
 * build is live. This costs a few bytes and never touches boot.dev, which keeps
 * the promise that mattered - a reload is not a sync.
 */
async function isStaleBuild(build) {
  if (!build) return true; // stored before builds were stamped
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    const live = (await res.json()).build;
    return Boolean(live) && live !== build;
  } catch {
    return false; // offline: the cached copy is the best there is
  }
}

const cached = readCache();
// Escape hatch, since there is no refresh button: loading /?fresh=1 skips both
// the cached copy and the Worker's own cache.
const forceFresh = new URLSearchParams(location.search).get('fresh') === '1';
// A copy counts as current only if it was taken after the most recent tick, not
// merely within the last hour. Age alone would let a load at :58 keep redrawing
// a copy the cron superseded, and would refetch at :05 for nothing.
const cacheIsCurrent = Boolean(cached) && cached.fetchedAt >= lastTickAt();

if (!forceFresh && cacheIsCurrent) {
  try {
    last = cached.payload;
    lastFetchedAt = cached.fetchedAt;
    // Reveal first: charts built inside a hidden container measure zero.
    reveal();
    render(last);
    // Drawn from cache already, so this resolves behind an up-to-date screen.
    isStaleBuild(cached.payload.build)
      .then((stale) => (stale ? load() : null))
      .then(() => scheduleNext());
  } catch {
    // A cached payload from an incompatible build: fetch instead.
    load().then(() => scheduleNext());
  }
} else {
  load(forceFresh).then(() => scheduleNext());
}
