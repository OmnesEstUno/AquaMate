import faunaData from '../fauna.json' assert { type: 'json' };
import floraData from '../flora.json' assert { type: 'json' };

const R2_DOMAINS = {
    fauna: 'https://pub-eaf7b96d5e4d42869407498cf5b931e0.r2.dev',
    flora: 'https://pub-40c047642c084c80857179b0032563e5.r2.dev',
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function handleOptions() {
    return new Response(null, { headers: CORS_HEADERS });
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}

function convertImageUrl(localUrl, bucketKey) {
    if (!localUrl) return '';
    const domain = R2_DOMAINS[bucketKey] || R2_DOMAINS.fauna;
    const imagePath = localUrl.startsWith('/') ? localUrl.slice(1) : localUrl;
    return `${domain}/${imagePath}`;
}

// Flatten all items from a dataset (fauna or flora) into a searchable array
function flattenDataset(dataset, bucketKey) {
    const results = [];
    for (const category of Object.values(dataset)) {
        for (const page of category.pages) {
            for (const item of page.items) {
                results.push({ ...item, bucketKey });
            }
        }
    }
    return results;
}

async function handleRequest(request) {
    if (request.method === 'OPTIONS') {
        return handleOptions();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /api/images/:category/:page - Return paginated images
    if (path.startsWith('/api/images/') && request.method === 'GET') {
        const pathParts = path.split('/').filter(p => p);
        const category = pathParts[2] || 'freshwater';
        const requestedPage = parseInt(pathParts[3]) || 1;

        if (!faunaData[category]) {
            return jsonResponse({
                success: false,
                error: 'Category not found',
                available: Object.keys(faunaData),
            }, 404);
        }

        const CATEGORY_DATA = faunaData[category];
        const PAGE_DATA = CATEGORY_DATA.pages.find(p => p.page === requestedPage);

        if (!PAGE_DATA) {
            return jsonResponse({
                success: false,
                error: 'Page not found',
                totalPages: CATEGORY_DATA.pages.length,
            }, 404);
        }

        const itemsWithR2Urls = PAGE_DATA.items.map(item => ({
            ...item,
            image_url: convertImageUrl(item.image_url, 'fauna'),
        }));

        return jsonResponse({
            success: true,
            category,
            page: PAGE_DATA.page,
            totalPages: CATEGORY_DATA.pages.length,
            items: itemsWithR2Urls,
        });
    }

    // GET /api/search?q=<term> - Search across all fauna and flora
    if (path === '/api/search' && request.method === 'GET') {
        const q = url.searchParams.get('q')?.trim().toLowerCase();

        if (!q) {
            return jsonResponse({ success: false, error: 'Missing query param: q' }, 400);
        }

        const allItems = [
            ...flattenDataset(faunaData, 'fauna'),
            ...flattenDataset(floraData, 'flora'),
        ];

        const matches = allItems
            .filter(item =>
                item.commonName?.toLowerCase().includes(q) ||
                item.scientificName?.toLowerCase().includes(q)
            )
            .map(({ bucketKey, ...item }) => ({
                ...item,
                image_url: convertImageUrl(item.image_url, bucketKey),
            }));

        return jsonResponse({ success: true, query: q, results: matches });
    }

    // GET /api/categories - Return all available categories
    if (path === '/api/categories' && request.method === 'GET') {
        const categories = Object.keys(faunaData).map(cat => ({
            name: cat,
            pages: faunaData[cat].pages.length,
        }));

        return jsonResponse({ success: true, categories });
    }

    // Health check
    if (path === '/health' && request.method === 'GET') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    return jsonResponse({
        error: 'Not Found',
        availableEndpoints: [
            '/health',
            '/api/categories',
            '/api/images/:category/:page',
            '/api/search?q=<term>',
        ],
    }, 404);
}

export default {
    async fetch(request) {
        return handleRequest(request);
    }
};
