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
    <section className="page-card stack-lg profile-edit-page" aria-labelledby="profile-edit-heading">
      <div className="profile-edit-hero">
        <div className="stack-sm">
          <p className="subtle-text">{t('Climbing passport')}</p>
          <h1 id="profile-edit-heading">{t('Edit profile')}</h1>
          <p>{t('Update personal details, climbing experience, and your preferred climbing notes.')}</p>
        </div>

        <div className="profile-edit-stamp" aria-hidden="true">
          <span>EDIT</span>
        </div>
      </div>

      <form
        className="profile-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <section className="profile-edit-section">
          <label className="field">
            <span className="field-label">{t('Username')}</span>
            <input
              className="field-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
        </section>

        <section className="profile-edit-section">
          <BasicProfileForm profile={profile} setProfile={setProfile} />
        </section>

        <div className="profile-edit-actions">
          <Button type="submit">{t('Save changes')}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate(routes.profile)}>
            {t('Cancel')}
          </Button>
        </div>
      </form>
    </section>
  );
}
