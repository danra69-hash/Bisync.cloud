/** Team internal chat types + API helpers. */

export type TeamChatConversationType = 'direct' | 'announcement' | 'group' | 'project';

export type TeamChatDirectoryPerson = {
  id: number;
  name: string;
  email: string;
  mobile: string;
  department: string;
  position: string;
  employeeCode: string;
};

export type TeamChatProjectProgress = {
  total: number;
  completed: number;
  percent: number;
};

export type TeamChatProjectTask = {
  id: number;
  title: string;
  sortOrder: number;
  completed: boolean;
  assigneeEmployeeIds: number[];
  assigneeNames: string[];
};

export type TeamChatProjectDetails = {
  name: string;
  startDate: string | null;
  targetCompletionDate: string | null;
  progress: TeamChatProjectProgress;
  tasks: TeamChatProjectTask[];
};

export type TeamChatConversationSummary = {
  id: number;
  companyId: number;
  type: TeamChatConversationType | string;
  title: string;
  updatedAt: string;
  unreadCount: number;
  peerEmployeeIds: number[];
  projectStartDate?: string | null;
  projectTargetDate?: string | null;
  projectProgress?: TeamChatProjectProgress | null;
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
    projectStartDate?: string | null;
    projectTargetDate?: string | null;
  };
  project?: TeamChatProjectDetails | null;
  messages: TeamChatMessage[];
};

export type TeamChatProjectTaskInput = {
  title: string;
  assigneeEmployeeIds: number[];
};
