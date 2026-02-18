import './style.css'

let allData = null;

// NEW: Google Sheet URL configuration
// Wholesale (Mayorista) - The one provided previously
// GID: 1909734028
const SHEET_URL_WHOLESALE = 'https://docs.google.com/spreadsheets/d/17iVa59vBeEt3UF3mMdt1ztLXqDL5L2hNylnnJ8p4RQU/export?format=csv&gid=1909734028';

// Retail (Minorista) - Provided by user
// GID: 156663288
const SHEET_URL_RETAIL = 'https://docs.google.com/spreadsheets/d/1zQiK3ETwjhF3NYYqQ413JpPgOUbzr0mn5_tOy2SO92A/export?format=csv&gid=156663288';

// Determine which list to load based on URL param ?lista=mayorista
const urlParams = new URLSearchParams(window.location.search);
const isWholesale = urlParams.get('lista') === 'mayorista';

const SHEET_URL = isWholesale ? SHEET_URL_WHOLESALE : SHEET_URL_RETAIL;

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

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
      if (col0 && (col0 === 'COD' || col0 === 'CODIGO' || col0 === 'ARTICULO')) {
        // Retail CSV: 0=COD, 1=DESCRIPCION, 2=Pres?, 3=Header1, 4=Header2, 5=Header3, 6=Header4, 7=Header5
        if (columns[3]) currentRetailLabel1 = columns[3];
        if (columns[4]) currentRetailLabel2 = columns[4];
        if (columns[5]) currentRetailLabel3 = columns[5]; else currentRetailLabel3 = '';
        if (columns[6]) currentRetailLabel4 = columns[6]; else currentRetailLabel4 = '';
        if (columns[7]) currentRetailLabel5 = columns[7]; else currentRetailLabel5 = '';

        // Update the current category's columns if we have one
        if (currentCategory) {
          currentCategory.columns = [
            currentRetailLabel1,
            currentRetailLabel2,
            currentRetailLabel3,
            currentRetailLabel4,
            currentRetailLabel5
          ].filter(c => c && c.trim() !== '');
        }
        continue;
      }

      if (col0 && col0.includes('LISTA')) continue;
      if (!col0 && !col1) continue;

      // Category?
      if (col0 && KNOWN_CATEGORIES.includes(col0)) {
        // Found a new Category
        currentRetailLabel1 = '';
        currentRetailLabel2 = '';
        currentRetailLabel3 = '';
        currentRetailLabel4 = '';
        currentRetailLabel5 = '';

        currentCategory = { name: col0, brands: [], columns: [] };
        result.categories.push(currentCategory);
        currentBrand = { name: col0, items: [] };
        currentCategory.brands.push(currentBrand);
        continue;
      }

      // Item Detection
      if (col0 && /^\d+$/.test(col0)) {
        code = col0;
        desc = col1;
        // Retail Prices: Cols 3, 4, 5, 6, 7
        price1 = parsePrice(columns[3]);
        price2 = parsePrice(columns[4]);
        price3 = parsePrice(columns[5]);
        price4 = parsePrice(columns[6]);
        price5 = parsePrice(columns[7]);
      }
      else if (!col0 && col1 && !col1.startsWith('tel')) {
        // Potential sub-header or brand like "MEZCLAS"
        let brandName = col1;
        // If it's not a price row (no $) and looks like a brand
        // Make sure we are inside a category
        if (brandName && columns[3] && !columns[3].includes('$')) {
          if (currentCategory) {
            currentBrand = { name: brandName, items: [] };
            currentCategory.brands.push(currentBrand);
          }
          continue;
        }
      }
    }

    // Add Item if found
    if (code && desc && currentCategory) {
      const item = { code, description: desc, price1, price2, price3, price4, price5 };

      if (!currentBrand) {
        currentBrand = { name: currentCategory.name, items: [] };
        currentCategory.brands.push(currentBrand);
      }
      currentBrand.items.push(item);
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
        style="background-color: ${color}; color: ${textColor}; border-color: ${color};"
        onclick="document.getElementById('${catId}').scrollIntoView({behavior: 'smooth'})">
        ${cat.name}
      </button>
    `;
  });

  indexHtml += `</div>`;
  navContainer.innerHTML = indexHtml;
};

// Render function
const renderList = (data, filterText = '') => {
  const container = document.getElementById('productList');
  const normalizedFilter = filterText.toLowerCase();

  if (!data) return;

  let html = '';
  let hasResults = false;

  data.categories.forEach(category => {
    // Filter items within brands
    const filteredBrands = category.brands.map(brand => {
      const filteredItems = brand.items.filter(item => {
        const matchCode = item.code.toString().includes(normalizedFilter);
        const matchDesc = item.description.toLowerCase().includes(normalizedFilter);
        const matchBrand = brand.name.toLowerCase().includes(normalizedFilter);
        const matchCategory = category.name.toLowerCase().includes(normalizedFilter);

        return matchCode || matchDesc || matchBrand || matchCategory;
      });

      return { ...brand, items: filteredItems };
    }).filter(brand => brand.items.length > 0);

    if (filteredBrands.length > 0) {
      hasResults = true;
      const catId = 'cat-' + category.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const color = CATEGORY_COLORS[category.name] || DEFAULT_COLOR;

      let headerTextColor = 'white';
      if (['#fbc02d', '#aed581', '#4caf50', '#00bcd4'].includes(color)) {
        headerTextColor = '#212121';
      }

      // Determine Headers for this Category
      // Defaults/Fallbacks
      let headers = category.columns || ['PRECIO', '', '', ''];
      // Ensure we have at least 4 for the table structure, maybe 5 if needed
      while (headers.length < 4) headers.push('');

      // Check max columns needed?
      const hasFiveCols = headers.length >= 5 || category.brands.some(b => b.items.some(i => i.price5 !== null));
      const colSpan = hasFiveCols ? 5 : 4;

      // Start Section
      html += `
        <section id="${catId}" class="category-section" style="border-top-color: ${color};">
          <div class="category-header" style="background-color: ${color}; border-bottom-color: ${color}; color: ${headerTextColor};">
            ${category.name}
          </div>
          <div class="table-responsive">
            <table class="pricing-table">
              <thead>
                <tr>
                  <th colspan="2" style="border-color: ${color};"></th>
                  <th colspan="${colSpan}" style="background-color: ${color}; border-color: ${color}; color: ${headerTextColor};">PRECIO</th>
                </tr>
                <tr>
                  <th class="col-code" style="color: #212121;">COD</th>
                  <th class="col-desc" style="color: #212121;">DESCRIPCION</th>
                  <th class="col-price" style="color: #212121;">${headers[0] || ''}</th>
                  <th class="col-price" style="color: #212121;">${headers[1] || ''}</th>
                  <th class="col-price" style="color: #212121;">${headers[2] || ''}</th>
                  <th class="col-price" style="color: #212121;">${headers[3] || ''}</th>
                  ${hasFiveCols ? `<th class="col-price" style="color: #212121;">${headers[4] || ''}</th>` : ''}
                </tr>
              </thead>
              <tbody>
      `;

      // Loop Brands
      filteredBrands.forEach(brand => {
        // Only show brand header if it's different from category or if there are multiple brands
        if (brand.name !== category.name && brand.name !== 'General') {
          html += `
              <tr class="brand-row">
                <td colspan="${colSpan + 2}" style="background-color: ${color}; opacity: 0.9; color: ${headerTextColor};">${brand.name}</td>
              </tr>
            `;
        }

        brand.items.forEach(item => {
          html += `
            <tr>
              <td class="col-code"><span class="item-code" style="color: ${color}; background: #fff;">${item.code}</span></td>
              <td class="col-desc"><span class="item-desc">${item.description}</span></td>
              <td class="col-price price-cell">${item.price1 !== null ? '$ ' + formatCurrency(item.price1) : ''}</td>
              <td class="col-price price-cell">${item.price2 !== null ? '$ ' + formatCurrency(item.price2) : ''}</td>
              <td class="col-price price-cell">${item.price3 !== null ? '$ ' + formatCurrency(item.price3) : ''}</td>
              <td class="col-price price-cell">${item.price4 !== null ? '$ ' + formatCurrency(item.price4) : ''}</td>
              ${hasFiveCols ? `<td class="col-price price-cell">${item.price5 !== null ? '$ ' + formatCurrency(item.price5) : ''}</td>` : ''}
            </tr>
          `;
        });
      });

      html += `
              </tbody>
            </table>
          </div>
        </section>
      `;
    }
  });

  if (!hasResults) {
    container.innerHTML = '<div class="no-results">No se encontraron productos que coincidan con la búsqueda.</div>';
  } else {
    container.innerHTML = html;
  }

  if (filterText === '') {
    renderIndex(data.categories);
    document.getElementById('categoryNav').style.display = 'block';

    // NEW: Add "Consult Wholesale" button if in Retail mode
    const navContainer = document.getElementById('categoryNav');
    if (!isWholesale) {
      const wholesaleBtn = document.createElement('div');
      wholesaleBtn.className = 'wholesale-promo';
      // WhatsApp number placeholder - User needs to update
      wholesaleBtn.innerHTML = `
            <a href="https://wa.me/5491122334455?text=Hola,%20quisiera%20consultar%20por%20la%20lista%20de%20precios%20mayorista." 
               target="_blank" 
               class="btn-wholesale">
               🏢 ¿Sos Mayorista? Consultar Aquí
            </a>
        `;
      navContainer.insertBefore(wholesaleBtn, navContainer.firstChild);
    } else {
      // Warning/Badge for Wholesale Mode
      const badge = document.createElement('div');
      badge.className = 'wholesale-badge';
      badge.innerHTML = '🔒 LISTA MAYORISTA ACTIVA';
      navContainer.insertBefore(badge, navContainer.firstChild);
    }

  } else {
    document.getElementById('categoryNav').style.display = 'none';
  }
};

// Initialize
const init = async () => {
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

      if (data.updatedAt) document.getElementById('lastUpdated').textContent = `Actualizado: ${data.updatedAt}`;
      if (data.contact) document.getElementById('contactInfo').textContent = data.contact.replace('tel:', 'Tel:').replace('mail:', '| Mail:');

      renderList(allData);

      const searchInput = document.getElementById('searchInput');
      searchInput.addEventListener('input', (e) => {
        renderList(allData, e.target.value);
      });
    })
    .catch(err => {
      console.error(err);
      document.getElementById('productList').innerHTML = '<div class="error">Error cargando los datos. Verifica la conexión a internet.</div>';
    });
};

init();
