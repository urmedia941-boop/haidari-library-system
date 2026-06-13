import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import POS from './pages/POS.jsx';
import Books from './pages/Books.jsx';
import Cafeteria from './pages/Cafeteria.jsx';
import Inventory from './pages/Inventory.jsx';
import Discounts from './pages/Discounts.jsx';
import Purchases from './pages/Purchases.jsx';
import Expenses from './pages/Expenses.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Reports from './pages/Reports.jsx';
import SalesHistory from './pages/SalesHistory.jsx';
import Settings from './pages/Settings.jsx';

function Protected({ children, title }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout title={title}>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected title="داشبۆرد"><Dashboard /></Protected>} />
      <Route path="/pos" element={<Protected title="خاڵی فرۆشتن"><POS /></Protected>} />
      <Route path="/books" element={<Protected title="بەڕێوەبردنی کتێب"><Books /></Protected>} />
      <Route path="/cafeteria" element={<Protected title="بەڕێوەبردنی کافتریا"><Cafeteria /></Protected>} />
      <Route path="/inventory" element={<Protected title="کۆگا"><Inventory /></Protected>} />
      <Route path="/discounts" element={<Protected title="داشکاندن و پڕۆمۆشن"><Discounts /></Protected>} />
      <Route path="/purchases" element={<Protected title="کڕینەکان"><Purchases /></Protected>} />
      <Route path="/expenses" element={<Protected title="خەرجییەکان"><Expenses /></Protected>} />
      <Route path="/suppliers" element={<Protected title="دابینکەران"><Suppliers /></Protected>} />
      <Route path="/reports" element={<Protected title="ڕاپۆرتەکان"><Reports /></Protected>} />
      <Route path="/sales" element={<Protected title="مێژووی فرۆشتن"><SalesHistory /></Protected>} />
      <Route path="/settings" element={<Protected title="ڕێکخستن و کۆپیەدەگ"><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
