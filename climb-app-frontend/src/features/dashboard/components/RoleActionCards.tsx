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
    <div className="stack-lg">
      <p>{intro}</p>
      <div className="grid-2">
        {items.map((item) => (
          <Card key={item.to} title={item.title}>
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
