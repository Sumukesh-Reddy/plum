import { Link, useLocation } from 'react-router-dom';
import { BarChart3, ClipboardList, FileClock, FileText, LayoutDashboard } from 'lucide-react';

const links = [
  { to: '/',        label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/upload',  label: 'Submit Claim',    icon: FileText },
  { to: '/history', label: 'History',         icon: FileClock },
  { to: '/policy',  label: 'Policy Settings', icon: ClipboardList },
  { to: '/metrics', label: 'AI Metrics',      icon: BarChart3 },
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
        {links.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`nav-link ${pathname === to ? 'active' : ''}`}
          >
            <Icon size={17} strokeWidth={2.2} />
            {label}
          </Link>
        ))}
      </nav>

      
    </aside>
  );
}
