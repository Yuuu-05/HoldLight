import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { routes } from '../../../shared/constants/routes';

export default function LogoutPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logout().finally(() => navigate(routes.home, { replace: true }));
  }, [logout, navigate]);

  return (
    <section className="page-card center-card">
      <h1>Logging out</h1>
      <p>Please wait…</p>
    </section>
  );
}
