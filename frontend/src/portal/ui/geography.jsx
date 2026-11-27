/* Purpose: the address cascade of a person's record: governorate, then district, then town, then sector (owner, 27 November 2026:
   every Lebanese governorate and district must be offered, and the sector must be usable).
   - Governorates and districts are Lebanon's eight-plus-one governorates (Akkar and Baalbek-Hermel since 2014, Keserwan-Jbeil since
     2017) and their districts (aqdiya), as published by the Ministry of Interior and Municipalities; Beirut is one governorate and
     one district.
   - Towns are listed only where a verified list exists (Baabda's parish-area localities, checked against the Directorate General of
     Local Administrations and Councils municipal listing: https://dglac.gov.lb/web/guest/municipalities). Elsewhere, or when the town
     is not listed, the town and its Arabic spelling are typed. Nothing is invented.
   - There is no verified list of sectors, so the sector (neighbourhood) is typed.
   An address already on file that is not on the lists is kept as an "Existing" choice until the office reviews it.
   Main members: GEOGRAPHY (governorates → districts → verified towns), geoForTown (the governorate and district of a listed town),
   AddressCascade (the form fields) and readAddressCascade (reads them back: governorate, district, town, townAr, sector). */
import { useState } from 'react';
import { t } from '../../lib/i18n.js';
import { Select } from './components.jsx';

const d = (id, ar, towns = []) => ({ id, ar, towns });

export const GEOGRAPHY = [
  { id: 'Akkar', ar: 'عكار', districts: [d('Akkar', 'عكار')] },
  { id: 'Baalbek-Hermel', ar: 'بعلبك الهرمل', districts: [d('Baalbek', 'بعلبك'), d('Hermel', 'الهرمل')] },
  { id: 'Beirut', ar: 'بيروت', districts: [d('Beirut', 'بيروت')] },
  {
    id: 'Beqaa',
    ar: 'البقاع',
    districts: [d('Zahle', 'زحلة'), d('West Beqaa', 'البقاع الغربي'), d('Rashaya', 'راشيا')]
  },
  { id: 'Keserwan-Jbeil', ar: 'كسروان جبيل', districts: [d('Keserwan', 'كسروان'), d('Jbeil', 'جبيل')] },
  {
    id: 'Mount Lebanon',
    ar: 'جبل لبنان',
    districts: [
      d('Baabda', 'بعبدا', [
        { id: 'Hadath', ar: 'الحدث' },
        { id: 'Baabda', ar: 'بعبدا' },
        { id: 'Hazmieh', ar: 'الحازمية' },
        { id: 'Louaizeh', ar: 'اللويزة' },
        { id: 'Furn el Chebbak', ar: 'فرن الشباك' },
        { id: 'Ain el Remmaneh', ar: 'عين الرمانة' }
      ]),
      d('Metn', 'المتن'),
      d('Chouf', 'الشوف'),
      d('Aley', 'عاليه')
    ]
  },
  {
    id: 'Nabatieh',
    ar: 'النبطية',
    districts: [
      d('Nabatieh', 'النبطية'),
      d('Bint Jbeil', 'بنت جبيل'),
      d('Marjeyoun', 'مرجعيون'),
      d('Hasbaya', 'حاصبيا')
    ]
  },
  {
    id: 'North',
    ar: 'الشمال',
    districts: [
      d('Tripoli', 'طرابلس'),
      d('Minieh-Danniyeh', 'المنية الضنية'),
      d('Zgharta', 'زغرتا'),
      d('Bsharri', 'بشري'),
      d('Batroun', 'البترون'),
      d('Koura', 'الكورة')
    ]
  },
  { id: 'South', ar: 'الجنوب', districts: [d('Sidon', 'صيدا'), d('Tyre', 'صور'), d('Jezzine', 'جزين')] }
];

const place = (items, id) => items.find(x => x.id === id);
export const geoForTown = id => {
  for (const gov of GEOGRAPHY)
    for (const district of gov.districts) {
      const town = place(district.towns, id);
      if (town) return { governorate: gov.id, district: district.id, town: town.id, townAr: town.ar };
    }
  return null;
};

const OTHER = '__other__';

