import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const NAV = [
  { section: 'گشتی' },
  { to: '/', label: 'داشبۆرد', end: true },
  { to: '/pos', label: 'خاڵی فرۆشتن (POS)' },
  { section: 'کتێبخانە و کافتریا' },
  { to: '/books', label: 'کتێبەکان' },
  { to: '/cafeteria', label: 'کافتریا' },
  { to: '/inventory', label: 'کۆگا' },
  { to: '/discounts', label: 'داشکاندن و پڕۆمۆشن' },
  { section: 'دارایی' },
  { to: '/purchases', label: 'کڕینەکان' },
  { to: '/expenses', label: 'خەرجییەکان' },
  { to: '/suppliers', label: 'دابینکەران' },
  { to: '/reports', label: 'ڕاپۆرتەکان' },
  { section: 'سیستەم', roles: ['admin', 'manager'] },
  { to: '/sales', label: 'مێژووی فرۆشتن', roles: ['admin', 'manager'] },
  { to: '/settings', label: 'ڕێکخستن و کۆپیەدەگ', roles: ['admin', 'manager'] },
];

export default function Layout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const items = NAV.filter((n) => !n.roles || n.roles.includes(user?.role));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          کتێبخانەی حەیدەری
          <span>سیستەمی یەکگرتووی بەڕێوەبردن</span>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {items.map((item, i) =>
            item.section ? (
              <div className="nav-section" key={`s${i}`}>{item.section}</div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="user">
            <div>
              <strong>{user?.full_name}</strong>{' '}
              <span className="badge gray">{roleLabel(user?.role)}</span>
            </div>
            <button className="ghost sm" onClick={handleLogout}>دەرچوون</button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function roleLabel(role) {
  return { admin: 'بەڕێوەبەر', manager: 'سەرپەرشتیار', cashier: 'کاشێر' }[role] || role;
}
