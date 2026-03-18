import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import BasicProfileForm from '../../onboarding/components/BasicProfileForm';

export default function EditProfilePage() {
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState(user?.username ?? '');
  const [profile, setProfile] = useState(user?.profile ?? {});
  const navigate = useNavigate();

  usePageTitle('Edit profile');

  if (!user) return null;

  async function handleSave() {
    await updateProfile({ username, profile });
    navigate(routes.profile);
  }

  return (
    <section className="page-card stack-lg">
      <div className="stack-sm">
        <h1>{t('Edit profile')}</h1>
        <p>{t('Update personal details, climbing experience, and accessibility support needs.')}</p>
      </div>

      <label className="field">
        <span className="field-label">{t('Username')}</span>
        <input
          className="field-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>

      <BasicProfileForm profile={profile} setProfile={setProfile} />

      <div className="inline-actions wrap">
        <Button onClick={handleSave}>{t('Save changes')}</Button>
        <Button variant="ghost" onClick={() => navigate(routes.profile)}>
          {t('Cancel')}
        </Button>
      </div>
    </section>
  );
}
