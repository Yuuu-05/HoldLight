import { Link } from 'react-router-dom';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';

interface RoleActionItem {
  title: string;
  description: string;
  to: string;
  buttonLabel: string;
}

interface RoleActionCardsProps {
  intro: string;
  items: RoleActionItem[];
}

export default function RoleActionCards({ intro, items }: RoleActionCardsProps) {
  return (
    <div className="stack-lg dashboard-role-actions">
      <p className="subtle-text">{intro}</p>
      <div className="grid-2 dashboard-role-grid">
        {items.map((item, index) => (
          <Card
            key={`${item.to}-${index}`}
            title={item.title}
            className={`dashboard-role-action-card dashboard-role-action-card-${index % 4}`.trim()}
          >
            <p>{item.description}</p>
            <Link to={item.to}>
              <Button fullWidth>{item.buttonLabel}</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
