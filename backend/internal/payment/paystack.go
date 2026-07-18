package payment

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type PaystackClient struct {
	secretKey string
	publicKey string
	client    *http.Client
}

func NewPaystackClient(secretKey, publicKey string) *PaystackClient {
	return &PaystackClient{
		secretKey: secretKey,
		publicKey: publicKey,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

type InitPaymentRequest struct {
	Email       string   `json:"email"`
	Amount      int64    `json:"amount"` // in kobo (e.g. 10000 kobo = 100 NGN)
	Reference   string   `json:"reference,omitempty"`
	CallbackURL string   `json:"callback_url,omitempty"`
	Metadata    Metadata `json:"metadata,omitempty"`
}

type Metadata map[string]interface{}

type InitPaymentResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		AuthorizationURL string `json:"authorization_url"`
		AccessCode       string `json:"access_code"`
		Reference        string `json:"reference"`
	} `json:"data"`
}

type VerifyPaymentResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		ID           int64     `json:"id"`
		Domain       string    `json:"domain"`
		Status       string    `json:"status"`
		Reference    string    `json:"reference"`
		Amount       int64     `json:"amount"`
		GatewayResponse string `json:"gateway_response"`
		PaidAt       string    `json:"paid_at"`
		CreatedAt    string    `json:"created_at"`
		Channel      string    `json:"channel"`
		Currency     string    `json:"currency"`
		Metadata     Metadata  `json:"metadata"`
	} `json:"data"`
}

func (c *PaystackClient) InitializePayment(req InitPaymentRequest) (*InitPaymentResponse, error) {
	if strings.HasPrefix(c.secretKey, "sk_test_mock_") {
		// Mock response
		resp := &InitPaymentResponse{
			Status:  true,
			Message: "Authorization URL created (mock)",
		}
		ref := req.Reference
		if ref == "" {
			ref = fmt.Sprintf("mock_ref_%d", time.Now().UnixNano())
		}
		resp.Data.AuthorizationURL = "https://checkout.paystack.com/mock-checkout/" + ref
		resp.Data.AccessCode = "mock_access_code_xyz"
		resp.Data.Reference = ref
		return resp, nil
	}

	url := "https://api.paystack.co/transaction/initialize"
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.secretKey)
	httpReq.Header.Set("Content-Type", "application/json")

	httpResp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK && httpResp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("paystack returned status code %d", httpResp.StatusCode)
	}

	var resp InitPaymentResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&resp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if !resp.Status {
		return nil, errors.New("paystack initialization failed: " + resp.Message)
	}

	return &resp, nil
}

func (c *PaystackClient) VerifyPayment(reference string) (*VerifyPaymentResponse, error) {
	if strings.HasPrefix(c.secretKey, "sk_test_mock_") {
		// Mock response
		resp := &VerifyPaymentResponse{
			Status:  true,
			Message: "Verification successful (mock)",
		}
		resp.Data.Status = "success"
		resp.Data.Reference = reference
		resp.Data.Amount = 500000 // 5000 NGN
		resp.Data.GatewayResponse = "Approved"
		resp.Data.PaidAt = time.Now().Format(time.RFC3339)
		resp.Data.Currency = "NGN"
		return resp, nil
	}

	url := fmt.Sprintf("https://api.paystack.co/transaction/verify/%s", reference)
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.secretKey)

	httpResp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("paystack returned status code %d", httpResp.StatusCode)
	}

	var resp VerifyPaymentResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&resp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if !resp.Status {
		return nil, errors.New("paystack verification failed: " + resp.Message)
	}

	return &resp, nil
}
