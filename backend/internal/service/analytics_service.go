package service

import (
	"context"

	db "github.com/aces/backend/internal/db/sql"
)

type AnalyticsService struct {
	store db.Querier
}

func NewAnalyticsService(store db.Querier) *AnalyticsService {
	return &AnalyticsService{store: store}
}

type DashboardStats struct {
	TotalUsers       int `json:"totalUsers"`
	TotalCourses     int `json:"totalCourses"`
	ActiveComplaints int `json:"activeComplaints"`
	PendingResults   int `json:"pendingResults"`
	TotalStudents    int `json:"students"`
	TotalResults     int `json:"results"`
	Complaints       int `json:"complaints"`
}

func (s *AnalyticsService) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	stats := &DashboardStats{}

	users, err := s.store.ListUsers(ctx, db.ListUsersParams{Limit: 1000, Offset: 0})
	if err == nil {
		stats.TotalUsers = len(users)
		stats.TotalStudents = len(users)
	}

	courses, err := s.store.ListCourses(ctx, db.ListCoursesParams{Limit: 1000, Offset: 0})
	if err == nil {
		stats.TotalCourses = len(courses)
	}

	complaints, err := s.store.ListComplaints(ctx)
	if err == nil {
		active := 0
		for _, c := range complaints {
			if string(c.Status) == "open" || string(c.Status) == "in_review" {
				active++
			}
		}
		stats.ActiveComplaints = active
		stats.Complaints = len(complaints)
	}

	return stats, nil
}

func (s *AnalyticsService) GetRecentUsers(ctx context.Context, limit int) ([]db.User, error) {
	users, err := s.store.ListUsers(ctx, db.ListUsersParams{Limit: int32(limit), Offset: 0})
	if err != nil {
		return nil, err
	}
	for i := range users {
		users[i].PasswordHash = ""
	}
	return users, nil
}

type ActivityItem struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Timestamp   string `json:"timestamp"`
}

func (s *AnalyticsService) GetRecentActivity(ctx context.Context) ([]ActivityItem, error) {
	items := []ActivityItem{}

	users, err := s.store.ListUsers(ctx, db.ListUsersParams{Limit: 10, Offset: 0})
	if err == nil {
		for _, u := range users {
			ts := ""
			if u.CreatedAt.Valid {
				ts = u.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00")
			}
			items = append(items, ActivityItem{
				ID:          u.ID.String(),
				Description: "New user registered: " + u.FullName + " (" + string(u.Role) + ")",
				Type:        "user_signup",
				Timestamp:   ts,
			})
		}
	}

	complaints, err := s.store.ListComplaints(ctx)
	if err == nil {
		for i := 0; i < len(complaints) && len(items) < 30; i++ {
			c := complaints[i]
			ts := ""
			if c.CreatedAt.Valid {
				ts = c.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00")
			}
			items = append(items, ActivityItem{
				ID:          c.ID.String(),
				Description: "Complaint filed: " + c.Subject,
				Type:        "complaint",
				Timestamp:   ts,
			})
		}
	}

	courses, err := s.store.ListCourses(ctx, db.ListCoursesParams{Limit: 5, Offset: 0})
	if err == nil {
		for _, co := range courses {
			ts := ""
			if co.CreatedAt.Valid {
				ts = co.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00")
			}
			items = append(items, ActivityItem{
				ID:          co.ID.String(),
				Description: "Course available: " + co.Code + " - " + co.Title,
				Type:        "course",
				Timestamp:   ts,
			})
		}
	}

	for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
		items[i], items[j] = items[j], items[i]
	}

	if len(items) > 20 {
		items = items[:20]
	}

	return items, nil
}

func (s *AnalyticsService) GetPerformanceTrend(ctx context.Context) (map[string]interface{}, error) {
	return map[string]interface{}{
		"description": "System operating normally",
		"status":      "healthy",
	}, nil
}
