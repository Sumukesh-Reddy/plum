import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/',        label: 'Dashboard' },
  { to: '/upload',  label: 'Submit Claim' },
  { to: '/history', label: 'History' },
];

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">P</div>
        <span className="sidebar-logo-text">Plum Claims</span>
      </div>

      <nav>
        {links.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`nav-link ${pathname === to ? 'active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
