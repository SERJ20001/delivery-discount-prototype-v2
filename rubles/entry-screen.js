const EntryScreen = (() => {
  const picker = document.querySelector('#variants-screen');
  const offers = document.querySelector('#offers-screen');
  const delivery = document.querySelector('#screen');
  const trigger = document.querySelector('#open-delivery');
  function requestedVariant() {
    const value = new URLSearchParams(location.search).get('variant');
    return ['1', '2', '3', '4'].includes(value) ? Number(value) : null;
  }
  const variant = requestedVariant() ?? 1;
  let enter;
  let leave;

  function currentPage() {
    if (location.hash === '#delivery') return 'delivery';
    if (location.hash === '#offers' || (location.hash === '' && requestedVariant())) return 'offers';
    return 'variants';
  }

  function showPage() {
    const page = currentPage();
    if (page !== 'variants' && (requestedVariant() ?? 1) !== variant) {
      location.reload();
      return;
    }
    if (!delivery.hidden && page !== 'delivery') leave();
    picker.hidden = page !== 'variants';
    offers.hidden = page !== 'offers';
    delivery.hidden = page !== 'delivery';
    if (page === 'delivery') enter();
    else document.querySelector(page === 'offers' ? '#offers-title' : '#variants-title').focus({ preventScroll: true });
  }

  function navigate(url) {
    history.pushState({ from: currentPage() }, '', url);
    showPage();
  }

  function back() {
    const parent = currentPage() === 'delivery' ? 'offers' : 'variants';
    if (history.state?.from === parent) history.back();
    else {
      history.replaceState(null, '', '#' + parent);
      showPage();
    }
  }

  function start(onEnter, onLeave) {
    enter = onEnter;
    leave = onLeave;
    picker.addEventListener('click', event => {
      const link = event.target.closest('[data-variant]');
      if (!link || location.protocol === 'file:' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(link.href);
    });
    document.querySelector('#back-to-variants').addEventListener('click', back);
    trigger.addEventListener('click', () => navigate('#delivery'));
    window.addEventListener('popstate', showPage);
    showPage();
  }

  function updateCount(count, word) {
    document.querySelector('#offer-delivery-status').textContent = count ? `${count} ${word} со скидкой` : 'Отключена';
  }

  return { start, back, updateCount, variant };
})();
