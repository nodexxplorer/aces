package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/aces/backend/internal/config"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
)

type AIService struct {
	store  db.Querier
	config *config.Config
	client *http.Client
}

// Gemini's generateContent request/response shapes. Unlike OpenAI, the
// system prompt is a separate top-level field (not a "system" message in the
// list), and conversation turns use "user"/"model" roles instead of
// "user"/"assistant".
type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

// geminiThinkingConfig disables Gemini 2.5's default "thinking" pass for
// requests where it's pure overhead — its invisible reasoning tokens count
// against MaxOutputTokens, and for a short one-shot task like the birthday
// message below, thinking consumed the entire budget before any visible
// output, truncating the reply to a couple of words every time.
type geminiThinkingConfig struct {
	ThinkingBudget int `json:"thinkingBudget"`
}

type geminiGenerationConfig struct {
	Temperature     float64               `json:"temperature,omitempty"`
	MaxOutputTokens int                   `json:"maxOutputTokens,omitempty"`
	ThinkingConfig  *geminiThinkingConfig `json:"thinkingConfig,omitempty"`
}

type geminiRequest struct {
	Contents          []geminiContent         `json:"contents"`
	SystemInstruction *geminiContent          `json:"systemInstruction,omitempty"`
	GenerationConfig  *geminiGenerationConfig `json:"generationConfig,omitempty"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []geminiPart `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type ChatbotResponse struct {
	Reply          string   `json:"reply"`
	Confidence     float64  `json:"confidence"`
	ModelUsed      string   `json:"model_used"`
	ResponseTimeMs int      `json:"response_time_ms"`
	Suggestions    []string `json:"suggestions,omitempty"`
}

type QuickAction struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	Query string `json:"query"`
}

