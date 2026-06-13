import { useCallback, useEffect, useState } from 'react';
import { api, apiError, money } from '../api.js';
import { Empty, Field, Loading, Modal } from './ui.jsx';
import Barcode from './Barcode.jsx';

const BLANK = {
  name: '', barcode: '', category_id: '', cost_price: '', sale_price: '',
  stock_qty: '', reorder_level: 5, acquisition: 'purchased', intended_use: 'sale',
  author_id: '', translator_id: '', supplier_id: '', isbn: '', edition: '', publisher_place: '',
};

export default function ProductManager({ type }) {
  const isBook = type === 'book';
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ category_id: '', acquisition: '', intended_use: '' });
  const [refs, setRefs] = useState({ categories: [], authors: [], translators: [], suppliers: [] });
  const [editing, setEditing] = useState(null);
  const [printing, setPrinting] = useState(null);

  const load = useCallback(async () => {
    const params = { type, search: search || undefined, ...filters };
    Object.keys(params).forEach((k) => params[k] === '' && delete params[k]);
    try {
      const { data } = await api.get('/products', { params });
      setProducts(data);
    } catch (e) {
      setError(apiError(e));
    }
  }, [type, search, filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      api.get('/reference/categories', { params: { kind: type } }),
      isBook ? api.get('/reference/authors') : Promise.resolve({ data: [] }),
      isBook ? api.get('/reference/translators') : Promise.resolve({ data: [] }),
      isBook ? api.get('/reference/suppliers') : Promise.resolve({ data: [] }),
    ]).then(([c, a, t, s]) =>
      setRefs({ categories: c.data, authors: a.data, translators: t.data, suppliers: s.data }),
    );
  }, [type, isBook]);

  async function remove(id) {
    if (!confirm('دڵنیایت لە سڕینەوەی ئەم بەرهەمە؟')) return;
    try {
      await api.delete(`/products/${id}`);
      load();
    } catch (e) {
      alert(apiError(e));
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="field">
          <label>گەڕان</label>
          <input
            placeholder="ناو / بارکۆد / ISBN"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>پۆلێن</label>
          <select value={filters.category_id} onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}>
            <option value="">هەموو</option>
            {refs.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>سەرچاوە</label>
          <select value={filters.acquisition} onChange={(e) => setFilters({ ...filters, acquisition: e.target.value })}>
            <option value="">هەموو</option>
            <option value="purchased">کڕدراو</option>
            <option value="free">بێبەرامبەر/خۆڕایی</option>
          </select>
        </div>
        {isBook && (
          <div className="field">
            <label>مەبەست</label>
            <select value={filters.intended_use} onChange={(e) => setFilters({ ...filters, intended_use: e.target.value })}>
              <option value="">هەموو</option>
              <option value="sale">بۆ فرۆشتن</option>
              <option value="gift">بۆ دیاری</option>
            </select>
          </div>
        )}
        <div className="spacer" />
        <button onClick={() => setEditing({ ...BLANK })}>+ بەرهەمی نوێ</button>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {!products ? <Loading /> : products.length === 0 ? <Empty /> : (
          <table>
            <thead>
              <tr>
                <th>ناو</th>
                {isBook && <th>نووسەر</th>}
                <th>پۆلێن</th>
                <th>بارکۆد</th>
                <th>نرخی فرۆشتن</th>
                <th>کۆگا</th>
                <th>سەرچاوە</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  {isBook && <td>{p.author_name || '-'}</td>}
                  <td>{p.category_name || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.barcode}</td>
                  <td>{money(p.sale_price)}</td>
                  <td>
                    <span className={`badge ${p.stock_qty <= p.reorder_level ? 'red' : 'green'}`}>
                      {p.stock_qty}
                    </span>
                  </td>
                  <td>
                    {p.acquisition === 'free'
                      ? <span className="badge amber">خۆڕایی</span>
                      : <span className="badge gray">کڕدراو</span>}
                    {p.intended_use === 'gift' && <span className="badge blue" style={{ marginRight: 4 }}>دیاری</span>}
                  </td>
                  <td className="flex">
                    <button className="ghost sm" onClick={() => setPrinting(p)}>بارکۆد</button>
                    <button className="ghost sm" onClick={() => setEditing(toForm(p))}>دەستکاری</button>
                    <button className="danger sm" onClick={() => remove(p.id)}>سڕینەوە</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ProductForm
          type={type}
          isBook={isBook}
          refs={refs}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {printing && (
        <Modal title={`بارکۆد — ${printing.name}`} onClose={() => setPrinting(null)}>
          <Barcode value={printing.barcode} label={printing.name} price={money(printing.sale_price)} />
          <div className="modal-actions">
            <button onClick={() => window.print()}>چاپکردن</button>
            <button className="ghost" onClick={() => setPrinting(null)}>داخستن</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function toForm(p) {
  return {
    id: p.id,
    name: p.name || '', barcode: p.barcode || '', category_id: p.category_id || '',
    cost_price: p.cost_price || '', sale_price: p.sale_price || '',
    stock_qty: p.stock_qty ?? '', reorder_level: p.reorder_level ?? 5,
    acquisition: p.acquisition || 'purchased', intended_use: p.intended_use || 'sale',
    author_id: p.author_id || '', translator_id: p.translator_id || '', supplier_id: p.supplier_id || '',
    isbn: p.isbn || '', edition: p.edition || '', publisher_place: p.publisher_place || '',
  };
}

function ProductForm({ type, isBook, refs, initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editingExisting = Boolean(initial.id);

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form, type };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    try {
      if (editingExisting) await api.put(`/products/${initial.id}`, payload);
      else await api.post('/products', payload);
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editingExisting ? 'دەستکاریکردنی بەرهەم' : 'بەرهەمی نوێ'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="ناو"><input value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <Field label="بارکۆد (بەتاڵ بۆ دروستکردنی خۆکار)">
            <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
          </Field>
          <Field label="پۆلێن">
            <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
              <option value="">— هەڵبژاردن —</option>
              {refs.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="تێچووی کڕین">
            <input type="number" step="0.01" value={form.cost_price} onChange={(e) => set('cost_price', e.target.value)} />
          </Field>
          <Field label="نرخی فرۆشتن">
            <input type="number" step="0.01" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} />
          </Field>
          {!editingExisting && (
            <Field label="بڕی کۆگای سەرەتایی">
              <input type="number" value={form.stock_qty} onChange={(e) => set('stock_qty', e.target.value)} />
            </Field>
          )}
          <Field label="ئاستی ئاگادارکردنەوە">
            <input type="number" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} />
          </Field>
          <Field label="سەرچاوە">
            <select value={form.acquisition} onChange={(e) => set('acquisition', e.target.value)}>
              <option value="purchased">کڕدراو</option>
              <option value="free">بێبەرامبەر/خۆڕایی</option>
            </select>
          </Field>
          <Field label="مەبەست">
            <select value={form.intended_use} onChange={(e) => set('intended_use', e.target.value)}>
              <option value="sale">بۆ فرۆشتن</option>
              <option value="gift">بۆ دیاری</option>
            </select>
          </Field>

          {isBook && (
            <>
              <Field label="نووسەر">
                <select value={form.author_id} onChange={(e) => set('author_id', e.target.value)}>
                  <option value="">— هەڵبژاردن —</option>
                  {refs.authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="وەرگێڕ">
                <select value={form.translator_id} onChange={(e) => set('translator_id', e.target.value)}>
                  <option value="">— هەڵبژاردن —</option>
                  {refs.translators.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="دابینکەر">
                <select value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
                  <option value="">— هەڵبژاردن —</option>
                  {refs.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="ISBN"><input value={form.isbn} onChange={(e) => set('isbn', e.target.value)} /></Field>
              <Field label="چاپ"><input value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder="چاپی یەکەم" /></Field>
              <Field label="شوێنی چاپ/بڵاوکردنەوە"><input value={form.publisher_place} onChange={(e) => set('publisher_place', e.target.value)} /></Field>
            </>
          )}
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="submit" disabled={saving}>{saving ? 'پاشەکەوت...' : 'پاشەکەوتکردن'}</button>
          <button type="button" className="ghost" onClick={onClose}>پاشگەزبوونەوە</button>
        </div>
      </form>
    </Modal>
  );
}
