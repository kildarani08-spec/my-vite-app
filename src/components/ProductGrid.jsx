import React from "react";
import { Link } from "react-router-dom";
import "./../styles/ProductGrid.css";
import { resolveImageUrl } from "../utils/imageUrl";
import { getDeliveryEstimate } from "../utils/delivery";

// Helper function defined outside the component
function daysLeft(endDate) {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end - now;
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `${days} day${days > 1 ? "s" : ""} left`;
}

function formatInr(value) {
  const amount = Number(value || 0);
  const roundedAmount = Number.isFinite(amount) ? Math.round(amount) : 0;
  return roundedAmount.toLocaleString("en-IN");
}

function getVariantEffectivePrice(variant) {
  return Number(variant?.effective_price ?? variant?.price ?? Number.POSITIVE_INFINITY);
}

function getVariantBasePrice(variant) {
  return Number(variant?.price ?? 0);
}

function variantHasBaseDiscount(variant) {
  const price = getVariantBasePrice(variant);
  const effectivePrice = getVariantEffectivePrice(variant);

  return price > 0 && Number.isFinite(effectivePrice) && effectivePrice < price;
}

function getCampaignEligibleVariants(product, campaignContext) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!campaignContext || variants.length === 0) {
    return variants;
  }

  const variantIds = Array.isArray(campaignContext.variantIds) ? campaignContext.variantIds.map(Number) : [];
  if (variantIds.length > 0) {
    const targetedVariants = variants.filter((variant) => {
      const variantId = Number(variant?.id || variant?.variant_id || 0);
      return variantIds.includes(variantId);
    });

    if (targetedVariants.length > 0) {
      return targetedVariants;
    }
  }

  const productIds = Array.isArray(campaignContext.productIds) ? campaignContext.productIds.map(Number) : [];
  const hasExplicitSelections = productIds.length > 0 || variantIds.length > 0;
  const categoryFilter = String(campaignContext.category || "").trim().toLowerCase();
  const shouldUseDiscountedStylesOnly =
    !hasExplicitSelections &&
    !campaignContext.applyToAll &&
    categoryFilter &&
    categoryFilter !== "all" &&
    hasCampaignPriceAdjustment(campaignContext);

  if (shouldUseDiscountedStylesOnly) {
    const discountedVariants = variants.filter(variantHasBaseDiscount);
    if (discountedVariants.length > 0) {
      return discountedVariants;
    }
  }

  return variants;
}

function hasCampaignPriceAdjustment(campaignContext) {
  return Number(campaignContext?.extraDiscountPercent || 0) > 0 || Number(campaignContext?.fixedDiscountAmount || 0) > 0;
}

function getCampaignEffectivePrice(variant, campaignContext) {
  const baseEffectivePrice = getVariantEffectivePrice(variant);

  if (!campaignContext || !Number.isFinite(baseEffectivePrice)) {
    return baseEffectivePrice;
  }

  const extraDiscountPercent = Number(campaignContext.extraDiscountPercent || 0);
  const fixedDiscountAmount = Number(campaignContext.fixedDiscountAmount || 0);
  let candidatePrice = baseEffectivePrice;

  if (extraDiscountPercent > 0) {
    candidatePrice = Number((baseEffectivePrice * (1 - (extraDiscountPercent / 100))).toFixed(2));
  } else if (fixedDiscountAmount > 0) {
    candidatePrice = Number(Math.max(0, baseEffectivePrice - fixedDiscountAmount).toFixed(2));
  }

  return candidatePrice;
}

function shouldApplyCampaignPricing(product, campaignContext, variant) {
  if (!campaignContext) {
    return false;
  }

  if (!hasCampaignPriceAdjustment(campaignContext)) {
    return true;
  }

  const productIds = Array.isArray(campaignContext.productIds) ? campaignContext.productIds.map(Number) : [];
  const variantIds = Array.isArray(campaignContext.variantIds) ? campaignContext.variantIds.map(Number) : [];
  const hasExplicitSelections = productIds.length > 0 || variantIds.length > 0;

  if (campaignContext.applyToAll || hasExplicitSelections) {
    return true;
  }

  const categoryFilter = String(campaignContext.category || "").trim().toLowerCase();
  if (!categoryFilter || categoryFilter === "all") {
    return true;
  }

  return variantHasBaseDiscount(variant);
}

function productMatchesCampaignContext(product, campaignContext) {
  if (!campaignContext) {
    return false;
  }

  if (campaignContext.applyToAll) {
    return true;
  }

  const categoryFilter = String(campaignContext.category || "").trim().toLowerCase();
  if (categoryFilter && categoryFilter !== "all") {
    const productCategory = String(product?.category_name || "").trim().toLowerCase();
    if (productCategory !== categoryFilter) {
      return false;
    }
  }

  const productIds = Array.isArray(campaignContext.productIds) ? campaignContext.productIds.map(Number) : [];
  const variantIds = Array.isArray(campaignContext.variantIds) ? campaignContext.variantIds.map(Number) : [];

  if (productIds.length === 0 && variantIds.length === 0) {
    return Boolean(categoryFilter && categoryFilter !== "all");
  }

  const currentProductId = Number(product?.product_id || product?.id || 0);
  if (productIds.length > 0 && !productIds.includes(currentProductId)) {
    return false;
  }

  if (variantIds.length > 0) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const matchesVariant = variants.some((variant) => {
      const variantId = Number(variant?.id || variant?.variant_id || 0);
      return variantIds.includes(variantId);
    });

    if (!matchesVariant) {
      return false;
    }
  }

  return true;
}

