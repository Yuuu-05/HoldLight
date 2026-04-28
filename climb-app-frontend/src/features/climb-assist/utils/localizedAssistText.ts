import type {
  ClimbSession,
  Hold,
  HoldColor,
  RouteCandidate,
  RouteFinishType,
  RoutePlan,
  RouteReviewState,
  RouteSemantics,
  RouteStartRegion,
  RouteStartType,
} from '../../../shared/types/climb';
import type { Language } from '../../../shared/i18n/translations';
import type { LiveWallAlignmentState } from '../hooks/useLiveWallAlignment';

const colorLabelsZh: Record<HoldColor, string> = {
  blue: '蓝色',
  red: '红色',
  green: '绿色',
  yellow: '黄色',
  pink: '粉色',
  purple: '紫色',
  orange: '橙色',
  black: '黑色',
  white: '白色',
  unknown: '未知颜色',
};

const difficultyLabelsZh: Record<string, string> = {
  Beginner: '新手',
  Intermediate: '进阶',
  Advanced: '高级',
};

const startRegionLabelsZh: Record<RouteStartRegion, string> = {
  left: '左侧起步',
  center: '中间起步',
  right: '右侧起步',
};

const startRegionLabelsEn: Record<RouteStartRegion, string> = {
  left: 'left start',
  center: 'center start',
  right: 'right start',
};

const startTypeLabelsZh: Record<RouteStartType, string> = {
  'single-start': '单手起步',
  'dual-hand-start': '双手起步',
  'match-start': '双手合握起步',
};

const startTypeLabelsEn: Record<RouteStartType, string> = {
  'single-start': 'Single-hand start',
  'dual-hand-start': 'Dual-hand start',
  'match-start': 'Match start',
};

const finishTypeLabelsZh: Record<RouteFinishType, string> = {
  'single-finish': '单手到顶',
  'controlled-finish': '控制到顶',
  'match-finish': '双手合握到顶',
};

const finishTypeLabelsEn: Record<RouteFinishType, string> = {
  'single-finish': 'Single finish',
  'controlled-finish': 'Controlled finish',
  'match-finish': 'Match finish',
};

const reviewStateLabelsZh: Record<RouteReviewState, string> = {
  'auto-approved': '路线检查通过',
  'review-recommended': '建议复核',
};

const reviewStateLabelsEn: Record<RouteReviewState, string> = {
  'auto-approved': 'Route checked',
  'review-recommended': 'Review recommended',
};

