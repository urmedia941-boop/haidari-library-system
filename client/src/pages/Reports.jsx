import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { Empty, Loading, StatCard } from '../components/ui.jsx';

const TABS = [
  ['pl', 'قازانج و زەرەر'],
  ['category', 'فرۆش بەپێی پۆلێن'],
  ['website', 'فرۆشتنی ماڵپەڕ'],
  ['gifts', 'دیاری و خۆڕایی'],
  ['suppliers', 'دابینکەران'],
];

export default function Reports() {
  const [tab, setTab] = useState('pl');
  const [range, setRange] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    const params = {};
    if (range.from) params.from = range.from;
    if (range.to) params.to = range.to;
    const map = {
      pl: '/reports/profit-loss', category: '/reports/sales-by-category',
      website: '/reports/website', gifts: '/reports/gifts', suppliers: '/reports/suppliers',
    };
    api.get(map[tab], { params }).then((r) => setData(r.data));
  }, [tab, range]);

  return (
    <>
      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      <div className="toolbar">
        <div className="field"><label>لە بەرواری</label><input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div className="field"><label>تا بەرواری</label><input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      </div>

      {!data ? <Loading /> : (
        <>
          {tab === 'pl' && <ProfitLoss d={data} />}
          {tab === 'category' && <CategoryTable rows={data} />}
          {tab === 'website' && <Website d={data} />}
          {tab === 'gifts' && <Gifts d={data} />}
          {tab === 'suppliers' && <SupplierTable rows={data} />}
        </>
      )}
    </>
  );
}

function ProfitLoss({ d }) {
  return (
    <div className="grid cols-3">
      <StatCard label="کۆی داهات" value={money(d.revenue)} color="#0d9488" />
      <StatCard label="تێچووی کاڵای فرۆشراو" value={money(d.cogs)} />
      <StatCard label="داشکاندن" value={money(d.discounts)} />
      <StatCard label="قازانجی گشتی" value={money(d.gross_profit)} color="#16a34a" />
      <StatCard label="خەرجییەکان" value={money(d.expenses)} color="#dc2626" />
      <StatCard label="قازانجی ساف" value={money(d.net_profit)} color={d.net_profit >= 0 ? '#16a34a' : '#dc2626'} />
    </div>
  );
}

function CategoryTable({ rows }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="card" style={{ padding: 0 }}>
      <table>
        <thead><tr><th>پۆلێن</th><th>جۆر</th><th>دانە</th><th>داهات</th><th>تێچوو</th><th>قازانج</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.category}</td>
              <td>{r.product_type === 'book' ? 'کتێب' : 'کافتریا'}</td>
              <td>{r.qty}</td>
              <td>{money(r.revenue)}</td>
              <td>{money(r.cost)}</td>
              <td style={{ color: 'var(--success)' }}>{money(r.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Website({ d }) {
  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <StatCard label="کۆی فرۆشتنی ماڵپەڕ" value={money(d.summary.revenue)} color="#3b82f6" />
        <StatCard label="ژمارەی داواکاری" value={d.summary.orders} />
        <StatCard label="قازانج" value={money(d.summary.profit)} color="#16a34a" />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>بەرهەم</th><th>دانە</th><th>داهات</th></tr></thead>
          <tbody>
            {d.top_products.length === 0
              ? <tr><td colSpan="3"><div className="empty">هیچ فرۆشتنێکی ماڵپەڕ نییە</div></td></tr>
              : d.top_products.map((p, i) => (
                <tr key={i}><td>{p.product_name}</td><td>{p.qty}</td><td>{money(p.revenue)}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Gifts({ d }) {
  return (
    <div className="grid cols-2">
      <div className="card" style={{ padding: 0 }}>
        <h3 style={{ padding: '14px 14px 0' }}>کاڵای دیاری بەخشراو</h3>
        <table>
          <thead><tr><th>بەرهەم</th><th>جۆر</th><th>بڕ</th></tr></thead>
          <tbody>
            {d.given_as_gift.length === 0 ? <tr><td colSpan="3"><div className="empty">نییە</div></td></tr>
              : d.given_as_gift.map((r, i) => <tr key={i}><td>{r.product_name}</td><td>{r.product_type === 'book' ? 'کتێب' : 'کافتریا'}</td><td>{r.qty}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <h3 style={{ padding: '14px 14px 0' }}>کاڵای خۆڕایی وەرگیراو</h3>
        <table>
          <thead><tr><th>بەرهەم</th><th>جۆر</th><th>بڕ</th></tr></thead>
          <tbody>
            {d.received_free.length === 0 ? <tr><td colSpan="3"><div className="empty">نییە</div></td></tr>
              : d.received_free.map((r, i) => <tr key={i}><td>{r.product_name}</td><td>{r.product_type === 'book' ? 'کتێب' : 'کافتریا'}</td><td>{r.qty}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupplierTable({ rows }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="card" style={{ padding: 0 }}>
      <table>
        <thead><tr><th>دابینکەر</th><th>کۆی کڕین</th><th>دراو</th><th>قەرز</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{money(r.total_purchased)}</td>
              <td>{money(r.total_paid)}</td>
              <td><span className={`badge ${Number(r.balance) > 0 ? 'red' : 'green'}`}>{money(r.balance)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
