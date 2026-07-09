const speciesData = require('../../dist/species.json');
const { applyFilters } = require('./gallery/filters');
const { seededShuffle } = require('./gallery/shuffle');
const { computeFacets } = require('./gallery/facets');

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

const CARE_ORDER = ['beginner', 'intermediate', 'advanced', 'expert'];

function applySort(items, sort) {
    const arr = items.slice();
    const nullLast = (a, b) => {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return 0;
    };
    switch (sort) {
        case 'az':        return arr.sort((a, b) => (a.commonName || '').localeCompare(b.commonName || ''));
        case 'za':        return arr.sort((a, b) => (b.commonName || '').localeCompare(a.commonName || ''));
        case 'size-asc':  return arr.sort((a, b) => nullLast(a.adultSizeCm?.max, b.adultSizeCm?.max) || (a.adultSizeCm?.max - b.adultSizeCm?.max));
        case 'size-desc': return arr.sort((a, b) => nullLast(a.adultSizeCm?.max, b.adultSizeCm?.max) || (b.adultSizeCm?.max - a.adultSizeCm?.max));
        case 'care-asc':  return arr.sort((a, b) => CARE_ORDER.indexOf(a.careLevel) - CARE_ORDER.indexOf(b.careLevel));
        case 'care-desc': return arr.sort((a, b) => CARE_ORDER.indexOf(b.careLevel) - CARE_ORDER.indexOf(a.careLevel));
        case 'tank-asc':  return arr.sort((a, b) => nullLast(a.tank?.minVolumeLiters, b.tank?.minVolumeLiters) || (a.tank?.minVolumeLiters - b.tank?.minVolumeLiters));
        case 'tank-desc': return arr.sort((a, b) => nullLast(a.tank?.minVolumeLiters, b.tank?.minVolumeLiters) || (b.tank?.minVolumeLiters - a.tank?.minVolumeLiters));
        default:          return arr;
    }
}

function parseGalleryQuery(url) {
    const q = url.searchParams;
    const list = (name) => q.get(name)?.split(',').filter(Boolean) || undefined;
    const intOr = (name, fallback = undefined) => {
        const v = q.get(name);
        if (v == null) return fallback;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? fallback : n;
    };
    const bool = (name) => q.get(name) === '1';

    return {
        taxa: list('taxa'),
        waterType: list('waterType'),
        careLevel: list('careLevel'),
        minSize: intOr('minSize'),
        maxSize: intOr('maxSize'),
        maxTankL: intOr('maxTankL'),
        temperament: list('temperament'),
        grouping: list('grouping'),
        dietType: list('dietType'),
        co2: list('co2'),
        lighting: list('lighting'),
        reefSafe: bool('reefSafe') ? true : undefined,
        hideAdvisory: bool('hideAdvisory') ? true : undefined,
        q: q.get('q') || undefined,
        seed: intOr('seed', 0),
        page: intOr('page', 1),
        perPage: Math.min(intOr('perPage', 24), 48),
        sort: q.get('sort') || 'random',
    };
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

    // GET /api/gallery — filterable, seed-shuffled, facet-counted browse endpoint
    if (path === '/api/gallery' && request.method === 'GET') {
        const params = parseGalleryQuery(url);
        const all = allItems();
        const { seed, page, perPage, sort, ...filters } = params;

        const matching = applyFilters(all, filters);
        const totalMatching = matching.length;
        const totalPages = Math.max(1, Math.ceil(totalMatching / perPage));

        let ordered;
        if (sort === 'random') {
            ordered = seededShuffle(matching, seed);
        } else {
            ordered = applySort(matching, sort);
        }

        const start = (page - 1) * perPage;
        const slice = ordered.slice(start, start + perPage).map(withResolvedImage);
        const facetCounts = computeFacets(all, filters);

        return jsonResponse({
            success: true,
            page,
            totalPages,
            totalMatching,
            seed,
            items: slice,
            facetCounts,
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
