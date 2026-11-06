/* =========================================================
   Japonsko 2026 – cestovní deník
   Veškerý obsah se načítá z trip-data.json.
   Tento soubor řeší jen zobrazení a jednoduchý režim úprav.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Konstanty ---------- */
  const DATA_URL = 'trip-data.json';
  const DRAFT_KEY = 'japonsko2026-draft';
  const EDIT_KEY = 'japonsko2026-edit';

  const TYPES = {
    pamatka: { icon: '⛩️', label: 'Památka' },
    jidlo: { icon: '🍜', label: 'Jídlo' },
    doprava: { icon: '🚄', label: 'Doprava' },
    priroda: { icon: '🍁', label: 'Příroda' },
    nakupy: { icon: '🛍️', label: 'Nákupy' },
    vyhled: { icon: '🗼', label: 'Výhled' },
    jine: { icon: '📍', label: 'Jiné' }
  };
  const TRIP_STATUS_OPTIONS = [
    ['fixed', 'Pevný termín'],
    ['planned', 'Naplánováno'],
    ['weather', 'Termín podle počasí'],
    ['unplanned', 'Zatím nenaplánováno']
  ];
  const WD_SHORT = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
  const WD_LONG = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  const MONTH_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  const MONTH_SHORT = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

  /* ---------- Stav aplikace ---------- */
  const S = {
    data: null,          // aktuálně zobrazená data
    original: null,      // publikovaná data z trip-data.json
    originalHash: '',
    today: null,         // "dnešek" v japonském čase (nebo simulovaný)
    simulated: false,
    demo: false,
    selected: null,      // vybraný den v kalendáři
    edit: false,
    previews: {},        // lokální náhledy nově přidaných fotek (jen v této relaci)
    map: null,
    layers: {},
    markers: {},
    filters: { route: true, trips: true, places: true, visitedOnly: false }
  };

  /* ---------- Pomocné funkce ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const hasCoords = (o) => o && typeof o.lat === 'number' && typeof o.lng === 'number' && !isNaN(o.lat) && !isNaN(o.lng);

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return String(h);
  }
  function plural(n, one, few, many) {
    const a = Math.abs(n);
    if (a === 1) return one;
    if (a >= 2 && a <= 4) return few;
    return many;
  }

  /* ---------- Datum ---------- */
  const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toISO = (dt) => dt.toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = parseISO(iso); d.setUTCDate(d.getUTCDate() + n); return toISO(d); };
  const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
  const weekday = (iso) => parseISO(iso).getUTCDay();
  const dayNum = (iso) => parseISO(iso).getUTCDate();
  const monthIdx = (iso) => parseISO(iso).getUTCMonth();

  function isoInTimeZone(tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t).value;
      return `${get('year')}-${get('month')}-${get('day')}`;
    } catch (e) {
      return toISO(new Date());
    }
  }
  function timeInTimeZone(tz) {
    try {
      return new Intl.DateTimeFormat('cs-CZ', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date());
    } catch (e) { return ''; }
  }
  const fmtShort = (iso) => `${dayNum(iso)}. ${monthIdx(iso) + 1}.`;
  const fmtShortWd = (iso) => `${WD_SHORT[weekday(iso)]} ${fmtShort(iso)}`;
  const fmtLong = (iso) => `${WD_LONG[weekday(iso)]} ${dayNum(iso)}. ${MONTH_GEN[monthIdx(iso)]}`;
  const fmtLongYear = (iso) => `${fmtLong(iso)} ${parseISO(iso).getUTCFullYear()}`;
  function fmtRange(a, b) {
    if (monthIdx(a) === monthIdx(b)) return `${dayNum(a)}.–${dayNum(b)}. ${monthIdx(b) + 1}.`;
    return `${fmtShort(a)} – ${fmtShort(b)}`;
  }
  function fmtDateList(list) {
    if (!list || !list.length) return '';
    const sorted = list.slice().sort();
    let contiguous = true;
    for (let i = 1; i < sorted.length; i++) if (diffDays(sorted[i - 1], sorted[i]) !== 1) contiguous = false;
    if (contiguous && sorted.length > 2) return fmtRange(sorted[0], sorted[sorted.length - 1]);
    return sorted.map(fmtShort).join(', ');
  }

  /* ---------- Práce s daty cesty ---------- */
  const trip = () => S.data.trip;
  const bases = () => S.data.bases;
  const dayTrips = () => S.data.dayTrips;
  const baseById = (id) => bases().find((b) => b.id === id) || null;
  const tripById = (id) => dayTrips().find((t) => t.id === id) || null;

  function allDates() {
    const out = [];
    for (let d = trip().start; d <= trip().end; d = addDays(d, 1)) out.push(d);
    return out;
  }
  // Výchozí město pro daný den; jednodenní výlety ho nemění.
  const nightBase = (iso) => bases().find((b) => b.start <= iso && iso < b.end) || null;
  const dayData = (iso) => S.data.days.find((d) => d.date === iso) || null;
  function ensureDay(iso) {
    let d = dayData(iso);
    if (!d) {
      d = { date: iso, title: '', activities: [], notes: [], photos: [] };
      S.data.days.push(d);
      S.data.days.sort((a, b) => a.date.localeCompare(b.date));
    }
    return d;
  }
  const tripsOn = (iso) => dayTrips().filter((t) => t.date === iso);
  const maybeTripsOn = (iso) => dayTrips().filter((t) => !t.date && t.status === 'weather' && (t.candidateDates || []).includes(iso));

  function ctx(iso) {
    const nb = nightBase(iso);
    const prev = nightBase(addDays(iso, -1));
    const isArrival = iso === trip().start;
    const isDeparture = iso === trip().end;
    const transferFrom = !isArrival && prev && nb && prev.id !== nb.id ? prev : null;
    return {
      iso,
      base: nb || prev,           // na odletový den zůstává poslední město
      nightBase: nb,
      transferFrom,
      isArrival,
      isDeparture,
      trips: tripsOn(iso),
      maybe: maybeTripsOn(iso),
      day: dayData(iso),
      index: diffDays(trip().start, iso) + 1,
      total: diffDays(trip().start, trip().end) + 1
    };
  }

  function phase() {
    if (S.today < trip().start) return 'before';
    if (S.today > trip().end) return 'after';
    return 'during';
  }

  // Termíny, na které lze výlet naplánovat: noci ve výchozím městě kromě dne příjezdu.
  function tripAllowedDates(t) {
    const b = baseById(t.baseId);
    if (!b) return [];
    const out = [];
    for (let d = addDays(b.start, 1); d < b.end; d = addDays(d, 1)) out.push(d);
    if (!out.length) out.push(b.start);
    return out;
  }

  const actDone = (a, iso) => !!a.done || (S.demo && iso < S.today);
  const placeDone = (p, t) => !!p.visited || (S.demo && !!t.date && t.date < S.today);

  function tripStatus(t) {
    const total = t.places.length;
    const done = t.places.filter((p) => placeDone(p, t)).length;
    if (total && done === total) return { cls: 'done', label: '✔ Absolvováno', done, total };
    if (!t.date) {
      return t.status === 'weather'
        ? { cls: 'weather', label: '☁ Termín podle počasí', done, total }
        : { cls: 'unplanned', label: 'Zatím nenaplánováno', done, total };
    }
    if (t.status === 'weather') return { cls: 'weather', label: `Předběžně ${fmtShort(t.date)} · podle počasí`, done, total };
    if (t.status === 'fixed') return { cls: 'fixed', label: `Pevný termín · ${fmtShortWd(t.date)}`, done, total };
    return { cls: 'planned', label: `Naplánováno · ${fmtShortWd(t.date)}`, done, total };
  }

  function baseState(b) {
    const p = phase();
    if (p === 'before') return 'future';
    if (S.today >= b.end) return 'past';
    if (S.today >= b.start) return 'now';
    return 'future';
  }

  function sortActs(list) {
    return list.map((a, i) => ({ a, i })).sort((x, y) => {
      const tx = x.a.time || '', ty = y.a.time || '';
      if (tx && ty && tx !== ty) return tx.localeCompare(ty);
      return x.i - y.i;
    }).map((o) => o.a);
  }

  /* ---------- Normalizace načtených dat ---------- */
  function normalize(d) {
    if (!d || !d.trip || !isISO(d.trip.start) || !isISO(d.trip.end)) throw new Error('V trip-data.json chybí "trip.start" nebo "trip.end" ve formátu RRRR-MM-DD.');
    d.bases = Array.isArray(d.bases) ? d.bases : [];
    d.dayTrips = Array.isArray(d.dayTrips) ? d.dayTrips : [];
    d.days = Array.isArray(d.days) ? d.days : [];
    d.bases.sort((a, b) => a.start.localeCompare(b.start));
    d.days.forEach((day) => {
      day.activities = Array.isArray(day.activities) ? day.activities : [];
      day.notes = Array.isArray(day.notes) ? day.notes : [];
      day.photos = Array.isArray(day.photos) ? day.photos : [];
      day.activities.forEach((a, i) => { if (!a.id) a.id = `${day.date}-${i}`; });
    });
    d.days.sort((a, b) => a.date.localeCompare(b.date));
    d.dayTrips.forEach((t) => {
      t.places = Array.isArray(t.places) ? t.places : [];
      t.places.forEach((p, i) => { if (!p.id) p.id = `${t.id}-${i}`; });
      t.photos = Array.isArray(t.photos) ? t.photos : [];
      t.notes = Array.isArray(t.notes) ? t.notes : [];
      t.route = Array.isArray(t.route) ? t.route : [];
      if (!isISO(t.date)) t.date = null;
      if (!t.status) t.status = t.date ? 'planned' : 'unplanned';
    });
    return d;
  }

  /* =========================================================
     VYKRESLENÍ
     ========================================================= */
  function renderAll() {
    renderHero();
    renderTimeline();
    renderCalendar();
    renderDay();
    renderTrips();
    renderJournal();
    drawMap();
    renderEditUI();
  }

  /* ---------- Úvod a stav „Dnes“ ---------- */
  function renderHero() {
    const t = trip();
    $('#hero-dates').textContent = `${fmtShort(t.start)} – ${fmtShort(t.end)} ${parseISO(t.end).getUTCFullYear()}`;
    $('#hero-title').textContent = t.title || 'Japonsko';
    $('#hero-subtitle').textContent = t.subtitle || '';
    if (t.titleJp) $('#hero-jp').textContent = t.titleJp;
    document.title = `${t.title || 'Japonsko'} · Cestovní deník`;

    const card = $('#status-card');
    const p = phase();
    let html = '';

    if (p === 'before') {
      const n = diffDays(S.today, t.start);
      const first = bases()[0];
      card.style.setProperty('--accent', 'var(--shu)');
      html = `
        <div class="status-card__label">Do začátku cesty zbývá</div>
        <div class="status-card__big">${n} <small style="font-size:.45em">${plural(n, 'den', 'dny', 'dní')}</small></div>
        <p class="status-card__meta">${esc(S.data.arrival ? S.data.arrival.title : 'Začátek cesty')}: ${fmtLongYear(t.start)}${first ? `<br>První zastávka: <strong>${esc(first.name)}</strong>` : ''}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn--primary" href="#itinerar">Prohlédnout itinerář</a>
          <a class="btn" href="#mapa">Mapa cesty</a>
        </div>`;
    } else if (p === 'after') {
      const stats = countStats();
      card.style.setProperty('--accent', 'var(--matcha)');
      html = `
        <div class="status-card__label">Cesta skončila</div>
        <div class="status-card__city"><h2>Jsme zpátky doma 🏠</h2></div>
        <p class="status-card__meta">${stats.visited} ${plural(stats.visited, 'navštívené místo', 'navštívená místa', 'navštívených míst')} · ${stats.photos} ${plural(stats.photos, 'fotka', 'fotky', 'fotek')} · ${stats.notes} ${plural(stats.notes, 'poznámka', 'poznámky', 'poznámek')}</p>
        <a class="btn btn--primary" href="#denik">Projít deník</a>`;
    } else {
      const c = ctx(S.today);
      const b = c.base;
      card.style.setProperty('--accent', b ? b.color : 'var(--shu)');
      let where = '';
      if (c.isArrival) where = `Přiletěli jsme${S.data.arrival && S.data.arrival.from ? ` z ${esc(S.data.arrival.from)}` : ''} · ${fmtLong(S.today)}`;
      else if (c.isDeparture) where = `Dnes letíme domů${S.data.departure && S.data.departure.via ? ` přes ${esc(S.data.departure.via)}` : ''} ✈️`;
      else if (c.transferFrom) where = `Dnes přejíždíme: ${esc(c.transferFrom.name)} → ${esc(b.name)} · ${fmtLong(S.today)}`;
      else where = fmtLong(S.today);

      let tripBox = '';
      c.trips.forEach((tr) => {
        tripBox += `<div class="status-card__trip"><span class="ico">${esc(tr.icon || '🧭')}</span><div><strong>Dnes jsme na výletě: ${esc(tr.name)}</strong><br><span style="color:var(--ink-soft);font-size:.86rem">Vyrážíme ${esc(b ? (b.nameFrom || 'z ' + b.name) : '')}, večer se vracíme zpět.</span></div></div>`;
      });

      let items = [];
      c.trips.forEach((tr) => tr.places.forEach((pl) => items.push({ t: '', title: pl.name, done: placeDone(pl, tr) })));
      if (c.day) sortActs(c.day.activities).forEach((a) => items.push({ t: a.time || '', title: a.title, done: actDone(a, S.today) }));
      const list = items.slice(0, 4).map((i) => `<li><span class="t">${i.done ? '✔' : esc(i.t || '•')}</span><span${i.done ? ' style="color:var(--matcha)"' : ''}>${esc(i.title)}</span></li>`).join('');
      const more = items.length > 4 ? `<li><span class="t"></span><span style="color:var(--ink-mute)">… a dalších ${items.length - 4}</span></li>` : '';

      html = `
        <div class="status-card__label">Dnes · den ${c.index} z ${c.total}</div>
        <div class="status-card__city"><h2>${b ? esc(b.name) : ''}</h2>${b && b.nameJp ? `<span class="jp">${esc(b.nameJp)}</span>` : ''}</div>
        <p class="status-card__meta">${where}</p>
        ${tripBox}
        ${list ? `<ul class="status-card__list">${list}${more}</ul>` : ''}
        <button type="button" class="btn btn--primary" data-action="select-day" data-date="${S.today}" data-scroll="1">Celý dnešní program</button>`;
    }
    card.innerHTML = html;
    renderJourneyBar();
    renderClocks();
  }

  function countStats() {
    let visited = 0, photos = 0, notes = 0;
    S.data.days.forEach((d) => {
      visited += d.activities.filter((a) => actDone(a, d.date) && a.type !== 'doprava').length;
      photos += d.photos.length; notes += d.notes.length;
    });
    dayTrips().forEach((t) => {
      visited += t.places.filter((p) => placeDone(p, t)).length;
      photos += t.photos.length; notes += t.notes.length;
    });
    return { visited, photos, notes };
  }

  function renderJourneyBar() {
    const t = trip();
    const total = Math.max(1, diffDays(t.start, t.end));
    const segs = bases().map((b) => {
      const w = (diffDays(b.start, b.end) / total) * 100;
      const st = baseState(b);
      return { b, w, st };
    });
    let marker = '';
    if (phase() === 'during') {
      const pos = Math.min(100, Math.max(0, ((diffDays(t.start, S.today) + 0.5) / total) * 100));
      marker = `<span class="jb__marker" style="left:${pos}%" title="Dnes"></span>`;
    }
    $('#journey-bar').innerHTML = `
      <div class="jb__wrap">
        <div class="jb__track">${segs.map((s) => `<div class="jb__seg is-${s.st}" style="width:${s.w}%;background:${esc(s.b.color)}"></div>`).join('')}</div>
        ${marker}
      </div>
      <div class="jb__labels">${segs.map((s) => `<div class="jb__label" style="width:${s.w}%"><strong>${esc(s.b.name)}</strong><span>${fmtRange(s.b.start, s.b.end)}</span></div>`).join('')}</div>`;
  }

  function renderClocks() {
    const t = trip();
    const jp = timeInTimeZone(t.timezone || 'Asia/Tokyo');
    const home = timeInTimeZone(t.homeTimezone || 'Europe/Prague');
    $('#clocks').innerHTML = `
      <span class="clock">🇯🇵 V Japonsku <strong>${esc(jp)}</strong></span>
      <span class="clock">🇨🇿 Doma <strong>${esc(home)}</strong></span>`;
  }

  /* ---------- Itinerář / časová osa ---------- */
  function renderTimeline() {
    const arr = S.data.arrival, dep = S.data.departure;
    const p = phase();
    let html = '';

    if (arr) {
      const st = p === 'before' ? 'is-future' : 'is-past';
      html += `
        <li class="tl-item ${st}" style="--c:var(--ink)">
          <span class="tl-dot">✈</span>
          <div class="endpoint-card">
            <h3>${esc(arr.title)}</h3>
            <p>${fmtLongYear(arr.date)}${arr.place ? ` · ${esc(arr.place.name)}` : ''}</p>
          </div>
        </li>`;
    }

    bases().forEach((b, i) => {
      const st = baseState(b);
      const nights = diffDays(b.start, b.end);
      if (i > 0) {
        html += `<li class="tl-transfer">${fmtShortWd(b.start)} · ${esc(bases()[i - 1].name)} → ${esc(b.name)}${b.arrivalBy ? ` · ${esc(b.arrivalBy)}` : ''}</li>`;
      }
      const stateBadge = st === 'now' ? '<span class="badge badge--now">Právě tady</span>'
        : st === 'past' ? '<span class="badge badge--done">✔ Navštíveno</span>'
        : '<span class="badge">Čeká nás</span>';
      const actCount = S.data.days.filter((d) => nightBase(d.date) && nightBase(d.date).id === b.id).reduce((n, d) => n + d.activities.filter((a) => a.type !== 'doprava').length, 0);
      const trips = dayTrips().filter((t) => t.baseId === b.id).sort((x, y) => (x.date || '9999').localeCompare(y.date || '9999'));
      const sub = trips.map((t) => {
        const ts = tripStatus(t);
        return `
          <li class="subtrip" style="--tc:${esc(t.color || '#888')}">
            <span class="subtrip__ico" aria-hidden="true">${esc(t.icon || '🧭')}</span>
            <div class="subtrip__main">
              <div class="subtrip__label">Jednodenní výlet ${esc(b.nameFrom || '')}</div>
              <div class="subtrip__name">${esc(t.name)}</div>
              <div class="subtrip__meta"><span class="badge badge--${ts.cls}">${esc(ts.label)}</span><span>${t.places.length} ${plural(t.places.length, 'místo', 'místa', 'míst')}</span></div>
            </div>
            <button type="button" class="btn btn--sm" data-action="goto-trip" data-id="${esc(t.id)}">Detail</button>
          </li>`;
      }).join('');

      html += `
        <li class="tl-item is-${st}" style="--c:${esc(b.color)}">
          <span class="tl-dot">${i + 1}</span>
          <div class="city-card">
            <div class="city-card__head">
              <span class="city-card__jp" aria-hidden="true">${esc(b.nameJp || '')}</span>
              <div class="city-card__title">
                <h3>${esc(b.name)}</h3>
                <div class="city-card__dates">${fmtRange(b.start, b.end)}</div>
              </div>
              ${stateBadge}
            </div>
            <div class="city-card__body">
              ${b.description ? `<p>${esc(b.description)}</p>` : ''}
              <div class="city-card__facts">
                <span>📍 ${actCount} ${plural(actCount, 'bod', 'body', 'bodů')} programu</span>
              </div>
              <div class="city-card__actions">
                <button type="button" class="btn btn--sm" data-action="select-day" data-date="${b.start}" data-scroll="1">📅 Program</button>
                <button type="button" class="btn btn--sm" data-action="map-base" data-id="${esc(b.id)}">🗺 Na mapě</button>
              </div>
            </div>
            ${sub ? `<ul class="subtrips">${sub}</ul>` : ''}
          </div>
        </li>`;
    });

    if (dep) {
      const st = S.today > dep.date ? 'is-past' : 'is-future';
      html += `<li class="tl-transfer is-flight">${fmtShortWd(dep.date)} · ${dep.place ? esc(dep.place.name) : ''}${dep.via ? ` → ${esc(dep.via)}` : ''}${dep.to ? ` → ${esc(dep.to)}` : ''}</li>`;
      html += `
        <li class="tl-item ${st}" style="--c:var(--ink)">
          <span class="tl-dot">🏠</span>
          <div class="endpoint-card">
            <h3>${esc(dep.title)}</h3>
            <p>${fmtLongYear(dep.date)}</p>
          </div>
        </li>`;
    }
    $('#timeline').innerHTML = html;
  }

  /* ---------- Kalendář ---------- */
  function renderCalendar() {
    const t = trip();
    const startOffset = (weekday(t.start) + 6) % 7;
    const gridStart = addDays(t.start, -startOffset);
    const endOffset = 6 - ((weekday(t.end) + 6) % 7);
    const gridEnd = addDays(t.end, endOffset);
    const heads = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
    let html = heads.map((h) => `<div class="cal-head" role="columnheader">${h}</div>`).join('');
    const p = phase();

    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      const inTrip = d >= t.start && d <= t.end;
      if (!inTrip) {
        html += `<div class="cal-cell cal-cell--out" aria-hidden="true"><span class="cal-cell__num">${dayNum(d)}</span></div>`;
        continue;
      }
      const c = ctx(d);
      const color = c.base ? c.base.color : 'var(--ink)';
      const cls = ['cal-cell', 'cal-cell--trip'];
      let style = `--c:${color};`;
      if (c.transferFrom) { cls.push('cal-cell--transfer'); style += `--c0:${c.transferFrom.color};`; }
      if (p !== 'before' && d < S.today) cls.push('cal-cell--past');
      if (d === S.today) cls.push('is-today');
      if (d === S.selected) cls.push('is-selected');
      let icon = '';
      if (c.trips.length) icon = `<span class="cal-cell__ico">${esc(c.trips[0].icon || '🧭')}</span>`;
      else if (c.isArrival || c.isDeparture) icon = '<span class="cal-cell__ico">✈️</span>';
      else if (c.maybe.length) icon = `<span class="cal-cell__ico cal-cell__ico--maybe">${esc(c.maybe[0].icon || '?')}</span>`;
      const anyDone = (c.day && c.day.activities.some((a) => actDone(a, d))) || c.trips.some((tr) => tr.places.some((pl) => placeDone(pl, tr)));
      const label = `${fmtLong(d)}, ${c.base ? c.base.name : ''}${c.trips.length ? ', výlet ' + c.trips.map((x) => x.name).join(', ') : ''}${d === S.today ? ', dnes' : ''}`;
      const monthTag = (dayNum(d) === 1 || d === t.start) ? `<span class="cal-cell__city" style="font-weight:700">${MONTH_SHORT[monthIdx(d)]}</span>` : `<span class="cal-cell__city">${c.base ? esc(c.trips.length ? c.trips[0].name.split(/[ /+]/)[0] : c.base.name) : ''}</span>`;
      html += `
        <button type="button" class="${cls.join(' ')}" style="${style}" data-action="select-day" data-date="${d}" aria-label="${esc(label)}" aria-pressed="${d === S.selected}">
          ${anyDone ? '<span class="cal-cell__done" aria-hidden="true"></span>' : ''}
          ${icon}
          <span class="cal-cell__num">${dayNum(d)}</span>
          ${monthTag}
        </button>`;
    }
    $('#calendar').innerHTML = html;

    const legend = bases().map((b) => `<span style="--c:${esc(b.color)}"><i></i>${esc(b.name)}</span>`).join('') +
      '<span>🗻 výlet</span><span style="opacity:.7">◌ možný termín výletu (poloprůhledná ikona)</span><span>✈️ let</span><span><i style="--c:var(--matcha);border-radius:50%;width:8px;height:8px"></i>něco už hotovo</span>';
    $('#calendar-legend').innerHTML = legend;
  }

  /* ---------- Denní program ---------- */
  function photoHTML(ph, delAttrs) {
    const src = S.previews[ph.src] || ph.src;
    return `
      <figure class="photo">
        <button type="button" class="photo__open" data-action="open-photo" data-src="${esc(src)}" data-caption="${esc(ph.caption || '')}" aria-label="Zvětšit fotku${ph.caption ? ': ' + esc(ph.caption) : ''}">
          <img src="${esc(src)}" alt="${esc(ph.caption || 'Fotka z cesty')}" loading="lazy">
        </button>
        ${ph.caption ? `<figcaption>${esc(ph.caption)}</figcaption>` : ''}
        ${S.edit && delAttrs ? `<button type="button" class="icon-btn icon-btn--danger" ${delAttrs} aria-label="Smazat fotku">✕</button>` : ''}
      </figure>`;
  }

  function noteHTML(n, delAttrs) {
    return `
      <div class="note">
        ${n.time ? `<div class="note__time">${esc(n.time)}</div>` : ''}
        <p>${esc(n.text)}</p>
        ${S.edit && delAttrs ? `<button type="button" class="icon-btn icon-btn--danger" ${delAttrs} aria-label="Smazat poznámku">✕</button>` : ''}
      </div>`;
  }

  function actHTML(a, iso) {
    const done = actDone(a, iso);
    const ty = TYPES[a.type] || TYPES.jine;
    const check = S.edit
      ? `<button type="button" class="act__check" data-action="toggle-act" data-date="${iso}" data-id="${esc(a.id)}" aria-label="${done ? 'Označit jako plánované' : 'Označit jako absolvované'}">✔</button>`
      : `<span class="act__check" aria-hidden="true">✔</span>`;
    return `
      <li class="act ${done ? 'is-done' : ''}">
        ${check}
        <div class="act__main">
          <div class="act__title">${esc(a.title)}</div>
          <div class="act__meta">
            ${a.time ? `<span class="act__time">${esc(a.time)}</span>` : ''}
            <span>${ty.icon} ${ty.label}</span>
            ${a.place ? `<span>· ${esc(a.place)}</span>` : ''}
            <span class="badge ${done ? 'badge--done' : ''}">${done ? 'Absolvováno' : 'Plánováno'}</span>
          </div>
          ${a.note ? `<div class="act__note">${esc(a.note)}</div>` : ''}
        </div>
        <div class="act__side">
          ${hasCoords(a) ? `<button type="button" class="icon-btn" data-action="map-point" data-key="act:${esc(a.id)}" aria-label="Ukázat na mapě">🗺</button>` : ''}
          ${S.edit ? `<button type="button" class="icon-btn icon-btn--danger" data-action="del-act" data-date="${iso}" data-id="${esc(a.id)}" aria-label="Smazat">✕</button>` : ''}
        </div>
      </li>`;
  }

  function placeActHTML(pl, t) {
    const done = placeDone(pl, t);
    const check = S.edit
      ? `<button type="button" class="act__check" data-action="toggle-place" data-trip="${esc(t.id)}" data-id="${esc(pl.id)}" aria-label="${done ? 'Označit jako nenavštívené' : 'Označit jako navštívené'}">✔</button>`
      : `<span class="act__check" aria-hidden="true">✔</span>`;
    return `
      <li class="act ${done ? 'is-done' : ''}">
        ${check}
        <div class="act__main">
          <div class="act__title">${esc(pl.name)}</div>
          <div class="act__meta"><span class="badge ${done ? 'badge--done' : ''}">${done ? 'Navštíveno' : 'Plánováno'}</span>${pl.note ? `<span>${esc(pl.note)}</span>` : ''}</div>
        </div>
        <div class="act__side">${hasCoords(pl) ? `<button type="button" class="icon-btn" data-action="map-point" data-key="place:${esc(pl.id)}" aria-label="Ukázat na mapě">🗺</button>` : ''}</div>
      </li>`;
  }

  function renderDay() {
    const iso = S.selected;
    const c = ctx(iso);
    const b = c.base;
    const day = c.day;
    const dates = allDates();
    const idx = dates.indexOf(iso);
    const title = c.trips.length ? `Výlet: ${c.trips.map((t) => t.name).join(' + ')}` : ((day && day.title) || (b ? b.name : ''));

    const sub = [];
    if (b) sub.push(`<span class="badge" style="background:${esc(b.color)};color:#fff">${esc(b.name)}</span>`);
    if (c.isArrival) sub.push('<span class="badge">✈ Přílet</span>');
    if (c.isDeparture) sub.push('<span class="badge">✈ Odlet domů</span>');
    if (c.transferFrom) sub.push(`<span class="badge">🚄 Přejezd ${esc(c.transferFrom.nameFrom || 'z ' + c.transferFrom.name)}</span>`);
    if (iso === S.today) sub.push('<span class="badge badge--now">Dnes</span>');
    sub.push(`<span>${fmtLong(iso)} · den ${c.index} z ${c.total}</span>`);

    let body = '';

    // Výlet = hlavní aktivita dne
    c.trips.forEach((t) => {
      const ts = tripStatus(t);
      body += `
        <div class="dd-section-title">Hlavní program dne</div>
        <div class="trip-hero" style="--tc:${esc(t.color || '#888')}">
          <div class="trip-hero__head">
            <span class="trip-hero__ico" aria-hidden="true">${esc(t.icon || '🧭')}</span>
            <div>
              <div class="trip-hero__kicker">Jednodenní výlet ${esc(b ? (b.nameFrom || '') : '')}</div>
              <h4>${esc(t.name)}</h4>
              <span class="badge badge--${ts.cls}">${esc(ts.label)}</span>
            </div>
          </div>
          ${t.description ? `<p class="trip-hero__desc">${esc(t.description)}</p>` : ''}
          ${t.transport ? `<div class="trip-hero__transport">🚆 ${esc(t.transport)}</div>` : ''}
          <ul class="acts">${t.places.map((pl) => placeActHTML(pl, t)).join('')}</ul>
          <div class="trip-hero__foot">
            <button type="button" class="btn btn--sm" data-action="map-trip" data-id="${esc(t.id)}">🗺 Trasa na mapě</button>
            <button type="button" class="btn btn--sm" data-action="goto-trip" data-id="${esc(t.id)}">Detail výletu</button>
          </div>
        </div>`;
    });

    // Možné termíny flexibilních výletů
    c.maybe.forEach((t) => {
      body += `
        <div class="maybe-trip">
          <span style="font-size:1.4rem">${esc(t.icon || '🧭')}</span>
          <div style="flex:1"><strong>${esc(t.name)}</strong> – možný termín výletu, rozhodne počasí.</div>
          ${S.edit ? `<button type="button" class="btn btn--sm" data-action="plan-trip" data-id="${esc(t.id)}" data-date="${iso}">Naplánovat sem</button>` : ''}
        </div>`;
    });

    const acts = day ? sortActs(day.activities) : [];
    body += `<div class="dd-section-title">${c.trips.length ? 'Další program dne' : 'Program dne'}</div>`;
    body += acts.length ? `<ul class="acts">${acts.map((a) => actHTML(a, iso)).join('')}</ul>` : '<p class="empty">Na tento den zatím nemáme nic naplánováno.</p>';

    // Poznámky a fotky (den + výlet v tento den)
    const notes = [];
    if (day) day.notes.forEach((n, i) => notes.push(noteHTML(n, `data-action="del-note" data-date="${iso}" data-idx="${i}"`)));
    c.trips.forEach((t) => t.notes.forEach((n, i) => notes.push(noteHTML(n, `data-action="del-note" data-trip="${esc(t.id)}" data-idx="${i}"`))));
    const photos = [];
    if (day) day.photos.forEach((ph, i) => photos.push(photoHTML(ph, `data-action="del-photo" data-date="${iso}" data-idx="${i}"`)));
    c.trips.forEach((t) => t.photos.forEach((ph, i) => photos.push(photoHTML(ph, `data-action="del-photo" data-trip="${esc(t.id)}" data-idx="${i}"`))));

    if (notes.length || S.edit) {
      body += '<div class="dd-section-title">Poznámky</div>';
      body += notes.length ? `<div class="notes">${notes.join('')}</div>` : '<p class="empty">Zatím bez poznámek.</p>';
    }
    if (photos.length || S.edit) {
      body += '<div class="dd-section-title">Fotky</div>';
      body += photos.length ? `<div class="photos">${photos.join('')}</div>` : '<p class="empty">Zatím bez fotek.</p>';
    }

    if (S.edit) body += dayEditorHTML(iso, c);

    const todayBtn = phase() === 'during' && iso !== S.today
      ? `<button type="button" class="btn btn--sm" data-action="select-day" data-date="${S.today}">Dnes</button>` : '';

    const el = $('#day-detail');
    el.style.setProperty('--c', b ? b.color : 'var(--ink)');
    el.innerHTML = `
      <div class="dd-head">
        <div class="dd-head__date"><div class="d">${dayNum(iso)}</div><div class="m">${MONTH_SHORT[monthIdx(iso)]} · ${WD_SHORT[weekday(iso)]}</div></div>
        <div class="dd-head__title">
          <h3>${esc(title)}</h3>
          <div class="dd-head__sub">${sub.join('')}</div>
        </div>
        <div class="dd-nav">
          <button type="button" class="btn btn--sm" data-action="select-day" data-date="${idx > 0 ? dates[idx - 1] : iso}" ${idx <= 0 ? 'disabled' : ''} aria-label="Předchozí den">‹ Předchozí</button>
          ${todayBtn}
          <button type="button" class="btn btn--sm" data-action="select-day" data-date="${idx < dates.length - 1 ? dates[idx + 1] : iso}" ${idx >= dates.length - 1 ? 'disabled' : ''} aria-label="Další den">Další ›</button>
        </div>
      </div>
      <div class="dd-body">
        ${body}
        <div style="margin-top:16px"><button type="button" class="btn btn--sm" data-action="map-day" data-date="${iso}">🗺 Zobrazit den na mapě</button></div>
      </div>`;
  }

  function dayEditorHTML(iso, c) {
    const typeOpts = Object.keys(TYPES).map((k) => `<option value="${k}" ${k === 'jine' ? 'selected' : ''}>${TYPES[k].icon} ${TYPES[k].label}</option>`).join('');
    const target = c.trips.length
      ? `<label class="field">Přiřadit k
           <select name="target"><option value="day">Tento den</option>${c.trips.map((t) => `<option value="trip:${esc(t.id)}">Výlet: ${esc(t.name)}</option>`).join('')}</select>
         </label>` : '';
    const nowJp = iso === isoInTimeZone(trip().timezone || 'Asia/Tokyo') ? timeInTimeZone(trip().timezone || 'Asia/Tokyo') : '';
    return `
      <div class="editor">
        <h4>✎ Úpravy dne ${fmtShort(iso)}</h4>
        <label class="field" style="margin-bottom:10px">Název dne
          <input type="text" data-day-title="${iso}" value="${esc((c.day && c.day.title) || '')}" placeholder="např. Asakusa a Ueno">
        </label>
        <details>
          <summary>➕ Přidat aktivitu / navštívené místo</summary>
          <form class="form" data-form="activity" data-date="${iso}">
            <div class="form__row">
              <label class="field">Název *<input name="title" required placeholder="např. Chrám Sensó-dži"></label>
              <label class="field">Čas<input name="time" type="time"></label>
            </div>
            <div class="form__row">
              <label class="field">Místo / čtvrť<input name="place" placeholder="např. Asakusa"></label>
              <label class="field">Typ<select name="type">${typeOpts}</select></label>
            </div>
            <label class="field">Souřadnice
              <input name="coords" placeholder="35.7148, 139.7967" inputmode="decimal">
              <small>Klikněte do mapy níže, nebo zkopírujte z Google Map (pravé tlačítko na místo → první řádek).</small>
            </label>
            <label class="field">Krátká poznámka<input name="note" placeholder="nepovinné"></label>
            <label class="check"><input type="checkbox" name="done"> Už jsme tu byli (absolvováno)</label>
            <button class="btn btn--primary" type="submit">Přidat</button>
          </form>
        </details>
        <details>
          <summary>📝 Přidat poznámku</summary>
          <form class="form" data-form="note" data-date="${iso}">
            ${target}
            <label class="field">Čas<input name="time" type="time" value="${esc(nowJp)}"></label>
            <label class="field">Text *<textarea name="text" required placeholder="Jak se dnes měl den?"></textarea></label>
            <button class="btn btn--primary" type="submit">Přidat poznámku</button>
          </form>
        </details>
        <details>
          <summary>📷 Přidat fotku</summary>
          <form class="form" data-form="photo" data-date="${iso}">
            ${target}
            <label class="field">Vybrat fotku z telefonu / počítače
              <input type="file" name="file" accept="image/*">
              <small>Fotka se zmenší, stáhne se jako soubor a cesta se vyplní. Stažený soubor pak nahrajte na GitHub do složky <code>photos/</code>.</small>
            </label>
            <label class="field">…nebo cesta / odkaz na fotku *
              <input name="src" required placeholder="photos/2026-11-16-sensoji.jpg">
            </label>
            <label class="field">Popisek<input name="caption" placeholder="např. Ranní Sensó-dži"></label>
            <button class="btn btn--primary" type="submit">Přidat fotku</button>
          </form>
        </details>
      </div>`;
  }

  /* ---------- Výlety ---------- */
  function renderTrips() {
    const html = dayTrips().map((t) => {
      const b = baseById(t.baseId);
      const ts = tripStatus(t);
      const pct = ts.total ? Math.round((ts.done / ts.total) * 100) : 0;
      const photo = t.coverPhoto || t.photos[0];
      const cover = photo ? `<img src="${esc(S.previews[photo.src] || photo.src)}" alt="${esc(photo.caption || t.name)}" loading="lazy" decoding="async">` : '';
      const when = t.hideDate ? '' : t.date
        ? `📅 ${fmtLong(t.date)}`
        : (t.dateLabel ? esc(t.dateLabel) : t.candidateDates && t.candidateDates.length ? `Možné dny: ${fmtDateList(t.candidateDates)}` : 'Termín zatím není');
      const places = t.places.map((pl) => {
        const done = placeDone(pl, t);
        const inner = `<span class="dot">✔</span><span>${esc(pl.name)}</span>`;
        return S.edit
          ? `<li class="${done ? 'is-done' : ''}"><button type="button" class="linklike" style="display:flex;gap:8px;align-items:center;text-decoration:none;color:inherit" data-action="toggle-place" data-trip="${esc(t.id)}" data-id="${esc(pl.id)}">${inner}</button></li>`
          : `<li class="${done ? 'is-done' : ''}">${inner}</li>`;
      }).join('');

      let editor = '';
      if (S.edit) {
        const allowed = tripAllowedDates(t);
        const conflict = t.date ? dayTrips().filter((o) => o.id !== t.id && o.date === t.date) : [];
        editor = `
          <div class="trip-edit">
            <label class="field">Termín výletu
              <select data-trip-date="${esc(t.id)}">
                <option value="">— bez termínu —</option>
                ${allowed.map((d) => `<option value="${d}" ${t.date === d ? 'selected' : ''}>${fmtShortWd(d)}${tripsOn(d).filter((o) => o.id !== t.id).length ? ' (už je tam jiný výlet)' : ''}</option>`).join('')}
              </select>
              <small>Vyber den v rámci pobytu ve výchozím městě.</small>
            </label>
            <label class="field">Stav
              <select data-trip-status="${esc(t.id)}">
                ${TRIP_STATUS_OPTIONS.map(([v, l]) => `<option value="${v}" ${t.status === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
            ${conflict.length ? `<div class="warn">⚠ Ve stejný den je i výlet: ${conflict.map((o) => esc(o.name)).join(', ')}</div>` : ''}
          </div>`;
      }

      return `
        <article class="trip-card" id="trip-${esc(t.id)}" style="--tc:${esc(t.color || '#888')}">
          <div class="trip-card__cover">
            ${cover}
            <span class="trip-card__jp" aria-hidden="true">${esc(t.nameJp || '')}</span>
            <h3>${esc(t.icon || '')} ${esc(t.name)}</h3>
            <div class="trip-card__base">Výchozí město: <strong>${esc(b ? b.name : '?')}</strong> · návrat večer</div>
          </div>
          <div class="trip-card__body">
            <div class="trip-card__status"><span class="badge badge--${ts.cls}">${esc(ts.label)}</span></div>
            ${when ? `<div style="font-size:.9rem">${when}</div>` : ''}
            ${t.description ? `<p class="trip-card__desc">${esc(t.description)}</p>` : ''}
            ${t.transport ? `<div style="font-size:.85rem;color:var(--ink-soft)">🚆 ${esc(t.transport)}</div>` : ''}
            <div>
              <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--ink-mute);margin-bottom:4px"><span>Hlavní místa</span><span>${ts.done}/${ts.total}</span></div>
              <div class="progress"><i style="width:${pct}%"></i></div>
            </div>
            <ul class="trip-card__places">${places}</ul>
            ${editor}
            <div class="trip-card__actions">
              <button type="button" class="btn btn--sm" data-action="map-trip" data-id="${esc(t.id)}">🗺 Trasa na mapě</button>
              ${t.date ? `<button type="button" class="btn btn--sm" data-action="select-day" data-date="${t.date}" data-scroll="1">📅 Otevřít den</button>` : ''}
            </div>
          </div>
        </article>`;
    }).join('');
    $('#trips').innerHTML = html || '<p class="empty">Žádné výlety.</p>';
  }

  /* ---------- Deník ---------- */
  function renderJournal() {
    const blocks = [];
    const dates = allDates().slice().reverse();
    dates.forEach((iso) => {
      const day = dayData(iso);
      const trips = tripsOn(iso);
      const notes = [], photos = [];
      if (day) { day.notes.forEach((n) => notes.push(n)); day.photos.forEach((p) => photos.push(p)); }
      trips.forEach((t) => { t.notes.forEach((n) => notes.push(n)); t.photos.forEach((p) => photos.push(p)); });
      if (!notes.length && !photos.length) return;
      const c = ctx(iso);
      blocks.push(`
        <article class="j-day">
          <div class="j-day__head">
            <div>
              <div class="j-day__date">${dayNum(iso)}. ${MONTH_GEN[monthIdx(iso)]}</div>
              <div class="j-day__city">${WD_LONG[weekday(iso)]} · ${esc(c.base ? c.base.name : '')}${trips.length ? ' · ' + trips.map((t) => esc(t.icon + ' ' + t.name)).join(', ') : ''}</div>
            </div>
            <button type="button" class="btn btn--sm" data-action="select-day" data-date="${iso}" data-scroll="1">Otevřít den</button>
          </div>
          <div>
            ${notes.length ? `<div class="notes">${notes.map((n) => noteHTML(n)).join('')}</div>` : ''}
            ${photos.length ? `<div class="photos" style="margin-top:${notes.length ? 10 : 0}px">${photos.map((p) => photoHTML(p)).join('')}</div>` : ''}
          </div>
        </article>`);
    });
    // Fotky z výletů, které zatím nemají termín
    dayTrips().filter((t) => !t.date && (t.photos.length || t.notes.length)).forEach((t) => {
      blocks.push(`
        <article class="j-day">
          <div class="j-day__head">
            <div>
              <div class="j-day__date">${esc(t.icon || '')} ${esc(t.name)}</div>
              <div class="j-day__city">Výlet zatím bez termínu</div>
            </div>
            <button type="button" class="btn btn--sm" data-action="goto-trip" data-id="${esc(t.id)}">Detail výletu</button>
          </div>
          <div>
            ${t.notes.length ? `<div class="notes">${t.notes.map((n) => noteHTML(n)).join('')}</div>` : ''}
            ${t.photos.length ? `<div class="photos" style="margin-top:${t.notes.length ? 10 : 0}px">${t.photos.map((p) => photoHTML(p)).join('')}</div>` : ''}
          </div>
        </article>`);
    });
    $('#journal').innerHTML = blocks.length ? blocks.join('') : `<p class="empty">Zatím žádné zápisky – první přibudou ${fmtShort(trip().start)}</p>`;
  }

  /* =========================================================
     MAPA (Leaflet + OpenStreetMap)
     ========================================================= */
  function initMap() {
    if (!window.L) { $('#map-fallback').hidden = false; return; }
    S.map = L.map('map', { scrollWheelZoom: false, zoomSnap: 0.5 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(S.map);
    S.layers = { route: L.layerGroup(), trips: L.layerGroup(), places: L.layerGroup() };
    Object.keys(S.layers).forEach((k) => { if (S.filters[k]) S.layers[k].addTo(S.map); });
    S.map.on('focus', () => S.map.scrollWheelZoom.enable());
    S.map.on('blur', () => S.map.scrollWheelZoom.disable());
    S.map.on('click', (e) => {
      if (!S.edit) return;
      const txt = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
      const input = $('#day-detail form[data-form="activity"] input[name="coords"]');
      if (input) { input.value = txt; input.closest('details').open = true; }
      L.popup().setLatLng(e.latlng).setContent(`<div class="pop__title">Souřadnice</div><div>${txt}</div><div class="pop__meta">${input ? 'Vloženo do formuláře „Přidat aktivitu“.' : ''}</div>`).openOn(S.map);
      if (input) toast('Souřadnice vloženy do formuláře');
    });
    drawMap();
    resetMapView();
  }

  function icon(cls, inner, bg, size) {
    return L.divIcon({ className: '', html: `<div class="mk ${cls}" style="background:${bg}">${inner}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
  }

  function drawMap() {
    if (!S.map) return;
    Object.values(S.layers).forEach((l) => l.clearLayers());
    S.markers = {};
    const vOnly = S.filters.visitedOnly;
    const p = phase();

    // Hlavní trasa: přílet → města → odlet
    const pts = [];
    if (S.data.arrival && hasCoords(S.data.arrival.place)) pts.push({ ll: [S.data.arrival.place.lat, S.data.arrival.place.lng], date: S.data.arrival.date });
    bases().forEach((b) => pts.push({ ll: [b.lat, b.lng], date: b.start }));
    if (S.data.departure && hasCoords(S.data.departure.place)) pts.push({ ll: [S.data.departure.place.lat, S.data.departure.place.lng], date: S.data.departure.date });
    for (let i = 0; i < pts.length - 1; i++) {
      const travelled = p !== 'before' && pts[i + 1].date <= S.today;
      L.polyline([pts[i].ll, pts[i + 1].ll], travelled
        ? { color: '#c73e2e', weight: 4, opacity: .9 }
        : { color: '#5c564d', weight: 3, opacity: .6, dashArray: '6 8' }).addTo(S.layers.route);
    }
    const air = (o, label) => {
      if (!o || !hasCoords(o.place)) return;
      L.marker([o.place.lat, o.place.lng], { icon: icon('mk--air', '✈', '#1d1b19', 30) })
        .bindPopup(`<div class="pop__title">${esc(o.title)}</div><div class="pop__meta">${label} · ${fmtLongYear(o.date)} · ${esc(o.place.name)}</div>`)
        .addTo(S.layers.route);
    };
    air(S.data.arrival, 'Přílet');
    air(S.data.departure, 'Odlet');

    bases().forEach((b) => {
      const st = baseState(b);
      const nights = diffDays(b.start, b.end);
      const m = L.marker([b.lat, b.lng], { icon: icon(`mk--base ${st === 'now' ? 'is-now' : ''}`, esc((b.nameJp || b.name).charAt(0)), b.color, 38), zIndexOffset: 1000 })
        .bindPopup(`<div class="pop__title">${esc(b.name)} ${esc(b.nameJp || '')}</div>
          <div class="pop__meta">${fmtRange(b.start, b.end)} · ${st === 'now' ? 'právě tady' : st === 'past' ? 'navštíveno' : 'čeká nás'}</div>
          <button type="button" class="btn btn--sm pop__btn" data-action="select-day" data-date="${b.start}" data-scroll="1">Zobrazit program</button>`)
        .addTo(S.layers.route);
      S.markers['base:' + b.id] = m;
    });

    // Jednodenní výlety
    dayTrips().forEach((t) => {
      const b = baseById(t.baseId);
      const ts = tripStatus(t);
      if (t.route.length > 1 && !vOnly) {
        L.polyline(t.route, { color: t.color || '#3d6bb3', weight: 3, opacity: .85, dashArray: '2 7', lineCap: 'round' })
          .bindPopup(`<div class="pop__title">${esc(t.icon || '')} ${esc(t.name)}</div><div class="pop__meta">Orientační trasa ${esc(b ? (b.nameFrom || '') : '')} · ${esc(ts.label)}</div>`)
          .addTo(S.layers.trips);
      }
      t.places.forEach((pl, i) => {
        if (!hasCoords(pl)) return;
        const done = placeDone(pl, t);
        if (vOnly && !done) return;
        const m = L.marker([pl.lat, pl.lng], { icon: icon(`mk--trip ${done ? 'mk--done' : ''}`, done ? '✔' : String(i + 1), t.color || '#3d6bb3', 24) })
          .bindPopup(`<div class="pop__title">${esc(pl.name)}</div>
            <div class="pop__meta">${esc(t.icon || '')} ${esc(t.name)} · ${done ? 'navštíveno ✔' : esc(ts.label)}</div>
            ${pl.note ? `<div style="margin-top:4px">${esc(pl.note)}</div>` : ''}
            ${S.edit ? `<button type="button" class="btn btn--sm pop__btn" data-action="toggle-place" data-trip="${esc(t.id)}" data-id="${esc(pl.id)}">${done ? 'Zrušit „navštíveno“' : 'Označit jako navštívené'}</button>` : ''}`)
          .addTo(S.layers.trips);
        S.markers['place:' + pl.id] = m;
      });
    });

    // Místa z denního programu
    S.data.days.forEach((d) => {
      const nb = nightBase(d.date) || nightBase(addDays(d.date, -1));
      d.activities.forEach((a) => {
        if (!hasCoords(a)) return;
        const done = actDone(a, d.date);
        if (vOnly && !done) return;
        const ty = TYPES[a.type] || TYPES.jine;
        const m = L.marker([a.lat, a.lng], { icon: icon(`mk--place ${done ? 'mk--done' : ''}`, done ? '✔' : '', nb ? nb.color : '#555', 18) })
          .bindPopup(`<div class="pop__title">${ty.icon} ${esc(a.title)}</div>
            <div class="pop__meta">${fmtShortWd(d.date)}${a.time ? ' · ' + esc(a.time) : ''}${a.place ? ' · ' + esc(a.place) : ''} · ${done ? 'absolvováno ✔' : 'plánováno'}</div>
            <button type="button" class="btn btn--sm pop__btn" data-action="select-day" data-date="${d.date}" data-scroll="1">Otevřít den</button>`)
          .addTo(S.layers.places);
        S.markers['act:' + a.id] = m;
      });
    });
  }

  function resetMapView() {
    if (!S.map) return;
    const ll = bases().map((b) => [b.lat, b.lng]);
    if (S.data.arrival && hasCoords(S.data.arrival.place)) ll.push([S.data.arrival.place.lat, S.data.arrival.place.lng]);
    if (ll.length) S.map.fitBounds(ll, { padding: [30, 30] });
  }

  function scrollToMap() {
    $('#mapa').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => S.map && S.map.invalidateSize(), 400);
  }

  function ensureLayer(name) {
    if (!S.map || !S.layers[name]) return;
    if (!S.filters[name]) {
      S.filters[name] = true;
      S.layers[name].addTo(S.map);
      const chip = $(`#map-filters [data-layer="${name}"]`);
      if (chip) chip.classList.add('is-on');
    }
  }

  function focusBounds(points, maxZoom) {
    if (!S.map || !points.length) return;
    scrollToMap();
    setTimeout(() => {
      if (points.length === 1) S.map.setView(points[0], maxZoom || 14);
      else S.map.fitBounds(points, { padding: [40, 40], maxZoom: maxZoom || 15 });
    }, 450);
  }

  function focusDay(iso) {
    if (!S.map) return toast('Mapa není k dispozici');
    const c = ctx(iso);
    const pts = [];
    if (c.day) c.day.activities.forEach((a) => { if (hasCoords(a)) pts.push([a.lat, a.lng]); });
    c.trips.forEach((t) => t.places.forEach((pl) => { if (hasCoords(pl)) pts.push([pl.lat, pl.lng]); }));
    if (!pts.length && c.base) pts.push([c.base.lat, c.base.lng]);
    ensureLayer('places'); ensureLayer('trips');
    focusBounds(pts, 14);
  }

  function focusTrip(id) {
    const t = tripById(id);
    if (!t || !S.map) return;
    ensureLayer('trips');
    const pts = t.route.length ? t.route.slice() : [];
    t.places.forEach((pl) => { if (hasCoords(pl)) pts.push([pl.lat, pl.lng]); });
    focusBounds(pts, 12);
  }

  function focusMarker(key) {
    if (S.map) ensureLayer(key.startsWith('act:') ? 'places' : key.startsWith('place:') ? 'trips' : 'route');
    const m = S.markers[key];
    if (!m || !S.map) return toast('Místo je na mapě skryté filtrem');
    scrollToMap();
    setTimeout(() => { S.map.setView(m.getLatLng(), 15); m.openPopup(); }, 450);
  }

  /* =========================================================
     REŽIM ÚPRAV
     ========================================================= */
  function commit(msg) {
    if (!S.edit) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), baseHash: S.originalHash, data: S.data }));
    } catch (e) {
      toast('Koncept se nepodařilo uložit (plné úložiště prohlížeče?)');
    }
    renderAll();
    if (msg) toast(msg);
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function enterEdit(silent) {
    if (!silent && !confirm('Režim úprav je určený pro autory deníku.\n\nZměny se ukládají jen v tomto prohlížeči. Aby je viděli ostatní, je potřeba stáhnout trip-data.json a nahrát ho na GitHub (viz README).\n\nPokračovat?')) return;
    S.edit = true;
    localStorage.setItem(EDIT_KEY, '1');
    const draft = loadDraft();
    if (draft && draft.data) {
      try {
        S.data = normalize(draft.data);
        if (draft.baseHash && draft.baseHash !== S.originalHash) {
          setTimeout(() => toast('Pozor: publikovaný trip-data.json se od vytvoření konceptu změnil'), 600);
        }
      } catch (e) { S.data = clone(S.original); }
    } else {
      S.data = clone(S.original);
    }
    renderAll();
  }

  function exitEdit() {
    S.edit = false;
    localStorage.removeItem(EDIT_KEY);
    S.data = clone(S.original);
    renderAll();
    toast(loadDraft() ? 'Zobrazena publikovaná verze. Váš koncept zůstal uložený.' : 'Režim úprav ukončen');
  }

  function renderEditUI() {
    $('#editbar').hidden = !S.edit;
    document.body.classList.toggle('is-editing', S.edit);
    $('#edit-toggle').textContent = S.edit ? 'Ukončit režim úprav' : 'Režim úprav';
  }

  function exportJSON() {
    const json = JSON.stringify(S.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, 'trip-data.json');
    toast('Staženo – nahrajte trip-data.json na GitHub');
  }

  function copyJSON() {
    const json = JSON.stringify(S.data, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(() => toast('JSON zkopírován do schránky'), () => fallbackCopy(json));
    } else fallbackCopy(json);
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('JSON zkopírován do schránky'); } catch (e) { toast('Kopírování se nepodařilo'); }
    ta.remove();
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function parseCoords(str) {
    if (!str || !str.trim()) return null;
    const m = str.match(/(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!m) return undefined;
    const lat = parseFloat(m[1].replace(',', '.')), lng = parseFloat(m[2].replace(',', '.'));
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
    return { lat, lng };
  }

  function resizeImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Převod se nepodařil'))), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Soubor nelze načíst jako obrázek')); };
      img.src = url;
    });
  }

  function targetOf(form) {
    const sel = form.querySelector('select[name="target"]');
    const v = sel ? sel.value : 'day';
    if (v.startsWith('trip:')) return { trip: tripById(v.slice(5)) };
    return { day: ensureDay(form.dataset.date) };
  }

  function handleSubmit(e) {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    const type = form.dataset.form;
    const iso = form.dataset.date;

    if (type === 'activity') {
      const title = String(fd.get('title') || '').trim();
      if (!title) return toast('Vyplňte název');
      const coords = parseCoords(String(fd.get('coords') || ''));
      if (coords === undefined) return toast('Souřadnice nejsou ve správném tvaru (např. 35.71, 139.79)');
      const a = {
        id: 'a' + Date.now().toString(36),
        time: String(fd.get('time') || ''),
        title,
        place: String(fd.get('place') || '').trim(),
        lat: coords ? coords.lat : null,
        lng: coords ? coords.lng : null,
        type: String(fd.get('type') || 'jine'),
        done: fd.get('done') === 'on'
      };
      const note = String(fd.get('note') || '').trim();
      if (note) a.note = note;
      ensureDay(iso).activities.push(a);
      commit('Aktivita přidána');
    } else if (type === 'note') {
      const text = String(fd.get('text') || '').trim();
      if (!text) return toast('Napište text poznámky');
      const tg = targetOf(form);
      (tg.trip ? tg.trip.notes : tg.day.notes).push({ time: String(fd.get('time') || ''), text });
      commit('Poznámka přidána');
    } else if (type === 'photo') {
      const src = String(fd.get('src') || '').trim();
      if (!src) return toast('Vyberte fotku nebo zadejte cestu');
      const tg = targetOf(form);
      (tg.trip ? tg.trip.photos : tg.day.photos).push({ src, caption: String(fd.get('caption') || '').trim() });
      commit('Fotka přidána – nezapomeňte ji nahrát do složky photos/');
    }
  }

  async function handlePhotoFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const form = input.closest('form');
    try {
      const blob = await resizeImage(file, 1600, 0.82);
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(8, 14);
      const name = `${form.dataset.date}-${stamp}.jpg`;
      const path = `photos/${name}`;
      S.previews[path] = URL.createObjectURL(blob);
      form.querySelector('input[name="src"]').value = path;
      downloadBlob(blob, name);
      toast(`Fotka zmenšena (${Math.round(blob.size / 1024)} kB) a stažena jako ${name}`);
    } catch (err) {
      toast(err.message);
    }
  }

  /* =========================================================
     UDÁLOSTI
     ========================================================= */
  function selectDay(iso, scroll) {
    if (!isISO(iso)) return;
    S.selected = iso;
    renderCalendar();
    renderDay();
    if (scroll) {
      const target = window.innerWidth < 900 ? $('#day-detail') : $('#kalendar');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function onClick(e) {
    const chip = e.target.closest('[data-layer]');
    if (chip && S.map) {
      const k = chip.dataset.layer;
      S.filters[k] = !S.filters[k];
      chip.classList.toggle('is-on', S.filters[k]);
      if (k === 'visitedOnly') drawMap();
      else if (S.filters[k]) S.layers[k].addTo(S.map); else S.map.removeLayer(S.layers[k]);
      return;
    }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const d = el.dataset;

    switch (a) {
      case 'select-day':
        if (S.map) S.map.closePopup();
        selectDay(d.date, d.scroll === '1');
        break;
      case 'map-day': focusDay(d.date); break;
      case 'map-trip': focusTrip(d.id); break;
      case 'map-point': focusMarker(d.key); break;
      case 'map-base': {
        const b = baseById(d.id);
        if (b) { ensureLayer('route'); focusBounds([[b.lat, b.lng]], 11); setTimeout(() => S.markers['base:' + b.id] && S.markers['base:' + b.id].openPopup(), 900); }
        break;
      }
      case 'map-reset': resetMapView(); break;
      case 'goto-trip': {
        const card = document.getElementById('trip-' + d.id);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'open-photo': {
        $('#lightbox-img').src = d.src;
        $('#lightbox-img').alt = d.caption || 'Fotka z cesty';
        $('#lightbox-caption').textContent = d.caption || '';
        const dlg = $('#lightbox');
        if (dlg.showModal) dlg.showModal(); else window.open(d.src, '_blank');
        break;
      }
      case 'close-lightbox': $('#lightbox').close(); break;
      case 'toggle-edit': S.edit ? exitEdit() : enterEdit(false); break;
      case 'export-json': exportJSON(); break;
      case 'copy-json': copyJSON(); break;
      case 'discard-draft':
        if (confirm('Opravdu zahodit všechny neexportované změny?')) {
          localStorage.removeItem(DRAFT_KEY);
          S.data = clone(S.original);
          renderAll();
          toast('Změny zahozeny');
        }
        break;
    }
    if (!S.edit) return;

    // Akce dostupné jen v režimu úprav
    switch (a) {
      case 'toggle-act': {
        const day = dayData(d.date);
        const act = day && day.activities.find((x) => x.id === d.id);
        if (act) { act.done = !act.done; commit(act.done ? 'Označeno jako absolvované ✔' : 'Vráceno na plánované'); }
        break;
      }
      case 'toggle-place': {
        const t = tripById(d.trip);
        const pl = t && t.places.find((x) => x.id === d.id);
        if (pl) { pl.visited = !pl.visited; if (S.map) S.map.closePopup(); commit(pl.visited ? 'Místo navštíveno ✔' : 'Vráceno na plánované'); }
        break;
      }
      case 'del-act': {
        const day = dayData(d.date);
        if (day && confirm('Smazat tuto aktivitu?')) { day.activities = day.activities.filter((x) => x.id !== d.id); commit('Smazáno'); }
        break;
      }
      case 'del-note': case 'del-photo': {
        const owner = d.trip ? tripById(d.trip) : dayData(d.date);
        const key = a === 'del-note' ? 'notes' : 'photos';
        if (owner && confirm(a === 'del-note' ? 'Smazat poznámku?' : 'Odebrat fotku z deníku?')) { owner[key].splice(Number(d.idx), 1); commit('Smazáno'); }
        break;
      }
      case 'plan-trip': {
        const t = tripById(d.id);
        if (t) { t.date = d.date; if (t.status === 'unplanned') t.status = 'planned'; commit(`${t.name}: naplánováno na ${fmtShortWd(d.date)}`); }
        break;
      }
    }
  }

  function onChange(e) {
    const el = e.target;
    if (el.matches('input[type="file"][name="file"]')) { handlePhotoFile(el); return; }
    if (!S.edit) return;
    if (el.dataset.tripDate !== undefined) {
      const t = tripById(el.dataset.tripDate);
      if (!t) return;
      t.date = el.value || null;
      if (t.date && t.status === 'unplanned') t.status = 'planned';
      if (!t.date && (t.status === 'fixed' || t.status === 'planned')) t.status = 'unplanned';
      commit(t.date ? `${t.name}: termín ${fmtShortWd(t.date)}` : `${t.name}: termín zrušen`);
    } else if (el.dataset.tripStatus !== undefined) {
      const t = tripById(el.dataset.tripStatus);
      if (!t) return;
      t.status = el.value;
      if (t.status === 'unplanned') t.date = null;
      commit('Stav výletu změněn');
    } else if (el.dataset.dayTitle !== undefined) {
      ensureDay(el.dataset.dayTitle).title = el.value.trim();
      commit('Název dne uložen');
    }
  }

  // Náhradní zobrazení, pokud fotka ještě není nahraná
  function onImgError(e) {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const fig = img.closest('.photo');
    if (fig && !fig.classList.contains('photo--missing')) {
      fig.classList.add('photo--missing');
      const btn = img.closest('button');
      (btn || img).insertAdjacentHTML('beforebegin', `<span>📷 Fotka zatím není nahraná<br><small>${esc(img.getAttribute('src'))}</small></span>`);
      (btn || img).remove();
    }
    const cover = img.closest('.trip-card__cover');
    if (cover) img.remove();
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2800);
  }

  function setupNavHighlight() {
    if (!('IntersectionObserver' in window)) return;
    const links = $$('.nav__link');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id));
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['dnes', 'itinerar', 'kalendar', 'mapa', 'vylety', 'denik'].forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  function showError(msg) {
    $('#status-card').innerHTML = `
      <div class="status-card__label">Chyba</div>
      <p style="margin:6px 0 0"><strong>Nepodařilo se načíst data cesty.</strong></p>
      <p style="color:var(--ink-soft);font-size:.92rem">${esc(msg)}</p>
      <p style="color:var(--ink-soft);font-size:.85rem">Pokud stránku otevíráte přímo jako soubor z disku, spusťte místní server (viz README) nebo ji otevřete na GitHub Pages.</p>`;
  }

  /* =========================================================
     START
     ========================================================= */
  async function init() {
    const params = new URLSearchParams(location.search);
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('error', onImgError, true);
    $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') e.target.close(); });

    let raw;
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Soubor ${DATA_URL} nebyl nalezen (HTTP ${res.status}).`);
      raw = await res.text();
      S.original = normalize(JSON.parse(raw));
    } catch (err) {
      const msg = err instanceof SyntaxError ? `V souboru trip-data.json je chyba zápisu: ${err.message}` : (err instanceof TypeError ? 'Soubor trip-data.json se nepodařilo stáhnout.' : err.message);
      showError(msg);
      console.error(err);
      return;
    }
    S.originalHash = hash(raw);
    S.data = clone(S.original);

    // Dnešní datum podle japonského času; pro náhled lze zadat ?datum=2026-11-18
    const sim = params.get('datum') || params.get('date');
    S.today = isISO(sim) ? sim : isoInTimeZone(S.data.trip.timezone || 'Asia/Tokyo');
    S.simulated = isISO(sim);
    S.demo = params.get('demo') === '1';
    if (S.simulated || S.demo) {
      const bn = $('#preview-banner');
      bn.hidden = false;
      bn.innerHTML = `Náhled: stránka se zobrazuje, jako by bylo <strong>${fmtLongYear(S.today)}</strong>${S.demo ? ' (ukázka – dny před tímto datem jsou označené jako absolvované)' : ''}. <a href="${location.pathname}" style="color:#fff">Zrušit náhled</a>`;
    }

    const p = phase();
    S.selected = p === 'during' ? S.today : S.data.trip.start;

    if (params.get('upravy') === '1' || localStorage.getItem(EDIT_KEY) === '1') {
      enterEdit(true);
    } else {
      renderAll();
    }
    initMap();
    setupNavHighlight();
    setInterval(renderClocks, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
