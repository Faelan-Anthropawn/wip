import { createNbtBuffer, nbtByte, nbtShort } from './builds/outputs/structure-converter.js';

const CONTAINERS = {
  barrel:        { block: 'minecraft:barrel',             entityId: 'Barrel',       slots: 27, states: { facing_direction: 1, open_bit: false } },
  chest:         { block: 'minecraft:chest',              entityId: 'Chest',        slots: 27, states: { facing_direction_bits: 0 } },
  trapped_chest: { block: 'minecraft:trapped_chest',      entityId: 'TrappedChest', slots: 27, states: { facing_direction_bits: 0 } },
  shulker_box:   { block: 'minecraft:undyed_shulker_box', entityId: 'ShulkerBox',   slots: 27, states: {} },
};

const ENCHANTMENTS = {
  0:  'Protection',       1:  'Fire Protection',  2:  'Feather Falling',
  3:  'Blast Protection', 4:  'Projectile Prot.', 5:  'Thorns',
  6:  'Respiration',      7:  'Depth Strider',    8:  'Aqua Affinity',
  9:  'Sharpness',        10: 'Smite',            11: 'Bane of Arthropods',
  12: 'Knockback',        13: 'Fire Aspect',      14: 'Looting',
  15: 'Efficiency',       16: 'Silk Touch',       17: 'Unbreaking',
  18: 'Fortune',          19: 'Power',            20: 'Punch',
  21: 'Flame',            22: 'Infinity',         23: 'Luck of the Sea',
  24: 'Lure',             25: 'Frost Walker',     26: 'Mending',
  27: 'Binding Curse',    28: 'Vanishing Curse',  29: 'Impaling',
  30: 'Riptide',          31: 'Loyalty',          32: 'Channeling',
  33: 'Multishot',        34: 'Piercing',         35: 'Quick Charge',
  36: 'Soul Speed',       37: 'Swift Sneak',      38: 'Wind Burst',
  39: 'Breach',           40: 'Density',
};

const ENCH_CATEGORIES = [
  { label: 'Universal', ids: [17, 26, 27, 28] },
  { label: 'Sword',     ids: [9, 10, 11, 12, 13, 14] },
  { label: 'Armor',     ids: [0, 1, 2, 3, 4, 5, 6, 7, 8, 25, 36, 37] },
  { label: 'Pickaxe',   ids: [15, 16, 18] },
  { label: 'Bow',       ids: [19, 20, 21, 22] },
  { label: 'Trident',   ids: [29, 30, 31, 32] },
  { label: 'Crossbow',  ids: [33, 34, 35] },
  { label: 'Fishing',   ids: [23, 24] },
  { label: 'Mace',      ids: [38, 39, 40] },
];

const COLOR_GROUPS = [
  { name: 'Neutrals',       colors: [
    { code: '§f', name: 'White',         color: '#FFFFFF' },
    { code: '§7', name: 'Gray',          color: '#AAAAAA' },
    { code: '§8', name: 'Dark Gray',     color: '#555555' },
    { code: '§0', name: 'Black',         color: '#000000' },
  ]},
  { name: 'Blues',          colors: [
    { code: '§b', name: 'Aqua',          color: '#55FFFF' },
    { code: '§3', name: 'Dark Aqua',     color: '#00AAAA' },
    { code: '§9', name: 'Blue',          color: '#5555FF' },
    { code: '§1', name: 'Dark Blue',     color: '#0000AA' },
    { code: '§t', name: 'Lapis',         color: '#21497B' },
  ]},
  { name: 'Greens',         colors: [
    { code: '§a', name: 'Green',         color: '#55FF55' },
    { code: '§2', name: 'Dark Green',    color: '#00AA00' },
    { code: '§q', name: 'Emerald',       color: '#47A036' },
  ]},
  { name: 'Reds & Oranges', colors: [
    { code: '§c', name: 'Red',           color: '#FF5555' },
    { code: '§4', name: 'Dark Red',      color: '#AA0000' },
    { code: '§m', name: 'Redstone',      color: '#971607' },
    { code: '§6', name: 'Gold',          color: '#FFAA00' },
    { code: '§n', name: 'Copper',        color: '#B4684D' },
    { code: '§v', name: 'Resin',         color: '#EB7114' },
  ]},
  { name: 'Yellows',        colors: [
    { code: '§e', name: 'Yellow',        color: '#FFFF55' },
    { code: '§g', name: 'Minecoin Gold', color: '#DDD605' },
    { code: '§p', name: 'Gold Material', color: '#DEB12D' },
  ]},
  { name: 'Purples',        colors: [
    { code: '§d', name: 'Light Purple',  color: '#FF55FF' },
    { code: '§5', name: 'Dark Purple',   color: '#AA00AA' },
    { code: '§u', name: 'Amethyst',      color: '#9A5CC6' },
  ]},
  { name: 'Materials',      colors: [
    { code: '§s', name: 'Diamond',       color: '#2CBAA8' },
    { code: '§h', name: 'Quartz',        color: '#E3D4D1' },
    { code: '§i', name: 'Iron',          color: '#CECACA' },
    { code: '§j', name: 'Netherite',     color: '#443A3B' },
  ]},
];

