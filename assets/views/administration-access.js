/* The server supplies assignable roles; the browser never invents authority. */
import { api, session } from '../api.js';
import { t, isAr } from '../i18n.js';
import { esc, panel, openDrawer, closeOverlays, toast } from '../ui.js';

let selectedScope = '';
const administrativeLabels = {
  super_admin: ['Super Admin', 'المشرف العام'],
  diocesan_admin: ['Archdiocese Admin', 'مدير الأبرشية'],
  parish_admin: ['Parish Admin', 'مدير الرعية'],
  priest: ['Parish priest', 'كاهن الرعية'],
  secretary: ['Secretary', 'أمين السر'],
  treasurer: ['Treasurer', 'أمين الصندوق'],
  leader: ['Ministry leader', 'مسؤول الخدمة'],
  finance_view: ['Finance viewer', 'مشاهد المالية'],
  clergy_assigner: ['Delegated clergy appointments', 'تفويض تعيين الكهنة']
};
const label = role => administrativeLabels[role] ? t(...administrativeLabels[role]) : role;
const option = (value, text, selected = false) => `<option value="${esc(value)}" ${selected ? 'selected' : ''}>${esc(text)}</option>`;
const field = (name, title, type = 'text', extra = '') => `<label class="formrow"><span class="label">${title}</span><input class="input" name="${name}" type="${type}" required ${extra}></label>`;

function editForm(title, content, save, complete) {
  openDrawer({ title, body: `<form data-access-form>${content}<p class="help-error" role="alert"></p><button type="submit" class="btn btn-primary">${t('Save changes', 'حفظ التغييرات')}</button></form>`,
    onMount(container) {
      const form = container.querySelector('[data-access-form]');
      form.onsubmit = async event => {
        event.preventDefault();
        const button = form.querySelector('[type=submit]'), error = form.querySelector('[role=alert]');
        button.disabled = true;
        error.textContent = '';
        try {
          await save(Object.fromEntries(new FormData(form)), form);
          closeOverlays();
          await complete();
          toast(t('Access updated', 'تم تحديث الصلاحيات'), '', 'success');
        } catch (failure) {
          error.textContent = failure.message;
          button.disabled = false;
        }
      };
    }
  });
}

