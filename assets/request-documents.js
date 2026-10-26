import { t } from './i18n.js';
import { PREP_REQUIREMENTS } from './data.js';
import { is } from './store.js';
import { esc, pill, toast } from './ui.js';
import { parishAPI, session } from './api.js';
import { persist, hydrate } from './persist.js';

const L=(en,ar)=>t(en,ar);
export const requestRequirements = record => PREP_REQUIREMENTS[record.kind?.toLowerCase()==='wedding'?'marriage':record.kind?.toLowerCase()]||[];
const editable=record=>is('priest','secretary')&&!['celebrated','registered','issued','rejected','cancelled'].includes(record.status);

export async function uploadFile(scope,id,file,requirement='',replaceId=null) {
  if(!/\.(pdf|png|jpe?g)$/i.test(file.name)||!file.size||file.size>10_000_000)throw new Error(L('Choose a PDF, JPG or PNG up to 10 MB.','اختر PDF أو JPG أو PNG حتى ١٠ ميغابايت.'));
  if(!await persist())throw new Error(L('Resolve the pending save first.','عالج مشكلة الحفظ أولاً.'));
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  await parishAPI('files','POST',{scope,id,name:file.name,data:btoa(binary),requirement,replaceId,revision:session.revision});
  if(scope.endsWith('-request'))await hydrate();
}

export function requestDocumentPanel(record,scope) {
  const canEdit=editable(record),requirements=requestRequirements(record);
  return `<section class="request-documents" data-request-documents data-document-scope="${scope}" data-document-owner="${esc(record.id)}">
    <h3 class="t-ui">${L('Documents & requirements','المستندات والمتطلبات')}</h3><p class="help">${L('Attach a document to its requirement, or explicitly record an item received on paper / completed in person. Document receipt does not approve the request.','أرفق المستند بمتطلبه أو سجّل استلامه ورقياً / إنجازه شخصياً. استلام المستند لا يعني الموافقة على الطلب.')}</p>
    ${[...requirements,['',L('Additional attachments','مرفقات إضافية'),false]].map(([en,ar,required],index)=>`<div class="request-document" data-document-index="${index}" data-document-requirement="${esc(en)}"><h4>${esc(en?L(en,ar):ar)} ${en?pill(record.documents?.[en]?L('Received / complete','مستلم / مكتمل'):required?L('Missing','ناقص'):L('Optional','اختياري'),record.documents?.[en]?'success':required?'warning':''):''}</h4>
      ${en?`<label class="check"><input type="checkbox" data-document-paper ${record.paperDocuments?.[en]?'checked':''} ${canEdit?'':'disabled'}><span>${L('Received on paper / completed in person','مستلم ورقياً / منجز شخصياً')}</span></label>`:''}
      <div data-request-file-list><p class="help">${L('Loading attachments…','جارٍ تحميل المرفقات…')}</p></div>
      ${canEdit?`<label class="btn btn-secondary btn-dense">${L('Add document','إضافة مستند')}<input type="file" data-request-file hidden accept=".pdf,.png,.jpg,.jpeg"></label>`:''}</div>`).join('')}
    <p class="help">${L('PDF, JPG or PNG up to 10 MB. Closed requests keep their files read-only.','PDF أو JPG أو PNG حتى ١٠ ميغابايت. تبقى ملفات الطلبات المقفلة للقراءة فقط.')}</p></section>`;
}

export function mountRequestDocuments(host,record,scope,onChange) {
  const panel=host.querySelector('[data-request-documents]');if(!panel)return;
  let busy=false;
  const run=async fn=>{
    if(busy)return;busy=true;
    panel.querySelectorAll('input,button').forEach(x=>x.disabled=true);
    try {if(!await persist())throw new Error(L('Resolve the pending save first.','عالج مشكلة الحفظ أولاً.'));await fn();await hydrate();onChange();}
    catch(error){toast(L('Could not update documents','تعذّر تحديث المستندات'),error.message,'danger');panel.querySelectorAll('[data-document-paper]').forEach(box=>box.checked=!!record.paperDocuments?.[box.closest('[data-document-requirement]').dataset.documentRequirement]);panel.querySelectorAll('input,button').forEach(x=>x.disabled=!editable(record));}
    finally{busy=false;}
  };
  panel.querySelectorAll('[data-document-paper]').forEach(box=>box.addEventListener('change',()=>{
    const received=box.checked,requirement=box.closest('[data-document-requirement]').dataset.documentRequirement;
    run(()=>parishAPI('request-documents','POST',{scope,id:record.id,requirement,received,revision:session.revision}));
  }));
  panel.querySelectorAll('[data-request-file]').forEach(input=>input.addEventListener('change',()=>{
    const file=input.files?.[0],replaceId=input.dataset.replaceId||null;delete input.dataset.replaceId;input.value='';
    if(file)run(()=>uploadFile(scope,record.id,file,input.closest('[data-document-requirement]').dataset.documentRequirement,replaceId));
  }));
  parishAPI(`files?scope=${encodeURIComponent(scope)}&id=${encodeURIComponent(record.id)}`).then(({files})=>{
    if(!panel.isConnected)return;
    panel.querySelectorAll('[data-document-requirement]').forEach(section=>{
      const list=section.querySelector('[data-request-file-list]');
      list.innerHTML=files.filter(file=>(file.requirement||'')===section.dataset.documentRequirement).map(file=>`<div class="filerow"><span class="grow"><b>${esc(file.name)}</b><small>${(file.size/1048576).toFixed(1)} MB · ${esc(file.created_at.slice(0,10))}</small></span><a class="btn btn-secondary btn-dense" href="/api/parishes/${encodeURIComponent(session.parishId)}/files/${encodeURIComponent(file.id)}" target="_blank" rel="noopener">${L('Open / download','فتح / تنزيل')}</a>${editable(record)?`<button class="btn btn-secondary btn-dense" data-request-replace="${esc(file.id)}">${L('Replace','استبدال')}</button><button class="btn btn-danger-quiet btn-dense" data-request-delete="${esc(file.id)}">${L('Remove','إزالة')}</button>`:''}</div>`).join('')||`<p class="help">${L('No uploaded files.','لا ملفات مرفوعة.')}</p>`;
      list.querySelectorAll('[data-request-replace]').forEach(button=>button.onclick=()=>{const input=section.querySelector('[data-request-file]');input.value='';input.dataset.replaceId=button.dataset.requestReplace;input.click();});
      list.querySelectorAll('[data-request-delete]').forEach(button=>button.onclick=()=>run(()=>parishAPI(`files/${encodeURIComponent(button.dataset.requestDelete)}`,'DELETE',{revision:session.revision})));
    });
  }).catch(error=>{panel.querySelectorAll('[data-request-file-list]').forEach(list=>list.innerHTML=`<p class="help help-error">${esc(error.message)}</p>`);});
}