const FORMAT_CODES = [
  { code: '§k', name: 'Obfuscated', icon: '?' },
  { code: '§l', name: 'Bold',       icon: 'B' },
  { code: '§o', name: 'Italic',     icon: 'I' },
  { code: '§r', name: 'Reset',      icon: 'R' },
];

function insertAtCursor(input, text) {
  const start = input.selectionStart;
  const end   = input.selectionEnd;
  input.value = input.value.substring(0, start) + text + input.value.substring(end);
  input.selectionStart = input.selectionEnd = start + text.length;
  input.focus();
  input.dispatchEvent(new Event('input'));
}

function findCategoryIndex(enchId) {
  for (let i = 0; i < ENCH_CATEGORIES.length; i++) {
    if (ENCH_CATEGORIES[i].ids.includes(enchId)) return i;
  }
  return 0;
}

const VOID_BG           = 'background-color: var(--void);';
const INPUT_STYLE       = `${VOID_BG} border-color: rgba(138,168,168,0.2);`;
const INPUT_ERROR_STYLE = `${VOID_BG} border-color: rgba(248,113,113,0.7);`;

let kitItems = [];

let enchPopupEl        = null;
let enchOutsideHandler = null;

function closeEnchPopup() {
  if (enchPopupEl) { enchPopupEl.remove(); enchPopupEl = null; }
  if (enchOutsideHandler) {
    document.removeEventListener('click', enchOutsideHandler);
    enchOutsideHandler = null;
  }
}

