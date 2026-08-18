package api

import (
	"context"
	"log"
	"math/rand"
	"time"
)

// birthdayMessages are the fallback when the AI service has no Gemini key
// configured or a generation call fails — a few warm variants so students
// who compare notes still don't all get the identical line.
var birthdayMessages = []string{
	"Wishing you an amazing day filled with joy, laughter, and everything you love. Here's to another year of growth and great memories at ACES Zone! 🎉",
	"Happy birthday! May this new year of your life bring you closer to every goal you're working toward — academic and beyond. Enjoy your day! 🎂",
	"On behalf of everyone at ACES Zone, happy birthday! Take today to celebrate how far you've come — we're glad to have you with us. 🥳",
}

// RunBirthdayScheduler checks once immediately (covering a server restart
// that missed the exact moment) and then on an hourly tick for students
// whose birthday is today, sending each a one-time notification+email via
// the existing notifyUser pipeline. Stops when ctx is cancelled (server
// shutdown).
//
// Caveat: this only fires while the process is actually running. A
// Render free-tier instance that's spun down from inactivity (see the
// dashboard warning surfaced earlier this session) won't wake itself up
// just to send a birthday greeting — an external cron hitting a protected
// endpoint, or Render's own Cron Jobs product, would be needed for that to
// be reliable on the free tier.
func (server *Server) RunBirthdayScheduler(ctx context.Context) {
	server.sendTodaysBirthdayGreetings(ctx)

	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			server.sendTodaysBirthdayGreetings(ctx)
		}
	}
}

func (server *Server) sendTodaysBirthdayGreetings(ctx context.Context) {
	students, err := server.store.ListTodaysBirthdays(ctx)
	if err != nil {
		log.Printf("[birthday] failed to list today's birthdays: %v", err)
		return
	}

	if server.notificationsFull == nil {
		return
	}

	for _, s := range students {
		message := birthdayMessages[rand.Intn(len(birthdayMessages))]
		if aiMsg, ok := server.ai.GenerateBirthdayMessage(ctx, s.FirstName); ok {
			message = aiMsg
		}
		// Sent synchronously (unlike the fire-and-forget notifyUser helper
		// used for request-triggered notifications) so MarkBirthdayGreeted
		// below only runs after a *confirmed* send — otherwise a failed
		// insert would still get marked as greeted and silently skip that
		// student for the rest of the year.
		_, err := server.notificationsFull.CreateAndPush(
			ctx,
			s.ID,
			"general",
			"birthday",
			"normal",
			"🎉 Happy Birthday, "+s.FirstName+"!",
			message,
			"/dashboard",
			"Go to Dashboard",
			nil, nil, nil,
			nil,
		)
		if err != nil {
			log.Printf("[birthday] failed to send greeting to %s: %v", s.ID, err)
			continue
		}
		if err := server.store.MarkBirthdayGreeted(ctx, s.ID); err != nil {
			log.Printf("[birthday] failed to mark %s as greeted: %v", s.ID, err)
		}
	}
}
