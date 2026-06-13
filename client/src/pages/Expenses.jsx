import { useEffect, useState } from 'react';
import { api, apiError, formatDate, money } from '../api.js';
import { Empty, Field, Loading, Modal } from '../components/ui.jsx';

const SECTION_LABELS = { library: 'کتێبخانە', cafeteria: 'کافتریا', general: 'گشتی' };

export default function Expenses() {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);

  function load() { api.get('/expenses').then((r) => setList(r.data)); }
  useEffect(load, []);

  async function remove(id) {
    if (!confirm('سڕینەوەی خەرجی؟')) return;
    await api.delete(`/expenses/${id}`);
    load();
  }

  const total = list?.reduce((s, e) => s + Number(e.amount), 0) || 0;

  return (
    <>
      <div className="toolbar">
        <div className="muted">کۆی خەرجییەکان: <strong>{money(total)}</strong></div>
        <div className="spacer" />
        <button onClick={() => setOpen(true)}>+ خەرجی نوێ</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {!list ? <Loading /> : list.length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>بەروار</th><th>پۆل</th><th>وەسف</th><th>بەش</th><th>بڕ</th><th></th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.spent_at)}</td>
                  <td>{e.category}</td>
                  <td>{e.description || '-'}</td>
                  <td><span className="badge gray">{SECTION_LABELS[e.section]}</span></td>
                  <td>{money(e.amount)}</td>
                  <td><button className="danger sm" onClick={() => remove(e.id)}>سڕینەوە</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && <ExpenseForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </>
  );
}

function ExpenseForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ category: '', description: '', amount: '', section: 'general', spent_at: '' });
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount), spent_at: form.spent_at || null });
      onSaved();
    } catch (err) { setError(apiError(err)); }
  }

  return (
    <Modal title="خەرجی نوێ" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="پۆل"><input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="کرێ، کارەبا..." /></Field>
          <Field label="بڕ"><input type="number" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} required /></Field>
          <Field label="بەش">
            <select value={form.section} onChange={(e) => set('section', e.target.value)}>
              <option value="general">گشتی</option>
              <option value="library">کتێبخانە</option>
              <option value="cafeteria">کافتریا</option>
            </select>
          </Field>
          <Field label="بەروار"><input type="date" value={form.spent_at} onChange={(e) => set('spent_at', e.target.value)} /></Field>
          <div className="full"><Field label="وەسف"><input value={form.description} onChange={(e) => set('description', e.target.value)} /></Field></div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="submit">پاشەکەوتکردن</button>
          <button type="button" className="ghost" onClick={onClose}>پاشگەزبوونەوە</button>
        </div>
      </form>
    </Modal>
  );
}
