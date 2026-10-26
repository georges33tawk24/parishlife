import { api, session } from '../api.js';
import { t, fmtDate } from '../i18n.js';
import { esc, pageHead, openDrawer, closeOverlays, toast } from '../ui.js';
import { paginateCollections } from '../collection-ui.js';

const filters = { box: 'received', query: '', parish: '' };
const L = t;
const option = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;

export function inboxPage() {
  return pageHead({ title: L('Inbox', 'البريد'), sub: L('Private conversations with your parish community.', 'محادثات خاصة مع مجتمع رعيتك.') }) + '<div data-inbox aria-live="polite"></div>';
}

inboxPage.mount = async host => {
  const container = host.querySelector('[data-inbox]');
  container.textContent = L('Loading messages…', 'جارٍ تحميل الرسائل…');
  try {
    const data = await api('inbox');
    if (!container.isConnected) return;
    const refresh = () => inboxPage.mount(host);
    const parishes = new Map(data.recipients.map(r => [r.parish, r.parishName]));
    for (const p of session.parishes || []) parishes.set(p.id, p.name);
    container.innerHTML = `<div class="collection-toolbar">
      <label class="sr-only" for="inbox-search">${L('Search messages', 'ابحث في الرسائل')}</label><input class="input" id="inbox-search" type="search" placeholder="${L('Search messages', 'ابحث في الرسائل')}" value="${esc(filters.query)}">
      <select class="select" data-box aria-label="${L('Folder', 'المجلّد')}">${[['received',L('Received','الواردة')],['sent',L('Sent','المرسلة')],['archived',L('Archived','المؤرشفة')]].map(([v,s])=>option(v,s)).join('')}</select>
      <select class="select" data-parish aria-label="${L('Parish', 'الرعية')}">${option('',L('All parishes','كل الرعايا'))}${[...parishes].map(([v,s])=>option(v,s)).join('')}</select>
      <button class="btn btn-primary" data-compose ${data.recipients.length?'':'disabled'}>${L('New message','رسالة جديدة')}</button></div>
      ${!data.recipients.length?`<p class="help">${L('Follow a parish in Complete Profile to contact its office.','تابع رعية في إكمال الملف للتواصل مع مكتبها.')}</p>`:''}<div data-messages></div>`;
    const list = container.querySelector('[data-messages]');
    const render = () => {
      const rows = data.messages.filter(m => (filters.box === 'archived' ? !!m.archived : !m.archived && (filters.box === 'sent' ? m.author_id === session.user.id : m.recipient_id === session.user.id)) && (!filters.parish || m.parish_id === filters.parish) && [m.title,m.body,m.author_name,m.recipient_name].join(' ').toLowerCase().includes(filters.query.toLowerCase().trim()));
      list.innerHTML = `<p class="help">${rows.length} ${L('messages','رسائل')}</p><div class="inbox-grid" data-paginate>${rows.map(m=>`<article class="inbox-card ${!m.is_read&&m.recipient_id===session.user.id?'inbox-unread':''}"><div class="account-actions"><small>${esc(parishes.get(m.parish_id)||m.parish_id)}</small>${!m.is_read&&m.recipient_id===session.user.id?`<span class="pill">${L('Unread','غير مقروءة')}</span>`:''}</div><h2><button class="inbox-title" data-open="${esc(m.id)}">${esc(m.title)}</button></h2><p>${esc(m.author_id===session.user.id?L('To: ','إلى: ')+m.recipient_name:m.author_name)}</p><p class="inbox-preview">${esc(m.body)}</p><small>${esc(fmtDate(m.created_at.slice(0,10)))}</small><div class="account-actions"><button class="btn btn-ghost btn-dense" data-state="${esc(m.id)}" data-action="${m.is_read?'unread':'read'}">${m.is_read?L('Mark unread','تحديد كغير مقروءة'):L('Mark read','تحديد كمقروءة')}</button><button class="btn btn-ghost btn-dense" data-state="${esc(m.id)}" data-action="${m.archived?'unarchive':'archive'}">${m.archived?L('Restore','استعادة'):L('Archive','أرشفة')}</button></div></article>`).join('')}</div>${rows.length?'':`<p class="member-empty">${L('No messages match these filters.','لا رسائل تطابق هذه الفلاتر.')}</p>`}`;
      list.querySelectorAll('[data-state]').forEach(b => b.onclick = async () => { b.disabled=true; try { await api('inbox','POST',{action:b.dataset.action,id:b.dataset.state}); await refresh(); } catch(e){toast(e.message,'','danger');b.disabled=false;} });
      list.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => {
        const m=data.messages.find(x=>x.id===b.dataset.open);
        openDrawer({title:m.title,body:`<p>${esc(m.author_name)} → ${esc(m.recipient_name)}</p><div class="message-body">${esc(m.body)}</div><p class="help">${L('Message reference','مرجع الرسالة')}: ${esc(m.id)}</p>${m.recipient_id===session.user.id?`<button class="btn btn-primary" data-reply>${L('Reply','رد')}</button>`:''}`,onMount(el){el.querySelector('[data-reply]')?.addEventListener('click',()=>compose(data.recipients,refresh,m));}});
        try{await api('inbox','POST',{action:'read',id:m.id});m.is_read=1;render();}catch(e){toast(e.message,'','danger');}
      });
      paginateCollections(list);
    };
    container.querySelector('[data-box]').value=filters.box;
    container.querySelector('[data-parish]').value=filters.parish;
    container.querySelector('#inbox-search').oninput=e=>{filters.query=e.target.value;render();};
    container.querySelector('[data-box]').onchange=e=>{filters.box=e.target.value;render();};
    container.querySelector('[data-parish]').onchange=e=>{filters.parish=e.target.value;render();};
    container.querySelector('[data-compose]').onclick=()=>compose(data.recipients,refresh);
    render();
  } catch(e) { if(container.isConnected)container.textContent=e.message; }
};

function compose(recipients, refresh, reply=null) {
  openDrawer({title:reply?L('Reply','رد'):L('New message','رسالة جديدة'),body:`<form data-compose-form>${reply?`<p>${esc(reply.author_name)} · ${esc(reply.title)}</p>`:`<label class="formrow"><span class="label">${L('Recipient','المستلم')}</span><select class="select" name="target" required><option value="">${L('Choose a recipient','اختر المستلم')}</option>${recipients.map((r,i)=>option(String(i),`${r.name} · ${r.parishName}`)).join('')}</select></label><label class="formrow"><span class="label">${L('Subject','الموضوع')}</span><input class="input" name="title" required maxlength="160"></label>`}<label class="formrow"><span class="label">${L('Message','الرسالة')}</span><textarea class="textarea" name="body" required maxlength="5000" rows="8"></textarea></label><p class="help-error" role="alert"></p><button class="btn btn-primary">${L('Send message','إرسال الرسالة')}</button></form>`,onMount(el){const form=el.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const q=Object.fromEntries(new FormData(form)),button=form.querySelector('button');button.disabled=true;try{const target=recipients[Number(q.target)];await api('inbox','POST',reply?{action:'reply',id:reply.id,body:q.body}:{action:'send',parish:target.parish,recipient:target.id,title:q.title,body:q.body});closeOverlays();await refresh();toast(L('Message sent','أُرسلت الرسالة'),'','success');}catch(err){form.querySelector('[role=alert]').textContent=err.message;button.disabled=false;}};}});
}
