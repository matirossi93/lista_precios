import './style.css'

// ====== CONFIGURATION ======
const WHATSAPP_NUMBER = '5493813315389';

const BRANCH_ADDRESSES = {
  sm: 'Av. San Martín 105, Tucumán',
  sc: 'Santo Cristo 85, Tucumán',
  jujuy: 'Av. Jujuy 1672, Tucumán'
};

// ====== STATE ======
let allData = null;
let shoppingCart = {};

// URL params
const urlParams = new URLSearchParams(window.location.search);
const isWholesale = urlParams.get('lista') === 'mayorista';
const branchParam = urlParams.get('sucursal') || 'sm';
const isSantoCristo = branchParam === 'sc' || branchParam === 'santo-cristo';
const isJujuy = branchParam === 'jujuy' || branchParam === 'ju';
const activeBranch = isJujuy ? 'jujuy' : isSantoCristo ? 'sc' : 'sm';

// ====== UTILITIES ======

const escapeHtml = (str) => {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// Color mapping
const CATEGORY_COLORS = {
  'ALIMENTO BALANCEADO ANIMAL': '#d32f2f',
  'ALIMENTO PARA PERROS': '#f57c00',
  'ALIMENTO PARA GATOS': '#fbc02d',
  'CEREALES PARA DESAYUNO': '#aed581',
  'CEREALES': '#4caf50',
  'FORRAJES': '#00bcd4',
  'LEGUMBRES': '#1976d2',
  'CONDIMENTOS': '#ec407a',
  'FRUTOS SECOS': '#ab47bc',
  'SNACKS': '#8d6e63',
  'VENENOS': '#1b5e20',
  'ACCESORIOS': '#7b1fa2',
  'BALANCEADOS': '#d32f2f',
  'ALIMENTO PERRO Y GATO': '#f57c00',
  'CEREALES Y MEZCLAS': '#4caf50',
  'COMESTIBLES': '#ff9800',
  'ACCESORIOS Y VENENOS': '#7b1fa2',
  'LIMPIEZA': '#0288d1',
  'PILETA': '#00bcd4',
  'VARIOS': '#607d8b',
  'ANIMALES DE GRANJA': '#795548',
  'SECCIONES': '#607d8b'
};

const DEFAULT_COLOR = '#333333';

// Formatter for currency
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// ====== CART PERSISTENCE ======
const CART_STORAGE_KEY = `manantial-cart-${activeBranch}-${isWholesale ? 'may' : 'min'}`;

const saveCart = () => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(shoppingCart));
  } catch (e) { }
};

const loadCart = () => {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      shoppingCart = JSON.parse(saved);
    }
  } catch (e) {
    shoppingCart = {};
  }
};

