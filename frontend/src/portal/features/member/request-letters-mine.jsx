/* Purpose: the letters the parish office released for one of the member's own requests
   (GET .../requests/{id}/letters/mine). The text, the signer and the verification code appear only when the
   letter was released to this account; a letter collected in person shows its title and status. Each letter
   carries the API's statement on its official status (reference only, unless the archdiocese approved an
   electronic-signature arrangement).
   Main function: MyRequestLetters. */
import { useEffect, useState } from 'react';
import { t } from '../../../lib/i18n.js';
import { myLetters } from '../../model/modules/requests.js';
import { fmtStamp } from '../../model/sacrament-requests.js';

const L = (en, ar) => t(en, ar);

export function MyRequestLetters({ id }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let live = true;
    myLetters(id).then(
      r => live && setRows(r || []),
      () => live && setRows([])
    );
    return () => {
      live = false;
    };
  }, [id]);
  if (!rows.length) return null;
  return (
    <section className="member-card" aria-labelledby="mr-letters-title" data-my-letters="">
      <h2 id="mr-letters-title">{L('Letters from the parish', 'رسائل من الرعية')}</h2>
      {rows.map(l => (
        <article key={l.reference + '.' + l.version} className="mr-letter">
          <h3 dir="auto">{l.title}</h3>
          <p className="help">
            <bdi dir="ltr">{l.reference}</bdi> ·{' '}
            {l.status === 'Withdrawn' ? L('withdrawn', 'مسحوبة') : L('released', 'صادرة')}
            {l.releasedAt ? ` · ${fmtStamp(l.releasedAt)}` : ''}
          </p>
          {l.body ? (
            <blockquote className="letter-body" dir="auto">
              <p style={{ whiteSpace: 'pre-wrap' }}>{l.body}</p>
              {l.signerName ? <footer>{l.signerName}</footer> : null}
            </blockquote>
          ) : (
            <p className="help">
              {L('Collect this letter from the parish office.', 'استلم هذه الرسالة من مكتب الرعية.')}
            </p>
          )}
          {l.verificationCode ? (
            <p className="help">
              {L('Verification code', 'رمز التحقّق')}{' '}
              <bdi className="mono" dir="ltr">
                {l.verificationCode}
              </bdi>{' '}
              ·{' '}
              <a href={'public.html?verify=' + encodeURIComponent(l.verificationCode)}>{L('Check it', 'تحقّق منه')}</a>
            </p>
          ) : null}
          <p className="help" dir="auto">
            {l.statement}
          </p>
        </article>
      ))}
    </section>
  );
}
