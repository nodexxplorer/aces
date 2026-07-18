package service

import (
	"context"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/shopspring/decimal"
)

type CGPAService struct {
	store db.Querier
}

func NewCGPAService(store db.Querier) *CGPAService {
	return &CGPAService{store: store}
}

func (s *CGPAService) GetSettings(ctx context.Context) (interface{}, error) {
	cgpaRules, err := s.store.GetCgpaRules(ctx)
	if err != nil {
		return nil, err
	}

	standingRules, err := s.store.GetAcademicStandingRules(ctx)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"cgpa_rules":     cgpaRules,
		"standing_rules": standingRules,
	}, nil
}

type CGPARuleInput struct {
	MinScore   float64
	MaxScore   float64
	Grade      string
	GradePoint float64
}

type StandingRuleInput struct {
	MinCgpa  float64
	MaxCgpa  float64
	Standing string
}

type UpdateCGPASettingsInput struct {
	CgpaRules     []CGPARuleInput
	StandingRules []StandingRuleInput
}

func (s *CGPAService) UpdateSettings(ctx context.Context, input UpdateCGPASettingsInput) error {
	for _, rule := range input.CgpaRules {
		_, err := s.store.CreateCgpaRule(ctx, db.CreateCgpaRuleParams{
			MinScore:   decimal.NewFromFloat(rule.MinScore),
			MaxScore:   decimal.NewFromFloat(rule.MaxScore),
			Grade:      rule.Grade,
			GradePoint: decimal.NewFromFloat(rule.GradePoint),
			IsActive:   true,
		})
		if err != nil {
			return err
		}
	}

	for _, rule := range input.StandingRules {
		_, err := s.store.CreateAcademicStandingRule(ctx, db.CreateAcademicStandingRuleParams{
			MinCgpa:  decimal.NewFromFloat(rule.MinCgpa),
			MaxCgpa:  decimal.NewFromFloat(rule.MaxCgpa),
			Standing: rule.Standing,
			IsActive: true,
		})
		if err != nil {
			return err
		}
	}

	return nil
}
