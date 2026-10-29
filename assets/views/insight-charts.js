/* The charts of Insights, drawn by hand in SVG and HTML: a trend (area and lines on one axis,
   with a crosshair that reads every series), bar lists, a 100% stacked bar, a funnel, a meter
   and sparklines. Colours come from the --series and --ramp tokens in insights.css (validated
   for the dashboard's light and dark surfaces); text always wears the text colours. Every value
   a tooltip shows is also on the page or in the chart's table. */
import { esc } from '../ui.js';
import { t, isAr } from '../i18n.js';

export const number = n => new Intl.NumberFormat(isAr() ? 'ar-LB' : 'en', n >= 10000 ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(n || 0);
export const percent = (n, of) => of ? new Intl.NumberFormat(isAr() ? 'ar-LB' : 'en', { style: 'percent', maximumFractionDigits: n / of < .1 ? 1 : 0 }).format(n / of) : '—';
export const shortDate = (d, opts = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-GB', opts).format(new Date(d + 'T12:00:00'));

/* Round the top of an axis up to a clean number: 0 / 5 / 10 / 15 rather than 0 / 4.3 / 8.6. */
function niceMax(max) {
  if (max <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(max / 4)), choices = [1, 2, 2.5, 5, 10].map(m => m * step);
  return 4 * choices.find(s => s * 4 >= max);
}

export function sparkline(values, { width = 112, height = 30 } = {}) {
  if (values.length < 2) return '';
  const max = Math.max(1, ...values), x = i => 2 + i / (values.length - 1) * (width - 6), y = v => height - 3 - v / max * (height - 8);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return `<svg class="viz-spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false">
    <path d="${d}" fill="none" stroke="var(--spark)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="3" fill="var(--series-1)" stroke="var(--viz-surface)" stroke-width="2"/></svg>`;
}

/* A trend over days. series: [{ key, label, values, area }]; one axis, since every series counts
   the same thing (people or pages). Returns a function that removes it. */
export function trend(host, { dates, series, height = 260, label }) {
  const tip = document.createElement('div');
  tip.className = 'viz-tip'; tip.hidden = true; tip.setAttribute('role', 'status');
  let index = -1, width = 0;
  const pad = { l: 44, r: 14, t: 14, b: 30 };
  const draw = () => {
    width = Math.max(280, host.clientWidth);
    const w = width - pad.l - pad.r, h = height - pad.t - pad.b, n = dates.length;
    const top = niceMax(Math.max(0, ...series.flatMap(s => s.values)));
    const x = i => pad.l + (n === 1 ? w / 2 : i / (n - 1) * w), y = v => pad.t + h - v / top * h;
    const ticks = [0, .25, .5, .75, 1].map(f => f * top);
    const every = Math.max(1, Math.ceil(n / (width < 520 ? 4 : 7)));
    const path = values => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
    host.innerHTML = `<svg class="viz-trend" width="${width}" height="${height}" role="img" aria-label="${esc(label)}">
      ${ticks.map(v => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}" class="${v ? 'viz-grid' : 'viz-base'}"/>
        <text x="${pad.l - 8}" y="${y(v) + 4}" class="viz-tick" text-anchor="end">${esc(number(v))}</text>`).join('')}
      ${dates.map((d, i) => i % every === 0 || i === n - 1 && (n - 1) % every > every * .7 ? `<text x="${x(i)}" y="${height - 8}" class="viz-tick" text-anchor="middle">${esc(shortDate(d))}</text>` : '').join('')}
      ${series.map((s, k) => `${s.area ? `<path d="${path(s.values)}L${x(n - 1)} ${y(0)}L${x(0)} ${y(0)}Z" fill="var(--series-${k + 1})" opacity=".1"/>` : ''}
        <path d="${path(s.values)}" fill="none" stroke="var(--series-${k + 1})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
      <line class="viz-cross" y1="${pad.t}" y2="${pad.t + h}" hidden/>
      ${series.map((s, k) => `<circle class="viz-dot" r="4" fill="var(--series-${k + 1})" stroke="var(--viz-surface)" stroke-width="2" hidden data-series="${k}"/>`).join('')}
      <rect class="viz-hit" x="${pad.l}" y="${pad.t}" width="${w}" height="${h}" fill="transparent" tabindex="0"
        aria-label="${esc(t('Use the arrow keys to read each day', 'استعمل الأسهم لقراءة كل يوم'))}"/></svg>`;
    host.append(tip);
    const svg = host.querySelector('svg'), hit = svg.querySelector('.viz-hit'), cross = svg.querySelector('.viz-cross'), dots = [...svg.querySelectorAll('.viz-dot')];
    const show = i => {
      index = Math.max(0, Math.min(n - 1, i));
      const px = x(index);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.hidden = false;
      dots.forEach((dot, k) => { dot.setAttribute('cx', px); dot.setAttribute('cy', y(series[k].values[index])); dot.hidden = false; });
      tip.replaceChildren();
      const head = document.createElement('b'); head.textContent = shortDate(dates[index], { weekday: 'short', day: 'numeric', month: 'long' }); tip.append(head);
      series.forEach((s, k) => {
        const row = document.createElement('span'), key = document.createElement('i'), value = document.createElement('strong'), name = document.createElement('small');
        key.style.background = `var(--series-${k + 1})`; value.textContent = number(s.values[index]); name.textContent = s.label;
        row.append(key, value, name); tip.append(row);
      });
      tip.hidden = false;
      tip.style.left = `${Math.max(0, px + 12 + tip.offsetWidth > width ? px - tip.offsetWidth - 12 : px + 12)}px`;
      tip.style.top = `${pad.t}px`;
    };
    const hide = () => { cross.hidden = true; dots.forEach(dot => { dot.hidden = true; }); tip.hidden = true; index = -1; };
    hit.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); show(Math.round((e.clientX - r.left - pad.l) / w * (n - 1))); });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', e => {
      // Time runs left to right in both languages, so the arrows follow the screen.
      const step = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: n }[e.key];
      if (step) { e.preventDefault(); show(index < 0 ? n - 1 : index + step); }
      else if (e.key === 'Escape') hide();
    });
  };
  draw();
  const watch = new ResizeObserver(() => { if (Math.abs(host.clientWidth - width) > 2) draw(); });
  watch.observe(host);
  return () => watch.disconnect();
}