// ====== CATEGORY ICONS ======
const getCategoryIcon = (catName) => {
  const name = catName.toLowerCase();
  if (name.includes('perro') || name.includes('cachorro')) {
    return `<svg class="category-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2C12,2 9,5 9,9C9,12 11,14 11,14C11,14 8,15 8,19C8,21 10,22 12,22C14,22 16,21 16,19C16,15 13,14 13,14C13,14 15,12 15,9C15,5 12,2 12,2M7.5,14C6.12,14 5,12.88 5,11.5C5,10.12 6.12,9 7.5,9C8.88,9 10,10.12 10,11.5C10,12.88 8.88,14 7.5,14M16.5,14C15.12,14 14,12.88 14,11.5C14,10.12 15.12,9 16.5,9C17.88,9 19,10.12 19,11.5C19,12.88 17.88,14 16.5,14Z"/></svg>`;
  } else if (name.includes('gato') || name.includes('felino')) {
    return `<svg class="category-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12,8L10.67,8.09C9.81,7.07 7.4,4.5 5,4.5C5,4.5 3.03,7.46 4.96,11.41C4.41,12.24 4.07,12.67 4,13.66L2.07,13.95L2.28,14.93L4.04,14.67C4.1,15.1 4.25,15.65 4.54,16.4C4.26,16.53 3.96,16.71 3.82,16.89L4.44,17.65L5.75,16.54C6.83,18.06 8.5,19 12,19C15.5,19 17.17,18.06 18.25,16.54L19.56,17.65L20.18,16.89C20.04,16.71 19.74,16.53 19.46,16.4C19.75,15.65 19.9,15.1 19.96,14.67L21.72,14.93L21.93,13.95L20,13.66C19.93,12.67 19.59,12.24 19.04,11.41C20.97,7.46 19,4.5 19,4.5C16.6,4.5 14.19,7.07 13.33,8.09L12,8M9,11A1,1 0 0,1 10,12A1,1 0 0,1 9,13A1,1 0 0,1 8,12A1,1 0 0,1 9,11M15,11A1,1 0 0,1 16,12A1,1 0 0,1 15,13A1,1 0 0,1 14,12A1,1 0 0,1 15,11M11,14H13L12.3,15.39L12,15.7L11.7,15.39L11,14Z"/></svg>`;
  } else if (name.includes('ave') || name.includes('pajaro') || name.includes('semilla')) {
    return `<svg class="category-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M11 2C11 2 5 2 5 7C5 8.66 5.86 10.15 7.15 11C7.8 12.43 9 15 9 15L12 18L13 16C13 16 14.5 13.5 15 12C16.5 12 18.25 10.5 19 9C19 9 22 8 22 5C22 5 18 5 16 6C15 4 13 2 11 2M11 5A2 2 0 0 1 13 7A2 2 0 0 1 11 9A2 2 0 0 1 9 7A2 2 0 0 1 11 5Z"/></svg>`;
  } else if (name.includes('cereal') || name.includes('mezcla')) {
    return `<svg class="category-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2C12,2 8,6 8,12C8,14.21 8.9 16.21 10.34,17.66L9.5,22H14.5L13.66,17.66C15.1,16.21 16,14.21 16,12C16,6 12,2 12,2Z"/></svg>`;
  } else if (name.includes('sanidad') || name.includes('veneno')) {
    return `<svg class="category-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16 4H8L6 8H18L16 4M7 9V22H17V9H7Z"/></svg>`;
  }
  return `<svg class="category-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 7,11.5 7,11.5C7,11.5 10.9,10 17,8Z"/></svg>`;
};

// ====== RENDERING ======

// Generate Index Horizontal (Buttons)
const renderIndex = (categories) => {
  const navContainer = document.getElementById('categoryNav');
  navContainer.innerHTML = '';

  const activeCategories = categories.filter(c => c.brands.some(b => b.items.length > 0));

  let indexHtml = `<div class="horizontal-index">`;

  activeCategories.forEach((cat) => {
    const color = CATEGORY_COLORS[cat.name] || DEFAULT_COLOR;
    const catId = 'cat-' + cat.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    let textColor = 'white';
    if (['#fbc02d', '#aed581', '#4caf50', '#00bcd4'].includes(color)) {
      textColor = '#212121';
    }

    indexHtml += `
      <button class="index-btn"
        style="--cat-color: ${color}; --text-color: ${textColor};"
        onclick="window.scrollToCategory('${catId}')">
        ${escapeHtml(cat.name)}
      </button>
    `;
  });

  indexHtml += `</div>`;
  navContainer.innerHTML = indexHtml;

  // Global scroll function — renders remaining batches async to avoid blocking
  window.scrollToCategory = (catId) => {
    const renderUntilFound = () => {
      let el = document.getElementById(catId);
      if (el) {
        const yOffset = -70;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });

        // Close mobile modal if open
        const overlay = document.getElementById('mobileModalOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
          overlay.click();
        }
        return;
      }

      if (currentRenderIndex < currentRenderItems.length) {
        renderBatch();
        // Use requestAnimationFrame to avoid blocking the main thread
        requestAnimationFrame(renderUntilFound);
      }
    };

    renderUntilFound();
  };

  // Populate mobile category list
  const mobileCatList = document.getElementById('mobileCategoryList');
  if (mobileCatList) {
    mobileCatList.innerHTML = '';
    activeCategories.forEach(cat => {
      const catId = 'cat-' + cat.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const btn = document.createElement('button');
      btn.className = 'modal-opt';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '10px';
      btn.innerHTML = `${getCategoryIcon(cat.name)} <span>${escapeHtml(cat.name)}</span>`;
      btn.onclick = () => window.scrollToCategory(catId);
      mobileCatList.appendChild(btn);
    });
  }
};

