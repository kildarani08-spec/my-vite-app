import React, { useEffect, useState } from "react";
import { useCart } from "../contexts/useCart";
import "../cart.css";
import { useNavigate } from "react-router-dom";
import {
  buildOrderSummary,
  roundPayableTotal,
} from "../utils/pricing";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";
import { resolveImageUrl } from "../utils/imageUrl";
import { getStoredUser } from "../utils/adminApi";
import { getDeliveryEstimate } from "../utils/delivery";

function Cart() {
  const { cartItems, cartSummary, appliedPromotions, loading, error, fetchCart, updateItemQty } = useCart();
  const navigate = useNavigate();
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicSiteContent(controller.signal)
      .then((content) => {
        setSiteContent(content);
      })
      .catch(() => {
        // Keep fallback config when content API is unavailable.
      });

    return () => controller.abort();
  }, []);

  const shippingConfig = siteContent.offers;
  const cartPageContent = siteContent.cartPage;
  const currentUserRole = String(getStoredUser()?.role || "").trim().toLowerCase();
  const isAdminUser = currentUserRole === "admin" || currentUserRole === "super_admin";

  const hasFreeDeliveryPromo = appliedPromotions.some((promo) => {
    const offerType = String(promo?.offer_type || "").trim().toLowerCase();
    const promoName = String(promo?.name || promo?.code || "").trim().toLowerCase();
    return Boolean(promo?.free_shipping) || offerType === "free-shipping" || promoName.includes("free shipping") || promoName.includes("free delivery");
  });
  const activePromoTarget = String(siteContent.offers?.activePromoStrip?.to || siteContent.offers?.promoStrip?.to || "")
    .trim()
    .toLowerCase();
  const siteHasFreeDeliveryOffer = activePromoTarget.includes("offer=free-shipping");
  const freeShippingMessageEnabled = siteHasFreeDeliveryOffer || Boolean(cartSummary?.free_shipping_offer_active) || hasFreeDeliveryPromo;
  const computedSummary = buildOrderSummary(cartItems, {
    ...shippingConfig,
    freeShippingEnabled: freeShippingMessageEnabled,
  });
  const subtotal = Number(cartSummary?.subtotal ?? computedSummary.subtotal ?? 0);
  const catalogSubtotal = Number(
    cartSummary?.catalog_subtotal ?? cartItems.reduce(
      (sum, item) => sum + (Number(item.catalog_effective_price ?? item.snapshot_price ?? item.effective_price ?? 0) * Number(item.quantity ?? 0)),
      0
    )
  );
  const discountAmount = Number(cartSummary?.discount_amount ?? Math.max(0, catalogSubtotal - subtotal));
  const shipping = Number(cartSummary?.shipping_cost ?? computedSummary.shipping ?? 0);
  const grandTotal = Number(cartSummary?.grand_total ?? computedSummary.grandTotal ?? 0);
  const freeShippingThreshold = Number(cartSummary?.free_shipping_threshold ?? shippingConfig.freeShippingThreshold ?? 0);
  const freeDeliveryUnlocked = freeShippingMessageEnabled && freeShippingThreshold > 0 && subtotal >= freeShippingThreshold;
  const remainingForFreeShipping = freeShippingMessageEnabled && !freeDeliveryUnlocked
    ? Math.max(0, roundPayableTotal(freeShippingThreshold - subtotal))
    : 0;
  const freeShippingProgressMessage = `You're ₹${roundPayableTotal(remainingForFreeShipping)} from Free Shipping`;
  const unlockedShippingMessage = "You’ve unlocked Free Shipping";
  const freeShippingProgress = freeShippingThreshold > 0
    ? Math.min(100, Math.max(0, (subtotal / freeShippingThreshold) * 100))
    : 0;
  const appliedPromotionNames = appliedPromotions
    .map((promo) => String(promo?.name || promo?.code || "").trim())
    .filter(Boolean);
  const promotionLabel = appliedPromotionNames.length > 0
    ? `Promotions (${appliedPromotionNames.length} applied)`
    : "Promotions";
  const cartDeliveryEstimate = getDeliveryEstimate();

  if (isAdminUser) {
    return (
      <div className="cart-page">
        <h2>{cartPageContent.title || "Your Shopping Cart"}</h2>
        <div className="cart-empty-state">
          <h3>{cartPageContent.adminBlockedTitle || "Admin purchase is disabled"}</h3>
          <p>{cartPageContent.adminBlockedDescription || "Admin accounts can manage the store, but checkout should be done only from a customer account."}</p>
          <button
            className="checkout-btn cart-empty-action"
            onClick={() => navigate("/admin/dashboard")}
          >
            {cartPageContent.adminBlockedActionLabel || "Go to Admin Dashboard"}
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <p>{cartPageContent.loadingText || "Loading cart..."}</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="cart-page">
      <h2>{cartPageContent.title || "Your Shopping Cart"}</h2>

      {cartItems.length === 0 ? (
        <div className="cart-empty-state">
          <h3>{cartPageContent.emptyTitle || "Your cart is empty"}</h3>
          <p>{cartPageContent.emptyDescription || "Add products to your cart to see them here."}</p>
          <button
            className="checkout-btn cart-empty-action"
            onClick={() => navigate("/products")}
          >
            {cartPageContent.continueShoppingLabel || "Continue Shopping"}
          </button>
        </div>
      ) : (
        <div className="cart-layout">
          {/* Left side: cart items */}
          <ul className="cart-list">
            {cartItems.map((item) => (
              <li key={item.cart_id} className="cart-item">
                <img
                  src={resolveImageUrl(item.images?.[0], "https://via.placeholder.com/160?text=Product")}
                  alt={item.name}
                  className="cart-thumb"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "https://via.placeholder.com/160?text=Product";
                  }}
                />


                <div className="cart-details">
                  <h4>{item.name}</h4>
                  {item.variant_description && (
                    <p className="variant">{item.variant_description}</p>
                  )}
                  {item.sku && <p className="sku">SKU: {item.sku}</p>}
                  <p className="price">
                    {item.effective_price < item.snapshot_price ? (
                      <>
                        <span className="original-price">₹{roundPayableTotal(item.snapshot_price)}</span>
                        <span className="discount-price">₹{roundPayableTotal(item.effective_price)}</span>
                      </>
                    ) : (
                      <>₹{roundPayableTotal(item.effective_price)}</>
                    )}
                  </p>


                  <div className="quantity-controls">
                    <button
                      onClick={() =>
                        updateItemQty(item.product_id, item.variant_id, item.quantity - 1)
                      }
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() =>
                        updateItemQty(item.product_id, item.variant_id, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                  <p className="subtotal">
                    Subtotal: ₹{roundPayableTotal(item.effective_price * item.quantity)}
                  </p>
                </div>

                <button
                  className="remove-btn"
                  onClick={() =>
                    updateItemQty(item.product_id, item.variant_id, 0)
                  }
                > Remove
                </button>
              </li>
            ))}
          </ul>

          {/* Right side: summary */}
          <div className="cart-summary">
            <h3>{cartPageContent.summaryTitle || "Order Summary"}</h3>

            <div className="cart-summary-breakdown">
              <div className="cart-summary-row">
                <span>Item Subtotal</span>
                <strong>₹{catalogSubtotal.toFixed(2)}</strong>
              </div>

              <div className="cart-summary-row">
                <span>{promotionLabel}</span>
                <strong className={discountAmount > 0 ? "cart-summary-discount" : ""}>
                  -₹{discountAmount.toFixed(2)}
                </strong>
              </div>

              {appliedPromotionNames.length > 0 && (
                <p className="cart-summary-promo-note">{appliedPromotionNames.join(", ")}</p>
              )}

              <div className="cart-summary-row">
                <span>Item Total</span>
                <strong>₹{subtotal.toFixed(2)}</strong>
              </div>

              <div className="cart-summary-row">
                <span>{cartPageContent.shippingLabel || "Delivery Charges"}</span>
                <strong>{shipping === 0 ? "Free" : `₹${shipping.toFixed(2)}`}</strong>
              </div>

              <div className="cart-summary-row cart-summary-row--muted">
                <span>Tax</span>
                <strong>Inclusive</strong>
              </div>

              <p className="cart-summary-tax-note">No extra tax is added at checkout because the price already includes tax.</p>

              <div className="cart-summary-row cart-summary-row--total">
                <span>Estimated Total</span>
                <strong>₹{grandTotal.toFixed(2)}</strong>
              </div>
            </div>

            <div className="cart-delivery-estimate">
              <strong>Estimated Delivery</strong>
              <span>{cartDeliveryEstimate.rangeLabel}</span>
            </div>

            {freeShippingThreshold > 0 && (
              <div className="cart-free-shipping-block">
                <p className={`cart-free-shipping-note ${freeDeliveryUnlocked ? "cart-free-shipping-note--success" : ""}`}>
                  {freeDeliveryUnlocked ? unlockedShippingMessage : freeShippingProgressMessage}
                </p>
                <div className="cart-free-shipping-progress" aria-hidden="true">
                  <span style={{ width: `${freeShippingProgress}%` }} />
                </div>
                <div className="cart-free-shipping-scale">
                  <span>₹0</span>
                  <span>₹{roundPayableTotal(freeShippingThreshold)}</span>
                </div>
              </div>
            )}

            <button
              className="checkout-btn"
              onClick={() => navigate("/checkout")}
            >
              {cartPageContent.checkoutLabel || "Proceed to Checkout"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cart;
