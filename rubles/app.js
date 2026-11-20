const { limits } = DiscountModel;
const asset = name => `assets/current/${name}`;
const variant = EntryScreen.variant;
const switchableCatalog = variant === 4;
const stageDiscounts = variant === 3;
const canExcludeLimitedItems = variant === 2 || stageDiscounts;
let sortByPrice = false;
let catalogGroups = switchableCatalog ? departmentItems : categories;
const startingItem = switchableCatalog ? pricePreviousItem : previousItem;
const inventory = switchableCatalog ? priceInventory : [...categories.flatMap(group => group.items), startingItem];
const state = { tab: 'eligible', selected: new Set(), applied: new Map([[startingItem.id, calculateAmount(startingItem, 300)]]), previews: new Map(), editor: null, groups: [], activeGroup: null };
const money = value => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
const word = count => count % 10 === 1 && count % 100 !== 11 ? 'товар' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'товара' : 'товаров';
const $ = selector => document.querySelector(selector);
const app = $('#app');
const amountMeasure = document.createElement('canvas').getContext('2d');
const visibleItems = () => inventory.filter(item => state.tab === 'eligible' ? !state.applied.has(item.id) : state.applied.has(item.id));
const chosenItems = () => visibleItems().filter(item => state.selected.has(item.id));
function selectionPillClears(chosenCount, visibleCount) {
  return chosenCount > 0 && (switchableCatalog || chosenCount === visibleCount);
}
function groupItems(index) {
  const items = catalogGroups[index].items;
  const members = !switchableCatalog && index === 0 ? [...items, startingItem] : items;
  return members.filter(item => state.applied.has(item.id) === (state.tab === 'discounted'));
}
let sortHintSeen = false;
let futureEnabled = false;
let infoMode = null;
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

function sharedCustomAmount(items) {
  const first = preview(items[0]);
  if (!first?.isCustom) return null;
  return items.every(item => {
    const discount = preview(item);
    return discount?.isCustom && discount.requestedAmount === first.requestedAmount;
  }) ? first.requestedAmount : null;
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
  return singlePresets(item).map((amount, index) => `<button class="chip ${amount === selectedAmount ? 'active' : ''}" ${attribute}="${amount}" aria-pressed="${amount === selectedAmount}">${switchableCatalog && index === 0 ? `<img src="${asset('c8762.svg')}" alt="">` : ''}${money(amount)}</button>`).join('');
}

const groupLabels = { minimum: 'Минимальная', optimal: 'Оптимальная', maximum: 'Максимальная' };

function groupItemsSelected(group) {
  return chosenItems().filter(item => group.ids.includes(item.id));
}

function renderDiscountGroups(chosen) {
  const container = $('#discount-groups');
  state.groups = state.groups.filter(group => groupItemsSelected(group).length > 0);
  const show = chosen.length > 1 && state.groups.length > 0;
  container.hidden = !show;
  $('#select-all').hidden = show;
  if (!show) {
    state.groups = [];
    state.activeGroup = null;
    return null;
  }
  const ungrouped = chosen.filter(item => state.groups.every(group => !group.ids.includes(item.id)));
  if (ungrouped.length) state.groups.push({ kind: 'custom', mode: null, ids: ungrouped.map(item => item.id) });
  if (!state.groups.includes(state.activeGroup)) state.activeGroup = state.groups[0];
  container.innerHTML = state.groups.map((group, index) => {
    const count = groupItemsSelected(group).length;
    const active = group === state.activeGroup;
    const label = group.mode === 'custom' ? money(group.amount) : groupLabels[group.mode];
    return `<button class="count-pill group-pill" data-group-index="${index}" aria-pressed="${active}"><img src="${asset(active ? '54616.svg' : 'a4747.svg')}" alt=""><span>${count} ${word(count)}${label ? ` · ${label}` : ''}</span></button>`;
  }).join('');
  const active = container.querySelector('[aria-pressed="true"]');
  if (active.offsetLeft < container.scrollLeft || active.offsetLeft + active.offsetWidth > container.scrollLeft + container.clientWidth) {
    container.scrollLeft = active.offsetLeft - 12;
  }
  return state.activeGroup;
}

