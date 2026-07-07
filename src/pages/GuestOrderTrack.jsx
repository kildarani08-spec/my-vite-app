import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";
import { resolveImageUrl } from "../utils/imageUrl";
import { getDeliveryStatusText } from "../utils/delivery";
import "../styles/GuestOrderTrack.css";

const ORDER_STEPS = ["Order Confirmed", "Shipped", "Out for Delivery", "Delivered"];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatShortDate(value) {
  if (!value) {
    return "Pending";
  }

  return new Date(value).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function addDays(value, days) {
  const base = value ? new Date(value) : new Date();
  base.setDate(base.getDate() + days);
  return base;
}

function getStageIndex(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "delivered") return 3;
  if (normalized === "shipped") return 2;
  if (normalized === "processing") return 1;
  return 0;
}

function getStepDates(order, events) {
  const createdAt = order?.created_at ? new Date(order.created_at) : new Date();
  const eventList = Array.isArray(events) ? events : [];

  const shippedEvent = eventList.find((event) => /ship/i.test(event?.title || event?.event_type || ""));
  const outForDeliveryEvent = eventList.find((event) => /out|delivery/i.test(event?.title || event?.event_type || ""));
  const deliveredEvent = eventList.find((event) => /deliver/i.test(event?.title || event?.event_type || ""));

  return [
    formatShortDate(createdAt),
    formatShortDate(shippedEvent?.created_at || addDays(createdAt, 1)),
    formatShortDate(outForDeliveryEvent?.created_at || addDays(createdAt, 3)),
    `Expected by ${formatShortDate(deliveredEvent?.created_at || addDays(createdAt, 5))}`,
  ];
}

function getDeliveryLines(order) {
  const rawAddress = String(order?.shipping_address_text || order?.shipping_address || "").trim();
  const lines = rawAddress
    ? rawAddress.split(",").map((part) => part.trim()).filter(Boolean)
    : [];

  if (order?.customer_phone) {
    lines.push(String(order.customer_phone));
  }

  return lines.length > 0 ? lines : ["Delivery details will appear here once the order is confirmed."];
}

function getPaymentLabel(order) {
  const method = String(order?.payment_method || "cod").toLowerCase();
  const paymentStatus = String(order?.payment_status || "Pending");

  if (method === "upi") {
    return `UPI • ${paymentStatus}`;
  }

  if (method === "card") {
    return `Card • ${paymentStatus}`;
  }

  return `Cash on Delivery • ${paymentStatus}`;
}

