const PrototypeMotion = (() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const easing = 'cubic-bezier(.22,.8,.25,1)';
  const animations = new Set();
  const ghosts = new Map();
  let scrollFrame;
  let editorRun = 0;

  const scale = () => document.querySelector('#app').getBoundingClientRect().width / 375 || 1;
  const visible = element => element && !element.hidden && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';

  function animate(element, keyframes, options = {}) {
    if (preference.matches || !visible(element)) return Promise.resolve();
    element.getAnimations().forEach(animation => animation.cancel());
    const { persist = false, ...timing } = options;
    const animation = element.animate(keyframes, { duration: 240, easing, fill: 'both', ...timing });
    animations.add(animation);
    return animation.finished.catch(() => {}).finally(() => {
      animations.delete(animation);
      if (!persist) animation.cancel();
    });
  }

  function cancel(element) {
    element.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
  }

  function clearGhosts() {
    for (const [ghost, cleanup] of ghosts) {
      cancel(ghost);
      ghost.remove();
      cleanup?.();
    }
    ghosts.clear();
  }

  function removeGhost(ghost) {
    const cleanup = ghosts.get(ghost);
    ghosts.delete(ghost);
    cancel(ghost);
    ghost.remove();
    cleanup?.();
  }

  function clone(element, cleanup) {
    if (preference.matches || !visible(element)) return null;
    const ghost = element.cloneNode(true);
    const originals = [element, ...element.querySelectorAll('*')];
    const copies = [ghost, ...ghost.querySelectorAll('*')];
    originals.forEach((original, index) => {
      const copy = copies[index];
      const style = getComputedStyle(original);
      copy.removeAttribute('id');
      if (style.transform !== 'none') copy.style.transform = style.transform;
      if (style.opacity !== '1') copy.style.opacity = style.opacity;
      if (index === 0) copy.style.backgroundColor = style.backgroundColor;
      if (original.matches('.custom-input')) copy.style.width = style.width;
    });
    ghost.classList.add('motion-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghosts.set(ghost, cleanup);
    document.querySelector('#app').append(ghost);
    return ghost;
  }

  function snapshot() {
    const items = new Map();
    if (preference.matches || !visible(document.querySelector('#screen'))) return items;
    document.querySelectorAll('#catalog .product').forEach(element => {
      if (visible(element)) items.set(element.dataset.id, element.getBoundingClientRect());
    });
    return items;
  }

  function moveFrom(element, origin, options) {
    if (!origin || preference.matches || !visible(element)) return Promise.resolve();
    const destination = element.getBoundingClientRect();
    const dx = (origin.left - destination.left) / scale();
    const dy = (origin.top - destination.top) / scale();
    return animate(element, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }], options);
  }

  function layout(previous) {
    if (!previous.size || preference.matches) return;
    document.querySelectorAll('#catalog .product').forEach(element => {
      if (!visible(element)) return;
      const origin = previous.get(element.dataset.id);
      if (!origin) animate(element, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180 });
      else if (Math.abs(origin.top - element.getBoundingClientRect().top) > 1) moveFrom(element, origin, { duration: 280 });
    });
  }

  function regroup(previous) {
    if (!previous.size || preference.matches) return;
    const viewport = document.querySelector('#scroll').getBoundingClientRect();
    const factor = scale();
    let entering = 0;
    for (const row of document.querySelectorAll('#catalog .product')) {
      const next = row.getBoundingClientRect();
      if (next.bottom < viewport.top || next.top > viewport.bottom) continue;
      const old = previous.get(row.dataset.id);
      const delta = old ? (old.top - next.top) / factor : Infinity;
      if (Math.abs(delta) < 1) continue;
      if (Math.abs(delta) <= 150) {
        moveFrom(row, old, { duration: 310 });
      } else {
        animate(row, [{ opacity: .15, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], {
          duration: 240, delay: Math.min(entering++, 4) * 16
        });
      }
    }
  }

  function captureSelection(willShow) {
    const calculator = document.querySelector('.calculator');
    const pill = document.querySelector('#select-all');
    const shown = visible(calculator);
    const rect = visible(pill) ? pill.getBoundingClientRect() : null;
    let ghost;
    if (shown && !willShow && !preference.matches) {
      const app = document.querySelector('#app').getBoundingClientRect();
      const bounds = calculator.getBoundingClientRect();
      ghost = clone(calculator);
      Object.assign(ghost.style, { position: 'absolute', left: `${(bounds.left - app.left) / scale()}px`, top: `${(bounds.top - app.top) / scale()}px`, zIndex: '20' });
    }
    return { shown, rect, ghost, count: document.querySelector('#selection-count').textContent };
  }

  function selection(previous) {
    const calculator = document.querySelector('.calculator');
    if (previous.ghost) animate(previous.ghost, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(18px)' }], { duration: 180, persist: true }).then(() => removeGhost(previous.ghost));
    if (!previous.shown && visible(calculator)) animate(calculator, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280 });
    moveFrom(document.querySelector('#select-all'), previous.rect, { duration: 280 });
    const count = document.querySelector('#selection-count');
    if (previous.count !== count.textContent) animate(count, [{ opacity: .4 }, { opacity: 1 }], { duration: 160 });
  }

  function openEditor(origin) {
    const run = ++editorRun;
    const editor = document.querySelector('#editor');
    editor.classList.add('is-moving');
    const opening = [
      animate(editor, [{ backgroundColor: '#0000' }, { backgroundColor: '#0009' }], { duration: 260 }),
      animate(editor.querySelector('.editor-controls'), [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 320 }),
      moveCard(editor.querySelector('.editor-product'), origin)
    ];
    Promise.all(opening).then(() => { if (run === editorRun) editor.classList.remove('is-moving'); });
  }

  function moveCard(card, origin) {
    if (!origin) return Promise.resolve();
    const destination = card.getBoundingClientRect();
    return animate(card, [
      { transform: `translate(${(origin.left - destination.left) / scale()}px,${(origin.top - destination.top) / scale()}px)`, paddingLeft: '0px', paddingRight: '0px' },
      { transform: 'translate(0,0)', paddingLeft: '10px', paddingRight: '10px' }
    ], { duration: 320 });
  }

  function closeEditor(ghost, target) {
    editorRun++;
    if (!ghost) return;
    ghost.classList.add('is-moving');
    const card = ghost.querySelector('.editor-product');
    const transform = getComputedStyle(card).transform;
    const matrix = new DOMMatrix(transform === 'none' ? undefined : transform);
    if (target) {
      const current = card.getBoundingClientRect();
      matrix.e += (target.left - current.left) / scale();
      matrix.f += (target.top - current.top) / scale();
    }
    const closing = [
      animate(ghost, [{ backgroundColor: getComputedStyle(ghost).backgroundColor }, { backgroundColor: '#0000' }], { duration: 220, persist: true }),
      animate(ghost.querySelector('.editor-controls'), [{ transform: getComputedStyle(ghost.querySelector('.editor-controls')).transform }, { transform: 'translateY(100%)' }], { duration: 280, persist: true }),
      animate(card, target ? [{ transform, paddingLeft: getComputedStyle(card).paddingLeft, paddingRight: getComputedStyle(card).paddingRight }, { transform: matrix.toString(), paddingLeft: '0px', paddingRight: '0px' }] : [{ opacity: 1, transform }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 260, persist: true })
    ];
    Promise.all(closing).then(() => removeGhost(ghost));
  }

  function openSheet(backdrop) {
    animate(backdrop, [{ backgroundColor: '#0000' }, { backgroundColor: '#0006' }], { duration: 220 });
    animate(backdrop.querySelector('.sheet'), [{ transform: 'translateY(28px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 280 });
  }

  function closeSheet(ghost) {
    if (!ghost) return;
    Promise.all([
      animate(ghost, [{ backgroundColor: getComputedStyle(ghost).backgroundColor }, { backgroundColor: '#0000' }], { duration: 180, persist: true }),
      animate(ghost.querySelector('.sheet'), [{ transform: getComputedStyle(ghost.querySelector('.sheet')).transform, opacity: getComputedStyle(ghost.querySelector('.sheet')).opacity }, { transform: 'translateY(32px)', opacity: 0 }], { duration: 200, persist: true })
    ]).then(() => removeGhost(ghost));
  }

  function keepInView(id) {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      if (!visible(document.querySelector('#screen')) || !document.querySelector('#editor').hidden) return;
      const item = document.querySelector(`[data-id="${id}"]`);
      if (!visible(item)) return;
      const scroll = document.querySelector('#scroll');
      const header = document.querySelector('#catalog-header');
      const row = item.getBoundingClientRect();
      const top = visible(header) ? header.getBoundingClientRect().bottom + 12 : scroll.getBoundingClientRect().top + 16;
      const bottom = document.querySelector('.selection').getBoundingClientRect().top - 12;
      const delta = row.bottom > bottom ? row.bottom - bottom : row.top < top ? row.top - top : 0;
      if (Math.abs(delta) > 1) scroll.scrollTo({ top: scroll.scrollTop + delta / scale(), behavior: preference.matches ? 'auto' : 'smooth' });
    });
  }

  function reset() {
    editorRun++;
    cancelAnimationFrame(scrollFrame);
    clearGhosts();
    animations.forEach(animation => animation.cancel());
    document.querySelector('#editor').classList.remove('is-moving');
    const scroll = document.querySelector('#scroll');
    scroll.scrollTo({ top: scroll.scrollTop, behavior: 'auto' });
  }
  preference.addEventListener('change', reset);
  return { animate, cancel, clearGhosts, clone, snapshot, layout, regroup, captureSelection, selection, openEditor, closeEditor, openSheet, closeSheet, keepInView, reset, get scrollBehavior() { return preference.matches ? 'auto' : 'smooth'; } };
})();