function groupOptions(group) {
  const modes = group.kind === 'upper' ? ['maximum', 'optimal'] : ['minimum', 'optimal'];
  const options = modes.map(mode => `<button class="chip ${group.mode === mode ? 'active' : ''}" data-group-preset="${mode}" aria-pressed="${group.mode === mode}">${groupLabels[mode]}</button>`);
  if (group.kind === 'custom') {
    const custom = group.mode === 'custom';
    options.push(`<button class="chip custom-option ${custom ? 'active' : ''}" id="edit-bulk" aria-pressed="${custom}">${custom ? money(group.amount) : 'Своя'}<img src="${asset('49135.svg')}" alt=""></button>`);
  }
  return options.join('');
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
  $('#catalog').innerHTML = catalogGroups.map((category, index) => {
    const items = groupItems(index);
    if (!items.length) return '';
    const checked = items.every(item => state.selected.has(item.id));
    return `<section class="category" data-group="${index}"><h2 class="category-title"><button data-category="${index}" aria-pressed="${checked}">${checkbox(checked)}<span>${category.name}</span></button></h2>${items.map(productMarkup).join('')}</section>`;
  }).join('') || '<p class="empty">Здесь пока нет товаров</p>';
  $('.calculator').hidden = chosen.length === 0;
  $('#selection-count').textContent = chosen.length ? `${chosen.length} ${word(chosen.length)}` : 'Выбрать все';
  $('#select-all').disabled = !visibleItems().length;
  $('#select-all').setAttribute('aria-pressed', String(chosen.length > 0));
  $('#select-all').setAttribute('aria-label', selectionPillClears(chosen.length, visibleItems().length) ? 'Снять выбор со всех товаров' : 'Выбрать все товары');
  const activeGroup = renderDiscountGroups(chosen);
  if (activeGroup) {
    $('#options').innerHTML = groupOptions(activeGroup);
  } else if (chosen.length > 1) {
    const amount = sharedCustomAmount(chosen);
    const custom = amount !== null;
    const optimal = !custom && chosen.every(item => preview(item).amount === optimalAmount(item).amount);
    const amounts = chosen.map(item => optimalAmount(item).amount);
    const low = Math.min(...amounts);
    const high = Math.max(...amounts);
    const range = low === high ? money(low) : `${money(low).replace(' ₽', '')} – ${money(high)}`;
    const label = switchableCatalog ? `<img src="${asset('c8762.svg')}" alt="">Оптимальная · ${range}` : 'Оптимальная';
    $('#options').innerHTML = `<button class="chip ${optimal ? 'active' : ''}" data-range="optimal" aria-pressed="${optimal}">${label}</button><button class="chip custom-option ${custom ? 'active' : ''}" id="edit-bulk" aria-pressed="${custom}">${custom ? money(amount) : 'Своя'}<img src="${asset('49135.svg')}" alt=""></button>`;
  } else if (chosen.length === 1) {
    const item = chosen[0];
    const amount = preview(item).amount;
    const custom = !singlePresets(item).includes(amount);
    const customLabel = custom ? money(amount) : 'Своя';
    $('#options').innerHTML = presetButtons(item, amount, 'data-amount') + `<button class="chip custom-option ${custom ? 'active' : ''}" id="edit" data-edit="${item.id}">${customLabel}<img src="${asset('49135.svg')}" alt=""></button>`;
  } else $('#options').innerHTML = '';
  const removing = isRemovingSelection(chosen);
  $('#apply').textContent = removing ? 'Удалить скидку' : 'Применить';
  $('#apply').classList.toggle('secondary', removing);
  $('#apply').disabled = chosen.length === 0;
  renderCategoryNavigation();
  PrototypeMotion.layout(positions);
  if (selection) PrototypeMotion.selection(selection);
}

