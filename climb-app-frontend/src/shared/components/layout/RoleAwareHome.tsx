import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { getRoleLabel } from '../../utils/getRoleLabel';
import Card from '../ui/Card';

export default function RoleAwareHome() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const roleLabel = t(getRoleLabel(user?.role));

  return (
    <Card title={t('Your role overview')} className="role-overview-card dashboard-role-card">
      <div className="stack-sm">
        <span className="role-chip">{roleLabel}</span>
        <p>
          {language === 'zh'
            ? `你当前以 ${roleLabel} 身份登录。仪表盘会优先展示适合你角色的任务入口，并尽量减少页面跳转。`
            : `You are signed in as ${roleLabel}. The dashboard highlights tasks that fit your role and keeps navigation shallow for faster access.`}
        </p>
      </div>
    </Card>
  );
}
