import RoleActionCards from '../components/RoleActionCards';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';

export default function ExperiencedHomePage() {
  const { t } = useLanguage();
  return (
    <RoleActionCards
      intro={t('Explore the community layer, preview the assist flow, and help others through volunteer support.')}
      items={[
        {
          title: t('Community feed'),
          description: t('Browse posts, discussions, and accessibility-related sharing from other users.'),
          to: routes.socialFeed,
          buttonLabel: t('Open feed'),
        },
        {
          title: t('Create a post'),
          description: t('Share climbing tips, route practice notes, or support experiences.'),
          to: routes.createPost,
          buttonLabel: t('Create post'),
        },
        {
          title: t('Find support'),
          description: t('See who needs guidance and review available support sessions.'),
          to: routes.scanWall,
          buttonLabel: t('Find support'),
        },
        {
          title: t('Route demo'),
          description: t('Try the route scan and route recommendation prototype flow.'),
          to: routes.scanWall,
          buttonLabel: t('Open route demo'),
        },
      ]}
    />
  );
}