export async function mountAccessManagement(host, workspace, parishId, refreshSession, parishPeople = []) {
  const scopes = [
    ...(workspace.isSuperAdmin ? [{ key: 'global:*', scopeType: 'global', name: t('Entire system', 'النظام كاملاً') }] : []),
    ...workspace.dioceses.filter(diocese => ['super_admin', 'bishop', 'diocesan_admin'].includes(diocese.authority))
      .map(diocese => ({ key: 'diocese:' + diocese.id, scopeType: 'diocese', diocese: diocese.id, name: t('Archdiocese', 'الأبرشية') + ' · ' + diocese.name })),
    ...workspace.parishes.map(parish => ({ key: 'parish:' + parish.id, scopeType: 'parish', parish: parish.id, name: t('Parish', 'الرعية') + ' · ' + (isAr()?parish.metadata.ar||parish.metadata.name:parish.metadata.name) }))
  ];
  if (!scopes.length) {
    host.textContent = t('No administrative scope is assigned to this account.', 'لا يوجد نطاق إداري معيّن لهذا الحساب.');
    return;
  }
  if (!scopes.some(scope => scope.key === selectedScope)) selectedScope = scopes.find(scope => scope.parish === parishId)?.key || scopes[0].key;
  const scope = scopes.find(item => item.key === selectedScope);
  const query = new URLSearchParams(Object.entries(scope).filter(([key]) => ['scopeType', 'parish', 'diocese'].includes(key)));
  host.innerHTML = `<p role="status">${t('Loading access management…', 'جارٍ تحميل إدارة الصلاحيات…')}</p>`;
  try {
    const [data, selectedParishPeople] = await Promise.all([
      api('workspace/administration?' + query),
      scope.scopeType === 'parish' && scope.parish !== parishId ? api('workspace/people?parish='+encodeURIComponent(scope.parish)) : Promise.resolve({people:parishPeople})
    ]);
    parishPeople=selectedParishPeople.people;
    if (!host.isConnected) return;
    const activeGrants = data.grants.filter(grant => grant.active);
    const secretaries = activeGrants.filter(grant => grant.role === 'secretary');
    const canAssign = data.assignableRoles.length > 0;
    const complete = async () => { await refreshSession(); };
    const refresh = () => mountAccessManagement(host, workspace, parishId, refreshSession, parishPeople);
    const systemAccountCard=user=>`<article><div><b>${esc(user.name)}</b><p>${esc(user.username)} · ${user.inactive?t('Inactive','غير نشط'):t('Active','نشط')}</p></div>${user.id!==session.user.id?`<div class="account-actions"><button type="button" class="btn btn-secondary" data-global-suspend="${esc(user.id)}">${user.inactive?t('Reactivate account','إعادة تفعيل الحساب'):t('Deactivate account','تعطيل الحساب')}</button><button type="button" class="btn btn-secondary" data-global-password="${esc(user.id)}">${t('Recover password','استعادة كلمة المرور')}</button></div>`:''}</article>`;
    host.innerHTML = panel(t('Administrative access', 'الصلاحيات الإدارية'), `
      <label class="formrow"><span class="label">${t('Management scope', 'نطاق الإدارة')}</span><select class="select" data-access-scope>${scopes.map(item => option(item.key, item.name, item.key === selectedScope)).join('')}</select></label>
      <p class="help">${t('Assignments apply only to the scope shown. Administrative roles do not grant clergy status. Each person uses their own account.', 'تُطبّق التعيينات ضمن النطاق الظاهر فقط. لا تمنح الأدوار الإدارية صفة كهنوتية. يستخدم كل شخص حسابه الخاص.')}</p>
      <div class="account-actions">${canAssign ? `<button type="button" class="btn btn-primary" data-access-assign>${t('Assign access', 'تعيين صلاحية')}</button>` : ''}<button type="button" class="btn btn-secondary" data-access-history>${t('Administrative history', 'سجل الإدارة')}</button>${data.nextUserCursor?`<button type="button" class="btn btn-secondary" data-access-more-users>${t('Load more accounts for assignment','تحميل المزيد من الحسابات للتعيين')}</button>`:''}</div>
      ${scope.scopeType === 'parish' ? `<div class="card card-flat"><h3>${t('Secretary · optional', 'أمين السر · اختياري')}</h3><p>${secretaries.length ? secretaries.map(secretary => esc(secretary.name)).join('، ') : t('No secretary assigned. The priest and authorized administrators can handle parish office work.', 'لم يُعيّن أمين سر. يستطيع الكاهن والمديرون المخوّلون إنجاز أعمال مكتب الرعية.')}</p><button type="button" class="btn btn-secondary" data-access-secretaries>${t('Manage secretaries', 'إدارة أمناء السر')}</button></div>` : ''}
      <h3>${t('Active assignments', 'التعيينات النشطة')}</h3><div class="account-parishes">${activeGrants.map(grant => `<article><div><b>${esc(grant.name)}</b><p>${esc(label(grant.role))} · ${esc(scope.name)}</p></div>${grant.canManage ? `<button type="button" class="btn btn-secondary" data-access-revoke="${esc(grant.id)}">${t('Revoke access', 'سحب الصلاحية')}</button>` : ''}</article>`).join('') || `<p>${t('No explicit administrative assignments in this scope.', 'لا توجد تعيينات إدارية صريحة في هذا النطاق.')}</p>`}</div>
      <details><summary>${t('Previous assignments', 'التعيينات السابقة')}</summary><div class="account-parishes">${data.grants.filter(grant => !grant.active).map(grant => `<article><div><b>${esc(grant.name)}</b><p>${esc(label(grant.role))} · ${t('Revoked', 'مسحوبة')}</p></div></article>`).join('') || `<p>${t('No revoked assignments.', 'لا توجد تعيينات مسحوبة.')}</p>`}</div></details>
      ${scope.scopeType==='global'?`<h3>${t('System accounts','حسابات النظام')}</h3><div class="account-parishes" data-system-accounts>${data.users.map(systemAccountCard).join('')}</div>`:''}
      <div data-access-history-list aria-live="polite"></div>`);
    host.querySelector('[data-access-scope]').onchange = event => { selectedScope = event.target.value; refresh(); };
    host.querySelector('[data-access-more-users]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{
        const page=await api('workspace/administration?'+query+'&afterUser='+encodeURIComponent(data.nextUserCursor));
        data.users.push(...page.users);data.nextUserCursor=page.nextUserCursor;
        host.querySelector('[data-system-accounts]')?.insertAdjacentHTML('beforeend',page.users.map(systemAccountCard).join(''));
        button.hidden=!data.nextUserCursor;
        toast(t('Accounts loaded','تم تحميل الحسابات'),t('Open Assign access to select an account.','افتح تعيين صلاحية لاختيار حساب.'),'success');
      }catch(failure){toast(t('Accounts unavailable','الحسابات غير متاحة'),failure.message,'danger');}
      finally{button.disabled=false;}
    });
    host.querySelector('[data-system-accounts]')?.addEventListener('click',event=>{
      const button=event.target.closest('[data-global-suspend],[data-global-password]');
      if(!button)return;
      const user=data.users.find(user=>user.id===(button.dataset.globalSuspend||button.dataset.globalPassword));
      const recovery=!!button.dataset.globalPassword;
      editForm(recovery?t('Recover account password','استعادة كلمة مرور الحساب'):user.inactive?t('Reactivate account','إعادة تفعيل الحساب'):t('Deactivate account','تعطيل الحساب'),
        `<p>${esc(user.name)} · ${esc(user.username)}</p><p class="help">${recovery?t('Existing sessions will be revoked. Share the new credential only through your approved identity-checked recovery process.','تُلغى الجلسات القائمة. شارك بيانات الدخول الجديدة عبر آلية استعادة معتمدة بعد التحقّق من الهوية.'):t('Account history and role assignments are retained.','يُحفظ سجل الحساب وتعيينات الأدوار.')}</p>`+
        field('currentPassword',t('Your current password','كلمة مرورك الحالية'),'password','autocomplete="current-password"')+
        field('reason',t('Reason','السبب'),'text','minlength="3" maxlength="500"')+
        (recovery?field('newPassword',t('New password · 16–200 characters','كلمة مرور جديدة · من ١٦ إلى ٢٠٠ حرف'),'password','minlength="16" maxlength="200" autocomplete="new-password"')+field('confirmPassword',t('Confirm new password','تأكيد كلمة المرور الجديدة'),'password','minlength="16" maxlength="200" autocomplete="new-password"'):''),
        values=>api(recovery?'workspace/password-reset':'workspace/suspension','POST',{...values,scope:'global',scopeType:'global',userId:user.id,active:!user.inactive}),complete);
    });
    host.querySelector('[data-access-assign]')?.addEventListener('click', () => {
      const users = data.users.map(user => option(user.id, `${user.name} · ${user.username}`)).join('');
      editForm(t('Assign scoped access', 'تعيين صلاحية ضمن النطاق'), `<p><b>${esc(scope.name)}</b></p>
        <label class="formrow"><span class="label">${t('Existing account', 'الحساب الموجود')}</span><select class="select" name="userId">${option('', t('Choose an account or enter its username below', 'اختر حساباً أو أدخل اسم المستخدم أدناه'))}${users}</select></label>
        <label class="formrow"><span class="label">${t('Exact username for another account (optional)', 'اسم المستخدم الكامل لحساب آخر (اختياري)')}</span><input class="input" name="username" maxlength="120" autocomplete="off"></label>
        <label class="formrow"><span class="label">${t('Role', 'الدور')}</span><select class="select" name="role" required>${data.assignableRoles.map(role => option(role.id, isAr() ? role.labelAr : role.label)).join('')}</select></label>
        ${scope.scopeType === 'parish' && data.assignableRoles.some(role => ['priest', 'leader'].includes(role.id)) ? `<label class="formrow"><span class="label">${t('Parish person (required for a priest or ministry leader)', 'شخص الرعية (إلزامي للكاهن أو مسؤول الخدمة)')}</span><select class="select" name="personId">${option('',t('Keep the current person link','الإبقاء على ربط الشخص الحالي'))}${parishPeople.map(person=>option(person.id,person.name)).join('')}</select></label>` : ''}
        ${scope.scopeType === 'global' ? field('currentPassword', t('Confirm your current password', 'تأكيد كلمة مرورك الحالية'), 'password', 'autocomplete="current-password"') : ''}`,
        async values => {
          let userId = values.userId;
          if (values.username.trim()) userId = (await api('workspace/account-lookup', 'POST', { ...scope, username: values.username.trim() })).user.id;
          if (!userId) throw new Error(t('Choose an account or enter its exact username.', 'اختر حساباً أو أدخل اسم المستخدم الكامل.'));
          await api('workspace/grants', 'POST', { ...scope, role: values.role, userId, personId: values.personId || null, currentPassword: values.currentPassword });
        }, complete);
    });
    host.querySelectorAll('[data-access-revoke]').forEach(button => button.onclick = () => {
      const grant = data.grants.find(item => item.id === button.dataset.accessRevoke);
      editForm(t('Revoke access', 'سحب الصلاحية'), `<p>${esc(grant.name)} · ${esc(label(grant.role))}</p><p>${esc(scope.name)}</p><p class="help">${t('This removes this assignment only. The account, historical work, and unrelated roles remain.', 'يُزال هذا التعيين فقط. يبقى الحساب والعمل السابق والأدوار الأخرى.')}</p>${scope.scopeType === 'global' ? field('currentPassword', t('Confirm your current password', 'تأكيد كلمة مرورك الحالية'), 'password', 'autocomplete="current-password"') : ''}`,
        values => api('workspace/grants', 'POST', { ...scope, userId: grant.user_id, role: grant.role, active: false, currentPassword: values.currentPassword }), complete);
    });
    host.querySelector('[data-access-secretaries]')?.addEventListener('click', () => {
      const currentIds = secretaries.map(secretary => secretary.user_id);
      const secretaryCandidates=[...data.users];
      for(const secretary of secretaries)if(!secretaryCandidates.some(user=>user.id===secretary.user_id))secretaryCandidates.push({id:secretary.user_id,name:secretary.name,username:t('Assigned secretary','أمين سر معيّن')});
      editForm(t('Manage optional secretaries', 'إدارة أمناء السر الاختياريين'), `<p>${esc(scope.name)}</p><p class="help">${t('Select the accounts that should act as secretaries. Leave every box unchecked to operate without a secretary. Use Assign access to add someone from another account.', 'اختر الحسابات التي ستتولى أمانة السر. اترك جميع الخانات فارغة للعمل دون أمين سر. استخدم تعيين صلاحية لإضافة حساب آخر.')}</p><fieldset><legend>${t('Secretary accounts', 'حسابات أمناء السر')}</legend>${secretaryCandidates.map(user => `<label class="check"><input type="checkbox" name="secretary" value="${esc(user.id)}" ${currentIds.includes(user.id) ? 'checked' : ''}>${esc(user.name)} · ${esc(user.username)}</label>`).join('')}</fieldset>`,
        (values, form) => api('workspace/secretaries', 'POST', { parish: scope.parish, userIds: new FormData(form).getAll('secretary'), expectedUserIds: currentIds }), complete);
    });
    let cursor = '', loadingHistory = false;
    host.querySelector('[data-access-history]').onclick = async event => {
      if (loadingHistory) return;
      loadingHistory = true;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await api('workspace/history?' + query + (cursor ? '&before=' + encodeURIComponent(cursor) : ''));
        const list = host.querySelector('[data-access-history-list]');
        if (!cursor) list.innerHTML = `<h3>${t('Administrative history', 'سجل الإدارة')}</h3>`;
        list.insertAdjacentHTML('beforeend', result.events.map(entry => `<article class="card card-flat"><b>${esc(entry.action)}</b><p>${esc(entry.actorName || t('System operator', 'مشغّل النظام'))} · <time datetime="${esc(entry.created_at)}">${esc(new Date(entry.created_at).toLocaleString())}</time></p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(entry.detail, null, 2))}</pre></article>`).join('') || `<p>${t('No administrative events.', 'لا توجد أحداث إدارية.')}</p>`);
        cursor = result.nextCursor;
        button.textContent = cursor ? t('Load earlier history', 'تحميل السجل الأقدم') : t('History loaded', 'تم تحميل السجل');
        button.disabled = !cursor;
      } catch (failure) { toast(t('History unavailable', 'السجل غير متاح'), failure.message, 'danger'); button.disabled = false; }
      finally { loadingHistory = false; }
    };
  } catch (failure) {
    if (host.isConnected) { host.textContent = failure.message; host.setAttribute('role', 'alert'); }
  }
}
