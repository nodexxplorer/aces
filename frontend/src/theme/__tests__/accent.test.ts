import { describe, expect, it, afterEach } from 'vitest';
import { applyDepartmentAccent, isAccentColor, PRIMARY_STEPS, primaryRamp, type RGB } from '../accent';

// The accent the server computes for the department logo in branding/department-logos/EG-CO.png.
const EG_CO = '#1b65a7';

function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function whiteContrast(rgb: RGB): number {
  return 1.05 / (luminance(rgb) + 0.05);
}

describe('isAccentColor', () => {
  it('accepts only #rrggbb', () => {
    expect(isAccentColor(EG_CO)).toBe(true);
    expect(isAccentColor('#1B65A7')).toBe(true);
    expect(isAccentColor('1b65a7')).toBe(false);
    expect(isAccentColor('#1b65a')).toBe(false);
    expect(isAccentColor('blue')).toBe(false);
    expect(isAccentColor('')).toBe(false);
    expect(isAccentColor(null)).toBe(false);
    expect(isAccentColor(undefined)).toBe(false);
  });
});

describe('primaryRamp', () => {
  it('uses the accent as step 500', () => {
    expect(primaryRamp(EG_CO)[500]).toEqual([27, 101, 167]);
  });

  it('gets lighter toward 50 and darker toward 950', () => {
    const ramp = primaryRamp(EG_CO);
    const sums = PRIMARY_STEPS.map((step) => ramp[step].reduce((a, b) => a + b, 0));
    for (let i = 1; i < sums.length; i++) {
      expect(sums[i]).toBeLessThan(sums[i - 1]);
    }
  });

  it('keeps white text readable on the accent, as the server requires', () => {
    expect(whiteContrast(primaryRamp(EG_CO)[500])).toBeGreaterThanOrEqual(6);
  });
});

describe('applyDepartmentAccent', () => {
  afterEach(() => applyDepartmentAccent(null));

  it('sets the ramp as RGB triplets on the document', () => {
    applyDepartmentAccent(EG_CO);
    expect(document.documentElement.style.getPropertyValue('--primary-500')).toBe('27 101 167');
    expect(document.documentElement.style.getPropertyValue('--primary-50')).not.toBe('');
  });

  it('removes the department values when there is no accent, so the platform blue applies', () => {
    applyDepartmentAccent(EG_CO);
    applyDepartmentAccent(undefined);
    expect(document.documentElement.style.getPropertyValue('--primary-500')).toBe('');
  });

  it('ignores a value that is not a colour', () => {
    applyDepartmentAccent('not a colour');
    expect(document.documentElement.style.getPropertyValue('--primary-500')).toBe('');
  });
});