/* Bars for magnitude, one hue. rows: [{ label, value, note? }] */
export function bars(rows, { empty = '' } = {}) {
  if (!rows.length) return `<p class="viz-empty">${empty}</p>`;
  const max = Math.max(1, ...rows.map(r => r.value)), total = rows.reduce((s, r) => s + r.value, 0);
  return `<ul class="viz-bars">${rows.map(r => `<li class="viz-bar" tabindex="0" data-tip="${esc(`${r.label}: ${number(r.value)} (${percent(r.value, total)})${r.note ? ' · ' + r.note : ''}`)}">
    <span class="viz-bar-label" dir="auto">${esc(r.label)}</span><span class="viz-bar-value">${r.note ? `<small>${esc(r.note)}</small>` : ''}${esc(number(r.value))}</span>
    <span class="viz-bar-track" aria-hidden="true"><span class="viz-bar-fill" style="width:${Math.max(1.5, r.value / max * 100).toFixed(2)}%"></span></span></li>`).join('')}</ul>`;
}

/* Parts of a whole as one bar, up to three categorical slots, with a legend that names and
   counts each part (the colour is never the only way to tell them apart). */
export function stacked(rows, { empty = '' } = {}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return `<p class="viz-empty">${empty}</p>`;
  return `<div class="viz-stack" role="img" aria-label="${esc(rows.map(r => `${r.label} ${percent(r.value, total)}`).join(', '))}">${rows.map((r, i) =>
    `<span class="viz-seg" style="flex:${r.value} 1 0;background:var(--series-${i + 1})" tabindex="0" data-tip="${esc(`${r.label}: ${number(r.value)} (${percent(r.value, total)})`)}"></span>`).join('')}</div>
    <ul class="viz-legend">${rows.map((r, i) => `<li><i style="background:var(--series-${i + 1})"></i><span>${esc(r.label)}</span><b>${esc(percent(r.value, total))}</b><small>${esc(number(r.value))}</small></li>`).join('')}</ul>`;
}

/* Steps from a visit to a sent request: an ordered ramp of one hue, each step with its share of
   the step before it. */
export function funnel(rows) {
  const top = Math.max(1, rows[0]?.value || 0);
  return `<ol class="viz-funnel">${rows.map((r, i) => `<li tabindex="0" data-tip="${esc(`${r.label}: ${number(r.value)}`)}">
    <span class="viz-funnel-label">${esc(r.label)}</span><b>${esc(number(r.value))}</b><small>${i ? esc(percent(r.value, rows[i - 1].value)) : ''}</small>
    <span class="viz-funnel-track"><span style="width:${Math.max(1.5, r.value / top * 100).toFixed(2)}%;background:var(--ramp-${i + 1})"></span></span></li>`).join('')}</ol>`;
}

/* Health as a meter: the fill carries the state, and an icon and a word always say it too. */
export const HEALTH = [[75, 'good', 'check', 'Thriving', 'مزدهرة'], [50, 'warning', 'warn', 'Steady', 'مستقرّة'], [0, 'critical', 'warn', 'At risk', 'بحاجة إلى دعم']];
export const healthOf = score => HEALTH.find(([min]) => score >= min);
export function meter(score, icon) {
  const [, tone, glyph, en, ar] = healthOf(score);
  return `<span class="viz-meter is-${tone}"><span class="viz-meter-track" aria-hidden="true"><span style="width:${score}%"></span></span>
    <span class="viz-meter-label">${icon(glyph, 14)}<b>${esc(number(score))}</b> ${esc(t(en, ar))}</span></span>`;
}

/* One tooltip for every bar, segment and step in a region, on hover and on keyboard focus. */
export function wireTips(root) {
  let tip = root.querySelector(':scope > .viz-tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'viz-tip viz-tip-float'; tip.hidden = true; root.append(tip); }
  const show = el => {
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = el.getBoundingClientRect(), base = root.getBoundingClientRect();
    tip.style.left = `${Math.min(r.left - base.left, base.width - tip.offsetWidth - 4)}px`;
    tip.style.top = `${r.top - base.top - tip.offsetHeight - 6}px`;
  };
  root.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el && root.contains(el)) show(el); });
  root.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) tip.hidden = true; });
  root.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  root.addEventListener('focusout', () => { tip.hidden = true; });
}

/* The same numbers as a table, for screen readers, printing and anyone who prefers figures. */
export function dataTable(caption, head, rows) {
  return `<details class="viz-data"><summary>${esc(t('Show the numbers', 'عرض الأرقام'))}</summary>
    <div class="tablewrap"><table class="tbl"><caption class="sr-only">${esc(caption)}</caption><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((cell, i) => i ? `<td class="num">${esc(cell)}</td>` : `<th scope="row">${esc(cell)}</th>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}
