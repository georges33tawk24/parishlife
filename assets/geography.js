/* Parish-covered localities verified against Lebanon's Directorate General of
   Local Administrations and Councils municipal listing. This is deliberately a
   limited, sourced list; sectors have no verified source and are never invented.
   Sources: https://dglac.gov.lb/web/guest/municipalities
   https://www.ppa.gov.lb/en/tenders/details/12588/plan (Hadet / Hadath)
   https://www.dglac.gov.lb/documents/20124/38880/%D9%86%D8%B3%D8%AE%D8%A9%20%D9%85%D8%B1%D8%B3%D9%88%D9%85%20%202019.pdf/1997bbe8-3c51-c404-2352-1b671f0a5b72
*/
import { t } from './i18n.js';
import { esc } from './ui.js';

export const GEOGRAPHY = [{
  id:'Mount Lebanon', ar:'جبل لبنان', districts:[{
    id:'Baabda', ar:'بعبدا', towns:[
      { id:'Hadath', ar:'الحدث', sectors:[] },
      { id:'Baabda', ar:'بعبدا', sectors:[] },
      { id:'Hazmieh', ar:'الحازمية', sectors:[] },
      { id:'Louaizeh', ar:'اللويزة', sectors:[] },
      { id:'Furn el Chebbak', ar:'فرن الشباك', sectors:[] },
      { id:'Ain el Remmaneh', ar:'عين الرمانة', sectors:[] }
    ]
  }]
}];

const option = (id, label, selected = false) => `<option value="${esc(id)}" ${selected?'selected':''}>${esc(label)}</option>`;
const place = (items, id) => items.find(x=>x.id===id);
export const geoForTown = id => {
  for (const gov of GEOGRAPHY) for (const district of gov.districts) {
    const town = place(district.towns,id);
    if (town) return { governorate:gov.id, district:district.id, town:town.id, townAr:town.ar };
  }
  return null;
};

export function renderAddressCascade({ value = {}, prefix = 'address' } = {}) {
  const known = geoForTown(value.town);
  const initial = { governorate:value.governorate||known?.governorate||'', district:value.district||known?.district||'',
    town:value.town||'', sector:value.sector||'' };
  return `<div class="formgrid" data-address-prefix="${esc(prefix)}" data-geo-initial="${esc(JSON.stringify(initial))}">
    ${[['governorate','Governorate','المحافظة'],['district','District','القضاء'],['town','Town','البلدة'],['sector','Sector','الحيّ']].map(([key,en,ar])=>`<div class="formrow"><label class="label" for="${esc(prefix)}_${key}">${t(en,ar)}${key==='sector'?` <span class="opt">${t('(if available)','(إذا توفّر)')}</span>`:''}</label><select class="select" id="${esc(prefix)}_${key}" data-geo-field="${key}"></select></div>`).join('')}
    <p class="help" style="grid-column:1/-1">${t('Only verified parish-area localities are listed. No verified sector list is available; leave Sector blank. Existing unsupported addresses are preserved until reviewed.', 'تُعرض البلدات الموثّقة ضمن نطاق الرعية فقط. لا توجد لائحة أحياء موثّقة؛ اترك الحيّ فارغاً. تُحفظ العناوين القديمة غير المطابقة حتى مراجعتها.')}</p>
  </div>`;
}

export function wireAddressCascades(host) {
  host.querySelectorAll('[data-address-prefix]').forEach(root=>{
    const fields = Object.fromEntries(['governorate','district','town','sector'].map(k=>[k,root.querySelector(`[data-geo-field="${k}"]`)]));
    const initial = JSON.parse(root.dataset.geoInitial || '{}');
    const fill = (key, items, selected = '', legacy = false) => {
      const select = fields[key];
      select.innerHTML = option('', key==='sector' ? t('No verified sectors','لا أحياء موثّقة') : t('Select','اختر')) +
        items.map(x=>option(x.id,t(x.id,x.ar),x.id===selected)).join('') +
        (legacy && selected && !items.some(x=>x.id===selected) ? option(selected,t(`Existing: ${selected}`,`القيمة الحالية: ${selected}`),true) : '');
      select.value = selected && [...select.options].some(x=>x.value===selected) ? selected : '';
      select.disabled = key==='sector' ? !items.length && !selected : key!=='governorate' && !items.length && !selected;
    };
    const districts = () => place(GEOGRAPHY,fields.governorate.value)?.districts || [];
    const towns = () => place(districts(),fields.district.value)?.towns || [];
    const sectors = () => place(towns(),fields.town.value)?.sectors || [];
    fill('governorate',GEOGRAPHY,initial.governorate,true);
    fill('district',districts(),initial.district,true);
    fill('town',towns(),initial.town,true);
    fill('sector',sectors(),initial.sector,true);
    fields.governorate.addEventListener('change',()=>{ fill('district',districts()); fill('town',[]); fill('sector',[]); });
    fields.district.addEventListener('change',()=>{ fill('town',towns()); fill('sector',[]); });
    fields.town.addEventListener('change',()=>{ fill('sector',sectors()); });
  });
}

export function readAddressCascade(root, prefix = 'address') {
  const get = k => root.querySelector(`#${prefix}_${k}`)?.value || '';
  const town = get('town');
  return { governorate:get('governorate'), district:get('district'), town, sector:get('sector'), townAr:geoForTown(town)?.townAr||town };
}
