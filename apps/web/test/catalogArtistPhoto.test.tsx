import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CatalogArtistPhoto } from '../src/components/CatalogArtistPhoto.tsx';
import { rememberArtistPhotos } from '../src/lib/catalogArtistPhotos.ts';

vi.mock('../src/lib/cloud/catalog.ts', () => ({ findCatalogArtistPhoto: async () => {} }));

it('shares a photo discovered on another chart and falls back when that image fails', async () => {
  const artist = { name: 'Foto compartilhada', slug: 'shared-image-ui', photo: '' };
  const { container } = render(<><CatalogArtistPhoto artist={artist} /><CatalogArtistPhoto artist={artist} /></>);
  expect(container.querySelectorAll('img')).toHaveLength(0);
  act(() => rememberArtistPhotos({ ...artist, photo: 'https://example.com/first.jpg', photoCandidates: ['https://example.com/second.jpg'] }));
  await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2));
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/first.jpg');
  fireEvent.error(container.querySelector('img')!);
  await waitFor(() => expect([...container.querySelectorAll('img')].every(image => image.getAttribute('src') === 'https://example.com/second.jpg')).toBe(true));
});
