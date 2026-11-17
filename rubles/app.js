const { limits } = DiscountModel;
const asset = name => `assets/current/${name}`;
const allItems = categories.flatMap(category => category.items);
const inventory = [...allItems, previousItem];
const state = { tab: 'eligible', selected: new Set(), applied: new Map([[previousItem.id, calculateAmount(previousItem, 300)]]), previews: new Map(), editor: null };
const money = value => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
const word = count => count % 10 === 1 && count % 100 !== 11 ? 'товар' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'товара' : 'товаров';
const $ = selector => document.querySelector(selector);
const app = $('#app');
const amountMeasure = document.createElement('canvas').getContext('2d');
const visibleItems = () => inventory.filter(item => state.tab === 'eligible' ? !state.applied.has(item.id) : state.applied.has(item.id));
const chosenItems = () => visibleItems().filter(item => state.selected.has(item.id));
const groupItems = index => visibleItems().filter(item => categories[index].items.includes(item) || (index === 0 && item === previousItem));
let toastTimer;
let toastRun = 0;
let editorTrigger;

function calculateAmount(item, requestedAmount) {
  const requested = Number(requestedAmount);
  if (requestedAmount === null || String(requestedAmount).trim() === '' || !Number.isFinite(requested) || requested < 0) return null;
  const { minimum, maximum } = limits(item.price);
  const amount = Math.min(maximum, Math.max(minimum, Math.round(requested)));
  return { amount, requestedAmount: requested, minimum, maximum, limited: amount !== requested };
}

function optimalAmount(item) {
  const { minimum, maximum } = limits(item.price);
  return calculateAmount(item, Math.round((minimum + maximum) / 2));
}

const recipientWord = count => count % 10 === 1 && count % 100 !== 11 ? 'товару' : 'товарам';
const genitiveWord = count => count % 10 === 1 && count % 100 !== 11 ? 'товара' : 'товаров';

function singlePresets(item) {
  return [...new Set([100, 200, 300].map(value => calculateAmount(item, value).amount))];
}

function preview(item) {
  return state.selected.has(item.id) ? state.previews.get(item.id) : state.applied.get(item.id);
}

function checkbox(selected) {
  return `<img class="check-image" src="${selected ? asset('a4747.svg') : 'assets/checkbox-inactive.svg'}" alt="">`;
}
function photo(item) {
  return item.images.map(image => `<img src="${asset(image)}" alt="">`).join('');
}
function productMarkup(item) {
  const selected = state.selected.has(item.id);
  const result = preview(item);
  const chip = result ? `<button class="discount-chip" data-edit="${item.id}" aria-label="Изменить скидку: ${item.title}, ${money(result.amount)}"><span>${money(result.amount)}</span><img src="${asset('86592.svg')}" alt=""></button>` : '';
  return `<article class="product" data-id="${item.id}"><button class="product-select" data-select="${item.id}" aria-pressed="${selected}" aria-label="${selected ? 'Снять выбор' : 'Выбрать'}: ${item.title}, ${money(item.price)}"><span class="product-photo">${photo(item)}</span><span class="product-check">${checkbox(selected)}</span><span class="product-body"><strong class="product-price">${money(item.price)}</strong><span class="product-title">${item.title}</span></span></button>${chip}</article>`;
}
function presetButtons(item, selectedAmount, attribute) {
  return singlePresets(item).map(amount => `<button class="chip ${amount === selectedAmount ? 'active' : ''}" ${attribute}="${amount}" aria-pressed="${amount === selectedAmount}">${money(amount)}</button>`).join('');
}

