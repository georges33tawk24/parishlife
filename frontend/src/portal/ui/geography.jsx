/* Parish-covered localities verified against Lebanon's Directorate General of
   Local Administrations and Councils municipal listing. This is deliberately a
   limited, sourced list; sectors have no verified source and are never invented.
   Sources: https://dglac.gov.lb/web/guest/municipalities
   https://www.ppa.gov.lb/en/tenders/details/12588/plan (Hadet / Hadath)
   https://www.dglac.gov.lb/documents/20124/38880/%D9%86%D8%B3%D8%AE%D8%A9%20%D9%85%D8%B1%D8%B3%D9%88%D9%85%20%202019.pdf/1997bbe8-3c51-c404-2352-1b671f0a5b72
*/
import { useState } from 'react';
import { t } from '../../lib/i18n.js';
import { Select } from './components.jsx';

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

const place = (items, id) => items.find(x=>x.id===id);
export const geoForTown = id => {
  for (const gov of GEOGRAPHY) for (const district of gov.districts) {
    const town = place(district.towns,id);
    if (town) return { governorate:gov.id, district:district.id, town:town.id, townAr:town.ar };
  }
  return null;
};

const FIELDS = [['governorate','Governorate','المحافظة'],['district','District','القضاء'],['town','Town','البلدة'],['sector','Sector','الحيّ']];
/* Governorate, then district, then town, then sector: each list follows the one before it. An
   address already on file that is not on the verified list is kept as an "Existing" choice until
   the office reviews it. */
export function AddressCascade({ value = {}, prefix = 'address' }) {
  const known = geoForTown(value.town);
  const initial = { governorate:value.governorate||known?.governorate||'', district:value.district||known?.district||'', town:value.town||'', sector:value.sector||'' };
  const [chosen, setChosen] = useState(initial);
  const [legacy, setLegacy] = useState({ governorate:true, district:true, town:true, sector:true });
  const districts = place(GEOGRAPHY,chosen.governorate)?.districts || [];
  const towns = place(districts,chosen.district)?.towns || [];
  const sectors = place(towns,chosen.town)?.sectors || [];
  const lists = { governorate:GEOGRAPHY, district:districts, town:towns, sector:sectors };
  const change = (key, v) => {
    const next = { ...chosen, [key]:v };
    const clear = { governorate:['district','town','sector'], district:['town','sector'], town:['sector'], sector:[] }[key];
    clear.forEach(k => { next[k] = ''; });
    setChosen(next);
    setLegacy(l => ({ ...l, ...Object.fromEntries([key, ...clear].map(k => [k, false])) }));
  };
  return <div className="formgrid" data-address-prefix={prefix}>
    {FIELDS.map(([key,en,ar])=>{
      const items = lists[key], selected = chosen[key], old = legacy[key] && selected && !items.some(x=>x.id===selected);
      const shown = items.some(x=>x.id===selected) || old ? selected : '';
      return <div key={key} className="formrow"><label className="label" htmlFor={`${prefix}_${key}`}>{t(en,ar)}{key==='sector'?<> <span className="opt">{t('(if available)','(إذا توفّر)')}</span></>:null}</label>
        <Select id={`${prefix}_${key}`} data-geo-field={key} value={shown} onChange={e=>change(key,e.target.value)}
          disabled={key==='sector' ? !items.length && !selected : key!=='governorate' && !items.length && !selected}>
          <option value="">{key==='sector' ? t('No verified sectors','لا أحياء موثّقة') : t('Select','اختر')}</option>
          {items.map(x=><option key={x.id} value={x.id}>{t(x.id,x.ar)}</option>)}
          {old ? <option value={selected}>{t(`Existing: ${selected}`,`القيمة الحالية: ${selected}`)}</option> : null}
        </Select></div>;
    })}
    <p className="help" style={{ gridColumn:'1/-1' }}>{t('Only verified parish-area localities are listed. No verified sector list is available; leave Sector blank. Existing unsupported addresses are preserved until reviewed.', 'تُعرض البلدات الموثّقة ضمن نطاق الرعية فقط. لا توجد لائحة أحياء موثّقة؛ اترك الحيّ فارغاً. تُحفظ العناوين القديمة غير المطابقة حتى مراجعتها.')}</p>
  </div>;
}

export function readAddressCascade(root, prefix = 'address') {
  const get = k => root.querySelector(`#${prefix}_${k}`)?.value || '';
  const town = get('town');
  return { governorate:get('governorate'), district:get('district'), town, sector:get('sector'), townAr:geoForTown(town)?.townAr||town };
}
