import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  checkLookImageFile,
  LOOK_IMAGE_MAX_BYTES,
  readSignInLook,
  resolveLoginTemplate,
  writeSignInLook,
} from '../signInLook';
import { useSignInLook } from '../../hooks/useSignInLook';

describe('sign-in look storage (this device only)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to classic with no image when nothing is kept', () => {
    expect(readSignInLook('co')).toEqual({ template: 'classic' });
  });

  it('keeps the template and image per department, under the aces.signInLook prefix', () => {
    expect(writeSignInLook('co', { template: 'split', imageDataUrl: 'data:image/jpeg;base64,AAAA' })).toBe(true);
    expect(localStorage.getItem('aces.signInLook.co')).toContain('"template":"split"');
    expect(readSignInLook('co')).toEqual({ template: 'split', imageDataUrl: 'data:image/jpeg;base64,AAAA' });
    expect(readSignInLook('ce')).toEqual({ template: 'classic' });
  });

  it('uses the default key when there is no slug', () => {
    writeSignInLook(undefined, { template: 'centered' });
    expect(localStorage.getItem('aces.signInLook.default')).not.toBeNull();
    expect(readSignInLook()).toEqual({ template: 'centered', imageDataUrl: undefined });
  });

  it('ignores a stored template it does not know, and a non-image data URL', () => {
    localStorage.setItem(
      'aces.signInLook.co',
      JSON.stringify({ template: 'neon', imageDataUrl: 'javascript:alert(1)' }),
    );
    expect(readSignInLook('co')).toEqual({ template: 'classic', imageDataUrl: undefined });
  });

  it('falls back to classic when the stored value is not valid JSON', () => {
    localStorage.setItem('aces.signInLook.co', '{not json');
    expect(readSignInLook('co')).toEqual({ template: 'classic' });
  });

  it('reports false when the browser refuses the write (no room left)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    try {
      expect(writeSignInLook('co', { template: 'split' })).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('resolveLoginTemplate', () => {
  it('draws classic whatever the image state', () => {
    expect(resolveLoginTemplate('classic', true)).toBe('classic');
    expect(resolveLoginTemplate('classic', false)).toBe('classic');
  });

  it('keeps split and centered only when there is an image', () => {
    expect(resolveLoginTemplate('split', true)).toBe('split');
    expect(resolveLoginTemplate('centered', true)).toBe('centered');
    expect(resolveLoginTemplate('split', false)).toBe('classic');
    expect(resolveLoginTemplate('centered', false)).toBe('classic');
  });

  it('treats a missing template as classic', () => {
    expect(resolveLoginTemplate(undefined, true)).toBe('classic');
  });
});

describe('checkLookImageFile', () => {
  it('accepts PNG, JPEG and WebP', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(checkLookImageFile({ type, size: 1000 })).toBeUndefined();
    }
  });

  it('refuses other types, including SVG and GIF', () => {
    expect(checkLookImageFile({ type: 'image/svg+xml', size: 10 })).toMatch(/PNG, JPEG or WebP/);
    expect(checkLookImageFile({ type: 'image/gif', size: 10 })).toMatch(/PNG, JPEG or WebP/);
    expect(checkLookImageFile({ type: 'application/pdf', size: 10 })).toMatch(/PNG, JPEG or WebP/);
  });

  it('refuses files over 10 MB and accepts exactly 10 MB', () => {
    expect(checkLookImageFile({ type: 'image/png', size: LOOK_IMAGE_MAX_BYTES })).toBeUndefined();
    expect(checkLookImageFile({ type: 'image/png', size: LOOK_IMAGE_MAX_BYTES + 1 })).toMatch(/10 MB/);
  });
});

describe('useSignInLook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads the device look for the department and saves changes straight away', () => {
    const { result } = renderHook(() => useSignInLook('co'));
    expect(result.current.look).toEqual({ template: 'classic' });

    act(() => {
      expect(result.current.setTemplate('split')).toBe(true);
    });
    expect(result.current.look.template).toBe('split');
    expect(readSignInLook('co').template).toBe('split');
  });

  it('sets and removes an image without touching the template', () => {
    const { result } = renderHook(() => useSignInLook('co'));
    act(() => {
      result.current.setTemplate('centered');
    });
    act(() => {
      result.current.setImage('data:image/jpeg;base64,BBBB');
    });
    expect(result.current.look).toEqual({ template: 'centered', imageDataUrl: 'data:image/jpeg;base64,BBBB' });

    act(() => {
      result.current.removeImage();
    });
    expect(result.current.look).toEqual({ template: 'centered' });
    expect(readSignInLook('co')).toEqual({ template: 'centered' });
  });

  it('shows each department its own look when the slug changes', () => {
    writeSignInLook('co', { template: 'split', imageDataUrl: 'data:image/png;base64,CCCC' });
    const { result, rerender } = renderHook(({ slug }: { slug?: string }) => useSignInLook(slug), {
      initialProps: { slug: 'co' },
    });
    expect(result.current.look.template).toBe('split');

    rerender({ slug: 'ce' });
    expect(result.current.look).toEqual({ template: 'classic' });
  });

  it('keeps the look on screen unchanged when the browser refuses the save', () => {
    const { result } = renderHook(() => useSignInLook('co'));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    try {
      act(() => {
        expect(result.current.setTemplate('split')).toBe(false);
      });
    } finally {
      Storage.prototype.setItem = original;
    }
    expect(result.current.look).toEqual({ template: 'classic' });
  });
});
