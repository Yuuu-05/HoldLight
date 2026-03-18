import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { routes } from '../../../shared/constants/routes';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import PasswordField from './PasswordField';

export default function LoginForm() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate(routes.dashboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Unable to sign in.');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <Input
        label={t('Email')}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <PasswordField value={password} onChange={setPassword} />
      {error ? <ErrorState message={error} /> : null}
      <Button type="submit" disabled={loading}>
        {loading ? t('Signing in...') : t('Login')}
      </Button>
    </form>
  );
}
