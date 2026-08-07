/** Team internal chat types + API helpers. */

export type TeamChatConversationType = 'direct' | 'announcement';

export type TeamChatDirectoryPerson = {
  id: number;
  name: string;
  email: string;
  mobile: string;
  department: string;
  position: string;
  employeeCode: string;
};

export type TeamChatConversationSummary = {
  id: number;
  companyId: number;
  type: TeamChatConversationType | string;
  title: string;
  updatedAt: string;
  unreadCount: number;
  peerEmployeeIds: number[];
  lastMessage: {
    id: number;
    body: string;
    senderEmployeeId: number;
    createdAt: string;
    hasAttachment: boolean;
  } | null;
};

export type TeamChatMessage = {
  id: number;
  senderEmployeeId: number;
  senderName?: string;
  body: string;
  attachmentContentType?: string | null;
  hasAttachment?: boolean;
  attachmentDataUrl?: string | null;
  createdAt: string;
  mine?: boolean;
};

export type TeamChatConversationsResponse = {
  canSendAnnouncement: boolean;
  conversations: TeamChatConversationSummary[];
};

export type TeamChatMessagesResponse = {
  conversation: {
    id: number;
    type: string;
    title: string;
    canSend: boolean;
  };
  messages: TeamChatMessage[];
};
