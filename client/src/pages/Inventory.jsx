import { useEffect, useState } from 'react';
import { api, formatDate, money } from '../api.js';
import { Empty, Loading, StatCard } from '../components/ui.jsx';

const MOVEMENT_LABELS = {
  purchase: 'کڕین', free_in: 'هاتنی خۆڕایی', sale: 'فرۆشتن',
  gift_out: 'دیاری', adjustment: 'ڕاستکردنەوە',
};

export default function Inventory() {
  const [tab, setTab] = useState('low');
  const [low, setLow] = useState(null);
  const [movements, setMovements] = useState(null);
  const [valuation, setValuation] = useState([]);

  useEffect(() => {
    api.get('/inventory/valuation').then((r) => setValuation(r.data));
  }, []);

  useEffect(() => {
    if (tab === 'low' && !low) api.get('/inventory/low-stock').then((r) => setLow(r.data));
    if (tab === 'movements' && !movements) api.get('/inventory/movements').then((r) => setMovements(r.data));
  }, [tab, low, movements]);

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {valuation.map((v) => (
          <StatCard
            key={v.type}
            label={v.type === 'book' ? 'بەهای کۆگای کتێب' : 'بەهای کۆگای کافتریا'}
            value={money(v.cost_value)}
            sub={`${v.total_units} دانە / ${v.product_count} بەرهەم`}
          />
        ))}
        <StatCard
          label="کۆی بەهای فرۆشتن"
          value={money(valuation.reduce((s, v) => s + Number(v.retail_value), 0))}
        />
      </div>

      <div className="tabs">
        <button className={tab === 'low' ? 'active' : ''} onClick={() => setTab('low')}>کاڵای کەمبوو</button>
        <button className={tab === 'movements' ? 'active' : ''} onClick={() => setTab('movements')}>جووڵەی کۆگا</button>
      </div>

      {tab === 'low' && (
        <div className="card" style={{ padding: 0 }}>
          {!low ? <Loading /> : low.length === 0 ? <Empty text="هیچ کاڵایەک کەم نییە" /> : (
            <table>
              <thead><tr><th>بەرهەم</th><th>پۆلێن</th><th>کۆگا</th><th>ئاستی ئاگادارکردنەوە</th></tr></thead>
              <tbody>
                {low.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.category_name || '-'}</td>
                    <td><span className="badge red">{p.stock_qty}</span></td>
                    <td>{p.reorder_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'movements' && (
        <div className="card" style={{ padding: 0 }}>
          {!movements ? <Loading /> : movements.length === 0 ? <Empty /> : (
            <table>
              <thead><tr><th>بەروار</th><th>بەرهەم</th><th>جۆر</th><th>بڕ</th><th>بەکارهێنەر</th><th>ئاماژە</th></tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.created_at)}</td>
                    <td>{m.product_name}</td>
                    <td><span className="badge gray">{MOVEMENT_LABELS[m.movement_type] || m.movement_type}</span></td>
                    <td style={{ color: m.quantity < 0 ? 'var(--danger)' : 'var(--success)' }}>{m.quantity}</td>
                    <td>{m.user_name || '-'}</td>
                    <td className="muted">{m.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
