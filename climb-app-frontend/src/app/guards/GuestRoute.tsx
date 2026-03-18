import { Navigate } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { routes } from '../../shared/constants/routes';

export default function GuestRoute({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to={routes.dashboard} replace />;
  return <>{children}</>;
}
