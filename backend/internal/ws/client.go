package ws

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
	maxChatLength  = 5000
)

type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	UserID uuid.UUID
	send   chan []byte
}

func NewClient(hub *Hub, conn *websocket.Conn, userID uuid.UUID) *Client {
	return &Client{
		hub:    hub,
		conn:   conn,
		UserID: userID,
		send:   make(chan []byte, 256),
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, rawMsg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[ws] unexpected close from %s: %v", c.UserID, err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			log.Printf("[ws] invalid message from %s: %v", c.UserID, err)
			continue
		}

		switch msg.Type {
		case TypeChat:
			c.handleChat(msg.Payload)
		case TypeGroupChat:
			c.handleGroupChat(msg.Payload)
		case TypeTyping:
			c.handleTyping(msg.Payload)
		default:
			log.Printf("[ws] unknown message type from %s: %s", c.UserID, msg.Type)
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleChat(payload json.RawMessage) {
	var chatMsg struct {
		To      uuid.UUID `json:"to"`
		Content string    `json:"content"`
	}
	if err := json.Unmarshal(payload, &chatMsg); err != nil {
		return
	}

	if chatMsg.To == c.UserID {
		return
	}

	chatMsg.Content = strings.TrimSpace(chatMsg.Content)
	if chatMsg.Content == "" || len(chatMsg.Content) > maxChatLength {
		return
	}

	outPayload, _ := json.Marshal(map[string]interface{}{
		"from":    c.UserID,
		"content": chatMsg.Content,
		"sent_at": time.Now(),
	})
	c.hub.SendToUser(chatMsg.To, TypeChat, json.RawMessage(outPayload))
}

func (c *Client) handleGroupChat(payload json.RawMessage) {
	var groupMsg struct {
		GroupID uuid.UUID `json:"group_id"`
		Content string    `json:"content"`
	}
	if err := json.Unmarshal(payload, &groupMsg); err != nil {
		return
	}

	groupMsg.Content = strings.TrimSpace(groupMsg.Content)
	if groupMsg.Content == "" || len(groupMsg.Content) > maxChatLength {
		return
	}

	if !c.hub.IsGroupMember(groupMsg.GroupID, c.UserID) {
		return
	}

	outPayload, _ := json.Marshal(map[string]interface{}{
		"from":     c.UserID,
		"group_id": groupMsg.GroupID,
		"content":  groupMsg.Content,
		"sent_at":  time.Now(),
	})
	c.hub.SendToGroup(groupMsg.GroupID, TypeGroupChat, json.RawMessage(outPayload))
}

func (c *Client) handleTyping(payload json.RawMessage) {
	var typingMsg struct {
		To uuid.UUID `json:"to"`
	}
	if err := json.Unmarshal(payload, &typingMsg); err != nil {
		return
	}

	if typingMsg.To == c.UserID {
		return
	}

	outPayload, _ := json.Marshal(map[string]interface{}{
		"from": c.UserID,
	})
	c.hub.SendToUser(typingMsg.To, TypeTyping, json.RawMessage(outPayload))
}