const exactTextZh: Record<string, string> = {
  'Ready to scan the wall.': '准备好扫描岩墙。',
  'Preparing the uploaded wall photo.': '正在准备上传的岩墙照片。',
  'Sending the wall photo to route recognition.': '正在把岩墙照片发送给路线识别。',
  'Saving the uploaded wall map.': '正在保存上传生成的岩墙地图。',
  'Capturing a clear frame from the uploaded video.': '正在从上传的视频中截取清晰画面。',
  'Sending the captured frame to route recognition.': '正在把截取画面发送给路线识别。',
  'Capturing a calm wall frame from the live camera.': '正在从实时相机截取稳定墙面画面。',
  'Handing the frame over to route recognition.': '正在把画面交给路线识别。',
  'Saving the scanned wall map for the next step.': '正在保存扫描结果，准备下一步。',
  'We could not finish this scan.': '这次扫描没有完成。',
  'Failed to scan the wall.': '岩墙扫描失败。',
  'The uploaded image preview is not ready yet.': '上传图片预览还没有准备好。',
  'The uploaded video preview is not ready yet.': '上传视频预览还没有准备好。',
  'Pause the uploaded video on a clear wall frame before scanning.': '请先把上传的视频暂停在清晰的岩墙画面上。',
  'The live camera preview is not ready yet.': '实时相机预览还没有准备好。',
  'Camera permission did not open. Check browser permission and try again.':
    '相机权限窗口没有打开。请检查浏览器权限后重试。',
  'Camera is not supported in this browser.': '当前浏览器不支持相机。',
  'Camera permission was denied. Enable camera access in browser settings and try again.':
    '相机权限已被拒绝。请在浏览器设置里允许相机后再试。',
  'No camera was found on this device.': '这台设备没有可用相机。',
  'Camera is already in use by another app or browser tab.':
    '相机正在被其他应用或浏览器页面占用。',
  'This camera could not satisfy the requested mobile video settings.':
    '当前相机无法满足这组移动端视频参数，请重试。',
  'Camera access needs HTTPS or localhost on mobile browsers.':
    '移动端浏览器需要 HTTPS 或 localhost 才能访问相机。',
  'Unable to start the camera stream.': '暂时无法启动相机画面。',
  'Rear camera was not available. Using the available camera instead.':
    '当前拿不到后置相机，已切换为设备可用的相机。',
  'The scan did not produce a usable wall map. Retake a clearer photo, upload media, or rescan.':
    '这次没有生成可用的岩墙地图。请重新拍摄更清晰的画面，上传照片/视频，或重新扫描。',
  'The live camera frame could not be captured yet.': '暂时无法截取实时相机画面。',
  'Choose a live camera scan or upload a wall image or video to continue.':
    '请选择实时相机扫描，或上传岩墙图片/视频后继续。',
  'Recognition is partly stable, but companion mode will keep the next step safer.':
    '识别结果部分稳定，但建议有人陪同再继续。',
  'Recognition confidence is still low for autonomous guidance. Please retake the photo or try a clearer angle.':
    '当前识别置信度偏低，不适合自主引导。请重新拍摄，或换一个更清楚的角度。',
  'No scan ready': '还没有可用扫描',
  'A wall scan is required before route setup can begin.': '需要先完成岩墙扫描，才能设置路线。',
  'No saved wall scan is available yet.': '当前还没有保存的岩墙扫描。',
  'Scan analysis missing': '缺少扫描分析',
  'The wall scan does not include a safety analysis yet.': '这次扫描还没有安全分析结果。',
  'No recognition analysis was saved with the wall scan.': '岩墙扫描中没有保存识别分析。',
  'Scan gate cleared': '扫描已通过检查',
  'Scan ready': '扫描已就绪',
  'Scan recognition passed the accessibility gate for autonomous guidance.':
    '识别结果已通过无障碍自主引导检查。',
  'Recognition is clear enough for route guidance.': '识别结果足够清晰，可以继续设置路线。',
  'Companion review complete': '陪同者检查完成',
  'A companion reviewed the detected hold colors before route setup.':
    '陪同者已在路线设置前检查了识别出的岩点颜色。',
  'Companion reviewed hold colors before route setup.':
    '陪同者已在路线设置前检查岩点颜色。',
  'Unable to save hold color review.': '无法保存岩点颜色检查。',
  'No same-colour route is available after color review.':
    '颜色检查后没有可用的同色路线。',
  'A companion reviewed the detected holds before route setup.':
    '陪同者已在进入路线设置前检查识别出的岩点。',
  'Companion reviewed hold detections before route setup.':
    '陪同者已在进入路线设置前检查岩点识别结果。',
  'Manual hold review saved.': '人工岩点检查结果已保存。',
  'At least one hold must remain on the wall.': '墙面上至少要保留一个岩点。',
  'Only tap holds with the selected route color. Correct hold colors from the scan page if this hold belongs here.':
    '请只点击当前路线颜色的岩点。如果这个岩点应属于路线，请先回扫描页纠正颜色。',
  'Companion recommended': '建议有人陪同',
  'The wall is only partly stable for recognition, so autonomous guidance should stay paused.':
    '当前岩墙识别只达到部分稳定，自主引导应暂时暂停。',
  'Recognition is only partly stable. Use companion support before continuing.':
    '识别结果还不够稳定，请由陪同者确认后再继续。',
  'Retake required': '需要重新扫描',
  'Recognition quality is too weak for autonomous guidance.': '识别质量不足以支持自主引导。',
  'Recognition is not clear enough yet.': '识别结果还不够清晰。',
  'Recognition is not clear enough yet. Retake the photo or try a clearer angle.':
    '识别结果还不够清晰。请重拍，或换一个更清楚的角度。',
  'Pause live guidance': '暂停实时引导',
  'Wall alignment is not stable enough yet, so live cueing is paused.':
    '墙面对齐还不够稳定，实时提示已暂停。',
  'Wall alignment is not stable yet, so live guidance is paused.':
    '墙面对齐还不稳定，实时引导已暂停。',
  'The scan-to-camera alignment is missing or unreliable.': '扫描图与相机画面的对齐缺失或不可靠。',
  'The scan and live camera are not aligned.': '扫描图和实时相机还没有对齐。',
  'Keep the camera aligned with the scanned wall and try recalibrating.':
    '请让相机继续对准已扫描的岩墙，并尝试重新校准。',
  'Keep the camera on the scanned wall and recalibrate.':
    '请让相机对准已扫描的岩墙，并重新校准。',
  'Wall alignment is still stabilising, so live cueing is paused for safety.':
    '墙面对齐仍在稳定中，为了安全先暂停实时提示。',
  'Wall alignment is still stabilizing, so live guidance is paused.':
    '墙面对齐仍在稳定中，实时引导已暂停。',
  'Hold position and keep the wall fully in frame.': '请保持姿势，并让整面墙留在画面内。',
  'Hold still and keep the full wall in frame.': '请保持不动，并让整面墙留在画面内。',
  'Pose tracking reported an error.': '姿态追踪报告了错误。',
  'Pose tracking had an error.': '姿态追踪出现错误。',
  'Bring the climber back into frame before continuing.': '继续前请让攀爬者重新进入画面。',
  'The locked climber is not clear enough in frame for precise live cueing.':
    '当前锁定的攀爬者在画面中不够清晰，暂时无法精确实时提示。',
  'The climber is not clear enough in frame for live guidance.':
    '攀爬者在画面中不够清晰，实时引导已暂停。',
  'A clear full-body view is required before new cues can be trusted.':
    '需要清晰的全身画面，新的提示才可靠。',
  'Show the full body clearly before following new cues.':
    '请先让全身清楚入镜，再跟随新的提示。',
  'The system is still searching for the primary climber.': '系统仍在寻找主要攀爬者。',
  'The system is still finding the climber.': '系统仍在寻找攀爬者。',
  'A stable climber lock has not been established yet.': '还没有稳定锁定当前攀爬者。',
  'Keep the climber in frame until tracking is stable.':
    '请让攀爬者留在画面内，直到追踪稳定。',
  'The tracker is preventing a switch to a nearby person.': '追踪器正在避免误切换到附近其他人。',
  'Tracking is avoiding a nearby person.': '追踪正在避开旁边的人。',
  'Wait for the climber lock to settle again before trusting new cues.':
    '请等攀爬者锁定重新稳定后，再继续相信新的提示。',
  'Wait until the climber is tracked again.': '请等待系统重新追踪到攀爬者。',
  'Nearby movement is interfering with pose tracking, so new live cues are paused.':
    '附近动作正在干扰姿态追踪，新的实时提示已暂停。',
  'Nearby movement is affecting tracking, so live guidance is paused.':
    '附近动作正在影响追踪，实时引导已暂停。',
  'Keep other people out of the camera view if possible.': '可以的话，请让其他人离开相机画面。',
  'Live guidance ready': '实时引导已就绪',
  'Pose tracking, wall alignment, and scan safety all look stable enough for live cueing.':
    '姿态追踪、墙面对齐和扫描安全状态都足够稳定，可以进行实时提示。',
  'Pose tracking, wall alignment, and scan quality are ready for live guidance.':
    '姿态追踪、墙面对齐和扫描质量都已就绪，可以开始实时引导。',
  'Hold the phone steadier or pause movement before taking the photo.':
    '拍摄前请把手机拿稳，或先停下移动。',
  'Move closer to the wall lighting or avoid underexposed corners.':
    '请靠近墙面光源，或避开过暗角落。',
  'Reduce glare by changing angle or moving away from direct spotlights.':
    '请换个角度，或避开直射灯光来减少反光。',
  'Step back slightly so the full route start and finish are visible together.':
    '请稍微后退，让路线起点和终点同时进入画面。',
  'Try a straighter front-on angle so route colors separate more clearly.':
    '请尽量正对岩墙拍摄，让不同颜色的路线更容易区分。',
  'Recognition is stable. You can continue with automatic route selection.':
    '识别结果稳定，可以继续选择路线。',
  'Recognition is stable. You can continue with route selection.':
    '识别结果稳定，可以继续选择路线。',
  'Autonomous guidance is gated by recognition confidence instead of manual correction.':
    '系统会根据识别清晰度决定是否继续引导。',
  'Autonomous guidance is only enabled when recognition confidence and image quality both clear the accessibility gate.':
    '只有识别和画面质量足够清晰时，才会开始路线引导。',
  'Route guidance starts only when recognition is clear enough.':
    '只有识别足够清晰时，才会开始路线引导。',
  'Route guidance starts only when recognition and image quality are clear enough.':
    '只有识别和画面质量足够清晰时，才会开始路线引导。',
  'If confidence is low, the system should ask for a retake or switch to companion mode.':
    '如果识别不够清晰，系统会提示重拍或建议陪同。',
  'Retake the photo if recognition is unclear, or continue with companion support.':
    '如果识别不清楚，请重拍，或在陪同支持下继续。',
  'Select at least two same-colour holds before starting live guidance.':
    '开始实时引导前，请至少选择两个同色岩点。',
  'Unable to load the saved wall scan.': '无法加载已保存的岩墙扫描。',
  'Unable to create the climb session.': '无法创建本次攀爬记录。',
  'Unable to load the recommended route.': '无法加载推荐路线。',
  'Unable to start live guidance.': '无法开始实时引导。',
  'Unable to load live guidance data.': '无法加载实时引导数据。',
  'Unable to advance the live guidance cue.': '无法切换到下一条实时提示。',
  'Unable to finish the session.': '无法结束本次攀爬。',
  'Recalibration failed.': '重新校准失败。',
  'Unable to load the climb summary.': '无法加载攀爬总结。',
  'Pose tracker unavailable': '姿态追踪不可用',
  'Pose tracking failed.': '姿态追踪失败。',
  'Waiting for wall alignment': '等待墙面对齐',
  'Aligning scanned wall to the live camera': '正在把扫描墙面与实时相机对齐',
  'Wall alignment unavailable': '墙面对齐不可用',
  'Holding the last wall alignment lock': '正在保留上一次墙面对齐锁定',
  'The scan reference image is not ready for wall alignment.': '用于墙面对齐的扫描参考图还没有准备好。',
  'Wall alignment is not reliable yet.': '墙面对齐暂时还不可靠。',
  'Wall alignment failed.': '墙面对齐失败。',
  'Scan reference image unavailable': '扫描参考图不可用',
  'The wall map is missing hold data.': '岩墙地图缺少岩点数据。',
  'No scanned wall reference image is available.': '没有可用的已扫描岩墙参考图。',
  'No active target yet': '还没有当前目标',
  'Waiting for the active limb': '等待当前肢体进入画面',
  'No cue available': '暂无提示',
};

