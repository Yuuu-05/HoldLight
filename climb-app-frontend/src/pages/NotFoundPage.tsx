import { Link } from 'react-router-dom';
import { routes } from '../shared/constants/routes';

export default function NotFoundPage() {
  return (
    <section className="page-card center-card">
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link className="text-link" to={routes.home}>Go back home</Link>
    </section>
  );
}
