import { useEffect, useRef, useState } from 'react';
import { api, apiError, money } from '../api.js';
import { Modal } from '../components/ui.jsx';
import Receipt from '../components/Receipt.jsx';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('book');
  const [scan, setScan] = useState('');
  const [cart, setCart] = useState([]);
  const [channel, setChannel] = useState('store');
  const [customer, setCustomer] = useState('');
  const [payment, setPayment] = useState('cash');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const scanRef = useRef(null);

  function loadProducts() {
    api.get('/products', { params: { type: tab } }).then((r) => setProducts(r.data));
  }
  useEffect(loadProducts, [tab]);
  useEffect(() => { scanRef.current?.focus(); }, []);

  function addToCart(product) {
    if (product.stock_qty <= 0) { setError(`کۆگای "${product.name}" بەتاڵە`); return; }
    setError('');
    setCart((c) => {
      const existing = c.find((i) => i.product_id === product.id);
      if (existing) {
        return c.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...c, {
        product_id: product.id, name: product.name, type: product.type,
        sale_price: Number(product.sale_price), stock: product.stock_qty,
        quantity: 1, discount: 0, transaction_type: 'sale',
      }];
    });
  }

  async function handleScan(e) {
    e.preventDefault();
    if (!scan.trim()) return;
    try {
      const { data } = await api.get(`/products/barcode/${scan.trim()}`);
      addToCart(data);
      setScan('');
    } catch (err) {
      setError(apiError(err));
    }
    scanRef.current?.focus();
  }

  function updateLine(id, patch) {
    setCart((c) => c.map((i) => (i.product_id === id ? { ...i, ...patch } : i)));
  }
  function removeLine(id) {
    setCart((c) => c.filter((i) => i.product_id !== id));
  }

  const subtotal = cart.reduce((s, i) => s + (i.transaction_type === 'gift' ? 0 : i.sale_price * i.quantity), 0);
  const discountTotal = cart.reduce((s, i) => s + (i.transaction_type === 'gift' ? 0 : Number(i.discount) || 0), 0);
  const total = subtotal - discountTotal;

  async function checkout() {
    if (cart.length === 0) return;
    setError('');
    try {
      const { data } = await api.post('/sales', {
        channel,
        customer_name: customer || undefined,
        payment_method: payment,
        items: cart.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          discount: Number(i.discount) || 0,
          transaction_type: i.transaction_type,
        })),
      });
      const full = await api.get(`/sales/${data.id}`);
      setReceipt(full.data);
      setCart([]);
      setCustomer('');
      loadProducts();
    } catch (err) {
      setError(apiError(err));
    }
  }

  return (
    <div className="pos">
      <div>
        <form onSubmit={handleScan} style={{ marginBottom: 14 }}>
          <input
            ref={scanRef}
            placeholder="بارکۆد بخوێنەرەوە یان بنووسە و Enter دابگرە..."
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            style={{ fontSize: 16 }}
          />
        </form>
        <div className="tabs">
          <button className={tab === 'book' ? 'active' : ''} onClick={() => setTab('book')}>کتێبەکان</button>
          <button className={tab === 'cafeteria' ? 'active' : ''} onClick={() => setTab('cafeteria')}>کافتریا</button>
        </div>
        <div className="pos-products">
          {products.map((p) => (
            <div key={p.id} className="pos-item" onClick={() => addToCart(p)}>
              <div className="name">{p.name}</div>
              <div className="price">{money(p.sale_price)}</div>
              <div className="stock">کۆگا: {p.stock_qty}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ alignSelf: 'flex-start', position: 'sticky', top: 86 }}>
        <h3>سەبەتەی فرۆشتن</h3>
        {error && <div className="error-text">{error}</div>}
        {cart.length === 0 ? (
          <div className="muted" style={{ padding: '20px 0' }}>سەبەتە بەتاڵە</div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {cart.map((i) => (
              <div className="cart-line" key={i.product_id}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{i.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {money(i.sale_price)}
                    <label style={{ display: 'inline-flex', gap: 4, marginRight: 8, fontSize: 11 }}>
                      <input
                        type="checkbox"
                        style={{ width: 'auto' }}
                        checked={i.transaction_type === 'gift'}
                        onChange={(e) => updateLine(i.product_id, { transaction_type: e.target.checked ? 'gift' : 'sale' })}
                      /> دیاری
                    </label>
                  </div>
                </div>
                <input
                  className="qty" type="number" min="1" max={i.stock}
                  value={i.quantity}
                  onChange={(e) => updateLine(i.product_id, { quantity: Math.max(1, Number(e.target.value)) })}
                />
                <button className="danger sm" onClick={() => removeLine(i.product_id)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <div className="flex">
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="store">دوکان</option>
              <option value="website">ماڵپەڕ</option>
            </select>
            <select value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="cash">نەقد</option>
              <option value="card">کارت</option>
              <option value="transfer">گواستنەوە</option>
            </select>
          </div>
          <input placeholder="ناوی کڕیار (ئیختیاری)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </div>

        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <span className="muted">کۆی گشتی</span><span>{money(subtotal)}</span>
          </div>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <span className="muted">داشکاندن</span><span>{money(discountTotal)}</span>
          </div>
          <div className="flex" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span>پارەی کۆتایی</span><span className="cart-total">{money(total)}</span>
          </div>
          <button style={{ width: '100%', marginTop: 14, padding: 14, fontSize: 16 }} disabled={cart.length === 0} onClick={checkout}>
            تەواوکردنی فرۆشتن
          </button>
        </div>
      </div>

      {receipt && (
        <Modal title="پسوولەی فرۆشتن" onClose={() => setReceipt(null)}>
          <Receipt sale={receipt} />
          <div className="modal-actions">
            <button onClick={() => window.print()}>چاپکردنی پسوولە</button>
            <button className="ghost" onClick={() => setReceipt(null)}>داخستن</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