function render(animate = true) {
  const positions = animate ? PrototypeMotion.snapshot() : new Map();
  const selection = animate ? PrototypeMotion.captureSelection(chosenItems().length > 0) : null;
  const eligibleCount = inventory.length - state.applied.size;
  if (!eligibleCount) state.tab = 'discounted';
  const chosen = chosenItems();
  const discounted = state.tab === 'discounted';
  app.classList.toggle('discounted', discounted);
  app.classList.toggle('no-selection', chosen.length === 0);
  EntryScreen.updateCount(state.applied.size, word(state.applied.size));
  $('#offer-recommendation-total').textContent = `${inventory.length} ${word(inventory.length) === 'товар' ? 'объявление' : word(inventory.length) === 'товара' ? 'объявления' : 'объявлений'}`;
  $('[data-tab="eligible"]').hidden = eligibleCount === 0;
  $('#eligible-count').textContent = eligibleCount;
  $('#discounted-count').textContent = state.applied.size;
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === state.tab);
    button.setAttribute('aria-pressed', String(button.dataset.tab === state.tab));
  });
  $('#catalog').innerHTML = categories.map((category, index) => {
    const items = groupItems(index);
    if (!items.length) return '';
    const checked = items.every(item => state.selected.has(item.id));
    return `<section class="category" data-group="${index}"><h2 class="category-title"><button data-category="${index}" aria-pressed="${checked}">${checkbox(checked)}<span>${category.name}</span></button></h2>${items.map(productMarkup).join('')}</section>`;
  }).join('') || '<p class="empty">Здесь пока нет товаров</p>';
  $('.calculator').hidden = chosen.length === 0;
  $('#selection-count').textContent = chosen.length ? `${chosen.length} ${word(chosen.length)}` : 'Выбрать все';
  $('#select-all').disabled = !visibleItems().length;
  $('#select-all').setAttribute('aria-pressed', String(chosen.length > 0));
  $('#select-all').setAttribute('aria-label', chosen.length === visibleItems().length ? 'Снять выбор со всех товаров' : 'Выбрать все товары');
  $('#select-all').querySelector('img').src = chosen.length > 0 ? asset('54616.svg') : asset('9befd.svg');
  if (chosen.length > 1) {
    const optimal = chosen.every(item => preview(item).amount === optimalAmount(item).amount);
    $('#options').innerHTML = `<button class="chip ${optimal ? 'active' : ''}" data-range="optimal" aria-pressed="${optimal}">Оптимальная</button><button class="chip custom-option" id="edit-bulk">Своя<img src="${asset('49135.svg')}" alt=""></button>`;
  } else if (chosen.length === 1) {
    const item = chosen[0];
    const amount = preview(item).amount;
    const custom = !singlePresets(item).includes(amount);
    $('#options').innerHTML = presetButtons(item, amount, 'data-amount') + `<button class="chip custom-option ${custom ? 'active' : ''}" id="edit" data-edit="${item.id}">Своя<img src="${asset('49135.svg')}" alt=""></button>`;
  } else $('#options').innerHTML = '';
  const removing = discounted && chosen.length > 0 && chosen.every(item => preview(item).amount === state.applied.get(item.id).amount);
  $('#apply').textContent = removing ? 'Удалить скидку' : 'Применить';
  $('#apply').classList.toggle('secondary', removing);
  $('#apply').disabled = chosen.length === 0;
  renderCategoryNavigation();
  PrototypeMotion.layout(positions);
  if (selection) PrototypeMotion.selection(selection);
}

function renderCategoryNavigation() {
  $('#category-nav').innerHTML = categories.map((category, index) => {
    const count = groupItems(index).length;
    return count ? `<button class="chip" data-jump="${index}">${category.name} · ${count}</button>` : '';
  }).join('');
  updateCategoryNavigation();
}
function updateCategoryNavigation() {
  const scroll = $('#scroll');
  const header = $('#catalog-header');
  header.hidden = scroll.scrollTop < 308;
  if (header.hidden) return;
  const groups = [...document.querySelectorAll('[data-group]')];
  const active = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1 ? groups.at(-1) : groups.findLast(group => group.offsetTop <= scroll.scrollTop + 150) || groups[0];
  document.querySelectorAll('[data-jump]').forEach(button => {
    const selected = button.dataset.jump === active?.dataset.group;
    const changed = button.classList.contains('active') !== selected;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-current', String(selected));
    if (selected && changed) button.parentElement.scrollTo({ left: button.offsetLeft - 68, behavior: PrototypeMotion.scrollBehavior });
  });
}
function prepareSelection() {
  const chosen = chosenItems();
  for (const item of chosen) {
    if (state.previews.has(item.id)) continue;
    const result = state.applied.get(item.id) ?? (chosen.length === 1 ? calculateAmount(item, singlePresets(item)[0]) : optimalAmount(item));
    state.previews.set(item.id, result);
  }
}