function openEnchPopup(triggerBtn, currentId, onSelect) {
  closeEnchPopup();

  let activeCat  = findCategoryIndex(currentId);
  let selectedId = currentId;

  const popup = document.createElement('div');
  popup.id = 'kit-ench-popup';
  Object.assign(popup.style, {
    position:     'fixed',
    zIndex:       '99999',
    width:        '270px',
    background:   'var(--deep,#0d1117)',
    border:       '1px solid rgba(138,168,168,0.15)',
    borderRadius: '12px',
    padding:      '10px',
    boxShadow:    '0 20px 60px rgba(0,0,0,0.7)',
  });

  function renderPopupContent() {
    popup.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(138,168,168,0.1);">
        ${ENCH_CATEGORIES.map((cat, i) => `
          <button class="pop-cat" data-cat="${i}" style="
            font-size:11px;padding:3px 8px;border-radius:6px;border:none;cursor:pointer;
            font-weight:600;transition:background 100ms,color 100ms;
            background:${i === activeCat ? 'rgba(99,102,241,0.85)' : 'rgba(30,41,59,0.8)'};
            color:${i === activeCat ? '#fff' : '#94a3b8'};
          ">${cat.label}</button>
        `).join('')}
      </div>
      <div class="pop-ench-list" style="display:flex;flex-direction:column;gap:2px;height:196px;overflow-y:auto;">
        ${ENCH_CATEGORIES[activeCat].ids.map(id => `
          <button class="pop-ench" data-id="${id}" style="
            text-align:left;padding:6px 10px;border-radius:7px;border:none;cursor:pointer;
            font-size:13px;font-family:inherit;transition:background 100ms,color 100ms;
            background:${id === selectedId ? 'rgba(99,102,241,0.7)' : 'transparent'};
            color:${id === selectedId ? '#fff' : '#cbd5e1'};
          ">${ENCHANTMENTS[id]}</button>
        `).join('')}
      </div>
    `;

    popup.querySelectorAll('.pop-ench').forEach(btn => {
      btn.addEventListener('mouseover', () => {
        if (+btn.dataset.id !== selectedId) btn.style.background = 'rgba(30,41,59,0.9)';
      });
      btn.addEventListener('mouseout', () => {
        if (+btn.dataset.id !== selectedId) btn.style.background = 'transparent';
      });
    });
  }

  popup.addEventListener('click', e => {
    e.stopPropagation();
    const catBtn  = e.target.closest('.pop-cat');
    const enchBtn = e.target.closest('.pop-ench');
    if (catBtn) {
      activeCat = +catBtn.dataset.cat;
      renderPopupContent();
    } else if (enchBtn) {
      selectedId = +enchBtn.dataset.id;
      onSelect(selectedId);
      closeEnchPopup();
    }
  });

  renderPopupContent();
  document.body.appendChild(popup);
  enchPopupEl = popup;

  const rect = triggerBtn.getBoundingClientRect();
  const pw   = 270;
  const ph   = 310;
  let top    = rect.bottom + 6;
  let left   = rect.left;
  if (left + pw > window.innerWidth  - 8) left = window.innerWidth  - pw - 8;
  if (left < 8)                           left = 8;
  if (top  + ph > window.innerHeight - 8) top  = rect.top - ph - 6;
  popup.style.top  = top  + 'px';
  popup.style.left = left + 'px';

  enchOutsideHandler = () => closeEnchPopup();
  setTimeout(() => document.addEventListener('click', enchOutsideHandler, { once: true }), 0);
}

function makeItem() {
  return { id: '', count: 1, damage: 0, displayName: '', enchants: [], collapsed: false };
}

function clampCount(v)  { return isNaN(v) ? 1 : Math.max(1,  Math.min(99,    v)); }
function clampDamage(v) { return isNaN(v) ? 0 : Math.max(0,  Math.min(32767, v)); }
function clampLevel(v)  { return isNaN(v) ? 1 : Math.max(1,  Math.min(32767, v)); }

function buildKitStructure(containerKey, items) {
  const container = CONTAINERS[containerKey];

  const nbtItems = items.map((item, i) => {
    const count    = clampCount(item.count);
    const damage   = clampDamage(item.damage);
    const itemName = item.id.includes(':') ? item.id : `minecraft:${item.id}`;

    const tag = {};
    if (item.displayName && item.displayName.trim())
      tag.display = { Name: item.displayName.trim() };
    if (item.enchants && item.enchants.length > 0)
      tag.ench = item.enchants.map(e => ({
        id:  nbtShort(e.id),
        lvl: nbtShort(clampLevel(e.level)),
      }));

    const entry = { Count: nbtByte(count), Damage: nbtShort(damage), Name: itemName, Slot: nbtByte(i) };
    if (Object.keys(tag).length > 0) entry.tag = tag;
    return entry;
  });

  const structureData = {
    format_version: 1,
    size: [1, 1, 1],
    structure: {
      block_indices: [[0], [-1]],
      entities: [],
      palette: {
        default: {
          block_palette: [{ name: container.block, states: container.states, version: 18163713 }],
          block_position_data: {
            '0': {
              block_entity_data: { id: container.entityId, Items: nbtItems, x: 0, y: 0, z: 0 }
            }
          }
        }
      }
    },
    structure_world_origin: [0, 0, 0]
  };

  return createNbtBuffer(structureData);
}

function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function syncFromDOM() {
  const list = document.getElementById('kit-item-list');
  if (!list) return;
  list.querySelectorAll('.kit-item-card').forEach((card, i) => {
    if (!kitItems[i]) return;
    kitItems[i].id          = (card.querySelector('.kit-item-id')?.value ?? '').trim();
    kitItems[i].count       = clampCount(parseInt(card.querySelector('.kit-item-count')?.value));
    kitItems[i].damage      = clampDamage(parseInt(card.querySelector('.kit-item-damage')?.value));
    kitItems[i].displayName = card.querySelector('.kit-item-name')?.value ?? '';
    card.querySelectorAll('.kit-ench-row').forEach((row, ei) => {
      if (!kitItems[i].enchants[ei]) return;
      kitItems[i].enchants[ei].level = clampLevel(parseInt(row.querySelector('.kit-ench-lvl')?.value));
    });
  });
}

function applyIdStyle(input) {
  input.style.cssText = input.value.trim() === '' ? INPUT_ERROR_STYLE : INPUT_STYLE;
}

function buildColorToolbar(nameInput, container) {
  const bar = document.createElement('div');
  bar.className = 'options-bar flex flex-wrap items-center gap-2 p-2 rounded-lg bg-surface-900/50 border border-slate-700/30';
  bar.style.position = 'relative';
  bar.style.zIndex   = '100';

  const pickerWrap = document.createElement('div');
  pickerWrap.className = 'color-picker-container relative';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'color-picker-toggle flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded btn-secondary text-mist';
  toggleBtn.innerHTML = `
    <span class="w-3 h-3 rounded-sm bg-gradient-to-r from-red-500 via-green-500 to-blue-500"></span>
    Colors
    <span class="material-symbols-outlined text-sm">expand_more</span>
  `;

  const dropdown = document.createElement('div');
  dropdown.className = 'color-dropdown hidden absolute top-full left-0 mt-1 p-1.5 rounded-lg bg-surface-800 border border-slate-700/50 shadow-xl';
  dropdown.style.cssText = 'z-index:10001!important;min-width:160px;';

  const swatchGrid = document.createElement('div');
  swatchGrid.className = 'grid gap-0.5';
  swatchGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';

  COLOR_GROUPS.forEach(group => {
    group.colors.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-4 h-4 rounded-sm border border-slate-600/30 hover:scale-125 hover:border-white/50 hover:z-10 transition-all';
      btn.style.backgroundColor = c.color;
      btn.title = `${c.name} (${c.code})`;
      btn.addEventListener('click', () => {
        insertAtCursor(nameInput, c.code);
        dropdown.classList.add('hidden');
      });
      swatchGrid.appendChild(btn);
    });
  });

  dropdown.appendChild(swatchGrid);
  pickerWrap.appendChild(toggleBtn);
  pickerWrap.appendChild(dropdown);
  bar.appendChild(pickerWrap);

  toggleBtn.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', e => {
    if (!dropdown.contains(e.target) && !toggleBtn.contains(e.target))
      dropdown.classList.add('hidden');
  });

  const fmtWrap = document.createElement('div');
  fmtWrap.className = 'flex items-center gap-1';
  const fmtLabel = document.createElement('span');
  fmtLabel.className = 'text-xs text-mist font-medium';
  fmtLabel.textContent = 'Format:';
  fmtWrap.appendChild(fmtLabel);

  FORMAT_CODES.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-6 h-5 rounded text-xs font-bold bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-600/50 transition-colors';
    btn.textContent = f.icon;
    btn.title = `${f.name} (${f.code})`;
    btn.addEventListener('click', () => insertAtCursor(nameInput, f.code));
    fmtWrap.appendChild(btn);
  });
  bar.appendChild(fmtWrap);

  container.appendChild(bar);
}

function createEnchantRow(ench, itemIdx, enchIdx) {
  const row = document.createElement('div');
  row.className = 'kit-ench-row flex flex-col gap-2 p-3 rounded-lg bg-black/20 border border-slate-700/20';

  const enchName = ENCHANTMENTS[ench.id] ?? `Enchant #${ench.id}`;

  row.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined text-primary text-sm shrink-0">auto_fix_high</span>
      <button type="button" class="kit-ench-picker flex-1 text-left text-sm text-white px-3 py-1.5 rounded-lg border transition-colors"
        style="${INPUT_STYLE} cursor:pointer;" title="Click to change enchantment">
        <span class="kit-ench-label">${enchName}</span>
      </button>
      <button type="button" class="kit-remove-ench flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors rounded shrink-0">
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-xs text-slate-400 shrink-0">Level</span>
      <input type="number" min="1" max="32767" value="${ench.level}"
        class="kit-ench-lvl input-field w-28 h-8 px-3 rounded-lg text-sm text-white text-center"
        style="${INPUT_STYLE} -moz-appearance:textfield;" />
      <span class="text-xs text-slate-600">(1 – 32767)</span>
    </div>
  `;

  const pickerBtn = row.querySelector('.kit-ench-picker');
  const label     = row.querySelector('.kit-ench-label');

  pickerBtn.addEventListener('click', e => {
    e.stopPropagation();
    openEnchPopup(pickerBtn, ench.id, newId => {
      ench.id = newId;
      if (kitItems[itemIdx]?.enchants[enchIdx])
        kitItems[itemIdx].enchants[enchIdx].id = newId;
      label.textContent = ENCHANTMENTS[newId] ?? `Enchant #${newId}`;
    });
  });

  row.querySelector('.kit-ench-lvl').addEventListener('input', e => {
    const lvl = clampLevel(parseInt(e.target.value));
    if (kitItems[itemIdx]?.enchants[enchIdx])
      kitItems[itemIdx].enchants[enchIdx].level = lvl;
  });

  row.querySelector('.kit-remove-ench').addEventListener('click', () => {
    if (!kitItems[itemIdx]) return;
    kitItems[itemIdx].enchants.splice(enchIdx, 1);
    renderItemList();
  });

  return row;
}