// Paginator Globals
let currentRenderItems = [];
let currentRenderIndex = 0;
const BATCH_SIZE = 10;
let currentFilterText = '';

const renderBatch = () => {
  const container = document.getElementById('productList');
  let html = '';

  const end = Math.min(currentRenderIndex + BATCH_SIZE, currentRenderItems.length);

  for (let i = currentRenderIndex; i < end; i++) {
    const { brand, category, headers, color, headerTextColor, colSpan, isNewCategory } = currentRenderItems[i];

    const isContinuingCategory = (i === currentRenderIndex) && !isNewCategory;

    if (isNewCategory || isContinuingCategory) {
      if (i > currentRenderIndex) {
        html += `
              </tbody>
            </table>
          </div>
        </section>
        `;
      }

      html += `
        <section id="cat-${category.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}" class="category-section" style="--cat-color: ${color}; --text-color: ${headerTextColor};">
          ${isNewCategory ? `<div class="category-header">
            ${getCategoryIcon(category.name)} ${escapeHtml(category.name)}
          </div>` : ''}
          <div class="table-responsive">
            <table class="pricing-table">
              <thead>
                ${isNewCategory ? `<tr style="display: none;"></tr>` : ''}
                <tr>
                  <th class="col-code">COD</th>
                  <th class="col-desc">DESCRIPCION</th>
                  ${headers.map(h => `<th class="col-price">${escapeHtml(h)}</th>`).join('')}
                  <th class="col-cart"></th>
                </tr>
              </thead>
              <tbody>
      `;
    }

    // Brand Header
    if (brand.name !== category.name && brand.name !== 'General' && brand.name !== 'PERRO:' && brand.name !== 'GATO:') {
      html += `
          <tr class="brand-row">
            <td colspan="${colSpan + 2}">${escapeHtml(brand.name)}</td>
          </tr>
        `;
    }

    // Items
    brand.items.forEach(item => {
      const escapedDesc = escapeHtml(item.description);
      const escapedCode = escapeHtml(item.code);

      html += `
        <tr>
          <td class="col-code"><span class="item-code">${escapedCode}</span></td>
          <td class="col-desc"><span class="item-desc">${escapedDesc}</span></td>
          ${headers.map((h, idx) => {
        const priceVal = item[`price${idx + 1}`];
        const hasPrice = priceVal !== null && priceVal !== undefined;
        const safeHeader = escapeHtml(h || 'Lista ' + (idx + 1));
        return `
            <td class="col-price price-cell">
              <div class="price-container">
                <span>${hasPrice ? '$ ' + formatCurrency(priceVal) : ''}</span>
                ${hasPrice ? `<button class="btn-add-cart" onclick="window.addToCart(this, '${escapedCode}', ${idx + 1}, '${safeHeader}')" aria-label="Agregar">+</button>` : ''}
              </div>
            </td>`;
      }).join('')}
        </tr>
      `;
    });
  }

  // Close the last table/section
  if (currentRenderItems.length > 0 && end > currentRenderIndex) {
    html += `
            </tbody>
          </table>
        </div>
      </section>
      `;
  }

  container.insertAdjacentHTML('beforeend', html);
  currentRenderIndex = end;
};

// Intersection Observer for Infinite Scroll
let scrollObserver = null;
const setupObserver = () => {
  if (scrollObserver) scrollObserver.disconnect();

  const sentinel = document.getElementById('scrollSentinel');
  if (!sentinel) return;

  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && currentRenderIndex < currentRenderItems.length) {
      setTimeout(renderBatch, 10);
    }
  }, { rootMargin: '200px' });

  scrollObserver.observe(sentinel);
};

// Helper for fuzzy search
const normalizeText = (text) => {
  if (!text) return '';
  return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const fuzzyMatch = (filterText, targetText) => {
  const p = normalizeText(filterText);
  const t = normalizeText(targetText);
  if (t.includes(p)) return true;

  const words = p.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 0 && words.every(w => t.includes(w))) return true;

  return false;
};

