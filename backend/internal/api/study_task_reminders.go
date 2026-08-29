package api

import (
	"context"
	"log"
	"time"
)

// RunStudyTaskReminderScheduler checks once immediately (covering a server
// restart that missed a reminder's exact moment) and then on a 5-minute
// tick for study tasks whose reminder_at has arrived, notifying the owning
// student via the existing notifyUser pipeline. Stops when ctx is
// cancelled (server shutdown). A 5-minute tick (vs. the birthday
// scheduler's hourly one) because a reminder is tied to a specific time of
// day, not just a date — the same free-tier caveat from RunBirthdayScheduler
// applies here too.
func (server *Server) RunStudyTaskReminderScheduler(ctx context.Context) {
	server.sendDueStudyTaskReminders(ctx)

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			server.sendDueStudyTaskReminders(ctx)
		}
	}
}

func (server *Server) sendDueStudyTaskReminders(ctx context.Context) {
	tasks, err := server.store.ListDueStudyTaskReminders(ctx)
	if err != nil {
		log.Printf("[study-task-reminder] failed to list due reminders: %v", err)
		return
	}

	if server.notificationsFull == nil {
		return
	}

	for _, t := range tasks {
		// Sent synchronously (unlike the fire-and-forget notifyUser helper
		// used for request-triggered notifications) so ClearStudyTaskReminder
		// below only runs after a *confirmed* send — otherwise a failed
		// insert would still clear reminder_at and silently skip the
		// reminder for good.
		_, err := server.notificationsFull.CreateAndPush(
			ctx,
			t.UserID,
			"general",
			"system",
			"normal",
			"Task Reminder: "+t.Title,
			"Your task \""+t.Title+"\" needs your attention.",
			"/study-planner",
			"View Task",
			nil, nil, nil,
			nil,
		)
		if err != nil {
			log.Printf("[study-task-reminder] failed to send reminder for task %s: %v", t.ID, err)
			continue
		}
		if err := server.store.ClearStudyTaskReminder(ctx, t.ID); err != nil {
			log.Printf("[study-task-reminder] failed to clear reminder for task %s: %v", t.ID, err)
		}
	}
}
