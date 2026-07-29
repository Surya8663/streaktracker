export interface HealthCheckResponse {
    status: 'ok' | 'error';
    timestamp: string;
    uptime: number;
}
export interface User {
    id: number;
    name: string;
    email: string;
    profilePicture: string | null;
    joinDate: string;
    bio: string | null;
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
}
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
export interface DailyLog {
    id: number;
    userId: number;
    date: string;
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
export interface StreakDay {
    date: string;
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
export interface LogUpdatedPayload {
    userId: number;
    userName: string;
    log: DailyLog;
    isEdit: boolean;
}
export interface PresenceUpdatePayload {
    onlineUserIds: number[];
}
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
export interface Milestone {
    id: number;
    blockNumber: number;
    startDate: string;
    endDate: string;
    winnerId: number | null;
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
export interface ServerToClientEvents {
    'server:welcome': (message: string) => void;
    'log:updated': (payload: LogUpdatedPayload) => void;
    'presence:update': (payload: PresenceUpdatePayload) => void;
    'milestone:completed': (payload: MilestoneWonPayload) => void;
}
export interface ClientToServerEvents {
    'client:ping': () => void;
}
//# sourceMappingURL=types.d.ts.map