import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useCart } from "../contexts/useCart";
import { resolveImageUrl } from "../utils/imageUrl";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";
import { getStoredUser } from "../utils/adminApi";
import { getDeliveryEstimate } from "../utils/delivery";
import "../styles/ProductsDetail.css";

const parseJsonResponse = async (res, invalidJsonText) => {
  const text = await res.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(invalidJsonText || "Server returned an invalid JSON response");
  }
};

const inferVariantNameFromSku = (sku) => {
  const suffix = String(sku || "")
    .trim()
    .split(/[-_]/)
    .pop()
    ?.toUpperCase() || "";

  const colorMap = {
    BLK: "Black",
    BLU: "Blue",
    GRY: "Grey",
    GRN: "Green",
    RED: "Red",
    WHT: "White"
  };

  return colorMap[suffix] || "";
};


const getVariantLabel = (variant, index) => {
  const color = String(variant?.variants?.color || "").trim();
  const size = String(variant?.variants?.size || "").trim();
  const sku = String(variant?.sku || "").trim();
  const inferredName = inferVariantNameFromSku(sku);

  const detail = [color || inferredName, size].filter(Boolean).join(" / ");
  if (detail) {
    return detail;
  }

  if (sku) {
    return sku;
  }

  return `Variant ${index + 1}`;
};

const getVariantDiscountPercent = (variant) => {
  const price = Number(variant?.price || 0);
  const effectivePrice = Number(variant?.effective_price ?? price);

  if (price <= 0 || effectivePrice >= price) {
    return 0;
  }

  return Math.round(((price - effectivePrice) / price) * 100);
};

const formatPriceDisplay = (value) => {
  const amount = Number(value || 0);
  const roundedAmount = Number.isFinite(amount) ? Math.round(amount) : 0;
  return roundedAmount.toLocaleString("en-IN");
};