function createItemCard(item, index) {
  const card = document.createElement('div');
  card.className = 'kit-item-card flex flex-col gap-3 p-4 rounded-lg card';

  const collapseIcon = item.collapsed ? 'expand_more' : 'expand_less';
  const optionsDisplay = item.collapsed ? 'none' : '';

  card.innerHTML = `
    <div class="flex gap-3 items-center">
      <span class="text-slate-500 text-sm w-5 shrink-0 text-right select-none">${index + 1}.</span>
      <input type="text" placeholder="e.g. minecraft:diamond"
        class="kit-item-id input-field flex-1 h-10 px-3 rounded-lg text-sm text-white"
        style="${item.id ? INPUT_STYLE : INPUT_ERROR_STYLE}"
        value="${item.id}" />
      <button type="button" class="kit-collapse-item shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:bg-slate-700/60 transition-colors" title="Collapse / expand item">
        <span class="material-symbols-outlined text-xl kit-collapse-icon">${collapseIcon}</span>
      </button>
      <button type="button" class="kit-remove-item shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors" title="Remove item">
        <span class="material-symbols-outlined text-xl">delete</span>
      </button>
    </div>

    <div class="kit-options-bar flex flex-col gap-3 p-3 rounded-lg bg-surface-900/50 border border-slate-700/30" style="display:${optionsDisplay}">

      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-400 font-medium">Amount <span class="text-slate-600">(1–99)</span></span>
          <input type="number" min="1" max="99" value="${item.count}"
            class="kit-item-count input-field h-9 px-3 rounded-lg text-sm text-white text-center"
            style="${INPUT_STYLE} -moz-appearance:textfield;" title="Stack count (1–99)" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-400 font-medium">Data <span class="text-slate-600">(0–32767)</span></span>
          <input type="number" min="0" max="32767" value="${item.damage}"
            class="kit-item-damage input-field h-9 px-3 rounded-lg text-sm text-white text-center"
            style="${INPUT_STYLE} -moz-appearance:textfield;" title="Damage / data value" />
        </label>
      </div>

      <div class="flex flex-col gap-1 kit-name-section">
        <span class="text-xs text-slate-400 font-medium">Display Name</span>
        <input type="text" placeholder="Custom name (supports §colour codes)"
          value="${item.displayName.replace(/"/g, '&quot;')}"
          class="kit-item-name input-field w-full h-9 px-3 rounded-lg text-sm text-white"
          style="${INPUT_STYLE}" title="Custom display name" />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs text-slate-400 font-medium">Enchantments</span>
          <button type="button" class="kit-add-ench flex items-center gap-1 px-2 py-1 text-xs font-medium rounded btn-secondary text-mist">
            <span class="material-symbols-outlined text-sm">auto_fix_high</span>
            Add Enchant
          </button>
        </div>
        <div class="kit-ench-list space-y-2"></div>
      </div>

    </div>
  `;

  const enchList = card.querySelector('.kit-ench-list');
  item.enchants.forEach((ench, ei) => enchList.appendChild(createEnchantRow(ench, index, ei)));

  const idInput   = card.querySelector('.kit-item-id');
  const nameInput = card.querySelector('.kit-item-name');
  const nameSection = card.querySelector('.kit-name-section');

  buildColorToolbar(nameInput, nameSection);

  idInput.addEventListener('input', () => {
    kitItems[index].id = idInput.value.trim();
    applyIdStyle(idInput);
  });

  card.querySelector('.kit-item-count').addEventListener('input', e => {
    kitItems[index].count = clampCount(parseInt(e.target.value));
  });

  card.querySelector('.kit-item-damage').addEventListener('input', e => {
    kitItems[index].damage = clampDamage(parseInt(e.target.value));
  });

  nameInput.addEventListener('input', () => {
    kitItems[index].displayName = nameInput.value;
  });

  const optionsBar   = card.querySelector('.kit-options-bar');
  const collapseBtn  = card.querySelector('.kit-collapse-item');
  const collapseIconEl = card.querySelector('.kit-collapse-icon');

  collapseBtn.addEventListener('click', e => {
    e.stopPropagation();
    item.collapsed = !item.collapsed;
    optionsBar.style.display = item.collapsed ? 'none' : '';
    collapseIconEl.textContent = item.collapsed ? 'expand_more' : 'expand_less';
  });

  card.querySelector('.kit-remove-item').addEventListener('click', () => {
    kitItems.splice(index, 1);
    renderItemList();
    updateSlotCount();
  });

  card.querySelector('.kit-add-ench').addEventListener('click', () => {
    kitItems[index].enchants.push({ id: 17, level: 1 });
    renderItemList();
  });

  return card;
}

