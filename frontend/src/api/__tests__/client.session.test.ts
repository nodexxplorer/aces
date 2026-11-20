import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient, { setCsrfToken } from '../client';
import { cacheOwner, useAuthStore } from '../../stores/authStore';
import { cacheData, getCachedData, getPendingActions } from '../../db/offlineDb';
import type { User, AuthTokens } from '../../types';

const user = (id: string): User =>
  ({
    id,
    email: `${id}@example.edu`,
    role: 'student',
    activeRole: 'student',
    roles: ['student'],
    tenant: { slug: 'co', name: 'Computer Engineering' },
  }) as User;
const key = (id: string) => `${cacheOwner(user(id))}:/results?{}`;
const offline: AxiosAdapter = async (config) => {
  throw new AxiosError('Network Error', 'ERR_NETWORK', config);
};

describe('API session boundaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    useAuthStore.getState().logout();
    useAuthStore.getState().login(user('a'), {} as AuthTokens);
    setCsrfToken('test');
  });

  it('uses only the current user cache when offline', async () => {
    await cacheData(key('b'), { data: ['private-b'] });
    await expect(apiClient.get('/results', { adapter: offline })).rejects.toThrow('Network Error');
    await cacheData(key('a'), { data: ['private-a'] });
    const response = await apiClient.get('/results', { adapter: offline });
    expect(response.data).toEqual({ data: ['private-a'] });
  });

  it('does not cache private responses for guests', async () => {
    useAuthStore.getState().logout();
    const adapter: AxiosAdapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: ['secret'],
    });
    await apiClient.get('/results', { adapter });
    await expect(apiClient.get('/results', { adapter: offline })).rejects.toThrow('Network Error');
  });

  it('rejects late responses from a session that has ended instead of caching them', async () => {
    let resolve!: (value: AxiosResponse) => void;
    let started!: () => void;
    const ready = new Promise<void>((done) => {
      started = done;
    });
    const adapter: AxiosAdapter = (config) =>
      new Promise((done) => {
        resolve = (value) => done({ ...value, config });
        started();
      });
    const request = apiClient.get('/results', { adapter });
    await ready;
    useAuthStore.getState().logout();
    resolve({ data: ['private-a'], status: 200, headers: {}, statusText: 'OK' } as AxiosResponse);
    await expect(request).rejects.toThrow('Session changed');
    expect(await getCachedData(key('a'))).toBeNull();
  });

  it('does not queue or automatically retry failed writes', async () => {
    const adapter = vi.fn(offline);
    await expect(apiClient.post('/payments', { amount: 100 }, { adapter })).rejects.toThrow('Network Error');
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(await getPendingActions()).toEqual([]);
  });
});
