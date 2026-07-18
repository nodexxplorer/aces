package service

import (
	"context"
	"errors"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type SkillsTradeService struct {
	store db.Querier
}

func NewSkillsTradeService(store db.Querier) *SkillsTradeService {
	return &SkillsTradeService{store: store}
}

// Categories
func (s *SkillsTradeService) ListCategories(ctx context.Context) ([]db.SkillCategory, error) {
	return s.store.ListSkillCategories(ctx)
}

func (s *SkillsTradeService) CreateCategory(ctx context.Context, params db.CreateSkillCategoryParams) (db.SkillCategory, error) {
	return s.store.CreateSkillCategory(ctx, params)
}

// Skill Listings
func (s *SkillsTradeService) CreateListing(ctx context.Context, params db.CreateSkillListingParams) (db.SkillListing, error) {
	return s.store.CreateSkillListing(ctx, params)
}

func (s *SkillsTradeService) GetListing(ctx context.Context, id uuid.UUID) (db.GetSkillListingRow, error) {
	return s.store.GetSkillListing(ctx, id)
}

func (s *SkillsTradeService) ListListings(ctx context.Context, limit, offset int32) ([]db.ListSkillListingsRow, error) {
	return s.store.ListSkillListings(ctx, db.ListSkillListingsParams{Limit: limit, Offset: offset})
}

func (s *SkillsTradeService) ListUserListings(ctx context.Context, userID uuid.UUID) ([]db.ListUserSkillListingsRow, error) {
	return s.store.ListUserSkillListings(ctx, userID)
}

func (s *SkillsTradeService) UpdateListing(ctx context.Context, params db.UpdateSkillListingParams) (db.SkillListing, error) {
	return s.store.UpdateSkillListing(ctx, params)
}

func (s *SkillsTradeService) DeleteListing(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteSkillListing(ctx, id)
}

// Trade Offers
func (s *SkillsTradeService) CreateTradeOffer(ctx context.Context, params db.CreateTradeOfferParams) (db.TradeOffer, error) {
	return s.store.CreateTradeOffer(ctx, params)
}

func (s *SkillsTradeService) GetTradeOffer(ctx context.Context, id uuid.UUID) (db.TradeOffer, error) {
	return s.store.GetTradeOffer(ctx, id)
}

func (s *SkillsTradeService) ListUserTrades(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]db.TradeOffer, error) {
	return s.store.ListUserTradeOffers(ctx, db.ListUserTradeOffersParams{FromUserID: userID, Limit: limit, Offset: offset})
}

func (s *SkillsTradeService) UpdateTradeStatus(ctx context.Context, id uuid.UUID, status string) (db.TradeOffer, error) {
	return s.store.UpdateTradeOfferStatus(ctx, db.UpdateTradeOfferStatusParams{ID: id, Status: db.TradeStatus(status)})
}

// Ratings
func (s *SkillsTradeService) RateTrade(ctx context.Context, params db.CreateSkillRatingParams) (db.SkillRating, error) {
	trade, err := s.store.GetTradeOffer(ctx, params.TradeID)
	if err != nil {
		return db.SkillRating{}, errors.New("trade not found")
	}
	if trade.Status != db.TradeStatusCompleted {
		return db.SkillRating{}, errors.New("can only rate completed trades")
	}

	rating, err := s.store.CreateSkillRating(ctx, params)
	if err != nil {
		return db.SkillRating{}, err
	}

	// Update user reputation
	s.recalculateReputation(ctx, params.RatedUserID)
	return rating, nil
}

func (s *SkillsTradeService) ListUserRatings(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]db.ListUserSkillRatingsRow, error) {
	return s.store.ListUserSkillRatings(ctx, db.ListUserSkillRatingsParams{RatedUserID: userID, Limit: limit, Offset: offset})
}

func (s *SkillsTradeService) GetReputation(ctx context.Context, userID uuid.UUID) (db.UserReputation, error) {
	return s.store.GetUserReputation(ctx, userID)
}

func (s *SkillsTradeService) recalculateReputation(ctx context.Context, userID uuid.UUID) {
	ratings, err := s.store.ListUserSkillRatings(ctx, db.ListUserSkillRatingsParams{RatedUserID: userID, Limit: 1000, Offset: 0})
	if err != nil {
		return
	}

	totalRatings := int32(len(ratings))
	var sum int32
	for _, r := range ratings {
		sum += r.Rating
	}

	avg := 0.0
	if totalRatings > 0 {
		avg = float64(sum) / float64(totalRatings)
	}

	_, _ = s.store.UpsertUserReputation(ctx, db.UpsertUserReputationParams{
		UserID:               userID,
		TotalRatings:         totalRatings,
		AverageRating:        decimal.NewFromFloat(avg),
		TotalTradesCompleted: totalRatings,
		ReputationScore:      decimal.NewFromFloat(avg * float64(totalRatings) / 10.0),
	})
}
