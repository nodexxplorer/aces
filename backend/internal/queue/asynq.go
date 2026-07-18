package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
)

const (
	QueueCritical = "critical"
	QueueDefault  = "default"
	QueueLow      = "low"
)

// Task Types
const (
	TypeEmailWelcome        = "email:welcome"
	TypeEmailOnboarding      = "email:onboarding"
	TypePaymentVerification = "payment:verify"
	TypeAlumniEventReminder = "alumni:event_reminder"
)

type QueueClient struct {
	client *asynq.Client
}

func NewQueueClient(redisAddress, redisPassword string) *QueueClient {
	return &QueueClient{
		client: asynq.NewClient(asynq.RedisClientOpt{
			Addr:     redisAddress,
			Password: redisPassword,
		}),
	}
}

func (q *QueueClient) Close() error {
	return q.client.Close()
}

// Enqueue enqueues a new background task with a specific payload and option configurations
func (q *QueueClient) Enqueue(ctx context.Context, taskType string, payload interface{}, opts ...asynq.Option) (*asynq.TaskInfo, error) {
	bytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal task payload: %w", err)
	}

	task := asynq.NewTask(taskType, bytes)

	// Set default options if none are provided
	if len(opts) == 0 {
		opts = []asynq.Option{
			asynq.Queue(QueueDefault),
			asynq.MaxRetry(5),
			asynq.Timeout(10 * time.Minute),
		}
	}

	info, err := q.client.EnqueueContext(ctx, task, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to enqueue task: %w", err)
	}

	return info, nil
}

// EnqueueWithDelay enqueues a task to run after a specific duration
func (q *QueueClient) EnqueueWithDelay(ctx context.Context, taskType string, payload interface{}, delay time.Duration) (*asynq.TaskInfo, error) {
	return q.Enqueue(ctx, taskType, payload, 
		asynq.Queue(QueueDefault),
		asynq.MaxRetry(3),
		asynq.ProcessIn(delay),
	)
}
