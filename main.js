import './style.css'

let allData = null;
let shoppingCart = {}; // { code: { item, quantity } }

// NEW: Google Sheet URL configuration
// Wholesale (Mayorista) - The one provided previously
// GID: 1909734028
const SHEET_URL_WHOLESALE = 'https://docs.google.com/spreadsheets/d/17iVa59vBeEt3UF3mMdt1ztLXqDL5L2hNylnnJ8p4RQU/export?format=csv&gid=1909734028';

// Retail (Minorista) - San Martin 105
const SHEET_URL_RETAIL_SM = 'https://docs.google.com/spreadsheets/d/1zQiK3ETwjhF3NYYqQ413JpPgOUbzr0mn5_tOy2SO92A/export?format=csv&gid=156663288';

// Retail (Minorista) - Santo Cristo 85
const SHEET_URL_RETAIL_SC = 'https://docs.google.com/spreadsheets/d/18VI6WJ3Q-howf2IPxGYt7I70BnRM-_msNoQpCiheZik/export?format=csv&gid=4376430';

// Retail (Minorista) - Av. Jujuy 1672
const SHEET_URL_RETAIL_JUJUY = 'https://docs.google.com/spreadsheets/d/1NTApxbnNgv7ok9Z0upRhvD7u18WYKXfQLel29dVXqZ4/export?format=csv&gid=1147265019';

// Determine which list to load based on URL params
const urlParams = new URLSearchParams(window.location.search);
const isWholesale = urlParams.get('lista') === 'mayorista';

// Determine retail branch
const branchParam = urlParams.get('sucursal') || 'sm';
const isSantoCristo = branchParam === 'sc' || branchParam === 'santo-cristo';
const isJujuy = branchParam === 'jujuy' || branchParam === 'ju';

let SHEET_URL;
if (isWholesale) {
  SHEET_URL = SHEET_URL_WHOLESALE;
} else if (isSantoCristo) {
  SHEET_URL = SHEET_URL_RETAIL_SC;
} else if (isJujuy) {
  SHEET_URL = SHEET_URL_RETAIL_JUJUY;
} else {
  SHEET_URL = SHEET_URL_RETAIL_SM;
}