const renderList = (data, filterText = '') => {
  const container = document.getElementById('productList');

  if (!data) return;

  currentFilterText = filterText;
  currentRenderItems = [];
  currentRenderIndex = 0;
  container.innerHTML = '';

  let hasResults = false;

  data.categories.forEach(category => {
    const filteredBrands = category.brands.map(brand => {
      const filteredItems = brand.items.filter(item => {
        const matchCode = fuzzyMatch(filterText, item.code);
        const matchDesc = fuzzyMatch(filterText, item.description);
        const matchBrand = fuzzyMatch(filterText, brand.name);
        const matchCategory = fuzzyMatch(filterText, category.name);

        return matchCode || matchDesc || matchBrand || matchCategory;
      });

      return { ...brand, items: filteredItems };
    }).filter(brand => brand.items.length > 0);

    if (filteredBrands.length > 0) {
      hasResults = true;
      const color = CATEGORY_COLORS[category.name] || DEFAULT_COLOR;

      let headerTextColor = 'white';
      if (['#fbc02d', '#aed581', '#4caf50', '#00bcd4'].includes(color)) {
        headerTextColor = '#212121';
      }

      let headers = category.columns && category.columns.length > 0
        ? category.columns
        : (isWholesale ? ['LISTA 1', 'LISTA 2', 'LISTA 3', 'LISTA 4'] : ['PRECIO']).filter(Boolean);

      const colSpan = Math.max(1, headers.length);

      filteredBrands.forEach((brand, idx) => {
        currentRenderItems.push({
          category,
          brand,
          headers,
          color,
          headerTextColor,
          colSpan,
          isNewCategory: idx === 0
        });
      });
    }
  });

  if (!hasResults) {
    container.innerHTML = '<div class="no-results">No se encontraron productos que coincidan con la búsqueda.</div>';
  } else {
    renderBatch();
    setupObserver();
  }

  if (filterText === '') {
    renderIndex(data.categories);
    document.getElementById('categoryNav').style.display = 'block';

    const promoContainer = document.getElementById('promoContainer');
    const wholesaleBannerContainer = document.getElementById('wholesaleBannerContainer');

    if (promoContainer) promoContainer.innerHTML = '';
    if (wholesaleBannerContainer) wholesaleBannerContainer.innerHTML = '';

    if (!isWholesale) {
      const wholesaleBtn = document.createElement('div');
      wholesaleBtn.className = 'wholesale-promo';
      wholesaleBtn.innerHTML = `
            <a href="?lista=mayorista"
               class="btn-wholesale">
               ¿Sos Mayorista? Ver Lista
            </a>
        `;
      if (promoContainer) promoContainer.appendChild(wholesaleBtn);
    } else {
      const badge = document.createElement('div');
      badge.className = 'wholesale-alert';
      badge.innerHTML = `
          <div class="wholesale-alert-title">🔒 LISTA MAYORISTA</div>
          <div class="wholesale-alert-text">Solo para comercios. Compra mínima: $200.000</div>
          <div style="display: flex; gap: 8px; width: 100%; max-width: 400px; margin-top: 4px;">
            <a href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20quisiera%20hacer%20un%20pedido%20mayorista." target="_blank" class="btn-wholesale" style="flex: 1; justify-content: center; border: 1px solid rgba(0,0,0,0.2);">
                Hace tu pedido
            </a>
            <a href="/" class="btn-wholesale" style="flex: 1; justify-content: center; background: #ea4335; border: 1px solid rgba(0,0,0,0.2);">
                ⬅️ Volver
            </a>
          </div>
      `;
      if (wholesaleBannerContainer) wholesaleBannerContainer.appendChild(badge);
    }

  } else {
    document.getElementById('categoryNav').style.display = 'none';
    const wholesaleBannerContainer = document.getElementById('wholesaleBannerContainer');
    if (wholesaleBannerContainer) wholesaleBannerContainer.style.display = 'none';
  }
};

