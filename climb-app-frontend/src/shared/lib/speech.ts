export function canUseSpeechSynthesis() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakText(text: string, options?: { rate?: number; pitch?: number }) {
  if (!canUseSpeechSynthesis()) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 1;
  utterance.pitch = options?.pitch ?? 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (!canUseSpeechSynthesis()) return;
  window.speechSynthesis.cancel();
}