function renderCategoryNavigation() {
  const nav = $('#category-nav');
  nav.classList.toggle('price-ranges', sortByPrice);
  nav.innerHTML = catalogGroups.map((category, index) => {
    const count = groupItems(index).length;
    const label = sortByPrice ? category.name : `${category.name} · ${count}`;
    return count ? `<button class="chip" data-jump="${index}">${label}</button>` : '';
  }).join('');
  updateCategoryNavigation();
}
function catalogStart() {
  if (!switchableCatalog) return $('.hero').offsetHeight;
  return $('#catalog').offsetTop - parseFloat(getComputedStyle($('#catalog-header')).height);
}

function scrollToCatalog() {
  $('#scroll').scrollTo({ top: catalogStart(), behavior: PrototypeMotion.scrollBehavior });
}

function updateCategoryNavigation() {
  const scroll = $('#scroll');
  const header = $('#catalog-header');
  header.hidden = scroll.scrollTop + 0.5 < catalogStart();
  if (switchableCatalog && !header.hidden && !$('#screen').hidden && !sortHintSeen) {
    sortHintSeen = true;
    $('#sort-hint').hidden = false;
  }
  if (header.hidden) $('#sort-hint').hidden = true;
  if (header.hidden) return;
  const groups = [...document.querySelectorAll('[data-group]')];
  const active = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1 ? groups.at(-1) : groups.findLast(group => group.offsetTop <= scroll.scrollTop + header.offsetHeight + 8) || groups[0];
  document.querySelectorAll('[data-jump]').forEach(button => {
    const selected = button.dataset.jump === active?.dataset.group;
    const changed = button.classList.contains('active') !== selected;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-current', String(selected));
    if (selected && changed) {
      const nav = button.parentElement;
      const leftEdge = button.offsetLeft - 11;
      const rightEdge = button.offsetLeft + button.offsetWidth + 11 - nav.clientWidth;
      const left = sortByPrice
        ? Math.max(rightEdge, Math.min(leftEdge, nav.scrollLeft))
        : button.offsetLeft - 68;
      nav.scrollTo({ left, behavior: PrototypeMotion.scrollBehavior });
    }
  });
}
function prepareSelection(previousSelection) {
  const chosen = chosenItems();
  const single = chosen.length === 1;
  for (const item of chosen) {
    const saved = state.applied.get(item.id);
    const current = state.previews.get(item.id);
    const useSinglePreset = single && !saved && previousSelection &&
      (!previousSelection.has(item.id) || current?.fromOptimal);
    const useBulkOptimal = variant === 4 && !single && !saved && !current?.fromOptimal;
    if (current && !useSinglePreset && !useBulkOptimal) continue;
    const result = saved ?? (single
      ? calculateAmount(item, singlePresets(item)[0])
      : { ...optimalAmount(item), fromOptimal: true });
    state.previews.set(item.id, result);
  }
}

function bestCoveredAmount(ranges, preferred) {
  const candidates = new Set([preferred, ...ranges.flatMap(({ minimum, maximum }) => [minimum, maximum])]);
  let best = preferred;
  let mostCovered = 0;
  for (const amount of candidates) {
    const covered = ranges.filter(({ minimum, maximum }) => minimum <= amount && amount <= maximum).length;
    if (covered > mostCovered || (covered === mostCovered && Math.abs(amount - preferred) < Math.abs(best - preferred))) {
      best = amount;
      mostCovered = covered;
    }
  }
  return best;
}

