package service

import (
	"context"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
)

type CampusConnectService struct {
	store db.Querier
}

func NewCampusConnectService(store db.Querier) *CampusConnectService {
	return &CampusConnectService{store: store}
}

// Connections
func (s *CampusConnectService) SendConnectionRequest(ctx context.Context, requesterID, receiverID uuid.UUID, message *string) (db.Connection, error) {
	return s.store.CreateConnection(ctx, db.CreateConnectionParams{
		RequesterID: requesterID, ReceiverID: receiverID, Message: message,
	})
}

func (s *CampusConnectService) RespondToConnection(ctx context.Context, id uuid.UUID, status string) (db.Connection, error) {
	return s.store.UpdateConnectionStatus(ctx, db.UpdateConnectionStatusParams{ID: id, Status: db.ConnectionStatus(status)})
}

func (s *CampusConnectService) ListConnections(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]db.ListUserConnectionsRow, error) {
	return s.store.ListUserConnections(ctx, db.ListUserConnectionsParams{RequesterID: userID, Limit: limit, Offset: offset})
}

func (s *CampusConnectService) ListPendingRequests(ctx context.Context, userID uuid.UUID) ([]db.ListPendingConnectionRequestsRow, error) {
	return s.store.ListPendingConnectionRequests(ctx, userID)
}

// Messages
func (s *CampusConnectService) SendMessage(ctx context.Context, senderID, receiverID uuid.UUID, content string) (db.Message, error) {
	return s.store.CreateMessage(ctx, db.CreateMessageParams{SenderID: senderID, ReceiverID: receiverID, Content: content})
}

func (s *CampusConnectService) ListConversation(ctx context.Context, userID1, userID2 uuid.UUID, limit, offset int32) ([]db.Message, error) {
	return s.store.ListConversation(ctx, db.ListConversationParams{SenderID: userID1, ReceiverID: userID2, Limit: limit, Offset: offset})
}

func (s *CampusConnectService) MarkMessageRead(ctx context.Context, id uuid.UUID) (db.Message, error) {
	return s.store.MarkMessageRead(ctx, id)
}

// Groups
func (s *CampusConnectService) CreateGroup(ctx context.Context, params db.CreateGroupParams) (db.Group, error) {
	group, err := s.store.CreateGroup(ctx, params)
	if err != nil {
		return db.Group{}, err
	}
	// Auto-add creator as admin
	_, _ = s.store.AddGroupMember(ctx, db.AddGroupMemberParams{GroupID: group.ID, UserID: params.CreatedBy, Role: "admin"})
	return group, nil
}

func (s *CampusConnectService) GetGroup(ctx context.Context, id uuid.UUID) (db.Group, error) {
	return s.store.GetGroup(ctx, id)
}

func (s *CampusConnectService) ListGroups(ctx context.Context, limit, offset int32) ([]db.ListGroupsRow, error) {
	return s.store.ListGroups(ctx, db.ListGroupsParams{Limit: limit, Offset: offset})
}

func (s *CampusConnectService) ListUserGroups(ctx context.Context, userID uuid.UUID) ([]db.ListUserGroupsRow, error) {
	return s.store.ListUserGroups(ctx, userID)
}

func (s *CampusConnectService) JoinGroup(ctx context.Context, groupID, userID uuid.UUID) (db.GroupMember, error) {
	return s.store.AddGroupMember(ctx, db.AddGroupMemberParams{GroupID: groupID, UserID: userID, Role: "member"})
}

func (s *CampusConnectService) LeaveGroup(ctx context.Context, groupID, userID uuid.UUID) error {
	return s.store.RemoveGroupMember(ctx, db.RemoveGroupMemberParams{GroupID: groupID, UserID: userID})
}

func (s *CampusConnectService) ListGroupMembers(ctx context.Context, groupID uuid.UUID) ([]db.ListGroupMembersRow, error) {
	return s.store.ListGroupMembers(ctx, groupID)
}

func (s *CampusConnectService) SendGroupMessage(ctx context.Context, groupID, senderID uuid.UUID, content string) (db.GroupMessage, error) {
	return s.store.CreateGroupMessage(ctx, db.CreateGroupMessageParams{GroupID: groupID, SenderID: senderID, Content: content})
}

func (s *CampusConnectService) ListGroupMessages(ctx context.Context, groupID uuid.UUID, limit, offset int32) ([]db.ListGroupMessagesRow, error) {
	return s.store.ListGroupMessages(ctx, db.ListGroupMessagesParams{GroupID: groupID, Limit: limit, Offset: offset})
}

// Directory
func (s *CampusConnectService) GetStudentDirectory(ctx context.Context, limit, offset int32) ([]db.GetStudentDirectoryRow, error) {
	return s.store.GetStudentDirectory(ctx, db.GetStudentDirectoryParams{Limit: limit, Offset: offset})
}

func (s *CampusConnectService) GetAlumniDirectory(ctx context.Context, limit, offset int32) ([]db.GetAlumniDirectoryRow, error) {
	return s.store.GetAlumniDirectory(ctx, db.GetAlumniDirectoryParams{Limit: limit, Offset: offset})
}
