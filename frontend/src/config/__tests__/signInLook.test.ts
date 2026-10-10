import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  addWallpaper,
  checkLookImageFile,
  dimOpacity,
  fileFromBase64,
  LOOK_IMAGE_MAX_BYTES,
  MAX_SAVED_WALLPAPERS,
  readSignInLook,
  readWallpapers,
  removeWallpaper,
  resolveLoginTemplate,
  resolveWallpaper,
  writeSignInLook,
} from '../signInLook';
import { useSignInLook } from '../../hooks/useSignInLook';

const IMG = 'data:image/jpeg;base64,AAAA';
const IMG2 = 'data:image/jpeg;base64,BBBB';

/** Makes every write fail, except those whose key matches `allow`. */
function failWrites(allow?: RegExp) {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    if (allow && allow.test(key)) return original.call(this, key, value);
    throw new DOMException('full', 'QuotaExceededError');
  };
  return () => {
    Storage.prototype.setItem = original;
  };
}

describe('sign-in look storage (this device only)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to classic, medium dim, with no wallpaper', () => {
    expect(readSignInLook('co')).toEqual({ template: 'classic', dim: 'medium' });
  });

  it('keeps the template, wallpaper choice and dim per department', () => {
    expect(writeSignInLook('co', { template: 'split', wallpaperId: 'wp-1', dim: 'dark' })).toBe(true);
    expect(localStorage.getItem('aces.signInLook.co')).toContain('"template":"split"');
    expect(readSignInLook('co')).toEqual({ template: 'split', wallpaperId: 'wp-1', dim: 'dark' });
    expect(readSignInLook('ce')).toEqual({ template: 'classic', dim: 'medium' });
  });

  it('uses the default key when there is no slug', () => {
    writeSignInLook(undefined, { template: 'centered', dim: 'light' });
    expect(localStorage.getItem('aces.signInLook.default')).not.toBeNull();
    expect(readSignInLook()).toEqual({ template: 'centered', wallpaperId: undefined, dim: 'light' });
  });

  it('falls back for an unknown template or dim level, and for bad JSON', () => {
    localStorage.setItem('aces.signInLook.co', JSON.stringify({ template: 'neon', dim: 'blinding' }));
    expect(readSignInLook('co')).toEqual({ template: 'classic', wallpaperId: undefined, dim: 'medium' });

    localStorage.setItem('aces.signInLook.co', '{not json');
    expect(readSignInLook('co')).toEqual({ template: 'classic', dim: 'medium' });
  });

  it('reports false when the browser refuses the write', () => {
    const restore = failWrites();
    try {
      expect(writeSignInLook('co', { template: 'split', dim: 'medium' })).toBe(false);
    } finally {
      restore();
    }
  });
});

describe('saved wallpapers (this device only)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds the newest wallpaper first and drops the oldest past the cap', () => {
    for (let i = 0; i < MAX_SAVED_WALLPAPERS + 2; i += 1) {
      addWallpaper(`data:image/png;base64,${i}`, 'upload');
    }
    const list = readWallpapers();
    expect(list).toHaveLength(MAX_SAVED_WALLPAPERS);
    expect(list[0].dataUrl).toBe(`data:image/png;base64,${MAX_SAVED_WALLPAPERS + 1}`);
  });

  it('records whether it was uploaded or created', () => {
    addWallpaper(IMG, 'created');
    expect(readWallpapers()[0].source).toBe('created');
  });

  it('removes one wallpaper and leaves the rest', () => {
    const a = addWallpaper(IMG, 'upload');
    const b = addWallpaper(IMG2, 'upload');
    expect(removeWallpaper(a!.id)).toBe(true);
    expect(readWallpapers().map((w) => w.id)).toEqual([b!.id]);
  });

  it('ignores stored entries that are not images', () => {
    localStorage.setItem(
      'aces.signInWallpapers',
      JSON.stringify([
        { id: 'ok', dataUrl: IMG, source: 'upload', savedAt: 1 },
        { id: 'bad', dataUrl: 'javascript:alert(1)', source: 'upload', savedAt: 2 },
        { id: 'bad-source', dataUrl: IMG, source: 'stolen', savedAt: 3 },
      ]),
    );
    expect(readWallpapers().map((w) => w.id)).toEqual(['ok']);
  });

  it('returns null from addWallpaper when the browser has no room', () => {
    const restore = failWrites();
    try {
      expect(addWallpaper(IMG, 'upload')).toBeNull();
    } finally {
      restore();
    }
  });

  it('resolves a department wallpaper only while it is still on the device', () => {
    const saved = addWallpaper(IMG, 'upload')!;
    const library = readWallpapers();
    expect(resolveWallpaper({ template: 'split', wallpaperId: saved.id, dim: 'medium' }, library)?.id).toBe(saved.id);
    expect(resolveWallpaper({ template: 'split', wallpaperId: 'gone', dim: 'medium' }, library)).toBeUndefined();
    expect(resolveWallpaper({ template: 'split', dim: 'medium' }, library)).toBeUndefined();
  });
});