function openEditor(itemId = null) {
  const item = itemId ? inventory.find(product => product.id === itemId) : null;
  const items = item ? [item] : chosenItems();
  if (!items.length) return;
  PrototypeMotion.clearGhosts();
  PrototypeMotion.cancel($('#editor'));
  $('#scroll').scrollTo({ top: $('#scroll').scrollTop, behavior: 'auto' });
  const origin = item ? $(`[data-id="${item.id}"]`).getBoundingClientRect() : null;
  const positions = PrototypeMotion.snapshot();
  editorTrigger = document.activeElement;
  const commonMinimum = Math.max(...items.map(product => limits(product.price).minimum));
  const commonMaximum = Math.min(...items.map(product => limits(product.price).maximum));
  const amounts = items.map(product => preview(product)?.amount ?? optimalAmount(product).amount).sort((a, b) => a - b);
  const middle = amounts[Math.floor(amounts.length / 2)];
  const initial = item ? amounts[0] : commonMinimum <= commonMaximum ? Math.max(commonMinimum, Math.min(commonMaximum, middle)) : middle;
  state.editor = { item, items: [...items], draft: String(initial), scrollTop: $('#scroll').scrollTop };
  hideToast();
  setEditorProductVisibility();
  PrototypeMotion.layout(positions);
  $('#screen').inert = true;
  $('#editor').hidden = false;
  $('#editor').classList.toggle('bulk-editor', !item);
  $('#editor').classList.toggle('individual-editor', Boolean(item));
  $('#editor').setAttribute('aria-label', item ? `Скидка: ${item.title}` : 'Скидка для выбранных товаров');
  $('#editor-product').hidden = !item;
  $('#editor-options').innerHTML = `<label class="custom-input"><input id="amount" type="text" inputmode="none" autocomplete="off" maxlength="6" aria-label="Сумма скидки в рублях"><span id="amount-suffix">₽</span></label><div class="amount-slider"><input id="amount-slider" type="range" step="1" aria-label="Скидка на слайдере"><div class="slider-labels"><span id="minimum-label"></span><span id="maximum-label"></span></div></div><div id="limit-tooltip" class="limit-tooltip" role="tooltip" aria-live="polite" hidden></div>`;
  updateEditor();
  $('#amount').focus({ preventScroll: true });
  $('#amount').select();
  PrototypeMotion.openEditor(origin);
}
function updateEditor() {
  const { item, items, draft } = state.editor;
  const results = items.map(product => calculateAmount(product, draft));
  const result = results[0];
  const minimum = Math.min(...items.map(product => limits(product.price).minimum));
  const maximum = Math.max(...items.map(product => limits(product.price).maximum));
  if (item) $('#editor-product').innerHTML = `<div class="product-photo">${photo(item)}</div><div class="product-body"><strong class="product-price">${money(item.price)}</strong><p class="product-title" id="editor-product-title">${item.title}</p><span class="editor-discount ${result ? '' : 'placeholder'}">${result ? money(result.requestedAmount) : 'Скидка ₽'}</span></div>`;
  const input = $('#amount');
  if (input.value !== draft) input.value = draft;
  amountMeasure.font = getComputedStyle(input).font;
  input.style.width = draft ? `${Math.ceil(amountMeasure.measureText(draft).width) + 1}px` : '112px';
  input.placeholder = `от ${minimum} ₽`;
  $('#amount-suffix').hidden = !draft;
  const slider = $('#amount-slider');
  slider.min = minimum;
  slider.max = maximum;
  slider.value = draft || minimum;
  const position = maximum === minimum ? 0 : (Number(slider.value) - minimum) / (maximum - minimum) * 100;
  slider.style.setProperty('--position', `${position}%`);
  slider.setAttribute('aria-valuetext', money(Number(slider.value)));
  $('#minimum-label').textContent = money(minimum);
  $('#maximum-label').textContent = money(maximum);
  const connected = item && state.applied.has(item.id);
  $('#done').disabled = !result;
  $('#done').textContent = item ? connected ? 'Сохранить' : 'Применить скидку' : `Применить скидку ${items.length} ${recipientWord(items.length)}`;
  $('#cancel-edit').hidden = !item || connected;
  $('#remove-discount').hidden = !connected;
  const limited = item && result?.limited === true;
  $('#limit-tooltip').hidden = !limited;
  $('#limit-tooltip').textContent = limited ? `${result.requestedAmount < minimum ? 'Минимальная' : 'Максимальная'}: ${money(result.amount)}` : '';
  const lower = results.filter(value => value && value.requestedAmount < value.minimum).length;
  const upper = results.filter(value => value && value.requestedAmount > value.maximum).length;
  const notices = [];
  if (lower) notices.push(`<div><p>Скидка меньше минимальной для ${lower} ${genitiveWord(lower)}</p><p>Установим ${lower === 1 ? 'ему' : 'им'} минимально возможную скидку</p></div>`);
  if (upper) notices.push(`<div><p>Скидка больше максимальной для ${upper} ${genitiveWord(upper)}</p><p>Установим ${upper === 1 ? 'ему' : 'им'} максимально возможную скидку</p></div>`);
  $('#bulk-notice').hidden = Boolean(item) || !notices.length;
  $('#bulk-notice').innerHTML = `<img src="${asset('bc31a.svg')}" alt=""><div>${notices.join('')}</div>`;
  const description = limited ? 'limit-tooltip' : !$('#bulk-notice').hidden ? 'bulk-notice' : null;
  if (description) input.setAttribute('aria-describedby', description);
  else input.removeAttribute('aria-describedby');
}
function setDraft(value, caret) {
  if (!state.editor) return;
  state.editor.draft = value.replace(/\D/g, '').slice(0, 6).replace(/^0+(?=\d)/, '');
  updateEditor();
  const next = Math.min(caret ?? state.editor.draft.length, state.editor.draft.length);
  $('#amount').setSelectionRange(next, next);
}
function setEditorProductVisibility() {
  document.querySelectorAll('#catalog .product').forEach(product => {
    product.hidden = product.dataset.id === state.editor?.item?.id;
  });
}
function closeEditor(returnToList = true) {
  if (!state.editor) return;
  const { item, scrollTop } = state.editor;
  const positions = PrototypeMotion.snapshot();
  const row = item ? $(`[data-id="${item.id}"]`) : null;
  const ghost = PrototypeMotion.clone($('#editor'), () => { if (row) row.style.visibility = ''; });
  PrototypeMotion.cancel($('#editor'));
  state.editor = null;
  if (returnToList) setEditorProductVisibility();
  $('#scroll').scrollTop = scrollTop;
  $('#editor').hidden = true;
  $('#screen').inert = false;
  const target = returnToList && row ? row.getBoundingClientRect() : null;
  if (target && ghost) row.style.visibility = 'hidden';
  if (returnToList) PrototypeMotion.layout(positions);
  PrototypeMotion.closeEditor(ghost, target);
  (editorTrigger?.isConnected ? editorTrigger : $('#select-all')).focus({ preventScroll: true });
}
function commitEditor() {
  const { item, items, draft } = state.editor;
  if (!calculateAmount(items[0], draft)) return;
  const updating = item && state.applied.has(item.id);
  for (const product of items) {
    state.applied.set(product.id, calculateAmount(product, draft));
    state.selected.delete(product.id);
    state.previews.delete(product.id);
  }
  prepareSelection();
  closeEditor(false);
  render();
  $('#select-all').focus({ preventScroll: true });
  notify(updating ? 'Сохранили скидку на товар' : `Применили скидку ${items.length} ${recipientWord(items.length)}`);
}
function notify(message) {
  hideToast();
  const run = toastRun;
  const toast = $('#toast');
  $('#toast-message').textContent = message;
  toast.hidden = false;
  PrototypeMotion.animate(toast, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220 });
  toastTimer = setTimeout(async () => {
    await PrototypeMotion.animate(toast, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(6px)' }], { duration: 180, persist: true });
    if (run === toastRun) hideToast();
  }, 2500);
}
function hideToast() {
  toastRun++;
  clearTimeout(toastTimer);
  PrototypeMotion.cancel($('#toast'));
  $('#toast').hidden = true;
}

