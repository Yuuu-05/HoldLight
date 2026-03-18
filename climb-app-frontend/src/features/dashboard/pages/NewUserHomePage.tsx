import RoleActionCards from '../components/RoleActionCards';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';

export default function NewUserHomePage() {
  const { t } = useLanguage();
  return (
    <RoleActionCards
      intro={t('Build confidence with a simple learning path before trying harder routes.')}
      items={[
        {
          title: t('Start with safety'),
          description: t('Read the beginner safety tutorial and follow the guided learning sequence.'),
          to: routes.tutorialSafety,
          buttonLabel: t('Open safety tutorial'),
        },
        {
          title: t('Continue tutorials'),
          description: t('Review rules, equipment, and terms with read-aloud support.'),
          to: routes.tutorialHome,
          buttonLabel: t('Open tutorial hub'),
        },
        {
          title: t('Accessibility hub'),
          description: t('Turn on voice feedback, large text, and contrast support before climbing.'),
          to: routes.accessibilityHub,
          buttonLabel: t('Open accessibility hub'),
        },
        {
          title: t('Try scan preview'),
          description: t('Use the assisted scan entry point when you feel ready to test the flow.'),
          to: routes.scanWall,
          buttonLabel: t('Start scan'),
        },
      ]}
    />
  );
}
