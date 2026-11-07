import apiClient, { unwrap } from './client';
import type { AdminGrantKey } from '../config/permissions';
import type { User, AuthTokens } from '../types';

export type InviteRole = 'lecturer' | 'delegated_admin' | 'hod';
export interface AccessInvitation {
  id: string;
  email: string;
  name: string;
  role: InviteRole;
  grants: Partial<Record<AdminGrantKey, boolean>>;
  status: 'pending_approval' | 'sent' | 'accepted' | 'expired' | 'revoked';
  bootstrap: boolean;
  requestedBy: string | null;
  approvedBy: string | null;
  acceptedBy: string | null;
  expiresAt: string;
  createdAt: string;
  deliveryFailed: boolean;
}
export interface InvitationPreview {
  invitedBy?: string;
  approvedBy?: string;
  invitation: AccessInvitation;
  department: string;
  urlCode: string;
  accountExists: boolean;
}
export interface InvitationEvent {
  action: string;
  actorId: string | null;
  createdAt: string;
}
export const listInvitations = async () => unwrap<AccessInvitation[]>(await apiClient.get('/invitations'));
export const createInvitation = async (input: {
  email: string;
  name: string;
  role: InviteRole;
  grants: AccessInvitation['grants'];
}) => unwrap<AccessInvitation>(await apiClient.post('/invitations', input));
export const invitationAction = async (id: string, action: 'approve' | 'resend' | 'revoke') =>
  unwrap<AccessInvitation>(await apiClient.post(`/invitations/${id}/${action}`));
export const invitationEvents = async (id: string) =>
  unwrap<InvitationEvent[]>(await apiClient.get(`/invitations/${id}/events`));
export const inspectInvitation = async (tenant: string, token: string) =>
  unwrap<InvitationPreview>(await apiClient.post('/auth/invitations/inspect', { tenant, token }));
export const acceptInvitation = async (input: {
  tenant: string;
  token: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}) => unwrap<{ user: User; tokens: AuthTokens }>(await apiClient.post('/auth/invitations/accept', input));
