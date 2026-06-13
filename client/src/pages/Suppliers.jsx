import { useEffect, useState } from 'react';
import { api, apiError, money } from '../api.js';
import { Empty, Field, Loading, Modal } from '../components/ui.jsx';

export default function Suppliers() {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(null);

  function load() { api.get('/reference/suppliers').then((r) => setList(r.data)); }
  useEffect(load, []);

  return (
    <>
      <div className="toolbar">
        <div className="spacer" />
        <button onClick={() => setOpen(true)}>+ دابینکەری نوێ</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {!list ? <Loading /> : list.length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>ناو</th><th>تەلەفۆن</th><th>کۆی کڕین</th><th>دراو</th><th>قەرز</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.phone || '-'}</td>
                  <td>{money(s.total_purchased)}</td>
                  <td>{money(s.total_paid)}</td>
                  <td>
                    <span className={`badge ${Number(s.balance) > 0 ? 'red' : 'green'}`}>{money(s.balance)}</span>
                  </td>
                  <td><button className="ghost sm" onClick={() => setPaying(s)}>پارەدان</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && <SupplierForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
      {paying && <PaymentForm supplier={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load(); }} />}
    </>
  );
}

function SupplierForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    try { await api.post('/reference/suppliers', form); onSaved(); }
    catch (err) { setError(apiError(err)); }
  }
  return (
    <Modal title="دابینکەری نوێ" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="ناو"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="تەلەفۆن"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <div className="full"><Field label="تێبینی"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
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

function PaymentForm({ supplier, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    try { await api.post(`/reference/suppliers/${supplier.id}/payments`, { amount: Number(amount), note }); onSaved(); }
    catch (err) { setError(apiError(err)); }
  }
  return (
    <Modal title={`پارەدان بۆ ${supplier.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="بڕ"><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <div style={{ marginTop: 12 }}><Field label="تێبینی"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="submit">تۆمارکردن</button>
          <button type="button" className="ghost" onClick={onClose}>پاشگەزبوونەوە</button>
        </div>
      </form>
    </Modal>
  );
}