export function localizeAssistText(text: string | null | undefined, language: Language): string {
  if (!text) return '';
  if (language !== 'zh') return text;

  const exact = exactTextZh[text];
  if (exact) return exact;

  const lowerText = text.toLowerCase();

  if (
    lowerText.includes('same wall framing') ||
    lowerText.includes('another moment') ||
    (lowerText.includes('wall alignment') && lowerText.includes('reliable'))
  ) {
    return '墙面对齐还不够稳定，请先保持镜头继续对准同一面墙。';
  }

  const wallComplete = text.match(
    /^Wall scan complete\. (\d+) holds and (\d+) route colors are ready for route setup\.$/,
  );
  if (wallComplete) {
    return `岩墙扫描完成。已识别 ${wallComplete[1]} 个岩点和 ${wallComplete[2]} 种路线颜色，可以继续设置路线。`;
  }

  const wallReady = text.match(
    /^The wall looks clear enough for route setup\. (\d+) holds and (\d+) route candidates passed the accessibility gate\.$/,
  );
  if (wallReady) {
    return `岩墙画面足够清晰。已识别 ${wallReady[1]} 个岩点，${wallReady[2]} 条候选路线通过了无障碍检查。`;
  }

  const wallReadySimple = text.match(
    /^The wall looks ready\. (\d+) holds and (\d+) route options were found\.$/,
  );
  if (wallReadySimple) {
    return `岩墙已就绪。已识别 ${wallReadySimple[1]} 个岩点和 ${wallReadySimple[2]} 条路线。`;
  }

  const scanPaused = text.match(/^Scan paused\. (.+)$/);
  if (scanPaused) {
    return `扫描已暂停。${localizeAssistText(scanPaused[1], language)}`;
  }

  const detectedProvider = text.match(/^Detected (\d+) hold candidates using the (.+) provider\.$/);
  if (detectedProvider) {
    return `已通过 ${detectedProvider[2]} 识别到 ${detectedProvider[1]} 个候选岩点。`;
  }

  const alignmentOnly = text.match(/^Alignment quality is only (\d+)%\.$/);
  if (alignmentOnly) {
    return `墙面对齐质量目前只有 ${alignmentOnly[1]}%。`;
  }

  const poseQuality = text.match(/^Pose quality is (\d+)%\.$/);
  if (poseQuality) {
    return `姿态识别质量目前为 ${poseQuality[1]}%。`;
  }

  const poseQualityShort = text.match(/^Pose quality (\d+)%\.$/);
  if (poseQualityShort) {
    return `姿态识别质量 ${poseQualityShort[1]}%。`;
  }

  const wallAlignment = text.match(/^Wall alignment (\d+)%\.$/);
  if (wallAlignment) {
    return `墙面对齐 ${wallAlignment[1]}%。`;
  }

  const locked = text.match(/^Wall alignment locked \((\d+)%\)$/);
  if (locked) {
    return `墙面对齐已锁定（${locked[1]}%）`;
  }

  const stabilising = text.match(/^Wall alignment stabilising \((\d+)%\)$/);
  if (stabilising) {
    return `墙面对齐稳定中（${stabilising[1]}%）`;
  }

  return text;
}