// Color mapping based on "Indice Secciones"
const CATEGORY_COLORS = {
  'ALIMENTO BALANCEADO ANIMAL': '#d32f2f', // Red
  'ALIMENTO PARA PERROS': '#f57c00', // Orange
  'ALIMENTO PARA GATOS': '#fbc02d', // Yellow/Gold
  'CEREALES PARA DESAYUNO': '#aed581', // Light Green
  'CEREALES': '#4caf50', // Green
  'FORRAJES': '#00bcd4', // Cyan/Teal
  'LEGUMBRES': '#1976d2', // Blue
  'CONDIMENTOS': '#ec407a', // Pink
  'FRUTOS SECOS': '#ab47bc', // Purple/Magenta
  'SNACKS': '#8d6e63', // Brown
  'VENENOS': '#1b5e20', // Dark Green
  'ACCESORIOS': '#7b1fa2',  // Deep Purple
  // Retail Colors
  'BALANCEADOS': '#d32f2f',
  'ALIMENTO PERRO Y GATO': '#f57c00', // Keep for matching, but will be replaced structurally
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
const KNOWN_CATEGORIES = [
  'ALIMENTO BALANCEADO ANIMAL', 'ALIMENTO PARA PERROS', 'ALIMENTO PARA GATOS',
  'CEREALES PARA DESAYUNO', 'CEREALES', 'FORRAJES', 'LEGUMBRES',
  'CONDIMENTOS', 'FRUTOS SECOS', 'SNACKS', 'VENENOS', 'ACCESORIOS',
  // Retail Categories
  'BALANCEADOS',
  'ALIMENTO PERRO Y GATO',
  'CEREALES PARA DESAYUNO',
  'CEREALES Y MEZCLAS',
  'CONDIMENTOS',
  'SNACKS',
  'COMESTIBLES',
  'LEGUMBRES',
  'ACCESORIOS Y VENENOS',
  'LIMPIEZA',
  'PILETA',
  'VARIOS',
  'ANIMALES DE GRANJA',
  'SECCIONES'
];

// CSV Parser Helper to handle quoted fields containing commas
// e.g. "BALANCED CACHORRO RAZA PEQ X 7,5KG"
const parseCSVLine = (line) => {
  const columns = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      columns.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  columns.push(current.trim());
  return columns.map(c => c.replace(/^"|"$/g, ''));
};

const parseCSV = (csvText) => {
  const lines = csvText.split(/\r?\n/);
  const result = {
    updatedAt: '',
    contact: '',
    categories: []
  };

  let currentCategory = null;
  let currentBrand = null;

  // Dynamic columns for Retail Mode
  // Default columns if none detected
  let currentRetailLabel1 = 'PRECIO';
  let currentRetailLabel2 = '';
  let currentRetailLabel3 = '';
  let currentRetailLabel4 = '';
  let currentRetailLabel5 = ''; // Added support for 5th price column

  const parsePrice = (str) => {
    if (!str) return null;
    const trimmed = str.trim();
    if (!trimmed.includes('$') && trimmed !== '-') return null;

    let clean = trimmed.replace('$', '').trim();
    if (clean === '-' || clean === '') return null;

    clean = clean.replace(/\./g, '');
    clean = clean.replace(',', '.');

    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  };

  // Helper arrays for split logic
  let proxyCatDog = null;
  let proxyCatCat = null;
  let isCurrentlySplitting = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      // Use the robust parser
      const columns = parseCSVLine(line);

      // Metadata (Date/Tel)
      if (i === 0 && columns[1]) {
        if (!result.updatedAt) result.updatedAt = columns[1];
      }
      if (columns[1] && columns[1].startsWith('tel:')) {
        result.contact = columns[1];
        continue;
      }

      let code, desc, price1, price2, price3, price4, price5;

      if (isWholesale) {
        // --- WHOLESALE LOGIC ---
        const col1 = columns[1];
        const col2 = columns[2];

        if (!col1 && !col2) continue;
        if (col1 === 'COD' || col1 === 'INDICE SECCIONES' || col1 === 'fecha') continue;

        // 1. Category Detection
        if (col1 && KNOWN_CATEGORIES.includes(col1)) {
          currentCategory = { name: col1, brands: [], columns: ['LISTA 1', 'LISTA 2', 'LISTA 3', 'LISTA 4'] };
          result.categories.push(currentCategory);
          currentBrand = null;
          continue;
        }

        // 2. Item Detection (col1 is numeric code)
        if (col1 && /^\d+$/.test(col1)) {
          let pIdx = 3;
          if (columns[3] && !columns[3].includes('$') && columns[3] !== '-' && columns[3] !== '') {
            pIdx = 4;
          }

          code = col1;
          desc = col2;
          price1 = parsePrice(columns[pIdx]);
          price2 = parsePrice(columns[pIdx + 1]);
          price3 = parsePrice(columns[pIdx + 2]);
          price4 = parsePrice(columns[pIdx + 3]);
        }
        // 3. Brand Detection
        else if ((!col1 && col2 && col2 !== 'DESCRIPCION') || (col1 && col1 !== 'DESCRIPCION' && !col1.includes('LISTA'))) {
          // Brand
          let brandName = col1 || col2;
          if (brandName) {
            if (currentCategory) {
              currentBrand = { name: brandName, items: [] };
              currentCategory.brands.push(currentBrand);
              continue;
            }
          }
        }

      } else {
        // --- RETAIL LOGIC ---
        const col0 = columns[0];
        const col1 = columns[1];

        // 1. Header Row Detection (Retail has headers UNDER category)
        // Look for 'COD' in col0. If found, capture columns 3,4,5,6,7 as headers
        if (col0 && /^\d*COD(IGO|S)?$/i.test(col0.trim())) {
          // Retail CSV: 0=COD, 1=DESCRIPCION, 2=Pres?, 3=Header1, 4=Header2, 5=Header3, 6=Header4, 7=Header5
          if (columns[3]) currentRetailLabel1 = columns[3];
          if (columns[4]) currentRetailLabel2 = columns[4];
          if (columns[5]) currentRetailLabel3 = columns[5]; else currentRetailLabel3 = '';
          if (columns[6]) currentRetailLabel4 = columns[6]; else currentRetailLabel4 = '';
          if (columns[7]) currentRetailLabel5 = columns[7]; else currentRetailLabel5 = '';

          // Update the current category's columns if we have one
          const newCols = [
            currentRetailLabel1,
            currentRetailLabel2,
            currentRetailLabel3,
            currentRetailLabel4,
            currentRetailLabel5
          ].filter(c => c && c.trim() !== '');

          if (currentCategory) {
            currentCategory.columns = newCols;
          }
          if (isCurrentlySplitting && proxyCatCat) {
            proxyCatCat.columns = newCols;
          }
          continue;
        }

        if (col0 && col0.includes('LISTA')) continue;
        if (!col0 && !col1) continue;

        // Category?
        if (col0 && KNOWN_CATEGORIES.includes(col0)) {
          // Found a new Category
          isCurrentlySplitting = false;

          const activeCols = [
            currentRetailLabel1,
            currentRetailLabel2,
            currentRetailLabel3,
            currentRetailLabel4,
            currentRetailLabel5
          ].filter(c => c && c.trim() !== '');

          // Special logic for ALIMENTO PERRO Y GATO
          if (col0 === 'ALIMENTO PERRO Y GATO') {
            isCurrentlySplitting = true;

            // Create Dog Category
            proxyCatDog = { name: 'ALIMENTO PARA PERROS', brands: [], columns: activeCols };
            result.categories.push(proxyCatDog);

            // Create Cat Category
            proxyCatCat = { name: 'ALIMENTO PARA GATOS', brands: [], columns: activeCols };
            result.categories.push(proxyCatCat);

            currentCategory = proxyCatDog; // Set a default context
            currentBrand = null;
            continue;
          }

          currentCategory = { name: col0, brands: [], columns: activeCols };
          result.categories.push(currentCategory);
          currentBrand = { name: col0, items: [] };
          currentCategory.brands.push(currentBrand);
          continue;
        }

        // Item Detection
        if (col0 && /^\d+$/.test(col0)) {
          code = col0;
          desc = col1;
          // In some retail CSV sections (like Accesorios), price is in col 2 instead of 3.
          // We need a fallback check if price1 is null
          price1 = parsePrice(columns[3]) || parsePrice(columns[2]);
          price2 = parsePrice(columns[4]);
          price3 = parsePrice(columns[5]);
          price4 = parsePrice(columns[6]);
          price5 = parsePrice(columns[7]);
        }
        else if (!col0 && col1 && !col1.startsWith('tel')) {
          // Potential sub-header or brand like "MEZCLAS"
          let brandName = col1;
          // In retail, a row with empty col0 and a col1 description is a brand/sub-category. 
          // We must ensure it's not a pricing row by checking it doesn't have a '$' symbol in its prices
          const hasPriceSymbol = Object.values(columns).some(c => typeof c === 'string' && c.includes('$'));

          if (brandName && !hasPriceSymbol) {
            if (isCurrentlySplitting) {
              const upperBrand = brandName.toUpperCase().trim();
              if (upperBrand === 'PERRO:') {
                currentCategory = proxyCatDog;
                currentBrand = { name: 'ALIMENTO PARA PERROS', items: [] };
                proxyCatDog.brands.push(currentBrand);
              } else if (upperBrand === 'GATO:') {
                currentCategory = proxyCatCat;
                currentBrand = { name: 'ALIMENTO PARA GATOS', items: [] };
                proxyCatCat.brands.push(currentBrand);
              } else {
                // In case there are other sub-brands inside the split category, add to the active one
                currentBrand = { name: brandName, items: [] };
                currentCategory.brands.push(currentBrand);
              }
              continue;
            } else if (currentCategory) {
              currentBrand = { name: brandName, items: [] };
              currentCategory.brands.push(currentBrand);
            }
            continue;
          }
        }
      }

      // Add Primary Item if found
      if (code && desc && currentCategory) {
        const item = { code, description: desc, price1, price2, price3, price4, price5 };

        if (!currentBrand) {
          currentBrand = { name: currentCategory.name, items: [] };
          currentCategory.brands.push(currentBrand);
        }
        currentBrand.items.push(item);
      }

      // Add Secondary Item (For 2-column layouts like "ACCESORIOS Y VENENOS" in Jujuy)
      // Columns: 0=COD, 1=DESC, 2=UNIT, 3=PRICE (skip 4) 5=COD2, 6=DESC2, 7=UNIT/PRICE...
      if (!isWholesale && columns[5] && /^\d+$/.test(columns[5]) && columns[6] && currentCategory) {
        const code2 = columns[5];
        const desc2 = columns[6];
        // Usually in this layout, price is in column 8, let's grab it (or 7 if shifted)
        const p1_2 = parsePrice(columns[7]) || parsePrice(columns[8]);

        if (code2 && desc2) {
          const item2 = { code: code2, description: desc2, price1: p1_2, price2: null, price3: null, price4: null, price5: null };
          if (!currentBrand) {
            currentBrand = { name: currentCategory.name, items: [] };
            currentCategory.brands.push(currentBrand);
          }
          currentBrand.items.push(item2);
        }
      }
    } catch (err) {
      console.warn(`Error procesando fila ${i + 1}: ${line}`, err);
    }
  }

  // Filter empty categories/brands
  result.categories = result.categories.filter(c => c.brands.length > 0);
  return result;
};


