export type HoldColor =
  | 'blue'
  | 'red'
  | 'green'
  | 'yellow'
  | 'pink'
  | 'purple'
  | 'orange'
  | 'black'
  | 'white'
  | 'unknown';

export type HoldRole = 'start' | 'foot' | 'intermediate' | 'finish';
export type SessionStatus = 'draft' | 'guiding' | 'paused' | 'completed';
export type GuidanceLogType =
  | 'cue_issued'
  | 'hold_reached'
  | 'scan_saved'
  | 'session_completed'
  | 'recalibrate'
  | 'safety_state_changed';
export type GuidanceLimb = 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot' | 'match';
export type VisionReadinessStatus = 'ready' | 'retake_required' | 'companion_mode_recommended';
export type VisionSuggestedAction = 'proceed' | 'retake' | 'companion';
export type RouteStartRegion = 'left' | 'center' | 'right';
export type RouteStartType = 'single-start' | 'dual-hand-start' | 'match-start';
export type RouteFinishType = 'single-finish' | 'controlled-finish' | 'match-finish';
export type RouteReviewState = 'auto-approved' | 'review-recommended';

export interface Hold {
  id: string;
  label: string;
  color: HoldColor;
  xPct: number;
  yPct: number;
  x1Pct?: number;
  y1Pct?: number;
  x2Pct?: number;
  y2Pct?: number;
  confidence: number;
  role: HoldRole;
  size: 's' | 'm' | 'l';
  radiusPct?: number;
}

export interface RouteSemantics {
  plannerVersion: string;
  feedbackReady: boolean;
  reviewState: RouteReviewState;
  startType: RouteStartType;
  startLabel: string;
  finishType: RouteFinishType;
  finishLabel: string;
  startHoldIds: string[];
  finishHoldIds: string[];
  supportHoldIds: string[];
  reachabilityScore: number;
  stabilityScore: number;
  reviewSummary: string;
  setterNotes: string[];
  reviewHints: string[];
}

export interface RouteCandidate {
  id: string;
  color: HoldColor;
  holdIds: string[];
  confidence: number;
  estimatedMoves: number;
  startRegion: RouteStartRegion;
  summary: string;
  semantics?: RouteSemantics;
}

export interface VisionDetectionSummary {
  holdCount: number;
  routeCount: number;
  averageHoldConfidence: number;
  imageQualityScore: number;
  blurScore: number;
  brightness: number;
  contrast: number;
}

export interface WallAnalysis {
  provider: string;
  confidence: number;
  readiness: VisionReadinessStatus;
  suggestedAction: VisionSuggestedAction;
  shouldAllowAutonomousGuidance: boolean;
  captureGuidance: string[];
  routeCandidates: RouteCandidate[];
  detectionSummary: VisionDetectionSummary;
  modelNotes: string[];
  manualReview?: WallManualReview;
}

export interface WallManualReview {
  holdColorsReviewed: boolean;
  reviewedAt: string;
  colorCorrectionCount: number;
  holdAdditionCount?: number;
  holdDeletionCount?: number;
  totalCorrectionCount?: number;
  reviewer: 'companion';
}

export interface WallMap {
  id: string;
  name: string;
  source: 'camera' | 'upload';
  width: number;
  height: number;
  colors: HoldColor[];
  scannedAt: string;
  scanNotes: string[];
  holds: Hold[];
  analysis?: WallAnalysis;
}

export interface ClimbScan {
  _id?: string;
  id: string;
  gymName: string;
  availableColors: HoldColor[];
  wallMap: WallMap;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoutePlan {
  id: string;
  scanId: string;
  color: HoldColor;
  difficultyPreference: string;
  holdIds: string[];
  holds: Hold[];
  summary: string;
  estimatedMoves: number;
  semantics?: RouteSemantics;
}

export interface ClimbSessionSummary {
  holdsReached: number;
  totalHolds: number;
  cueCount: number;
  recalibrationCount: number;
  source: 'camera' | 'upload';
}

export interface ClimbSession {
  _id?: string;
  id: string;
  scanId: string;
  routeId: string;
  selectedColor: HoldColor;
  difficulty: string;
  startedAt: string;
  endedAt?: string;
  cueIndex: number;
  completed: boolean;
  elapsedSeconds?: number;
  currentTargetHoldId?: string;
  status: SessionStatus;
  plannedRoute?: RoutePlan;
  summaryStats: ClimbSessionSummary;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuidanceLog {
  _id?: string;
  id: string;
  sessionId: string;
  type: GuidanceLogType;
  message: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface GuidanceCue {
  holdId: string;
  title: string;
  message: string;
  progressLabel: string;
  limb?: GuidanceLimb;
  direction?: string;
}

export interface CreateClimbScanPayload {
  gymName: string;
  availableColors: HoldColor[];
  wallMap: WallMap;
  coverImageUrl?: string;
}

export interface UpdateClimbScanPayload extends Partial<CreateClimbScanPayload> {}

export interface CreateClimbSessionPayload {
  scanId: string;
  routeId?: string;
  selectedColor: HoldColor;
  difficulty: string;
  startedAt: string;
  cueIndex?: number;
  completed?: boolean;
  currentTargetHoldId?: string;
  status?: SessionStatus;
  plannedRoute?: RoutePlan;
  summaryStats: ClimbSessionSummary;
}

export interface UpdateClimbSessionPayload extends Partial<CreateClimbSessionPayload> {
  endedAt?: string;
  elapsedSeconds?: number;
}