function GuestOrderTrack() {
  const [searchParams] = useSearchParams();
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const [orderNumber, setOrderNumber] = useState(searchParams.get("order_number") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSearch = useMemo(() => orderNumber.trim() && email.trim(), [orderNumber, email]);

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicSiteContent(controller.signal)
      .then((content) => {
        setSiteContent(content);
      })
      .catch(() => {
        // Keep fallback content when public content is unavailable.
      });

    return () => controller.abort();
  }, []);

  const pageContent = siteContent.guestOrderTrackPage || {};
  const brand = siteContent.brand || {};
  const pageCopy = {
    title: pageContent.title || "Track Guest Order",
    description:
      pageContent.description ||
      "Enter your order number and checkout email to view a complete order summary and delivery status.",
    orderNumberLabel: pageContent.orderNumberLabel || "Order Number",
    orderNumberPlaceholder: pageContent.orderNumberPlaceholder || "ORD-20260330-ABC123",
    emailLabel: pageContent.emailLabel || "Email",
    emailPlaceholder: pageContent.emailPlaceholder || "you@example.com",
    submitLabel: pageContent.submitLabel || "Track Order",
    submitLoadingLabel: pageContent.submitLoadingLabel || "Checking...",
  };

  const stageIndex = getStageIndex(order?.status);
  const stepDates = getStepDates(order, events);
  const summary = {
    subtotal: Number(order?.subtotal ?? order?.grand_total ?? 0),
    discount: Number(order?.discount_amount ?? 0),
    shipping: Number(order?.shipping_cost ?? 0),
    tax: Number(order?.tax_amount ?? 0),
    total: Number(order?.grand_total ?? order?.total_amount ?? 0),
  };

  const fetchOrder = async (event) => {
    event.preventDefault();
    if (!canSearch) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        order_number: orderNumber.trim(),
        email: email.trim(),
      });
      const response = await fetch(`https://my-vite-app-backend.onrender.com/guest_order_track.php?${query.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const raw = await response.text();
      let payload = {};

      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("Unable to load order status right now. Please try again.");
      }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to find order");
      }

      setOrder(payload.order || null);
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setEvents(Array.isArray(payload.events) ? payload.events : []);
    } catch (err) {
      setOrder(null);
      setItems([]);
      setEvents([]);
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="guest-track-page">
      <div className="guest-track-wrap">
        <header className="guest-track-header">
          <h1>{pageCopy.title}</h1>
          <p className="guest-track-description">{pageCopy.description}</p>
        </header>

        <form className="guest-track-form" onSubmit={fetchOrder}>
          <label>
            <span>{pageCopy.orderNumberLabel}</span>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder={pageCopy.orderNumberPlaceholder}
              required
            />
          </label>

          <label>
            <span>{pageCopy.emailLabel}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={pageCopy.emailPlaceholder}
              required
            />
          </label>

          <button type="submit" disabled={!canSearch || loading}>
            {loading ? pageCopy.submitLoadingLabel : pageCopy.submitLabel}
          </button>
        </form>

        {error && <p className="guest-track-error">{error}</p>}

        {order && (
          <article className="guest-track-result">
            <section className="guest-track-progress">
              {ORDER_STEPS.map((step, index) => {
                const isComplete = index <= stageIndex;
                const isCurrent = index === stageIndex;

                return (
                  <div
                    key={step}
                    className={`guest-track-step${isComplete ? " is-complete" : ""}${isCurrent ? " is-current" : ""}`}
                  >
                    <span className="guest-track-step-dot" />
                    <strong className="guest-track-step-label">{step}</strong>
                    <span className="guest-track-step-date">{stepDates[index]}</span>
                  </div>
                );
              })}
            </section>

            <section className="guest-track-items-list">
              {items.map((item, index) => {
                const qty = Number(item.qty ?? item.quantity ?? 1);
                const unitPrice = Number(item.price || 0);
                const lineTotal = Number(item.total ?? unitPrice * qty);

                return (
                  <div className="guest-track-item-card" key={`${item.id || item.order_item_id || item.name}-${index}`}>
                    <img
                      src={resolveImageUrl(item.image, "https://via.placeholder.com/160?text=Product")}
                      alt={item.name}
                      loading="lazy"
                    />

                    <div className="guest-track-item-copy">
                      <h3>{item.name}</h3>
                      <p>
                        {item.sku ? `${item.sku} | ` : ""}
                        Qty: {qty}
                      </p>
                    </div>

                    <div className="guest-track-item-price">
                      <strong>{formatCurrency(lineTotal)}</strong>
                      <span>Qty: {qty}</span>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="guest-track-info-grid">
              <div className="guest-track-info-card">
                <h3>Payment</h3>
                <p>{getPaymentLabel(order)}</p>
                <small>{order.order_number}</small>
              </div>

              <div className="guest-track-info-card">
                <h3>Delivery</h3>
                <p>{getDeliveryStatusText(order.status, order.created_at)}</p>
                <div className="guest-track-delivery-lines">
                  {getDeliveryLines(order).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </div>

              <div className="guest-track-info-card">
                <h3>Need Help</h3>
                <div className="guest-track-help-links">
                  <a href={`mailto:${brand.supportEmail || "support@myshop.com"}?subject=Order%20Issue%20-%20${encodeURIComponent(order.order_number)}`}>
                    <span>Order Issues</span>
                    <span>↗</span>
                  </a>
                  <a href={`tel:${brand.supportPhone || "+910000000000"}`}>
                    <span>Delivery Info</span>
                    <span>↗</span>
                  </a>
                  <a href={`mailto:${brand.supportEmail || "support@myshop.com"}?subject=Returns%20-%20${encodeURIComponent(order.order_number)}`}>
                    <span>Returns</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>

              <div className="guest-track-info-card guest-track-summary-card">
                <h3>Order Summary</h3>
                <div className="guest-track-summary-row">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(summary.subtotal)}</strong>
                </div>
                <div className="guest-track-summary-row">
                  <span>Discount</span>
                  <strong>- {formatCurrency(summary.discount)}</strong>
                </div>
                <div className="guest-track-summary-row">
                  <span>Delivery</span>
                  <strong>{formatCurrency(summary.shipping)}</strong>
                </div>
                <div className="guest-track-summary-row">
                  <span>Tax</span>
                  <strong>{formatCurrency(summary.tax)}</strong>
                </div>
                <div className="guest-track-summary-row guest-track-summary-row--total">
                  <span>Total</span>
                  <strong>{formatCurrency(summary.total)}</strong>
                </div>
              </div>
            </section>

            {events.length > 0 && (
              <section className="guest-track-updates">
                <h3>Latest Updates</h3>
                <ul className="guest-track-updates-list">
                  {events.map((evt, index) => (
                    <li key={`${evt.event_type || evt.title}-${evt.created_at || index}`}>
                      <strong>{evt.title || evt.event_type}</strong>
                      <span>{formatShortDate(evt.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        )}
      </div>
    </section>
  );
}

export default GuestOrderTrack;
