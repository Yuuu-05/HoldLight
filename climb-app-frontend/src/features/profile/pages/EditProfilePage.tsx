import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { routes } from '../../../shared/constants/routes';
import BasicProfileForm from '../../onboarding/components/BasicProfileForm';

export default function EditProfilePage() {
  const { user, updateProfile } = useAuth();
  const { announce } = useAccessibility();
  const { t } = useLanguage();
  const [username, setUsername] = useState(user?.username ?? '');
  const [profile, setProfile] = useState(user?.profile ?? {});
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  usePageTitle('Edit profile');

  if (!user) return null;

  async function handleSave() {
    if (!username.trim()) {
      const message = t('Please enter a username.');
      setFieldError(message);
      announce(message);
      window.setTimeout(() => {
        document.getElementById('edit-profile-username')?.focus();
      }, 0);
      return;
    }

    setFieldError('');
    setError('');
    setSaving(true);

    try {
      await updateProfile({ username: username.trim(), profile });
      navigate(routes.profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Unable to save your profile.');
      setError(message);
      announce(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-card stack-lg profile-edit-page" aria-labelledby="profile-edit-heading">
      <div className="profile-edit-hero">
        <div className="stack-sm">
          <h1 id="profile-edit-heading">{t('Edit profile')}</h1>
        </div>
      </div>

      <form
        className="profile-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
        noValidate
      >
        <section className="profile-edit-section">
          <Input
            id="edit-profile-username"
            label={t('Username')}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setFieldError('');
            }}
            autoComplete="username"
            required
            error={fieldError}
          />
        </section>

        <section className="profile-edit-section">
          <BasicProfileForm profile={profile} setProfile={setProfile} />
        </section>

        {error ? <ErrorState message={error} /> : null}

        <div className="profile-edit-actions">
          <Button type="submit" disabled={saving}>{saving ? t('Saving...') : t('Save changes')}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate(routes.profile)} disabled={saving}>
            {t('Cancel')}
          </Button>
        </div>
      </form>
    </section>
  );
}