// ====== Theme Toggle (Dark Mode) ======
const themeToggleBtn = document.getElementById('themeToggleBtn');
if (themeToggleBtn) {
  const savedTheme = localStorage.getItem('manantial-theme');

  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggleBtn.textContent = '☀️';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggleBtn.textContent = '🌙';
  }

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('manantial-theme', newTheme);
    themeToggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  });
}

// ====== Service Worker Registration ======
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => console.log('SW registration failed:', err));
  });
}

// Handle Offline/Online UI
const offlineBanner = document.getElementById('offlineBanner');
window.addEventListener('offline', () => {
  if (offlineBanner) offlineBanner.classList.remove('hidden');
});
window.addEventListener('online', () => {
  if (offlineBanner) offlineBanner.classList.add('hidden');
});

if (!navigator.onLine && offlineBanner) {
  offlineBanner.classList.remove('hidden');
}

// ====== INITIALIZE ======
const init = async () => {
  // Load saved cart
  loadCart();

  // Handle Branch Selector visibility and logic
  if (!isWholesale) {
    const selector = document.getElementById('branchSelector');
    if (selector) {
      selector.classList.remove('hidden');

      const btnSM = document.getElementById('btnBranchSM');
      const btnSC = document.getElementById('btnBranchSC');
      const btnJujuy = document.getElementById('btnBranchJU');

      if (isJujuy) {
        btnJujuy.classList.add('active');
      } else if (isSantoCristo) {
        btnSC.classList.add('active');
      } else {
        btnSM.classList.add('active');
      }

      btnSM.addEventListener('click', () => {
        if (!btnSM.classList.contains('active')) window.location.search = '?sucursal=sm';
      });
      btnSC.addEventListener('click', () => {
        if (!btnSC.classList.contains('active')) window.location.search = '?sucursal=sc';
      });
      btnJujuy.addEventListener('click', () => {
        if (!btnJujuy.classList.contains('active')) window.location.search = '?sucursal=jujuy';
      });
    }
  }

  // Build API URL
  const apiParams = new URLSearchParams();
  if (isWholesale) {
    apiParams.set('lista', 'mayorista');
  } else {
    apiParams.set('sucursal', activeBranch);
  }
  const apiUrl = `/api/precios?${apiParams.toString()}`;

  document.getElementById('productList').innerHTML = '<div class="loading">Cargando lista actualizada...</div>';

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Error desconocido');

    const data = json.data;
    allData = data;

    if (data.updatedAt) {
      document.getElementById('lastUpdated').textContent = `Actualizado: ${data.updatedAt}`;
    } else {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      document.getElementById('lastUpdated').textContent = `Actualizado: ${dd}/${mm}/${today.getFullYear()}`;
    }
    if (data.contact) document.getElementById('contactInfo').textContent = data.contact.replace('tel:', 'Tel:').replace('mail:', '| Mail:');

    renderList(allData);

    // Update cart UI with loaded data
    updateCartUI();

    // Save API response for offline fallback
    try {
      localStorage.setItem(`backup_api_${activeBranch}_${isWholesale}`, JSON.stringify(data));
    } catch (e) { }

    // Search with debounce
    const searchInput = document.getElementById('searchInput');
    const debouncedSearch = debounce((value) => {
      renderList(allData, value);
    }, 200);

    searchInput.oninput = (e) => {
      debouncedSearch(e.target.value);
    };

  } catch (err) {
    console.error('API fetch failed:', err);

    // Try localStorage backup
    const backupKey = `backup_api_${activeBranch}_${isWholesale}`;
    const backupData = localStorage.getItem(backupKey);

    if (backupData) {
      console.log("Using localStorage backup due to network failure.");
      if (offlineBanner) offlineBanner.classList.remove('hidden');
      const data = JSON.parse(backupData);
      allData = data;
      if (data.updatedAt) {
        document.getElementById('lastUpdated').textContent = `Actualizado: ${data.updatedAt} (OFFLINE)`;
      } else {
        document.getElementById('lastUpdated').textContent = `Actualizado: (MODO OFFLINE)`;
      }
      renderList(allData);
      updateCartUI();

      const searchInput = document.getElementById('searchInput');
      const debouncedSearch = debounce((value) => {
        renderList(allData, value);
      }, 200);
      searchInput.oninput = (e) => {
        debouncedSearch(e.target.value);
      };
    } else {
      document.getElementById('productList').innerHTML = `
            <div class="error-container" style="padding: 20px; text-align: center;">
              <h2>⚠️ Error de Conexión</h2>
              <p>No se pudieron descargar los precios y no hay copias guardadas.</p>
              <button onclick="window.location.reload()" style="margin-top:10px; padding: 10px; border-radius:4px;">Reintentar</button>
            </div>
          `;
    }
  }
};

