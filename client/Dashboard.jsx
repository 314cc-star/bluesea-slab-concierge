import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import ListingWriter from './ListingWriter.jsx';

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
  accentColor: '#4f6f52',
  fontFamily: 'Lato, Sarabun, sans-serif',
  headerBackgroundColor: '#e5ebe4',
  headerTextColor: '#2f4632',
  borderRadius: 8,
  wrapperBorderRadius: 12,
});

const STATUS_LABEL = {
  deposit_paid: 'Deposit paid · in production',
  balance_invoiced: 'Balance invoiced',
  refunded: 'Cancelled · deposit refunded',
};

const CANCEL_DAYS = 3;
const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / 86_400_000;

const thb = (n) => (n == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n));

function readKey() {
  try {
    return sessionStorage.getItem('bsw-owner-key') || '';
  } catch {
    return '';
  }
}

function OrderActions({ data, context }) {
  const busy = context.busyId === data.id;
  if (data.status === 'refunded') return <span className="cell-note muted">Refunded {new Date(data.refundedAt).toLocaleDateString()}</span>;
  if (data.invoiceId) return <span className="cell-note">Invoice sent {new Date(data.invoicedAt).toLocaleDateString()}</span>;
  const inWindow = daysSince(data.createdAt) <= CANCEL_DAYS;
  return (
    <span className="grid-actions">
      <button className="grid-btn" disabled={busy} onClick={() => context.sendInvoice(data)}>
        {busy ? 'Working…' : 'Send balance invoice'}
      </button>
      <button
        className="grid-btn ghost"
        disabled={busy}
        title={inWindow ? `Within the ${CANCEL_DAYS}-day full refund window` : `Past the ${CANCEL_DAYS}-day window`}
        onClick={() => context.refund(data)}
      >
        Refund{inWindow ? '' : ' (late)'}
      </button>
    </span>
  );
}

