/* Modules 11, 13, 14 — communication centre, notices & bulletin, music, portal. */
import { t, isAr, num, fmtDate } from '../i18n.js';
import { is, S, bus } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, pill, esc, table, wireTables, empty, stat,
         searchField, openDrawer, openModal, closeOverlays, toast, tabBar, avatar } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import { persist } from '../persist.js';
import { printSheet } from '../print.js';
import * as F from '../flows.js';
import { MESSAGES, TEMPLATES, NOTICES, MUSIC, MUSIC_DETAIL, SETLISTS, AUTOMATIONS, PRAYERS,
         PARISH, EVENTS, PORTAL_REQUESTS, HOUSEHOLDS, GROUPS, CONTENT, groupInfo, musicInfo, person, venue } from '../data.js';

const L = (en, ar) => t(en, ar);
const CHANNEL = { whatsapp: ['WhatsApp', 'واتساب'], sms: ['SMS', 'رسالة قصيرة'], email: ['Email', 'بريد إلكتروني'] };
const MTABS = () => [['', 'Messages', 'الرسائل'], ['automations', 'Automations', 'الأتمتة', is('leader')?GROUPS.flatMap(g=>groupInfo(g.id).automations).filter(a=>a.active).length:AUTOMATIONS.filter(a => a.active).length],
               ['templates', 'Designs', 'التصاميم'], ['preferences', 'Rules', 'القواعد']];

/* ═══════════ 11 · communication ═══════════ */
export function messaging(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Communicate', 'التواصل') }, { label: L('Messaging', 'المراسلة') }],
    title: L('Communication centre', 'مركز التواصل'),
    sub: L('Publish updates and send messages inside ParishLife. External email, WhatsApp and SMS delivery are not connected.',
           'انشر المستجدات وأرسل الرسائل داخل ParishLife. إرسال البريد وواتساب والرسائل القصيرة غير موصول.'),
    actions: `${tab === 'templates' ? '' : `<button class="btn btn-secondary" data-go="messaging/templates">${icon('doc', 17)}${L('Ready-made designs', 'تصاميم جاهزة')}</button>`}
      ${C.splitBtn(L('New message', 'رسالة جديدة'), 'newmsg')}`
  }) + tabBar('messaging', MTABS(), tab);

  if(is('leader')&&(tab==='automations'||tab==='preferences')){
    const automation=tab==='automations',key=automation?'automations':'messagingRules';
    const rows=GROUPS.flatMap(g=>groupInfo(g.id)[key].map((item,index)=>({g,item,index})));
    return head+`<div class="tabbody"><div class="toolbar ministry-section-heading"><h2>${automation?L('Group automations','أتمتة المجموعة'):L('Group messaging rules','قواعد مراسلة المجموعة')}</h2><button class="btn btn-primary btn-dense" data-message-config-new="${key}">${icon('plus',15)}${L('Add','إضافة')}</button></div>
      ${table({cols:[{label:L('Group','المجموعة')},{label:automation?L('Automation','الأتمتة'):L('Rule','القاعدة')},{label:automation?L('Trigger','المحفّز'):L('Condition / action','الشرط / الإجراء')},{label:L('Status','الحالة')},{label:'',cls:'shrink'}],rows:rows.map(({g,item,index})=>({cells:[esc(L(g.name,g.ar)),`<b>${esc(L(item.name,item.nameAr||item.name))}</b>`,`<span>${esc(L(item.trigger,item.triggerAr||item.trigger))}${!automation&&item.action?`<small style="display:block">${esc(L(item.action,item.actionAr||item.action))}</small>`:''}</span>`,item.active?pill(L('Active','مفعّلة'),'success'):pill(L('Paused','متوقّفة'),'warning'),`<div class="row"><button class="btn btn-secondary btn-dense" data-message-config-edit="${key}|${esc(g.id)}|${index}">${L('Edit','تعديل')}</button><button class="btn-icon" data-message-config-delete="${key}|${esc(g.id)}|${index}" aria-label="${L('Delete','حذف')}">${icon('trash',16)}</button></div>`]}))})}
      <p class="help">${L('These settings are saved for your ministry. External message delivery and timed execution require a connected service.','تُحفظ هذه الإعدادات لخدمتك. يتطلب إرسال الرسائل وتنفيذها المجدول خدمة موصولة.')}</p></div>`;
  }

  if (tab === 'automations') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Automation plan', 'خطة الأتمتة') }, { label: L('Trigger', 'المحفّز'), cls: 'hide-sm' },
             { label: L('Saved state', 'الحالة المحفوظة'), cls: 'shrink' }],
      rows: AUTOMATIONS.map((a, ai) => ({ cells: [
        `<b>${esc(L(a.what, a.whatAr))}</b>`, `<span class="dim">${esc(L(a.on, a.onAr))}</span>`,
        `<label class="switch"><input type="checkbox" ${a.active ? 'checked' : ''} data-act="auto-toggle:${ai}"><span class="sr">${L('Active', 'مفعّل')}</span></label>`]}))
    })}
    ${C.inlineAlert('info', L('Plans only', 'خطط فقط'),
      L('No scheduled runner or external delivery service is connected. These switches save a plan; they do not send messages.',
        'لا يوجد مشغّل مجدول أو خدمة إرسال خارجية موصولة. تحفظ المفاتيح الخطة ولا ترسل رسائل.'))}
    <p class="t-caption dim" style="margin-top:14px">${L(
      'These are stored automation plans. No scheduled runner or external delivery service is connected.',
      'هذه خطط أتمتة محفوظة. لا يوجد مشغّل مجدول أو خدمة إرسال خارجية موصولة.')}</p></div>`;

  if (tab === 'templates') return head + `<div class="tabbody">
    <div class="gridcards">${TEMPLATES.map((tp, ti) => `<button class="panel" style="cursor:pointer;text-align:start;border:1px solid var(--border)" data-act="design:${ti}">
      <div style="height:110px;background:var(--ink);display:grid;place-items:center;color:var(--on-dark);
        font:600 14px/1 var(--sans);text-align:center;padding:10px">
        <span><span style="display:block;font-size:11px;opacity:.7;letter-spacing:.1em;text-transform:uppercase">${esc(L(PARISH.name, PARISH.nameAr))}</span>
        ${esc(L(tp.name, tp.ar))}</span></div>
      <div class="panel-b" style="padding:12px"><b style="font:500 13px/18px var(--sans)">${esc(L(tp.name, tp.ar))}</b>
        <small class="t-caption dim" style="display:block;margin-top:2px">${L('Fill the date and location', 'املأ التاريخ والمكان')}</small></div>
    </button>`).join('')}</div>
    <p class="t-caption dim" style="margin-top:16px">${L(
      'Each design carries the parish name. Fill in the date and location, then download an SVG, PNG, or JPEG announcement.',
      'يحمل كل تصميم اسم الرعية. املأ التاريخ والمكان، ثم نزّل الإعلان بصيغة SVG أو PNG أو JPEG.')}</p></div>`;

  if (tab === 'preferences') return head + `<div style="margin-top:20px" class="grid g2">
    ${panel(L('Available now','المتاح الآن'),`<p>${L('ParishLife delivers in-app messages to named account holders and publishes group or parish updates to authorized member feeds.','يرسل ParishLife رسائل داخل التطبيق إلى حسابات محدّدة وينشر مستجدات المجموعات والرعية للأعضاء المخوّلين.')}</p>
      <a class="btn btn-secondary btn-dense" style="margin-top:12px" href="#/memberhub">${L('Review in-app communication','مراجعة التواصل داخل التطبيق')}</a>`)}
    ${panel(L('External delivery','الإرسال الخارجي'),`<p>${L('Email, WhatsApp, SMS, timed automations, delivery retries, and emergency broadcasts require a connected service. This installation does not send them.','يتطلب البريد وواتساب والرسائل القصيرة والأتمتة المجدولة وإعادة المحاولة والبثّ الطارئ خدمة موصولة. لا يرسلها هذا التثبيت.')}</p>`)}
  </div>`;

  const rows = MESSAGES.map(m => ({ cells: [
    `<b style="font:500 14px/20px var(--sans)">${esc(L(m.subject, m.subjectAr))}</b>`,
    `<span class="dim">${esc(L(m.audience, m.audienceAr))}</span>`,
    `<span class="chip">${esc(L(...CHANNEL[m.channel]))}</span>`,
    `<span class="num dim">${num(m.reach)}</span>`,
    `<span class="dim mono" dir="ltr">${m.when}</span>`,
    status(m.status),
    `<span class="row" style="gap:6px;justify-content:flex-end">${CR.recBtn('message', m.id)}</span>`
  ]}));
  return head + `<div style="margin:20px 0">${C.inlineAlert('info',L('In-app communication is available','التواصل داخل التطبيق متاح'),
      L('Use Member communication to review delivered messages and published updates. The records below are historical channel entries; this app cannot verify or retry their external delivery.',
        'استخدم التواصل مع الأعضاء لمراجعة الرسائل والمستجدات المنشورة. القيود أدناه تاريخية؛ لا يستطيع التطبيق تأكيد إرسالها خارجياً أو إعادة المحاولة.'))}
      <a class="btn btn-secondary" style="margin-top:12px" href="#/memberhub">${L('Open member communication','فتح التواصل مع الأعضاء')}</a></div>
    <h2>${L('Historical channel records','قيود القنوات التاريخية')}</h2>
    ${table({
      cols: [{ label: L('Subject', 'الموضوع'), sort: true }, { label: L('Audience', 'الجمهور'), cls: 'hide-sm' },
             { label: L('Channel', 'القناة'), cls: 'shrink hide-sm' }, { label: L('Reach', 'العدد'), cls: 'num hide-md' },
             { label: L('When', 'الموعد'), cls: 'hide-md' }, { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows
    })}`;
}

messaging.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('[data-message-config-new]')?.addEventListener('click',b=>messageConfigForm(b.currentTarget.dataset.messageConfigNew));
  host.querySelectorAll('[data-message-config-edit]').forEach(b=>b.addEventListener('click',()=>{const [key,gid,index]=b.dataset.messageConfigEdit.split('|');messageConfigForm(key,gid,Number(index));}));
  host.querySelectorAll('[data-message-config-delete]').forEach(b=>b.addEventListener('click',()=>{const [key,gid,index]=b.dataset.messageConfigDelete.split('|'),items=groupInfo(gid)[key],item=items[Number(index)];if(!item)return;openModal({title:L('Delete item?','حذف العنصر؟'),body:`<p>${esc(item.name)}</p>`,foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-danger" id="mc_delete">${L('Delete','حذف')}</button>`,onMount(el){el.querySelector('#mc_delete').addEventListener('click',async()=>{items.splice(Number(index),1);if(!await persist())return;closeOverlays();bus.refresh();});}});}));
  const compose = () => F.compose('all');
  host.querySelector('[data-split="newmsg"]')?.addEventListener('click', compose);
  host.querySelector('[data-splitmenu="newmsg"]')?.addEventListener('click', () =>
    openModal({ title: L('Send', 'إرسال'), body: `<div class="menu" style="position:static;box-shadow:none;border:0;padding:0">
      <button data-act="compose-person">${icon('msg', 16)}${L('Message a person', 'مراسلة شخص')}</button>
      <button data-act="compose:group">${icon('groups', 16)}${L('Message a group', 'مراسلة مجموعة')}</button>
      <button data-act="broadcast">${icon('bell', 16)}${L('Emergency broadcast', 'بثّ طارئ')}</button></div>` }));
};

