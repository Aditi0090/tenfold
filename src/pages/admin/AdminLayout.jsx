import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  const links = [
    ['/admin', 'Reports', true], ['/admin/users', 'Users'], ['/admin/draws', 'Draws'],
    ['/admin/winners', 'Winners'], ['/admin/charities', 'Charities'],
  ];
  return (
    <div className="admin">
      <nav className="admin-side" aria-label="Admin">
        {links.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
      </nav>
      <div className="admin-main"><Outlet /></div>
    </div>
  );
}
