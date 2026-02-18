import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, 'raw_data.csv');
const outputPath = path.join(__dirname, 'public', 'data.json');

const rawData = fs.readFileSync(csvPath, 'utf8');
const lines = rawData.split(/\r?\n/);

const result = {
    updatedAt: '',
    contact: '',
    categories: []
};

let currentCategory = null;
let currentBrand = null;
let sectionMarkers = [];

const KNOWN_CATEGORIES = [
    'ALIMENTO BALANCEADO ANIMAL', 'ALIMENTO PARA PERROS', 'ALIMENTO PARA GATOS',
    'CEREALES PARA DESAYUNO', 'CEREALES', 'FORRAJES', 'LEGUMBRES',
    'CONDIMENTOS', 'FRUTOS SECOS', 'SNACKS', 'VENENOS', 'ACCESORIOS'
];

const parsePrice = (str) => {
    if (!str) return null;
    const trimmed = str.trim();
    // Expect currency symbol or placeholder for price
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
    // Simple CSV split handling empty fields
    const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

    if (i === 0 && columns[1]) {
        result.updatedAt = columns[1];
        continue;
    }

    if (columns[1] && columns[1].startsWith('tel:')) {
        result.contact = columns[1];
        continue;
    }

    const col1 = columns[1];
    const col2 = columns[2];

    if (!col1 && !col2) continue;
    if (col1 === 'COD' || col1 === 'INDICE SECCIONES' || col1 === 'fecha') continue;

    // 1. Category Detection
    if (col1 && KNOWN_CATEGORIES.includes(col1)) {
        currentCategory = { name: col1, brands: [] };
        result.categories.push(currentCategory);
        currentBrand = null;
        continue;
    }

    // 2. Item Detection (col1 is numeric code)
    // Use regex to be strict generally, but loose enough for codes
    if (col1 && /^\d+$/.test(col1)) {
        // Determine price columns offset
        // Default: 3, 4, 5, 6
        // If col3 is not a price (no $ and not empty/-), shift to 4
        let pIdx = 3;
        if (columns[3] && !columns[3].includes('$') && columns[3] !== '-' && columns[3] !== '') {
            pIdx = 4;
        }

        const item = {
            code: col1,
            description: col2,
            price1: parsePrice(columns[pIdx]),
            price2: parsePrice(columns[pIdx + 1]),
            price3: parsePrice(columns[pIdx + 2]),
            price4: parsePrice(columns[pIdx + 3])
        };

        // Add to current brand or default brand
        if (!currentCategory) continue; // Should not happen if file structure holds

        if (!currentBrand) {
            currentBrand = { name: 'General', items: [] };
            currentCategory.brands.push(currentBrand);
        }
        currentBrand.items.push(item);
        continue;
    }

    // 3. Brand Detection
    // If we are here, it's not a category line (known) and not an item (numeric).
    // It's likely a Brand or Subheader.
    // Case A: col1 is empty, col2 has text -> Brand
    // Case B: col1 has text (and verified not numeric/category) -> Brand

    let brandName = null;
    if (!col1 && col2 && col2 !== 'DESCRIPCION') {
        brandName = col2;
    } else if (col1 && col1 !== 'DESCRIPCION' && !col1.includes('LISTA')) {
        brandName = col1;
    }

    if (brandName) {
        if (currentCategory) {
            currentBrand = { name: brandName, items: [] };
            currentCategory.brands.push(currentBrand);
        }
    }
}

// Filter out empty categories/brands
result.categories = result.categories.filter(c => c.brands.length > 0);

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log('Data parsing complete. Categories found:', result.categories.length);