function messageConfigForm(key,gid='',index=-1){
  const automation=key==='automations',item=gid?groupInfo(gid)[key]?.[index]:null;
  openDrawer({title:item?L('Edit item','تعديل العنصر'):automation?L('Add automation','إضافة أتمتة'):L('Add messaging rule','إضافة قاعدة مراسلة'),body:`<div class="formrow"><label class="label" for="mc_group">${L('Group','المجموعة')}</label><select class="select" id="mc_group" ${item?'disabled':''}>${GROUPS.map(g=>`<option value="${esc(g.id)}" ${g.id===gid?'selected':''}>${esc(L(g.name,g.ar))}</option>`).join('')}</select></div>${C.field({label:L('Name','الاسم'),id:'mc_name',value:item?.name||'',req:true})}${C.field({label:L('Arabic name','الاسم العربي'),id:'mc_name_ar',value:item?.nameAr||''})}${C.field({label:automation?L('Trigger','المحفّز'):L('Condition','الشرط'),id:'mc_trigger',value:item?.trigger||'',req:true})}${C.field({label:L('Arabic description','الوصف العربي'),id:'mc_trigger_ar',value:item?.triggerAr||''})}${automation?'':C.field({label:L('Action','الإجراء'),id:'mc_action',value:item?.action||'',req:true})}${automation?'':C.field({label:L('Arabic action','الإجراء بالعربية'),id:'mc_action_ar',value:item?.actionAr||''})}<label class="check"><input type="checkbox" id="mc_active" ${item?.active!==false?'checked':''}><span>${L('Active','مفعّل')}</span></label>`,foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="mc_save">${L('Save','حفظ')}</button>`,onMount(el){C.wire(el);el.querySelector('#mc_save').addEventListener('click',async()=>{const name=el.querySelector('#mc_name').value.trim(),trigger=el.querySelector('#mc_trigger').value.trim(),action=el.querySelector('#mc_action')?.value.trim()||'';if(!name||!trigger||(!automation&&!action))return toast(L('Complete the name, condition and action','أكمل الاسم والشرط والإجراء'),'','warning');const target=item||{id:`mc-${Date.now().toString(36)}`,sent:0};Object.assign(target,{name,nameAr:el.querySelector('#mc_name_ar').value.trim()||name,trigger,triggerAr:el.querySelector('#mc_trigger_ar').value.trim()||trigger,active:el.querySelector('#mc_active').checked});if(!automation)Object.assign(target,{action,actionAr:el.querySelector('#mc_action_ar').value.trim()||action});if(!item)groupInfo(el.querySelector('#mc_group').value)[key].push(target);if(!await persist())return;closeOverlays();bus.refresh();});}});
}

/* ═══════════ notices & bulletin ═══════════ */
export function notices() {
  const rows = NOTICES.map(n => `<div class="listrow" style="align-items:flex-start">
    <span class="grow"><b>${esc(L(n.title, n.ar))}</b>
      <small>${fmtDate(n.at)} · ${esc(person(n.by) ? (isAr() ? person(n.by).ar : person(n.by).lat) : '—')} · ${esc(L(n.audience, n.audienceAr))}</small></span>
    ${n.pri === 'urgent' ? pill(L('Urgent', 'عاجل'), 'danger', 'st-alert') : pill(L('Normal', 'عادي'))}
    ${CR.recBtn('notice', n.id)}</div>`).join('') || empty('bell', L('No notices', 'لا إعلانات'), L('Publish one and it appears on the board and in the bulletin.', 'انشر واحداً فيظهر على اللوحة وفي النشرة.'));

  return `${pageHead({
      crumbs: [{ label: L('Communicate', 'التواصل') }, { label: L('Notices', 'الإعلانات') }],
      title: L('Notices and the weekly bulletin', 'الإعلانات والنشرة الأسبوعية'),
      sub: L('Enter Mass times, intentions, announcements and events once. ParishLife turns them into a printable bulletin and a phone-friendly version.',
             'أدخل مواعيد القداديس والنوايا والإعلانات والأحداث مرّة واحدة. يحوّلها «حياة الرعية» إلى نشرة للطباعة ونسخة للهاتف.'),
      actions: `<button class="btn btn-secondary" id="bulletin">${icon('doc', 17)}${L('Build bulletin', 'بناء النشرة')}</button>
        <button class="btn btn-primary" data-act="notice-add">${icon('plus', 17)}${L('New notice', 'إعلان جديد')}</button>`
    })}
    <div class="splitview">
      ${panel(L('Published notices', 'الإعلانات المنشورة'), rows, { tight: true })}
      <div class="sidecol">
        ${panel(L('Upcoming Masses', 'القداديس المقبلة'), EVENTS.filter(m => m.kind === 'mass' && m.d >= new Date().toISOString().slice(0,10)).slice(0,8).map(m => `
          <div class="listrow" style="padding-inline:0"><span class="mono dim" style="width:94px;flex:none">${esc(m.d)} · ${esc(m.t)}</span>
            <span class="grow"><b>${esc(L(m.title, m.titleAr))}</b><small>${esc(L(venue(m.venue)?.name||'', venue(m.venue)?.ar||''))}</small></span></div>`).join('')||`<p class="help">${L('No upcoming Masses in the calendar.','لا قداديس مقبلة في الرزنامة.')}</p>`,
          { tight: true })}
        ${panel(L('Public parish page', 'صفحة الرعية العامة'), `<p class="t-caption dim">${L('Published parish content and public calendar events appear on this page.','يظهر في هذه الصفحة محتوى الرعية المنشور وأحداث الرزنامة العامة.')}</p>
          <a class="btn btn-secondary" style="margin-top:12px" href="public.html?parish=${encodeURIComponent(PARISH.id||'')}" target="_blank" rel="noopener">${icon('link',17)}${L('Open public page','فتح الصفحة العامة')}</a>`)}
      </div></div>`;
}

notices.mount = host => {
  C.wire(host);

  host.querySelector('#bulletin')?.addEventListener('click', () => openDrawer({
    large: true,
    title: L('Weekly bulletin', 'النشرة الأسبوعية'),
    sub: L('Edit the welcome text and intentions; the current public Masses and parish notices are included automatically.', 'حرّر كلمة الترحيب والنوايا؛ تُضاف القداديس العامة وإعلانات الرعية الحالية تلقائياً.'),
    body: `<div class="formgrid"><div class="formrow"><label class="label" for="bulletin-en">English introduction</label><textarea class="input" id="bulletin-en" rows="3">${esc(CONTENT.bulletin?.en||'')}</textarea></div>
      <div class="formrow"><label class="label" for="bulletin-ar">المقدمة بالعربية</label><textarea class="input" id="bulletin-ar" rows="3" dir="rtl">${esc(CONTENT.bulletin?.ar||'')}</textarea></div></div>
      <div class="formgrid"><div class="formrow"><label class="label" for="intentions-en">Mass intentions (English, one per line)</label><textarea class="input" id="intentions-en" rows="3">${esc(CONTENT.intentions?.en||'')}</textarea></div>
      <div class="formrow"><label class="label" for="intentions-ar">نوايا القداديس (عربي، سطر لكل نيّة)</label><textarea class="input" id="intentions-ar" rows="3" dir="rtl">${esc(CONTENT.intentions?.ar||'')}</textarea></div></div>
      <div class="a4bar">${C.bgroup([L('A4 preview', 'معاينة A4'), L('Phone preview', 'معاينة الهاتف')], 0)}</div><div class="a4" id="bulletin-preview" style="max-width:none;aspect-ratio:auto;padding:32px;align-items:stretch;text-align:start"></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button><button class="btn btn-secondary" id="bulletin-save">${L('Save content', 'حفظ المحتوى')}</button>
      <button class="btn btn-primary" id="bulletin-print" style="margin-inline-start:auto">${L('Print', 'طباعة')}</button>`,
    onMount(el) {
      C.wire(el);
      const page = el.querySelector('#bulletin-preview');
      const render=()=>{
        const now=new Date(),end=new Date(now);end.setDate(now.getDate()+6);
        const from=now.toISOString().slice(0,10),through=end.toISOString().slice(0,10);
        const langText=(en,ar)=>isAr()?ar||en:en||ar;
        const intro=langText(el.querySelector('#bulletin-en').value,el.querySelector('#bulletin-ar').value);
        const intentions=langText(el.querySelector('#intentions-en').value,el.querySelector('#intentions-ar').value).split('\n').map(x=>x.trim()).filter(Boolean);
        const masses=EVENTS.filter(e=>e.kind==='mass'&&e.d>=from&&e.d<=through).sort((a,b)=>(a.d+a.t).localeCompare(b.d+b.t));
        const notices=NOTICES.filter(n=>n.audience==='Parish'&&!n.groupId&&n.at>=from&&n.at<=through);
        page.innerHTML=`<div style="text-align:center"><div class="ttl">${esc(L(PARISH.name,PARISH.nameAr))}</div><div class="ttl-ar">${L('Weekly bulletin','النشرة الأسبوعية')} · ${esc(from)} – ${esc(through)}</div></div>
          ${intro?`<p style="margin-top:18px;white-space:pre-wrap">${esc(intro)}</p>`:''}
          <h4>${L('Masses','القداديس')}</h4>${masses.map(m=>`<div class="listrow"><span class="mono">${esc(m.d)} · ${esc(m.t)}</span><span>${esc(L(m.title,m.titleAr))}</span></div>`).join('')||`<p>${L('No Masses scheduled this week.','لا قداديس مجدولة هذا الأسبوع.')}</p>`}
          ${intentions.length?`<h4>${L('Mass intentions','نوايا القداديس')}</h4>${intentions.map(text=>`<div class="listrow">${esc(text)}</div>`).join('')}`:''}
          <h4>${L('Parish notices','إعلانات الرعية')}</h4>${notices.map(n=>`<div class="listrow">${esc(L(n.title,n.ar))}</div>`).join('')||`<p>${L('No parish notices this week.','لا إعلانات للرعية هذا الأسبوع.')}</p>`}`;
      };
      el.querySelectorAll('#bulletin-en,#bulletin-ar,#intentions-en,#intentions-ar').forEach(input=>input.addEventListener('input',render));render();
      el.querySelectorAll('.a4bar button').forEach((b, i) => b.addEventListener('click', () => page.classList.toggle('phone', i === 1)));
      el.querySelector('#bulletin-save').addEventListener('click',async()=>{
        CONTENT.bulletin={en:el.querySelector('#bulletin-en').value.trim(),ar:el.querySelector('#bulletin-ar').value.trim(),published:false};
        CONTENT.intentions={en:el.querySelector('#intentions-en').value.trim(),ar:el.querySelector('#intentions-ar').value.trim(),published:false};
        if(!await persist())return;toast(L('Bulletin content saved','حُفظ محتوى النشرة'),'','success');
      });
      el.querySelector('#bulletin-print').addEventListener('click',()=>printSheet({title:L('Weekly bulletin','النشرة الأسبوعية'),body:page.innerHTML,margin:'12mm'}));
    }
  }));
};

/* ═══════════ 13 · music ═══════════ */
const LANG_AR = { Arabic: 'عربي', Syriac: 'سرياني', English: 'إنكليزي', French: 'فرنسي', 'Roman liturgical': 'طقسي روماني' };
const PART_AR = { Entrance: 'الدخول', Trisagion: 'التقديسات', Offertory: 'التقدمة', Communion: 'المناولة', Veneration: 'السجود للصليب', Recessional: 'الختام' };

export function music(id, tab = '') {
  if (id) return hymn(id, tab);
  const f = S.ui.music || {};
  const shown = MUSIC.filter(m => (!f.occ || m.occasion === f.occ) && (!f.part || m.part === f.part) && (!f.lang || m.lang === f.lang));
  const choice = (key, all, allAr, values) => `<select class="select" style="width:auto" data-mfilter="${key}" aria-label="${esc(L(all, allAr))}">
      <option value="">${esc(L(all, allAr))}</option>${values.map(([v, en, ar]) => `<option value="${esc(v)}" ${f[key] === v ? 'selected' : ''}>${esc(L(en, ar))}</option>`).join('')}</select>`;
  const uniq = pick => [...new Map(MUSIC.map(m => pick(m)).filter(x => x[0]).map(x => [x[0], x])).values()].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = shown.map(m => ({ cls: 'clickable', attrs: `data-hymn="${m.id}" data-find-item`, cells: [
    `<b style="font:500 14px/20px var(--sans)">${esc(m.title)}</b>
     <small class="t-caption dim" style="display:block;font-family:var(--arabic)">${esc(m.ar)}</small>`,
    `<span class="dim">${esc(L(m.occasion, m.occasionAr))}</span>`,
    `<span class="dim">${esc(L(m.part, PART_AR[m.part] || m.part))}</span>`,
    `<span class="mono">${esc(m.key)}</span>`,
    `<span class="chip">${esc(L(m.lang, LANG_AR[m.lang] || m.lang))}</span>`,
    `<span class="row" style="gap:6px">${musicInfo(m).lyrics?.length||musicInfo(m).chords?icon('doc',17,'dimmer'):''}${m.youtubeUrl||m.anghamiUrl||m.otherUrl?icon('music',17,'dimmer'):''}</span>`,
    `<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-secondary btn-dense" data-act="to-service:${m.id}">${L('Add to service', 'أضف إلى الخدمة')}</button>${CR.recBtn('hymn', m.id)}</span>`
  ]}));

  return `${pageHead({
      crumbs: [{ label: L('Communicate', 'التواصل') }, { label: L('Music library', 'مكتبة الألحان') }],
      title: L('Music and worship resources', 'الألحان وموارد العبادة'),
      sub: L('Catalogued by title, language, composer, occasion, Mass part, feast and season, with the key, the arrangement and the instrument notes attached.',
             'مفهرسة بالعنوان واللغة والملحّن والمناسبة وجزء القدّاس والعيد والزمن، مع المقام والتوزيع وملاحظات الآلات.'),
      actions: `<button class="btn btn-secondary" id="setlist">${icon('doc', 17)}${L('Setlists', 'لوائح الألحان')}</button>
        <button class="btn btn-primary" data-act="hymn-new">${icon('plus', 17)}${L('Add hymn', 'إضافة لحن')}</button>`
    })}
    <div class="toolbar" style="margin-bottom:16px">
      <div class="grow" style="max-width:320px">${C.searchClear(L('Title, occasion or first line', 'العنوان أو المناسبة أو المطلع'), 'msearch', 'data-find')}</div>
      ${choice('occ', 'All occasions', 'كل المناسبات', uniq(m => [m.occasion, m.occasion, m.occasionAr]))}
      ${choice('part', 'All Mass parts', 'كل أجزاء القدّاس', uniq(m => [m.part, m.part, PART_AR[m.part] || m.part]))}
      ${choice('lang', 'All languages', 'كل اللغات', uniq(m => [m.lang, m.lang, LANG_AR[m.lang] || m.lang]))}
      ${f.occ || f.part || f.lang ? `<button class="btn btn-ghost btn-dense" data-act="music-clear">${L('Clear filters', 'مسح المرشّحات')}</button>` : ''}
    </div>
    ${table({
      cols: [{ label: L('Hymn', 'اللحن'), sort: true }, { label: L('Occasion', 'المناسبة'), cls: 'hide-sm', sort: true },
             { label: L('Mass part', 'جزء القدّاس'), cls: 'hide-md' }, { label: L('Key', 'المقام'), cls: 'shrink' },
             { label: L('Language', 'اللغة'), cls: 'shrink hide-md' }, { label: L('Files', 'الملفات'), cls: 'shrink hide-sm' },
             { label: '', cls: 'shrink' }],
      rows,
      empty: empty('music', L('No hymn matches', 'لا لحن يطابق'), L('Try another occasion, part or language.', 'جرّب مناسبة أو جزءاً أو لغة أخرى.'),
        `<button class="btn btn-secondary btn-dense" data-act="music-clear">${L('Clear filters', 'مسح المرشّحات')}</button>`)
    })}
    <div class="find-empty" hidden>${empty('search', L('No hymn matches', 'لا لحن يطابق'), L('Try part of the title or the occasion.', 'جرّب جزءاً من العنوان أو المناسبة.'))}</div>`;
}

