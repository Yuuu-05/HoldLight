import Button from '../ui/Button';
import { useSpeech } from '../../../app/providers/SpeechProvider';

interface SpeakButtonProps {
  text: string;
  label?: string;
}

export default function SpeakButton({ text, label = 'Read aloud' }: SpeakButtonProps) {
  const { speak } = useSpeech();
  return <Button variant="secondary" onClick={() => speak(text)}>{label}</Button>;
}