/* value: { governorate, district, town, townAr, sector } as stored. */
export function AddressCascade({ value = {}, prefix = 'address' }) {
  const known = geoForTown(value.town);
  const [gov, setGov] = useState(value.governorate || known?.governorate || '');
  const [district, setDistrict] = useState(value.district || known?.district || '');
  const districts = place(GEOGRAPHY, gov)?.districts || [];
  const towns = place(districts, district)?.towns || [];
  const listedTown = towns.some(x => x.id === value.town) ? value.town : '';
  const [town, setTown] = useState(listedTown || (value.town ? OTHER : ''));
  const typed = !towns.length || town === OTHER;
  const legacyGov = gov && !place(GEOGRAPHY, gov);
  const legacyDistrict = district && !place(districts, district);
  const label = (id, en, ar, extra) => (
    <label className="label" htmlFor={`${prefix}_${id}`}>
      {t(en, ar)}
      {extra ? (
        <>
          {' '}
          <span className="opt">{extra}</span>
        </>
      ) : null}
    </label>
  );
  return (
    <div className="formgrid" data-address-prefix={prefix}>
      <div className="formrow">
        {label('governorate', 'Governorate', 'المحافظة')}
        <Select
          id={`${prefix}_governorate`}
          value={gov}
          onChange={e => {
            setGov(e.target.value);
            setDistrict('');
            setTown('');
          }}
        >
          <option value="">{t('Select', 'اختر')}</option>
          {GEOGRAPHY.map(x => (
            <option key={x.id} value={x.id}>
              {t(x.id, x.ar)}
            </option>
          ))}
          {legacyGov ? <option value={gov}>{t(`Existing: ${gov}`, `القيمة الحالية: ${gov}`)}</option> : null}
        </Select>
      </div>
      <div className="formrow">
        {label('district', 'District', 'القضاء')}
        <Select
          id={`${prefix}_district`}
          value={district}
          disabled={!districts.length && !district}
          onChange={e => {
            setDistrict(e.target.value);
            setTown('');
          }}
        >
          <option value="">{t('Select', 'اختر')}</option>
          {districts.map(x => (
            <option key={x.id} value={x.id}>
              {t(x.id, x.ar)}
            </option>
          ))}
          {legacyDistrict ? (
            <option value={district}>{t(`Existing: ${district}`, `القيمة الحالية: ${district}`)}</option>
          ) : null}
        </Select>
      </div>
      {towns.length ? (
        <div className="formrow">
          {label('town', 'Town', 'البلدة')}
          <Select id={`${prefix}_town`} value={town} onChange={e => setTown(e.target.value)}>
            <option value="">{t('Select', 'اختر')}</option>
            {towns.map(x => (
              <option key={x.id} value={x.id}>
                {t(x.id, x.ar)}
              </option>
            ))}
            <option value={OTHER}>{t('Another town (type it)', 'بلدة أخرى (اكتبها)')}</option>
          </Select>
        </div>
      ) : null}
      {typed ? (
        <>
          <div className="formrow">
            {label('townOther', 'Town (English)', 'البلدة (بالإنكليزية)')}
            <input
              className="input"
              id={`${prefix}_townOther`}
              dir="ltr"
              maxLength={100}
              defaultValue={listedTown ? '' : value.town || ''}
              disabled={!district}
            />
          </div>
          <div className="formrow">
            {label('townAr', 'Town (Arabic)', 'البلدة (بالعربية)', t('(optional)', '(اختياري)'))}
            <input
              className="input"
              id={`${prefix}_townAr`}
              dir="rtl"
              maxLength={100}
              style={{ fontFamily: 'var(--arabic)' }}
              defaultValue={listedTown || value.townAr === value.town ? '' : value.townAr || ''}
              disabled={!district}
            />
          </div>
        </>
      ) : null}
      <div className="formrow">
        {label('sector', 'Sector or neighbourhood', 'الحيّ', t('(if available)', '(إذا توفّر)'))}
        <input
          className="input"
          id={`${prefix}_sector`}
          maxLength={100}
          defaultValue={value.sector || ''}
          disabled={!district}
        />
      </div>
      <p className="help" style={{ gridColumn: '1/-1' }}>
        {t(
          'Every governorate and district of Lebanon is listed. Where no verified list of towns exists, type the town; the sector is always typed.',
          'كل محافظات لبنان وأقضيته مدرجة. حيث لا توجد لائحة بلدات موثّقة اكتب اسم البلدة؛ والحيّ يُكتب دائماً.'
        )}
      </p>
    </div>
  );
}

export function readAddressCascade(root, prefix = 'address') {
  const get = k => (root.querySelector(`#${prefix}_${k}`)?.value || '').trim();
  const chosen = get('town');
  const town = chosen && chosen !== OTHER ? chosen : get('townOther');
  const listed = chosen && chosen !== OTHER ? geoForTown(chosen) : null;
  return {
    governorate: get('governorate'),
    district: get('district'),
    town,
    sector: get('sector'),
    townAr: listed ? listed.townAr : get('townAr')
  };
}
