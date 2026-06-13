import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, apiError, money } from '../api.js';
import { Loading, StatCard } from '../components/ui.jsx';

const COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).catch((e) => setError(apiError(e)));
  }, []);

  if (error) return <div className="error-text">{error}</div>;
  if (!data) return <Loading />;

  const sectionData = data.by_section.map((s) => ({
    name: s.section === 'library' ? 'کتێبخانە' : s.section === 'cafeteria' ? 'کافتریا' : 'تێکەڵ',
    value: Number(s.amount),
  }));
  const trend = data.sales_trend.map((d) => ({
    day: d.day.slice(5),
    amount: Number(d.amount),
  }));

  return (
    <>
      <div className="grid cols-4">
        <StatCard label="فرۆشی ئەمڕۆ" value={money(data.today.amount)} sub={`${data.today.count} مامەڵە`} />
        <StatCard label="داهاتی ئەم مانگە" value={money(data.month.revenue)} color="#0d9488" />
        <StatCard label="قازانجی ئەم مانگە" value={money(data.month.profit)} color="#16a34a" />
        <StatCard
          label="ئاگاداری کۆگا"
          value={data.low_stock_count}
          sub="کاڵای کەمبوو"
          color={data.low_stock_count > 0 ? '#dc2626' : '#16a34a'}
        />
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>فرۆش لە ١٤ ڕۆژی ڕابردوو</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="amount" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>فرۆش بەپێی بەش</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sectionData} dataKey="value" nameKey="name" outerRadius={95} label>
                {sectionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => money(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <TopList title="پڕفرۆشترین کتێبەکان" rows={data.top_books} />
        <TopList title="پڕفرۆشترین بەرهەمی کافتریا" rows={data.top_cafeteria} />
      </div>
    </>
  );
}

function TopList({ title, rows }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <div className="muted">هیچ داتایەک نییە</div>
      ) : (
        <table>
          <thead>
            <tr><th>بەرهەم</th><th>دانە</th><th>داهات</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id || r.product_name}>
                <td>{r.product_name}</td>
                <td>{r.qty}</td>
                <td>{money(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
