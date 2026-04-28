import type {
  ClimbScan,
  GuidanceCue,
  GuidanceLimb,
  Hold,
  HoldColor,
} from '../../../shared/types/climb';
import type { Language } from '../../../shared/i18n/translations';
import type { LivePoseState } from '../hooks/useLivePoseTracker';
import type { LiveWallAlignmentState } from '../hooks/useLiveWallAlignment';
import type { AssistSafetyDecision } from './safetyState.service';

const HOLD_COLOR_LABELS_ZH: Record<HoldColor, string> = {
  blue: '蓝色',
  red: '红色',
  green: '绿色',
  yellow: '黄色',
  pink: '粉色',
  purple: '紫色',
  orange: '橙色',
  black: '黑色',
  white: '白色',
  unknown: '当前颜色',
};

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

function limbLabelZh(limb: GuidanceLimb | undefined) {
  switch (limb) {
    case 'leftHand':
      return '左手';
    case 'rightHand':
      return '右手';
    case 'leftFoot':
      return '左脚';
    case 'rightFoot':
      return '右脚';
    default:
      return '双手';
  }
}

function isFootLimb(limb: GuidanceLimb | undefined) {
  return limb === 'leftFoot' || limb === 'rightFoot';
}

function holdDescriptorZh(hold: Hold, limb: GuidanceLimb | undefined) {
  const color = HOLD_COLOR_LABELS_ZH[hold.color] ?? HOLD_COLOR_LABELS_ZH.unknown;

  if (hold.role === 'finish') {
    return `${color}终点点`;
  }

  if (isFootLimb(limb) || hold.role === 'foot') {
    if (hold.size === 's') return `${color}小脚点`;
    if (hold.size === 'l') return `${color}大脚点`;
    return `${color}脚点`;
  }

  if (hold.role === 'start') {
    return `${color}起始点`;
  }

  if (hold.size === 'l') return `${color}大手点`;
  if (hold.size === 's') return `${color}小手点`;
  return `${color}手点`;
}

function holdRegionZh(hold: Hold) {
  const horizontal =
    hold.xPct < 34 ? '左侧' : hold.xPct > 66 ? '右侧' : '中间';
  const vertical =
    hold.yPct < 28 ? '上方' : hold.yPct > 72 ? '下方' : '中间';

  if (horizontal === '中间' && vertical === '中间') {
    return '中间';
  }

  if (horizontal === '中间') {
    return vertical;
  }

  if (vertical === '中间') {
    return horizontal;
  }

  return `${horizontal}${vertical}`;
}

function holdTargetLabelZh(hold: Hold | null) {
  if (!hold) return '目标点';
  return `${holdRegionZh(hold)}的${holdDescriptorZh(hold, hold.role === 'foot' ? 'leftFoot' : 'leftHand')}`;
}

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

function buildCorrectionZh(dx: number, dy: number) {
  const parts: string[] = [];

  if (Math.abs(dx) >= 2.2) {
    if (Math.abs(dx) < 6) {
      parts.push(dx > 0 ? '向右一点' : '向左一点');
    } else {
      parts.push(dx > 0 ? '向右移动' : '向左移动');
    }
  }

  if (Math.abs(dy) >= 2.2) {
    if (Math.abs(dy) < 6) {
      parts.push(dy > 0 ? '向上一点' : '向下一点');
    } else {
      parts.push(dy > 0 ? '向上找' : '向下找');
    }
  }

  return parts;
}

export function buildGuidanceCueSpeechZh({
  cueIndex,
  totalCues,
  cue,
  targetHold,
}: {
  cueIndex: number;
  totalCues: number;
  cue: GuidanceCue;
  targetHold: Hold | null;
}) {
  const prefix =
    cueIndex === 0
      ? '起步。'
      : targetHold?.role === 'finish'
        ? '最后一步。'
        : `第${cueIndex + 1}步。`;

  if (!targetHold) {
    return `${prefix}请准备下一步目标点。`;
  }

  const limb = cue.limb;
  const limbLabel = limbLabelZh(limb);
  const targetLabel = holdTargetLabelZh(targetHold);

  if (cueIndex === 0 || targetHold.role === 'start') {
    return `${prefix}双手先到${targetLabel}，身体稳住再继续。`;
  }

  if (targetHold.role === 'finish') {
    return `${prefix}${limbLabel}去找${targetLabel}，抓稳以后先别着急动。`;
  }

  if (isFootLimb(limb) || targetHold.role === 'foot') {
    return `${prefix}${limbLabel}去找${targetLabel}，脚先踩稳，再起身。`;
  }

  return `${prefix}${limbLabel}去找${targetLabel}，动作放慢，先稳再伸。`;
}