init();


// ====== SHOPPING CART LOGIC ======

window.addToCart = (btnElement, code, priceIndex, variantName) => {
  let foundItem = null;
  for (const cat of allData.categories) {
    for (const brand of cat.brands) {
      const item = brand.items.find(i => i.code === code);
      if (item) {
        foundItem = item;
        break;
      }
    }
    if (foundItem) break;
  }

  const priceKey = `price${priceIndex}`;
  if (!foundItem || foundItem[priceKey] === null) return;

  const cartKey = `${code}_${priceIndex}`;

  if (shoppingCart[cartKey]) {
    shoppingCart[cartKey].quantity += 1;
  } else {
    shoppingCart[cartKey] = {
      item: foundItem,
      quantity: 1,
      priceIndex,
      variantName,
      priceVal: foundItem[priceKey]
    };
  }

  updateCartUI();
  saveCart();

  // Micro-animation on button
  if (btnElement) {
    const originalText = btnElement.innerHTML;
    btnElement.classList.add('added-success');
    btnElement.innerHTML = '✔';
    setTimeout(() => {
      btnElement.classList.remove('added-success');
      btnElement.innerHTML = originalText;
    }, 800);
  }

  // Bounce cart FAB
  const fab = document.getElementById('cartBtn');
  if (fab) {
    fab.classList.remove('animate-bounce');
    void fab.offsetWidth;
    fab.classList.add('animate-bounce');
  }

  showToast(`Agregado: ${foundItem.description}`);
};

window.removeFromCart = (cartKey) => {
  if (shoppingCart[cartKey]) {
    delete shoppingCart[cartKey];
    updateCartUI();
    saveCart();
  }
};

window.updateCartQuantity = (cartKey, delta) => {
  if (shoppingCart[cartKey]) {
    shoppingCart[cartKey].quantity += delta;
    if (shoppingCart[cartKey].quantity <= 0) {
      delete shoppingCart[cartKey];
    }
    updateCartUI();
    saveCart();
  }
};

window.updateCartItemValue = (cartKey, type, value, unitPrice) => {
  if (!shoppingCart[cartKey]) return;

  const numValue = parseFloat(value);
  if (isNaN(numValue) || numValue <= 0) {
    delete shoppingCart[cartKey];
    updateCartUI();
    saveCart();
    return;
  }

  if (type === 'qty') {
    shoppingCart[cartKey].quantity = numValue;
  } else if (type === 'amount') {
    shoppingCart[cartKey].quantity = parseFloat((numValue / unitPrice).toFixed(3));
  }

  updateCartUI();
  saveCart();
};