function openEditor(itemId = null) {
  const item = itemId ? inventory.find(product => product.id === itemId) : null;
  const group = item ? null : state.activeGroup;
  const items = item ? [item] : group ? groupItemsSelected(group) : chosenItems();
  if (!items.length) return;
  PrototypeMotion.clearGhosts();
  PrototypeMotion.cancel($('#editor'));
  $('#scroll').scrollTo({ top: $('#scroll').scrollTop, behavior: 'auto' });
  const origin = item ? $(`[data-id="${item.id}"]`).getBoundingClientRect() : null;
  const positions = PrototypeMotion.snapshot();
  editorTrigger = document.activeElement;
  const ranges = items.map(product => limits(product.price));
  const commonMinimum = Math.max(...ranges.map(range => range.minimum));
  const commonMaximum = Math.min(...ranges.map(range => range.maximum));
  const minimum = Math.min(...ranges.map(range => range.minimum));
  const maximum = Math.max(...ranges.map(range => range.maximum));
  const amounts = items.map(product => preview(product)?.amount ?? optimalAmount(product).amount).sort((a, b) => a - b);
  const middle = amounts[Math.floor(amounts.length / 2)];
  const defaultBulkAmount = commonMinimum <= commonMaximum ? Math.max(commonMinimum, Math.min(commonMaximum, middle)) : middle;
  let initial = item ? amounts[0] : group?.amount ?? sharedCustomAmount(items) ?? defaultBulkAmount;
  if (switchableCatalog && !item) {
    initial = bestCoveredAmount(ranges, initial);
  }
  state.editor = { item, items: [...items], group, minimum, maximum, draft: String(initial), clamp: { lower: true, upper: true }, scrollTop: $('#scroll').scrollTop };
  hideToast();
  setEditorProductVisibility();
  PrototypeMotion.layout(positions);
  $('#screen').inert = true;
  $('#editor').hidden = false;
  $('#editor').classList.toggle('bulk-editor', !item);
  $('#editor').classList.toggle('individual-editor', Boolean(item));
  $('#editor').setAttribute('aria-label', item ? `Скидка: ${item.title}` : 'Скидка для выбранных товаров');
  $('#editor-product').hidden = !item;
  $('#editor-options').innerHTML = `<label class="custom-input"><input id="amount" type="text" inputmode="none" autocomplete="off" maxlength="6" aria-label="Сумма скидки в рублях"><span id="amount-suffix">₽</span></label><div class="amount-slider"><input id="amount-slider" type="range" step="1" aria-label="Скидка на слайдере"><div class="slider-labels"><span id="minimum-label"></span><span id="maximum-label"></span></div></div>`;
  updateEditor();
  $('#amount').focus({ preventScroll: true });
  $('#amount').select();
  PrototypeMotion.openEditor(origin);
}
function editorResults() {
  const { items, draft, clamp } = state.editor;
  return items.map(item => {
    const result = calculateAmount(item, draft);
    let limit = null;
    if (result?.requestedAmount < result?.minimum) limit = 'lower';
    if (result?.requestedAmount > result?.maximum) limit = 'upper';
    return { item, result: result && { ...result, isCustom: true }, limit, include: Boolean(result && (!limit || !canExcludeLimitedItems || clamp[limit])) };
  });
}

function updateEditor() {
  const { item, draft, minimum, maximum } = state.editor;
  const results = editorResults();
  const result = results[0].result;
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
  const included = results.filter(entry => entry.include).length;
  $('#done').disabled = included === 0;
  $('#done').textContent = item ? connected ? 'Сохранить' : switchableCatalog ? 'Применить' : 'Применить скидку'
    : stageDiscounts ? 'Готово' : included ? `Применить скидку ${included} ${recipientWord(included)}` : 'Применить скидку';
  $('#cancel-edit').hidden = !item || connected;
  $('#remove-discount').hidden = !connected;
  const limited = item && draft !== '' && (Number(draft) < minimum || Number(draft) > maximum);
  $('#limit-tooltip').hidden = !limited;
  $('#limit-tooltip').textContent = limited ? `${Number(draft) < minimum ? 'Минимальная' : 'Максимальная'}: ${money(Number(draft) < minimum ? minimum : maximum)}` : '';
  renderLimitNotice(item ? [] : results);
  const description = limited ? 'limit-tooltip' : !$('#bulk-notice').hidden ? 'bulk-notice' : null;
  if (description) input.setAttribute('aria-describedby', description);
  else input.removeAttribute('aria-describedby');
}

