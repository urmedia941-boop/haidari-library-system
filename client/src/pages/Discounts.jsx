import { useEffect, useState } from 'react';
import { api, apiError, money } from '../api.js';
import { Empty, Field, Loading, Modal } from '../components/ui.jsx';

const SCOPE_LABELS = { global: 'گشتی', product: 'بەرهەم', category: 'پۆلێن', loyalty: 'دڵسۆزی' };

export default function Discounts() {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);

  function load() { api.get('/discounts').then((r) => setList(r.data)); }
  useEffect(load, []);

  async function toggle(d) {
    await api.patch(`/discounts/${d.id}`, { is_active: !d.is_active });
    load();
  }
  async function remove(id) {
    if (!confirm('سڕینەوەی داشکاندن؟')) return;
    await api.delete(`/discounts/${id}`);
    load();
  }

  return (
    <>
      <div className="toolbar">
        <div className="spacer" />
        <button onClick={() => setOpen(true)}>+ داشکاندنی نوێ</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {!list ? <Loading /> : list.length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>ناو</th><th>جۆر</th><th>بەها</th><th>چوارچێوە</th><th>دۆخ</th><th></th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.discount_type === 'percentage' ? 'ڕێژەیی' : 'بڕی جێگیر'}</td>
                  <td>{d.discount_type === 'percentage' ? `${d.value}%` : money(d.value)}</td>
                  <td>{SCOPE_LABELS[d.scope]}{d.product_name ? ` — ${d.product_name}` : ''}</td>
                  <td>
                    <span className={`badge ${d.is_active ? 'green' : 'gray'}`}>
                      {d.is_active ? 'چالاک' : 'ناچالاک'}
                    </span>
                  </td>
                  <td className="flex">
                    <button className="ghost sm" onClick={() => toggle(d)}>{d.is_active ? 'ناچالاککردن' : 'چالاککردن'}</button>
                    <button className="danger sm" onClick={() => remove(d.id)}>سڕینەوە</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && <DiscountForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </>
  );
}

function DiscountForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', scope: 'global', discount_type: 'percentage', value: '', start_date: '', end_date: '' });
  const [error, setError] = useState('');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/discounts', {
        ...form,
        value: Number(form.value),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });
      onSaved();
    } catch (err) { setError(apiError(err)); }
  }

  return (
    <Modal title="داشکاندنی نوێ" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="ناو"><input value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <Field label="چوارچێوە">
            <select value={form.scope} onChange={(e) => set('scope', e.target.value)}>
              <option value="global">گشتی</option>
              <option value="loyalty">دڵسۆزی</option>
            </select>
          </Field>
          <Field label="جۆر">
            <select value={form.discount_type} onChange={(e) => set('discount_type', e.target.value)}>
              <option value="percentage">ڕێژەیی (%)</option>
              <option value="fixed">بڕی جێگیر</option>
            </select>
          </Field>
          <Field label="بەها"><input type="number" step="0.01" value={form.value} onChange={(e) => set('value', e.target.value)} required /></Field>
          <Field label="بەرواری دەستپێک"><input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
          <Field label="بەرواری کۆتایی"><input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
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
