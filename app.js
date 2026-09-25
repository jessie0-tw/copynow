/**
 * CopyNow — app.js
 * Text snippet manager with categories, localStorage persistence,
 * and one-click clipboard copy.
 */

'use strict';

/* ══════════════════════════════════════
   DATA LAYER
   ══════════════════════════════════════ */

const STORAGE_KEY = 'copynow_data';

/** @returns {{ snippets: Snippet[], categories: string[] }} */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return { snippets: [], categories: [] };
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* ignore */ }
}

/** @typedef {{ id: string, title: string, content: string, category: string, usedAt: number|null, createdAt: number }} Snippet */

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ══════════════════════════════════════
   STATE
   ══════════════════════════════════════ */

const state = loadData();
state.snippets   = state.snippets   || [];
state.categories = state.categories || [];

let currentFilter    = 'all';    // 'all' | 'recent' | <categoryName>
let currentView      = 'grid';   // 'grid' | 'list'
let searchQuery      = '';
let editingSnippetId = null;     // null = adding new
let pendingDeleteId  = null;

// Seed sample snippets on first launch
if (state.snippets.length === 0) {
  seedSamples();
  saveData();
}

function seedSamples() {
  const sampleCats = ['工作', '個人'];
  sampleCats.forEach(c => {
    if (!state.categories.includes(c)) state.categories.push(c);
  });
  const samples = [
    { title: '問候語', content: '您好！很高興認識您，如有任何問題歡迎隨時聯繫。', category: '工作' },
    { title: '公司地址', content: '台北市信義區信義路五段 7 號', category: '工作' },
    { title: '電子郵件簽名', content: '敬上\n王小明\n產品設計師 | XYZ 公司\nemail@example.com', category: '工作' },
    { title: '常用感謝語', content: '非常感謝您的協助，祝一切順利！', category: '個人' },
    { title: 'WiFi 密碼', content: 'mypassword123', category: '個人' },
  ];
  samples.forEach(s => {
    state.snippets.push({
      id: makeId(),
      title: s.title,
      content: s.content,
      category: s.category,
      usedAt: null,
      createdAt: Date.now(),
    });
  });
}

/* ══════════════════════════════════════
   DOM REFERENCES
   ══════════════════════════════════════ */

const $ = id => document.getElementById(id);

const els = {
  // Header
  searchInput:    $('search-input'),
  btnAddSnippet:  $('btn-add-snippet'),

  // Sidebar
  filterAll:        $('filter-all'),
  filterRecent:     $('filter-recent'),
  badgeAll:         $('badge-all'),
  badgeRecent:      $('badge-recent'),
  categoriesNav:    $('categories-nav'),
  btnAddCategory:   $('btn-add-category'),

  // Mobile tabs
  mobileTabs:       $('mobile-tabs'),
  mobBtnAddCat:     $('mob-btn-add-category'),

  // Content
  contentTitle:   $('content-title'),
  snippetsGrid:   $('snippets-grid'),
  emptyState:     $('empty-state'),
  btnAddFirst:    $('btn-add-first'),
  viewGrid:       $('view-grid'),
  viewList:       $('view-list'),

  // Snippet modal
  snippetModal:   $('snippet-modal'),
  modalTitle:     $('modal-title'),
  snippetForm:    $('snippet-form'),
  fieldTitle:     $('field-title'),
  fieldContent:   $('field-content'),
  fieldCategory:  $('field-category'),
  fieldNewCat:    $('field-new-category'),
  charCount:      $('char-count'),
  errTitle:       $('err-title'),
  errContent:     $('err-content'),
  modalClose:     $('modal-close'),
  modalCancel:    $('modal-cancel'),

  // Confirm modal
  confirmModal:   $('confirm-modal'),
  confirmOk:      $('confirm-ok'),
  confirmCancel:  $('confirm-cancel'),

  // Category modal
  categoryModal:  $('category-modal'),
  newCatName:     $('new-cat-name'),
  catModalClose:  $('cat-modal-close'),
  catModalCancel: $('cat-modal-cancel'),
  catModalSave:   $('cat-modal-save'),

  // Toast
  toast:          $('toast'),
};

/* ══════════════════════════════════════
   RENDER
   ══════════════════════════════════════ */

