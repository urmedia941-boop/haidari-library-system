import { useEffect, useState } from 'react';
import { api, apiError, formatDate, money } from '../api.js';
import { Empty, Field, Loading, Modal } from '../components/ui.jsx';

const STATUS = { paid: ['green', 'دراوە'], partial: ['amber', 'بەشی'], unpaid: ['red', 'نەدراو'] };

export default function Purchases() {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);

  function load() { api.get('/purchases').then((r) => setList(r.data)); }
  useEffect(load, []);

  return (
    <>
      <div className="toolbar">
        <div className="spacer" />
        <button onClick={() => setOpen(true)}>+ کڕینی نوێ</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {!list ? <Loading /> : list.length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>بەروار</th><th>ئاماژە</th><th>دابینکەر</th><th>بەش</th><th>کۆی تێچوو</th><th>دۆخ</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.created_at)}</td>
                  <td>{p.reference || `#${p.id}`}</td>
                  <td>{p.supplier_name || '-'}</td>
                  <td>{p.section}</td>
                  <td>{money(p.total_cost)}</td>
                  <td><span className={`badge ${STATUS[p.status][0]}`}>{STATUS[p.status][1]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && <PurchaseForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </>
  );
}

function PurchaseForm({ onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [head, setHead] = useState({ supplier_id: '', reference: '', section: 'library', amount_paid: '' });
  const [items, setItems] = useState([{ product_id: '', quantity: 1, unit_cost: '', acquisition: 'purchased' }]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/products').then((r) => setProducts(r.data));
    api.get('/reference/suppliers').then((r) => setSuppliers(r.data));
  }, []);

  function setItem(i, patch) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addRow() { setItems((arr) => [...arr, { product_id: '', quantity: 1, unit_cost: '', acquisition: 'purchased' }]); }
  function removeRow(i) { setItems((arr) => arr.filter((_, idx) => idx !== i)); }

  const total = items.reduce((s, it) => s + (it.acquisition === 'free' ? 0 : (Number(it.unit_cost) || 0) * (Number(it.quantity) || 0)), 0);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const valid = items.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (valid.length === 0) { setError('لانیکەم یەک بەرهەم زیاد بکە'); return; }
    try {
      await api.post('/purchases', {
        supplier_id: head.supplier_id || null,
        reference: head.reference || null,
        section: head.section,
        amount_paid: Number(head.amount_paid) || 0,
        items: valid.map((it) => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost) || 0,
          acquisition: it.acquisition,
        })),
      });
      onSaved();
    } catch (err) { setError(apiError(err)); }
  }

  return (
    <Modal title="کڕینی نوێ" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="دابینکەر">
            <select value={head.supplier_id} onChange={(e) => setHead({ ...head, supplier_id: e.target.value })}>
              <option value="">— هەڵبژاردن —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="ئاماژە/ژمارەی پسوولە"><input value={head.reference} onChange={(e) => setHead({ ...head, reference: e.target.value })} /></Field>
          <Field label="بەش">
            <select value={head.section} onChange={(e) => setHead({ ...head, section: e.target.value })}>
              <option value="library">کتێبخانە</option>
              <option value="cafeteria">کافتریا</option>
              <option value="general">گشتی</option>
            </select>
          </Field>
          <Field label="بڕی دراو"><input type="number" step="0.01" value={head.amount_paid} onChange={(e) => setHead({ ...head, amount_paid: e.target.value })} /></Field>
        </div>

        <h3 style={{ marginTop: 18 }}>بەرهەمەکان</h3>
        <table>
          <thead><tr><th>بەرهەم</th><th>بڕ</th><th>تێچوو</th><th>سەرچاوە</th><th></th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>
                  <select value={it.product_id} onChange={(e) => setItem(i, { product_id: e.target.value })}>
                    <option value="">— هەڵبژاردن —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td style={{ width: 90 }}><input type="number" min="1" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} /></td>
                <td style={{ width: 120 }}><input type="number" step="0.01" value={it.unit_cost} disabled={it.acquisition === 'free'} onChange={(e) => setItem(i, { unit_cost: e.target.value })} /></td>
                <td style={{ width: 130 }}>
                  <select value={it.acquisition} onChange={(e) => setItem(i, { acquisition: e.target.value })}>
                    <option value="purchased">کڕدراو</option>
                    <option value="free">خۆڕایی</option>
                  </select>
                </td>
                <td><button type="button" className="danger sm" onClick={() => removeRow(i)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="ghost sm" style={{ marginTop: 10 }} onClick={addRow}>+ ڕیزی نوێ</button>

        <div style={{ marginTop: 14, fontWeight: 800 }}>کۆی تێچوو: {money(total)}</div>
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="submit">تۆمارکردنی کڕین</button>
          <button type="button" className="ghost" onClick={onClose}>پاشگەزبوونەوە</button>
        </div>
      </form>
    </Modal>
  );
}
