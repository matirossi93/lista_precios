import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Google Sheet URLs
const SHEET_URLS = {
    mayorista: 'https://docs.google.com/spreadsheets/d/17iVa59vBeEt3UF3mMdt1ztLXqDL5L2hNylnnJ8p4RQU/export?format=csv&gid=1909734028',
    sm: 'https://docs.google.com/spreadsheets/d/1zQiK3ETwjhF3NYYqQ413JpPgOUbzr0mn5_tOy2SO92A/export?format=csv&gid=156663288',
    sc: 'https://docs.google.com/spreadsheets/d/18VI6WJ3Q-howf2IPxGYt7I70BnRM-_msNoQpCiheZik/export?format=csv&gid=4376430',
    jujuy: 'https://docs.google.com/spreadsheets/d/1NTApxbnNgv7ok9Z0upRhvD7u18WYKXfQLel29dVXqZ4/export?format=csv&gid=1147265019'
};

const KNOWN_CATEGORIES = [
    'ALIMENTO BALANCEADO ANIMAL', 'ALIMENTO PARA PERROS', 'ALIMENTO PARA GATOS',
    'CEREALES PARA DESAYUNO', 'CEREALES', 'FORRAJES', 'LEGUMBRES',
    'CONDIMENTOS', 'FRUTOS SECOS', 'SNACKS', 'VENENOS', 'ACCESORIOS',
    'BALANCEADOS', 'ALIMENTO PERRO Y GATO', 'CEREALES Y MEZCLAS',
    'COMESTIBLES', 'ACCESORIOS Y VENENOS', 'LIMPIEZA', 'PILETA',
    'VARIOS', 'ANIMALES DE GRANJA', 'SECCIONES'
];

// Parser tools
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

const parseCSV = (csvText, isWholesale) => {
    const lines = csvText.split(/\r?\n/);
    const result = {
        updatedAt: '',
        contact: '',
        categories: []
    };

    let currentCategory = null;
    let currentBrand = null;

    let currentRetailLabel1 = 'PRECIO';
    let currentRetailLabel2 = '';
    let currentRetailLabel3 = '';
    let currentRetailLabel4 = '';
    let currentRetailLabel5 = '';

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

    let proxyCatDog = null;
    let proxyCatCat = null;
    let isCurrentlySplitting = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        try {
            const columns = parseCSVLine(line);

            if (i === 0 && columns[1]) {
                if (!result.updatedAt) result.updatedAt = columns[1];
            }
            if (columns[1] && columns[1].startsWith('tel:')) {
                result.contact = columns[1];
                continue;
            }

            let code, desc, price1, price2, price3, price4, price5;

            if (isWholesale) {
                const col1 = columns[1];
                const col2 = columns[2];

                if (!col1 && !col2) continue;
                if (col1 === 'COD' || col1 === 'INDICE SECCIONES' || col1 === 'fecha') continue;

                if (col1 && KNOWN_CATEGORIES.includes(col1)) {
                    currentCategory = { name: col1, brands: [], columns: ['LISTA 1', 'LISTA 2', 'LISTA 3', 'LISTA 4'] };
                    result.categories.push(currentCategory);
                    currentBrand = null;
                    continue;
                }

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
                else if ((!col1 && col2 && col2 !== 'DESCRIPCION') || (col1 && col1 !== 'DESCRIPCION' && !col1.includes('LISTA'))) {
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
                const col0 = columns[0];
                const col1 = columns[1];

                if (col0 && /^\d*COD(IGO|S)?$/i.test(col0.trim())) {
                    if (columns[3]) currentRetailLabel1 = columns[3];
                    if (columns[4]) currentRetailLabel2 = columns[4];
                    if (columns[5]) currentRetailLabel3 = columns[5]; else currentRetailLabel3 = '';
                    if (columns[6]) currentRetailLabel4 = columns[6]; else currentRetailLabel4 = '';
                    if (columns[7]) currentRetailLabel5 = columns[7]; else currentRetailLabel5 = '';

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

                if (col0 && KNOWN_CATEGORIES.includes(col0)) {
                    isCurrentlySplitting = false;

                    const activeCols = [
                        currentRetailLabel1,
                        currentRetailLabel2,
                        currentRetailLabel3,
                        currentRetailLabel4,
                        currentRetailLabel5
                    ].filter(c => c && c.trim() !== '');

                    if (col0 === 'ALIMENTO PERRO Y GATO') {
                        isCurrentlySplitting = true;

                        proxyCatDog = { name: 'ALIMENTO PARA PERROS', brands: [], columns: activeCols };
                        result.categories.push(proxyCatDog);

                        proxyCatCat = { name: 'ALIMENTO PARA GATOS', brands: [], columns: activeCols };
                        result.categories.push(proxyCatCat);

                        currentCategory = proxyCatDog;
                        currentBrand = null;
                        continue;
                    }

                    currentCategory = { name: col0, brands: [], columns: activeCols };
                    result.categories.push(currentCategory);
                    currentBrand = { name: col0, items: [] };
                    currentCategory.brands.push(currentBrand);
                    continue;
                }

                if (col0 && /^\d+$/.test(col0)) {
                    code = col0;
                    desc = col1;
                    price1 = parsePrice(columns[3]);
                    price2 = parsePrice(columns[4]);
                    price3 = parsePrice(columns[5]);
                    price4 = parsePrice(columns[6]);
                    price5 = parsePrice(columns[7]);
                }
                else if (!col0 && col1 && !col1.startsWith('tel')) {
                    let brandName = col1;
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

            if (code && desc && currentCategory) {
                const item = { code, description: desc, price1, price2, price3, price4, price5 };

                if (!currentBrand) {
                    currentBrand = { name: currentCategory.name, items: [] };
                    currentCategory.brands.push(currentBrand);
                }
                currentBrand.items.push(item);
            }
        } catch (err) {
            console.warn(`Error procesando fila ${i + 1}`, err);
        }
    }

    result.categories = result.categories.filter(c => c.brands.length > 0);
    return result;
};


// API Route
app.get('/api/precios', async (req, res) => {
    try {
        const listType = req.query.lista === 'mayorista' ? 'mayorista' : null;
        let branch = req.query.sucursal || 'sm';

        // Normalize branch names
        if (branch === 'sc' || branch === 'santo-cristo') branch = 'sc';
        else if (branch === 'jujuy' || branch === 'ju') branch = 'jujuy';
        else branch = 'sm';

        const isWholesale = listType === 'mayorista';
        const targetUrl = isWholesale ? SHEET_URLS.mayorista : SHEET_URLS[branch];

        if (!targetUrl) {
            return res.status(400).json({ error: 'Lista no encontrada' });
        }

        const response = await fetch(targetUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch from Google Sheets: ${response.statusText}`);
        }

        const csvText = await response.text();
        const data = parseCSV(csvText, isWholesale);

        res.json({
            success: true,
            tipo: isWholesale ? 'mayorista' : 'minorista',
            sucursal: isWholesale ? null : branch,
            data: data
        });
    } catch (error) {
        console.error('Error in /api/precios:', error);
        res.status(500).json({ success: false, error: 'Hubo un error al obtener o procesar la lista de precios.' });
    }
});

// Serve static React/Vite app
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));

    app.use((req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('API Server is running. In dev mode the frontend is handled by Vite.');
    });
}


app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