// Formatter for currency
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// Generate Index Horizontal (Buttons)
const renderIndex = (categories) => {
  const navContainer = document.getElementById('categoryNav');
  navContainer.innerHTML = '';

  const activeCategories = categories.filter(c => c.brands.some(b => b.items.length > 0));

  let indexHtml = `<div class="horizontal-index">`;

  activeCategories.forEach((cat) => {
    const color = CATEGORY_COLORS[cat.name] || DEFAULT_COLOR;
    const catId = 'cat-' + cat.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    // Check if color is light to use dark text
    let textColor = 'white';
    if (['#fbc02d', '#aed581', '#4caf50', '#00bcd4'].includes(color)) {
      textColor = '#212121';
    }

    indexHtml += `
      <button class="index-btn" 
        style="--cat-color: ${color}; --text-color: ${textColor};"
        onclick="window.scrollToCategory('${catId}')">
        ${cat.name}
      </button>
    `;
  });

  indexHtml += `</div>`;
  navContainer.innerHTML = indexHtml;

  // Global scroll function to handle infinite scroll lazy-rendering
  window.scrollToCategory = (catId) => {
    let el = document.getElementById(catId);
    // If the element isn't in the DOM yet, force render batches until it is
    while (!el && currentRenderIndex < currentRenderItems.length) {
      renderBatch();
      el = document.getElementById(catId);
    }

    if (el) {
      const yOffset = -70; // Header offset
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }

    // Close mobile modal if open
    const overlay = document.getElementById('mobileModalOverlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      overlay.click();
    }
  };

  // NEW: Populate mobile category list
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
      btn.innerHTML = `${getCategoryIcon(cat.name)} <span>${cat.name}</span>`;
      btn.onclick = () => window.scrollToCategory(catId);
      mobileCatList.appendChild(btn);
    });
  }
};