export function formatHoldColor(color: string | null | undefined, language: Language, uppercase = false) {
  if (!color) return '';
  if (language === 'zh') {
    return colorLabelsZh[color as HoldColor] ?? color;
  }
  return uppercase ? color.toUpperCase() : color;
}

export function formatDifficulty(difficulty: string | null | undefined, language: Language) {
  if (!difficulty) return '';
  return language === 'zh' ? difficultyLabelsZh[difficulty] ?? difficulty : difficulty;
}

export function formatScanSource(source: string | null | undefined, language: Language) {
  if (!source) return '';
  if (language !== 'zh') return source;
  if (source === 'camera') return '相机';
  if (source === 'upload') return '上传';
  return source;
}

export function formatRouteStartRegion(region: RouteStartRegion, language: Language) {
  return language === 'zh' ? startRegionLabelsZh[region] : startRegionLabelsEn[region];
}

export function formatRouteStartType(type: RouteStartType, language: Language) {
  return language === 'zh' ? startTypeLabelsZh[type] : startTypeLabelsEn[type];
}

export function formatRouteFinishType(type: RouteFinishType, language: Language) {
  return language === 'zh' ? finishTypeLabelsZh[type] : finishTypeLabelsEn[type];
}

export function formatReviewState(state: RouteReviewState, language: Language) {
  return language === 'zh' ? reviewStateLabelsZh[state] : reviewStateLabelsEn[state];
}

