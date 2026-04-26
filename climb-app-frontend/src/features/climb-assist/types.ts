export type {
  ClimbScan,
  ClimbSession,
  ClimbSessionSummary,
  CreateClimbScanPayload,
  CreateClimbSessionPayload,
  GuidanceCue,
  GuidanceLimb,
  GuidanceLog,
  GuidanceLogType,
  Hold,
  HoldColor,
  HoldRole,
  RouteCandidate,
  RoutePlan,
  SessionStatus,
  VisionDetectionSummary,
  VisionReadinessStatus,
  VisionSuggestedAction,
  WallAnalysis,
  UpdateClimbSessionPayload,
  UpdateClimbScanPayload,
  WallMap,
} from '../../shared/types/climb';

export interface ScanProgress {
  status: 'idle' | 'scanning' | 'saving' | 'done' | 'error';
  progress: number;
  message: string;
  error: string | null;
}
