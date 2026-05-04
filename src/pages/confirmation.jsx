import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { roundPayableTotal } from "../utils/pricing";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";
import { getDeliveryEstimate } from "../utils/delivery";
import "../styles/Checkout.css";

function applyTemplate(template, values, fallback) {
  const source = typeof template === "string" && template.trim() ? template : fallback;

  return source.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in values)) {
      return match;
    }

    return String(values[key]);
  });
}

function Confirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const details = location.state?.checkoutDetails || null;
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());

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

  const confirmationContent = siteContent.confirmationPage;
  const checkoutContent = siteContent.checkout;
  const guestUpsellContent = checkoutContent.guestUpsell || {};

  if (!details) {
    return (
      <div className="checkout-page">
        <h2>{confirmationContent.missingTitle || "Order details are not available"}</h2>
        <p>{confirmationContent.missingDescription || "Please place an order from checkout to view confirmation details here."}</p>
        <button type="button" onClick={() => navigate("/products")}>{confirmationContent.continueShoppingLabel || "Continue Shopping"}</button>
      </div>
    );
  }

  const guestUpsellText = applyTemplate(
    guestUpsellContent.bodyTemplate,
    {
      coupon: String(details.upsellCoupon || "WELCOME10").trim() || "WELCOME10"
    },
    "Sign up now and get 10% off your next order with {coupon}. Save this order to your account and check out faster next time."
  );

  const guestTrackingText = applyTemplate(
    confirmationContent.guestTrackingTemplate,
    {
      email: details.guestEmail || "your email",
      orderId: details.orderNumber || details.orderId
    },
    "Your order tracking is sent to {email}. Use Order ID {orderId} in all support emails."
  );
  const finalizedDeliveryEstimate = details.deliveryEstimateLabel || getDeliveryEstimate(details.placedAt || new Date()).rangeLabel;

  return (
    <div className="checkout-page">
      <h2>{confirmationContent.successTitle || "Order placed successfully"}</h2>
      <p>{confirmationContent.orderIdLabel || "Order ID"}: {details.orderId}</p>
      {details.orderNumber && <p>{confirmationContent.orderNumberLabel || "Order Number"}: {details.orderNumber}</p>}
      <p>{confirmationContent.totalPaidLabel || "Total Paid"}: ₹{roundPayableTotal(details.total || 0)}</p>
      <p>{confirmationContent.paymentMethodLabel || "Payment Method"}: {details.paymentMethod}</p>
      <p>{confirmationContent.gatewayLabel || "Gateway"}: {details.paymentProvider}</p>
      <p>{confirmationContent.shippingAddressLabel || "Shipping Address"}: {details.shippingAddress || "N/A"}</p>

      <div className="checkout-summary-card">
        <h3>Estimated Delivery</h3>
        <p>{finalizedDeliveryEstimate}</p>
        <small>Your delivery window is now locked in for this order.</small>
      </div>

      {details.gatewayReference && (
        <>
          <h3>{confirmationContent.gatewayReferenceTitle || "Gateway Reference"}</h3>
          {details.gatewayReference.order_id && <p>{confirmationContent.gatewayOrderIdLabel || "Gateway Order ID"}: {details.gatewayReference.order_id}</p>}
          {details.gatewayReference.payment_id && <p>{confirmationContent.gatewayPaymentIdLabel || "Gateway Payment ID"}: {details.gatewayReference.payment_id}</p>}
          {details.gatewayReference.signature && <p>{confirmationContent.gatewaySignatureLabel || "Gateway Signature"}: {details.gatewayReference.signature}</p>}
        </>
      )}

      <h3>{confirmationContent.itemsTitle || "Items"}</h3>
      <ul>
        {(details.items || []).map((item) => (
          <li key={item.id}>
            {item.name} - Qty: {item.quantity} - Unit: ₹{roundPayableTotal(item.unitPrice || 0)} - Total: ₹{roundPayableTotal(item.lineTotal || 0)}
          </li>
        ))}
      </ul>

      {details.isGuestCheckout && details.guestEmail && (
        <div className="checkout-guest-upsell">
          <h3>{confirmationContent.guestConfirmedTitle || "Guest order confirmed"}</h3>
          <p>{guestTrackingText}</p>
        </div>
      )}

      {details.upsellOffer && (
        <div className="checkout-guest-upsell">
          <h3>{guestUpsellContent.title || "Sign up now and claim your next-order reward"}</h3>
          <p>{guestUpsellText}</p>
          {details.upsellCoupon && (
            <p>
              {guestUpsellContent.rewardCodeLabel || "Sign-up reward code:"} <strong>{details.upsellCoupon}</strong>
            </p>
          )}
        </div>
      )}

      <div className="checkout-guest-upsell-actions">
        {details.isGuestCheckout ? (
          <button
            type="button"
            onClick={() =>
              navigate(`/register?email=${encodeURIComponent(details.guestEmail || "")}&coupon=${encodeURIComponent(details.upsellCoupon || "")}`)
            }
          >
            {guestUpsellContent.ctaLabel || "Sign Up Now"}
          </button>
        ) : (
          <button type="button" onClick={() => navigate("/account/orders")}>{confirmationContent.viewOrdersLabel || "View My Orders"}</button>
        )}
        <button type="button" onClick={() => navigate("/products")}>{confirmationContent.continueShoppingLabel || "Continue Shopping"}</button>
      </div>
    </div>
  );
}

export default Confirmation;
