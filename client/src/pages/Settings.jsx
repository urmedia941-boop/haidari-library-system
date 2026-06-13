import { useEffect, useState } from 'react';
import { api, apiError, formatDate } from '../api.js';
import { Empty, Field, Loading, Modal } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';

export default function Settings() {
  const [tab, setTab] = useState('backup');
  return (
    <>
      <div className="tabs">
        <button className={tab === 'backup' ? 'active' : ''} onClick={() => setTab('backup')}>کۆپیەدەگ</button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>بەکارهێنەران</button>
      </div>
      {tab === 'backup' ? <Backups /> : <Users />}
    </>
  );
}

function Backups() {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function load() { api.get('/backups').then((r) => setList(r.data)); }
  useEffect(load, []);

  async function create() {
    setBusy(true); setMsg('');
    try { await api.post('/backups'); setMsg('کۆپیەدەگ بە سەرکەوتوویی دروستکرا'); load(); }
    catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  }
  async function restore(name) {
    if (!confirm('گەڕاندنەوە داتای ئێستا دەگۆڕێت. دڵنیایت؟')) return;
    setBusy(true); setMsg('');
    try { await api.post('/backups/restore', { name }); setMsg('داتا گەڕێندرایەوە'); }
    catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  }
  async function remove(name) {
    if (!confirm('سڕینەوەی کۆپیەدەگ؟')) return;
    await api.delete(`/backups/${name}`); load();
  }

  return (
    <div className="card">
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>کۆپیەدەگی داتابەیس</h3>
        <button onClick={create} disabled={busy}>{busy ? 'جارێ...' : '+ کۆپیەدەگی نوێ'}</button>
      </div>
      {msg && <div className="muted" style={{ margin: '10px 0' }}>{msg}</div>}
      {!list ? <Loading /> : list.length === 0 ? <Empty text="هیچ کۆپیەدەگێک نییە" /> : (
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>ناو</th><th>قەبارە</th><th>بەروار</th><th></th></tr></thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.name}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.name}</td>
                <td>{(b.size / 1024).toFixed(1)} KB</td>
                <td>{formatDate(b.created_at)}</td>
                <td className="flex">
                  <button className="ghost sm" onClick={() => restore(b.name)} disabled={busy}>گەڕاندنەوە</button>
                  <button className="danger sm" onClick={() => remove(b.name)}>سڕینەوە</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Users() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);

  function load() { api.get('/auth/users').then((r) => setList(r.data)); }
  useEffect(load, []);

  return (
    <div className="card">
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>بەکارهێنەران</h3>
        {user?.role === 'admin' && <button onClick={() => setOpen(true)}>+ بەکارهێنەری نوێ</button>}
      </div>
      {!list ? <Loading /> : (
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>ناو</th><th>بەکارهێنەر</th><th>ڕۆڵ</th><th>دۆخ</th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>{u.username}</td>
                <td><span className="badge gray">{u.role}</span></td>
                <td><span className={`badge ${u.is_active ? 'green' : 'red'}`}>{u.is_active ? 'چالاک' : 'ناچالاک'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && <UserForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function UserForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'cashier' });
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    try { await api.post('/auth/users', form); onSaved(); }
    catch (err) { setError(apiError(err)); }
  }
  return (
    <Modal title="بەکارهێنەری نوێ" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="ناوی تەواو"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></Field>
          <Field label="ناوی بەکارهێنەر"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></Field>
          <Field label="تێپەڕەوشە"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
          <Field label="ڕۆڵ">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="cashier">کاشێر</option>
              <option value="manager">سەرپەرشتیار</option>
              <option value="admin">بەڕێوەبەر</option>
            </select>
          </Field>
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="submit">دروستکردن</button>
          <button type="button" className="ghost" onClick={onClose}>پاشگەزبوونەوە</button>
        </div>
      </form>
    </Modal>
  );
}
