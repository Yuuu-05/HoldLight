export interface RecognitionResult {
  transcript: string;
  confidence?: number;
}

export function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function canUseSpeechRecognition() {
  return !!getSpeechRecognitionCtor();
}
