import apiClient, { unwrap } from './client';
import type { SkillListing, TradeOffer, SkillRating, SkillCategory, UserReputation } from '../types';

// --- Categories ---
export const getSkillCategories = async () => {
  const res = await apiClient.get('/skills-trade/categories');
  return unwrap<SkillCategory[]>(res);
};

// --- Skill Listings ---
export const getSkillListings = async (params?: { categoryId?: string; level?: string; search?: string }) => {
  const res = await apiClient.get('/skills-trade/listings', { params });
  return unwrap<SkillListing[]>(res);
};

export const getMySkillListings = async (userId: string) => {
  const res = await apiClient.get(`/skills-trade/listings/user/${userId}`);
  return unwrap<SkillListing[]>(res);
};

export const getSkillListing = async (listingId: string) => {
  const res = await apiClient.get(`/skills-trade/listings/${listingId}`);
  return unwrap<SkillListing>(res);
};

export const createSkillListing = async (payload: {
  category_id: string;
  title: string;
  description?: string;
  skill_level: string;
  price?: number;
  is_free?: boolean;
  barter_available?: boolean;
  barter_description?: string;
  portfolio_url?: string;
}) => {
  const res = await apiClient.post('/skills-trade/listings', payload);
  return unwrap<SkillListing>(res);
};

export const updateSkillListing = async (listingId: string, payload: {
  title: string;
  description?: string;
  skill_level: string;
  price?: number;
  is_free?: boolean;
  barter_available?: boolean;
  barter_description?: string;
  portfolio_url?: string;
  is_active?: boolean;
}) => {
  const res = await apiClient.put(`/skills-trade/listings/${listingId}`, payload);
  return unwrap<SkillListing>(res);
};

export const deleteSkillListing = async (listingId: string) => {
  await apiClient.delete(`/skills-trade/listings/${listingId}`);
};

// --- Trade Offers ---
export const getMyTradeOffers = async () => {
  const res = await apiClient.get('/skills-trade/trades');
  return unwrap<TradeOffer[]>(res);
};

export const createTradeOffer = async (payload: {
  to_user_id: string;
  offered_skill_id: string;
  requested_skill_id?: string;
  message?: string;
  price_offered?: number;
  is_barter?: boolean;
}) => {
  const res = await apiClient.post('/skills-trade/trades', payload);
  return unwrap<TradeOffer>(res);
};

export const updateTradeStatus = async (tradeId: string, status: string) => {
  const res = await apiClient.put(`/skills-trade/trades/${tradeId}`, { status });
  return unwrap<TradeOffer>(res);
};

// --- Ratings ---
export const submitRating = async (payload: {
  trade_id: string;
  rated_user_id: string;
  rating: number;
  review?: string;
}) => {
  const res = await apiClient.post('/skills-trade/ratings', payload);
  return unwrap<SkillRating>(res);
};

export const listUserRatings = async (userId: string) => {
  const res = await apiClient.get(`/skills-trade/ratings/user/${userId}`);
  return unwrap<SkillRating[]>(res);
};

export const getUserReputation = async (userId: string) => {
  const res = await apiClient.get(`/skills-trade/reputation/user/${userId}`);
  return unwrap<UserReputation>(res);
};
