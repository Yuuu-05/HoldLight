import RoleActionCards from '../components/RoleActionCards';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';

export default function VolunteerHomePage() {
  const { t } = useLanguage();
  return (
    <RoleActionCards
      intro={t('Prepare for support sessions with clear request details, contact intents, and accessibility context.')}
      items={[
        {
          title: t('Find support'),
          description: t('Browse current support requests from climbers who need guidance.'),
          to: routes.scanWall,
          buttonLabel: t('Find support'),
        },
        {
          title: t('My sessions'),
          description: t('Review sessions you created or already expressed interest in.'),
          to: routes.volunteerMySessions,
          buttonLabel: t('Open my sessions'),
        },
        {
          title: t('Contact intents'),
          description: t('Read structured interest messages instead of managing full chat.'),
          to: routes.contactIntent,
          buttonLabel: t('View contact intents'),
        },
        {
          title: t('Preview accessibility tools'),
          description: t('Check spoken guidance and focus flow before helping a climber.'),
          to: routes.accessibilityHub,
          buttonLabel: t('Open accessibility tools'),
        },
      ]}
    />
  );
}
