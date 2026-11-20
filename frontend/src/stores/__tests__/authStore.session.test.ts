import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheOwner, getSessionRevision, useAuthStore } from '../authStore';
import { queryClient } from '../../query/client';
import { cacheData, getCachedData } from '../../db/offlineDb';
import type { User, AuthTokens } from '../../types';

export const user = (id: string, slug = 'co'): User =>
  ({
    id,
    email: `${id}@example.edu`,
    role: 'student',
    activeRole: 'student',
    roles: ['student'],
    isApproved: true,
    isActive: true,
    approvalStatus: 'approved',
    tenant: { slug, name: slug },
  }) as User;
const tokens = {} as AuthTokens;

describe('private session caches', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    useAuthStore.getState().logout();
  });

  it('clears query and offline data on local logout, without requiring a server response', async () => {
    useAuthStore.getState().login(user('a'), tokens);
    queryClient.setQueryData(['results'], { student: 'a' });
    await cacheData('private', { student: 'a' });
    const revision = getSessionRevision();
    useAuthStore.getState().logout();
    expect(queryClient.getQueryData(['results'])).toBeUndefined();
    expect(await getCachedData('private')).toBeNull();
    expect(getSessionRevision()).toBeGreaterThan(revision);
  });

  it('isolates cache owners by user, department and active role', () => {
    expect(cacheOwner(user('a'))).not.toBe(cacheOwner(user('b')));
    expect(cacheOwner(user('a', 'co'))).not.toBe(cacheOwner(user('a', 'ee')));
    expect(cacheOwner(user('a'))).not.toBe(cacheOwner({ ...user('a'), activeRole: 'class_rep' }));
    expect(cacheOwner(null)).toBeNull();
  });

  it('clears private queries when logging into another account or switching roles', () => {
    useAuthStore.getState().login(user('a'), tokens);
    queryClient.setQueryData(['results'], 'a');
    useAuthStore.getState().login(user('b'), tokens);
    expect(queryClient.getQueryData(['results'])).toBeUndefined();
    queryClient.setQueryData(['results'], 'b');
    useAuthStore.getState().switchRole('class_rep');
    expect(queryClient.getQueryData(['results'])).toBeUndefined();
  });
});
