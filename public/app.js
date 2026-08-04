/* boot.dev progress dashboard
   Charts use Chart.js (vendored locally so the page works offline).
   Every chart reads its colors from the CSS custom properties so light and dark
   mode stay in sync with the stylesheet rather than hardcoding hex here. */

const REFRESH_MS = 60_000;
const $ = (id) => document.getElementById(id);

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

function countUp(el, to, render) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (from === to || reduceMotion) {
    el.innerHTML = render(to);
    return;
  }
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

  /* Lessons per day: single series, so no legend. Peak is labeled via tooltip. */
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
                if (row.xp) lines.push(`${fmt(row.xp)} XP earned`);
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
  const perDay = d.time.pace.hoursPerDay || d.time.pace.lifetimeHoursPerDay;
  $('kpiLeftChange').textContent =
    perDay > 0 ? `${fmt(d.time.hoursLeft / perDay)} days at current pace` : 'no pace recorded yet';

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
  $('paceNote').textContent =
    d.time.pace.source === 'recent'
      ? `rolling ${d.time.pace.windowDays}-day average`
      : `${d.time.pace.recordedDays || 0} day${
          d.time.pace.recordedDays === 1 ? '' : 's'
        } recorded, using lifetime average so far`;

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
    $('streakSub').textContent = s.since ? `unbroken since ${shortDate(s.since)}` : 'tracking from today';
    if (s.nextTier) {
      $('streakBar').style.width = `${Math.min(100, (s.days / s.nextTier.at) * 100)}%`;
      $('streakBadge').src = s.nextTier.thumb || '';
      const gap = s.nextTier.at - s.days;
      $('streakNext').textContent = `${gap} more day${gap === 1 ? '' : 's'} to ${s.nextTier.title}`;
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
  $('achCount').textContent = `${d.achievements.unlocked.length} of ${d.achievements.total} unlocked`;
  $('tabAchCount').textContent = d.achievements.unlocked.length;
  $('achGrid').innerHTML = d.achievements.unlocked
    .map(
      (a) => `<div class="ach" title="${a.description}">
        <img src="${a.thumb}" alt="" loading="lazy" />
        <div><div class="ach-t">${a.title}</div><div class="ach-d">${shortDate(a.at)}</div></div>
      </div>`
    )
    .join('');
  $('achNext').innerHTML = d.achievements.next
    .map(
      (a) => `<div class="ach" title="${a.description}">
        <img src="${a.thumb}" alt="" loading="lazy" />
        <div><div class="ach-t">${a.title}</div><div class="ach-d">${a.description}</div></div>
      </div>`
    )
    .join('');
  $('achStreak').innerHTML = (d.achievements.streak || [])
    .map(
      (a) => `<div class="ach ${a.at ? '' : 'locked'}" title="${a.description}">
        <img src="${a.thumb}" alt="" loading="lazy" />
        <div><div class="ach-t">${a.title}</div>
        <div class="ach-d">${a.at ? shortDate(a.at) : `${a.target} days`}</div></div>
      </div>`
    )
    .join('');
  $('streakAchNote').textContent = s && s.days !== null ? `currently at ${s.days} days` : '';

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
  $('synced').title =
    `Last synced ${at.toLocaleString()}. ` +
    'The page refreshes itself every minute and whenever you return to the tab.';
}

/* ---------------------------------------------------------------- fetch */

let last = null;

/* Polling is silent: the page refreshes itself every minute, on tab focus, and
   after a theme change, so there is no status pill or manual refresh control.
   The footer timestamp is the freshness signal, and errbar surfaces failures. */
async function load(fresh = false) {
  try {
    const res = await fetch(`/api/progress${fresh ? '?fresh=1' : ''}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    last = data;
    render(data);
    $('boot').hidden = true;
    $('app').hidden = false;
    $('errbar').hidden = true;
  } catch (err) {
    const bar = $('errbar');
    bar.textContent = `Could not reach boot.dev: ${err.message}`;
    bar.hidden = false;
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

// Keep the "ago" part honest between polls.
setInterval(() => {
  if (last) $('syncedRel').textContent = relTime(last.updatedAt);
}, 15_000);

setInterval(() => load(), REFRESH_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) load();
});

load();