// Render function
// Paginator Globals
let currentRenderItems = []; // Array of brand objects
let currentRenderIndex = 0;
const BATCH_SIZE = 10; // Number of brands to render at once
let currentFilterText = '';

const renderBatch = () => {
  const container = document.getElementById('productList');
  let html = '';

  const end = Math.min(currentRenderIndex + BATCH_SIZE, currentRenderItems.length);

  for (let i = currentRenderIndex; i < end; i++) {
    const { brand, category, headers, color, headerTextColor, colSpan, isNewCategory } = currentRenderItems[i];

    // True if this is the first item IN THIS BATCH, but NOT a new category (meaning it continues from previous batch)
    const isContinuingCategory = (i === currentRenderIndex) && !isNewCategory;

    // Start Category Section if it's the first brand of that category OR continuing from last batch
    if (isNewCategory || isContinuingCategory) {
      if (i > currentRenderIndex) {
        // Close previous category table and section within this batch
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
            ${getCategoryIcon(category.name)} ${category.name}
          </div>` : ''}
          <div class="table-responsive">
            <table class="pricing-table">
              <thead>
                ${isNewCategory ? `<tr>
                  <th colspan="2" class="th-main" style="border-right: none;"></th>
                  <th colspan="${colSpan}" class="th-main" style="border-left: none;">PRECIO</th>
                </tr>` : ''}
                <tr>
                  <th class="col-code">COD</th>
                  <th class="col-desc">DESCRIPCION</th>
                  ${headers.map(h => `<th class="col-price">${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
      `;
    }

    // Brand Header
    if (brand.name !== category.name && brand.name !== 'General' && brand.name !== 'PERRO:' && brand.name !== 'GATO:') {
      html += `
          <tr class="brand-row">
            <td colspan="${colSpan + 2}">${brand.name}</td>
          </tr>
        `;
    }

    // Items
    brand.items.forEach(item => {
      html += `
        <tr>
          <td class="col-code"><span class="item-code">${item.code}</span></td>
          <td class="col-desc"><span class="item-desc">${item.description}</span></td>
          ${headers.map((h, idx) => {
        const priceVal = item[`price${idx + 1}`];
        const hasPrice = priceVal !== null && priceVal !== undefined;
        return `
            <td class="col-price price-cell">
              <div class="price-container">
                <span>${hasPrice ? '$ ' + formatCurrency(priceVal) : ''}</span>
                ${hasPrice && !isWholesale ? `<button class="btn-add-cart" onclick="window.addToCart(this, '${item.code}', ${idx + 1}, '${h || 'Lista ' + (idx + 1)}')" aria-label="Agregar">+</button>` : ''}
              </div>
            </td>`;
      }).join('')}
        </tr>
      `;
    });
  }

  // Close the last table/section inside this batch
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
      // Small timeout to not block main thread immediately
      setTimeout(renderBatch, 10);
    }
  }, { rootMargin: '200px' });

  scrollObserver.observe(sentinel);
};


// Helper for fuzzy search (removes accents and lowercases)
const normalizeText = (text) => {
  if (!text) return '';
  return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Advanced match: ignores accents, case, and allows words in any order
const fuzzyMatch = (filterText, targetText) => {
  const p = normalizeText(filterText);
  const t = normalizeText(targetText);
  if (t.includes(p)) return true;

  // Word-by-word match (e.g. "gato adulto" matches "Adulto Gato")
  const words = p.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 0 && words.every(w => t.includes(w))) return true;

  return false;
};

const renderList = (data, filterText = '') => {
  const container = document.getElementById('productList');

  if (!data) return;

  // Reset State
  currentFilterText = filterText;
  currentRenderItems = [];
  currentRenderIndex = 0;
  container.innerHTML = ''; // Clear existing

  let hasResults = false;

  data.categories.forEach(category => {
    // Filter items within brands
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
          isNewCategory: idx === 0 // true only for the first brand in a category
        });
      });
    }
  });

  if (!hasResults) {
    container.innerHTML = '<div class="no-results">No se encontraron productos que coincidan con la búsqueda.</div>';
  } else {
    // Render first batch
    renderBatch();
    setupObserver();
  }

  if (filterText === '') {
    renderIndex(data.categories);
    document.getElementById('categoryNav').style.display = 'block';

    // NEW: Add "Consult Wholesale" button if in Retail mode
    const promoContainer = document.getElementById('promoContainer');
    const wholesaleBannerContainer = document.getElementById('wholesaleBannerContainer');

    if (promoContainer) promoContainer.innerHTML = ''; // Clear previous
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
      // Warning/Badge for Wholesale Mode
      const badge = document.createElement('div');
      badge.className = 'wholesale-alert';
      badge.innerHTML = `
          <div class="wholesale-alert-title">🔒 LISTA MAYORISTA</div>
          <div class="wholesale-alert-text">Solo para comercios. Compra mínima: $200.000</div>
          <div style="display: flex; gap: 8px; width: 100%; max-width: 400px; margin-top: 4px;">
            <a href="https://wa.me/5493813315389?text=Hola,%20quisiera%20hacer%20un%20pedido%20mayorista." target="_blank" class="btn-wholesale" style="flex: 1; justify-content: center; border: 1px solid rgba(0,0,0,0.2);">
                Hace tu pedido
            </a>
            <a href="/" class="btn-wholesale" style="flex: 1; justify-content: center; background: #ea4335; border: 1px solid rgba(0,0,0,0.2);">
                ⬅️ Volver
            </a>
          </div>
      `;
      if (wholesaleBannerContainer) wholesaleBannerContainer.appendChild(badge);
    }

    // After everything is rendered, update CSS variable for dynamic sticky headers 
    // depending on the final height of the sticky-header-container
    setTimeout(() => {
      const stickyContainer = document.querySelector('.sticky-header-container');
      if (stickyContainer) {
        document.documentElement.style.setProperty('--sticky-offset', `${stickyContainer.offsetHeight}px`);
      }
    }, 100);

  } else {
    document.getElementById('categoryNav').style.display = 'none';
    const wholesaleBannerContainer = document.getElementById('wholesaleBannerContainer');
    if (wholesaleBannerContainer) wholesaleBannerContainer.style.display = 'none';
  }
};

// ====== Theme Toggle (Dark Mode) ======
const themeToggleBtn = document.getElementById('themeToggleBtn');
if (themeToggleBtn) {
  // Check localStorage (ignore system preference for default light mode)
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

// ====== Service Worker Registration for PWA / Offline Use ======
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => console.log('SW registration failed:', err));
  });
}

// Handle Offline/Online UI Reactivity
const offlineBanner = document.getElementById('offlineBanner');
window.addEventListener('offline', () => {
  if (offlineBanner) offlineBanner.classList.remove('hidden');
});
window.addEventListener('online', () => {
  if (offlineBanner) offlineBanner.classList.add('hidden');
});

// Check initial state
if (!navigator.onLine && offlineBanner) {
  offlineBanner.classList.remove('hidden');
}

// Initialize
const init = async () => {
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

  // Check if we have a URL for the current mode
  if (!SHEET_URL) {
    document.getElementById('productList').innerHTML = `
            <div class="error-container" style="padding: 20px; text-align: center;">
                <h2>⚠️ Error de Configuración</h2>
                <p>No se pudo cargar la lista seleccionada.</p>
            </div>`;
    return;
  }

  // Show loading?
  document.getElementById('productList').innerHTML = '<div class="loading">Cargando lista actualizada...</div>';

  fetch(SHEET_URL)
    .then(res => res.text()) // Get text, not JSON
    .then(csvText => {
      // Parse the CSV
      // Check if fetch was actually a 404/JSON response or HTML login page
      if (csvText.startsWith('<!DOCTYPE html>') || csvText.startsWith('{')) {
        console.error("Received HTML/JSON instead of CSV. Check URL permissions.");
        throw new Error("Invalid CSV format");
      }

      const data = parseCSV(csvText);
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

      // Save backup in localStorage in case Service Worker fails or clears
      try {
        localStorage.setItem(`backup_${SHEET_URL}`, csvText);
      } catch (e) { }

      const searchInput = document.getElementById('searchInput');
      // Use oninput instead of addEventListener to prevent duplication if init is called again
      searchInput.oninput = (e) => {
        renderList(allData, e.target.value);
      };
    })
    .catch(err => {
      console.error('Fetch failed:', err);
      // Try local storage back up if ServiceWorker failed to return a match
      const backupCsv = localStorage.getItem(`backup_${SHEET_URL}`);
      if (backupCsv) {
        console.log("Using localStorage backup due to network failure.");
        if (offlineBanner) offlineBanner.classList.remove('hidden');
        const data = parseCSV(backupCsv);
        allData = data;
        if (data.updatedAt) {
          document.getElementById('lastUpdated').textContent = `Actualizado: ${data.updatedAt} (OFFLINE)`;
        } else {
          document.getElementById('lastUpdated').textContent = `Actualizado: (MODO OFFLINE)`;
        }
        renderList(allData);
        const searchInput = document.getElementById('searchInput');
        searchInput.oninput = (e) => {
          renderList(allData, e.target.value);
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
    });
};

init();


// ====== SHOPPING CART LOGIC ======


// Helpers for Category Icons
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

  // Default general icon (leaf)
  return `<svg class="category-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 7,11.5 7,11.5C7,11.5 10.9,10 17,8Z"/></svg>`;
};

window.addToCart = (btnElement, code, priceIndex, variantName) => {

  // Find item
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

  // We use a composite key for the cart item: code + priceIndex
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

  // Bounce CART FAB
  const fab = document.getElementById('cartBtn');
  if (fab) {
    fab.classList.remove('animate-bounce');
    // Trigger reflow to restart animation
    void fab.offsetWidth;
    fab.classList.add('animate-bounce');
  }

  showToast(`Agregado: ${foundItem.description}`);
};

window.removeFromCart = (cartKey) => {
  if (shoppingCart[cartKey]) {
    delete shoppingCart[cartKey];
    updateCartUI();
  }
};

window.updateCartQuantity = (cartKey, delta) => {
  if (shoppingCart[cartKey]) {
    shoppingCart[cartKey].quantity += delta;
    if (shoppingCart[cartKey].quantity <= 0) {
      delete shoppingCart[cartKey];
    }
    updateCartUI();
  }
};

const updateCartUI = () => {
  const badge = document.getElementById('cartBadge');
  const itemsList = document.getElementById('cartItemsList');
  const totalEl = document.getElementById('cartTotalValue');
  const sendBtn = document.getElementById('sendOrderBtn');

  // Calculate totals
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

    itemsHtml.push(`
      <li class="cart-item">
        <div class="cart-item-header">
          <span class="cart-item-title">${item.description} <br><small style="color:#757575;">(Cod: ${item.code} - ${displayName})</small></span>
        </div>
        <div class="cart-item-controls">
          <span class="cart-item-price">$${formatCurrency(priceVal)}</span>
          <div class="qty-controls">
            <button class="btn-qty" onclick="window.updateCartQuantity('${cartKey}', -1)">-</button>
            <span class="qty-display">${quantity}</span>
            <button class="btn-qty" onclick="window.updateCartQuantity('${cartKey}', 1)">+</button>
          </div>
          <button class="btn-remove" onclick="window.removeFromCart('${cartKey}')">Quitar</button>
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

// UI Toggles & WhatsApp
const initCartUI = () => {
  const cartBtn = document.getElementById('cartBtn');
  const closeBtn = document.getElementById('closeCartBtn');
  const panel = document.getElementById('cartPanel');
  const sendBtn = document.getElementById('sendOrderBtn');

  if (!cartBtn || !closeBtn || !panel || !sendBtn) return;

  const toggleCart = () => panel.classList.toggle('open');

  cartBtn.addEventListener('click', toggleCart);
  closeBtn.addEventListener('click', toggleCart);

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
      text += `- ${quantity}x ${item.description} [${displayName}] ($${formatCurrency(priceVal)} c/u)\n`;
    });

    text += `\n*Total estimado: $${formatCurrency(total)}*`;

    // Encode for URL
    const encodedText = encodeURIComponent(text);
    // User can customize phone number
    const whatsappUrl = `https://wa.me/5493813315389?text=${encodedText}`;

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

  // Handle branch selection in modal
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
if (isWholesale) {
  const floatingCartBtn = document.getElementById('cartBtn');
  if (floatingCartBtn) floatingCartBtn.style.display = 'none';
}

initMobileUI();

// Toast Helper
const showToast = (msg) => {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');

  // Clear any existing timeout
  if (window.toastTimeout) clearTimeout(window.toastTimeout);

  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300); // Wait for transition
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
  // Show button for iOS if not installed yet
  if (isIos() && !isInStandaloneMode()) {
    installAppBtn.classList.remove('hidden');
  }

  installAppBtn.addEventListener('click', async () => {
    // iOS Handling
    if (isIos() && !isInStandaloneMode()) {
      showToast("Para iOS: Toca 'Compartir' abajo y luego 'Agregar a Inicio'.");
      return;
    }

    if (!deferredPrompt) {
      showToast("La instalación no está soportada o ya está instalada.");
      return;
    }

    // Show the install prompt
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

window.addEventListener('appinstalled', (evt) => {
  // Log install to analytics
  console.log('INSTALL: Success');
  if (installAppBtn) {
    installAppBtn.classList.add('hidden');
  }
});
