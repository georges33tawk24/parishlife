/* Purpose: what the sacrament record / certificate screen (certificate.jsx) wires once it is drawn: the workflow
   steps (review, schedule, record, sign, issue, deliver), corrections, documents, printing and downloads.
   Main member: mountCertificate(host, id, lang), used as certificate.mount. Split out of certificate.jsx without
   changing behaviour. */
import { Fragment } from 'react';
import { Select } from '../../ui/components.jsx';

import { bus, S } from '../../model/store.js';

import { openDrawer, openModal, closeOverlays, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { need, needAll } from '../../shared/dialogs.jsx';
import * as API from '../../model/modules/sacraments.js';
import { SACRAMENTS } from '../../model/data.js';
import { sharedNote } from './online-requests.jsx';

import { kindLabel, official, timeSelect } from './records-shared.jsx';
import { downloadMenu, printDoc, viewDoc } from './certificate-document.jsx';

import { L, twinFields, celebrantPick, docLang } from './certificate-parts.jsx';

export const mountCertificate = (host, id, lang = '') => {
  const doc = SACRAMENTS.find(x => x.id === id);
  lang = docLang(doc, lang);
  const isCertificate = doc?.kind === 'certificate';
  // the signature image attached at signing is fetched once, then the document is drawn again with it
  if (isCertificate && doc.hasSignatureImage && !API.certificateImage(doc))
    API.loadCertificateImage(doc).then(data => {
      if (data) bus.refresh();
    });
  host.querySelectorAll('[data-docview]').forEach(b => b.addEventListener('click', () => viewDoc(doc, lang)));
  host.querySelector('[data-docdl]')?.addEventListener('click', e => downloadMenu(e.currentTarget, doc, () => lang));
  host.querySelector('[data-docprint]')?.addEventListener('click', () => printDoc(doc, lang));

  /* Every step is one call to the API (model/modules/sacraments.js), which then reloads the lists. */
  const run = async (step, done, failed, close = true) => {
    try {
      await step();
      if (close) closeOverlays();
      bus.refresh();
      if (done) toast(done[0], done[1] || '', 'success');
      return true;
    } catch (e) {
      toast(failed, e.message, 'danger');
      return false;
    }
  };
  /* A reason is asked for, then the step runs. */
  const withReason = (selector, { title, sub, confirm, keep, failed, done, optional = false, step }) =>
    host.querySelector(selector)?.addEventListener('click', () =>
      openModal({
        title,
        sub,
        body: (
          <>
            <C.Textarea label={L('Reason', 'السبب')} id="decision_reason" max={500} />
            {sharedNote(doc)}
          </>
        ),
        foot: (
          <>
            <button className="btn btn-secondary" data-close="">
              {keep}
            </button>
            <button className="btn btn-primary" id="decision_confirm">
              {confirm}
            </button>
          </>
        ),
        onMount(el) {
          el.querySelector('#decision_confirm').addEventListener('click', async () => {
            if (!optional && !need(el, '#decision_reason', L('Enter a reason', 'أدخل السبب'))) return;
            await run(() => step(el.querySelector('#decision_reason').value.trim()), done, failed);
          });
        }
      })
    );

  host.querySelector('#acceptrequest')?.addEventListener('click', () =>
    openModal({
      title: L('Accept this sacrament request?', 'قبول طلب السرّ؟'),
      sub: L('The request will move to Preparation.', 'سينتقل الطلب إلى التحضير.'),
      body: <p>{L('Confirm the person and sacrament before accepting.', 'تأكّد من الشخص والسرّ قبل القبول.')}</p>,
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Back', 'رجوع')}
          </button>
          <button className="btn btn-primary" id="accept_confirm">
            {L('Accept request', 'قبول الطلب')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#accept_confirm').addEventListener('click', () =>
          run(
            () => API.sacramentAction(id, 'accept'),
            [L('Request accepted', 'قُبل الطلب'), L('Preparation can begin.', 'يمكن بدء التحضير.')],
            L('Could not accept request', 'تعذّر قبول الطلب')
          )
        );
      }
    })
  );
  withReason('#declinerequest', {
    title: L('Decline this sacrament request?', 'رفض طلب السرّ؟'),
    sub: L('The reason is shown to the applicant.', 'يظهر السبب لصاحب الطلب.'),
    confirm: L('Decline request', 'رفض الطلب'),
    keep: L('Back', 'رجوع'),
    failed: L('Could not decline request', 'تعذّر رفض الطلب'),
    step: reason => API.sacramentAction(id, 'decline', { reason })
  });
  withReason('#officereview', {
    title: L('Mark this request reviewed by the office?', 'تأشير مراجعة المكتب لهذا الطلب؟'),
    sub: L(
      'The priest sees the review and your note; he may accept or decline with or without it.',
      'يرى الكاهن المراجعة وملاحظتك؛ ويمكنه القبول أو الرفض معها أو بدونها.'
    ),
    confirm: L('Mark reviewed', 'تأشير المراجعة'),
    keep: L('Back', 'رجوع'),
    failed: L('Could not record the review', 'تعذّر تسجيل المراجعة'),
    done: [L('Reviewed by the office', 'راجعه المكتب')],
    optional: true,
    step: note => API.officeReview(id, note)
  });
  withReason('#amend_reject', {
    title: L('Reject this change to the request?', 'رفض هذا التعديل على الطلب؟'),
    sub: L('The request stays as it was; the reason is kept.', 'يبقى الطلب كما كان؛ ويُحفظ السبب.'),
    confirm: L('Reject change', 'رفض التعديل'),
    keep: L('Back', 'رجوع'),
    failed: L('Could not save the decision', 'تعذّر حفظ القرار'),
    done: [L('Change rejected', 'رُفض التعديل')],
    step: reason => API.decideAmendment(id, false, reason)
  });
  withReason('#amend_approve', {
    title: L('Approve this change to the request?', 'اعتماد هذا التعديل على الطلب؟'),
    sub: L(
      'The request takes the new values now; the old ones stay in its history.',
      'يأخذ الطلب القيم الجديدة الآن؛ وتبقى القديمة في سجله.'
    ),
    confirm: L('Approve change', 'اعتماد التعديل'),
    keep: L('Back', 'رجوع'),
    failed: L('Could not save the decision', 'تعذّر حفظ القرار'),
    done: [L('Change approved', 'اعتُمد التعديل')],
    optional: true,
    step: note => API.decideAmendment(id, true, note)
  });
  host.querySelectorAll('[data-req-key]').forEach(box =>
    box.addEventListener('change', () =>
      run(
        () => API.setRequirement(id, box.dataset.reqKey, box.checked),
        [box.checked ? L('Marked as met', 'أُشّر كمستوفى') : L('Marked as not met', 'أُشّر كغير مستوفى')],
        L('Could not update the checklist', 'تعذّر تحديث اللائحة'),
        false
      ).then(ok => {
        if (!ok) box.checked = !box.checked;
      })
    )
  );
  host
    .querySelector('#reqsync')
    ?.addEventListener('click', () =>
      run(
        () => API.syncRequirements(id),
        [L('Checklist updated', 'حُدّثت اللائحة')],
        L('Could not update the checklist', 'تعذّر تحديث اللائحة'),
        false
      )
    );
  /* A change to an accepted request: it applies only when a priest approves it. */
  host.querySelector('#proposeamend')?.addEventListener('click', () => {
    const record = SACRAMENTS.find(x => x.id === id);
    if (!record) return;
    openDrawer({
      title: L('Propose a change to the request', 'اقتراح تعديل على الطلب'),
      sub: L(
        'The accepted request stays unchanged until a priest approves this change. The reason and the decision stay in its history.',
        'يبقى الطلب المقبول دون تغيير حتى يعتمد الكاهن هذا التعديل. ويبقى السبب والقرار في سجله.'
      ),
      body: (
        <>
          <C.Field
            label={L('New requested date (optional)', 'التاريخ المطلوب الجديد (اختياري)')}
            id="amend_date"
            type="date"
            value={record.requestedDate || ''}
          />
          <C.Textarea
            label={L('Family request / notes', 'طلب العائلة / ملاحظات')}
            id="amend_notes"
            max={500}
            value={record.requestNotes || ''}
          />
          <C.Textarea label={L('Reason for the change', 'سبب التعديل')} id="amend_reason" max={500} />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="amend_save">
            {L('Send to the priest', 'إرسال إلى الكاهن')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#amend_save').addEventListener('click', async () => {
          if (!need(el, '#amend_reason', L('Enter a reason', 'أدخل السبب'))) return;
          const date = el.querySelector('#amend_date').value,
            notes = el.querySelector('#amend_notes').value.trim();
          const facts = notes !== (record.requestNotes || '') ? { requestNotes: notes } : {};
          if (date === (record.requestedDate || '') && !Object.keys(facts).length)
            return toast(
              L('Nothing changed', 'لا تغيير'),
              L('Change the date or the notes.', 'غيّر التاريخ أو الملاحظات.'),
              'warning'
            );
          await run(
            () =>
              API.proposeAmendment(id, {
                date: date !== (record.requestedDate || '') ? date : '',
                facts,
                reason: el.querySelector('#amend_reason').value.trim()
              }),
            [L('Change proposed', 'اقتُرح التعديل'), L('It waits for the priest.', 'ينتظر الكاهن.')],
            L('Could not propose the change', 'تعذّر اقتراح التعديل')
          );
        });
      }
    });
  });
  host.querySelector('#startcertreq')?.addEventListener('click', () => {
    S.ui.newCertificateSource = id;
    location.hash = '#/requests';
  });

  /* The case's own details (father, mother, place, witnesses and so on). Date, celebrant and book are set where the API sets them: scheduling and registering. */
  host.querySelector('#editentry')?.addEventListener('click', () => {
    const record = SACRAMENTS.find(s => s.id === id);
    if (!record || !['scheduled', 'draft', 'awaiting-signature'].includes(record.status)) return;
    openDrawer({
      title: L('Edit sacrament details', 'تعديل تفاصيل السرّ'),
      sub: L(
        'Changes are kept in the record’s history. Once the entry is registered it can only be corrected by a priest-approved correction.',
        'تُحفظ التعديلات في سجل القيد. بعد تسجيل القيد لا يُصحَّح إلا بتصحيح يعتمده الكاهن.'
      ),
      body: (
        <>
          {twinFields('edit_place', L('Place', 'المكان'), record.place, record.placeAr)}
          {twinFields(
            'edit_godparents',
            L('Godparents / witnesses', 'الإشبين / الشهود'),
            record.godparents,
            record.godparentsAr
          )}
          {twinFields('edit_celebrant', L('Celebrant', 'المحتفل'), record.celebrantName, record.celebrantNameAr)}
          {celebrantPick('edit_celebrant_person', record.celebrant)}
          {twinFields('edit_father', L('Father', 'الأب'), record.father, record.fatherAr)}
          {twinFields('edit_mother', L('Mother', 'الأم'), record.mother, record.motherAr)}
          <div className="formgrid">
            <C.Field
              label={L('External parish', 'الرعية الخارجية')}
              id="edit_externalParish"
              value={record.externalParish || ''}
            />
            <C.Field
              label={L('External reference', 'المرجع الخارجي')}
              id="edit_externalReference"
              value={record.externalReference || ''}
            />
          </div>
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="edit_save">
            {L('Save changes', 'حفظ التعديلات')}
          </button>
        </>
      ),
      onMount(el) {
        const value = k => el.querySelector('#edit_' + k).value.trim();
        el.querySelector('#edit_save').addEventListener('click', () =>
          run(
            () =>
              API.sacramentAction(id, 'amend-facts', {
                facts: API.mergedFacts(record, {
                  father: value('father'),
                  fatherAr: value('fatherAr'),
                  mother: value('mother'),
                  motherAr: value('motherAr'),
                  externalParish: value('externalParish'),
                  externalReference: value('externalReference')
                }),
                place: value('place'),
                placeAr: value('placeAr'),
                witnesses: value('godparents'),
                witnessesAr: value('godparentsAr'),
                celebrantName: value('celebrant'),
                celebrantNameAr: value('celebrantAr'),
                celebrantPersonId: value('celebrant_person')
              }),
            [L('Details updated', 'حُدّثت التفاصيل'), L('The history was updated.', 'حُدّث السجل.')],
            L('Could not update entry', 'تعذّر تعديل القيد')
          )
        );
      }
    });
  });

  host.querySelector('#linksource')?.addEventListener('click', () => {
    const request = SACRAMENTS.find(s => s.id === id);
    const sources = SACRAMENTS.filter(
      s => s.person === request?.person && s.kind === request?.certificateOf && official(s)
    );
    openDrawer({
      title: L('Link the register entry', 'ربط القيد'),
      sub: L(
        'Choose the registered entry this certificate is taken from. It must be this person’s entry for the same sacrament.',
        'اختر القيد المسجَّل الذي تؤخذ منه الشهادة. يجب أن يكون قيد هذا الشخص للسرّ نفسه.'
      ),
      body: sources.length ? (
        <div className="formrow">
          <label className="label" htmlFor="link_source">
            {L('Registered entry', 'القيد المسجَّل')}
          </label>
          <Select id="link_source">
            {sources.map((s, i) => (
              <option key={i} value={s.id}>
                {s.reg} · {kindLabel(s.kind)}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <C.InlineAlert
          tone="warning"
          title={L('No eligible register entry', 'لا قيد مؤهّل')}
          body={L(
            'Register the sacrament for this person before linking this request.',
            'سجّل السرّ لهذا الشخص قبل ربط هذا الطلب.'
          )}
        />
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="link_save" disabled={!sources.length}>
            {L('Link entry', 'ربط القيد')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#link_save')?.addEventListener('click', () =>
          run(
            () => API.certificateAction(id, 'link-source', { sourceRecordId: el.querySelector('#link_source').value }),
            [
              L('Entry linked', 'رُبط القيد'),
              L('Prepare the certificate and send it to the priest.', 'حضّر الشهادة وأرسلها إلى الكاهن.')
            ],
            L('Could not link source', 'تعذّر ربط المصدر')
          )
        );
      }
    });
  });

  /* Certificates: prepare (freezes the snapshot) and send. Sacraments: record that it was celebrated. */
  host.querySelector('#submit')?.addEventListener('click', () => {
    if (isCertificate)
      return run(
        () => API.sendCertificate(id),
        [L('Sent to the priest', 'أُرسلت إلى الكاهن')],
        L('Could not send the certificate', 'تعذّر إرسال الشهادة'),
        false
      );
    const record = SACRAMENTS.find(s => s.id === id);
    openDrawer({
      title: L('Record the celebration', 'تسجيل الاحتفال'),
      sub: L(
        'Enter what actually took place. The priest then checks it against the register book and registers it.',
        'أدخل ما جرى فعلاً. ثم يطابقه الكاهن مع دفتر السجل ويسجّله.'
      ),
      body: (
        <>
          <div className="formgrid">
            <C.Field
              label={L('Celebration date', 'تاريخ الاحتفال')}
              id="cel_date"
              type="date"
              value={record.date || ''}
              req={true}
            />
            {timeSelect('cel_time', record.time || '')}
          </div>
          {twinFields('cel_place', L('Place', 'المكان'), record.place, record.placeAr)}
          {twinFields('cel_celebrant', L('Celebrant', 'المحتفل'), record.celebrantName, record.celebrantNameAr)}
          {celebrantPick('cel_celebrant_person', record.celebrant)}
          {twinFields(
            'cel_witnesses',
            L('Godparents / witnesses', 'الإشبين / الشهود'),
            record.godparents,
            record.godparentsAr
          )}
          <p className="help">
            {L(
              'Type each spelling as written in the register; one of the two is enough. Neither is filled in from the other.',
              'اكتب كل تهجئة كما في السجل؛ تكفي واحدة منهما. ولا تُملأ إحداهما من الأخرى.'
            )}
          </p>
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="cel_save">
            {L('Record and send for approval', 'تسجيل وإرسال للاعتماد')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#cel_save').addEventListener('click', async () => {
          const v = k => el.querySelector('#' + k)?.value.trim() || '';
          if (!needAll(el, [['#cel_date', L('Enter the date', 'أدخل التاريخ')]])) return;
          if (!v('cel_place') && !v('cel_placeAr') && !need(el, '#cel_place', L('Enter the place', 'أدخل المكان')))
            return;
          if (
            !v('cel_celebrant') &&
            !v('cel_celebrantAr') &&
            !v('cel_celebrant_person') &&
            !need(el, '#cel_celebrant', L('Name the celebrant', 'اذكر المحتفل'))
          )
            return;
          await run(
            () =>
              API.sacramentAction(id, 'record-celebration', {
                celebratedAt: API.toUtc(el.querySelector('#cel_date').value, el.querySelector('#cel_time').value),
                place: v('cel_place'),
                placeAr: v('cel_placeAr'),
                celebrantName: v('cel_celebrant'),
                celebrantNameAr: v('cel_celebrantAr'),
                celebrantPersonId: v('cel_celebrant_person'),
                witnesses: v('cel_witnesses'),
                witnessesAr: v('cel_witnessesAr')
              }),
            [
              L('Celebration recorded', 'سُجّل الاحتفال'),
              L('The priest can now register it.', 'يمكن للكاهن تسجيله الآن.')
            ],
            L('Could not record the celebration', 'تعذّر تسجيل الاحتفال')
          );
        });
      }
    });
  });

  /* The priest's approval: a certificate request is signed for; a celebrated sacrament is registered in the book. */
  host.querySelector('#approve')?.addEventListener('click', () =>
    openModal({
      title: isCertificate
        ? L('Approve this certificate request?', 'اعتماد طلب الشهادة؟')
        : L('Register this entry?', 'تسجيل هذا القيد؟'),
      sub: L(
        'This action is recorded with your account and the time. Check the original register before confirming.',
        'يُسجّل هذا الإجراء باسم حسابك ووقته. راجع السجل الأصلي قبل التأكيد.'
      ),
      body: (
        <>
          {isCertificate ? (
            <p className="help">
              {L(
                'If you keep a signature image under Sacraments, it is attached for printing the paper; it is not an electronic signature.',
                'إن كانت لديك صورة توقيع في صفحة الأسرار فتُرفق لطباعة الورقة؛ وليست توقيعاً إلكترونياً.'
              )}
            </p>
          ) : (
            <div className="formgrid">
              <C.Field label={L('Book (optional)', 'الدفتر (اختياري)')} id="reg_book" value={doc.book || ''} />
              <C.Field label={L('Page (optional)', 'الصفحة (اختياري)')} id="reg_page" value={doc.page || ''} />
            </div>
          )}
          <label className="check">
            <input type="checkbox" id="ack" />{' '}
            <span>
              {L('I have checked the register entry against the bound book.', 'راجعتُ القيد مقابل الدفتر الأصلي.')}
            </span>
          </label>
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>{' '}
          <button className="btn btn-primary" id="confirm" disabled>
            {isCertificate ? L('Approve request', 'اعتماد الطلب') : L('Register entry', 'تسجيل القيد')}
          </button>
        </>
      ),
      onMount(el) {
        const ack = el.querySelector('#ack'),
          ok = el.querySelector('#confirm');
        ack.addEventListener('change', () => (ok.disabled = !ack.checked));
        ok.addEventListener('click', () =>
          run(
            () =>
              isCertificate
                ? API.certificateAction(id, 'sign')
                : API.sacramentAction(id, 'register', {
                    bookReference: el.querySelector('#reg_book')?.value.trim(),
                    registerPage: el.querySelector('#reg_page')?.value.trim()
                  }),
            isCertificate
              ? [
                  L('Request approved', 'اعتُمد الطلب'),
                  L(
                    'It goes to the bishop if his review is required, then it can be issued.',
                    'يذهب إلى المطران إن كانت مراجعته مطلوبة، ثم يمكن إصدارها.'
                  )
                ]
              : [
                  L('Entry registered', 'سُجّل القيد'),
                  L('It now has its official register number.', 'صار له رقم القيد الرسمي.')
                ],
            L('Action could not be completed', 'تعذّر إتمام الإجراء')
          )
        );
      }
    })
  );
  host
    .querySelector('#bishopaccept')
    ?.addEventListener('click', () =>
      run(
        () => API.certificateAction(id, 'accept'),
        [L('Accepted', 'قُبلت'), L('The certificate can now be issued.', 'يمكن الآن إصدار الشهادة.')],
        L('Could not accept', 'تعذّر القبول'),
        false
      )
    );

  host.querySelector('#sign')?.addEventListener('click', () =>
    openModal({
      title: L('Issue this certificate?', 'إصدار هذه الشهادة؟'),
      sub: L(
        'Issuing records who issued it and when. The wet-signed and sealed paper is the official document; this is not a signature.',
        'يسجّل الإصدار من أصدرها ومتى. الورقة الموقَّعة بخط اليد والمختومة هي الوثيقة الرسمية؛ وهذا ليس توقيعاً.'
      ),
      body: (
        <label className="check">
          <input type="checkbox" id="ack" />{' '}
          <span>{L('I have checked the prepared certificate.', 'راجعتُ الشهادة المحضَّرة.')}</span>
        </label>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>{' '}
          <button className="btn btn-primary" id="confirm" disabled>
            {L('Issue certificate', 'إصدار الشهادة')}
          </button>
        </>
      ),
      onMount(el) {
        const ack = el.querySelector('#ack'),
          ok = el.querySelector('#confirm');
        ack.addEventListener('change', () => (ok.disabled = !ack.checked));
        ok.addEventListener('click', () =>
          run(
            () => API.certificateAction(id, 'issue'),
            [
              L('Certificate issued', 'صدرت الشهادة'),
              L('Print it, then record the handover.', 'اطبعها ثم سجّل التسليم.')
            ],
            L('Could not issue the certificate', 'تعذّر إصدار الشهادة')
          )
        );
      }
    })
  );

  /* Electronic authorization: the priest who approved binds the exact prepared content with an authenticator code. */
  host.querySelector('#authorize')?.addEventListener('click', async () => {
    let preview;
    try {
      preview = await API.authorizationPreview(id);
    } catch (e) {
      return toast(L('Nothing to authorize yet', 'لا ما يُفوَّض بعد'), e.message, 'danger');
    }
    openModal({
      title: L('Authorize this certificate electronically?', 'تفويض هذه الشهادة إلكترونياً؟'),
      sub: preview.statement,
      body: (
        <>
          <dl className="dl">
            {Object.entries(preview.content).map(([k, v], i) => (
              <Fragment key={i}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </Fragment>
            ))}
            <dt>{L('Content fingerprint', 'بصمة المحتوى')}</dt>
            <dd className="mono" dir="ltr">
              {preview.contentHash}
            </dd>
          </dl>
          <C.Field
            label={L('Authenticator code', 'رمز المصادقة')}
            id="auth_code"
            req={true}
            dir="ltr"
            autoComplete="one-time-code"
          />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="auth_confirm">
            {L('Authorize', 'تفويض')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#auth_confirm').addEventListener('click', async () => {
          if (!need(el, '#auth_code', L('Enter your authenticator code', 'أدخل رمز المصادقة'))) return;
          await run(
            () => API.authorizeCertificate(id, el.querySelector('#auth_code').value),
            [
              L('Authorized', 'فُوِّضت'),
              L('The certificate now carries a verification code.', 'تحمل الشهادة الآن رمز تحقق.')
            ],
            L('Could not authorize', 'تعذّر التفويض')
          );
        });
      }
    });
  });

  host.querySelector('#release')?.addEventListener('click', () =>
    openDrawer({
      title: L('Record the handover', 'تسجيل التسليم'),
      sub: L(
        'Who received the certificate, how they relate to the person, and how they were identified.',
        'من استلم الشهادة، وصلته بالشخص، وكيف تم التحقق من هويته.'
      ),
      body: (
        <>
          <C.Field label={L('Received by', 'المستلم')} id="rel_name" req={true} />
          <C.Field label={L('Relationship to the person', 'الصلة بالشخص')} id="rel_relation" req={true} />
          <div className="formrow">
            <label className="label" htmlFor="rel_method">
              {L('How they were identified', 'طريقة التحقق')}
            </label>
            <Select id="rel_method">
              <option value="InPerson">{L('In person', 'حضورياً')}</option>
              <option value="VerifiedAccount">{L('Verified account', 'حساب موثَّق')}</option>
              <option value="Representative">{L('Representative', 'وكيل')}</option>
            </Select>
          </div>
          <C.Field label={L('Evidence seen', 'ما اطُّلع عليه')} id="rel_evidence" req={true} />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="rel_save">
            {L('Record handover', 'تسجيل التسليم')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#rel_save').addEventListener('click', async () => {
          if (
            !needAll(el, [
              ['#rel_name', L('Enter who received it', 'أدخل اسم المستلم')],
              ['#rel_relation', L('Enter the relationship', 'أدخل الصلة')],
              ['#rel_evidence', L('Enter the evidence seen', 'أدخل ما اطُّلع عليه')]
            ])
          )
            return;
          await run(
            () =>
              API.certificateAction(id, 'release', {
                recipientName: el.querySelector('#rel_name').value.trim(),
                recipientRelationship: el.querySelector('#rel_relation').value.trim(),
                verificationMethod: el.querySelector('#rel_method').value,
                verificationEvidence: el.querySelector('#rel_evidence').value.trim()
              }),
            [L('Handover recorded', 'سُجّل التسليم')],
            L('Could not record the handover', 'تعذّر تسجيل التسليم')
          );
        });
      }
    })
  );
  withReason('#withdraw', {
    title: L('Withdraw this certificate?', 'سحب هذه الشهادة؟'),
    sub: L('The reason stays in the record.', 'يبقى السبب في السجل.'),
    confirm: L('Withdraw', 'سحب'),
    keep: L('Keep it', 'إبقاؤها'),
    failed: L('Could not withdraw', 'تعذّر السحب'),
    step: reason => API.certificateAction(id, 'withdraw', { reason })
  });
  withReason('#reject', {
    title: isCertificate
      ? L('Return this certificate request?', 'إعادة طلب الشهادة؟')
      : L('Return this entry to the office?', 'إعادة هذا القيد إلى المكتب؟'),
    sub: L('The reason is shown to the office.', 'يظهر السبب للمكتب.'),
    confirm: L('Return', 'إعادة'),
    keep: L('Keep open', 'إبقاؤه مفتوحاً'),
    failed: L('Decision could not be saved', 'تعذّر حفظ القرار'),
    done: [L('Returned', 'أُعيد')],
    step: reason =>
      isCertificate
        ? API.certificateAction(id, 'return', { reason })
        : API.sacramentAction(id, 'return-entry', { reason })
  });
  withReason('#cancelrequest', {
    title: L('Cancel this certificate request?', 'إلغاء طلب الشهادة؟'),
    sub: L('The reason will remain in the record.', 'سيبقى السبب في السجل.'),
    confirm: L('Cancel request', 'إلغاء الطلب'),
    keep: L('Keep open', 'إبقاؤه مفتوحاً'),
    failed: L('Decision could not be saved', 'تعذّر حفظ القرار'),
    done: [L('Request cancelled', 'أُلغي الطلب')],
    step: reason => API.certificateAction(id, 'cancel', { reason })
  });

  /* Corrections to a registered entry: proposed by the office, decided by the priest, appended to its history. */
  host.querySelector('#proposecorrection')?.addEventListener('click', () =>
    openDrawer({
      title: L('Propose a correction', 'اقتراح تصحيح'),
      sub: L(
        'The registered entry stays as it is until the priest approves. The old value, reason and evidence are kept.',
        'يبقى القيد المسجَّل كما هو حتى يعتمد الكاهن. تُحفظ القيمة القديمة والسبب والدليل.'
      ),
      body: (
        <>
          <div className="formrow">
            <label className="label" htmlFor="corr_field">
              {L('What to correct', 'ما يُصحَّح')}
            </label>
            <Select id="corr_field">
              {API.CORRECTABLE.map(([k, en, ar], i) => (
                <option key={i} value={k}>
                  {L(en, ar)}
                </option>
              ))}
            </Select>
          </div>
          <C.Field label={L('Correct value', 'القيمة الصحيحة')} id="corr_value" req={true} />
          <C.Textarea label={L('Reason', 'السبب')} id="corr_reason" max={500} />
          <C.Field label={L('Evidence seen', 'الدليل')} id="corr_evidence" req={true} />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="corr_save">
            {L('Send to the priest', 'إرسال إلى الكاهن')}
          </button>
        </>
      ),
      onMount(el) {
        el.querySelector('#corr_save').addEventListener('click', async () => {
          if (
            !needAll(el, [
              ['#corr_value', L('Enter the correct value', 'أدخل القيمة الصحيحة')],
              ['#corr_reason', L('Enter a reason', 'أدخل السبب')],
              ['#corr_evidence', L('Enter the evidence', 'أدخل الدليل')]
            ])
          )
            return;
          const field = el.querySelector('#corr_field').value,
            value = el.querySelector('#corr_value').value.trim();
          await run(
            () =>
              API.proposeCorrection(id, {
                field,
                newValue: field === 'celebratedAt' ? API.toUtc(value) : value,
                reason: el.querySelector('#corr_reason').value.trim(),
                evidence: el.querySelector('#corr_evidence').value.trim()
              }),
            [L('Correction proposed', 'اقتُرح التصحيح')],
            L('Could not propose the correction', 'تعذّر اقتراح التصحيح')
          );
        });
      }
    })
  );
  for (const [attr, approve] of [
    ['corr-approve', true],
    ['corr-reject', false]
  ])
    host.querySelectorAll(`[data-${attr}]`).forEach(button =>
      button.addEventListener('click', () => {
        const correction = SACRAMENTS.find(s => s.id === id)?.pendingCorrections.find(
          c => c.id === button.dataset[attr === 'corr-approve' ? 'corrApprove' : 'corrReject']
        );
        if (!correction) return;
        openModal({
          title: approve
            ? L('Approve this correction?', 'اعتماد هذا التصحيح؟')
            : L('Reject this correction?', 'رفض هذا التصحيح؟'),
          body: <C.Textarea label={L('Note', 'ملاحظة')} id="corr_note" max={500} />,
          foot: (
            <>
              <button className="btn btn-secondary" data-close="">
                {L('Back', 'رجوع')}
              </button>
              <button className="btn btn-primary" id="corr_confirm">
                {approve ? L('Approve', 'اعتماد') : L('Reject', 'رفض')}
              </button>
            </>
          ),
          onMount(el) {
            el.querySelector('#corr_confirm').addEventListener('click', async () => {
              if (!need(el, '#corr_note', L('Enter a note', 'أدخل ملاحظة'))) return;
              await run(
                () => API.decideCorrection(correction, approve, el.querySelector('#corr_note').value.trim()),
                [approve ? L('Correction approved', 'اعتُمد التصحيح') : L('Correction rejected', 'رُفض التصحيح')],
                L('Could not save the decision', 'تعذّر حفظ القرار')
              );
            });
          }
        });
      })
    );
};
