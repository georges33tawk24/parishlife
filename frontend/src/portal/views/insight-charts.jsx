/* The charts of Insights, drawn by hand in SVG and HTML: a trend (area and lines on one axis,
   with a crosshair that reads every series), bar lists, a 100% stacked bar, a funnel, a meter
   and sparklines. Colours come from the --series and --ramp tokens in insights.css (validated
   for the dashboard's light and dark surfaces); text always wears the text colours. Every value
   a tooltip shows is also on the page or in the chart's table. */
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { t, isAr } from '../../lib/i18n.js';
import { Icon } from '../ui/icons.jsx';
import { CollectionPages } from '../ui/ui.jsx';

export const number = n => new Intl.NumberFormat(isAr() ? 'ar-LB' : 'en', n >= 10000 ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(n || 0);
export const percent = (n, of) => of ? new Intl.NumberFormat(isAr() ? 'ar-LB' : 'en', { style: 'percent', maximumFractionDigits: n / of < .1 ? 1 : 0 }).format(n / of) : '—';
export const shortDate = (d, opts = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-GB', opts).format(new Date(d + 'T12:00:00'));

/* Round the top of an axis up to a clean number: 0 / 5 / 10 / 15 rather than 0 / 4.3 / 8.6. */
function niceMax(max) {
  if (max <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(max / 4)), choices = [1, 2, 2.5, 5, 10].map(m => m * step);
  return 4 * choices.find(s => s * 4 >= max);
}

export function Sparkline({ values, width = 112, height = 30 }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values), x = i => 2 + i / (values.length - 1) * (width - 6), y = v => height - 3 - v / max * (height - 8);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return <svg className="viz-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false">
    <path d={d} fill="none" stroke="var(--spark)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={x(last).toFixed(1)} cy={y(values[last]).toFixed(1)} r="3" fill="var(--series-1)" stroke="var(--viz-surface)" strokeWidth="2" /></svg>;
}

/* A trend over days. series: [{ label, values, area }]; one axis, since every series counts the
   same thing (people or pages). It redraws to the width of its box. */
export function Trend({ dates, series, height = 260, label, className = 'ins-trend', ...props }) {
  const host = useRef(null), tip = useRef(null);
  const [width, setWidth] = useState(0), [index, setIndex] = useState(-1);
  useLayoutEffect(() => {
    const measure = () => { const w = Math.max(280, host.current.clientWidth); setWidth(old => Math.abs(old - w) > 2 ? w : old); };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(host.current);
    return () => watch.disconnect();
  }, []);
  const pad = { l: 44, r: 14, t: 14, b: 30 }, n = dates.length;
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const top = niceMax(Math.max(0, ...series.flatMap(s => s.values)));
  const x = i => pad.l + (n === 1 ? w / 2 : i / (n - 1) * w), y = v => pad.t + h - v / top * h;
  const ticks = [0, .25, .5, .75, 1].map(f => f * top);
  const every = Math.max(1, Math.ceil(n / (width < 520 ? 4 : 7)));
  const path = values => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const show = i => setIndex(Math.max(0, Math.min(n - 1, i)));
  useLayoutEffect(() => {
    if (index < 0 || !tip.current) return;
    const px = x(index), el = tip.current;
    el.style.left = `${Math.max(0, px + 12 + el.offsetWidth > width ? px - el.offsetWidth - 12 : px + 12)}px`;
    el.style.top = `${pad.t}px`;
  });
  return <div className={className} ref={host} {...props}>{width ? <>
    <svg className="viz-trend" width={width} height={height} role="img" aria-label={label}>
      {ticks.map((v, i) => <Fragment key={i}><line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} className={v ? 'viz-grid' : 'viz-base'} />
        <text x={pad.l - 8} y={y(v) + 4} className="viz-tick" textAnchor="end">{number(v)}</text></Fragment>)}
      {dates.map((d, i) => i % every === 0 || i === n - 1 && (n - 1) % every > every * .7 ? <text key={d} x={x(i)} y={height - 8} className="viz-tick" textAnchor="middle">{shortDate(d)}</text> : null)}
      {series.map((s, k) => <Fragment key={k}>{s.area ? <path d={`${path(s.values)}L${x(n - 1)} ${y(0)}L${x(0)} ${y(0)}Z`} fill={`var(--series-${k + 1})`} opacity=".1" /> : null}
        <path d={path(s.values)} fill="none" stroke={`var(--series-${k + 1})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></Fragment>)}
      <line className="viz-cross" x1={index < 0 ? 0 : x(index)} x2={index < 0 ? 0 : x(index)} y1={pad.t} y2={pad.t + h} hidden={index < 0} />
      {series.map((s, k) => <circle key={k} className="viz-dot" r="4" fill={`var(--series-${k + 1})`} stroke="var(--viz-surface)" strokeWidth="2" hidden={index < 0} data-series={k}
        cx={index < 0 ? 0 : x(index)} cy={index < 0 ? 0 : y(s.values[index])} />)}
      <rect className="viz-hit" x={pad.l} y={pad.t} width={Math.max(0, w)} height={h} fill="transparent" tabIndex="0" aria-label={t('Use the arrow keys to read each day', 'استعمل الأسهم لقراءة كل يوم')}
        onPointerMove={e => { const r = e.currentTarget.ownerSVGElement.getBoundingClientRect(); show(Math.round((e.clientX - r.left - pad.l) / w * (n - 1))); }}
        onPointerLeave={() => setIndex(-1)} onBlur={() => setIndex(-1)}
        onKeyDown={e => {
          // Time runs left to right in both languages, so the arrows follow the screen.
          const step = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: n }[e.key];
          if (step) { e.preventDefault(); show(index < 0 ? n - 1 : index + step); }
          else if (e.key === 'Escape') setIndex(-1);
        }} /></svg>
    <div className="viz-tip" hidden={index < 0} role="status" ref={tip}>{index < 0 ? null : <>
      <b>{shortDate(dates[index], { weekday: 'short', day: 'numeric', month: 'long' })}</b>
      {series.map((s, k) => <span key={k}><i style={{ background: `var(--series-${k + 1})` }} /><strong>{number(s.values[index])}</strong><small>{s.label}</small></span>)}</>}</div>
  </> : null}</div>;
}

/* Bars for magnitude, one hue. rows: [{ label, value, note? }] */
export function Bars({ rows, empty = '' }) {
  if (!rows.length) return <p className="viz-empty">{empty}</p>;
  const max = Math.max(1, ...rows.map(r => r.value)), total = rows.reduce((s, r) => s + r.value, 0);
  return <ul className="viz-bars">{rows.map((r, i) => <li key={i} className="viz-bar" tabIndex="0" data-tip={`${r.label}: ${number(r.value)} (${percent(r.value, total)})${r.note ? ' · ' + r.note : ''}`}>
    <span className="viz-bar-label" dir="auto">{r.label}</span><span className="viz-bar-value">{r.note ? <small>{r.note}</small> : null}{number(r.value)}</span>
    <span className="viz-bar-track" aria-hidden="true"><span className="viz-bar-fill" style={{ width: `${Math.max(1.5, r.value / max * 100).toFixed(2)}%` }} /></span></li>)}</ul>;
}

/* Parts of a whole as one bar, up to three categorical slots, with a legend that names and
   counts each part (the colour is never the only way to tell them apart). */
export function Stacked({ rows, empty = '' }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <p className="viz-empty">{empty}</p>;
  return <><div className="viz-stack" role="img" aria-label={rows.map(r => `${r.label} ${percent(r.value, total)}`).join(', ')}>{rows.map((r, i) =>
    <span key={i} className="viz-seg" style={{ flex: `${r.value} 1 0`, background: `var(--series-${i + 1})` }} tabIndex="0" data-tip={`${r.label}: ${number(r.value)} (${percent(r.value, total)})`} />)}</div>
    <ul className="viz-legend">{rows.map((r, i) => <li key={i}><i style={{ background: `var(--series-${i + 1})` }} /><span>{r.label}</span><b>{percent(r.value, total)}</b><small>{number(r.value)}</small></li>)}</ul></>;
}

/* Steps from a visit to a sent request: an ordered ramp of one hue, each step with its share of
   the step before it. */
export function Funnel({ rows }) {
  const top = Math.max(1, rows[0]?.value || 0);
  return <ol className="viz-funnel">{rows.map((r, i) => <li key={i} tabIndex="0" data-tip={`${r.label}: ${number(r.value)}`}>
    <span className="viz-funnel-label">{r.label}</span><b>{number(r.value)}</b><small>{i ? percent(r.value, rows[i - 1].value) : ''}</small>
    <span className="viz-funnel-track"><span style={{ width: `${Math.max(1.5, r.value / top * 100).toFixed(2)}%`, background: `var(--ramp-${i + 1})` }} /></span></li>)}</ol>;
}

/* Health as a meter: the fill carries the state, and an icon and a word always say it too. */
export const HEALTH = [[75, 'good', 'check', 'Thriving', 'مزدهرة'], [50, 'warning', 'warn', 'Steady', 'مستقرّة'], [0, 'critical', 'warn', 'At risk', 'بحاجة إلى دعم']];
export const healthOf = score => HEALTH.find(([min]) => score >= min);
export function Meter({ score }) {
  const [, tone, glyph, en, ar] = healthOf(score);
  return <span className={`viz-meter is-${tone}`}><span className="viz-meter-track" aria-hidden="true"><span style={{ width: `${score}%` }} /></span>
    <span className="viz-meter-label"><Icon name={glyph} size={14} /><b>{number(score)}</b> {t(en, ar)}</span></span>;
}

/* One tooltip for every bar, segment and step in a region, on hover and on keyboard focus. */
export function useChartTips(root) {
  useLayoutEffect(() => {
    const box = root.current;
    if (!box) return undefined;
    const tip = document.createElement('div');
    tip.className = 'viz-tip viz-tip-float'; tip.hidden = true; box.append(tip);
    const show = el => {
      tip.textContent = el.dataset.tip; tip.hidden = false;
      const r = el.getBoundingClientRect(), base = box.getBoundingClientRect();
      tip.style.left = `${Math.min(r.left - base.left, base.width - tip.offsetWidth - 4)}px`;
      tip.style.top = `${r.top - base.top - tip.offsetHeight - 6}px`;
    };
    const over = e => { const el = e.target.closest('[data-tip]'); if (el && box.contains(el)) show(el); };
    const out = e => { if (e.target.closest('[data-tip]')) tip.hidden = true; };
    const focus = e => { const el = e.target.closest('[data-tip]'); if (el) show(el); };
    const blur = () => { tip.hidden = true; };
    box.addEventListener('pointerover', over); box.addEventListener('pointerout', out);
    box.addEventListener('focusin', focus); box.addEventListener('focusout', blur);
    return () => { tip.remove(); box.removeEventListener('pointerover', over); box.removeEventListener('pointerout', out); box.removeEventListener('focusin', focus); box.removeEventListener('focusout', blur); };
  }, [root.current]);
}

/* The same numbers as a table, for screen readers, printing and anyone who prefers figures. */
export function DataTable({ caption, head, rows }) {
  const box = useRef(null);
  return <details className="viz-data"><summary>{t('Show the numbers', 'عرض الأرقام')}</summary>
    <div className="tablewrap" ref={box}><table className="tbl"><caption className="sr-only">{caption}</caption><thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, j) => <tr key={j}>{r.map((cell, i) => i ? <td key={i} className="num">{cell}</td> : <th key={i} scope="row">{cell}</th>)}</tr>)}</tbody></table></div>
    <CollectionPages target={box} body={c => c.querySelector('tbody')} /></details>;
}
