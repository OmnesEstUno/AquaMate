import speciesData from '../../dist/species.json' assert { type: 'json' };

const R2_DOMAINS = {
    fauna: 'https://pub-eaf7b96d5e4d42869407498cf5b931e0.r2.dev',
    flora: 'https://pub-40c047642c084c80857179b0032563e5.r2.dev',
};

const PAGE_SIZE = 8;

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

function resolveImageUrl(item) {
    if (!item.media || !item.media.primaryImage) return '';
    const domain = R2_DOMAINS[item.kind] || R2_DOMAINS.fauna;
    const filename = item.media.primaryImage.startsWith('/')
        ? item.media.primaryImage.slice(1)
        : item.media.primaryImage;
    return `${domain}/${filename}`;
}

function withResolvedImage(item) {
    return { ...item, image_url: resolveImageUrl(item) };
}

function getFaunaCategory(category) {
    // category in URL = legacy water-type word for fauna (freshwater | saltwater | brackish)
    return speciesData.fauna[category];
}

function allItems() {
    return [
        ...speciesData.fauna.freshwater.items,
        ...speciesData.fauna.saltwater.items,
        ...speciesData.fauna.brackish.items,
        ...speciesData.flora.freshwater.items,
        ...speciesData.flora.saltwater.items,
        ...speciesData.flora.brackish.items,
    ];
}

async function handleRequest(request) {
    if (request.method === 'OPTIONS') return handleOptions();

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /api/images/:category/:page — paginated fauna gallery
    if (path.startsWith('/api/images/') && request.method === 'GET') {
        const parts = path.split('/').filter(p => p);
        const category = parts[2] || 'freshwater';
        const requestedPage = parseInt(parts[3], 10) || 1;

        const bucket = getFaunaCategory(category);
        if (!bucket) {
            return jsonResponse({
                success: false,
                error: 'Category not found',
                available: Object.keys(speciesData.fauna),
            }, 404);
        }

        const items = bucket.items;
        const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        if (requestedPage < 1 || requestedPage > totalPages) {
            return jsonResponse({
                success: false,
                error: 'Page not found',
                totalPages,
            }, 404);
        }

        const start = (requestedPage - 1) * PAGE_SIZE;
        const slice = items.slice(start, start + PAGE_SIZE).map(withResolvedImage);

        return jsonResponse({
            success: true,
            category,
            page: requestedPage,
            totalPages,
            items: slice,
        });
    }

    // GET /api/search?q=<term> — search all species
    if (path === '/api/search' && request.method === 'GET') {
        const q = url.searchParams.get('q')?.trim().toLowerCase();
        if (!q) {
            return jsonResponse({ success: false, error: 'Missing query param: q' }, 400);
        }
        const matches = allItems()
            .filter(item =>
                item.commonName?.toLowerCase().includes(q) ||
                item.scientificName?.toLowerCase().includes(q)
            )
            .map(withResolvedImage);
        return jsonResponse({ success: true, query: q, results: matches });
    }

    // GET /api/categories — return fauna water-type buckets
    if (path === '/api/categories' && request.method === 'GET') {
        const categories = Object.keys(speciesData.fauna).map(cat => ({
            name: cat,
            count: speciesData.fauna[cat].items.length,
        }));
        return jsonResponse({ success: true, categories });
    }

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
    },
};
