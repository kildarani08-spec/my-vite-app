import React, { useState, useEffect } from "react";
import GuestOrderTrack from "./GuestOrderTrack";
import { roundPayableTotal } from "../utils/pricing";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";
import { getDeliveryStatusText } from "../utils/delivery";

const STATUS_COLOR = {
  pending: "#f59e0b",
  paid: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#22c55e",
  cancelled: "#ef4444",
  refunded: "#6b7280",
};

function Orders() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());

  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicSiteContent(controller.signal)
      .then((content) => setSiteContent(content))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const ordersCopy = siteContent.ordersPage || {};

  useEffect(() => {
    if (!token) {
      return;
    }

    fetch("https://my-vite-app-backend.onrender.com/orders.php", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setOrders(data.orders);
        else setError(data.error || ordersCopy.loadFailedText || "Failed to load orders.");
      })
      .catch(() => setError(ordersCopy.networkErrorText || "Could not reach server."))
      .finally(() => setLoading(false));
  }, [token, ordersCopy.loadFailedText, ordersCopy.networkErrorText]);

  if (!token) {
    return <GuestOrderTrack />;
  }

  function openOrder(order) {
    fetch(`https://my-vite-app-backend.onrender.com/orders.php?id=${order.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSelected(data);
      });
  }

  if (loading) return <div style={{ padding: 24 }}>{ordersCopy.loadingText || "Loading orders..."}</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>{error}</div>;

  if (selected) {
    const { order, items, events = [] } = selected;
    return (
      <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            marginBottom: 16,
            background: "none",
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          ← {ordersCopy.backToOrdersLabel || "Back to orders"}
        </button>
        <h2>Order #{order.order_number}</h2>
        <p>
          {ordersCopy.statusLabel || "Status"}:{" "}
          <span
            style={{
              color: STATUS_COLOR[order.status] || "#333",
              fontWeight: 600,
            }}
          >
            {order.status}
          </span>
        </p>
        {order.tracking_number && (
          <p>{ordersCopy.trackingLabel || "Tracking"}: {order.tracking_number}</p>
        )}
        <p>Delivery Estimate: {getDeliveryStatusText(order.status, order.created_at)}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>{ordersCopy.itemLabel || "Item"}</th>
              <th style={{ padding: "8px 12px" }}>{ordersCopy.qtyLabel || "Qty"}</th>
              <th style={{ padding: "8px 12px" }}>{ordersCopy.priceLabel || "Price"}</th>
              <th style={{ padding: "8px 12px" }}>{ordersCopy.totalLabel || "Total"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.order_item_id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "8px 12px" }}>
                  {item.name}
                  {item.sku && (
                    <div style={{ fontSize: 12, color: "#6b7280" }}>SKU: {item.sku}</div>
                  )}
                </td>
                <td style={{ padding: "8px 12px" }}>{item.quantity}</td>
                <td style={{ padding: "8px 12px" }}>₹{roundPayableTotal(item.price)}</td>
                <td style={{ padding: "8px 12px" }}>₹{roundPayableTotal(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "right", marginTop: 12 }}>
          <div>{ordersCopy.subtotalLabel || "Subtotal"}: ₹{roundPayableTotal(order.subtotal)}</div>
          <div>{ordersCopy.shippingLabel || "Shipping"}: ₹{roundPayableTotal(order.shipping_cost)}</div>
          {Number(order.discount_amount) > 0 && (
            <div style={{ color: "#22c55e" }}>
              {ordersCopy.discountLabel || "Discount"}: −₹{roundPayableTotal(order.discount_amount)}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>
            {ordersCopy.grandTotalLabel || "Grand Total"}: ₹{Number(order.grand_total).toFixed(0)}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 8 }}>{ordersCopy.timelineTitle || "Order Timeline"}</h3>
          {events.length === 0 ? (
            <p style={{ color: "#6b7280" }}>{ordersCopy.noTimelineText || "No timeline updates yet."}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              {events.map((event, index) => (
                <li key={`${event.event_type}-${event.created_at}-${index}`}>
                  <strong style={{ textTransform: "capitalize" }}>{event.title || event.event_type}</strong>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>{event.details || "-"}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {new Date(event.created_at).toLocaleString("en-IN")} | {event.actor_type}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <h2>{ordersCopy.title || "My Orders"}</h2>
        <p>{ordersCopy.emptyText || "You have no orders yet."}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
      <h2>{ordersCopy.title || "My Orders"}</h2>
      {orders.map((order) => (
        <div
          key={order.id}
          onClick={() => openOrder(order)}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 16,
            marginBottom: 12,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            transition: "box-shadow 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.1)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
        >
          <div>
            <div style={{ fontWeight: 600 }}>#{order.order_number}</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              {new Date(order.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {getDeliveryStatusText(order.status, order.created_at)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-block",
                background: STATUS_COLOR[order.status] + "22",
                color: STATUS_COLOR[order.status] || "#333",
                borderRadius: 20,
                padding: "2px 12px",
                fontWeight: 600,
                fontSize: 13,
                textTransform: "capitalize",
              }}
            >
              {order.status}
            </div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>
              ₹{Number(order.grand_total).toFixed(0)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Orders;
