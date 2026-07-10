export interface User {
  id: string; email: string; name: string; phone?: string | null; company?: string | null;
  avatar?: string | null; role: 'admin' | 'team' | 'client'; status: string;
  createdAt: string; updatedAt: string;
  _count?: { assignedTasks: number; createdTasks: number; sentMessages?: number };
}

export interface Project {
  id: string; name: string; description?: string | null; color: string;
  status: string; priority: string; dueDate?: string | null;
  createdAt: string; updatedAt: string; createdBy: string;
  creator?: User; members?: ProjectMember[];
  _count?: { tasks: number; members: number; onboardingForms?: number };
}

export interface ProjectMember {
  id: string; projectId: string; userId: string; role: string;
  user?: User;
}

export interface Task {
  id: string; title: string; description?: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string | null; createdAt: string; updatedAt: string;
  projectId: string; createdById: string; tags: string;
  assignees?: TaskAssignment[]; creator?: User;
  _count?: { comments: number };
  project?: Project;
}

export interface TaskAssignment { id: string; taskId: string; userId: string; assignedAt: string; user?: User; }

export interface Comment { id: string; content: string; createdAt: string; updatedAt: string; taskId: string; userId: string; user?: User; }

export interface OnboardingForm {
  id: string; title: string; description?: string | null; status: string;
  stepsJson: string; projectId: string; clientId?: string | null; createdAt: string; updatedAt: string;
  project?: Project; client?: User; _count?: { submissions: number };
}

export interface Onboarding {
  id: string; formId: string; clientId: string; status: string;
  responsesJson: string; reviewNotes?: string | null;
  reviewedBy?: string | null; reviewedAt?: string | null;
  submittedAt?: string | null; createdAt: string; updatedAt: string;
  form?: OnboardingForm; client?: User; reviewer?: User;
}

export interface Message {
  id: string; content: string; senderId: string; receiverId?: string | null;
  groupId?: string | null; projectId?: string | null; read: boolean; createdAt: string;
  sender?: User; receiver?: User; group?: MessageGroup;
}

export interface MessageGroup {
  id: string; name: string; avatar?: string | null;
  createdBy: string; createdAt: string; updatedAt: string;
  creator?: User; members?: GroupMember[]; _count?: { members: number; messages: number };
}

export interface GroupMember {
  id: string; groupId: string; userId: string; role: string; joinedAt: string;
  group?: MessageGroup; user?: User;
}

export interface ActivityLog {
  id: string; action: string; details?: string | null;
  userId?: string | null; projectId?: string | null; taskId?: string | null;
  createdAt: string; user?: User;
}

export interface DashboardStats {
  totalTasks: number; completedTasks: number; inProgressTasks: number;
  inReviewTasks: number; todoTasks: number; overdueTasks: number;
  totalProjects: number; activeProjects: number; totalMembers: number;
  totalClients: number; thisWeekCompleted: number; totalMessages: number;
}

export type Role = 'admin' | 'team' | 'client'

// SPA route types
export type AppRoute =
  | { page: 'login' }
  | { page: 'admin-dashboard'; tab: 'overview' | 'users' | 'onboarding' | 'project' | 'task-dashboard' | 'task-view' | 'messages' | 'profile' }
  | { page: 'team-dashboard'; tab: 'project' | 'task' | 'messages' | 'profile' }
  | { page: 'client-dashboard'; tab: 'onboarding' | 'project' | 'messages' | 'profile' }