function renderLimitNotice(results) {
  const notice = $('#bulk-notice');
  const interactive = canExcludeLimitedItems;
  const limitTypes = ['lower', 'upper'];
  const notices = limitTypes.flatMap(limit => {
    const count = results.filter(entry => entry.limit === limit).length;
    if (!count) return [];
    const lower = limit === 'lower';
    const label = `Скидка ${lower ? 'меньше минимальной' : 'больше максимальной'} для ${count} ${genitiveWord(count)}`;
    const pronoun = count === 1 ? 'ему' : 'им';
    const amount = lower ? 'минимальную' : 'максимальную';
    if (!interactive) {
      const explanation = `Установим ${pronoun} ${lower ? 'минимально' : 'максимально'} возможную скидку`;
      return [`<div role="status"><p>${label}</p><p>${explanation}</p></div>`];
    }
    const checked = state.editor.clamp[limit];
    const action = `Установим ${pronoun} ${amount}`;
    return [`<div><p role="status">${label}</p><div class="limit-switch-row"><span>${action}</span><button type="button" class="limit-switch" role="switch" aria-checked="${checked}" aria-label="${action}" data-limit="${limit}"><img src="${asset('5b3cf.svg')}" alt=""></button></div></div>`];
  });
  notice.classList.toggle('limit-notice-interactive', interactive);
  notice.hidden = notices.length === 0;
  notice.innerHTML = `${interactive ? '' : `<img src="${asset('bc31a.svg')}" alt="">`}<div>${notices.join('')}</div>`;
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
  const { item } = state.editor;
  const results = editorResults();
  const included = results.filter(entry => entry.include);
  if (!included.length) return;
  if (!item && stageDiscounts) {
    stageBulkDiscount(results);
    return;
  }
  const updating = item && state.applied.has(item.id);
  for (const { item: product, result } of included) {
    state.applied.set(product.id, result);
    state.selected.delete(product.id);
    state.previews.delete(product.id);
  }
  for (const entry of results) if (!entry.include) state.selected.delete(entry.item.id);
  prepareSelection();
  closeEditor(false);
  render();
  ($('#discount-groups [aria-pressed="true"]') ?? $('#select-all')).focus({ preventScroll: true });
  notify(updating ? 'Сохранили скидку на товар' : `Применили скидку ${included.length} ${recipientWord(included.length)}`);
}

