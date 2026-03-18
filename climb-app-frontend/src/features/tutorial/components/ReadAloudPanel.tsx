import SpeakButton from '../../../shared/components/accessibility/SpeakButton';
import Button from '../../../shared/components/ui/Button';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface ReadAloudPanelProps {
  text: string;
}

export default function ReadAloudPanel({ text }: ReadAloudPanelProps) {
  const { repeat } = useSpeech();
  const { t } = useLanguage();
  return (
    <div className="inline-actions wrap">
      <SpeakButton text={text} label={t('Read this page aloud')} />
      <Button variant="ghost" onClick={repeat}>{t('Repeat last prompt')}</Button>
    </div>
  );
}
