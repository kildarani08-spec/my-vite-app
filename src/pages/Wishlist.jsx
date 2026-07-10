import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../contexts/useCart";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";
import { getStoredUser } from "../utils/adminApi";

function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingProductId, setAddingProductId] = useState(null);
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  const currentUserRole = String(getStoredUser()?.role || "").trim().toLowerCase();
  const isAdminUser = currentUserRole === "admin" || currentUserRole === "super_admin";

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicSiteContent(controller.signal)
      .then((content) => setSiteContent(content))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const wishlistCopy = siteContent.wishlistPage || {};

  useEffect(() => {
    if (!token || isAdminUser) {
      setLoading(false);
      return;
    }

    fetch("https://my-vite-app-backend.onrender.com/wishlist.php", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setItems(data.wishlist);
        else setError(data.error || wishlistCopy.loadFailedText || "Failed to load wishlist.");
      })
      .catch(() => setError(wishlistCopy.networkErrorText || "Could not reach server."))
      .finally(() => setLoading(false));
  }, [isAdminUser, token, wishlistCopy.loadFailedText, wishlistCopy.networkErrorText]);

  if (!token) return <div style={{ padding: 24, color: "red" }}>{wishlistCopy.loginRequiredText || "Please log in to view your wishlist."}</div>;

  if (isAdminUser) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <h2>{wishlistCopy.title || "Wishlist"}</h2>
        <p style={{ color: "#b91c1c" }}>
          {wishlistCopy.adminBlockedText || "Admin accounts cannot use wishlist on the storefront. Please use a customer account."}
        </p>
        <button
          onClick={() => navigate("/admin/dashboard")}
          style={{
            marginTop: 12,
            padding: "10px 24px",
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {wishlistCopy.adminBlockedActionLabel || "Go to Admin Dashboard"}
        </button>
      </div>
    );
  }

  function removeItem(productId) {
    fetch("https://my-vite-app-backend.onrender.com/wishlist.php", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ product_id: productId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setItems((prev) => prev.filter((i) => i.product_id !== productId));
        }
      });
  }

  async function handleAddToCart(item) {
    const canAdd =
      item.availability === "in_stock" && item.variant_id && item.variant_sku;
    if (!canAdd) {
      return;
    }

    try {
      setAddingProductId(item.product_id);
      await addToCart(item.product_id, item.variant_id, item.variant_sku);
      alert(wishlistCopy.addedToCartText || "Added to cart");
    } catch {
      alert(wishlistCopy.addToCartFailedText || "Failed to add to cart");
    } finally {
      setAddingProductId(null);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>{wishlistCopy.loadingText || "Loading wishlist..."}</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>{error}</div>;

  if (items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <h2>{wishlistCopy.title || "Wishlist"}</h2>
        <p style={{ color: "#6b7280" }}>{wishlistCopy.emptyText || "No saved items yet."}</p>
        <button
          onClick={() => navigate("/")}
          style={{
            marginTop: 12,
            padding: "10px 24px",
            background: "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {wishlistCopy.continueShoppingLabel || "Continue Shopping"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 20 }}>{wishlistCopy.title || "Wishlist"} ({items.length})</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 20,
        }}
      >
        {items.map((item) => {
          const price = Number(
            item.discount_price && Number(item.discount_price) < Number(item.variant_price || item.base_price)
              ? item.discount_price
              : item.variant_price || item.base_price
          );
          const hasDiscount =
            item.discount_price && Number(item.discount_price) < Number(item.variant_price || item.base_price);
          const canAddToCart =
            item.availability === "in_stock" && item.variant_id && item.variant_sku;

          return (
            <div
              key={item.wishlist_id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
                position: "relative",
              }}
            >
              <img
                src={
                  item.image
                    ? `https://my-vite-app-backend.onrender.com/${item.image}`
                    : "/placeholder.png"
                }
                alt={item.name}
                onClick={() => navigate(`/product/${item.product_id}`)}
                style={{
                  width: "100%",
                  height: 180,
                  objectFit: "cover",
                  cursor: "pointer",
                  display: "block",
                }}
              />
              <div style={{ padding: "12px" }}>
                <div
                  onClick={() => navigate(`/product/${item.product_id}`)}
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    minHeight: 40,
                  }}
                >
                  {item.name}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontWeight: 700, color: "#e53935" }}>
                    ₹{price.toFixed(2)}
                  </span>
                  {hasDiscount && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: "#9ca3af",
                        textDecoration: "line-through",
                      }}
                    >
                      ₹{Number(item.base_price).toFixed(2)}
                    </span>
                  )}
                </div>
                {item.availability && (
                  <div
                    style={{
                      fontSize: 12,
                      color:
                        item.availability === "in_stock" ? "#22c55e" : "#ef4444",
                      marginTop: 4,
                    }}
                  >
                    {item.availability === "in_stock" ? (wishlistCopy.inStockLabel || "In Stock") : (wishlistCopy.outOfStockLabel || "Out of Stock")}
                  </div>
                )}
                <button
                  onClick={() => handleAddToCart(item)}
                  disabled={!canAddToCart || addingProductId === item.product_id}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "9px",
                    background: !canAddToCart ? "#d1d5db" : "#1d4ed8",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: !canAddToCart ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {addingProductId === item.product_id ? (wishlistCopy.addingLabel || "Adding...") : (wishlistCopy.addToCartLabel || "Add to Cart")}
                </button>
                <button
                  onClick={() => removeItem(item.product_id)}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "7px",
                    background: "#fee2e2",
                    color: "#ef4444",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {wishlistCopy.removeLabel || "Remove"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Wishlist;