export default function Dashboard() {
  const [key, setKey] = useState(readKey);
  const [needKey, setNeedKey] = useState(false);
  const [slabs, setSlabs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState('');

  const api = useCallback(
    async (url, options = {}) => {
      const res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key, ...(options.headers || {}) },
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) setNeedKey(true);
      if (!res.ok) throw new Error(json.error || res.statusText);
      return json;
    },
    [key],
  );

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([api('/api/slabs'), api('/api/admin/orders')]);
      setSlabs(s);
      setOrders(o.slice().reverse());
      setNeedKey(false);
    } catch (err) {
      setToast(err.message);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const sendInvoice = useCallback(
    async (order) => {
      setBusyId(order.id);
      try {
        const updated = await api(`/api/admin/orders/${order.id}/invoice`, { method: 'POST' });
        setOrders((all) => all.map((o) => (o.id === updated.id ? updated : o)));
        setToast(`Balance invoice for ${thb(order.balance)} sent to ${order.payerEmail} via PayPal.`);
      } catch (err) {
        setToast(`Could not send invoice: ${err.message}`);
      } finally {
        setBusyId(null);
      }
    },
    [api],
  );

  const refund = useCallback(
    async (order) => {
      if (!window.confirm(`Refund the full deposit of ${thb(order.deposit)} for ${order.slabId}? The slab goes back on sale.`)) return;
      setBusyId(order.id);
      try {
        const updated = await api(`/api/admin/orders/${order.id}/refund`, { method: 'POST' });
        setOrders((all) => all.map((o) => (o.id === updated.id ? updated : o)));
        setSlabs((all) => all.map((s) => (s.id === order.slabId ? { ...s, status: 'available' } : s)));
        setToast(`Refunded ${thb(order.deposit)} through PayPal. ${order.slabId} is back in stock.`);
      } catch (err) {
        setToast(`Could not refund: ${err.message}`);
      } finally {
        setBusyId(null);
      }
    },
    [api],
  );

  const onSlabEdit = useCallback(
    async (e) => {
      try {
        const updated = await api(`/api/admin/slabs/${e.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ [e.colDef.field]: e.newValue }),
        });
        setToast(`Saved ${updated.id}.`);
      } catch (err) {
        e.node.setDataValue(e.colDef.field, e.oldValue);
        setToast(`Not saved: ${err.message}`);
      }
    },
    [api],
  );

  const orderCols = useMemo(
    () => [
      { field: 'createdAt', headerName: 'Date', valueFormatter: (p) => new Date(p.value).toLocaleString(), minWidth: 170, sort: 'desc' },
      { field: 'slabId', headerName: 'Slab', minWidth: 110 },
      { field: 'legsLabel', headerName: 'Legs', minWidth: 150, valueFormatter: (p) => p.value || 'Tabletop only' },
      { field: 'finishLabel', headerName: 'Finish', minWidth: 170 },
      { field: 'total', headerName: 'Order total', valueFormatter: (p) => thb(p.value), type: 'rightAligned' },
      { field: 'buyerName', headerName: 'Customer', minWidth: 140 },
      { field: 'payerEmail', headerName: 'Email', minWidth: 200 },
      { field: 'contact', headerName: 'Phone / LINE', minWidth: 150 },
      { headerName: 'Ship to', minWidth: 260, valueGetter: (p) => (p.data.shipTo ? p.data.shipTo.name + ', ' + p.data.shipTo.address : ''), tooltipValueGetter: (p) => p.value },
      { field: 'deposit', headerName: 'Deposit paid', valueFormatter: (p) => thb(p.value), type: 'rightAligned' },
      { field: 'balance', headerName: 'Balance due', valueFormatter: (p) => thb(p.value), type: 'rightAligned' },
      { field: 'status', valueFormatter: (p) => STATUS_LABEL[p.value] || p.value, minWidth: 200 },
      { headerName: 'Next step', cellRenderer: OrderActions, minWidth: 260, sortable: false, filter: false },
    ],
    [],
  );

  const slabCols = useMemo(
    () => [
      { field: 'id', headerName: 'Slab', pinned: 'left', minWidth: 110 },
      { headerName: 'Size (W × L × T cm)', valueGetter: (p) => `${p.data.width_cm} × ${p.data.length_cm} × ${p.data.thickness_cm}`, minWidth: 160 },
      { field: 'edge', minWidth: 150 },
      { field: 'tone', editable: true, minWidth: 240, flex: 2 },
      {
        field: 'price_thb', headerName: 'Price (THB)', editable: true, type: 'rightAligned',
        valueFormatter: (p) => thb(p.value), valueParser: (p) => Number(String(p.newValue).replace(/[^\d.]/g, '')),
      },
      {
        field: 'status', editable: true, cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['available', 'reserved', 'sold'] },
        cellClassRules: { 'cell-reserved': (p) => p.value !== 'available' },
      },
    ],
    [],
  );

  const stats = useMemo(() => {
    const available = slabs.filter((s) => s.status === 'available');
    return [
      ['Slabs available', available.length],
      ['Stock value', thb(available.reduce((n, s) => n + s.price_thb, 0))],
      ['Deposits collected', thb(orders.filter((o) => o.status !== 'refunded').reduce((n, o) => n + o.deposit, 0))],
      ['Balance to collect', thb(orders.filter((o) => o.status === 'deposit_paid').reduce((n, o) => n + o.balance, 0))],
    ];
  }, [slabs, orders]);

  return (
    <div className="owner">
      <header className="site-head">
        <div className="wrap head-inner">
          <a className="brand" href="/">
            <img src="/brand/logo.png" alt="" width="40" height="40" />
            <span>Blue Sea Wood · Owner desk</span>
          </a>
          <nav>
            <a href="/">View shop</a>
          </nav>
        </div>
      </header>

      <main className="wrap owner-main">
        {needKey && (
          <form
            className="key-form"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                sessionStorage.setItem('bsw-owner-key', key);
              } catch {
                /* private mode: keep it in memory only */
              }
              load();
            }}
          >
            <label>
              Owner key
              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
            </label>
            <button className="btn">Open</button>
          </form>
        )}

        <section className="stats" aria-label="Summary">
          {stats.map(([label, value]) => (
            <div key={label} className="stat">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        {toast && (
          <p className="toast" role="status">
            {toast} <button onClick={() => setToast('')} aria-label="Dismiss">×</button>
          </p>
        )}

        <section className="section">
          <h2 className="section-title">Orders</h2>
          <p className="hint">Deposits paid through the website. When a slab is finished, send the balance as a PayPal invoice.</p>
          <div className="grid-box" style={{ height: Math.min(420, 110 + orders.length * 42) }}>
            <AgGridReact
              theme={gridTheme}
              rowData={orders}
              columnDefs={orderCols}
              defaultColDef={{ flex: 1, minWidth: 120, sortable: true, filter: true, resizable: true }}
              context={{ sendInvoice, refund, busyId }}
              getRowId={(p) => p.data.id}
              overlayNoRowsTemplate="No orders yet. They appear here as soon as a customer pays a deposit."
            />
          </div>
        </section>

        <ListingWriter
          api={api}
          onAdded={(slab) => {
            setSlabs((all) => [...all, { ...slab, deposit: Math.round(slab.price_thb / 2), free_shipping: true }]);
            setToast(`${slab.id} is now in stock on the shop and in the AI concierge.`);
          }}
        />

        <section className="section">
          <h2 className="section-title">Slab stock</h2>
          <p className="hint">Double-click a price, tone or status to edit. Changes go live on the shop and in the AI concierge at once.</p>
          <div className="grid-box" style={{ height: 470 }}>
            <AgGridReact
              theme={gridTheme}
              rowData={slabs}
              columnDefs={slabCols}
              defaultColDef={{ flex: 1, minWidth: 110, sortable: true, filter: true, resizable: true }}
              getRowId={(p) => p.data.id}
              onCellValueChanged={onSlabEdit}
              stopEditingWhenCellsLoseFocus
            />
          </div>
        </section>
      </main>
    </div>
  );
}