func NewAIService(store db.Querier, cfg *config.Config) *AIService {
	return &AIService{
		store:  store,
		config: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *AIService) queries() *db.Queries {
	return s.store.(*db.Queries)
}

var quickActions = []QuickAction{
	{ID: "grades", Label: "My Grades", Icon: "📊", Query: "What are my current grades?"},
	{ID: "dues", Label: "Pay Dues", Icon: "💰", Query: "How much do I owe in dues?"},
	{ID: "mentor", Label: "Find Mentor", Icon: "👥", Query: "How do I connect with an alumni mentor?"},
	{ID: "resources", Label: "Study Resources", Icon: "📚", Query: "Where can I find study materials?"},
	{ID: "help", Label: "Help", Icon: "🆘", Query: "How do I use ACES Zone?"},
}

func (s *AIService) GetQuickActions() []QuickAction {
	return quickActions
}

func (s *AIService) Chat(ctx context.Context, userID uuid.UUID, message string, sessionID string) (*ChatbotResponse, error) {
	start := time.Now()

	if sessionID == "" {
		sessionID = uuid.New().String()
	}

	settings, _ := s.queries().GetOrCreateAISettings(ctx, userID)
	if settings.ChatbotEnabled != nil && !*settings.ChatbotEnabled {
		return &ChatbotResponse{
			Reply:      "AI Assistant is currently disabled in your settings. You can re-enable it from Settings > AI Preferences.",
			Confidence: 1.0,
			ModelUsed:  "disabled",
		}, nil
	}

	count, _ := s.queries().GetTodayInteractionCount(ctx, userID)
	if count >= 500 {
		return &ChatbotResponse{
			Reply:      "You've reached the daily limit of 200 AI interactions. Please try again tomorrow.",
			Confidence: 1.0,
			ModelUsed:  "rate_limited",
		}, nil
	}

	response := s.handleWithRules(ctx, userID, message)

	if response == nil && s.config.GeminiApiKey != "" {
		response = s.handleWithLLM(ctx, userID, message, sessionID)
	}

	if response == nil {
		response = &ChatbotResponse{
			Reply: "I'm sorry, I don't understand that question yet. You can ask me about schedules, grades, dues, courses, mentorship, or general ACES Zone help. Type 'help' for a list of topics.",
			Suggestions: []string{
				"How do I register for courses?",
				"When are my exams?",
				"How do I pay my dues?",
			},
		}
		response.Confidence = 0.1
		response.ModelUsed = "fallback"
	}

	response.ResponseTimeMs = int(time.Since(start).Milliseconds())

	conf := response.Confidence
	modelStr := response.ModelUsed
	respMs := int32(response.ResponseTimeMs)

	_, _ = s.queries().CreateAIInteraction(ctx, db.CreateAIInteractionParams{
		UserID:          userID,
		Feature:         db.AiFeatureChatbot,
		SessionID:       &sessionID,
		InputText:       message,
		OutputText:      response.Reply,
		ConfidenceScore: &conf,
		ModelUsed:       &modelStr,
		ResponseTimeMs:  &respMs,
	})

	return response, nil
}

func (s *AIService) handleWithRules(_ context.Context, _ uuid.UUID, message string) *ChatbotResponse {
	lower := strings.ToLower(strings.TrimSpace(message))

	type ruleMatch struct {
		keywords []string
		handler  func() *ChatbotResponse
	}

	rules := []ruleMatch{
		{
			keywords: []string{"hello", "hi ", "hey", "good morning", "good afternoon", "good evening"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Hello! I'm your ACES Assistant. I can help you with grades, dues, courses, mentorship, and more. What would you like to know?",
					Confidence:  0.95,
					ModelUsed:   "rule_based",
					Suggestions: []string{"Check my grades", "How to pay dues"},
				}
			},
		},
		{
			keywords: []string{"help", "what can you do", "features", "commands"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply: "Here's what I can help you with:\n\n" +
						"📊 **Grades** — Check your results and GPA\n" +
						"💰 **Dues** — View and pay departmental dues\n" +
						"📚 **Courses** — Course registration and info\n" +
						"👥 **Mentorship** — Connect with alumni mentors\n" +
						"💼 **Jobs** — Browse job opportunities\n" +
						"📋 **Complaints** — Submit or track complaints\n" +
						"🏫 **Campus** — Find study groups and events\n\n" +
						"Just ask me anything!",
					Confidence: 0.95,
					ModelUsed:  "rule_based",
				}
			},
		},
		{
			keywords: []string{"grade", "result", "gpa", "cgpa", "marks", "score"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "You can view your grades on the Results page. Your GPA and CGPA are displayed in your academic profile. Need help understanding your results?",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View my results", "Check academic standing"},
				}
			},
		},
		{
			keywords: []string{"pay", "dues", "payment", "fee", "owes", "balance", "how much"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "You can view your payment status and make payments on the Payments page. It shows your transaction history and any outstanding dues. Need help with anything else?",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View payment history", "Check defaulters list"},
				}
			},
		},
		{
			keywords: []string{"register", "course registration", "add course", "drop course"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Course registration is available during the registration window. Go to Course Registration to add or drop courses. Make sure you meet all prerequisites!",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"Check prerequisites", "View registered courses"},
				}
			},
		},
		{
			keywords: []string{"mentor", "mentorship", "alumni", "connect"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "You can browse available alumni mentors on the Mentorship Hub. Request a connection and the mentor will review your request. It's a great way to get career guidance!",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View my mentorship requests", "Browse alumni network"},
				}
			},
		},
		{
			keywords: []string{"job", "internship", "vacancy", "employment", "career"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Check out the Job Board for job postings from alumni and industry partners. You can filter by location, type, and experience level. Apply directly through the platform!",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View recommended jobs", "Update my resume"},
				}
			},
		},
		{
			keywords: []string{"complaint", "report issue", "problem", "bug", "not working"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "You can submit a complaint on the Complaints page. Describe the issue and it will be routed to the appropriate department. You can also track the status of existing complaints.",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"Track my complaint", "Contact support"},
				}
			},
		},
		{
			keywords: []string{"attendance", "present", "absent", "check in"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Attendance is managed by your Class Rep. Check-in is available during live sessions via QR code scan or manual entry. View your attendance history on the Attendance page.",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View attendance history", "Report attendance issue"},
				}
			},
		},
		{
			keywords: []string{"carryover", "carry over", "failed course"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Carryover courses appear on your Results page. You'll need to register for them again during the next registration window. Check with your HOD if you have questions about your academic standing.",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View my results", "Check academic standing"},
				}
			},
		},
		{
			keywords: []string{"event", "upcoming event", "hackathon", "workshop"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Check the Campus Connect Events page for upcoming departmental events, workshops, and hackshops. You can register and RSVP directly!",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View upcoming events", "View my registrations"},
				}
			},
		},
		{
			keywords: []string{"secretary", "class rep", "department"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Your Class Rep is the first point of contact for class-level issues. For departmental matters, reach out to the HOD or use the Campus Connect messaging feature.",
					Confidence:  0.8,
					ModelUsed:   "rule_based",
					Suggestions: []string{"Message class rep", "Contact HOD office"},
				}
			},
		},
		{
			keywords: []string{"deadline", "due date", "when is"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Deadlines vary by course and semester. Check the Announcements page for the latest deadlines from lecturers and administration. You can also check individual course pages.",
					Confidence:  0.75,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View announcements", "Check course deadlines"},
				}
			},
		},
	}

	for _, rule := range rules {
		for _, keyword := range rule.keywords {
			if strings.Contains(lower, keyword) {
				return rule.handler()
			}
		}
	}

	return nil
}

