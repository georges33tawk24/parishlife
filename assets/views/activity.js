import { api } from '../api.js';
import { t, isAr } from '../i18n.js';
import { esc, pageHead, panel, openDrawer } from '../ui.js';
import { calendarView, bindCalendar, paginateCollections } from '../collection-ui.js';

const calendar={mode:'month'};
let parish='';
export function activityPage(){
  return pageHead({title:t('My parish life','حياتي الرعوية'),sub:t('See the activity of all your parishes, or focus on one.','تابع أنشطة كل رعاياك أو اختر رعية واحدة.')})+'<div data-activity aria-live="polite"></div>';
}
activityPage.mount=async host=>{
  const body=host.querySelector('[data-activity]');body.textContent=t('Loading…','جارٍ التحميل…');
  try{
    const data=await api('account/activity');if(!body.isConnected)return;
    body.innerHTML=`<div class="account-actions"><a class="btn btn-secondary" href="#/account">${t('Complete Profile · manage my parishes','إكمال الملف · إدارة رعاياي')}</a><label>${t('Activity from','أنشطة')} <select class="select" data-parish><option value="">${t('All my parishes','كل رعاياي')}</option>${data.parishes.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label></div>${data.parishes.length?'':`<p class="member-empty">${t('Follow a parish in Complete Profile to see its public activity. Parish membership is a separate request.','تابع رعية في إكمال الملف لرؤية أنشطتها العامة. العضوية في الرعية طلب منفصل.')}</p>`}<div data-activity-calendar></div>${panel(t('Updates for me','تحديثاتي'),`<div class="inbox-grid" data-activity-updates data-paginate>${data.notifications.map(n=>`<article class="inbox-card" data-notice-parish="${esc(n.parish_id)}"><h3>${esc(n.title)}</h3><p class="message-body">${esc(n.body)}</p><small>${esc(n.created_at.slice(0,10))}</small></article>`).join('')||`<p>${t('No updates yet.','لا تحديثات بعد.')}</p>`}</div>`)}`;
    if(!data.parishes.some(p=>p.id===parish))parish='';
    const selector=body.querySelector('[data-parish]');selector.value=parish;
    const el=body.querySelector('[data-activity-calendar]');
    const render=()=>{
      body.querySelectorAll('[data-notice-parish]').forEach(card=>card.hidden=!!parish&&card.dataset.noticeParish!==parish);
      const events=data.events.filter(e=>!parish||e.parish===parish).map(e=>({...e,title:isAr()?e.titleAr||e.title:e.title}));
      el.innerHTML=calendarView(events,calendar);bindCalendar(el,calendar,render,id=>{const e=events.find(e=>e.id===id);if(e)openDrawer({title:e.title,body:`<p>${esc(e.subtitle)}</p><p>${esc(e.date)} · ${esc(e.time)}</p><a class="btn btn-secondary" href="public.html?parish=${encodeURIComponent(e.parish)}&view=calendar">${t('Parish calendar and contact','رزنامة الرعية والتواصل')}</a>`});});
    };selector.onchange=()=>{parish=selector.value;render();};render();paginateCollections(body);
  }catch(e){if(body.isConnected)body.textContent=e.message;}
};
