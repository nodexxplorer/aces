import apiClient from './client';
import type { SkillListing, TradeOffer, SkillRating, SkillCategory, UserReputation } from '../types';

// --- Categories ---
export const getSkillCategories = async () => {
  const { data } = await apiClient.get<{ data: SkillCategory[] }>('/skills-trade/categories');
  return data.data;
};

// --- Skill Listings ---
export const getSkillListings = async (params?: { categoryId?: string; level?: string; search?: string }) => {
  const { data } = await apiClient.get<{ data: SkillListing[] }>('/skills-trade/listings', { params });
  return data.data;
};

export const getMySkillListings = async () => {
  const { data } = await apiClient.get<{ data: SkillListing[] }>('/skills-trade/listings/my');
  return data.data;
};

export const createSkillListing = async (payload: Omit<SkillListing, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'user'>) => {
  const { data } = await apiClient.post<{ data: SkillListing }>('/skills-trade/listings', payload);
  return data.data;
};

export const updateSkillListing = async (listingId: string, payload: Partial<SkillListing>) => {
  const { data } = await apiClient.put<{ data: SkillListing }>(`/skills-trade/listings/${listingId}`, payload);
  return data.data;
};

export const deleteSkillListing = async (listingId: string) => {
  await apiClient.delete(`/skills-trade/listings/${listingId}`);
};

// --- Trade Offers ---
export const getTradeOffers = async () => {
  const { data } = await apiClient.get<{ data: TradeOffer[] }>('/skills-trade/offers');
  return data.data;
};

export const getMyTradeOffers = async () => {
  const { data } = await apiClient.get<{ data: TradeOffer[] }>('/skills-trade/offers/my');
  return data.data;
};

export const createTradeOffer = async (payload: Pick<TradeOffer, 'recipientId' | 'offererSkillId' | 'recipientSkillId' | 'offererDescription' | 'recipientDescription'>) => {
  const { data } = await apiClient.post<{ data: TradeOffer }>('/skills-trade/offers', payload);
  return data.data;
};

export const respondToTradeOffer = async (offerId: string, accept: boolean) => {
  const { data } = await apiClient.post<{ data: TradeOffer }>(`/skills-trade/offers/${offerId}/respond`, { accept });
  return data.data;
};

export const completeTradeOffer = async (offerId: string) => {
  const { data } = await apiClient.post<{ data: TradeOffer }>(`/skills-trade/offers/${offerId}/complete`);
  return data.data;
};

// --- Ratings ---
export const submitRating = async (tradeId: string, rateeId: string, rating: number, review?: string) => {
  const { data } = await apiClient.post<{ data: SkillRating }>('/skills-trade/ratings', { tradeId, rateeId, rating, review });
  return data.data;
};

export const getUserReputation = async (userId: string) => {
  const { data } = await apiClient.get<{ data: UserReputation }>(`/skills-trade/reputation/${userId}`);
  return data.data;
};