func (s *AIService) handleWithLLM(ctx context.Context, userID uuid.UUID, message string, sessionID string) *ChatbotResponse {
	sessID := sessionID
	history, _ := s.queries().ListAIInteractionsBySession(ctx, db.ListAIInteractionsBySessionParams{
		SessionID: &sessID,
		UserID:    userID,
	})

	systemPrompt := `You are ACES Assistant, the AI helper for ACES Zone — the Computer Engineering Students' platform at University of Uyo, Nigeria.

Your role is to help students with:
- Academic matters (grades, courses, registration)
- Administrative tasks (dues, payments, complaints)
- Campus life (events, study groups, announcements)
- Career support (jobs, mentorship, alumni network)
- General ACES Zone platform navigation

Rules:
- Be concise and helpful (2-4 sentences max per response)
- Use a friendly, professional tone
- If you don't know something specific, direct them to the relevant page or HOD office
- Never make up specific dates, grades, or financial amounts
- Format responses with simple markdown when helpful
- Suggest 2-3 relevant quick actions when appropriate`

	contents := make([]geminiContent, 0, len(history)*2+1)
	for _, h := range history {
		if h.InputText != "" {
			contents = append(contents, geminiContent{Role: "user", Parts: []geminiPart{{Text: h.InputText}}})
		}
		if h.OutputText != "" {
			contents = append(contents, geminiContent{Role: "model", Parts: []geminiPart{{Text: h.OutputText}}})
		}
	}
	contents = append(contents, geminiContent{Role: "user", Parts: []geminiPart{{Text: message}}})

	payload := geminiRequest{
		Contents:          contents,
		SystemInstruction: &geminiContent{Parts: []geminiPart{{Text: systemPrompt}}},
		GenerationConfig: &geminiGenerationConfig{
			Temperature:     0.7,
			MaxOutputTokens: 300,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", s.config.GeminiModel, s.config.GeminiApiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var chatResp geminiResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return nil
	}

	if resp.StatusCode != http.StatusOK {
		if chatResp.Error != nil {
			log.Printf("[ai-service] Gemini request failed (%d): %s", resp.StatusCode, chatResp.Error.Message)
		}
		return nil
	}

	if len(chatResp.Candidates) == 0 || len(chatResp.Candidates[0].Content.Parts) == 0 {
		return nil
	}

	reply := chatResp.Candidates[0].Content.Parts[0].Text
	if reply == "" {
		return nil
	}

	return &ChatbotResponse{
		Reply:      reply,
		Confidence: 0.85,
		ModelUsed:  fmt.Sprintf("llm_%s", s.config.GeminiModel),
	}
}

// GenerateBirthdayMessage asks Gemini for a one-off, warm birthday message
// for a named student — a single-shot call with no chat history/session,
// unlike handleWithLLM. Returns ok=false (never an error) whenever a
// message can't be produced for any reason — no API key configured, a
// failed/timed-out request, or an empty reply — so the caller can silently
// fall back to a static message; a birthday greeting should never fail to
// send just because the LLM had a bad moment.
func (s *AIService) GenerateBirthdayMessage(ctx context.Context, firstName string) (string, bool) {
	if s.config.GeminiApiKey == "" {
		return "", false
	}

	prompt := fmt.Sprintf(
		"Write one short, warm, upbeat birthday message (1-2 sentences, under 220 characters) for a university student named %s, from their department's ACES Zone platform. Vary the wording and tone each time you're asked this — don't fall back to a generic template. No hashtags. You may use up to one emoji. Reply with ONLY the message text, nothing else.",
		firstName,
	)

	payload := geminiRequest{
		Contents: []geminiContent{{Role: "user", Parts: []geminiPart{{Text: prompt}}}},
		GenerationConfig: &geminiGenerationConfig{
			Temperature:     1.0,
			MaxOutputTokens: 120,
			ThinkingConfig:  &geminiThinkingConfig{ThinkingBudget: 0},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", false
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", s.config.GeminiModel, s.config.GeminiApiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return "", false
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", false
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", false
	}

	var chatResp geminiResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", false
	}
	if resp.StatusCode != http.StatusOK {
		if chatResp.Error != nil {
			log.Printf("[ai-service] birthday message generation failed (%d): %s", resp.StatusCode, chatResp.Error.Message)
		}
		return "", false
	}
	if len(chatResp.Candidates) == 0 || len(chatResp.Candidates[0].Content.Parts) == 0 {
		return "", false
	}
	// MAX_TOKENS means the reply got cut off mid-sentence (this is exactly
	// how the thinking-budget issue above first surfaced — a truncated
	// two-word reply). A birthday message that stops halfway looks broken,
	// so treat anything but a clean STOP as a failure and fall back.
	if reason := chatResp.Candidates[0].FinishReason; reason != "" && reason != "STOP" {
		log.Printf("[ai-service] birthday message generation stopped early (%s), falling back", reason)
		return "", false
	}

	reply := strings.TrimSpace(chatResp.Candidates[0].Content.Parts[0].Text)
	if len(reply) < 15 {
		return "", false
	}
	return reply, true
}

// GenerateStudyPlan asks Gemini for a proactive week-by-week study
// schedule from a student's actual courses and upcoming task due dates —
// distinct from the reactive Q&A chatbot above. Same failure posture as
// GenerateBirthdayMessage: no API key, a non-STOP finish reason (cut off
// mid-plan), or a suspiciously short reply all return ok=false rather than
// showing a broken partial plan.
func (s *AIService) GenerateStudyPlan(ctx context.Context, courses []string, tasks []string) (string, bool) {
	if s.config.GeminiApiKey == "" {
		return "", false
	}

	coursesText := "(none registered this semester)"
	if len(courses) > 0 {
		coursesText = strings.Join(courses, "\n")
	}
	tasksText := "(no tasks logged yet)"
	if len(tasks) > 0 {
		tasksText = strings.Join(tasks, "\n")
	}

	prompt := fmt.Sprintf(
		`You are helping a university student plan their studying. Here is their current semester:

Registered courses:
%s

Upcoming tasks/deadlines (title and due date):
%s

Write a realistic, encouraging week-by-week study plan covering the next 2-3 weeks that balances all the courses above and prioritizes the listed deadlines. Use short markdown headings per week and brief bullet points under each — no long paragraphs. Keep the whole plan under 350 words. Reply with ONLY the plan itself, no preamble like "Here is your plan".`,
		coursesText, tasksText,
	)

	payload := geminiRequest{
		Contents: []geminiContent{{Role: "user", Parts: []geminiPart{{Text: prompt}}}},
		GenerationConfig: &geminiGenerationConfig{
			Temperature:     0.8,
			MaxOutputTokens: 700,
			ThinkingConfig:  &geminiThinkingConfig{ThinkingBudget: 0},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", false
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", s.config.GeminiModel, s.config.GeminiApiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return "", false
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", false
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", false
	}

	var chatResp geminiResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", false
	}
	if resp.StatusCode != http.StatusOK {
		if chatResp.Error != nil {
			log.Printf("[ai-service] study plan generation failed (%d): %s", resp.StatusCode, chatResp.Error.Message)
		}
		return "", false
	}
	if len(chatResp.Candidates) == 0 || len(chatResp.Candidates[0].Content.Parts) == 0 {
		return "", false
	}
	if reason := chatResp.Candidates[0].FinishReason; reason != "" && reason != "STOP" {
		log.Printf("[ai-service] study plan generation stopped early (%s), falling back", reason)
		return "", false
	}

	reply := strings.TrimSpace(chatResp.Candidates[0].Content.Parts[0].Text)
	if len(reply) < 40 {
		return "", false
	}
	return reply, true
}

func (s *AIService) Feedback(ctx context.Context, userID, interactionID uuid.UUID, feedback string, accurate *bool) error {
	interaction, err := s.queries().GetAIInteraction(ctx, interactionID)
	if err != nil {
		return err
	}
	if interaction.UserID != userID {
		return fmt.Errorf("interaction not found")
	}
	return s.queries().UpdateAIInteractionFeedback(ctx, db.UpdateAIInteractionFeedbackParams{
		ID:           interactionID,
		UserFeedback: &feedback,
		WasAccurate:  accurate,
	})
}

func (s *AIService) GetHistory(ctx context.Context, userID uuid.UUID, sessionID string, limit int) ([]db.AiInteraction, error) {
	if sessionID != "" {
		return s.queries().ListAIInteractionsBySession(ctx, db.ListAIInteractionsBySessionParams{
			SessionID: &sessionID,
			UserID:    userID,
		})
	}
	return s.queries().ListAIInteractionsByUser(ctx, db.ListAIInteractionsByUserParams{
		UserID: userID,
		Limit:  int32(limit),
		Offset: 0,
	})
}

func (s *AIService) GetSettings(ctx context.Context, userID uuid.UUID) (db.AiUserSetting, error) {
	return s.queries().GetOrCreateAISettings(ctx, userID)
}

func (s *AIService) UpdateSettings(ctx context.Context, userID uuid.UUID, chatbot *bool, personalization *bool, faceRec *bool, consent *bool, lang *string) error {
	return s.queries().UpdateAISettings(ctx, db.UpdateAISettingsParams{
		UserID:                 userID,
		ChatbotEnabled:         chatbot,
		PersonalizationEnabled: personalization,
		FaceRecognitionEnabled: faceRec,
		DataCollectionConsent:  consent,
		PreferredLanguage:      lang,
	})
}
