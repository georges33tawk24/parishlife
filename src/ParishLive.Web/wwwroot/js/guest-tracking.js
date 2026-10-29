(() => {
  const token = location.hash.slice(1);
  const form = document.getElementById('guest-tracking');
  if (form?.dataset.lookup === 'true' && /^[a-f0-9]{64}$/i.test(token)) {
    form.elements.Secret.value = token;
    // Keep the fragment as the user's recoverable bookmark. It is never sent to the server by navigation.
    form.requestSubmit();
  }
})();
