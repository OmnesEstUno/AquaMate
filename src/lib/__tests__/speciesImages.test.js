import { thumbnailize, resolvePrimaryImageUrl, buildSpeciesImages, candidateCredit } from '../speciesImages';

describe('thumbnailize', () => {
  test('rewrites a Wikimedia original to a 500px thumbnail', () => {
    const u = 'https://upload.wikimedia.org/wikipedia/commons/1/14/Foo.jpg';
    expect(thumbnailize(u)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Foo.jpg/500px-Foo.jpg'
    );
  });
  test('rewrites an iNaturalist large image to medium', () => {
    const u = 'https://inaturalist-open-data.s3.amazonaws.com/photos/123/large.jpeg';
    expect(thumbnailize(u)).toBe('https://inaturalist-open-data.s3.amazonaws.com/photos/123/medium.jpeg');
  });
  test('passes unknown hosts through unchanged', () => {
    expect(thumbnailize('https://example.com/x.jpg')).toBe('https://example.com/x.jpg');
  });
  test('returns falsy input unchanged', () => {
    expect(thumbnailize('')).toBe('');
  });
});

describe('resolvePrimaryImageUrl', () => {
  const R2 = { fauna: 'https://fauna.example', flora: 'https://flora.example' };
  test('builds an R2 url from kind + primaryImage', () => {
    const item = { kind: 'fauna', media: { primaryImage: 'angelfish.jpg' } };
    expect(resolvePrimaryImageUrl(item, R2)).toBe('https://fauna.example/angelfish.jpg');
  });
  test('returns null when no primaryImage', () => {
    expect(resolvePrimaryImageUrl({ kind: 'fauna', media: { primaryImage: null } }, R2)).toBeNull();
  });
});

describe('buildSpeciesImages', () => {
  const R2 = { fauna: 'https://fauna.example', flora: 'https://flora.example' };
  test('primary first, then candidates, each with thumb/full/credit', () => {
    const item = {
      kind: 'fauna',
      media: {
        primaryImage: 'p.jpg',
        imageCandidates: [
          { url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/C.jpg', source: 'Wikimedia Commons', license: 'CC BY 4.0', notes: 'Jane Doe; 100x100. nice' },
        ],
      },
    };
    const imgs = buildSpeciesImages(item, R2);
    expect(imgs[0].full).toBe('https://fauna.example/p.jpg');
    expect(imgs[1].full).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/C.jpg');
    expect(imgs[1].thumb).toContain('/thumb/a/ab/C.jpg/500px-C.jpg');
    expect(imgs[1].credit).toBe('Jane Doe · Wikimedia Commons · CC BY 4.0');
  });
  test('no primary → candidates only', () => {
    const item = { kind: 'flora', media: { primaryImage: null, imageCandidates: [
      { url: 'https://x/y.jpg', source: 'iNaturalist', license: 'CC BY', notes: null },
    ] } };
    const imgs = buildSpeciesImages(item, R2);
    expect(imgs).toHaveLength(1);
    expect(imgs[0].credit).toBe('iNaturalist · CC BY');
  });
  test('no images at all → empty array', () => {
    expect(buildSpeciesImages({ kind: 'fauna', media: { primaryImage: null, imageCandidates: [] } }, R2)).toEqual([]);
  });
});