const parsePromoIdList = (value) => Array.from(
  new Set(
    String(value || "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => item > 0)
  )
);

const isVariantEligibleForCampaign = ({ offer, product, variant, category = "all", ids = [], variantIds = [], applyToAll = false }) => {
  if (!offer || !variant) {
    return false;
  }

  const currentProductId = Number(product?.id || product?.product_id || 0);
  const currentVariantId = Number(variant?.id || variant?.variant_id || 0);
  const normalizedCategory = String(category || "all").trim().toLowerCase();
  const currentCategory = String(product?.info?.category_name || product?.category_name || "").trim().toLowerCase();

  if (normalizedCategory && normalizedCategory !== "all" && currentCategory !== normalizedCategory) {
    return false;
  }

  if (ids.length > 0 && !ids.includes(currentProductId)) {
    return false;
  }

  if (variantIds.length > 0 && !variantIds.includes(currentVariantId)) {
    return false;
  }

  const hasExplicitSelections = ids.length > 0 || variantIds.length > 0;
  if (applyToAll || hasExplicitSelections) {
    return true;
  }

  const discountPercent = getVariantDiscountPercent(variant);
  switch (offer) {
    case "clearance-sale":
      return discountPercent >= 15;
    case "summer-sale":
    case "category-sale":
    case "promo-group":
      return discountPercent > 0;
    default:
      return true;
  }
};

const PDP_CAMPAIGN_PRESETS = {
  "clearance-sale": {
    priceLabel: "Clearance campaign",
    extraDiscountPercent: 0,
    taxLabel: ""
  },
  "summer-sale": {
    priceLabel: "Summer campaign",
    extraDiscountPercent: 0,
    taxLabel: ""
  },
  "category-sale": {
    priceLabel: "Category campaign",
    extraDiscountPercent: 0,
    taxLabel: ""
  },
  "promo-group": {
    priceLabel: "Selected promo",
    extraDiscountPercent: 0,
    taxLabel: ""
  },
  "flash-sale": {
    priceLabel: "Flash sale",
    extraDiscountPercent: 0,
    taxLabel: ""
  },
  "happy-hour": {
    priceLabel: "Happy hour",
    extraDiscountPercent: 0,
    taxLabel: ""
  },
  "threshold-offer": {
    priceLabel: "Spend & save",
    extraDiscountPercent: 0,
    taxLabel: ""
  }
};

export default function ProductDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const { addToCart } = useCart(); // use global cart logic
  const [showRatingBreakdown, setShowRatingBreakdown] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [wishlistActionLoading, setWishlistActionLoading] = useState(false);
  const [reviewCheckLoading, setReviewCheckLoading] = useState(true);
  const [reviewCheckError, setReviewCheckError] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const pdpCopy = siteContent.productDetailPage || {};
  const currentUserRole = String(getStoredUser()?.role || "").trim().toLowerCase();
  const isAdminUser = currentUserRole === "admin" || currentUserRole === "super_admin";
  const adminPurchaseBlockedMessage = pdpCopy.adminPurchaseBlockedText || "Admin accounts can manage the store but cannot add items to cart.";
  const adminWishlistBlockedMessage = pdpCopy.adminWishlistBlockedText || "Admin accounts cannot use wishlist on the storefront.";
  const invalidJsonText = pdpCopy.invalidJsonText || "Server returned an invalid JSON response";
  const preferredVariantId = Number(searchParams.get("variantId") || 0);
  const requestedOffer = String(searchParams.get("offer") || "").trim();

  const formatStockStatus = (value) => {
    const raw = String(value || "").trim();
    if (!raw) {
      return pdpCopy.unknownStockText || "Unknown";
    }

    if (raw === "in_stock") {
      return pdpCopy.inStockText || "In Stock";
    }
    if (raw === "out_of_stock") {
      return pdpCopy.outOfStockText || "Out of Stock";
    }

    return raw.replace(/_/g, " ");
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicSiteContent(controller.signal)
      .then((content) => setSiteContent(content))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/ecommerce/products_detail.php?id=${id}`
        );
        if (!res.ok) throw new Error("Failed to fetch product details");
        const data = await res.json();
        setProduct(data);

        if (data.variants && data.variants.length > 0) {
          const initialVariant =
            data.variants.find((variant) => Number(variant.id || variant.variant_id) === preferredVariantId) ||
            data.variants[0];
          setSelectedVariant(initialVariant);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProduct();
  }, [id, preferredVariantId]);

  useEffect(() => {
    let isMounted = true;

    const checkWishlistStatus = async () => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token || isAdminUser) {
        if (isMounted) {
          setIsWishlisted(false);
          setWishlistLoading(false);
        }
        return;
      }

      try {
        setWishlistLoading(true);
        const res = await fetch("/ecommerce/wishlist.php", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await parseJsonResponse(res, invalidJsonText);
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to fetch wishlist");
        }

        const exists = (data.wishlist || []).some(
          (item) => Number(item.product_id) === Number(id)
        );
        if (isMounted) {
          setIsWishlisted(exists);
        }
      } catch {
        if (isMounted) {
          setIsWishlisted(false);
        }
      } finally {
        if (isMounted) {
          setWishlistLoading(false);
        }
      }
    };

    checkWishlistStatus();

    return () => {
      isMounted = false;
    };
  }, [id, invalidJsonText, isAdminUser]);

  useEffect(() => {
    const checkReviewPermission = async () => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token || !selectedVariant || !product) {
        setCanReview(false);
        setReviewCheckLoading(false);
        return;
      }

      try {
        setReviewCheckLoading(true);
        setReviewCheckError(null);

        const url = new URL("/ecommerce/review.php");
        url.searchParams.append("product_id", product?.id || product?.product_id);

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await parseJsonResponse(res, invalidJsonText);
        if (!res.ok) {
          throw new Error(data.error || "Failed to check review permission");
        }

        setCanReview(Boolean(data.can_review));
      } catch (err) {
        setCanReview(false);
        setReviewCheckError(err.message);
      } finally {
        setReviewCheckLoading(false);
      }
    };

    checkReviewPermission();
  }, [invalidJsonText, product, selectedVariant]);

  const handleAddToCart = async () => {
    const productId = product?.id || product?.product_id;
    const variantId = selectedVariant?.id || selectedVariant?.variant_id;

    if (isAdminUser) {
      alert(adminPurchaseBlockedMessage);
      return;
    }

    if (!productId) {
      alert(pdpCopy.productIdMissingText || "Product ID missing");
      console.error("Product object:", product);
      return;
    }
    if (!variantId) {
      alert(pdpCopy.variantIdMissingText || "Variant ID missing");
      console.error("SelectedVariant object:", selectedVariant);
      return;
    }
    if (!selectedVariant?.availability) {
      alert(pdpCopy.outOfStockVariantText || "This variant is out of stock");
      return;
    }

    try {
      await addToCart(
        productId,
        variantId,
        selectedVariant.sku,
        basePrice,
        baseEffectivePrice,
        isCampaignVariantEligible ? activeOffer : ""
      );
      alert(pdpCopy.addedToCartText || "Product added to cart!");
    } catch (err) {
      console.error("AddToCart failed:", err);
      alert(`${pdpCopy.failedToAddProductPrefix || "Failed to add product:"} ${err.message}`);
    }
  };
  const handleSubmitReview = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        alert(pdpCopy.mustLoginReviewText || "You must be logged in to submit a review.");
        return;
      }

      const trimmedReviewText = reviewText.trim();

      const res = await fetch("/ecommerce/review.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: product?.id || product?.product_id,
          rating: Number(rating),
          review_text: trimmedReviewText
        })
      });

      const data = await parseJsonResponse(res, invalidJsonText);
      if (data.success) {
        alert(pdpCopy.reviewSubmittedText || "Review submitted successfully!");
        setReviewText("");
        setRating(5);
        // Optionally re-fetch product details to show new review
      } else {
        alert(data.error || pdpCopy.reviewFailedText || "Failed to submit review");
      }
    } catch (err) {
      console.error("Submit review failed:", err);
      alert(pdpCopy.reviewNetworkErrorText || "Network error while submitting review");
    }
  };

  const handleWishlistToggle = async () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (isAdminUser) {
      alert(adminWishlistBlockedMessage);
      return;
    }

    if (!token) {
      alert(pdpCopy.loginToWishlistText || "Please log in to use wishlist");
      return;
    }

    const productId = Number(product?.id || product?.product_id || id);
    if (!productId) {
      alert("Product ID missing");
      return;
    }

    try {
      setWishlistActionLoading(true);
      const res = await fetch("/ecommerce/wishlist.php", {
        method: isWishlisted ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ product_id: productId })
      });

      const data = await parseJsonResponse(res, invalidJsonText);
      if (!res.ok) {
        throw new Error(data.error || "Wishlist update failed");
      }

      if (!data.success && !isWishlisted) {
        // When item already exists, keep UI in synced state.
        if ((data.message || "").toLowerCase().includes("already")) {
          setIsWishlisted(true);
          return;
        }
        throw new Error(data.message || "Wishlist update failed");
      }

      setIsWishlisted((prev) => !prev);
    } catch (err) {
      alert(err.message || pdpCopy.wishlistUpdateFailedText || "Failed to update wishlist");
    } finally {
      setWishlistActionLoading(false);
    }
  };

  const activeOfferContext = useMemo(() => {
    const requestedContext = requestedOffer
      ? {
          offer: requestedOffer,
          category: "all",
          ids: [],
          variantIds: [],
          applyToAll: true
        }
      : null;

    const promoSource = siteContent.offers?.activePromoStrip || siteContent.offers?.promoStrip;
    const rawTarget = String(promoSource?.to || "").trim();
    if (!rawTarget) {
      return requestedContext;
    }

    const queryString = rawTarget.includes("?") ? rawTarget.split("?")[1] : "";
    const targetParams = new URLSearchParams(queryString);
    const targetOffer = String(targetParams.get("offer") || "").trim();
    if (!targetOffer || targetOffer === "all") {
      return requestedContext;
    }

    if (requestedOffer && requestedOffer !== targetOffer) {
      return requestedContext;
    }

    const category = String(targetParams.get("category") || "all").trim();
    const ids = parsePromoIdList(targetParams.get("ids") || targetParams.get("productId") || targetParams.get("promoProduct"));
    const variantIds = parsePromoIdList(targetParams.get("variantIds") || targetParams.get("variantId"));
    const normalizedCategory = category.toLowerCase();

    return {
      offer: requestedOffer || targetOffer,
      category,
      ids,
      variantIds,
      applyToAll: ids.length === 0 && variantIds.length === 0 && (!normalizedCategory || normalizedCategory === "all")
    };
  }, [requestedOffer, siteContent.offers?.activePromoStrip?.to, siteContent.offers?.promoStrip?.to]);
  const activeOffer = activeOfferContext?.offer || "";

  if (loading) return <p className="pdp-state">{pdpCopy.loadingText || "Loading product details..."}</p>;
  if (error) return <p className="pdp-state pdp-state-error">{pdpCopy.errorPrefix || "Error:"} {error}</p>;
  if (!product) return <p className="pdp-state">{pdpCopy.noProductText || "No product found."}</p>;

  const { info, variants } = product;
  const ratingDistribution = info?.rating_distribution || {};
  const totalReviews = Object.values(ratingDistribution).reduce((a, b) => a + b, 0);
  const activeCampaignPreset = PDP_CAMPAIGN_PRESETS[activeOffer] || null;
  const selectedVariantId = Number(selectedVariant?.id || selectedVariant?.variant_id || 0);
  const selectedVariantIndex = Math.max(0, variants.findIndex((variant) => Number(variant?.id || variant?.variant_id || 0) === selectedVariantId));
  const selectedVariantLabel = getVariantLabel(selectedVariant, selectedVariantIndex);
  const campaignExtraDiscount = Number(activeCampaignPreset?.extraDiscountPercent || 0);
  const basePrice = Number(selectedVariant?.price || 0);
  const baseEffectivePrice = Number(selectedVariant?.effective_price || 0);
  const isCampaignVariantEligible = isVariantEligibleForCampaign({
    offer: activeOffer,
    product,
    variant: selectedVariant,
    category: activeOfferContext?.category,
    ids: activeOfferContext?.ids || [],
    variantIds: activeOfferContext?.variantIds || [],
    applyToAll: Boolean(activeOfferContext?.applyToAll)
  });
  const campaignEffectivePrice = campaignExtraDiscount > 0 && isCampaignVariantEligible
    ? Number((baseEffectivePrice * (1 - (campaignExtraDiscount / 100))).toFixed(2))
    : baseEffectivePrice;
  const hasDiscount = campaignEffectivePrice < basePrice;
  const showCampaignPricing = isCampaignVariantEligible && campaignExtraDiscount > 0 && campaignEffectivePrice < baseEffectivePrice;
  const showCampaignMessage = isCampaignVariantEligible && Boolean(activeCampaignPreset);
  const productTitle = info?.name || product?.name || pdpCopy.defaultTitle || "Product Detail";
  const deliveryEstimate = getDeliveryEstimate();

  const handleVariantChange = (event) => {
    const nextVariantId = Number(event.target.value || 0);
    const nextVariant = variants.find((variant) => Number(variant?.id || variant?.variant_id || 0) === nextVariantId);

    if (!nextVariant) {
      return;
    }

    setSelectedVariant(nextVariant);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("variantId", String(nextVariantId));
    if (activeOffer) {
      nextParams.set("offer", activeOffer);
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="pdp">
      <section className="pdp-main">
        <div className="pdp-image-wrap">
          <img
            key={selectedVariantId || "default-variant"}
            className="pdp-image"
            src={resolveImageUrl(selectedVariant?.images?.[0], "https://via.placeholder.com/640")}
            alt={productTitle}
          />
        </div>

        <div className="pdp-details">
          <p className="pdp-eyebrow">{pdpCopy.eyebrow || "Product Detail"}</p>
          <h1>{productTitle}</h1>

          <div className="pdp-price-row">
            {hasDiscount ? (
              <>
                <span className="pdp-price-current">₹{formatPriceDisplay(campaignEffectivePrice)}</span>
                <span className="pdp-price-original">₹{formatPriceDisplay(basePrice)}</span>
              </>
            ) : (
              <span className="pdp-price-current">₹{formatPriceDisplay(baseEffectivePrice)}</span>
            )}
            {(selectedVariant?.tax_included || (showCampaignPricing && activeCampaignPreset?.taxLabel)) && (
              <span className="pdp-tax-pill">{(showCampaignPricing && activeCampaignPreset?.taxLabel) || pdpCopy.inclusiveTaxLabel || "Inclusive of tax"}</span>
            )}
          </div>

          {showCampaignMessage && activeCampaignPreset && (
            <p className="pdp-campaign-note">
              {showCampaignPricing
                ? `${activeCampaignPreset.priceLabel} · extra ${campaignExtraDiscount}% already applied`
                : `${activeCampaignPreset.priceLabel} active`}
            </p>
          )}

          {selectedVariant && (
            <div className="pdp-variant-summary">
              <p>
                {pdpCopy.chooseVariantLabel || "Choose variant"}: <strong>{selectedVariantLabel}</strong>
              </p>
              {selectedVariant?.sku && (
                <p>
                  SKU: <strong>{selectedVariant.sku}</strong>
                </p>
              )}
              {selectedVariant?.variants?.color && (
                <p>
                  {pdpCopy.colorLabel || "Color"}: <strong>{selectedVariant.variants.color}</strong>
                </p>
              )}
              {selectedVariant?.variants?.size && (
                <p>
                  {pdpCopy.sizeLabel || "Size"}: <strong>{selectedVariant.variants.size}</strong>
                </p>
              )}
            </div>
          )}

          <p className="stock">{formatStockStatus(selectedVariant?.stock_status)}</p>
          <p className="pdp-delivery-note">
            <strong>Estimated delivery:</strong> {deliveryEstimate.rangeLabel}
          </p>

          {variants.length > 1 && (
            <label className="pdp-field">
              <span>{pdpCopy.chooseVariantLabel || "Choose variant"}</span>
              <select
                value={selectedVariantId || ""}
                onChange={handleVariantChange}
              >
                {variants.map((v, index) => (
                  <option key={v.id} value={v.id} disabled={!v.availability}>
                    {getVariantLabel(v, index)} - {formatStockStatus(v.stock_status)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {isAdminUser && (
            <p className="pdp-campaign-note">{adminPurchaseBlockedMessage}</p>
          )}

          <div className="pdp-actions">
            <button
              className={`wishlist-btn ${isWishlisted ? "is-active" : ""}`}
              onClick={handleWishlistToggle}
              disabled={wishlistLoading || wishlistActionLoading || isAdminUser}
            >
              <span className="wishlist-icon" aria-hidden="true">{"\u2665"}</span>
              <span>
                {wishlistLoading || wishlistActionLoading
                  ? (pdpCopy.wishlistUpdatingLabel || "Updating...")
                  : isAdminUser
                    ? (pdpCopy.adminWishlistBlockedLabel || "Admin wishlist blocked")
                    : isWishlisted
                      ? (pdpCopy.removeFromWishlistLabel || "Remove from Wishlist")
                      : (pdpCopy.addToWishlistLabel || "Add to Wishlist")}
              </span>
            </button>

            <button
              className="add-cart-btn"
              disabled={!selectedVariant?.availability || isAdminUser}
              onClick={handleAddToCart}
            >
              {isAdminUser
                ? (pdpCopy.adminCartBlockedLabel || "Admin purchase blocked")
                : (pdpCopy.addToCartLabel || "Add to Cart")}
            </button>
          </div>
        </div>
      </section>

      <section className="pdp-content-grid">
        <section className="reviews">
          <h2>{pdpCopy.customerReviewsTitle || "Customer Reviews"}</h2>
          <p
            className="rating"
            onClick={() => setShowRatingBreakdown(!showRatingBreakdown)}
          >
            {pdpCopy.ratingPrefix || "Rating:"} {selectedVariant?.rating_avg} ({selectedVariant?.rating_count} reviews)
          </p>

          {showRatingBreakdown && (
            <div className="rating-breakdown">
              <h3>{pdpCopy.ratingBreakdownTitle || "Rating Breakdown"}</h3>
              {Object.entries(ratingDistribution).map(([stars, count]) => {
                const percentage = totalReviews
                  ? ((count / totalReviews) * 100).toFixed(1)
                  : 0;
                return (
                  <div key={stars} className="rating-breakdown-row">
                    <span className="rating-breakdown-star">{stars} ★</span>
                    <div className="rating-breakdown-track">
                      <div className="rating-breakdown-fill" style={{ width: `${percentage}%` }}></div>
                    </div>
                    <span>{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          <section className="customer-reviews">
            <h3>{pdpCopy.recentReviewsTitle || "Recent Reviews"}</h3>
            {product.reviews && product.reviews.length > 0 ? (
              product.reviews.map((review) => (
                <div key={`${review.user_id}-${review.created_at}`} className="review-item">
                  <strong>{review.user_name || "Anonymous"}</strong>
                  <span className="review-rating">⭐ {review.rating}</span>
                  <p>{review.review_text}</p>
                  <small>{new Date(review.created_at).toLocaleDateString()}</small>
                </div>
              ))
            ) : (
              <p>{pdpCopy.noReviewsText || "No reviews yet for this product."}</p>
            )}
          </section>

          {/* Write Review Form */}
          {reviewCheckLoading ? (
            <p>{pdpCopy.checkingReviewEligibilityText || "Checking review eligibility..."}</p>
          ) : !localStorage.getItem("token") && !sessionStorage.getItem("token") ? (
            <p>{pdpCopy.loginToReviewText || "Please log in to write a review."}</p>
          ) : !canReview ? (
            <p>{pdpCopy.mustPurchaseToReviewText || "You can review this product only after purchasing it."}</p>
          ) : (
            <div className="write-review">
              <h3>{pdpCopy.writeReviewTitle || "Write a Review"}</h3>
              {reviewCheckError && <p className="review-error">{reviewCheckError}</p>}
              <form onSubmit={handleSubmitReview}>
                <label>
                  {pdpCopy.ratingLabel || "Rating:"}
                  <select value={rating} onChange={(e) => setRating(e.target.value)}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <option key={star} value={star}>{star} ★</option>
                    ))}
                  </select>
                </label>
                <textarea
                  placeholder={pdpCopy.reviewPlaceholder || "Share your experience..."}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  required
                />
                <button type="submit">{pdpCopy.submitReviewLabel || "Submit Review"}</button>
              </form>
            </div>
          )}
        </section>

        <section className="pdp-info-panels">
          {selectedVariant?.specifications && (
            <section className="pdp-panel">
              <h2>{pdpCopy.specificationsTitle || "Specifications"}</h2>
              {Object.entries(selectedVariant.specifications).map(([key, val]) => (
                <p key={key}>
                  <strong>{key}:</strong> {val}
                </p>
              ))}
            </section>
          )}

          {(selectedVariant?.shipping_info || selectedVariant?.return_policy) && (
            <section className="pdp-panel">
              <h2>{pdpCopy.shippingReturnsTitle || "Shipping & Returns"}</h2>
              {selectedVariant?.shipping_info && (
                <p>
                  <strong>{pdpCopy.shippingLabel || "Shipping:"}</strong> {selectedVariant.shipping_info}
                </p>
              )}
              {selectedVariant?.return_policy && (
                <p>
                  <strong>{pdpCopy.returnPolicyLabel || "Return Policy:"}</strong> {selectedVariant.return_policy}
                </p>
              )}
            </section>
          )}

          {info?.warranty && info.warranty.toLowerCase() !== "null" && (
            <section className="pdp-panel">
              <h2>{pdpCopy.warrantyTitle || "Warranty"}</h2>
              <p>{info.warranty}</p>
            </section>
          )}

          {info?.about_item && (
            <section className="pdp-panel">
              <h2>{pdpCopy.aboutItemTitle || "About this item"}</h2>
              <ul>
                {info.about_item.split("|").map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </section>
          )}
        </section>
      </section>
    </div>
  );
}
