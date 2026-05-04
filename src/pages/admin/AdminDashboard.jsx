import React, { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../utils/adminApi";

const STATUS_ORDER = ["pending", "paid", "shipped", "delivered", "cancelled"];

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function getStatusTone(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (["paid", "delivered", "completed"].includes(normalized)) return "success";
  if (["pending", "processing"].includes(normalized)) return "pending";
  if (["shipped"].includes(normalized)) return "info";
  if (["cancelled", "failed", "refunded"].includes(normalized)) return "danger";
  return "neutral";
}

function AdminDashboard() {
  const [data, setData] = useState({ metrics: null, recentOrders: [], lowStock: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    adminFetch("admin_dashboard.php")
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setError("");
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
  }, []);

  const metrics = data.metrics || {};
  const recentOrders = Array.isArray(data.recentOrders) ? data.recentOrders : [];
  const lowStock = Array.isArray(data.lowStock) ? data.lowStock : [];

  const statusSummary = useMemo(() => {
    const total = Math.max(recentOrders.length, 1);

    return STATUS_ORDER.map((status) => {
      const count = recentOrders.filter((order) => String(order.status || "").toLowerCase() === status).length;
      return {
        key: status,
        label: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        percent: Math.round((count / total) * 100),
        tone: getStatusTone(status),
      };
    });
  }, [recentOrders]);

  const paymentSummary = useMemo(() => {
    const buckets = ["Pending", "Completed", "Paid", "Failed"];
    return buckets.map((label) => ({
      label,
      count: recentOrders.filter((order) => String(order.payment_status || "").toLowerCase() === label.toLowerCase()).length,
      tone: getStatusTone(label),
    }));
  }, [recentOrders]);

  const revenue = Number(metrics.revenue || 0);
  const revenueTarget = Math.max(100000, Math.ceil(Math.max(revenue, 1) / 25000) * 25000);
  const revenueProgress = Math.min(100, Math.max(revenue > 0 ? 12 : 0, (revenue / revenueTarget) * 100));
  const salesBars = (recentOrders.length > 0
    ? recentOrders.slice(0, 6).reverse()
    : [{ grand_total: 14000 }, { grand_total: 22000 }, { grand_total: 18000 }, { grand_total: 27000 }, { grand_total: 24000 }, { grand_total: 32000 }]);
  const maxSalesBar = Math.max(...salesBars.map((order) => Number(order.grand_total || 0)), 1);

  const metricCards = [
    { label: "Products", value: metrics.products || 0, note: "Live catalog" },
    { label: "Orders", value: metrics.orders || 0, note: "Total orders" },
    { label: "Users", value: metrics.users || 0, note: "Registered shoppers" },
    { label: "Reviews", value: metrics.reviews || 0, note: "Customer feedback" },
    { label: "Total Revenue", value: formatCurrency(metrics.revenue || 0), note: "Gross sales" },
  ];

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p className="admin-error">{error}</p>;

  return (
    <section>
      <header className="admin-page-head">
        <h2>Dashboard</h2>
        <p>Overview of your store performance and operations.</p>
      </header>

      <div className="admin-metric-grid">
        {metricCards.map((card) => (
          <article key={card.label}>
            <h3>{card.label}</h3>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </div>

      <div className="admin-dashboard-visuals">
        <div className="admin-card">
          <div className="admin-card-head">
            <div>
              <h3>Revenue Snapshot</h3>
              <p>Track current revenue momentum like a live commerce dashboard.</p>
            </div>
            <span className="admin-badge">This month</span>
          </div>

          <div className="admin-hero-grid">
            <div className="admin-hero-stats">
              <strong>{formatCurrency(revenue)}</strong>
              <small>{Math.round(revenueProgress)}% of {formatCurrency(revenueTarget)} target</small>

              <div className="admin-mini-bars" aria-hidden="true">
                {salesBars.map((order, index) => (
                  <div className="admin-mini-bar" key={`${order.order_number || index}-${index}`}>
                    <span style={{ height: `${Math.max(14, (Number(order.grand_total || 0) / maxSalesBar) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-progress-ring" style={{ "--progress": `${revenueProgress}%` }}>
              <div className="admin-progress-ring-inner">
                <strong>{Math.round(revenueProgress)}%</strong>
                <span>Target hit</span>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div>
              <h3>Order Status Mix</h3>
              <p>See how order activity is split across current fulfillment stages.</p>
            </div>
            <span className="admin-badge admin-badge--muted">Live</span>
          </div>

          <div className="admin-status-stack">
            {statusSummary.map((item) => (
              <div className="admin-status-row" key={item.key}>
                <div className="admin-status-meta">
                  <span className={`admin-pill admin-pill--${item.tone}`}>{item.label}</span>
                  <small>{item.count} order{item.count === 1 ? "" : "s"}</small>
                </div>
                <div className="admin-status-track">
                  <span className={`admin-status-fill admin-status-fill--${item.tone}`} style={{ width: `${item.count > 0 ? Math.max(item.percent, 12) : 0}%` }} />
                </div>
                <strong>{item.percent}%</strong>
              </div>
            ))}
          </div>

          <div className="admin-payment-grid">
            {paymentSummary.map((item) => (
              <div className="admin-payment-card" key={item.label}>
                <span className={`admin-pill admin-pill--${item.tone}`}>{item.label}</span>
                <strong>{item.count}</strong>
                <small>Payment updates</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <div className="admin-card-head">
            <div>
              <h3>Recent Orders</h3>
              <p>Latest storefront activity with status and payment overview.</p>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan="4">No orders yet.</td>
                  </tr>
                )}
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_number || `#${order.id}`}</td>
                    <td>
                      <span className={`admin-pill admin-pill--${getStatusTone(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-pill admin-pill--${getStatusTone(order.payment_status)}`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td>{formatCurrency(Number(order.grand_total || 0).toFixed(2))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div>
              <h3>Low Stock Variants</h3>
              <p>Inventory alerts that need restocking attention.</p>
            </div>
          </div>

          <ul className="admin-list admin-list--alerts">
            {lowStock.length === 0 && <li className="admin-empty-panel">No low stock alerts.</li>}
            {lowStock.map((item) => (
              <li key={item.variant_id}>
                <div>
                  <strong>{item.name}</strong>
                  <div>{item.sku || "No SKU"}</div>
                </div>
                <span className="admin-stock-count">{item.stock_quantity} left</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default AdminDashboard;
