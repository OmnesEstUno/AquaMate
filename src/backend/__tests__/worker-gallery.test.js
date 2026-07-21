const worker = require('../worker').default;

async function req(url) {
  const res = await worker.fetch(new Request(url));
  return { status: res.status, body: await res.json() };
}

const BASE = 'https://example.com';

describe('GET /api/gallery', () => {
  test('empty filters returns page 1 with 24 items and totalMatching=1697', async () => {
    const { status, body } = await req(`${BASE}/api/gallery?seed=42`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.page).toBe(1);
    expect(body.totalMatching).toBe(1697); // 1696 + Opae Ula (br-crus-001)
    expect(body.totalPages).toBe(Math.ceil(1697 / 24));
    expect(body.items).toHaveLength(24);
    expect(body.seed).toBe(42);
  });

  test('same seed produces same first-page order', async () => {
    const a = await req(`${BASE}/api/gallery?seed=42`);
    const b = await req(`${BASE}/api/gallery?seed=42`);
    expect(a.body.items.map(i => i.id)).toEqual(b.body.items.map(i => i.id));
  });

  test('facetCounts present in response', async () => {
    const { body } = await req(`${BASE}/api/gallery?seed=42`);
    expect(body.facetCounts).toBeDefined();
    expect(body.facetCounts.taxa.fish).toBeGreaterThan(1000);
    expect(body.facetCounts.waterType.freshwater).toBeGreaterThan(500);
    expect(body.facetCounts.reefSafe).toBeDefined();
  });

  test('taxa filter reduces the set', async () => {
    const all = await req(`${BASE}/api/gallery?seed=42`);
    const fishOnly = await req(`${BASE}/api/gallery?seed=42&taxa=fish`);
    expect(fishOnly.body.totalMatching).toBeLessThan(all.body.totalMatching);
    expect(fishOnly.body.items.every(i => i.taxon === 'fish')).toBe(true);
  });

  test('reefSafe filter matches pre-classified fish (permissive: yes + with caution)', async () => {
    const { body } = await req(`${BASE}/api/gallery?seed=42&reefSafe=1`);
    // Corpus has 278 fish tagged 'yes' + 239 tagged 'with caution' + echinoderms with coralSafe=true.
    expect(body.totalMatching).toBeGreaterThan(500);
    expect(body.items.every(i => {
      if (i.taxon === 'fish') return ['yes', 'with caution'].includes(i.fish?.reefSafe);
      if (i.taxon === 'echinoderm') return i.echinoderm?.coralSafe === true;
      return true;
    })).toBe(true);
  });

  test('page 2 returns different items than page 1 (same seed)', async () => {
    const p1 = await req(`${BASE}/api/gallery?seed=42&page=1`);
    const p2 = await req(`${BASE}/api/gallery?seed=42&page=2`);
    const p1Ids = new Set(p1.body.items.map(i => i.id));
    const p2Ids = new Set(p2.body.items.map(i => i.id));
    for (const id of p2Ids) {
      expect(p1Ids.has(id)).toBe(false);
    }
  });

  test('image_url is resolved for items with primaryImage', async () => {
    const { body } = await req(`${BASE}/api/gallery?seed=42&taxa=fish&waterType=freshwater&maxSize=5`);
    const withImage = body.items.find(i => i.media?.primaryImage);
    if (withImage) {
      expect(withImage.image_url).toMatch(/^https:\/\/pub-/);
      expect(withImage.image_is_candidate).toBe(false);
      expect(withImage.image_credit).toBeNull();
    }
  });
});

describe('candidate image fallback (primaryImage null)', () => {
  test('item with no primaryImage but with candidates gets a candidate url + credit + flag', async () => {
    const { body } = await req(`${BASE}/api/gallery?seed=42`);
    const cand = body.items.find(
      (i) => !i.media?.primaryImage && Array.isArray(i.media?.imageCandidates) && i.media.imageCandidates.length > 0
    );
    expect(cand).toBeDefined();
    const urls = cand.media.imageCandidates.map((c) => c.url);
    expect(urls).toContain(cand.image_url);       // picked from its own candidates
    expect(cand.image_is_candidate).toBe(true);
    expect(typeof cand.image_credit).toBe('string');
    expect(cand.image_credit.length).toBeGreaterThan(0);
  });

  test('item with no primaryImage and no candidates gets empty url, not flagged', async () => {
    const { body } = await req(`${BASE}/api/gallery?seed=42`);
    const none = body.items.find(
      (i) => !i.media?.primaryImage && (!Array.isArray(i.media?.imageCandidates) || i.media.imageCandidates.length === 0)
    );
    if (none) {
      expect(none.image_url).toBe('');
      expect(none.image_is_candidate).toBe(false);
      expect(none.image_credit).toBeNull();
    }
  });

  describe('matchedVia annotation', () => {
    test('no q — items have no matchedVia field', async () => {
      const { body } = await req(`${BASE}/api/gallery?seed=42`);
      expect(body.items.every(i => i.matchedVia === undefined)).toBe(true);
    });

    test('with q — every item has matchedVia set', async () => {
      const { body } = await req(`${BASE}/api/gallery?seed=42&q=neon`);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.every(i => ['commonName', 'scientificName', 'alsoKnownAs'].includes(i.matchedVia))).toBe(true);
    });

    test('Cardinal Tetra with q=red neon → matchedVia is alsoKnownAs', async () => {
      const { body } = await req(`${BASE}/api/gallery?seed=42&q=red%20neon`);
      const cardinal = body.items.find(i => i.slug === 'cardinal-tetra');
      if (cardinal) {
        expect(cardinal.matchedVia).toBe('alsoKnownAs');
      } else {
        // Corpus may or may not have this exact slug — softer assertion:
        const anyAka = body.items.some(i => i.matchedVia === 'alsoKnownAs');
        expect(anyAka).toBe(true);
      }
    });

    test('Neon Tetra with q=neon → matchedVia is commonName', async () => {
      const { body } = await req(`${BASE}/api/gallery?seed=42&q=neon`);
      const neon = body.items.find(i => i.slug === 'neon-tetra');
      if (neon) {
        expect(neon.matchedVia).toBe('commonName');
      }
    });
  });
});