$('#catalog').addEventListener('click', event => {
  const edit = event.target.closest('[data-edit]');
  if (edit) return openEditor(edit.dataset.edit);
  const product = event.target.closest('[data-select]');
  const category = event.target.closest('[data-category]');
  PrototypeMotion.clearGhosts();
  if (product) state.selected.has(product.dataset.select) ? state.selected.delete(product.dataset.select) : state.selected.add(product.dataset.select);
  else if (category) {
    const items = groupItems(Number(category.dataset.category));
    const checked = items.every(item => state.selected.has(item.id));
    items.forEach(item => checked ? state.selected.delete(item.id) : state.selected.add(item.id));
  }
  prepareSelection();
  render();
  if (product && state.selected.has(product.dataset.select)) PrototypeMotion.keepInView(product.dataset.select);
});
$('#select-all').addEventListener('click', () => {
  PrototypeMotion.clearGhosts();
  const items = visibleItems();
  state.selected = new Set(chosenItems().length === items.length ? [] : items.map(item => item.id));
  prepareSelection();
  render();
});
$('#options').addEventListener('click', event => {
  if (event.target.closest('#edit-bulk')) return openEditor();
  const edit = event.target.closest('[data-edit]');
  if (edit) return openEditor(edit.dataset.edit);
  const range = event.target.closest('[data-range]');
  const amount = event.target.closest('[data-amount]');
  if (range) {
    chosenItems().forEach(item => state.previews.set(item.id, optimalAmount(item)));
  }
  if (amount) {
    const item = chosenItems()[0];
    state.previews.set(item.id, calculateAmount(item, amount.dataset.amount));
  }
  render();
});
$('#editor-options').addEventListener('input', event => {
  if (event.target.id === 'amount') setDraft(event.target.value, event.target.selectionStart);
  if (event.target.id === 'amount-slider') setDraft(event.target.value);
});
$('#dismiss-toast').addEventListener('click', hideToast);
$('#done').addEventListener('click', commitEditor);
$('#cancel-edit').addEventListener('click', () => closeEditor());
$('#cancel-area').addEventListener('click', () => closeEditor());
$('#remove-discount').addEventListener('click', () => {
  state.applied.delete(state.editor.item.id);
  state.selected.delete(state.editor.item.id);
  state.previews.delete(state.editor.item.id);
  closeEditor(false); render();
  $('#select-all').focus({ preventScroll: true });
  notify('Удалили скидку на товар');
});
$('#apply').addEventListener('click', () => {
  const chosen = chosenItems();
  if (!chosen.length) return;
  const removing = state.tab === 'discounted' && chosen.every(item => preview(item).amount === state.applied.get(item.id).amount);
  if (removing) chosen.forEach(item => state.applied.delete(item.id));
  else chosen.map(item => [item.id, preview(item)]).forEach(([id, result]) => state.applied.set(id, result));
  chosen.forEach(item => state.previews.delete(item.id));
  state.selected.clear(); render();
  notify(removing ? `Удалили скидку у ${chosen.length} ${genitiveWord(chosen.length)}` : `Применили скидку ${chosen.length} ${recipientWord(chosen.length)}`);
});
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  PrototypeMotion.reset();
  state.tab = button.dataset.tab; state.selected.clear(); state.previews.clear();
  $('#scroll').scrollTop = 0; render(false);
  PrototypeMotion.animate($('#catalog'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220 });
}));
document.querySelectorAll('.back').forEach(button => button.addEventListener('click', EntryScreen.back));
$('#scroll').addEventListener('scroll', updateCategoryNavigation, { passive: true });
$('#category-nav').addEventListener('click', event => {
  const button = event.target.closest('[data-jump]');
  if (!button) return;
  const group = $(`[data-group="${button.dataset.jump}"]`);
  $('#scroll').scrollTo({ top: Math.max(308, group.offsetTop - 142), behavior: PrototypeMotion.scrollBehavior });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.editor) { event.preventDefault(); closeEditor(); }
  else if (event.key === 'Enter' && state.editor && event.target.id === 'amount') { event.preventDefault(); commitEditor(); }
  if (event.key === 'Tab' && state.editor) {
    const container = $('#editor');
    const controls = [...container.querySelectorAll('button:not(:disabled),input')].filter(element => element.offsetParent !== null);
    const edge = event.shiftKey ? controls[0] : controls.at(-1);
    if (event.target === edge) { event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus(); }
  }
});
const letters = ['', 'АБВГ', 'ДЕЖЗ', 'ИЙКЛ', 'МНОП', 'РСТУ', 'ФХЦЧ', 'ШЩЪЫ', 'ЬЭЮЯ'];
$('#keyboard').innerHTML = `<div class="numeric-keyboard" aria-label="Цифровая клавиатура">${letters.map((label, i) => `<button class="numeric-key" data-key="${i + 1}" aria-label="${i + 1}"><span>${i + 1}</span><small>${label}</small></button>`).join('')}<span></span><button class="numeric-key zero" data-key="0" aria-label="0"><span>0</span></button><button class="numeric-key delete-key" data-key="delete" aria-label="Удалить цифру"><img src="${asset('bbc80.svg')}" alt=""></button></div><div class="home"><span></span></div>`;
$('#keyboard').addEventListener('pointerdown', event => { if (event.target.closest('button')) event.preventDefault(); });
$('#keyboard').addEventListener('click', event => {
  const key = event.target.closest('[data-key]');
  if (!key || !state.editor) return;
  const input = $('#amount');
  const draft = state.editor.draft;
  const start = input.selectionStart ?? draft.length;
  const end = input.selectionEnd ?? start;
  const deleting = key.dataset.key === 'delete';
  const from = deleting && start === end ? Math.max(0, start - 1) : start;
  setDraft(draft.slice(0, from) + (deleting ? '' : key.dataset.key) + draft.slice(end), from + (deleting ? 0 : 1));
  input.focus({ preventScroll: true });
});

