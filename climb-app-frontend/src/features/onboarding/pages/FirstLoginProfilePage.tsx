import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Button from '../../../shared/components/ui/Button';
import BasicProfileForm from '../components/BasicProfileForm';
import ProfileCompletionStepper from '../components/ProfileCompletionStepper';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

export default function FirstLoginProfilePage() {
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username ?? '');
  const [profile, setProfile] = useState(user?.profile ?? {});
  const [loading, setLoading] = useState(false);

  usePageTitle(t('Complete profile'));

  const completed = useMemo(
    () =>
      ['gender', 'birthday', 'height', 'weight', 'climbingExperience'].filter((key) =>
        Boolean((profile as Record<string, unknown>)[key]),
      ).length,
    [profile],
  );

  async function handleSave() {
    setLoading(true);
    try {
      await updateProfile({ username, profile });
      navigate(routes.dashboard);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="stack-lg">
      <div className="page-card stack-lg">
        <div className="stack-sm">
          <h1>{t('Complete your profile')}</h1>
          <p>
            {t('This information powers role-based experiences, accessible settings, and volunteer matching.')}
          </p>
        </div>

        <label className="field">
          <span className="field-label">{t('Display name')}</span>
          <input
            className="field-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <ProfileCompletionStepper completed={completed} total={5} />
        <p className="subtle-text">
          {t('The accessibility assistance field is optional, but recommended if you want voice support, higher contrast, or volunteer guidance.')}
        </p>

        <BasicProfileForm profile={profile} setProfile={setProfile} />

        <div className="inline-actions wrap">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? t('Saving...') : t('Save profile')}
          </Button>
          <Button variant="ghost" onClick={() => navigate(routes.dashboard)}>
            {t('Skip for now')}
          </Button>
        </div>
      </div>
    </section>
  );
}