describe('look helpers', () => {
  it('draws classic whatever the wallpaper state', () => {
    expect(resolveLoginTemplate('classic', true)).toBe('classic');
    expect(resolveLoginTemplate('classic', false)).toBe('classic');
  });

  it('keeps split and centered only when there is a wallpaper', () => {
    expect(resolveLoginTemplate('split', true)).toBe('split');
    expect(resolveLoginTemplate('centered', true)).toBe('centered');
    expect(resolveLoginTemplate('split', false)).toBe('classic');
    expect(resolveLoginTemplate('centered', false)).toBe('classic');
    expect(resolveLoginTemplate(undefined, true)).toBe('classic');
  });

  it('maps dim levels to increasing overlay strength', () => {
    expect(dimOpacity('light')).toBeLessThan(dimOpacity('medium'));
    expect(dimOpacity('medium')).toBeLessThan(dimOpacity('dark'));
  });

  it('accepts PNG, JPEG and WebP, and refuses other types and large files', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(checkLookImageFile({ type, size: 1000 })).toBeUndefined();
    }
    expect(checkLookImageFile({ type: 'image/svg+xml', size: 10 })).toMatch(/PNG, JPEG or WebP/);
    expect(checkLookImageFile({ type: 'image/gif', size: 10 })).toMatch(/PNG, JPEG or WebP/);
    expect(checkLookImageFile({ type: 'image/png', size: LOOK_IMAGE_MAX_BYTES })).toBeUndefined();
    expect(checkLookImageFile({ type: 'image/png', size: LOOK_IMAGE_MAX_BYTES + 1 })).toMatch(/10 MB/);
  });

  it('turns a base64 picture from the server into a file of the same type and bytes', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const data = btoa(String.fromCharCode(...bytes));
    const file = fileFromBase64('image/png', data);
    expect(file.type).toBe('image/png');
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual(Array.from(bytes));
  });
});

describe('useSignInLook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves the template and dim level straight away', () => {
    const { result } = renderHook(() => useSignInLook('co'));
    expect(result.current.look).toEqual({ template: 'classic', dim: 'medium' });

    act(() => {
      expect(result.current.setTemplate('split')).toBe(true);
    });
    act(() => {
      expect(result.current.setDim('dark')).toBe(true);
    });
    expect(result.current.look).toEqual({ template: 'split', dim: 'dark' });
    expect(readSignInLook('co')).toEqual({ template: 'split', wallpaperId: undefined, dim: 'dark' });
  });

  it('saves a wallpaper to the device and uses it for this department', () => {
    const { result } = renderHook(() => useSignInLook('co'));
    let saved: ReturnType<typeof addWallpaper> = null;
    act(() => {
      saved = result.current.saveWallpaper(IMG, 'created');
    });
    expect(saved).not.toBeNull();
    expect(result.current.look.wallpaperId).toBe(saved!.id);
    expect(result.current.wallpaper?.dataUrl).toBe(IMG);
    expect(result.current.library).toHaveLength(1);
    expect(readSignInLook('co').wallpaperId).toBe(saved!.id);
  });

  it('keeps nothing when the look cannot be saved after the wallpaper was', () => {
    const { result } = renderHook(() => useSignInLook('co'));
    const restore = failWrites(/^aces\.signInWallpapers$/);
    let saved: unknown = 'unset';
    try {
      act(() => {
        saved = result.current.saveWallpaper(IMG, 'upload');
      });
    } finally {
      restore();
    }
    expect(saved).toBeNull();
    expect(readWallpapers()).toHaveLength(0);
    expect(result.current.look.wallpaperId).toBeUndefined();
  });

  it('removing the wallpaper the department uses clears its choice', () => {
    const { result } = renderHook(() => useSignInLook('co'));
    let id = '';
    act(() => {
      id = result.current.saveWallpaper(IMG, 'upload')!.id;
    });
    act(() => {
      expect(result.current.deleteWallpaper(id)).toBe(true);
    });
    expect(result.current.look.wallpaperId).toBeUndefined();
    expect(result.current.library).toHaveLength(0);
  });

  it('shows each department its own look when the slug changes', () => {
    writeSignInLook('co', { template: 'split', dim: 'light' });
    const { result, rerender } = renderHook(({ slug }: { slug?: string }) => useSignInLook(slug), {
      initialProps: { slug: 'co' as string | undefined },
    });
    expect(result.current.look).toEqual({ template: 'split', dim: 'light' });

    rerender({ slug: 'ce' });
    expect(result.current.look).toEqual({ template: 'classic', dim: 'medium' });
  });

  it('keeps the look on screen when the browser refuses the save', () => {
    const { result } = renderHook(() => useSignInLook('co'));
    const restore = failWrites();
    try {
      act(() => {
        expect(result.current.setTemplate('split')).toBe(false);
      });
    } finally {
      restore();
    }
    expect(result.current.look).toEqual({ template: 'classic', dim: 'medium' });
  });
});