function resize() {
  const width = window.visualViewport?.width || window.innerWidth;
  const height = window.visualViewport?.height || window.innerHeight;
  const mobile = width <= 600;
  const scale = mobile ? width / 375 : Math.min(1, (height - 32) / 812);
  const logicalHeight = mobile ? height / scale : 812;
  $('#stage').style.width = `${375 * scale}px`;
  $('#stage').style.height = `${logicalHeight * scale}px`;
  app.style.height = `${logicalHeight}px`;
  app.style.transform = `scale(${scale})`;
}

function enterDelivery() {
  PrototypeMotion.reset();
  state.tab = 'eligible';
  state.selected.clear();
  state.previews.clear();
  $('#scroll').scrollTop = 0;
  render(false);
  $('#screen .back').focus({ preventScroll: true });
  PrototypeMotion.animate($('#screen'), [{ opacity: 0, transform: 'translateX(14px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 280 });
}

function leaveDelivery() {
  if (state.editor) closeEditor();
  hideToast();
  PrototypeMotion.reset();
  PrototypeMotion.animate($('#offers-screen'), [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 240 });
}

const prepared = new Map();
async function prepareImage(path) {
  if (prepared.has(path)) return;
  const image = new Image();
  image.src = path;
  await image.decode();
  prepared.set(path, image);
}
async function prepareFont(name, weight) {
  if (prepared.has(name)) return;
  const face = new FontFace('Avito Sans Text', `url("assets/avito-sans-text-${name}.woff2")`, { weight: String(weight) });
  await face.load();
  document.fonts.add(face);
  prepared.set(name, face);
}
async function start() {
  $('#retry').hidden = true;
  $('#loading-copy').textContent = 'Загружаем прототип…';
  let timeout;
  try {
    render(false);
    const paths = new Set([...document.querySelectorAll('img')].map(image => image.getAttribute('src')));
    ['86592.svg', '49135.svg', '54616.svg', '9befd.svg', 'bc31a.svg', '3c5f8.svg'].forEach(name => paths.add(asset(name)));
    paths.add('assets/checkbox-inactive.svg');
    [previousItem, ...allItems].forEach(item => item.images.forEach(image => paths.add(asset(image))));
    await Promise.race([
      Promise.all([...paths].map(prepareImage).concat(Object.entries({ regular: 400, medium: 500, bold: 700 }).map(([name, weight]) => prepareFont(name, weight)))),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('timeout')), 20000); })
    ]);
    await document.fonts.ready;
    resize();
    app.hidden = false;
    await new Promise(requestAnimationFrame);
    app.inert = false;
    $('#loading').hidden = true;
    EntryScreen.start(enterDelivery, leaveDelivery);
  } catch {
    $('#loading-copy').textContent = 'Не удалось загрузить экран';
    $('#retry').hidden = false;
  } finally { clearTimeout(timeout); }
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
$('#retry').addEventListener('click', start);
start();
