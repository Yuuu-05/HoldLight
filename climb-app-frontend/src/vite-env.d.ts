/// <reference types="vite/client" />

interface Window {
  SpeechRecognition?: {
    new (): SpeechRecognition;
  };
  webkitSpeechRecognition?: {
    new (): SpeechRecognition;
  };
  Camera?: unknown;
  Pose?: new (config: { locateFile: (file: string) => string }) => {
    setOptions: (options: Record<string, unknown>) => void;
    onResults: (
      callback: (results: { poseLandmarks?: Array<{ x: number; y: number; visibility?: number }> }) => void,
    ) => void;
    send: (
      input: { image: HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap },
    ) => Promise<void>;
    close: () => void;
  };
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
