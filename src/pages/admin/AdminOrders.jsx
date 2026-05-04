import React, { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../utils/adminApi";

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const formatCurrency = (value) => `₹${Number(value || 0).toFixed(2)}`;
const titleize = (value) => String(value || "")
  .replace(/[_-]+/g, " ")
  .replace(/\b\w/g, (char) => char.toUpperCase());
const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};
const statusTone = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (["delivered", "paid", "refunded"].includes(normalized)) return "success";
  if (["shipped", "confirmed"].includes(normalized)) return "info";
  if (["cancelled", "failed"].includes(normalized)) return "danger";
  return "pending";
};

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [detailEvents, setDetailEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [workflowNote, setWorkflowNote] = useState("");
  const [trackingForm, setTrackingForm] = useState({
    courier: "",
    trackingNumber: "",
    eta: "",
    note: ""
  });

  useEffect(() => {
    let active = true;
    setLoading(true);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (paymentFilter) params.set("payment_status", paymentFilter);

    adminFetch(`admin_orders.php?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        const nextOrders = payload.orders || [];
        setOrders(nextOrders);
        setSummary(payload.summary || {});
        setError("");
        setSelectedOrderId((current) => {
          if (current && nextOrders.some((order) => Number(order.id) === Number(current))) {
            return current;
          }
          return nextOrders[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, statusFilter, paymentFilter, refreshKey]);

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrder(null);
      setDetailItems([]);
      setDetailEvents([]);
      return;
    }

    let active = true;
    setDetailLoading(true);

    adminFetch(`admin_orders.php?order_id=${selectedOrderId}`)
      .then((payload) => {
        if (!active) return;
        setSelectedOrder(payload.order || null);
        setDetailItems(payload.items || []);
        setDetailEvents(payload.events || []);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedOrderId, refreshKey]);

  const summaryCards = useMemo(() => ([
    { label: "Total orders", value: Number(summary.totalOrders ?? orders.length ?? 0), hint: "All customer orders" },
    { label: "Need action", value: Number(summary.attentionCount ?? 0), hint: "Pending / processing" },
    { label: "In transit", value: Number(summary.shippedCount ?? 0), hint: "Shipment follow-up" },
    { label: "Refunded", value: Number(summary.refundCount ?? 0), hint: "Finance resolution" },
    { label: "Revenue", value: formatCurrency(summary.revenue ?? 0), hint: "Paid + active COD value" }
  ]), [orders.length, summary]);

  const runOrderAction = async (payload, options = {}) => {
    if (!selectedOrderId) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await adminFetch("admin_orders.php", {
        method: "POST",
        body: JSON.stringify({
          order_id: selectedOrderId,
          ...payload
        })
      });

      setMessage(result.message || "Order updated");

      if (options.resetNote) {
        setWorkflowNote("");
      }
      if (options.resetTracking) {
        setTrackingForm({ courier: "", trackingNumber: "", eta: "", note: "" });
      }

      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleStatusSave = () => {
    if (!selectedOrder) return;
    runOrderAction({
      action: "update_status",
      status: selectedOrder.status,
      payment_status: selectedOrder.payment_status,
      note: workflowNote
    }, { resetNote: true });
  };

  const handleAddTracking = () => {
    runOrderAction({
      action: "add_tracking",
      courier: trackingForm.courier,
      tracking_number: trackingForm.trackingNumber,
      eta: trackingForm.eta,
      tracking_note: trackingForm.note || workflowNote
    }, { resetTracking: true, resetNote: true });
  };

  const handleAddNote = () => {
    runOrderAction({ action: "add_note", note: workflowNote }, { resetNote: true });
  };

  return (
    <section>
      <header className="admin-page-head">
        <h2>Orders</h2>
        <p>Operate like a real ecommerce admin team: track shipments, manage payment states, log internal notes, and handle return or refund decisions from one place.</p>
      </header>

      <div className="admin-metric-grid">
        {summaryCards.map((card) => (
          <article key={card.label}>
            <h3>{card.label}</h3>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </div>

      {message && <p className="admin-success">{message}</p>}
      {error && <p className="admin-error">{error}</p>}

      <div className="admin-orders-shell">
        <div className="admin-card">
          <div className="admin-card-head">
            <div>
              <h3>Order queue</h3>
              <p>Search by order number, customer, or payment stage.</p>
            </div>
            <span className="admin-badge">Ops desk</span>
          </div>

          <div className="admin-toolbar">
            <input
              placeholder="Search order / customer / email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>{titleize(status)}</option>
              ))}
            </select>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="">All payments</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{titleize(status)}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p>Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="admin-empty-panel">No orders found for the current filters.</p>
          ) : (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className={Number(selectedOrderId) === Number(order.id) ? "admin-order-row is-selected" : "admin-order-row"}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <td>
                        <strong>{order.order_number || `#${order.id}`}</strong>
                        <div className="admin-order-subtext">{formatDateTime(order.created_at)}</div>
                      </td>
                      <td>
                        <strong>{order.customer_name || "Unknown"}</strong>
                        <div className="admin-order-subtext">{order.customer_email || "No email"}</div>
                      </td>
                      <td>{Number(order.item_count || 0)}</td>
                      <td>{formatCurrency(order.grand_total || 0)}</td>
                      <td>
                        <span className={`admin-order-pill admin-order-pill--${statusTone(order.status)}`}>
                          {titleize(order.status)}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-order-pill admin-order-pill--${statusTone(order.payment_status)}`}>
                          {titleize(order.payment_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-order-detail-stack">
          {!selectedOrderId ? (
            <div className="admin-card">
              <p className="admin-empty-panel">Select an order to open tracking, return, and refund controls.</p>
            </div>
          ) : detailLoading || !selectedOrder ? (
            <div className="admin-card">
              <p>Loading order details...</p>
            </div>
          ) : (
            <>
              <div className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <h3>{selectedOrder.order_number || `Order #${selectedOrder.id}`}</h3>
                    <p>Customer-facing fulfillment and payment controls.</p>
                  </div>
                  <span className={`admin-order-pill admin-order-pill--${statusTone(selectedOrder.status)}`}>
                    {titleize(selectedOrder.status)}
                  </span>
                </div>

                <div className="admin-order-kv-grid">
                  <div>
                    <span className="admin-summary-label">Customer</span>
                    <strong>{selectedOrder.customer_name || "Unknown"}</strong>
                    <small>{selectedOrder.customer_email || "No email"}</small>
                  </div>
                  <div>
                    <span className="admin-summary-label">Payment</span>
                    <strong>{titleize(selectedOrder.payment_method || "cod")}</strong>
                    <small>{titleize(selectedOrder.payment_status || "pending")}</small>
                  </div>
                  <div>
                    <span className="admin-summary-label">Placed on</span>
                    <strong>{formatDateTime(selectedOrder.created_at)}</strong>
                    <small>Updated {formatDateTime(selectedOrder.updated_at)}</small>
                  </div>
                  <div>
                    <span className="admin-summary-label">Order total</span>
                    <strong>{formatCurrency(selectedOrder.grand_total || 0)}</strong>
                    <small>{detailItems.length} line items</small>
                  </div>
                </div>

                <div className="admin-order-address-blocks">
                  <div className="admin-promo-summary-card">
                    <span className="admin-summary-label">Shipping address</span>
                    <strong>{selectedOrder.shipping_address || "Not available"}</strong>
                  </div>
                  <div className="admin-promo-summary-card">
                    <span className="admin-summary-label">Billing address</span>
                    <strong>{selectedOrder.billing_address || selectedOrder.shipping_address || "Not available"}</strong>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h3>Order status control</h3>
                <div className="admin-order-form-grid">
                  <label className="admin-field-stack">
                    <span>Order status</span>
                    <select
                      value={selectedOrder.status || "pending"}
                      onChange={(e) => setSelectedOrder((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>{titleize(status)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field-stack">
                    <span>Payment status</span>
                    <select
                      value={selectedOrder.payment_status || "pending"}
                      onChange={(e) => setSelectedOrder((prev) => ({ ...prev, payment_status: e.target.value }))}
                    >
                      {PAYMENT_STATUSES.map((status) => (
                        <option key={status} value={status}>{titleize(status)}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="admin-field-stack">
                  <span>Internal note / customer update note</span>
                  <textarea
                    placeholder="Add an operations note, escalation note, or customer-facing update..."
                    value={workflowNote}
                    onChange={(e) => setWorkflowNote(e.target.value)}
                  />
                </label>
                <div className="admin-order-action-row">
                  <button type="button" onClick={handleStatusSave} disabled={busy}>
                    {busy ? "Saving..." : "Save status"}
                  </button>
                  <button type="button" onClick={handleAddNote} disabled={busy || !workflowNote.trim()}>
                    Add note to timeline
                  </button>
                </div>
              </div>

              <div className="admin-card">
                <h3>Shipment tracking</h3>
                <div className="admin-order-form-grid">
                  <input
                    placeholder="Courier partner (e.g. Delhivery)"
                    value={trackingForm.courier}
                    onChange={(e) => setTrackingForm((prev) => ({ ...prev, courier: e.target.value }))}
                  />
                  <input
                    placeholder="Tracking number"
                    value={trackingForm.trackingNumber}
                    onChange={(e) => setTrackingForm((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                  />
                  <input
                    placeholder="ETA / delivery window"
                    value={trackingForm.eta}
                    onChange={(e) => setTrackingForm((prev) => ({ ...prev, eta: e.target.value }))}
                  />
                  <input
                    placeholder="Shipment note"
                    value={trackingForm.note}
                    onChange={(e) => setTrackingForm((prev) => ({ ...prev, note: e.target.value }))}
                  />
                </div>
                <div className="admin-order-action-row">
                  <button type="button" onClick={handleAddTracking} disabled={busy}>
                    Save tracking & mark shipped
                  </button>
                  <button
                    type="button"
                    onClick={() => runOrderAction({
                      action: "update_status",
                      status: "delivered",
                      payment_status: selectedOrder.payment_status,
                      note: workflowNote || "Order delivered to customer."
                    }, { resetNote: true })}
                    disabled={busy}
                  >
                    Mark delivered
                  </button>
                </div>
              </div>

              <div className="admin-card">
                <h3>Returns & refunds</h3>
                <div className="admin-order-action-grid">
                  <button type="button" onClick={() => runOrderAction({ action: "mark_return_requested", note: workflowNote }, { resetNote: true })} disabled={busy}>
                    Mark return requested
                  </button>
                  <button type="button" onClick={() => runOrderAction({ action: "approve_return", note: workflowNote }, { resetNote: true })} disabled={busy}>
                    Approve return
                  </button>
                  <button type="button" onClick={() => runOrderAction({ action: "reject_return", note: workflowNote }, { resetNote: true })} disabled={busy}>
                    Reject return
                  </button>
                  <button type="button" onClick={() => runOrderAction({ action: "issue_refund", note: workflowNote }, { resetNote: true })} disabled={busy || selectedOrder.payment_status === "refunded"}>
                    Issue refund
                  </button>
                </div>
              </div>

              <div className="admin-card">
                <h3>Items in this order</h3>
                {detailItems.length === 0 ? (
                  <p className="admin-empty-panel">No items found for this order.</p>
                ) : (
                  <div className="admin-order-items">
                    {detailItems.map((item) => (
                      <div className="admin-order-item-row" key={item.order_item_id || `${item.product_id}-${item.variant_id}`}>
                        <div>
                          <strong>{item.name || `Product #${item.product_id}`}</strong>
                          <small>SKU: {item.sku || "N/A"}</small>
                        </div>
                        <div>
                          <strong>Qty {item.quantity}</strong>
                          <small>{formatCurrency(item.price || 0)} each</small>
                        </div>
                        <div>
                          <strong>{formatCurrency(item.total || 0)}</strong>
                          <small>Line total</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-card">
                <h3>Order timeline</h3>
                {detailEvents.length === 0 ? (
                  <p className="admin-empty-panel">No operational events have been logged yet.</p>
                ) : (
                  <ul className="admin-order-timeline">
                    {detailEvents.map((event, index) => (
                      <li key={`${event.event_type || "event"}-${event.created_at || index}-${index}`}>
                        <div className="admin-order-timeline-head">
                          <strong>{event.title || titleize(event.event_type || "Update")}</strong>
                          <span>{formatDateTime(event.created_at)}</span>
                        </div>
                        <small>{titleize(event.actor_type || "system")}</small>
                        {event.details && <p>{event.details}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminOrders;
