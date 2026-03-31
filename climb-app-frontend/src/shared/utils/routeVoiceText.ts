export function buildCueLabel(index: number, total: number, cue: string) {
  return `Caller cue ${index + 1} of ${total}. ${cue}`;
}