function ProductGrid({ products = [], copy = {}, campaignContext = null }) {
  const gridCopy = copy || {};

  if (!Array.isArray(products) || products.length === 0) {
    return <p className="product-grid-empty">{gridCopy.emptyText || "No products available"}</p>;
  }

  return (
    <div className="product-grid">
      {products.map((p) => {
        const matchedCampaignContext = productMatchesCampaignContext(p, campaignContext) ? campaignContext : null;
        const campaignOffer = String(matchedCampaignContext?.offerParam || "").trim();
        const campaignVariants = getCampaignEligibleVariants(p, matchedCampaignContext);
        const variants = campaignVariants.length > 0 ? campaignVariants : (Array.isArray(p.variants) ? p.variants : []);
        const variant = variants.reduce((lowestVariant, currentVariant) => {
          if (!lowestVariant) {
            return currentVariant;
          }

          const lowestPrice = getVariantEffectivePrice(lowestVariant);
          const currentPrice = getVariantEffectivePrice(currentVariant);

          return currentPrice < lowestPrice ? currentVariant : lowestVariant;
        }, null);

        const productCampaignContext = shouldApplyCampaignPricing(p, matchedCampaignContext, variant) ? matchedCampaignContext : null;
        const extraDiscountPercent = Number(productCampaignContext?.extraDiscountPercent || 0);
        const fixedDiscountAmount = Number(productCampaignContext?.fixedDiscountAmount || 0);

        if (!variant) return null;

        const basePrice = Number(variant.price || 0);
        const baseEffectivePrice = Number(variant.effective_price ?? variant.price ?? 0);
        const campaignEffectivePrice = getCampaignEffectivePrice(variant, productCampaignContext);
        const hasBaseDiscount = baseEffectivePrice < basePrice;
        const hasCampaignDiscount = campaignEffectivePrice < baseEffectivePrice;
        const showCampaignMessage = Boolean(productCampaignContext?.badge);
        const isFreeShippingCampaign = campaignOffer === "free-shipping";
        const cartThreshold = Number(productCampaignContext?.cartThreshold || 0);
        const cartThresholdLabel = cartThreshold > 0 ? `₹${formatInr(cartThreshold)}` : "the required amount";
        const hasDiscount = hasBaseDiscount || hasCampaignDiscount;
        const discountPercent = hasDiscount && basePrice > 0
          ? Math.round(((basePrice - campaignEffectivePrice) / basePrice) * 100)
          : 0;
        const productLink = variant?.id
          ? `/product/${p.product_id}?variantId=${variant.id}${campaignOffer ? `&offer=${encodeURIComponent(campaignOffer)}` : ""}`
          : `/product/${p.product_id}${campaignOffer ? `?offer=${encodeURIComponent(campaignOffer)}` : ""}`;
        const deliveryEstimate = getDeliveryEstimate();

        return (
          <article className="product-card" key={p.product_id}>
            <div className="product-card-media">
              <Link to={productLink} className="product-link" aria-label={`View ${p.name}`}>
                <img src={resolveImageUrl(p.image)} alt={p.name} className="product-image" />
              </Link>
              {hasDiscount && <span className="product-chip product-chip-offer">{discountPercent}% OFF</span>}
              {p.category_name && <span className="product-chip product-chip-category">{p.category_name}</span>}
            </div>

            <div className="product-card-body">
              <h3 className="product-name">
                <Link to={productLink} className="product-link">
                  {p.name}
                </Link>
              </h3>

              <p className="product-description">{p.description?.slice(0, 90) || gridCopy.noDescriptionText || "No description available."}</p>
              <p className="product-delivery-note">{deliveryEstimate.byLabel}</p>

              <div className="product-pricing">
                {hasDiscount ? (
                  <>
                    <span className="discount-price">₹{formatInr(campaignEffectivePrice)}</span>
                    <span className="original-price">₹{formatInr(basePrice)}</span>
                    {showCampaignMessage && (
                      <span className={`product-campaign-note ${isFreeShippingCampaign ? "product-campaign-note-threshold" : ""}`}>
                        {isFreeShippingCampaign
                          ? `Free delivery on orders above ${cartThresholdLabel}.`
                          : hasCampaignDiscount
                            ? `${productCampaignContext?.priceLabel || "Campaign price"} · ${extraDiscountPercent > 0
                                ? `${extraDiscountPercent}% promo applied`
                                : fixedDiscountAmount > 0
                                  ? `₹${formatInr(fixedDiscountAmount)} off applied`
                                  : "Promo applied"}`
                            : `${productCampaignContext?.priceLabel || "Campaign"} active · current catalog price already best`}
                      </span>
                    )}
                    {variant.discount_end && (
                      <span className="offer-validity">{gridCopy.endsInPrefix || "Ends in"} {daysLeft(variant.discount_end)}</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="product-price">₹{formatInr(basePrice)}</span>
                    {showCampaignMessage && (
                      <span className={`product-campaign-note ${isFreeShippingCampaign ? "product-campaign-note-threshold" : ""}`}>
                        {isFreeShippingCampaign
                          ? `Free delivery on orders above ${cartThresholdLabel}.`
                          : `${productCampaignContext?.priceLabel || "Campaign"} active for this item.`}
                      </span>
                    )}
                  </>
                )}
                {productCampaignContext?.taxLabel && <span className="product-tax-note">{productCampaignContext.taxLabel}</span>}
              </div>

              <div className="product-card-footer">
                {variant.rating_avg ? (
                  <p className="product-rating" aria-label={`Rated ${variant.rating_avg} out of 5`}>
                    <span aria-hidden="true">★</span> {variant.rating_avg} ({variant.rating_count || 0})
                  </p>
                ) : (
                  <span />
                )}
                <Link to={productLink} className="product-view-btn">
                  {gridCopy.viewLabel || "View"}
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default ProductGrid;




