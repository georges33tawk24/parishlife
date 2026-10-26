/* Shared collection controls. Filtering and sorting happen before pagination. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar = () => document.documentElement.lang === 'ar';
const label = (en, arabic) => ar() ? arabic : en;
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const PAGE_SIZE = 10;

export function calendarView(events, state = {}) {
  const mode = state.mode || 'month', anchor = new Date(`${state.date || dayKey(new Date())}T12:00:00`);
  const start = mode === 'week' ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()-anchor.getDay()) : new Date(anchor.getFullYear(),anchor.getMonth(),1);
  const end = mode === 'week' ? new Date(start.getFullYear(),start.getMonth(),start.getDate()+7) : new Date(start.getFullYear(),start.getMonth()+1,1);
  const locale = ar() ? 'ar-LB' : 'en-GB';
  const dateLabel = mode === 'week' ? `${start.toLocaleDateString(locale)} – ${new Date(end-86400000).toLocaleDateString(locale)}` : start.toLocaleDateString(locale,{month:'long',year:'numeric'});
  const query = (state.query || '').toLocaleLowerCase();
  const filtered = events.filter(e => (!query || `${e.title || ''} ${e.subtitle || ''}`.toLocaleLowerCase().includes(query)) && (!state.filterDate || (e.date || e.d) === state.filterDate));
  const items = filtered.map(e => ({...e,date:e.date || e.d,time:e.time || e.t || ''}));
  const controls = `<div class="collection-toolbar"><div class="seg" role="group" aria-label="${label('Calendar view','عرض الرزنامة')}">${[['month','Month','شهر'],['week','Week','أسبوع']].map(([v,en,a])=>`<button type="button" data-calendar-mode="${v}" aria-pressed="${mode===v}">${label(en,a)}</button>`).join('')}</div><button class="btn btn-secondary" type="button" data-calendar-mode="list" aria-pressed="${mode==='list'}">${label('List','قائمة')}</button><input class="input" type="search" data-calendar-search value="${escape(state.query||'')}" placeholder="${label('Search by name','البحث بالاسم')}" aria-label="${label('Search events','البحث عن الأحداث')}"><input class="input" type="date" data-calendar-date-filter value="${escape(state.filterDate||'')}" aria-label="${label('Search by date','البحث بالتاريخ')}"><button class="btn btn-ghost" data-calendar-clear>${label('Reset','إعادة ضبط')}</button></div>`;
  const nav = `<div class="collection-period"><button class="btn btn-secondary" data-calendar-step="-1" aria-label="${label('Previous period','الفترة السابقة')}">‹</button><strong>${escape(dateLabel)}</strong><button class="btn btn-secondary" data-calendar-step="1" aria-label="${label('Next period','الفترة التالية')}">›</button><button class="btn btn-ghost" data-calendar-today>${label('Today','اليوم')}</button></div>`;
  const event = e => `<button type="button" class="cal-ev collection-event" data-calendar-event="${escape(e.id)}"><time>${escape(e.time)}</time><span>${escape(e.title)}</span>${e.subtitle?`<small>${escape(e.subtitle)}</small>`:''}</button>`;
  if (mode === 'list') {
    const now = dayKey(new Date());
    const upcoming = items.filter(e=>e.date>=now).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    const past = items.filter(e=>e.date<now).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
    return controls+`<div class="collection-list" data-paginate>${[...upcoming,...past].map(e=>`<article class="collection-list-item"><time>${escape(new Date(e.date+'T12:00:00').toLocaleDateString(locale,{dateStyle:'medium'}))}</time>${event(e)}</article>`).join('') || `<p class="help">${label('No matching events.','لا أحداث مطابقة.')}</p>`}</div>`;
  }
  const offset = mode==='week'?0:start.getDay();
  const count = mode==='week'?7:Math.ceil((new Date(end-86400000).getDate()+offset)/7)*7;
  return controls+nav+`<div class="collection-calendar-scroll"><div class="cal collection-calendar"><div class="cal-head">${Array.from({length:7},(_,i)=>`<div>${new Date(2026,9,4+i).toLocaleDateString(locale,{weekday:'short'})}</div>`).join('')}</div><div class="cal-grid">${Array.from({length:count},(_,i)=>{
    const date = new Date(start.getFullYear(),start.getMonth(),start.getDate()+i-offset), key=dayKey(date);
    return `<div class="cal-day${mode==='month'&&date.getMonth()!==anchor.getMonth()?' out':''}${key===dayKey(new Date())?' today':''}"><time class="dn" datetime="${key}">${date.getDate()}</time>${items.filter(e=>e.date===key).sort((a,b)=>a.time.localeCompare(b.time)).map(event).join('')}</div>`;
  }).join('')}</div></div></div>`;
}

export function bindCalendar(host, state, render, open) {
  host.querySelectorAll('[data-calendar-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.calendarMode;render();});
  host.querySelectorAll('[data-calendar-step]').forEach(b=>b.onclick=()=>{
    const d=new Date(`${state.date||dayKey(new Date())}T12:00:00`), step=Number(b.dataset.calendarStep);
    if(state.mode==='week')d.setDate(d.getDate()+step*7);else{d.setDate(1);d.setMonth(d.getMonth()+step);}
    state.date=dayKey(d);render();
  });
  host.querySelector('[data-calendar-today]')?.addEventListener('click',()=>{state.date=dayKey(new Date());render();});
  host.querySelector('[data-calendar-clear]')?.addEventListener('click',()=>{state.query='';state.filterDate='';render();});
  host.querySelector('[data-calendar-search]')?.addEventListener('input',e=>{state.query=e.target.value;const pos=e.target.selectionStart;render();const input=host.querySelector('[data-calendar-search]');input?.focus();input?.setSelectionRange(pos,pos);});
  host.querySelector('[data-calendar-date-filter]')?.addEventListener('change',e=>{state.filterDate=e.target.value;if(e.target.value)state.date=e.target.value;render();});
  host.querySelectorAll('[data-calendar-event]').forEach(b=>b.onclick=()=>open?.(b.dataset.calendarEvent));
  paginateCollections(host);
}

export function paginateCollections(host) {
  host.querySelectorAll('[data-paginate],.tablewrap:not([data-manual-pagination]),.member-list,.member-grid,.mr-cards,.gridcards').forEach(container=>{
    if(container.dataset.pageWired || container.querySelector('.pager,[data-page]') || container.closest('[data-no-pagination]'))return;
    const body=container.matches('.tablewrap')?container.querySelector('tbody'):container;
    if(!body)return;
    let page=0,signature='',sequence=0;const identities=new WeakMap();
    const bar=document.createElement('nav');bar.className='collection-pages';bar.setAttribute('aria-label',label('Pagination','الصفحات'));
    container.insertAdjacentElement('afterend',bar);container.dataset.pageWired='true';
    const update=reset=>{
      if(!container.isConnected){observer.disconnect();bar.remove();return;}
      const rows=[...body.children].filter(e=>!e.matches('.detail,[data-no-page]'));
      const visible=rows.filter(e=>!e.hidden&&e.style.display!=='none');
      const next=visible.map(e=>{if(!identities.has(e))identities.set(e,++sequence);return identities.get(e);}).join(',');
      if(reset || signature!==next){page=0;signature=next;}
      const pages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE));page=Math.min(page,pages-1);
      rows.forEach(e=>{const i=visible.indexOf(e);const hide=i<page*PAGE_SIZE||i>=(page+1)*PAGE_SIZE;e.dataset.pageHidden=String(hide);const detail=e.nextElementSibling;if(detail?.matches('.detail'))detail.dataset.pageHidden=String(hide);});
      container.dispatchEvent(new Event('paginationchange',{bubbles:true}));
      bar.hidden=visible.length<=PAGE_SIZE;
      bar.innerHTML=`<span>${visible.length?`${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,visible.length)}`:'0'} / ${visible.length}</span><button type="button" class="btn btn-secondary btn-dense" data-page-step="-1" ${page?'':'disabled'}>${label('Previous','السابق')}</button><label>${label('Page','الصفحة')} <select class="select" data-page-select>${Array.from({length:pages},(_,i)=>`<option value="${i}" ${i===page?'selected':''}>${i+1}</option>`).join('')}</select> / ${pages}</label><button type="button" class="btn btn-secondary btn-dense" data-page-step="1" ${page+1<pages?'':'disabled'}>${label('Next','التالي')}</button>`;
      bar.querySelectorAll('[data-page-step]').forEach(b=>b.onclick=()=>{page+=Number(b.dataset.pageStep);update(false);});
      bar.querySelector('[data-page-select]').onchange=e=>{page=Number(e.target.value);update(false);};
    };
    const observer=new MutationObserver(()=>update(false));observer.observe(body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','style']});
    container._disposePagination=()=>{observer.disconnect();bar.remove();};
    update(false);
  });
}

// Shared observer also covers screens that populate their tables after an API request.
export function watchCollections(host){
  host._collectionWatcher?.disconnect();
  const dispose=node=>{if(node.nodeType!==1)return;node._disposePagination?.();node.querySelectorAll('[data-page-wired]').forEach(el=>el._disposePagination?.());};
  const observer=new MutationObserver(records=>{
    for(const record of records)for(const node of record.removedNodes)if(!node.isConnected)dispose(node);
    paginateCollections(host);
  });
  observer.observe(host,{childList:true,subtree:true});host._collectionWatcher=observer;paginateCollections(host);
}
