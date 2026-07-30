// ── Health Check ──────────────────────────────────────────────
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
}

// ── User ─────────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  email: string;
  profilePicture: string | null;
  joinDate: string;
  bio: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
}

export interface ProfileStatsResponse {
  user: User;
  totalDaysActive: number;
  totalHoursLogged: number;
  currentStreak: number;
  longestStreak: number;
  milestonesWon: number;
}

export interface UpdateProfileRequest {
  bio?: string;
  name?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

// ── Auth ─────────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  message: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

// ── Daily Log ────────────────────────────────────────────────
export interface DailyLog {
  id: number;
  userId: number;
  date: string; // YYYY-MM-DD
  topicsStudied: string;
  hoursSpent: number;
  notes?: string | null;
  createdAt: string;
}

export interface CreateDailyLogRequest {
  date: string;
  topicsStudied: string;
  hoursSpent: number;
  notes?: string;
}

export interface UpdateDailyLogRequest {
  topicsStudied?: string;
  hoursSpent?: number;
  notes?: string;
}

// ── Streak & Calendar ────────────────────────────────────────
export interface StreakDay {
  date: string; // YYYY-MM-DD
  hoursSpent: number;
  topicsStudied: string | null;
  notes: string | null;
  level: 0 | 1 | 2 | 3;
}

export interface StreakResponse {
  user: User;
  currentStreak: number;
  longestStreak: number;
  totalHours: number;
  totalDaysLogged: number;
  calendarData: StreakDay[];
}

// ── Socket Payloads ──────────────────────────────────────────
export interface LogUpdatedPayload {
  userId: number;
  userName: string;
  log: DailyLog;
  isEdit: boolean;
}

export interface PresenceUpdatePayload {
  onlineUserIds: number[];
}

// ── Roadmap ──────────────────────────────────────────────────
export interface RoadmapPhase {
  id: number;
  phaseNumber: number;
  title: string;
  subtitle: string;
  startDay: number;
  endDay: number;
  targetHours: number;
  icon: string;
  actualHours: number;
  daysElapsedInPhase: number;
  totalDaysInPhase: number;
  isUnlocked: boolean;
  isCompleted: boolean;
  percentComplete: number;
}

export interface RoadmapResponse {
  phases: RoadmapPhase[];
  overallProgress: {
    daysElapsed: number;
    totalDays: number;
    percentDays: number;
    totalHoursLogged: number;
    startDate: string;
    targetEndDate: string;
  };
}

export interface UpdateRoadmapPhaseRequest {
  title?: string;
  subtitle?: string;
  targetHours?: number;
  icon?: string;
}

// ── Milestones ───────────────────────────────────────────────
export interface Milestone {
  id: number;
  blockNumber: number;
  startDate: string;          // YYYY-MM-DD
  endDate: string;            // YYYY-MM-DD
  winnerId: number | null;    // null = tie
  winnerName: string | null;
  loserId: number | null;
  loserName: string | null;
  user1Hours: number;
  user2Hours: number;
  user1Id: number;
  user2Id: number;
  user1Name: string;
  user2Name: string;
  isTie: boolean;
}

export interface CurrentBlock {
  blockNumber: number;
  startDate: string;
  endDate: string;
  user1Id: number;
  user2Id: number;
  user1Name: string;
  user2Name: string;
  user1Hours: number;
  user2Hours: number;
  daysRemaining: number;
  daysElapsed: number;
}

export interface TreatScore {
  userId: number;
  userName: string;
  treatsOwed: number;
}

export interface MilestoneResponse {
  milestones: Milestone[];
  currentBlock: CurrentBlock | null;
  treatScoreboard: TreatScore[];
}

export interface MilestoneWonPayload {
  milestone: Milestone;
}

// ── Socket Events ────────────────────────────────────────────
export interface RoadmapWonPayload {
  userId: number;
}

export interface RoadmapUpdatedPayload {
  userId: number;
  type: 'progress' | 'start' | 'save_day' | 'task_crud' | 'source_crud';
  dayNumber?: number;
  taskId?: number;
}

// ── Socket Events ────────────────────────────────────────────
export interface ServerToClientEvents {
  'server:welcome': (message: string) => void;
  'log:updated': (payload: LogUpdatedPayload) => void;
  'presence:update': (payload: PresenceUpdatePayload) => void;
  'milestone:completed': (payload: MilestoneWonPayload) => void;
  'roadmap:updated': (payload: RoadmapUpdatedPayload) => void;
}

// ── Month 1 Roadmap Types ────────────────────────────────────
export type TaskCategory = 'DSA' | 'LeetCode' | 'Python' | 'System Design' | 'AI Engineer';
export type RoadmapProfileStatus = 'not_started' | 'active' | 'completed';

export interface RoadmapTask {
  id: number;
  dayNumber: number;
  weekNumber: number;
  title: string;
  category: TaskCategory;
  recommendedMinutes: number;
  sortOrder: number;
  isCompleted?: boolean;
  completedAt?: string | null;
}

export interface UserRoadmapProfile {
  userId: number;
  status: RoadmapProfileStatus;
  currentDay: number;
  startDate: string | null;
  completionDate: string | null;
  totalCompletedTasks: number;
  totalTasks: number;
  totalMinutesStudied: number;
}

export interface DailyRoadmapSession {
  id: number;
  userId: number;
  date: string;
  minutesStudied: number;
  notes: string | null;
  createdAt: string;
}

export interface RoadmapDay {
  dayNumber: number;
  weekNumber: number;
  tasks: RoadmapTask[];
  session: DailyRoadmapSession | null;
  isUnlocked: boolean;
  isCompleted: boolean;
  completedTasksCount: number;
  totalTasksCount: number;
}

export interface UserProgressSummary {
  userId: number;
  userName: string;
  userAvatar: string | null;
  status: RoadmapProfileStatus;
  currentDay: number;
  completedTasksCount: number;
  totalTasksCount: number;
  percentComplete: number;
  totalMinutesStudied: number;
  startDate: string | null;
  completionDate: string | null;
}

export interface Month1RoadmapResponse {
  days: RoadmapDay[];
  userProfile: UserRoadmapProfile;
  myProgress: UserProgressSummary;
  partnerProgress: UserProgressSummary | null;
}

export interface ToggleTaskRequest {
  taskId: number;
  isCompleted: boolean;
}

export interface SaveDaySessionRequest {
  minutesStudied: number;
  notes?: string;
}

export interface CreateRoadmapTaskRequest {
  dayNumber: number;
  weekNumber?: number;
  title: string;
  category: TaskCategory;
  recommendedMinutes: number;
  sortOrder?: number;
}

export interface UpdateRoadmapTaskRequest {
  dayNumber?: number;
  weekNumber?: number;
  title?: string;
  category?: TaskCategory;
  recommendedMinutes?: number;
  sortOrder?: number;
}

// ── Shared Source Vault Types ────────────────────────────────
export interface RoadmapSourceLink {
  id: number;
  sourceId: number;
  title: string;
  url: string;
  note: string | null;
  addedByUserId: number;
  addedByName: string;
  addedByAvatar: string | null;
  createdAt: string;
}

export interface RoadmapSource {
  id: number;
  category: TaskCategory;
  name: string;
  sortOrder: number;
  createdAt: string;
  links: RoadmapSourceLink[];
}

export interface CreateSourceGroupRequest {
  category: TaskCategory;
  name: string;
  sortOrder?: number;
}

export interface CreateSourceLinkRequest {
  title: string;
  url: string;
  note?: string;
}

export interface UpdateSourceLinkRequest {
  title?: string;
  url?: string;
  note?: string;
}


export interface ClientToServerEvents {
  'client:ping': () => void;
}