const updateCartUI = () => {
  const badge = document.getElementById('cartBadge');
  const itemsList = document.getElementById('cartItemsList');
  const totalEl = document.getElementById('cartTotalValue');
  const sendBtn = document.getElementById('sendOrderBtn');

  let totalItems = 0;
  let totalPrice = 0;
  const itemsHtml = [];

  const cartValues = Object.values(shoppingCart);

  if (cartValues.length === 0) {
    itemsList.innerHTML = '<li class="empty-cart-msg">El carrito está vacío.</li>';
    badge.classList.add('hidden');
    totalEl.textContent = '$0';
    sendBtn.disabled = true;
    return;
  }

  cartValues.forEach((cartRec) => {
    const { item, quantity, priceIndex, variantName, priceVal } = cartRec;
    totalItems += quantity;
    const lineTotal = priceVal * quantity;
    totalPrice += lineTotal;
    const cartKey = `${item.code}_${priceIndex}`;

    const displayName = isWholesale ? variantName : (variantName || 'Unidad');
    const qtyStr = Number(quantity.toFixed(3)).toString();

    itemsHtml.push(`
      <li class="cart-item">
        <div class="cart-item-header">
          <span class="cart-item-title">${escapeHtml(item.description)} <br><small style="color:#757575;">(Cod: ${escapeHtml(item.code)} - ${escapeHtml(displayName)})</small></span>
        </div>
          <div class="cart-item-controls-advanced">
            <div class="input-group">
              <label>Cantidad</label>
              <input type="number" class="cart-input-qty" step="any" min="0" value="${qtyStr}"
                     onchange="window.updateCartItemValue('${cartKey}', 'qty', this.value, ${priceVal})"
                     onblur="window.updateCartItemValue('${cartKey}', 'qty', this.value, ${priceVal})">
            </div>

            <div class="qty-math-divider">× $${formatCurrency(priceVal)} =</div>

            <div class="input-group">
              <label>Monto ($)</label>
              <input type="number" class="cart-input-amount" step="any" min="0" value="${(priceVal * quantity).toFixed(2).replace(/\.00$/, '')}"
                     onchange="window.updateCartItemValue('${cartKey}', 'amount', this.value, ${priceVal})"
                     onblur="window.updateCartItemValue('${cartKey}', 'amount', this.value, ${priceVal})">
            </div>

            <button class="btn-remove-icon" onclick="window.removeFromCart('${cartKey}')" aria-label="Quitar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </li>
      `);
  });

  itemsList.innerHTML = itemsHtml.join('');

  badge.textContent = totalItems;
  badge.classList.remove('hidden');

  totalEl.textContent = `$${formatCurrency(totalPrice)}`;
  sendBtn.disabled = false;
};

