package service

import "github.com/shopspring/decimal"

// ScoreToGrade converts a total score (0-100) into its letter grade and grade
// point. This is the single canonical mapping used both when a lecturer's
// entered score is turned into a real result, and when simulating a
// hypothetical CGPA — keeping both paths in agreement.
func ScoreToGrade(total decimal.Decimal) (string, float64) {
	t := total.InexactFloat64()
	switch {
	case t >= 70:
		return "A", 5.0
	case t >= 60:
		return "B", 4.0
	case t >= 50:
		return "C", 3.0
	case t >= 45:
		return "D", 2.0
	case t >= 40:
		return "E", 1.0
	default:
		return "F", 0.0
	}
}
