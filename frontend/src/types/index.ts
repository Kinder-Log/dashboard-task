export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER';

export type TaskType = 'FEATURE' | 'BUG' | 'MAINTENANCE' | 'RESEARCH' | 'INFRASTRUCTURE' | 'TEST';

export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  changePasswordOnFirstLogin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user: User;
}

export interface TaskStatus {
  id: string;
  name: string;
  key: string;
  color: string;
  position: number;
  active: boolean;
  protected: boolean;
}

export interface TaskTransitionRule {
  id: string;
  fromStatus: string;
  toStatus: string;
  roleAllowed: Role;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  taskNumber: number;
  taskKey: string;
  title: string;
  description?: string;
  projectId: string;
  project?: Project;
  assigneeId?: string;
  assignee?: User;
  type: TaskType;
  priority: TaskPriority;
  statusKey: string;
  status?: TaskStatus;
  estimatedHours?: number;
  actualHours: number;
  source?: string;
  dueDate?: string;
  version: number;
  parentTaskId?: string;
  subtasks?: Task[];
  attachments?: Attachment[];
  comments?: Comment[];
  links?: TaskLink[];
  timeLogs?: TimeLog[];
  tags?: { tag: Tag }[];
  activities?: Activity[];
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  taskId: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploaderId: string;
  uploader?: User;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  author?: User;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLink {
  id: string;
  taskId: string;
  url: string;
  title: string;
  type: 'GITHUB' | 'DOCUMENTATION' | 'FIGMA' | 'EXTERNAL';
  createdAt: string;
}

export interface TimeLog {
  id: string;
  taskId: string;
  userId: string;
  user?: User;
  hours: number;
  description?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  taskId: string;
  userId: string;
  user?: User;
  action: string;
  details?: string;
  createdAt: string;
}

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description?: string;
}

export interface ApiResponse<T> {
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
