import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// react-router-dom v7's exports map isn't resolvable by CRA's Jest, so mock the
// one hook GalleryCard uses. The card's V2 sub-components are stubbed out to
// keep these tests focused on the image fallback/thumbnail logic.
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('../CareLevelBadge', () => ({ CareLevelBadge: () => null }));
jest.mock('../AdvisoryPill', () => ({ AdvisoryPill: () => null }));
jest.mock('../AKAPill', () => ({ AKAPill: () => null }));
jest.mock('../HoverTeaser', () => ({ HoverTeaser: () => null }));

// eslint-disable-next-line import/first
import { GalleryCard, buildImageChain, thumbnailize } from '../GalleryCard';

const candidate = (url) => ({ url, source: 'Wikimedia Commons', license: 'CC BY-SA 4.0' });
const renderCard = (item) => render(<GalleryCard item={item} query="" />);

describe('buildImageChain', () => {
  test('image_url first, then de-duplicated candidate urls', () => {
    const chain = buildImageChain({
      image_url: 'https://a.jpg',
      media: { imageCandidates: [candidate('https://a.jpg'), candidate('https://b.jpg')] },
    });
    expect(chain).toEqual(['https://a.jpg', 'https://b.jpg']); // a.jpg not repeated
  });

  test('empty image_url is skipped; candidates still used', () => {
    expect(buildImageChain({ image_url: '', media: { imageCandidates: [candidate('https://c.jpg')] } }))
      .toEqual(['https://c.jpg']);
  });

  test('no image and no candidates yields an empty chain', () => {
    expect(buildImageChain({ image_url: '', media: { imageCandidates: [] } })).toEqual([]);
    expect(buildImageChain({ image_url: '' })).toEqual([]);
  });
});

describe('thumbnailize', () => {
  test('defaults to the Wikimedia-allowed 500px width', () => {
    expect(thumbnailize('https://upload.wikimedia.org/wikipedia/commons/c/c0/Neon.jpg'))
      .toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Neon.jpg/500px-Neon.jpg');
  });

  test('preserves the original (upper-case) extension in the thumb name', () => {
    expect(thumbnailize('https://upload.wikimedia.org/wikipedia/commons/9/91/Fish.JPG', 500))
      .toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Fish.JPG/500px-Fish.JPG');
  });

  test('rewrites an SVG thumb with a .png extension', () => {
    expect(thumbnailize('https://upload.wikimedia.org/wikipedia/commons/1/12/Diagram.svg', 500))
      .toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Diagram.svg/500px-Diagram.svg.png');
  });

  test('downsizes iNaturalist large/original to medium', () => {
    expect(thumbnailize('https://inaturalist-open-data.s3.amazonaws.com/photos/93761737/large.jpeg'))
      .toBe('https://inaturalist-open-data.s3.amazonaws.com/photos/93761737/medium.jpeg');
  });

  test('leaves R2 and unknown hosts untouched', () => {
    expect(thumbnailize('https://pub-x.r2.dev/neon.jpg')).toBe('https://pub-x.r2.dev/neon.jpg');
    expect(thumbnailize('https://www.fishbase.se/images/abc.jpg')).toBe('https://www.fishbase.se/images/abc.jpg');
  });
});

describe('GalleryCard image fallback', () => {
  test('renders the resolved image_url, lazily (R2 passes through un-thumbnailed)', () => {
    renderCard({ id: '1', commonName: 'Neon Tetra', image_url: 'https://pub-x.r2.dev/neon.jpg' });
    const img = screen.getByAltText('Neon Tetra');
    expect(img.getAttribute('src')).toBe('https://pub-x.r2.dev/neon.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  test('thumbnail error retries the same original, then advances to the next candidate', () => {
    renderCard({
      id: '2',
      commonName: 'Kuhli Loach',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Broken.jpg',
      media: {
        imageCandidates: [
          candidate('https://upload.wikimedia.org/wikipedia/commons/b/b2/KuhliA.jpg'),
        ],
      },
    });
    const img = screen.getByAltText('Kuhli Loach');
    // 1) primary shown as a 500px thumbnail
    expect(img.getAttribute('src')).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Broken.jpg/500px-Broken.jpg');
    fireEvent.error(img); // 2) thumb 400s -> retry the same candidate's original
    expect(img.getAttribute('src')).toBe('https://upload.wikimedia.org/wikipedia/commons/a/a1/Broken.jpg');
    fireEvent.error(img); // 3) original also fails -> next candidate's thumbnail
    expect(img.getAttribute('src')).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/KuhliA.jpg/500px-KuhliA.jpg');
  });

  test('renders a placeholder (no <img>, no empty src) when nothing is available', () => {
    renderCard({ id: '3', commonName: 'Rusty Gorgonian', image_url: '', media: { imageCandidates: [] } });
    expect(screen.queryByAltText('Rusty Gorgonian')).toBeNull();
    expect(screen.getByRole('img', { name: /No image available for Rusty Gorgonian/i })).toBeTruthy();
    expect(document.querySelector('img')).toBeNull(); // no empty-string-src <img> warning
  });

  test('shows the placeholder after every candidate has failed', () => {
    renderCard({
      id: '4',
      commonName: 'Sea Hare',
      image_url: 'https://commons/hare.jpg',
      media: { imageCandidates: [candidate('https://commons/hare.jpg')] },
    });
    fireEvent.error(screen.getByAltText('Sea Hare')); // only url exhausted
    expect(screen.queryByAltText('Sea Hare')).toBeNull();
    expect(screen.getByRole('img', { name: /No image available for Sea Hare/i })).toBeTruthy();
  });
});
