import React, { useCallback, useEffect, useState } from "react";
import { CartContext } from "./cartContextValue";
import { getStoredUser } from "../utils/adminApi";

const getGuestToken = () => {
  let guestToken = localStorage.getItem("guest_token");
  if (!guestToken) {
    guestToken = crypto.randomUUID();
    localStorage.setItem("guest_token", guestToken);
  }
  return guestToken;
};

const ADMIN_PURCHASE_BLOCK_MESSAGE = "Admin accounts cannot use cart or checkout. Please sign in with a customer account.";

const isAdminStorefrontUser = () => {
  const role = String(getStoredUser()?.role || "").trim().toLowerCase();
  return role === "admin" || role === "super_admin";
};

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const [cartSummary, setCartSummary] = useState(null);
  const [appliedPromotions, setAppliedPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const updateStateFromCart = useCallback((cart, summary = null, promotions = []) => {
    setCartItems(cart);
    setCartSummary(summary);
    setAppliedPromotions(Array.isArray(promotions) ? promotions : []);
    setCartCount(
      cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0)
    );
  }, []);

  const fetchCart = useCallback(async () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const guestToken = getGuestToken();

    try {
      setLoading(true);
      setError(null);

      if (token && isAdminStorefrontUser()) {
        updateStateFromCart([]);
        setError(ADMIN_PURCHASE_BLOCK_MESSAGE);
        return;
      }

      const res = await fetch(
        `https://my-vite-app-backend.onrender.com/cart.php${token ? "" : `?guest_token=${guestToken}`}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const data = await res.json();
      if (data.success) {
        updateStateFromCart(data.cart, data.summary || null, data.applied_promotions || []);
      } else {
        setError(data.error || "Cart fetch failed");
      }
    } catch {
      setError("Network error fetching cart");
    } finally {
      setLoading(false);
    }
  }, [updateStateFromCart]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (productId, variantId, sku, snapshotPrice = null, effectivePrice = null, promoOffer = "") => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (token && isAdminStorefrontUser()) {
      setError(ADMIN_PURCHASE_BLOCK_MESSAGE);
      throw new Error(ADMIN_PURCHASE_BLOCK_MESSAGE);
    }

    let body = {
      action: "add",
      product_id: productId,
      variant_id: variantId,
      sku,
      quantity: 1,
    };

    if (Number.isFinite(Number(snapshotPrice)) && Number(snapshotPrice) > 0) {
      body.price = Number(snapshotPrice);
    }

    if (Number.isFinite(Number(effectivePrice)) && Number(effectivePrice) > 0) {
      body.discount_price = Number(effectivePrice);
    }

    if (promoOffer) {
      body.promo_offer = String(promoOffer).trim();
    }

    // If logged in → use token
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // If not logged in → attach guest token
    if (!token) {
      const guestToken = getGuestToken();
      body.guest_token = guestToken;
    }

    try {
      const res = await fetch("/ecommerce/cart.php", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        updateStateFromCart(data.cart, data.summary || null, data.applied_promotions || []);
        return data;
      }

      const message = data.error || "Add to cart failed";
      setError(message);
      throw new Error(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error adding to cart";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    }
  };



  const updateItemQty = async (productId, variantId, quantity) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (token && isAdminStorefrontUser()) {
      setError(ADMIN_PURCHASE_BLOCK_MESSAGE);
      updateStateFromCart([]);
      return;
    }

    let body = {
      action: quantity > 0 ? "update" : "remove",
      product_id: productId,
      variant_id: variantId,
      quantity,
    };

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    if (!token) {
      const guestToken = getGuestToken();
      body.guest_token = guestToken;
    }

    try {
      const res = await fetch("/ecommerce/cart.php", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        updateStateFromCart(data.cart, data.summary || null, data.applied_promotions || []);
      } else {
        setError(data.error || "Update/remove failed");
      }
    } catch {
      setError("Network error updating/removing cart");
    }
  };



  const clearCart = () => {
    setCartItems([]);
    setCartSummary(null);
    setAppliedPromotions([]);
    setCartCount(0);
  };

  return (
    <CartContext.Provider
      value={{
        cartCount,
        cartItems,
        cartSummary,
        appliedPromotions,
        loading,
        addToCart,
        updateItemQty,
        fetchCart,
        clearCart,
        error,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
