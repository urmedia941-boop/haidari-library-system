import { useEffect } from 'react';

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={wide ? { maxWidth: 760 } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field" style={{ display: 'flex', flexDirection: 'column' }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Loading({ text = 'بارکردن...' }) {
  return <div className="empty">{text}</div>;
}

export function Empty({ text = 'هیچ تۆمارێک نییە' }) {
  return <div className="empty">{text}</div>;
}

export function StatCard({ label, value, sub, color }) {
  return (
    <div className="card stat">
      <span className="label">{label}</span>
      <span className="value" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}
