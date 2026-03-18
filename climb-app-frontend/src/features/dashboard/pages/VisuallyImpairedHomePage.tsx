import RoleActionCards from '../components/RoleActionCards';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';

export default function VisuallyImpairedHomePage() {
  const { t } = useLanguage();
  return (
    <RoleActionCards
      intro={t('Use voice-first and lower-stress navigation paths before starting a session.')}
      items={[
        {
          title: t('Accessibility hub'),
          description: t('Turn on spoken feedback, large text, contrast support, and voice commands.'),
          to: routes.accessibilityHub,
          buttonLabel: t('Open accessibility hub'),
        },
        {
          title: t('Voice mode demo'),
          description: t('Practice commands like start scan, repeat hint, and return home.'),
          to: routes.voiceMode,
          buttonLabel: t('Open voice mode'),
        },
        {
          title: t('Focus preview'),
          description: t('Preview the VoiceOver-style focus flow with current element announcements.'),
          to: routes.focusPreview,
          buttonLabel: t('Open focus preview'),
        },
        {
          title: t('Find support'),
          description: t('Browse volunteer support requests and lightweight contact intent options.'),
          to: routes.scanWall,
          buttonLabel: t('Find support'),
        },
      ]}
    />
  );
}