window.printCart = () => {
  const cartValues = Object.values(shoppingCart);
  if (cartValues.length === 0) return;

  let total = 0;
  let itemsHtml = '';

  cartValues.forEach((cartRec) => {
    const { item, quantity, variantName, priceVal } = cartRec;
    const lineTotal = priceVal * quantity;
    total += lineTotal;
    const qtyStr = Number(quantity.toFixed(3)).toString();

    itemsHtml += `
      <tr>
        <td class="qty">${qtyStr}</td>
        <td class="desc">${escapeHtml(item.description).substring(0, 20)}</td>
        <td class="amt">$${formatCurrency(lineTotal)}</td>
      </tr>
    `;
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const branchAddress = BRANCH_ADDRESSES[activeBranch] || 'Tucumán';

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Ticket Presupuesto</title>
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 80mm;
            max-width: 80mm;
            margin: 0;
            padding: 5mm;
            font-size: 12px;
            color: #000;
            background: #fff;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .header h2 { margin: 0; font-size: 16px; font-weight: bold; }
          .header p { margin: 2px 0; font-size: 11px; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; border-bottom: 1px dashed #000; padding-bottom: 4px; font-weight: 600; font-size: 11px;}
          td { padding: 4px 0; vertical-align: top; font-size: 11px;}
          td.qty { width: 15%; }
          td.desc { width: 55%; overflow: hidden; }
          td.amt { width: 30%; text-align: right; }
          th.amt-th { text-align: right; }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 16px;
            margin-top: 10px;
          }
          .footer-msg { text-align: center; margin-top: 15px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>EL MANANTIAL</h2>
          <p>Semillería y Forrajería</p>
          <p>${branchAddress}</p>
          <p>${dateStr} - ${timeStr}</p>
        </div>

        <div class="divider"></div>
        <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">PRESUPUESTO</div>
        <div style="text-align: center; font-size: 9px; margin-bottom: 10px;">Doc. no válido como factura</div>

        <table>
          <thead>
            <tr>
              <th>CANT</th>
              <th>DESCRIPCIÓN</th>
              <th class="amt-th">MONTO</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>
        <div class="total-row">
          <span>TOTAL:</span>
          <span>$${formatCurrency(total)}</span>
        </div>

        <div class="footer-msg">
          ¡Gracias por su visita!
        </div>
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// UI Toggles & WhatsApp
const initCartUI = () => {
  const cartBtn = document.getElementById('cartBtn');
  const closeBtn = document.getElementById('closeCartBtn');
  const panel = document.getElementById('cartPanel');
  const sendBtn = document.getElementById('sendOrderBtn');
  const printBtn = document.getElementById('printCartBtn');

  if (!cartBtn || !closeBtn || !panel || !sendBtn) return;

  const toggleCart = () => {
    panel.classList.toggle('open');
    if (printBtn) {
      if (activeBranch === 'jujuy' && !isWholesale) {
        printBtn.classList.remove('hidden');
      } else {
        printBtn.classList.add('hidden');
      }
    }
  };

  cartBtn.addEventListener('click', toggleCart);
  closeBtn.addEventListener('click', toggleCart);

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.printCart();
    });
  }

  sendBtn.addEventListener('click', () => {
    const cartValues = Object.values(shoppingCart);
    if (cartValues.length === 0) return;

    let text = "Hola, quisiera encargar los siguientes productos:\n\n";
    let total = 0;

    cartValues.forEach((cartRec) => {
      const { item, quantity, variantName, priceVal } = cartRec;
      const lineTotal = priceVal * quantity;
      total += lineTotal;
      const displayName = isWholesale ? variantName : (variantName || 'Unidad');
      const qtyStr = Number(quantity.toFixed(3)).toString();

      text += `- ${qtyStr}x ${item.description} [${displayName}] ($${formatCurrency(priceVal)} c/u)\n`;
    });

    text += `\n*Total estimado: $${formatCurrency(total)}*`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;

    window.open(whatsappUrl, '_blank');
  });
};

// Mobile UI Logic
const initMobileUI = () => {
  const overlay = document.getElementById('mobileModalOverlay');
  const branchModal = document.getElementById('branchModal');
  const catModal = document.getElementById('categoryModal');
  const branchBtn = document.getElementById('mobileBranchBtn');
  const catBtn = document.getElementById('mobileCategoryBtn');
  const closeBtns = document.querySelectorAll('.close-modal');

  if (!overlay || !branchModal || !catModal || !branchBtn || !catBtn) return;

  const openModal = (modal) => {
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    overlay.classList.add('hidden');
    branchModal.classList.add('hidden');
    catModal.classList.add('hidden');
    document.body.style.overflow = '';
  };

  branchBtn.addEventListener('click', () => openModal(branchModal));
  catBtn.addEventListener('click', () => openModal(catModal));

  closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  branchModal.querySelectorAll('.modal-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const branchIdx = opt.dataset.branch;
      const url = new URL(window.location.href);
      url.searchParams.set('sucursal', branchIdx);
      window.location.href = url.toString();
    });
  });
};

initCartUI();
initMobileUI();

// Toast Helper
const showToast = (msg) => {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');

  if (window.toastTimeout) clearTimeout(window.toastTimeout);

  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2500);
};

// PWA Install Prompt Logic
let deferredPrompt;
const installAppBtn = document.getElementById('installAppBtn');

const isIos = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};
const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

if (installAppBtn) {
  if (isIos() && !isInStandaloneMode()) {
    installAppBtn.classList.remove('hidden');
  }

  installAppBtn.addEventListener('click', async () => {
    if (isIos() && !isInStandaloneMode()) {
      showToast("Para iOS: Toca 'Compartir' abajo y luego 'Agregar a Inicio'.");
      return;
    }

    if (!deferredPrompt) {
      showToast("La instalación no está soportada o ya está instalada.");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    deferredPrompt = null;
    installAppBtn.classList.add('hidden');
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installAppBtn) {
    installAppBtn.classList.remove('hidden');
  }
});

window.addEventListener('appinstalled', () => {
  console.log('INSTALL: Success');
  if (installAppBtn) {
    installAppBtn.classList.add('hidden');
  }
});

// ====== Dynamic Sticky Header Offset ======
const stickyContainer = document.querySelector('.sticky-header-container');
if (stickyContainer) {
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      document.documentElement.style.setProperty('--sticky-offset', `${entry.target.offsetHeight}px`);
    }
  });
  resizeObserver.observe(stickyContainer);
}
