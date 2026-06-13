import { useEffect, useState } from 'react';
import { api, formatDate, money } from '../api.js';
import { Empty, Loading, Modal } from '../components/ui.jsx';
import Receipt from '../components/Receipt.jsx';

export default function SalesHistory() {
  const [list, setList] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', channel: '', section: '' });
  const [detail, setDetail] = useState(null);

  function load() {
    const params = { ...filters };
    Object.keys(params).forEach((k) => params[k] === '' && delete params[k]);
    api.get('/sales', { params }).then((r) => setList(r.data));
  }
  useEffect(load, [filters]);

  async function openDetail(id) {
    const { data } = await api.get(`/sales/${id}`);
    setDetail(data);
  }

  return (
    <>
      <div className="toolbar">
        <div className="field"><label>لە بەرواری</label><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
        <div className="field"><label>تا بەرواری</label><input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
        <div className="field"><label>سەرچاوە</label>
          <select value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })}>
            <option value="">هەموو</option><option value="store">دوکان</option><option value="website">ماڵپەڕ</option>
          </select>
        </div>
        <div className="field"><label>بەش</label>
          <select value={filters.section} onChange={(e) => setFilters({ ...filters, section: e.target.value })}>
            <option value="">هەموو</option><option value="library">کتێبخانە</option><option value="cafeteria">کافتریا</option>
          </select>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {!list ? <Loading /> : list.length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>پسوولە</th><th>بەروار</th><th>سەرچاوە</th><th>بەش</th><th>کاشێر</th><th>کۆ</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{s.invoice_no}</td>
                  <td>{formatDate(s.created_at)}</td>
                  <td><span className={`badge ${s.channel === 'website' ? 'blue' : 'gray'}`}>{s.channel === 'website' ? 'ماڵپەڕ' : 'دوکان'}</span></td>
                  <td>{s.section}</td>
                  <td>{s.cashier_name || '-'}</td>
                  <td>{money(s.total)}</td>
                  <td><button className="ghost sm" onClick={() => openDetail(s.id)}>بینین</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {detail && (
        <Modal title="وردەکاری فرۆشتن" onClose={() => setDetail(null)}>
          <Receipt sale={detail} />
          <div className="modal-actions"><button className="ghost" onClick={() => setDetail(null)}>داخستن</button></div>
        </Modal>
      )}
    </>
  );
}