export function describeRouteSemantics(semantics: RouteSemantics, language: Language) {
  if (language !== 'zh') return semantics.reviewSummary;

  const start = formatRouteStartType(semantics.startType, language);
  const finish = formatRouteFinishType(semantics.finishType, language);
  const state = formatReviewState(semantics.reviewState, language);

  return `${state}。系统判断这条线为${start}、${finish}，可达性 ${semantics.reachabilityScore}%，稳定性 ${semantics.stabilityScore}%。`;
}

export function getRouteSemanticsNotes(semantics: RouteSemantics, language: Language, limit = 3) {
  if (language !== 'zh') return semantics.setterNotes.slice(0, limit);

  const notes = [
    `起步：${formatRouteStartType(semantics.startType, language)}。`,
    `结束：${formatRouteFinishType(semantics.finishType, language)}。`,
    semantics.supportHoldIds.length > 0
      ? `系统加入了 ${semantics.supportHoldIds.length} 个辅助脚点，让大跨度动作更稳定。`
      : '这条路线暂时不需要额外辅助脚点。',
  ];

  return notes.slice(0, limit);
}

export function getRouteReviewHints(semantics: RouteSemantics, language: Language, limit = 2) {
  if (language !== 'zh') return semantics.reviewHints.slice(0, limit);

  if (semantics.reviewState === 'auto-approved') {
    return ['路线检查已通过，开始前仍建议快速确认起点、终点和落脚点。'].slice(0, limit);
  }

  const hints = [
    '建议人工复核起步和终点是否符合实际贴线。',
    '如果某一步跨度过大，可以编辑同色岩点后再开始实时引导。',
    '开始前请确认高处动作和脚点支撑都足够稳定。',
  ];
  return hints.slice(0, limit);
}

