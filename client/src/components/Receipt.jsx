import { formatDate, money } from '../api.js';

export default function Receipt({ sale }) {
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <strong style={{ fontSize: 16 }}>کتێبخانەی حەیدەری</strong>
        <div className="muted">پسوولەی فرۆشتن</div>
      </div>
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <span>ژمارەی پسوولە:</span><span>{sale.invoice_no}</span>
      </div>
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <span>بەروار:</span><span>{formatDate(sale.created_at)}</span>
      </div>
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <span>سەرچاوە:</span><span>{sale.channel === 'website' ? 'ماڵپەڕ' : 'دوکان'}</span>
      </div>
      <table style={{ marginTop: 10 }}>
        <thead>
          <tr><th>بەرهەم</th><th>دانە</th><th>نرخ</th><th>کۆ</th></tr>
        </thead>
        <tbody>
          {sale.items?.map((it) => (
            <tr key={it.id}>
              <td>{it.product_name}{it.transaction_type === 'gift' && ' (دیاری)'}</td>
              <td>{it.quantity}</td>
              <td>{money(it.unit_price)}</td>
              <td>{money(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span>کۆی گشتی:</span><span>{money(sale.subtotal)}</span>
        </div>
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <span>داشکاندن:</span><span>{money(sale.discount_total)}</span>
        </div>
        <div className="flex" style={{ justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
          <span>پارەی کۆتایی:</span><span>{money(sale.total)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 12 }} className="muted">سوپاس بۆ کڕینەکەتان</div>
    </div>
  );
}
