(() => {
  'use strict';
  let dirty = false;
  for (const form of document.querySelectorAll('form[data-track-changes]')) {
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('submit', () => { dirty = false; });
  }
  window.addEventListener('beforeunload', event => {
    if (dirty) { event.preventDefault(); event.returnValue = ''; }
  });
  const draftDialog = document.getElementById('draft-dialog');
  let destination;
  for (const link of document.querySelectorAll('[data-language-link]')) {
    link.addEventListener('click', event => {
      if (!dirty || !document.querySelector('form[data-save-draft]') || !draftDialog) return;
      event.preventDefault(); destination = link.href; draftDialog.showModal();
    });
  }
  for (const button of document.querySelectorAll('[data-draft-choice]')) {
    button.addEventListener('click', async () => {
      if (button.dataset.draftChoice === 'stay') { draftDialog.close(); return; }
      if (button.dataset.draftChoice === 'discard') { dirty = false; location.assign(destination); return; }
      const form = document.querySelector('form[data-save-draft]');
      const failure = document.getElementById('draft-failure');
      button.disabled = true;
      try {
        const target = new URL(form.action); target.searchParams.set('handler', 'SaveDraft');
        const response = await fetch(target, { method: 'POST', body: new FormData(form) });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('save');
        const saved = await response.json();
        form.elements.Id.value = saved.id; form.elements.Revision.value = saved.revision; form.elements.OperationId.value = saved.operationId;
        const next = new URL(destination); const resume = new URL('/Requests/Edit', location.origin);
        resume.searchParams.set('id', saved.id);
        const acting = new URL(location.href).searchParams.get('actingAs'); if (acting) resume.searchParams.set('actingAs', acting);
        next.searchParams.set('returnUrl', resume.pathname + resume.search);
        dirty = false; location.assign(next);
      } catch {
        failure.textContent = draftDialog.dataset.failure;
      } finally { button.disabled = false; }
    });
  }
  for (const button of document.querySelectorAll('[data-confirm]')) {
    button.addEventListener('click', event => {
      if (!window.confirm(button.dataset.confirm)) { event.preventDefault(); event.stopPropagation(); }
    });
  }
  for (const form of document.querySelectorAll('form')) {
    form.addEventListener('submit', () => {
      // Wait until native form serialization has captured the chosen action button.
      setTimeout(() => { for (const button of form.querySelectorAll('button[type=submit], button:not([type])')) button.disabled = true; }, 0);
    });
  }
  const error = document.querySelector('[role=alert]');
  if (error && error.textContent.trim()) { error.setAttribute('tabindex', '-1'); error.focus(); }
  // Keep only appearance preferences locally; never serialize forms, evidence, tokens or passwords.
  try { const theme = localStorage.getItem('pl-theme'); if (theme) document.documentElement.dataset.theme = theme; } catch { }
  document.getElementById('themeBtn')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pl-theme', next); } catch { }
  });
  // A browser back-forward cache must not restore a protected stale view after revocation/logout.
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
})();
