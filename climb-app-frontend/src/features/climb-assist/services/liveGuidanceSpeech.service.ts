import type {
  ClimbScan,
  Hold,
} from '../../../shared/types/climb';
import type { Language } from '../../../shared/i18n/translations';
import type { LivePoseState } from '../hooks/useLivePoseTracker';
import type { LiveWallAlignmentState } from '../hooks/useLiveWallAlignment';
import type { AssistSafetyDecision } from './safetyState.service';
import { localizeAssistText } from '../utils/localizedAssistText';

const CLOCK_LABELS_ZH = [
  '12点钟',
  '1点钟',
  '2点钟',
  '3点钟',
  '4点钟',
  '5点钟',
  '6点钟',
  '7点钟',
  '8点钟',
  '9点钟',
  '10点钟',
  '11点钟',
] as const;

function getDistanceBandZh(distancePct: number) {
  if (distancePct < 4.5) return { key: 'very-close', label: '很近' };
  if (distancePct < 9) return { key: 'close', label: '较近' };
  if (distancePct < 15) return { key: 'medium', label: '中等距离' };
  if (distancePct < 23) return { key: 'far', label: '偏远' };
  return { key: 'very-far', label: '很远' };
}

function getClockDirectionZh(dx: number, dy: number) {
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  const normalized = (angle + 360) % 360;
  const index = Math.round(normalized / 30) % 12;
  return CLOCK_LABELS_ZH[index];
}

export function buildLivePositionSpeechZh({
  targetHold,
  activeAnchor,
  distancePct,
}: {
  targetHold: Hold | null;
  activeAnchor: { xPct: number; yPct: number } | null | undefined;
  distancePct: number | null;
}) {
  if (!targetHold) {
    return {
      speechText: null,
      speechKey: 'waiting-target-zh',
    };
  }

  if (!activeAnchor || distancePct === null) {
    return {
      speechText: '\u80f8\u53e3\u4f4d\u7f6e\u4e0d\u6e05\u695a\uff0c\u8bf7\u8ba9\u4e0a\u534a\u8eab\u56de\u5230\u955c\u5934\u4e2d\u592e\u3002',
      speechKey: `${targetHold.id}:chest-hidden-zh`,
    };
  }

  const dx = targetHold.xPct - activeAnchor.xPct;
  const dy = activeAnchor.yPct - targetHold.yPct;
  const distanceBand = getDistanceBandZh(distancePct);
  const direction = getClockDirectionZh(dx, dy);
  return {
    speechText: `${direction}\u65b9\u5411\uff0c\u8ddd\u79bb${distanceBand.label}\u3002`,
    speechKey: `${targetHold.id}:chest-zh:${distanceBand.key}:${direction}`,
  };
}

export function buildLiveSafetyPauseSpeechZh({
  decision,
  poseState,
  alignmentState,
  scan,
}: {
  decision: AssistSafetyDecision;
  poseState: LivePoseState;
  alignmentState: LiveWallAlignmentState;
  scan: ClimbScan | null;
}) {
  if (decision.status === 'ready') {
    return '实时引导已准备好。';
  }

  if (decision.status !== 'pause-live-guidance') {
    return localizeAssistText(decision.detail, 'zh') || '实时引导暂时不可用，请先完成前一步检查。';
  }

  const requiresAlignment = Boolean(scan);

  if (requiresAlignment && (!alignmentState.active || alignmentState.status === 'unavailable')) {
    return '请暂停，墙面对齐还不稳定。请把整面墙重新放进画面，再继续。';
  }

  if (requiresAlignment && alignmentState.status === 'partial' && alignmentState.qualityPct < 58) {
    return '请暂停，墙面对齐还在稳定中。先保持镜头不动，再继续。';
  }

  if (poseState.error) {
    return '请暂停，姿态识别暂时不可用。请检查镜头，并让全身重新进入画面。';
  }

  if (!poseState.active || poseState.poseQualityPct < 48 || poseState.visibleLimbCount < 1) {
    return `请暂停，姿态识别还不够稳定。当前识别质量 ${poseState.poseQualityPct}% ，请让全身进入画面。`;
  }

  if (poseState.subjectLockStatus === 'searching') {
    return '请暂停，系统还在锁定主攀爬者。请让身体完整进入镜头并停稳一下。';
  }

  if (poseState.subjectLockStatus === 'holding' || poseState.subjectLockStatus === 'reacquiring') {
    return '请暂停，系统正在重新锁定当前攀爬者。先保持动作稳定。';
  }

  if (poseState.interferenceRiskPct >= 62) {
    return '请暂停，画面里有其他人正在干扰识别。尽量让镜头里只保留攀爬者。';
  }

  return '请暂停，当前实时引导条件还没有稳定下来。';
}