function getFilteredSnippets() {
  let list = [...state.snippets];

  // filter by tab
  if (currentFilter === 'recent') {
    list = list.filter(s => s.usedAt !== null);
    list.sort((a, b) => b.usedAt - a.usedAt);
    list = list.slice(0, 20);
  } else if (currentFilter !== 'all') {
    list = list.filter(s => s.category === currentFilter);
  }

  // search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q) ||
      (s.category && s.category.toLowerCase().includes(q))
    );
  }

  return list;
}

function render() {
  renderSidebar();
  renderSnippets();
}

function renderSidebar() {
  const total  = state.snippets.length;
  const recent = state.snippets.filter(s => s.usedAt !== null).length;

  els.badgeAll.textContent    = total;
  els.badgeRecent.textContent = recent;

  // active state — desktop sidebar
  els.filterAll.classList.toggle('active', currentFilter === 'all');
  els.filterRecent.classList.toggle('active', currentFilter === 'recent');

  // desktop categories
  els.categoriesNav.innerHTML = '';
  state.categories.forEach(cat => {
    const count = state.snippets.filter(s => s.category === cat).length;
    const isActive = currentFilter === cat;

    const li = document.createElement('li');
    const wrap = document.createElement('div');
    wrap.className = 'category-item-wrap' + (isActive ? ' active' : '');

    const btn = document.createElement('button');
    btn.className = 'sidebar-item';
    btn.dataset.filter = cat;
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      ${escapeHtml(cat)}
      <span class="badge">${count}</span>
    `;
    btn.addEventListener('click', () => setFilter(cat));

    const delBtn = document.createElement('button');
    delBtn.className = 'cat-delete-btn btn-icon';
    delBtn.title = '刪除分類';
    delBtn.setAttribute('aria-label', `刪除分類 ${cat}`);
    delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCategory(cat);
    });

    wrap.appendChild(btn);
    wrap.appendChild(delBtn);
    li.appendChild(wrap);
    els.categoriesNav.appendChild(li);
  });

  // ── Mobile tab bar ──
  // Keep the first two static tabs (全部, 最近使用), remove old category tabs
  const existingCatTabs = els.mobileTabs.querySelectorAll('.mobile-tab.cat-tab');
  existingCatTabs.forEach(t => t.remove());

  // Update active state on static tabs
  els.mobileTabs.querySelector('[data-filter="all"]').classList.toggle('active', currentFilter === 'all');
  els.mobileTabs.querySelector('[data-filter="recent"]').classList.toggle('active', currentFilter === 'recent');

  // Add a mobile tab for each category
  state.categories.forEach(cat => {
    const isActive = currentFilter === cat;
    const tabBtn = document.createElement('button');
    tabBtn.className = 'mobile-tab cat-tab' + (isActive ? ' active' : '');
    tabBtn.dataset.filter = cat;
    tabBtn.role = 'tab';
    tabBtn.setAttribute('aria-selected', String(isActive));
    tabBtn.textContent = cat;
    tabBtn.addEventListener('click', () => setFilter(cat));
    els.mobileTabs.appendChild(tabBtn);
  });

  // Scroll active tab into view (smooth)
  const activeTab = els.mobileTabs.querySelector('.mobile-tab.active');
  if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function renderSnippets() {
  const list = getFilteredSnippets();

  if (list.length === 0) {
    els.snippetsGrid.style.display = 'none';
    els.emptyState.style.display = 'flex';
  } else {
    els.snippetsGrid.style.display = '';
    els.emptyState.style.display = 'none';
  }

  // apply view class
  els.snippetsGrid.className = 'snippets-grid' + (currentView === 'list' ? ' list-view' : '');

  // diff render: clear & rebuild (simple for this scale)
  els.snippetsGrid.innerHTML = '';
  list.forEach(snippet => {
    const card = buildCard(snippet);
    els.snippetsGrid.appendChild(card);
  });

  // update content title
  if (currentFilter === 'all')    els.contentTitle.textContent = '全部片段';
  else if (currentFilter === 'recent') els.contentTitle.textContent = '最近使用';
  else els.contentTitle.textContent = currentFilter;
}

function buildCard(snippet) {
  const article = document.createElement('article');
  article.className = 'snippet-card';
  article.role = 'listitem';
  article.dataset.id = snippet.id;

  article.innerHTML = `
    <div class="card-header">
      <p class="card-title">${escapeHtml(snippet.title)}</p>
      <div class="card-actions">
        <button class="card-action-btn edit-btn" aria-label="編輯 ${escapeHtml(snippet.title)}" title="編輯">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="card-action-btn danger delete-btn" aria-label="刪除 ${escapeHtml(snippet.title)}" title="刪除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>
    <p class="card-body">${escapeHtml(snippet.content)}</p>
    <div class="card-footer">
      ${snippet.category
        ? `<span class="card-category-badge">${escapeHtml(snippet.category)}</span>`
        : '<span></span>'
      }
      <button class="card-copy-btn copy-btn" aria-label="複製 ${escapeHtml(snippet.title)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        複製
      </button>
    </div>
  `;

  article.querySelector('.copy-btn').addEventListener('click',   () => copySnippet(snippet.id, article));
  article.querySelector('.edit-btn').addEventListener('click',   () => openEditModal(snippet.id));
  article.querySelector('.delete-btn').addEventListener('click', () => openDeleteConfirm(snippet.id));

  return article;
}


/* ══════════════════════════════════════
   ACTIONS
   ══════════════════════════════════════ */

function setFilter(filter) {
  currentFilter = filter;
  render();
}

async function copySnippet(id, cardEl) {
  const snippet = state.snippets.find(s => s.id === id);
  if (!snippet) return;

  try {
    await navigator.clipboard.writeText(snippet.content);
    snippet.usedAt = Date.now();
    saveData();

    // visual feedback
    const copyBtn = cardEl.querySelector('.copy-btn');
    copyBtn.classList.add('copied');
    copyBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      已複製！
    `;
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        複製
      `;
    }, 2000);

    showToast(`✓ 已複製「${snippet.title}」`, 'success');
    renderSidebar(); // update recent badge
  } catch (_) {
    showToast('複製失敗，請檢查瀏覽器權限', 'error');
  }
}

/* ─── Add Category ─── */
function deleteCategory(cat) {
  state.categories = state.categories.filter(c => c !== cat);
  // un-assign snippets in this category
  state.snippets.forEach(s => { if (s.category === cat) s.category = ''; });
  if (currentFilter === cat) currentFilter = 'all';
  saveData();
  render();
  showToast(`已刪除分類「${cat}」`);
}

/* ══════════════════════════════════════
   SNIPPET MODAL
   ══════════════════════════════════════ */

function openAddModal() {
  editingSnippetId = null;
  els.modalTitle.textContent = '新增片段';
  els.snippetForm.reset();
  els.errTitle.textContent   = '';
  els.errContent.textContent = '';
  els.charCount.textContent  = '0 / 5000';
  populateCategorySelect();
  els.snippetModal.showModal();
  els.fieldTitle.focus();
}

function openEditModal(id) {
  const snippet = state.snippets.find(s => s.id === id);
  if (!snippet) return;
  editingSnippetId = id;

  els.modalTitle.textContent      = '編輯片段';
  els.fieldTitle.value            = snippet.title;
  els.fieldContent.value          = snippet.content;
  els.errTitle.textContent        = '';
  els.errContent.textContent      = '';
  els.charCount.textContent       = `${snippet.content.length} / 5000`;
  els.fieldNewCat.value           = '';

  populateCategorySelect(snippet.category);
  els.snippetModal.showModal();
  els.fieldTitle.focus();
}

function populateCategorySelect(selected = '') {
  els.fieldCategory.innerHTML = '<option value="">— 無分類 —</option>';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === selected) opt.selected = true;
    els.fieldCategory.appendChild(opt);
  });
}

function closeSnippetModal() {
  els.snippetModal.close();
}

function saveSnippet() {
  const title   = els.fieldTitle.value.trim();
  const content = els.fieldContent.value.trim();
  let   category = els.fieldNewCat.value.trim() || els.fieldCategory.value;

  // Validate
  let valid = true;
  if (!title) {
    els.errTitle.textContent = '請輸入標題';
    els.fieldTitle.focus();
    valid = false;
  } else { els.errTitle.textContent = ''; }

  if (!content) {
    els.errContent.textContent = '請輸入內容';
    if (valid) els.fieldContent.focus();
    valid = false;
  } else { els.errContent.textContent = ''; }

  if (!valid) return;

  // Auto-add new category if typed
  if (els.fieldNewCat.value.trim() && !state.categories.includes(category)) {
    state.categories.push(category);
  }

  if (editingSnippetId) {
    const snippet = state.snippets.find(s => s.id === editingSnippetId);
    if (snippet) {
      snippet.title    = title;
      snippet.content  = content;
      snippet.category = category;
    }
    showToast('片段已更新', 'success');
  } else {
    state.snippets.unshift({
      id:        makeId(),
      title,
      content,
      category,
      usedAt:    null,
      createdAt: Date.now(),
    });
    showToast('片段已新增', 'success');
  }

  saveData();
  closeSnippetModal();
  render();
}

/* ══════════════════════════════════════
   DELETE CONFIRM
   ══════════════════════════════════════ */

function openDeleteConfirm(id) {
  pendingDeleteId = id;
  els.confirmModal.showModal();
  els.confirmOk.focus();
}

function closeConfirmModal() {
  pendingDeleteId = null;
  els.confirmModal.close();
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  state.snippets = state.snippets.filter(s => s.id !== pendingDeleteId);
  saveData();
  closeConfirmModal();
  render();
  showToast('片段已刪除');
}

/* ══════════════════════════════════════
   ADD CATEGORY MODAL
   ══════════════════════════════════════ */

function openCategoryModal() {
  els.newCatName.value = '';
  els.categoryModal.showModal();
  els.newCatName.focus();
}

function closeCategoryModal() {
  els.categoryModal.close();
}

function saveCategory() {
  const name = els.newCatName.value.trim();
  if (!name) { els.newCatName.focus(); return; }
  if (state.categories.includes(name)) {
    showToast(`分類「${name}」已存在`);
    closeCategoryModal();
    return;
  }
  state.categories.push(name);
  saveData();
  closeCategoryModal();
  render();
  showToast(`已新增分類「${name}」`, 'success');
}


/* ══════════════════════════════════════
   TOAST
   ══════════════════════════════════════ */

let toastTimer = null;
function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  els.toast.textContent  = msg;
  els.toast.className    = 'toast show' + (type ? ` ${type}` : '');
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 2500);
}


/* ══════════════════════════════════════
   UTILS
   ══════════════════════════════════════ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* ══════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════ */

// Header
els.btnAddSnippet.addEventListener('click', openAddModal);

// Search
els.searchInput.addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  renderSnippets();
});

// Sidebar filters
els.filterAll.addEventListener('click',    () => setFilter('all'));
els.filterRecent.addEventListener('click', () => setFilter('recent'));
els.btnAddCategory.addEventListener('click', openCategoryModal);

// Mobile tab bar — static tabs
els.mobileTabs.querySelector('[data-filter="all"]').addEventListener('click',    () => setFilter('all'));
els.mobileTabs.querySelector('[data-filter="recent"]').addEventListener('click', () => setFilter('recent'));
els.mobBtnAddCat.addEventListener('click', openCategoryModal);

// View toggles
els.viewGrid.addEventListener('click', () => {
  currentView = 'grid';
  els.viewGrid.classList.add('active');
  els.viewList.classList.remove('active');
  renderSnippets();
});
els.viewList.addEventListener('click', () => {
  currentView = 'list';
  els.viewList.classList.add('active');
  els.viewGrid.classList.remove('active');
  renderSnippets();
});

// Empty state CTA
els.btnAddFirst.addEventListener('click', openAddModal);

// Snippet modal
els.modalClose.addEventListener('click',  closeSnippetModal);
els.modalCancel.addEventListener('click', closeSnippetModal);

els.snippetForm.addEventListener('submit', e => {
  e.preventDefault();
  saveSnippet();
});

els.fieldContent.addEventListener('input', () => {
  const len = els.fieldContent.value.length;
  els.charCount.textContent = `${len} / 5000`;
});

// Close modal on backdrop click (native <dialog> behavior)
els.snippetModal.addEventListener('click', e => {
  if (e.target === els.snippetModal) closeSnippetModal();
});

// Confirm delete modal
els.confirmOk.addEventListener('click',     confirmDelete);
els.confirmCancel.addEventListener('click', closeConfirmModal);
els.confirmModal.addEventListener('click',  e => {
  if (e.target === els.confirmModal) closeConfirmModal();
});

// Category modal
els.catModalClose.addEventListener('click',  closeCategoryModal);
els.catModalCancel.addEventListener('click', closeCategoryModal);
els.catModalSave.addEventListener('click',   saveCategory);
els.newCatName.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveCategory();
});
els.categoryModal.addEventListener('click', e => {
  if (e.target === els.categoryModal) closeCategoryModal();
});

// Keyboard shortcut: Ctrl/Cmd + K to focus search
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    els.searchInput.focus();
    els.searchInput.select();
  }
});

/* ══════════════════════════════════════
   INIT
   ══════════════════════════════════════ */
render();
