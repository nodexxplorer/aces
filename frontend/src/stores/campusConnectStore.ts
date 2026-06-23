import { create } from 'zustand';
import type { Connection, Message, Group, GroupMessage } from '../types';

interface CampusConnectState {
  connections: Connection[];
  pendingRequests: Connection[];
  messages: Record<string, Message[]>;
  activeConversation: string | null;
  groups: Group[];
  groupMessages: Record<string, GroupMessage[]>;
  suggestions: Connection[];
  setConnections: (connections: Connection[]) => void;
  setPendingRequests: (requests: Connection[]) => void;
  setMessages: (userId: string, messages: Message[]) => void;
  addMessage: (userId: string, message: Message) => void;
  setActiveConversation: (userId: string | null) => void;
  setGroups: (groups: Group[]) => void;
  setGroupMessages: (groupId: string, messages: GroupMessage[]) => void;
  addGroupMessage: (groupId: string, message: GroupMessage) => void;
  setSuggestions: (suggestions: Connection[]) => void;
}

export const useCampusConnectStore = create<CampusConnectState>()((set) => ({
  connections: [],
  pendingRequests: [],
  messages: {},
  activeConversation: null,
  groups: [],
  groupMessages: {},
  suggestions: [],
  setConnections: (connections) => set({ connections }),
  setPendingRequests: (pendingRequests) => set({ pendingRequests }),
  setMessages: (userId, messages) =>
    set((state) => ({ messages: { ...state.messages, [userId]: messages } })),
  addMessage: (userId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [userId]: [...(state.messages[userId] || []), message],
      },
    })),
  setActiveConversation: (userId) => set({ activeConversation: userId }),
  setGroups: (groups) => set({ groups }),
  setGroupMessages: (groupId, messages) =>
    set((state) => ({ groupMessages: { ...state.groupMessages, [groupId]: messages } })),
  addGroupMessage: (groupId, message) =>
    set((state) => ({
      groupMessages: {
        ...state.groupMessages,
        [groupId]: [...(state.groupMessages[groupId] || []), message],
      },
    })),
  setSuggestions: (suggestions) => set({ suggestions }),
}));