export function buildLivePositionSpeechZh({
  limb,
  targetHold,
  activeAnchor,
  distancePct,
  targetThreshold,
}: {
  limb: GuidanceLimb | undefined;
  targetHold: Hold | null;
  activeAnchor: { xPct: number; yPct: number } | null | undefined;
  distancePct: number | null;
  targetThreshold: number;
}) {
  if (!targetHold) {
    return {
      speechText: null,
      speechKey: 'waiting-target-zh',
    };
  }

  const limbLabel = limbLabelZh(limb);
  if (!activeAnchor || distancePct === null) {
    return {
      speechText: `${limbLabel}没有清楚进入画面，请把${limbLabel}重新放回镜头里。`,
      speechKey: `${targetHold.id}:limb-hidden-zh:${limb ?? 'match'}`,
    };
  }

  if (distancePct <= targetThreshold * 0.72) {
    return {
      speechText: `${limbLabel}到位了，先稳住，不急着做下一步。`,
      speechKey: `${targetHold.id}:locked-zh`,
    };
  }

  const dx = targetHold.xPct - activeAnchor.xPct;
  const dy = activeAnchor.yPct - targetHold.yPct;
  const correction = buildCorrectionZh(dx, dy);

  if (distancePct <= targetThreshold * 1.3) {
    return {
      speechText:
        correction.length > 0
          ? `${limbLabel}，${correction.join('，')}。快到${holdTargetLabelZh(targetHold)}了。`
          : `${limbLabel}，先稳住，目标就在附近。`,
      speechKey: `${targetHold.id}:close-zh:${correction.join('|') || 'steady'}`,
    };
  }

  const distanceBand = getDistanceBandZh(distancePct);
  const direction = getClockDirectionZh(dx, dy);
  return {
    speechText: `${limbLabel}去找${holdTargetLabelZh(targetHold)}。方向在${direction}，距离${distanceBand.label}。`,
    speechKey: `${targetHold.id}:${distanceBand.key}-zh:${direction}`,
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

  const requiresAlignment = Boolean(scan);

  if (poseState.error) {
    return '请暂停，姿态识别暂时不可用。请检查镜头，并让全身重新进入画面。';
  }

  if (requiresAlignment && (!alignmentState.active || alignmentState.status === 'unavailable')) {
    return '请暂停，墙面对齐还不稳定。请把整面墙重新放进画面，再继续。';
  }

  if (requiresAlignment && alignmentState.status === 'partial' && alignmentState.qualityPct < 58) {
    return '请暂停，墙面对齐还在稳定中。先保持镜头不动，再继续。';
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

  if (!poseState.active || poseState.poseQualityPct < 48 || poseState.visibleLimbCount < 1) {
    return `请暂停，姿态识别还不够稳定。当前识别质量 ${poseState.poseQualityPct}% ，请让全身进入画面。`;
  }

  return '请暂停，当前实时引导条件还没有稳定下来。';
}

export function buildTargetReachedSpeechZh({
  nextCueIndex,
  totalCues,
  nextCue,
  nextHold,
}: {
  nextCueIndex: number;
  totalCues: number;
  nextCue: GuidanceCue | undefined;
  nextHold: Hold | null;
}) {
  if (!nextCue || !nextHold) {
    return '目标已到，继续下一步。';
  }

  return `这个点已经到了。${buildGuidanceCueSpeechZh({
    cueIndex: nextCueIndex,
    totalCues,
    cue: nextCue,
    targetHold: nextHold,
  })}`;
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