/* Transposition moves every chord on a chord line by semitones; lyric lines are left alone. */
const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
const moveNote = (n, by) => { const i = NOTES_SHARP.indexOf(FLAT[n] || n); return i < 0 ? n : NOTES_SHARP[(i + by + 120) % 12]; };
const CHORD = /^([A-G][b#]?)(m|maj7|m7|7|sus2|sus4|dim|aug|add9)?(\/[A-G][b#]?)?$/;
function transpose(text, by) {
  if (!by) return text;
  return text.split('\n').map(line => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (!words.length || !words.every(w => CHORD.test(w))) return line;
    return line.replace(/[A-G][b#]?(?:maj7|m7|m|7|sus2|sus4|dim|aug|add9)?(?:\/[A-G][b#]?)?/g, c => {
      const [, root, rest = '', bass = ''] = c.match(CHORD);
      return moveNote(root, by) + rest + (bass ? '/' + moveNote(bass.slice(1), by) : '');
    });
  }).join('\n');
}
const transposeKey = (key, by) => { const m = String(key || '').match(/^([A-G][b#]?)(.*)$/); return m ? moveNote(m[1], by) + m[2] : key; };

const HTABS = () => [['', 'Lyrics', 'الكلمات'], ['chords', 'Chords', 'الأوتار'], ['notes', 'Instrument notes', 'ملاحظات الآلات'],
               ['versions', 'Versions', 'الإصدارات'], ['rights', 'Rights', 'الحقوق']];
const safeMusicLink = (value, host) => {
  try { const url=new URL(value);return url.protocol==='https:'&&(!host||url.hostname===host||url.hostname.endsWith(`.${host}`))?url.href:''; }
  catch { return ''; }
};

function hymn(id, tab) {
  const m = MUSIC.find(x => x.id === id);
  if (!m) return `${pageHead({ crumbs: [{ label: L('Music library', 'مكتبة الألحان'), href: '#/music' }], title: L('Hymn not found', 'اللحن غير موجود') })}
    ${empty('music', L('This hymn is no longer in the library', 'هذا اللحن لم يعد في المكتبة'), L('It may have been deleted.', 'ربما حُذف.'),
      `<a class="btn btn-primary btn-dense" href="#/music">${L('Music library', 'مكتبة الألحان')}</a>`)}`;
  const d = musicInfo(m), shift = (S.ui.transpose || {})[m.id] || 0;
  const musicLinks=[['YouTube',safeMusicLink(m.youtubeUrl,'youtube.com')||safeMusicLink(m.youtubeUrl,'youtu.be')],
    ['Anghami',safeMusicLink(m.anghamiUrl,'anghami.com')],['Other link',safeMusicLink(m.otherUrl,'')]].filter(([,url])=>url);
  const head = `<div class="pagehead"><div class="entityhead" style="width:100%"><div class="id">
      <nav class="crumbs"><a href="#/music">${L('Music library', 'مكتبة الألحان')}</a><span class="sep">/</span><span>${esc(m.title)}</span></nav>
      <h1 style="font:600 26px/34px var(--sans);letter-spacing:-.02em">${esc(m.title)}
        ${m.key ? `<span class="pill">${esc(m.key)}</span>` : ''}<span class="pill">${esc(L(m.lang, LANG_AR[m.lang] || m.lang))}</span></h1>
      <div class="meta" style="font-family:var(--arabic)">${[m.ar, L(m.occasion, m.occasionAr), L(m.part, PART_AR[m.part] || m.part)].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div class="acts">${musicLinks.length?`<button class="btn btn-secondary" data-act="play:${m.id}">${icon('play', 17)}${L('Listen online', 'استمع عبر الإنترنت')}</button>`:''}
        <button class="btn btn-secondary" data-hymn-print="${esc(m.id)}">${icon('print', 17)}${L('Print sheet', 'طباعة النوتة')}</button>
        <button class="btn btn-primary" data-act="to-service:${m.id}">${icon('plus', 17)}${L('Add to service', 'أضف إلى الخدمة')}</button></div>
    </div></div>${tabBar('music/' + m.id, HTABS(), tab)}`;

  const T = {
    '': () => `<div class="splitview">${panel(L('Lyrics', 'الكلمات'), `
      <table class="tbl" style="width:100%"><thead><tr><th>${L('Syriac', 'سرياني')}</th><th>${L('Arabic', 'عربي')}</th><th>${L('English', 'إنكليزي')}</th></tr></thead>
        <tbody>${d.lyrics.length ? '' : `<tr><td colspan="3" class="dim">${L('No lyrics entered yet.', 'لا كلمات بعد.')}</td></tr>`}${d.lyrics.map(r => `<tr><td style="font-size:16px">${esc(r[0])}</td>
          <td style="font-family:var(--arabic);font-size:16px">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table>`,
        { tight: true, more: `<button class="btn btn-ghost btn-dense" data-act="hymn-text:${m.id}|lyrics">${icon(d.lyrics.length ? 'edit' : 'plus', 15)}${d.lyrics.length ? L('Edit', 'تعديل') : L('Add lyrics', 'إضافة الكلمات')}</button>` })}
      <div class="sidecol">${musicLinks.length?panel(L('Listen online','استمع عبر الإنترنت'),musicLinks.map(([label,url])=>
        `<a class="btn btn-secondary btn-dense" href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="margin:4px">${esc(label)}</a>`).join('')):''}
      ${panel(L('Personal annotations', 'ملاحظات شخصية'),
        d.annotations.map(([p, en, ar]) => `<div class="listrow" style="padding-inline:0;align-items:flex-start">
          ${avatar(person(p), 'avatar-sm')}<span class="grow t-caption">${esc(L(en, ar))}</span></div>`).join('')
        + `<div class="divider"></div>${C.textarea({ label: L('Add your own', 'أضف ملاحظتك'), id: 'hann', max: 200 })}`)}
      </div></div>`,

    chords: () => `<div class="splitview">
      ${panel(L('Chord chart', 'جدول الأوتار') + (shift ? ` · ${shift > 0 ? '+' : ''}${shift}` : ''), d.chords ? `<pre class="mono" style="font-size:13px;line-height:24px;white-space:pre-wrap;margin:0">${esc(transpose(d.chords, shift))}</pre>` : `<p class="dim">${L('No chord chart yet.', 'لا جدول أوتار بعد.')}</p>`,
        { more: `<button class="btn btn-ghost btn-dense" data-act="hymn-text:${m.id}|chords">${icon(d.chords ? 'edit' : 'plus', 15)}${d.chords ? L('Edit', 'تعديل') : L('Add chords', 'إضافة الأوتار')}</button>` })}
      <div class="sidecol">${panel(L('Transpose', 'النقل'), `
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip">${esc(m.key || '—')}</span>${icon('arrowR', 16, 'dimmer')}
          <span class="chip chip-on">${esc(transposeKey(m.key, shift) || '—')}</span></div>
        <div class="presets" style="margin-top:12px">${[-2, -1, 0, 1, 2].map(n =>
          `<button aria-pressed="${n === shift}" data-act="transpose:${m.id}|${n}">${n > 0 ? '+' + n : n === 0 ? '0' : '−' + -n}</button>`).join('')}</div>
        ${C.inlineAlert('warning', L('A scanned PDF cannot be transposed', 'الـPDF الممسوح لا يُنقَل'),
          L('Structured chord text transposes cleanly. ParishLife says so rather than producing a wrong sheet.',
            'النصّ الوتري المنظَّم يُنقَل بلا مشاكل. ويقول «حياة الرعية» ذلك بدل إنتاج نوتة خاطئة.'))}`)}
      </div></div>`,

    notes: () => `<div style="max-width:760px">${panel(L('Instrument notes', 'ملاحظات الآلات'),
      d.notes.map(([inst, instAr, en, ar], ni) => `<div class="listrow" style="padding-inline:0;align-items:flex-start">
        <span class="chip" style="flex:none">${esc(L(inst, instAr))}</span>
        <span class="grow">${esc(L(en, ar))}</span>${C.iconBtn('edit', L('Edit', 'تعديل'), `data-act="inst-edit:${m.id}|${ni}"`)}</div>`).join('')
      || `<p class="dim" style="padding:18px;margin:0">${L('No instrument notes yet.', 'لا ملاحظات آلات بعد.')}</p>`, { tight: true })}
      </div>`,

    versions: () => `<div style="max-width:760px">${panel(L('Version history', 'سجل الإصدارات'), `
      ${d.versions.length ? '' : `<p class="dim" style="margin:0">${L('No earlier versions.', 'لا إصدارات سابقة.')}</p>`}<div class="timeline">${d.versions.map(([en, ar, when, by], i) => `<div class="tl-item ${i === 0 ? 'accent' : ''}">
        <div class="when">${fmtDate(when)} · ${esc(isAr() ? person(by).ar : person(by).lat)}</div>
        <div class="what">${esc(L(en, ar))}${i === 0 ? ` <span class="pill pill-success"><span class="dot"></span>${L('current', 'الحالي')}</span>` : ''}</div>
        ${i ? `<button class="btn btn-secondary btn-dense" style="margin-top:8px" data-act="hymn-restore:${m.id}|${i}">${L('Restore', 'استرجاع')}</button>` : ''}</div>`).join('')}</div>`)}</div>`,

    rights: () => `<div class="splitview">
      ${panel(L('Copyright and permitted uses', 'الحقوق والاستعمالات المسموحة'), `<dl class="dl">
        <dt>${L('Composer', 'الملحّن')}</dt><dd>${esc(L(d.composer, d.composerAr))}</dd>
        <dt>${L('Copyright', 'الحقوق')}</dt><dd>${esc(L(d.copyright, d.copyrightAr))}</dd>
        <dt>${L('Attribution', 'الإسناد')}</dt><dd>${L('Not required', 'غير مطلوب')}</dd></dl>
        <div class="divider"></div>
        <div class="row" style="gap:8px;flex-wrap:wrap">${d.uses.map(u => `<span class="chip chip-on">${icon('check', 13)} ${esc(u)}</span>`).join('')}
          <span class="chip">${L('Sell', 'بيع')}</span></div>`)}
      <div class="sidecol">${panel(L('Instrument tuning', 'دوزان الآلات'), `
        <p class="t-body dim" style="font-size:14px;line-height:22px">${L(
          'A built-in tuner is deliberately not part of ParishLife. Choirs already use a phone app for it, and building one would take time away from the library, the setlists and the service plans that only a parish system can do.',
          'الدوزان المدمج ليس جزءاً من «حياة الرعية» عن قصد. الجوقات تستعمل تطبيقاً على الهاتف أصلاً، وبناء واحد يأخذ وقتاً من المكتبة واللوائح وخطط الخدمة التي لا يقوم بها سوى نظام الرعية.')}</p>
        <span class="pill">${L('Deferred — external tool', 'مؤجَّل — أداة خارجية')}</span>`)}
      ${panel(L('Offline copies', 'نسخ للعمل بلا إنترنت'), `
        <p class="t-body dim" style="font-size:14px">${L(
          'Downloadable and offline copies are offered only where the licence allows it. Where it does not, the item can still be projected but not distributed.',
          'النسخ القابلة للتنزيل والعمل بلا إنترنت تُتاح فقط حيث يسمح الترخيص. وحيث لا يسمح يبقى العرض ممكناً لا التوزيع.')}</p>
        ${C.switchRow(L('Allow choir members to download', 'السماح لأعضاء الجوقة بالتنزيل'), { checked: true, pref: 'music.download' })}`)}
      </div></div>`
  };
  return head + (T[tab] || T[''])();
}

music.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('[data-hymn-print]')?.addEventListener('click',e=>{
    const m=MUSIC.find(item=>item.id===e.currentTarget.dataset.hymnPrint);if(!m)return;
    const detail=musicInfo(m),hasLyrics=!!detail.lyrics?.length,hasChords=!!detail.chords;
    if(!hasLyrics&&!hasChords)return toast(L('No lyrics or chords to print','لا كلمات أو أوتار للطباعة'),'','warning');
    openModal({title:L('Print hymn sheet','طباعة ورقة اللحن'),body:`<p>${esc(L(m.title,m.ar))}</p><div class="formrow"><label class="label" for="hymn-print-choice">${L('Include','تضمين')}</label><select class="select" id="hymn-print-choice">
      ${hasLyrics?`<option value="lyrics">${L('Lyrics','الكلمات')}</option>`:''}${hasChords?`<option value="chords">${L('Chords','الأوتار')}</option>`:''}${hasLyrics&&hasChords?`<option value="both">${L('Lyrics and chords','الكلمات والأوتار')}</option>`:''}</select></div>`,
      foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="hymn-print-go">${L('Print','طباعة')}</button>`,
      onMount(el){el.querySelector('#hymn-print-go').addEventListener('click',()=>{
        const choice=el.querySelector('#hymn-print-choice').value,lyrics=detail.lyrics.map(row=>row.filter(Boolean).map(esc).join(' · ')).join('<br>');
        const body=`<h1>${esc(L(m.title,m.ar))}</h1>${choice!=='chords'?`<section><h2>${L('Lyrics','الكلمات')}</h2><p>${lyrics}</p></section>`:''}${choice!=='lyrics'?`<section><h2>${L('Chords','الأوتار')}</h2><pre>${esc(detail.chords)}</pre></section>`:''}`;
        printSheet({title:L(m.title,m.ar),body,margin:'15mm'});
      });}});
  });
  host.querySelectorAll('[data-mfilter]').forEach(sel => sel.addEventListener('change', () => {
    S.ui.music = { ...(S.ui.music || {}), [sel.dataset.mfilter]: sel.value }; bus.refresh();
  }));
  host.querySelectorAll('[data-hymn]').forEach(tr => tr.addEventListener('click', e => {
    if (e.target.closest('button,a,input')) return;
    location.hash = '#/music/' + tr.dataset.hymn;
  }));
  host.querySelector('#setlist')?.addEventListener('click', () => openDrawer({
    title: L('Setlists', 'لوائح الألحان'),
    sub: L('A setlist links to a service plan, so the order of service and the choir folder never drift apart.',
           'ترتبط اللائحة بخطة الخدمة، فلا يفترق ترتيب الخدمة عن ملف الجوقة.'),
    body: SETLISTS.map(s => `<div class="listrow"><span class="grow"><b>${esc(L(s.name, s.ar))}</b>
        <small>${s.items.length} ${L('hymns', 'ألحان')}${s.service ? ` · ${L('linked to a service', 'مرتبطة بخدمة')}` : ''}</small></span>
      <button class="btn btn-secondary btn-dense" data-act="setlist-open:${s.id}">${L('Open', 'فتح')}</button>${CR.recBtn('setlist', s.id)}</div>`).join('')
      || empty('music', L('No setlists yet', 'لا لوائح بعد'), L('Put hymns in order for a Mass or a feast.', 'رتّب الألحان لقدّاس أو عيد.')),
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-primary" data-act="setlist-new" style="margin-inline-start:auto">${L('New setlist', 'لائحة جديدة')}</button>`
  }));
};

/* ═══════════ 14 · portal ═══════════ */
const portalSections=[
  ['welcome','Welcome message','رسالة الترحيب','Introduce your parish in a few welcoming words.','عرّف برعيتك بكلمات ترحيبية موجزة.'],
  ['history','History & patron saint','التاريخ والشفيع','Share the story and identity of your parish.','شارك تاريخ رعيتك وهويتها.'],
  ['massTimes','Mass & confession','القداديس والاعتراف','Help visitors plan their next visit.','ساعد الزوّار على التخطيط لزيارتهم المقبلة.'],
  ['contact','Contact & visiting','التواصل والزيارة','Make it easy to find and contact the parish.','سهّل الوصول إلى الرعية والتواصل معها.']
];
function portalContent(){
  const hasText=c=>!!(c.en?.trim()||c.ar?.trim());
  const published=portalSections.filter(([key])=>{const c=CONTENT[key]||{};return hasText(c)&&c.published!==false;}).length;
  const drafts=portalSections.filter(([key])=>{const c=CONTENT[key]||{};return hasText(c)&&c.published===false;}).length;
  return `<div class="cms-content">
    <section class="cms-overview" aria-labelledby="cms-overview-title">
      <div class="cms-overview-copy"><span class="cms-eyebrow">${L('Your public presence','حضورك العام')}</span>
        <h2 id="cms-overview-title">${esc(L(PARISH.name,PARISH.nameAr))}</h2>
        <p>${L('A welcoming first visit starts here. Keep your parish story, service times and visiting details easy to find.','تبدأ الزيارة الأولى هنا. اجعل تاريخ رعيتك ومواعيد الخدمات ومعلومات الزيارة سهلة الوصول.')}</p>
      </div>
      <dl class="cms-summary"><div><dt>${L('Published','منشور')}</dt><dd>${num(published)}</dd></div><div><dt>${L('Drafts','مسودات')}</dt><dd>${num(drafts)}</dd></div><div><dt>${L('Empty','فارغ')}</dt><dd>${num(portalSections.length-published-drafts)}</dd></div></dl>
    </section>
    <div class="cms-section-heading"><div><span class="cms-eyebrow">${L('01 / Website content','01 / محتوى الموقع')}</span><h2>${L('Make every section feel welcoming.','اجعل كل قسم يرحّب بالزوّار.')}</h2></div>
      <p>${L('Edit in English and Arabic. Only published sections are visible to visitors.','حرّر بالإنكليزية والعربية. يرى الزوّار الأقسام المنشورة فقط.')}</p></div>
    <div class="cms-section-grid">${portalSections.map(([key,en,ar,desc,descAr],index)=>{
      const c=CONTENT[key]||{},filled=hasText(c),state=!filled?'empty':c.published===false?'draft':'published';
      const preview=L(c.en||'',c.ar||'')||c.en||c.ar||'';
      return `<article class="cms-section-card" aria-labelledby="cms-${key}-title">
        <div class="cms-card-top"><span class="cms-section-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="cms-state cms-state-${state}"><span aria-hidden="true"></span>${state==='published'?L('Published','منشور'):state==='draft'?L('Draft · private','مسودة · خاصة'):L('Not started','لم يبدأ بعد')}</span></div>
        <h3 id="cms-${key}-title">${L(en,ar)}</h3><p class="cms-card-description">${L(desc,descAr)}</p>
        <p class="cms-content-preview${filled?'':' cms-content-empty'}" dir="auto">${esc(preview||L('Add this section to welcome visitors to your parish.','أضف هذا القسم للترحيب بزوّار رعيتك.'))}</p>
        <div class="cms-card-footer"><div class="cms-languages" aria-label="${L('Content languages','لغات المحتوى')}"><span class="${c.en?.trim()?'is-ready':''}" title="${c.en?.trim()?L('English content ready','المحتوى الإنكليزي جاهز'):L('English content missing','المحتوى الإنكليزي غير مضاف')}">${icon(c.en?.trim()?'check':'plus',12)}English</span><span class="${c.ar?.trim()?'is-ready':''}" lang="ar" title="${c.ar?.trim()?L('Arabic content ready','المحتوى العربي جاهز'):L('Arabic content missing','المحتوى العربي غير مضاف')}">${icon(c.ar?.trim()?'check':'plus',12)}العربية</span></div>
          <button class="cms-edit" data-act="content-edit:${key}" aria-label="${esc(L('Edit '+en,'تعديل '+ar))}">${filled?L('Edit section','تعديل القسم'):L('Add content','إضافة محتوى')}${icon('arrowR',16)}</button></div>
      </article>`;
    }).join('')}</div>
    <aside class="cms-publishing-note">${icon('info',18)}<p>${L('Save a draft while you work. A draft section stays off the public page until you publish it. Add both languages before publishing.','احفظ مسودة أثناء العمل. يبقى القسم المسودة خارج الصفحة العامة حتى تنشره. أضف اللغتين قبل النشر.')}</p></aside>
    <section class="cms-related" aria-labelledby="cms-related-title"><div><span class="cms-eyebrow">${L('02 / Parish updates','02 / مستجدات الرعية')}</span><h2 id="cms-related-title">${L('Keep your community up to date.','أبقِ جماعتك على اطّلاع.')}</h2><p>${L('Public events and announcements are managed in their own spaces.','تُدار الأحداث العامة والإعلانات في أقسامها الخاصة.')}</p></div>
      <div class="cms-related-links"><a href="#/calendar">${icon('events',21)}<span><strong>${L('Public calendar','الرزنامة العامة')}</strong><small>${L('Service times and upcoming events','مواعيد الخدمات والأحداث المقبلة')}</small></span>${icon('arrowR',18)}</a>
      <a href="#/memberhub">${icon('bell',21)}<span><strong>${L('Announcements','الإعلانات')}</strong><small>${L('News and updates for your community','أخبار ومستجدات جماعتك')}</small></span>${icon('arrowR',18)}</a></div>
    </section>
  </div>`;
}
const PTABS = () => [['', 'Website content', 'محتوى الموقع'], ['requests', 'Self-service', 'الخدمة الذاتية', PORTAL_REQUESTS.length],
               ['prayers', 'Prayer requests', 'نوايا الصلاة', PRAYERS.filter(p => p.status === 'awaiting-approval').length]];

export function portal(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Communicate', 'التواصل') }, { label: L('Member portal', 'بوّابة المؤمنين') }],
    title: tab ? L('Parish content and member portal', 'محتوى الرعية وبوّابة المؤمنين') : L('Your parish website', 'موقع رعيتك'),
    sub: L('A clear, welcoming place for parish life. Manage your public content and member requests.',
           'مساحة واضحة ومرحّبة لحياة الرعية. أدر المحتوى العام وطلبات الأعضاء.'),
    actions: `<button class="btn btn-secondary" data-act="portal-open">${icon('link', 17)}${L('View public page', 'عرض الصفحة العامة')}</button>
      <button class="btn btn-primary" data-act="content-edit:welcome">${icon('edit', 17)}${L('Edit welcome', 'تعديل الترحيب')}</button>`
  }) + tabBar('portal', PTABS(), tab);

  if (tab === 'requests') return head + `<div style="margin-top:20px" class="splitview">
    ${panel(L('Waiting for review', 'بانتظار المراجعة'), PORTAL_REQUESTS.length ? `
      ${PORTAL_REQUESTS.map(r => `<div class="listrow" style="padding-inline:0"><span class="grow"><b>${esc(L(r.what, r.whatAr))}</b>
          <small>${L('submitted', 'قُدّم')} ${fmtDate(r.at)}</small></span>
          <button class="btn btn-secondary btn-dense" data-act="portal-compare:${r.id}">${L('Compare', 'مقارنة')}</button>
          <button class="btn btn-primary btn-dense" data-act="portal-accept:${r.id}">${L('Accept', 'قبول')}</button></div>`).join('')}
      <p class="t-caption dim" style="margin-top:12px">${L(
        'Nothing a member submits lands in the record directly. The office reviews every change first.',
        'لا شيء يقدّمه المؤمن يدخل السجل مباشرة. يراجع المكتب كل تعديل أولاً.')}</p>`
      : empty('check', L('Nothing waiting', 'لا شيء بالانتظار'), L('Changes members submit from the portal appear here for review.', 'التعديلات التي يرسلها المؤمنون من البوّابة تظهر هنا للمراجعة.')),
      { tight: false })}
    <div class="sidecol">${panel(L('What a member can do', 'ما يستطيع المؤمن فعله'), `
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px">
        ${[[L('Update their own address, phone and family members', 'تحديث عنوانه وهاتفه وأفراد عائلته'), 'edit'],
           [L('Manage family registrations where authorised', 'إدارة تسجيلات العائلة حيث يُصرَّح له'), 'family'],
           [L('Request a certificate', 'طلب شهادة'), 'doc'],
           [L('See their own giving statement', 'الاطّلاع على كشف تقدماته'), 'give'],
           [L('Discover groups and request membership', 'اكتشاف المجموعات وطلب الانتساب'), 'groups'],
           [L('See their volunteer schedule and registrations', 'رؤية مناوباته وتسجيلاته'), 'vol'],
           [L('Set their own notification preferences', 'ضبط تفضيلات إشعاراته'), 'bell']]
          .map(([x, i]) => `<li class="row" style="gap:10px;align-items:flex-start">${icon(i, 17, 'dimmer')}<span class="t-caption">${esc(x)}</span></li>`).join('')}</ul>
      <div class="divider"></div>
      <p class="t-caption dim">${L('A member never reaches anyone else’s record, and directory visibility is opt-in per person.',
        'لا يصل المؤمن إلى سجل أحد آخر، وظهوره في الدليل اختياري لكل شخص.')}</p>`)}</div></div>`;

  if (tab === 'prayers') return head + `<div class="tabbody">
    ${C.inlineAlert('info', L('A clear handling policy', 'سياسة معالجة واضحة'),
      L('A private request is seen by the priest only and never published. A request offered for the public list is moderated before it appears.',
        'النيّة الخاصة يراها الكاهن وحده ولا تُنشر أبداً. والنيّة المعروضة للائحة العامة تُراجَع قبل ظهورها.'))}
    <div style="margin-top:16px">${table({
      cols: [{ label: L('From', 'من') }, { label: L('Intention', 'النيّة') }, { label: L('Visibility', 'الظهور'), cls: 'shrink' },
             { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: PRAYERS.map(p => ({ cells: [
        p.by ? who(person(p.by)) : `<span class="dim">${L('Anonymous', 'مجهول')}</span>`,
        esc(L(p.body, p.bodyAr)),
        p.vis === 'private' ? pill(L('Private', 'خاصة'), 'info', 'lock') : pill(L('For the public list', 'للائحة العامة')),
        p.status === 'private' ? pill(L('Priest only', 'للكاهن فقط'), 'info', 'lock') : status(p.status),
        `<span class="row" style="gap:6px;justify-content:flex-end">${p.status === 'awaiting-approval'
          ? `<button class="btn btn-primary btn-dense" data-act="prayer-publish:${p.id}">${L('Publish', 'نشر')}</button>` : ''}${CR.recBtn('prayer', p.id)}</span>`]})),
      empty: empty('notes', L('No prayer requests', 'لا طلبات صلاة'), L('Requests members send from the portal appear here for moderation.', 'الطلبات المرسلة من البوّابة تظهر هنا للمراجعة.'))
    })}</div></div>`;

  return `<div class="cms-page">${head}${portalContent()}</div>`;
}
portal.mount = host => { C.wire(host); wireTables(host); };
