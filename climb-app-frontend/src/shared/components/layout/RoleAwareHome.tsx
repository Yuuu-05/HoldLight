import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { getRoleLabel } from '../../utils/getRoleLabel';
import Card from '../ui/Card';

export default function RoleAwareHome() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const roleLabel = t(getRoleLabel(user?.role));

  return (
    <Card title={t('Your role overview')} className="role-overview-card dashboard-role-card">
      <div className="stack-sm">
        <span className="role-chip">{roleLabel}</span>
      </div>
    </Card>
  );
}