function renderItemList() {
  closeEnchPopup();
  const list = document.getElementById('kit-item-list');
  if (!list) return;
  list.innerHTML = '';
  if (kitItems.length === 0) {
    list.innerHTML = `<p class="text-slate-500 text-sm py-2 px-1">No items added yet. Click "Add Item" to begin.</p>`;
    return;
  }
  kitItems.forEach((item, index) => list.appendChild(createItemCard(item, index)));
}

function updateSlotCount() {
  const counter         = document.getElementById('kit-slot-counter');
  const containerSelect = document.getElementById('kit-container-select');
  if (!counter || !containerSelect) return;
  const container = CONTAINERS[containerSelect.value];
  const maxSlots  = container ? container.slots : 27;
  counter.textContent = `${kitItems.length} / ${maxSlots} slots`;
  counter.classList.toggle('text-red-400',   kitItems.length > maxSlots);
  counter.classList.toggle('text-slate-400', kitItems.length <= maxSlots);
}

function setKitStatus(msg, type = 'info') {
  const el = document.getElementById('kit-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'text-sm mt-1 ' + (
    type === 'error'   ? 'text-red-400'   :
    type === 'success' ? 'text-green-400' :
    'text-slate-400'
  );
}

export function initKitBuilder() {
  kitItems = [];

  const addBtn          = document.getElementById('kit-add-item');
  const generateBtn     = document.getElementById('kit-generate');
  const containerSelect = document.getElementById('kit-container-select');
  if (!addBtn || !generateBtn || !containerSelect) return;

  renderItemList();
  updateSlotCount();

  containerSelect.addEventListener('change', updateSlotCount);

  document.addEventListener('click', e => {
    if (!document.body.contains(e.target)) return;
    const list = document.getElementById('kit-item-list');
    if (!list) return;
    if (list.contains(e.target)) return;
    list.querySelectorAll('.kit-item-card').forEach((card, i) => {
      const bar = card.querySelector('.kit-options-bar');
      if (bar && bar.style.display !== 'none') {
        bar.style.display = 'none';
        const icon = card.querySelector('.kit-collapse-icon');
        if (icon) icon.textContent = 'expand_more';
        if (kitItems[i]) kitItems[i].collapsed = true;
      }
    });
  });

  addBtn.addEventListener('click', () => {
    const container = CONTAINERS[containerSelect.value];
    if (kitItems.length >= container.slots) {
      setKitStatus(`This container only has ${container.slots} slots.`, 'error');
      return;
    }
    kitItems.push(makeItem());
    renderItemList();
    updateSlotCount();
    setKitStatus('');
    const inputs = document.getElementById('kit-item-list')?.querySelectorAll('.kit-item-id');
    if (inputs?.length) inputs[inputs.length - 1].focus();
  });

  generateBtn.addEventListener('click', () => {
    closeEnchPopup();
    syncFromDOM();

    const containerKey = containerSelect.value;
    const kitName      = (document.getElementById('kit-name-input')?.value.trim() || 'kit') || 'kit';
    const validItems   = kitItems.filter(item => item.id !== '');

    if (validItems.length === 0) {
      setKitStatus('Add at least one item before generating.', 'error');
      return;
    }
    const container = CONTAINERS[containerKey];
    if (validItems.length > container.slots) {
      setKitStatus(`Too many items. Max ${container.slots} slots for this container.`, 'error');
      return;
    }

    try {
      const buffer   = buildKitStructure(containerKey, validItems);
      const safeName = kitName.replace(/[^a-zA-Z0-9_\-]/g, '_');
      downloadBuffer(buffer, `${safeName}.mcstructure`);
      setKitStatus(`Downloaded ${safeName}.mcstructure with ${validItems.length} item(s).`, 'success');
    } catch (e) {
      console.error('Kit builder error:', e);
      setKitStatus('Failed to generate structure. Check the console for details.', 'error');
    }
  });

}
