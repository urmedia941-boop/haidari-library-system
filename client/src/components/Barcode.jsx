import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function Barcode({ value, label, price }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, String(value), {
          format: 'CODE128',
          width: 2,
          height: 70,
          displayValue: true,
          fontSize: 14,
          margin: 8,
        });
      } catch {
        /* ignore invalid barcode values */
      }
    }
  }, [value]);

  return (
    <div style={{ textAlign: 'center', direction: 'ltr', padding: 10 }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4, direction: 'rtl' }}>{label}</div>}
      <svg ref={ref} />
      {price && <div style={{ fontWeight: 800, marginTop: 4 }}>{price}</div>}
    </div>
  );
}