export function buildRecalibrationSpeechZh() {
  return '开始重新校准。请让镜头对准墙面，并尽量保持三点接触。';
}

export function buildPoseTrackerStatusZh(poseState: LivePoseState) {
  if (poseState.error) {
    return {
      tone: 'error' as const,
      headline: '姿态追踪不可用',
      detail: '请检查相机画面和姿态模型加载状态。',
    };
  }

  if (poseState.loading) {
    return {
      tone: 'warning' as const,
      headline: '姿态模型启动中',
      detail: '正在加载实时姿态识别，请稍等一下。',
    };
  }

  if (!poseState.poseFrame) {
    return {
      tone: 'warning' as const,
      headline: '等待人体进入画面',
      detail: '请让全身完整进入镜头中央。',
    };
  }

  if (poseState.subjectLockStatus === 'searching') {
    return {
      tone: 'warning' as const,
      headline: '正在锁定攀爬者',
      detail: `质量 ${poseState.poseQualityPct}% · 肢体 ${poseState.visibleLimbCount} · 关节点 ${poseState.visibleJointCount}`,
    };
  }

  if (poseState.subjectLockStatus === 'holding' || poseState.subjectLockStatus === 'reacquiring') {
    return {
      tone: 'warning' as const,
      headline: '正在重新锁定人物',
      detail: `质量 ${poseState.poseQualityPct}% · 肢体 ${poseState.visibleLimbCount} · 关节点 ${poseState.visibleJointCount}`,
    };
  }

  if (!poseState.active || poseState.poseQualityPct < 48 || poseState.visibleLimbCount < 1) {
    return {
      tone: 'warning' as const,
      headline: '姿态已检测到，但还不稳定',
      detail: `质量 ${poseState.poseQualityPct}% · 肢体 ${poseState.visibleLimbCount} · 关节点 ${poseState.visibleJointCount}`,
    };
  }

  return {
    tone: 'ready' as const,
    headline: '姿态已锁定',
    detail: `质量 ${poseState.poseQualityPct}% · 肢体 ${poseState.visibleLimbCount} · 关节点 ${poseState.visibleJointCount}`,
  };
}

export function buildPoseTrackerStatus(poseState: LivePoseState, language: Language) {
  if (language === 'zh') {
    return buildPoseTrackerStatusZh(poseState);
  }

  if (poseState.error) {
    return {
      tone: 'error' as const,
      headline: 'Pose tracking unavailable',
      detail: 'Check the camera view and pose model.',
    };
  }

  if (poseState.loading) {
    return {
      tone: 'warning' as const,
      headline: 'Starting pose tracking',
      detail: 'Loading live pose detection. Please wait.',
    };
  }

  if (!poseState.poseFrame) {
    return {
      tone: 'warning' as const,
      headline: 'Waiting for the climber',
      detail: 'Place the full body in the center of the camera.',
    };
  }

  const detail =
    `Quality ${poseState.poseQualityPct}% · limbs ${poseState.visibleLimbCount} · joints ${poseState.visibleJointCount}`;

  if (poseState.subjectLockStatus === 'searching') {
    return {
      tone: 'warning' as const,
      headline: 'Finding the climber',
      detail,
    };
  }

  if (poseState.subjectLockStatus === 'holding' || poseState.subjectLockStatus === 'reacquiring') {
    return {
      tone: 'warning' as const,
      headline: 'Re-locking the climber',
      detail,
    };
  }

  if (!poseState.active || poseState.poseQualityPct < 48 || poseState.visibleLimbCount < 1) {
    return {
      tone: 'warning' as const,
      headline: 'Pose detected, not stable yet',
      detail,
    };
  }

  return {
    tone: 'ready' as const,
    headline: 'Pose locked',
    detail,
  };
}