export function describeRoutePlan(route: RoutePlan, language: Language, colorOverride?: string) {
  if (language !== 'zh') return route.summary;

  const color = formatHoldColor(colorOverride ?? route.color, language);
  const semantics = route.semantics;
  const semanticText = semantics
    ? `起步为${formatRouteStartType(semantics.startType, language)}，结束为${formatRouteFinishType(semantics.finishType, language)}。`
    : '';

  return `${color}路线已规划，共 ${route.holds.length} 个岩点，预计 ${route.estimatedMoves} 步。${semanticText}`;
}

export function describeRouteCandidate(candidate: RouteCandidate, language: Language) {
  if (language !== 'zh') return candidate.summary;

  const color = formatHoldColor(candidate.color, language);
  const region = formatRouteStartRegion(candidate.startRegion, language);
  const semantics = candidate.semantics
    ? `，${formatRouteStartType(candidate.semantics.startType, language)}，${formatRouteFinishType(candidate.semantics.finishType, language)}`
    : '';

  return `${color}候选路线，${region}，共 ${candidate.holdIds.length} 个岩点，预计 ${candidate.estimatedMoves} 步${semantics}`;
}

export function formatHoldTarget(hold: Hold | null | undefined, language: Language) {
  if (!hold) return language === 'zh' ? '暂无目标岩点' : 'No active target yet';
  const color = formatHoldColor(hold.color, language);
  if (language === 'zh') {
    const horizontal = hold.xPct < 34 ? '左侧' : hold.xPct > 66 ? '右侧' : '中间';
    const vertical = hold.yPct < 28 ? '上方' : hold.yPct > 72 ? '下方' : '中间';
    const region = horizontal === '中间' && vertical === '中间'
      ? '中间'
      : horizontal === '中间'
        ? vertical
        : vertical === '中间'
          ? horizontal
          : `${horizontal}${vertical}`;

    if (hold.role === 'finish') return `${region}${color}终点`;
    if (hold.role === 'foot') return `${region}${color}脚点`;
    if (hold.role === 'start') return `${region}${color}起始点`;
    return `${region}${color}手点`;
  }
  return `${hold.label} (${hold.color})`;
}

export function formatAlignmentStatus(alignmentState: LiveWallAlignmentState, language: Language) {
  const base = alignmentState.error
    ? localizeAssistText(alignmentState.error, language)
    : localizeAssistText(alignmentState.statusLabel, language);

  if (language !== 'zh' || !alignmentState.detector || alignmentState.error) {
    return base;
  }

  return `${base}，检测器：${alignmentState.detector}`;
}

export function formatSessionDifficulty(session: ClimbSession | null, language: Language, fallback = 'Beginner') {
  return formatDifficulty(session?.difficulty ?? fallback, language);
}