function stageBulkDiscount(results) {
  const { group, draft } = state.editor;
  const groups = [];
  for (const [kind, mode, limit] of [['custom', 'custom', null], ['lower', 'minimum', 'lower'], ['upper', 'maximum', 'upper']]) {
    const matches = results.filter(entry => entry.include && entry.limit === limit);
    if (!matches.length) continue;
    groups.push({ kind, mode, amount: kind === 'custom' ? Number(draft) : undefined, ids: matches.map(entry => entry.item.id) });
    for (const { item, result } of matches) state.previews.set(item.id, result);
  }
  for (const entry of results) if (!entry.include) state.selected.delete(entry.item.id);
  state.groups = state.groups.filter(existing => existing !== group).concat(groups);
  state.activeGroup = groups[0];
  closeEditor();
  render();
  ($('#discount-groups [aria-pressed="true"]') ?? $('#apply')).focus({ preventScroll: true });
}
function notify(message, duration = 2500) {
  hideToast();
  const run = toastRun;
  const toast = $('#toast');
  $('#toast-message').textContent = message;
  toast.hidden = false;
  PrototypeMotion.animate(toast, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220 });
  toastTimer = setTimeout(async () => {
    await PrototypeMotion.animate(toast, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(6px)' }], { duration: 180, persist: true });
    if (run === toastRun) hideToast();
  }, duration);
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
  if (!product && !category) return;
  PrototypeMotion.clearGhosts();
  const previousSelection = new Set(state.selected);
  if (product) state.selected.has(product.dataset.select) ? state.selected.delete(product.dataset.select) : state.selected.add(product.dataset.select);
  else if (category) {
    const items = groupItems(Number(category.dataset.category));
    const checked = items.every(item => state.selected.has(item.id));
    items.forEach(item => checked ? state.selected.delete(item.id) : state.selected.add(item.id));
  }
  prepareSelection(previousSelection);
  render();
  if (product && state.selected.has(product.dataset.select)) PrototypeMotion.keepInView(product.dataset.select);
});
$('#select-all').addEventListener('click', () => {
  PrototypeMotion.clearGhosts();
  const items = visibleItems();
  const previousSelection = state.selected;
  state.selected = new Set(selectionPillClears(chosenItems().length, items.length) ? [] : items.map(item => item.id));
  prepareSelection(previousSelection);
  render();
});
$('#options').addEventListener('click', event => {
  if (event.target.closest('#edit-bulk')) return openEditor();
  const edit = event.target.closest('[data-edit]');
  if (edit) return openEditor(edit.dataset.edit);
  const range = event.target.closest('[data-range]');
  const amount = event.target.closest('[data-amount]');
  const groupPreset = event.target.closest('[data-group-preset]');
  if (groupPreset && state.activeGroup) {
    const { groupPreset: mode } = groupPreset.dataset;
    state.activeGroup.mode = mode;
    for (const item of groupItemsSelected(state.activeGroup)) {
      const bounds = limits(item.price);
      const result = mode === 'optimal'
        ? { ...optimalAmount(item), fromOptimal: true }
        : calculateAmount(item, bounds[mode]);
      state.previews.set(item.id, result);
    }
  }
  if (range) {
    chosenItems().forEach(item => state.previews.set(item.id, { ...optimalAmount(item), fromOptimal: true }));
  }
  if (amount) {
    const item = chosenItems()[0];
    state.previews.set(item.id, calculateAmount(item, amount.dataset.amount));
  }
  render();
  if (groupPreset) $(`[data-group-preset="${groupPreset.dataset.groupPreset}"]`)?.focus({ preventScroll: true });
});
$('#discount-groups').addEventListener('click', event => {
  const button = event.target.closest('[data-group-index]');
  if (!button) return;
  state.activeGroup = state.groups[Number(button.dataset.groupIndex)];
  render();
  $('#discount-groups [aria-pressed="true"]')?.focus({ preventScroll: true });
});
$('#bulk-notice').addEventListener('click', event => {
  const button = event.target.closest('[data-limit]');
  if (!state.editor || !button) return;
  const limit = button.dataset.limit;
  state.editor.clamp[limit] = !state.editor.clamp[limit];
  updateEditor();
  $(`#bulk-notice [data-limit="${limit}"]`)?.focus({ preventScroll: true });
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
  ($('#discount-groups [aria-pressed="true"]') ?? $('#select-all')).focus({ preventScroll: true });
  notify('Удалили скидку на товар');
});
function isRemovingSelection(chosen) {
  return state.tab === 'discounted' && !state.groups.length && chosen.length > 0 &&
    chosen.every(item => preview(item).amount === state.applied.get(item.id).amount);
}
$('#apply').addEventListener('click', () => {
  const chosen = chosenItems();
  if (!chosen.length) return;
  const removing = isRemovingSelection(chosen);
  if (removing) chosen.forEach(item => state.applied.delete(item.id));
  else chosen.map(item => [item.id, preview(item)]).forEach(([id, result]) => state.applied.set(id, result));
  chosen.forEach(item => state.previews.delete(item.id));
  state.selected.clear(); render();
  notify(removing ? `Удалили скидку у ${chosen.length} ${genitiveWord(chosen.length)}` : `Применили скидку ${chosen.length} ${recipientWord(chosen.length)}`);
});
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  PrototypeMotion.reset();
  state.tab = button.dataset.tab; state.selected.clear(); state.previews.clear();
  if (!switchableCatalog) $('#scroll').scrollTop = 0;
  render(false);
  if (switchableCatalog) scrollToCatalog();
  PrototypeMotion.animate($('#catalog'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220 });
}));
document.querySelectorAll('.back').forEach(button => button.addEventListener('click', EntryScreen.back));
$('#scroll').addEventListener('scroll', updateCategoryNavigation, { passive: true });
$('#category-nav').addEventListener('click', event => {
  const button = event.target.closest('[data-jump]');
  if (!button) return;
  const group = $(`[data-group="${button.dataset.jump}"]`);
  $('#scroll').scrollTo({ top: Math.max(catalogStart(), group.offsetTop - $('#catalog-header').offsetHeight), behavior: PrototypeMotion.scrollBehavior });
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
  const body = getComputedStyle(document.body);
  const availableHeight = height - parseFloat(body.paddingTop) - parseFloat(body.paddingBottom);
  const logicalHeight = mobile ? availableHeight / scale : 812;
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
  closeInfoSheet(false);
  $('#sort-hint').hidden = true;
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
    ['86592.svg', '49135.svg', 'bc31a.svg', '3c5f8.svg'].forEach(name => paths.add(asset(name)));
    if (canExcludeLimitedItems) paths.add(asset('5b3cf.svg'));
    paths.add('assets/checkbox-inactive.svg');
    inventory.forEach(item => item.images.forEach(image => paths.add(asset(image))));
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
function initializeFourthVariant() {
  app.classList.add('fourth-variant');
  for (const button of document.querySelectorAll('.sort-mode')) {
    button.hidden = false;
    button.addEventListener('click', toggleGrouping);
  }
  $('#future-toggle').hidden = false;
  $('#recommendation-info').hidden = false;
  $('#future-toggle').addEventListener('click', () => openInfoSheet('future'));
  $('#recommendation-info').addEventListener('click', () => openInfoSheet('recommendation'));
  $('#dismiss-hint').addEventListener('click', dismissSortHint);
  $('.hint-sort').addEventListener('click', toggleGrouping);
  $('#close-info').addEventListener('click', closeInfoSheet);
  $('#info-overlay .cancel-area').addEventListener('click', closeInfoSheet);
  $('#future-bands').innerHTML = priceCategories.map((band, index) =>
    `<button class="chip" data-estimate="${index}">${band.name}</button>`).join('');
  $('#future-bands').addEventListener('click', event => {
    const button = event.target.closest('[data-estimate]');
    if (!button) return;
    if (button.getAttribute('aria-pressed') !== 'true') {
      showEstimate(Number(button.dataset.estimate));
      PrototypeMotion.animate($('.estimate strong'), [{ transform: 'translateY(4px)', opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 180 });
    }
    button.scrollIntoView({ block: 'nearest', inline: 'center', behavior: PrototypeMotion.scrollBehavior });
  });
  $('#info-action').addEventListener('click', () => {
    if (infoMode === 'future') {
      futureEnabled = !futureEnabled;
      $('#future-switch').src = asset(futureEnabled ? '5b3cf.svg' : '81750.svg');
      $('#future-toggle').setAttribute('aria-pressed', String(futureEnabled));
      notify(futureEnabled ? 'Будем включать скидку на доставку всем новым товарам' : 'Автоподключение скидки отключено');
    }
    closeInfoSheet();
  });
  $('#future-toggle').setAttribute('aria-pressed', 'false');
  $('#info-overlay').addEventListener('keydown', event => {
    if (event.key === 'Escape') closeInfoSheet();
    if (event.key !== 'Tab') return;
    const first = $('#close-info');
    const last = $('#info-action');
    if (event.shiftKey && event.target === first || !event.shiftKey && event.target === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
}

function dismissSortHint() {
  $('#sort-hint').hidden = true;
  sortHintSeen = true;
  if (!$('#catalog-header').hidden) $('.compact-title .sort-mode').focus({ preventScroll: true });
}

function toggleGrouping() {
  const previous = PrototypeMotion.snapshot();
  dismissSortHint();
  sortByPrice = !sortByPrice;
  catalogGroups = sortByPrice ? priceCategories : departmentItems;
  app.classList.toggle('price-grouping', sortByPrice);
  for (const button of document.querySelectorAll('.sort-mode')) {
    button.setAttribute('aria-label', sortByPrice ? 'Сгруппировать по категориям' : 'Сгруппировать по цене');
  }
  render(false);
  PrototypeMotion.regroup(previous);
  scrollToCatalog();
  notify(sortByPrice ? 'Сортировка: по размеру цены' : 'Сортировка: по категориям', 3000);
}

function showEstimate(index) {
  const expensive = priceCategories.at(-1).items;
  const estimates = [[100, 50, 500], [500, 100, 1000], [800, 350, 1400], [900, 450, 5800]];
  const [example, minimum, maximum] = estimates[index] ?? [
    optimalAmount(expensive[Math.floor(expensive.length / 2)]).amount,
    Math.min(...expensive.map(item => limits(item.price).minimum)),
    Math.max(...expensive.map(item => limits(item.price).maximum))
  ];
  $('#estimate-value').textContent = money(example);
  $('#estimate-range').textContent = `от ${minimum.toLocaleString('ru-RU')} до ${money(maximum)}`;
  for (const button of $('#future-bands').children) {
    const selected = Number(button.dataset.estimate) === index;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

function openInfoSheet(mode) {
  infoMode = mode;
  const future = mode === 'future';
  $('#future-details').hidden = !future;
  $('#recommendation-details').hidden = future;
  $('#info-title').textContent = future ? 'Включать новым товарам скидку на доставку?' : 'Нейросеть рекомендует скидку';
  $('#info-action').textContent = future ? futureEnabled ? 'Отключить для новых товаров' : 'Включать новым товарам' : 'Круто!';
  $('#info-action').classList.toggle('secondary', !future);
  $('#info-overlay').inert = false;
  $('#info-overlay').hidden = false;
  $('.info-body').scrollTop = 0;
  $('#screen').inert = true;
  if (future) {
    showEstimate(0);
    $('#future-bands').scrollLeft = 0;
  }
  hideToast();
  $('#close-info').focus({ preventScroll: true });
  PrototypeMotion.animate($('#info-overlay'), [{ backgroundColor: '#0000' }, { backgroundColor: '#0009' }], { duration: 200 });
  PrototypeMotion.animate($('.info-sheet'), [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 300 });
}

async function closeInfoSheet(animate = true) {
  const overlay = $('#info-overlay');
  if (overlay.hidden || (overlay.inert && animate)) return;
  const trigger = infoMode === 'future' ? $('#future-toggle') : $('#recommendation-info');
  const sheet = $('.info-sheet');
  if (animate) {
    overlay.inert = true;
    await Promise.all([
      PrototypeMotion.animate(overlay, [{ backgroundColor: getComputedStyle(overlay).backgroundColor }, { backgroundColor: '#0000' }], { duration: 180, persist: true }),
      PrototypeMotion.animate(sheet, [{ transform: getComputedStyle(sheet).transform }, { transform: 'translateY(100%)' }], { duration: 220, persist: true })
    ]);
    if (!overlay.inert || overlay.hidden) return;
  }
  PrototypeMotion.cancel(overlay);
  infoMode = null;
  overlay.hidden = true;
  overlay.inert = false;
  $('#screen').inert = false;
  trigger.focus({ preventScroll: true });
}

if (switchableCatalog) initializeFourthVariant();
start();
