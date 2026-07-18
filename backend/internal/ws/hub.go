package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/google/uuid"
)

// MessageType constants for WebSocket event routing
const (
	TypeChat         = "chat"
	TypeGroupChat    = "group_chat"
	TypeNotification = "notification"
	TypePresence     = "presence"
	TypeTyping       = "typing"
)

// Message represents a WebSocket message envelope
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	mu         sync.RWMutex
	clients    map[uuid.UUID]*Client       // userID -> client
	groups     map[uuid.UUID]map[uuid.UUID]bool // groupID -> set of userIDs
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMessage
}

// BroadcastMessage targets a specific user, group, or all clients
type BroadcastMessage struct {
	TargetUserID  *uuid.UUID      `json:"-"`
	TargetGroupID *uuid.UUID      `json:"-"`
	Broadcast     bool            `json:"-"` // if true, send to all
	Type          string          `json:"type"`
	Payload       json.RawMessage `json:"payload"`
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[uuid.UUID]*Client),
		groups:     make(map[uuid.UUID]map[uuid.UUID]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *BroadcastMessage, 256),
	}
}
// Register adds a client to the hub's registration channel
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Run starts the hub event loop. Must be called as a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.UserID] = client
			h.mu.Unlock()
			log.Printf("[ws] client connected: %s", client.UserID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.UserID]; ok {
				delete(h.clients, client.UserID)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("[ws] client disconnected: %s", client.UserID)

		case msg := <-h.broadcast:
			h.routeMessage(msg)
		}
	}
}

func (h *Hub) routeMessage(msg *BroadcastMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[ws] failed to marshal broadcast: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	if msg.TargetUserID != nil {
		// Direct message to a single user
		if client, ok := h.clients[*msg.TargetUserID]; ok {
			select {
			case client.send <- data:
			default:
				// Client send buffer full, skip
			}
		}
		return
	}

	if msg.TargetGroupID != nil {
		// Group message — send to all members of the group
		if members, ok := h.groups[*msg.TargetGroupID]; ok {
			for userID := range members {
				if client, ok := h.clients[userID]; ok {
					select {
					case client.send <- data:
					default:
					}
				}
			}
		}
		return
	}

	if msg.Broadcast {
		// Broadcast to all connected clients
		for _, client := range h.clients {
			select {
			case client.send <- data:
			default:
			}
		}
	}
}

// SendToUser sends a typed message to a specific user
func (h *Hub) SendToUser(userID uuid.UUID, msgType string, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[ws] failed to marshal payload for user %s: %v", userID, err)
		return
	}
	h.broadcast <- &BroadcastMessage{
		TargetUserID: &userID,
		Type:         msgType,
		Payload:      data,
	}
}

// SendToGroup sends a typed message to all members of a group
func (h *Hub) SendToGroup(groupID uuid.UUID, msgType string, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[ws] failed to marshal payload for group %s: %v", groupID, err)
		return
	}
	h.broadcast <- &BroadcastMessage{
		TargetGroupID: &groupID,
		Type:          msgType,
		Payload:       data,
	}
}

// JoinGroup registers a user as a member of a group for real-time messages
func (h *Hub) JoinGroup(groupID, userID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.groups[groupID] == nil {
		h.groups[groupID] = make(map[uuid.UUID]bool)
	}
	h.groups[groupID][userID] = true
}

// LeaveGroup removes a user from a group's real-time broadcast list
func (h *Hub) LeaveGroup(groupID, userID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if members, ok := h.groups[groupID]; ok {
		delete(members, userID)
		if len(members) == 0 {
			delete(h.groups, groupID)
		}
	}
}

// IsOnline checks if a user currently has an active WebSocket connection
func (h *Hub) IsOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

func (h *Hub) IsGroupMember(groupID, userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	members, ok := h.groups[groupID]
	if !ok {
		return false
	}
	return members[userID]
}
