import React, { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../utils/adminApi";
import { getDefaultSiteContent, normalizeSiteContent } from "../../utils/siteContent";

const createId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const dedupeIds = (values = []) =>
  Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));

const normalizeChoiceId = (value) => String(value || "").trim();
const toPromoLabel = (value) => String(value || "promo-group")
  .trim()
  .split(/[-_]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ") || "Promo Group";

const buildPromoGuideFallback = (campaignType) => {
  const label = toPromoLabel(campaignType);
  return {
    summary: `Use ${label} as a reusable DB-backed admin promo template.`,
    example: `Example: ${label} campaign for selected products, categories, or cart rules.`,
    multiOfferTip: "Keep the rule in the database template so admins can change it without code edits."
  };
};

const getTargetSearchParams = (value) => {
  const target = String(value || "").trim();
  const queryIndex = target.indexOf("?");

  if (queryIndex === -1) {
    return new URLSearchParams();
  }

  const queryString = target.slice(queryIndex + 1).split("#")[0];
  return new URLSearchParams(queryString);
};

const extractProductIdsFromTarget = (value) => {
  const target = String(value || "").trim();
  const directMatch = target.match(/^\/product\/(\d+)(?:$|[?#])/);
  if (directMatch) {
    return [directMatch[1]];
  }

  const params = getTargetSearchParams(target);
  const idsValue = params.get("ids");
  if (idsValue) {
    return dedupeIds(idsValue.split(","));
  }

  const directId = params.get("productId") || params.get("promoProduct");
  return directId ? [directId] : [];
};

const extractVariantIdsFromTarget = (value) => {
  const params = getTargetSearchParams(value);
  const idsValue = params.get("variantIds");
  if (idsValue) {
    return dedupeIds(idsValue.split(","));
  }

  const directId = params.get("variantId");
  return directId ? [directId] : [];
};
// Legacy emergency fallback metadata only. Live admin promo templates should come from the DB.
const PROMO_CAMPAIGN_OPTIONS = [
  {
    value: "sale",
    label: "On Sale",
    hint: "Always-on or seasonal catalog markdowns",
    defaultDiscount: "10% off eligible items",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Store shipping rules",
    threshold: 999,
    shippingFee: 80,
    progressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: "Free shipping applied."
  },
  {
    value: "clearance-sale",
    label: "Clearance Sale",
    hint: "Extra discount on already marked-down clearance picks",
    defaultDiscount: "Extra 10% off clearance items",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Store shipping rules",
    threshold: 499,
    shippingFee: 49,
    progressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: "Free shipping applied."
  },
  {
    value: "summer-sale",
    label: "Summer Sale",
    hint: "Seasonal apparel and warm-weather picks",
    defaultDiscount: "6% off eligible styles",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Store shipping rules",
    threshold: 699,
    shippingFee: 59,
    progressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: "Free shipping applied."
  },
  {
    value: "category-sale",
    label: "Category Sale",
    hint: "Discounted items in one category",
    defaultDiscount: "4% off one category",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Store shipping rules",
    threshold: 799,
    shippingFee: 69,
    progressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: "Free shipping applied."
  },
  {
    value: "promo-group",
    label: "Selected Products",
    hint: "Hand-pick exact products or variants",
    defaultDiscount: "7% off selected products or variants",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Store shipping rules",
    threshold: 599,
    shippingFee: 49,
    progressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: "Free shipping applied."
  },
  {
    value: "buy-x-get-y",
    label: "Buy X Get Y",
    hint: "Bundle deals like buy 2 T-shirts, get 1 free",
    defaultDiscount: "Cheapest eligible item becomes free",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Store shipping rules",
    threshold: 699,
    shippingFee: 59,
    progressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: "Free shipping applied."
  },
  {
    value: "flash-sale",
    label: "Flash Sale",
    hint: "Short-window deals with start/end timing",
    defaultDiscount: "15% off during the scheduled window",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Store shipping rules",
    threshold: 699,
    shippingFee: 59,
    progressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: "Free shipping applied."
  },
  {
    value: "happy-hour",
    label: "Happy Hour",
    hint: "Quick promo windows for lunch or evening peaks",
    defaultDiscount: "10% off during the happy-hour window",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Store shipping rules",
    threshold: 699,
    shippingFee: 59,
    progressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: "Free shipping applied."
  },
  {
    value: "threshold-offer",
    label: "Spend & Save",
    hint: "Threshold-based offers like spend ₹2000, get ₹200 off",
    defaultDiscount: "₹200 off above ₹2000 cart total",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Store shipping rules",
    threshold: 2000,
    shippingFee: 80,
    progressTemplate: "Add Rs.{remaining} more to reach Rs.{threshold} and unlock this offer.",
    unlockedText: "Threshold offer applied."
  },
  {
    value: "free-shipping",
    label: "Free Shipping",
    hint: "Focus on delivery-threshold campaigns",
    defaultDiscount: "No price cut, delivery perk only",
    taxMode: "Standard checkout tax rules",
    shippingMode: "Free shipping threshold active",
    threshold: 799,
    shippingFee: 80,
    progressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: "Free shipping applied."
  }
];

const PROMO_TEMPLATE_GUIDES = {
  sale: {
    summary: "Use for wide catalog markdowns or festival sale periods.",
    example: "Example: Weekend sale on all discounted products.",
    multiOfferTip: "Best kept non-stackable so the highest-priority discount wins cleanly."
  },
  "clearance-sale": {
    summary: "Good for end-of-season clearance or fast stock cleanup.",
    example: "Example: Books clearance sale this week only.",
    multiOfferTip: "Use a higher priority than regular sales when you want clearance to win first."
  },
  "summer-sale": {
    summary: "Useful for seasonal campaigns with banner + pricing sync.",
    example: "Example: Summer collection extra 6% off.",
    multiOfferTip: "Can run with a banner while other silent promos remain active."
  },
  "category-sale": {
    summary: "Target one category without changing the whole store banner system.",
    example: "Example: Extra off only on Books or T-shirts.",
    multiOfferTip: "Ideal when multiple categories each need separate promotions."
  },
  "promo-group": {
    summary: "Hand-pick products or variants for brand deals and featured collections.",
    example: "Example: New arrivals promo on selected SKUs.",
    multiOfferTip: "Useful for running multiple product-specific deals together."
  },
  "buy-x-get-y": {
    summary: "Set bundle rules like buy 2 get 1 free, common in real ecommerce campaigns.",
    example: "Example: Buy 2 T-shirts, get 1 T-shirt free.",
    multiOfferTip: "Best when paired with product or category targeting so the bundle applies only where expected."
  },
  "flash-sale": {
    summary: "Use this for limited-time flash windows that start and end automatically.",
    example: "Example: Flash sale from 6 PM to 10 PM tonight.",
    multiOfferTip: "Set the start and end time carefully so the urgency feels real and trustworthy."
  },
  "happy-hour": {
    summary: "Great for lunch-hour or evening bursts when you want a short promo spike.",
    example: "Example: Happy hour extra 10% off from 1 PM to 3 PM.",
    multiOfferTip: "Keep it short and combine it with a strong banner for higher conversion."
  },
  "threshold-offer": {
    summary: "Perfect for basket-building offers like spend more, save more.",
    example: "Example: Spend ₹2000, get ₹200 off instantly.",
    multiOfferTip: "Use the minimum cart total field so the discount only appears once the spend target is reached."
  },
  "free-shipping": {
    summary: "Use this when you want delivery incentive without reducing item price.",
    example: "Example: Free shipping above Rs.999 for a weekend campaign.",
    multiOfferTip: "Works well as stackable because it can sit alongside item discounts."
  }
};

const DISPLAY_MODE_OPTIONS = [
  { value: "both", label: "Banner + pricing", hint: "Show on storefront and apply in cart/checkout" },
  { value: "silent", label: "Pricing only", hint: "Apply discount silently without replacing the banner" },
  { value: "banner", label: "Banner only", hint: "Promote the campaign visually without changing pricing" },
];

const buildPromoTemplateDiscountLabel = (template = {}) => {
  if (template?.defaultDiscount) {
    return String(template.defaultDiscount).trim();
  }

  const actions = template?.actions && typeof template.actions === "object" ? template.actions : {};
  const discountType = String(actions.discountType || "").trim().toLowerCase();
  const triggerType = String(actions.triggerType || "").trim().toLowerCase();
  const discountValue = Number(actions.discountValue || 0);
  const threshold = Number(template?.threshold ?? template?.conditions?.minCartSubtotal ?? template?.conditions?.minCartTotal ?? 0);

  if (triggerType === "cart_threshold" && discountType === "fixed" && discountValue > 0) {
    return threshold > 0 ? `Spend ₹${threshold} get ₹${discountValue} off` : `₹${discountValue} off above cart threshold`;
  }

  if (triggerType === "cart_threshold" && discountType === "percent" && discountValue > 0) {
    return threshold > 0 ? `Spend ₹${threshold} get ${discountValue}% off` : `${discountValue}% off above cart threshold`;
  }

  if (triggerType === "flash_sale" && discountValue > 0) {
    return `${discountValue}% off during the flash-sale window`;
  }

  if (triggerType === "happy_hour" && discountValue > 0) {
    return `${discountValue}% off during happy hour`;
  }

  if (discountType === "percent" && discountValue > 0) {
    return `${discountValue}% off eligible items`;
  }

  if (discountType === "fixed" && discountValue > 0) {
    return `₹${discountValue} off eligible items`;
  }

  if (discountType === "buy_x_get_y") {
    const buyQuantity = Math.max(1, Number(actions.buyQuantity || 2));
    const freeQuantity = Math.max(1, Number(actions.freeQuantity || 1));
    return `Buy ${buyQuantity}, get ${freeQuantity} free`;
  }

  if (discountType === "bundle_fixed_total" && discountValue > 0) {
    const buyQuantity = Math.max(1, Number(actions.buyQuantity || 2));
    return `Buy ${buyQuantity} for ₹${discountValue}`;
  }

  if (actions.freeShipping) {
    return "No price cut, delivery perk only";
  }

  return "Uses existing catalog price";
};

const normalizePromoTemplateOption = (template = {}) => {
  const value = String(template.value || template.offerType || template.offer_type || "").trim();
  if (!value) {
    return null;
  }

  const guide = buildPromoGuideFallback(value);

  return {
    value,
    label: String(template.label || template.name || value).trim() || value,
    hint: String(template.hint || "").trim(),
    defaultDiscount: buildPromoTemplateDiscountLabel(template),
    taxMode: String(template.taxMode || "Standard checkout tax rules").trim() || "Standard checkout tax rules",
    shippingMode: String(template.shippingMode || "Store shipping rules").trim() || "Store shipping rules",
    threshold: Number(template.threshold ?? 999),
    shippingFee: Number(template.shippingFee ?? 80),
    progressTemplate: String(template.progressTemplate || "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.").trim(),
    unlockedText: String(template.unlockedText || "Free shipping applied.").trim(),
    summary: String(template.summary || guide.summary || "").trim(),
    example: String(template.example || guide.example || "").trim(),
    multiOfferTip: String(template.multiOfferTip || guide.multiOfferTip || "").trim(),
    actions: template.actions && typeof template.actions === "object" ? template.actions : {},
    enabled: template.enabled !== false,
  };
};

const getPromoCampaignDefaults = (campaignType, offers = {}) => {
  const matchedCampaign = PROMO_CAMPAIGN_OPTIONS.find((option) => option.value === campaignType);

  return {
    threshold: Number(matchedCampaign?.threshold ?? offers?.freeShippingThreshold ?? 999),
    shippingFee: Number(matchedCampaign?.shippingFee ?? offers?.standardShippingFee ?? 80),
    progressTemplate:
      matchedCampaign?.progressTemplate ||
      offers?.freeShippingProgressTemplate ||
      "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    unlockedText: matchedCampaign?.unlockedText || offers?.freeShippingUnlockedText || "Free shipping applied."
  };
};

const extractOfferFromTarget = (value) => {
  const params = getTargetSearchParams(value);
  return String(params.get("offer") || "").trim();
};

const extractCategoryFromTarget = (value) => {
  const params = getTargetSearchParams(value);
  return String(params.get("category") || "").trim();
};

const extractMinPriceFromTarget = (value) => {
  const params = getTargetSearchParams(value);
  const minPrice = Number(params.get("cartMin") || params.get("minPrice") || 0);
  return Number.isFinite(minPrice) ? minPrice : 0;
};
const buildPromoTargetUrl = ({ campaignType = "promo-group", category = "", minPrice = 0, productIds = [], variantIds = [] }) => {
  const normalizedCampaignType = String(campaignType || "promo-group").trim();
  const normalizedCategory = String(category || "").trim();
  const numericMinPrice = Number(minPrice || 0);
  const normalizedProductIds = normalizedCampaignType === "free-shipping" ? [] : dedupeIds(productIds);
  const normalizedVariantIds = normalizedCampaignType === "free-shipping" ? [] : dedupeIds(variantIds);
  const params = new URLSearchParams();

  if (normalizedCampaignType) {
    params.set("offer", normalizedCampaignType);
  }

  if (normalizedCategory && normalizedCampaignType !== "free-shipping") {
    params.set("category", normalizedCategory);
  }

  if (["free-shipping", "threshold-offer"].includes(normalizedCampaignType) && numericMinPrice > 0) {
    params.set("cartMin", String(numericMinPrice));
  }

  if (normalizedProductIds.length > 0) {
    params.set("ids", normalizedProductIds.join(","));
  }

  if (normalizedVariantIds.length > 0) {
    params.set("variantIds", normalizedVariantIds.join(","));
  }

  const queryString = params.toString();
  return queryString ? `/products?${queryString}` : "/products";
};

const getPromoVariantLabel = (product, variant) => {
  const sku = String(variant?.sku || "").trim();
  const price = Number(variant?.price || 0);
  const effectivePrice = Number(variant?.effective_price || 0);
  const hasDiscount = price > 0 && effectivePrice > 0 && effectivePrice < price;
  const discountText = hasDiscount
    ? ` — ${Math.round(((price - effectivePrice) / price) * 100)}% OFF`
    : "";

  if (sku) {
    return `${product.name} — ${sku}${discountText} (#${variant.id})`;
  }

  return `${product.name} — Variant #${variant.id}${discountText}`;
};

const splitPromoChoiceLabel = (value) => {
  const label = String(value || "").trim();
  const idMatch = label.match(/\(#(\d+)\)\s*$/);

  if (!idMatch) {
    return { title: label, badge: "" };
  }

  return {
    title: label.replace(/\s*\(#\d+\)\s*$/, "").trim(),
    badge: `#${idMatch[1]}`
  };
};

const formatPromoValue = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) {
    return "0";
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
};

const resolvePromoRewardType = (campaignType, actions = {}) => {
  const normalizedCampaignType = String(campaignType || "").trim().toLowerCase();
  const discountType = String(actions.discountType || "").trim().toLowerCase();
  const triggerType = String(actions.triggerType || "").trim().toLowerCase();

  if (triggerType === "flash_sale" || normalizedCampaignType === "flash-sale") {
    return "flash_sale";
  }

  if (triggerType === "happy_hour" || normalizedCampaignType === "happy-hour") {
    return "happy_hour";
  }

  if (triggerType === "cart_threshold" || normalizedCampaignType === "threshold-offer") {
    if (discountType === "percent") {
      return "threshold_percent";
    }
    if (discountType === "fixed" || !discountType) {
      return "threshold_fixed";
    }
  }

  if (normalizedCampaignType === "buy-x-get-y" && !discountType) {
    return "buy_x_get_y";
  }

  return discountType;
};

const buildPromoDisplayText = ({ campaignType, category, productIds, variantIds, threshold, discountType = "", discountValue = 0, buyQuantity = 2, freeQuantity = 1 }) => {
  const normalizedCampaign = String(campaignType || "promo-group").trim().toLowerCase();
  const normalizedCategory = String(category || "").trim();
  const normalizedDiscountType = String(discountType || "").trim().toLowerCase();
  const numericDiscount = Math.max(0, Number(discountValue || 0));
  const numericThreshold = Math.max(0, Number(threshold || 0));
  const scopeLabel = normalizedCategory
    || ((variantIds || []).length > 0
      ? "selected variants"
      : (productIds || []).length > 0
        ? "selected products"
        : "selected styles");

  if (normalizedDiscountType === "bundle_fixed_total" && numericDiscount > 0) {
    const buy = Math.max(1, Number(buyQuantity || 2));
    return normalizedCategory
      ? `Buy ${buy} for ₹${formatPromoValue(numericDiscount)} on ${normalizedCategory}`
      : `Buy ${buy} for ₹${formatPromoValue(numericDiscount)} on selected styles`;
  }

  if (normalizedCampaign === "free-shipping") {
    return numericThreshold > 0
      ? `Free shipping on orders over ₹${formatPromoValue(numericThreshold)}`
      : "Free shipping offer now live";
  }

  if (normalizedDiscountType === "threshold_fixed" && numericDiscount > 0 && numericThreshold > 0) {
    return `Spend ₹${formatPromoValue(numericThreshold)}, get ₹${formatPromoValue(numericDiscount)} off`;
  }

  if (normalizedDiscountType === "threshold_percent" && numericDiscount > 0 && numericThreshold > 0) {
    return `Spend ₹${formatPromoValue(numericThreshold)}, get ${formatPromoValue(numericDiscount)}% off`;
  }

  if (normalizedDiscountType === "flash_sale") {
    const percentText = formatPromoValue(numericDiscount || 15);
    return normalizedCategory
      ? `${normalizedCategory} Flash Sale – extra ${percentText}% off for a limited time`
      : `Flash Sale – extra ${percentText}% off for a limited time`;
  }

  if (normalizedDiscountType === "happy_hour") {
    const percentText = formatPromoValue(numericDiscount || 10);
    return normalizedCategory
      ? `${normalizedCategory} Happy Hour – extra ${percentText}% off right now`
      : `Happy Hour – extra ${percentText}% off right now`;
  }

  if (normalizedCampaign === "buy-x-get-y" || normalizedDiscountType === "buy_x_get_y") {
    const buy = Math.max(1, Number(buyQuantity || 2));
    const free = Math.max(1, Number(freeQuantity || 1));
    return normalizedCategory
      ? `Buy ${buy}, get ${free} free on ${normalizedCategory}`
      : `Buy ${buy}, get ${free} free on selected styles`;
  }

  if (normalizedCampaign === "summer-sale") {
    const percentText = formatPromoValue(numericDiscount || 6);
    return normalizedCategory
      ? `${normalizedCategory} Summer Sale – extra ${percentText}% off styles`
      : `Summer Sale – extra ${percentText}% off styles`;
  }

  if (normalizedCampaign === "clearance-sale") {
    const percentText = formatPromoValue(numericDiscount || 10);
    return normalizedCategory
      ? `${normalizedCategory} Clearance Sale – extra ${percentText}% off, tax included`
      : `Clearance Sale – extra ${percentText}% off, tax included`;
  }

  if (normalizedCampaign === "category-sale") {
    const percentText = formatPromoValue(numericDiscount || 4);
    return normalizedCategory
      ? `${normalizedCategory} Category Sale – extra ${percentText}% off today`
      : `Category Sale – extra ${percentText}% off today`;
  }

  if (normalizedCampaign === "sale" && normalizedDiscountType === "percent" && numericDiscount > 0) {
    return normalizedCategory
      ? `${normalizedCategory} Sale – extra ${formatPromoValue(numericDiscount)}% off today`
      : `Storewide Sale – extra ${formatPromoValue(numericDiscount)}% off today`;
  }

  if (normalizedDiscountType === "fixed" && numericDiscount > 0) {
    return `₹${formatPromoValue(numericDiscount)} off on ${scopeLabel}`;
  }

  if (normalizedDiscountType === "percent" && numericDiscount > 0) {
    return `Extra ${formatPromoValue(numericDiscount)}% off on ${scopeLabel}`;
  }

  if ((variantIds || []).length > 0) {
    return "Limited deal on selected variants";
  }

  if ((productIds || []).length > 0) {
    return (productIds || []).length === 1
      ? "Special deal on a selected product"
      : "Special deals on selected products";
  }

  return "Shop featured offers now";
};

const getPromoActionSummary = (campaign = {}) => {
  const conditions = campaign.conditions && typeof campaign.conditions === "object" ? campaign.conditions : {};
  const actions = campaign.actions && typeof campaign.actions === "object" ? campaign.actions : {};
  const offerType = String(campaign.campaignType || conditions.offerType || "").trim().toLowerCase();
  const discountType = String(actions.discountType || "").trim().toLowerCase();
  const triggerType = String(actions.triggerType || "").trim().toLowerCase();
  const discountValue = Number(actions.discountValue || 0);
  const buyQuantity = Math.max(1, Number(actions.buyQuantity || campaign.buyQuantity || 2));
  const freeQuantity = Math.max(1, Number(actions.freeQuantity || campaign.freeQuantity || 1));
  const threshold = Number(conditions.minCartSubtotal || conditions.minCartTotal || campaign.minCartSubtotal || 0);

  if (offerType === "buy-x-get-y" || discountType === "buy_x_get_y") {
    return `Buy ${buyQuantity}, get ${freeQuantity} free`;
  }

  if (discountType === "bundle_fixed_total" && discountValue > 0) {
    return `Buy ${buyQuantity} for Rs.${Number(discountValue || 0).toLocaleString("en-IN")}`;
  }

  if (offerType === "free-shipping" || actions.freeShipping) {
    return threshold > 0
      ? `Free shipping on carts above Rs.${threshold}`
      : "Free shipping enabled";
  }

  if (triggerType === "cart_threshold" && discountType === "fixed" && threshold > 0 && discountValue > 0) {
    return `Spend Rs.${Number(threshold || 0).toLocaleString("en-IN")}, get Rs.${Number(discountValue || 0).toLocaleString("en-IN")} off`;
  }

  if (triggerType === "cart_threshold" && discountType === "percent" && threshold > 0 && discountValue > 0) {
    return `Spend Rs.${Number(threshold || 0).toLocaleString("en-IN")}, get ${discountValue}% off`;
  }

  if (triggerType === "flash_sale" && discountType === "percent" && discountValue > 0) {
    return `Flash sale • ${discountValue}% off`;
  }

  if (triggerType === "happy_hour" && discountType === "percent" && discountValue > 0) {
    return `Happy hour • ${discountValue}% off`;
  }

  if (discountType === "percent" && discountValue > 0) {
    return `${discountValue}% off eligible items`;
  }

  if (discountType === "fixed" && discountValue > 0) {
    return `Rs.${Number(discountValue || 0).toLocaleString("en-IN")} off eligible items`;
  }

  return "Uses default catalog pricing";
};

const getPromoScopeSummary = (campaign = {}) => {
  const conditions = campaign.conditions && typeof campaign.conditions === "object" ? campaign.conditions : {};
  const categories = Array.isArray(conditions.categoryNames) ? conditions.categoryNames.filter(Boolean) : [];
  const productCount = Array.isArray(conditions.productIds) ? conditions.productIds.length : 0;
  const variantCount = Array.isArray(conditions.variantIds) ? conditions.variantIds.length : 0;

  if (variantCount > 0) {
    return `${variantCount} selected variant${variantCount === 1 ? "" : "s"}`;
  }

  if (productCount > 0) {
    return `${productCount} selected product${productCount === 1 ? "" : "s"}`;
  }

  if (categories.length > 0) {
    return categories.join(", ");
  }

  return "All matching storefront items";
};

const getDisplayModeLabel = (value = "both") => {
  const match = DISPLAY_MODE_OPTIONS.find((option) => option.value === value);
  return match?.label || "Banner + pricing";
};

const AUTO_PROMO_COPY_PATTERNS = [
  /^free shipping on orders over (?:₹|rs\.?\s*)?\d+(?:\.\d+)?$/i,
  /^spend (?:₹|rs\.?\s*)?\d+(?:\.\d+)?, get (?:₹|rs\.?\s*)?\d+(?:\.\d+)? off$/i,
  /^spend (?:₹|rs\.?\s*)?\d+(?:\.\d+)?, get \d+(?:\.\d+)?% off$/i,
  /^buy \d+,? get \d+ free on .+$/i,
  /^buy \d+ for (?:₹|rs\.?\s*)?\d+(?:\.\d+)? on .+$/i,
  /(?:.+\s)?summer sale – extra \d+(?:\.\d+)?% off styles$/i,
  /(?:.+\s)?clearance sale – extra \d+(?:\.\d+)?% off, tax included$/i,
  /(?:.+\s)?category sale – extra \d+(?:\.\d+)?% off today$/i,
  /(?:.+\s)?flash sale – extra \d+(?:\.\d+)?% off for a limited time$/i,
  /(?:.+\s)?happy hour – extra \d+(?:\.\d+)?% off right now$/i,
  /(?:.+\s)?sale – extra \d+(?:\.\d+)?% off today$/i,
  /^limited deal on selected variants$/i,
  /^special deal on a selected product$/i,
  /^special deals on selected products$/i,
  /^shop featured offers now$/i,
];

const isAutoManagedPromoCopy = (value, previousAutoText = "") => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return true;
  }

  if (previousAutoText && normalizedValue === previousAutoText) {
    return true;
  }

  return AUTO_PROMO_COPY_PATTERNS.some((pattern) => pattern.test(normalizedValue));
};

const syncPromoDraftMessaging = (nextDraft, previousDraft = null) => {
  const previousReference = previousDraft || nextDraft;
  const previousAutoText = buildPromoDisplayText({
    campaignType: previousReference.campaignType,
    category: previousReference.category,
    productIds: previousReference.productIds,
    variantIds: previousReference.variantIds,
    threshold: previousReference.minCartSubtotal,
    discountType: previousReference.discountType,
    discountValue: previousReference.discountValue,
    buyQuantity: previousReference.buyQuantity,
    freeQuantity: previousReference.freeQuantity,
  });
  const nextAutoText = buildPromoDisplayText({
    campaignType: nextDraft.campaignType,
    category: nextDraft.category,
    productIds: nextDraft.productIds,
    variantIds: nextDraft.variantIds,
    threshold: nextDraft.minCartSubtotal,
    discountType: nextDraft.discountType,
    discountValue: nextDraft.discountValue,
    buyQuantity: nextDraft.buyQuantity,
    freeQuantity: nextDraft.freeQuantity,
  });

  const currentName = String(nextDraft.name || "").trim();
  const currentText = String(nextDraft.text || "").trim();

  return {
    ...nextDraft,
    name: isAutoManagedPromoCopy(currentName, previousAutoText) ? nextAutoText : nextDraft.name,
    text: isAutoManagedPromoCopy(currentText, previousAutoText) ? nextAutoText : nextDraft.text,
  };
};

const createPromoCampaignDraft = (initial = {}) => {
  const target = String(initial.to || initial.target_url || "/products").trim() || "/products";
  const conditions = initial.conditions && typeof initial.conditions === "object" ? initial.conditions : {};
  const actions = initial.actions && typeof initial.actions === "object" ? initial.actions : {};
  const resolvedCampaignType = String(
    initial.campaignType
    || conditions.offerType
    || extractOfferFromTarget(target)
    || "promo-group"
  ).trim() || "promo-group";

  const baseDraft = {
    id: initial.id || 0,
    name: String(initial.name || "").trim(),
    text: String(initial.text || initial.banner_text || "").trim(),
    to: target,
    campaignType: resolvedCampaignType,
    category: String(
      initial.category
      || conditions.categoryNames?.[0]
      || conditions.categories?.[0]
      || extractCategoryFromTarget(target)
      || ""
    ).trim(),
    productIds: dedupeIds(initial.productIds || conditions.productIds || extractProductIdsFromTarget(target)),
    variantIds: dedupeIds(initial.variantIds || conditions.variantIds || extractVariantIdsFromTarget(target)),
    minCartSubtotal: Number(initial.minCartSubtotal ?? conditions.minCartSubtotal ?? extractMinPriceFromTarget(target) ?? 0),
    discountType: String(initial.discountType || resolvePromoRewardType(resolvedCampaignType, actions) || "").trim(),
    discountValue: Number(initial.discountValue ?? actions.discountValue ?? 0),
    buyQuantity: Math.max(1, Number(initial.buyQuantity ?? actions.buyQuantity ?? 2)),
    freeQuantity: Math.max(1, Number(initial.freeQuantity ?? actions.freeQuantity ?? 1)),
    freeShipping: Boolean(initial.freeShipping ?? actions.freeShipping),
    stackable: Boolean(initial.stackable ?? actions.stackable),
    displayMode: String(initial.displayMode || initial.display_mode || "both").trim() || "both",
    startAt: String(initial.startAt || initial.start_date || "").slice(0, 16),
    endAt: String(initial.endAt || initial.end_date || "").slice(0, 16),
    enabled: initial.enabled !== false,
    isPrimary: Boolean(initial.isPrimary ?? initial.is_primary),
    priority: Math.max(1, Number(initial.priority || 1)),
    status: String(initial.status || "active").trim() || "active"
  };

  return syncPromoDraftMessaging(baseDraft);
};

const PROMO_STATUS_META = {
  active: { label: "Active now", className: "admin-status-active" },
  scheduled: { label: "Scheduled", className: "admin-status-scheduled" },
  draft: { label: "Draft", className: "admin-status-scheduled" },
  expired: { label: "Expired", className: "admin-status-expired" },
  disabled: { label: "Disabled", className: "admin-status-disabled" }
};

const getPromoStatusMeta = (status) => PROMO_STATUS_META[status] || PROMO_STATUS_META.disabled;

const formatPromoDateValue = (value, fallback = "") => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : fallback;
};

const formatPromoSchedule = (startAt, endAt) => {
  const startLabel = formatPromoDateValue(startAt);
  const endLabel = formatPromoDateValue(endAt);

  if (startLabel && endLabel) {
    return `${startLabel} → ${endLabel}`;
  }

  if (startLabel) {
    return `Starts ${startLabel}`;
  }

  if (endLabel) {
    return `Ends ${endLabel}`;
  }

  return "Always on until manually disabled";
};

function AdminContent() {
  const [content, setContent] = useState(() => getDefaultSiteContent());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [promoProducts, setPromoProducts] = useState([]);
  const [promoVariants, setPromoVariants] = useState([]);
  const [promoCategories, setPromoCategories] = useState([]);
  const [promoProductsLoading, setPromoProductsLoading] = useState(true);
  const [promoProductSearch, setPromoProductSearch] = useState("");
  const [promoVariantSearch, setPromoVariantSearch] = useState("");
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoModalMode, setPromoModalMode] = useState("create");
  const [promoDraft, setPromoDraft] = useState(() => createPromoCampaignDraft());
  const [dbPromoCampaigns, setDbPromoCampaigns] = useState([]);
  const [promoTemplates, setPromoTemplates] = useState(() => []);
  const [promoSaving, setPromoSaving] = useState(false);
  const normalizedContent = useMemo(() => normalizeSiteContent(content), [content]);

  useEffect(() => {
    let active = true;

    adminFetch("admin_site_content.php")
      .then((payload) => {
        if (!active) return;
        const normalized = normalizeSiteContent(payload.settings || payload.content || payload.data || {});
        setContent(normalized);
        setJsonDraft(JSON.stringify(normalized, null, 2));
        if (Array.isArray(payload.promotions)) {
          setDbPromoCampaigns(payload.promotions);
        }
        if (Array.isArray(payload.templates) && payload.templates.length > 0) {
          setPromoTemplates(payload.templates.map(normalizePromoTemplateOption).filter(Boolean));
        }
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(`${err.message}. Using fallback content until API is ready.`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    adminFetch("admin_promotions.php")
      .then((payload) => {
        if (!active) return;
        setDbPromoCampaigns(Array.isArray(payload.promotions) ? payload.promotions : []);
        if (Array.isArray(payload.templates) && payload.templates.length > 0) {
          setPromoTemplates(payload.templates.map(normalizePromoTemplateOption).filter(Boolean));
        }
      })
      .catch(() => {
        if (!active) return;
        setDbPromoCampaigns([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

   fetch("https://my-vite-app-backend.onrender.com/products.php?sort=relevance&limit=500", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success || !Array.isArray(data.products)) {
          return;
        }

        const items = data.products
          .filter((product) => product && product.product_id && product.name)
          .map((product) => ({
            id: String(product.product_id),
            label: `${product.name} (#${product.product_id})`,
            category: String(product.category_name || "").trim()
          }));

        const variantItems = data.products
          .filter((product) => product && product.product_id && product.name)
          .flatMap((product) =>
            Array.isArray(product.variants)
              ? product.variants
                  .filter((variant) => variant && variant.id)
                  .map((variant) => ({
                    id: String(variant.id),
                    label: getPromoVariantLabel(product, variant),
                    productId: String(product.product_id),
                    category: String(product.category_name || "").trim()
                  }))
              : []
          );

        const categoryItems = Array.from(
          data.products.reduce((acc, product) => {
            const name = String(product?.category_name || "").trim();
            if (!name) {
              return acc;
            }

            acc.set(name, (acc.get(name) || 0) + 1);
            return acc;
          }, new Map())
        )
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([label, count]) => ({ id: label, label, count }));

        setPromoProducts(items);
        setPromoVariants(variantItems);
        setPromoCategories(categoryItems);
      })
      .catch(() => {
        setPromoProducts([]);
        setPromoVariants([]);
        setPromoCategories([]);
      })
      .finally(() => {
        setPromoProductsLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isPromoModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isPromoModalOpen]);

  const updateBrand = (key, value) => {
    setContent((prev) => ({
      ...prev,
      brand: {
        ...prev.brand,
        [key]: value
      }
    }));
  };

  const updatePromoStrip = (key, value) => {
    setContent((prev) => {
      const nextPromoStrip = {
        ...prev.offers.promoStrip,
        [key]: value
      };

      if (key === "to") {
        const previousTarget = String(prev.offers?.promoStrip?.to || "/products").trim() || "/products";
        const previousText = String(prev.offers?.promoStrip?.text || "").trim();
        const previousAutoText = buildPromoDisplayText({
          campaignType: extractOfferFromTarget(previousTarget) || "promo-group",
          category: extractCategoryFromTarget(previousTarget),
          productIds: extractProductIdsFromTarget(previousTarget),
          variantIds: extractVariantIdsFromTarget(previousTarget),
          threshold: Number(prev.offers?.freeShippingThreshold || 0),
        });
        const nextTarget = String(value || "/products").trim() || "/products";
        const nextAutoText = buildPromoDisplayText({
          campaignType: extractOfferFromTarget(nextTarget) || "promo-group",
          category: extractCategoryFromTarget(nextTarget),
          productIds: extractProductIdsFromTarget(nextTarget),
          variantIds: extractVariantIdsFromTarget(nextTarget),
          threshold: Number(prev.offers?.freeShippingThreshold || 0),
        });

        if (!previousText || previousText === previousAutoText) {
          nextPromoStrip.text = nextAutoText;
        }
      }

      return {
        ...prev,
        offers: {
          ...prev.offers,
          promoStrip: nextPromoStrip
        }
      };
    });
  };

  const updateOffer = (key, value) => {
    setContent((prev) => ({
      ...prev,
      offers: {
        ...prev.offers,
        [key]: value
      }
    }));
  };

  const openCreatePromoModal = () => {
    setError("");
    setSuccess("");
    setPromoModalMode("create");

    const defaultCampaignType =
      promoCampaignOptions.find((option) => option.value === "promo-group")?.value
      || promoCampaignOptions[0]?.value
      || "promo-group";

    const baseDraft = createPromoCampaignDraft({
      to: `/products?offer=${defaultCampaignType}`,
      text: "",
      campaignType: defaultCampaignType,
      category: "",
      productIds: [],
      variantIds: [],
      minCartSubtotal: 0,
      discountType: "",
      discountValue: 0,
      freeShipping: false,
      enabled: true,
      isPrimary: false,
      priority: dbPromoCampaigns.length + 1,
      status: "active"
    });

    setPromoDraft(buildPromoDraftForCampaign(baseDraft, defaultCampaignType, baseDraft));
    setIsPromoModalOpen(true);
  };

  const openEditPromoModal = (campaign) => {
    setError("");
    setSuccess("");
    setPromoModalMode("edit");
    setPromoDraft(createPromoCampaignDraft(campaign));
    setIsPromoModalOpen(true);
  };

  const closePromoModal = () => {
    setIsPromoModalOpen(false);
    setPromoDraft(createPromoCampaignDraft());
  };

  const syncPromoDraftFilters = (draft, previousDraft = null) => {
    const nextTarget = buildPromoTargetUrl({
      campaignType: draft.campaignType,
      category: draft.category,
      minPrice: draft.minCartSubtotal,
      productIds: draft.productIds,
      variantIds: draft.variantIds,
    });

    return syncPromoDraftMessaging({
      ...draft,
      to: nextTarget,
      freeShipping: draft.campaignType === "free-shipping" ? true : draft.freeShipping,
    }, previousDraft);
  };

  const buildPromoDraftForCampaign = (draft, campaignType, previousDraft = null) => {
    const normalizedCampaignType = String(campaignType || "promo-group").trim() || "promo-group";
    const selectedTemplate = promoCampaignOptions.find((option) => option.value === normalizedCampaignType);
    const templateActions = selectedTemplate?.actions && typeof selectedTemplate.actions === "object"
      ? selectedTemplate.actions
      : {};
    const templateRewardType = resolvePromoRewardType(normalizedCampaignType, templateActions);
    const usesThresholdDefaults = ["free-shipping", "threshold-offer"].includes(normalizedCampaignType);
    const nextDraft = {
      ...draft,
      campaignType: normalizedCampaignType,
      category: normalizedCampaignType === "free-shipping" ? "" : draft.category,
      productIds: normalizedCampaignType === "free-shipping" ? [] : draft.productIds,
      variantIds: normalizedCampaignType === "free-shipping" ? [] : draft.variantIds,
      minCartSubtotal: usesThresholdDefaults
        ? Math.max(0, Number(selectedTemplate?.threshold ?? (normalizedCampaignType === "threshold-offer" ? 2000 : content.offers?.freeShippingThreshold) ?? draft.minCartSubtotal ?? 0))
        : 0,
      discountType: String(
        templateRewardType
          || (normalizedCampaignType === "buy-x-get-y"
            ? "buy_x_get_y"
            : normalizedCampaignType === "free-shipping"
              ? "none"
              : normalizedCampaignType === "threshold-offer"
                ? "threshold_fixed"
                : normalizedCampaignType === "flash-sale"
                  ? "flash_sale"
                  : normalizedCampaignType === "happy-hour"
                    ? "happy_hour"
                    : "percent")
      ).trim(),
      discountValue: Math.max(0, Number(templateActions.discountValue ?? 0)),
      freeShipping: Boolean(templateActions.freeShipping),
      stackable: Boolean(templateActions.stackable),
      buyQuantity: Math.max(1, Number(templateActions.buyQuantity || draft.buyQuantity || 2)),
      freeQuantity: Math.max(1, Number(templateActions.freeQuantity || draft.freeQuantity || 1)),
    };

    return syncPromoDraftFilters(nextDraft, previousDraft || draft);
  };

  const updatePromoDraft = (key, value) => {
    setPromoDraft((prev) => {
      let normalizedValue = value;

      if (["priority", "buyQuantity", "freeQuantity"].includes(key)) {
        normalizedValue = Math.max(1, Number(value || 1));
      } else if (["minCartSubtotal", "discountValue"].includes(key)) {
        normalizedValue = Math.max(0, Number(value || 0));
      }

      const nextDraft = {
        ...prev,
        [key]: normalizedValue
      };

      if (key === "campaignType") {
        return buildPromoDraftForCampaign(nextDraft, normalizedValue, prev);
      }

      if (key === "discountType" && normalizedValue === "buy_x_get_y") {
        nextDraft.buyQuantity = Math.max(1, Number(nextDraft.buyQuantity || 2));
        nextDraft.freeQuantity = Math.max(1, Number(nextDraft.freeQuantity || 1));
      }

      if (key === "discountType" && normalizedValue === "bundle_fixed_total") {
        nextDraft.buyQuantity = Math.max(2, Number(nextDraft.buyQuantity || 2));
      }

      if (key === "discountType" && ["threshold_fixed", "threshold_percent"].includes(String(normalizedValue))) {
        nextDraft.minCartSubtotal = Math.max(0, Number(nextDraft.minCartSubtotal || 2000));
      }

      if (key === "freeShipping" && normalizedValue && nextDraft.minCartSubtotal <= 0) {
        nextDraft.minCartSubtotal = Math.max(0, Number(content.offers?.freeShippingThreshold || 0));
      }

      if (["category", "productIds", "variantIds", "minCartSubtotal", "buyQuantity", "freeQuantity", "freeShipping", "discountType", "discountValue"].includes(key)) {
        return syncPromoDraftFilters(nextDraft, prev);
      }

      return nextDraft;
    });
  };

  const togglePromoDraftProduct = (productId) => {
    const normalizedProductId = normalizeChoiceId(productId);

    setPromoDraft((prev) => {
      const nextProductIds = prev.productIds.includes(normalizedProductId)
        ? prev.productIds.filter((id) => id !== normalizedProductId)
        : [...prev.productIds, normalizedProductId];
      return syncPromoDraftFilters({ ...prev, productIds: nextProductIds }, prev);
    });
  };

  const togglePromoDraftVariant = (variantId) => {
    const normalizedVariantId = normalizeChoiceId(variantId);

    setPromoDraft((prev) => {
      const nextVariantIds = prev.variantIds.includes(normalizedVariantId)
        ? prev.variantIds.filter((id) => id !== normalizedVariantId)
        : [...prev.variantIds, normalizedVariantId];
      return syncPromoDraftFilters({ ...prev, variantIds: nextVariantIds }, prev);
    });
  };

  const savePromoDraft = async () => {
    const normalizedPromoDraft = syncPromoDraftFilters(promoDraft, promoDraft);
    const generatedText = buildPromoDisplayText({
      campaignType: normalizedPromoDraft.campaignType,
      category: normalizedPromoDraft.category,
      productIds: normalizedPromoDraft.productIds,
      variantIds: normalizedPromoDraft.variantIds,
      threshold: normalizedPromoDraft.minCartSubtotal,
      discountType: normalizedPromoDraft.discountType,
      discountValue: normalizedPromoDraft.discountValue,
      buyQuantity: normalizedPromoDraft.buyQuantity,
      freeQuantity: normalizedPromoDraft.freeQuantity,
    });
    const nextName = String(normalizedPromoDraft.name || generatedText).trim() || generatedText;
    const nextText = String(normalizedPromoDraft.text || generatedText).trim() || generatedText;
    const nextTarget = String(normalizedPromoDraft.to || "/products").trim() || "/products";

    if (promoDraft.startAt && promoDraft.endAt) {
      const startTs = Date.parse(promoDraft.startAt);
      const endTs = Date.parse(promoDraft.endAt);
      if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs < startTs) {
        setError("Promo end date must be after the start date.");
        return;
      }
    }

    setPromoSaving(true);
    setError("");

    try {
      const payload = await adminFetch("admin_promotions.php", {
        method: "POST",
        body: JSON.stringify({
          action: "upsert",
          promotion: {
            id: normalizedPromoDraft.id,
            name: nextName,
            text: nextText,
            to: nextTarget,
            offerType: normalizedPromoDraft.campaignType,
            startAt: normalizedPromoDraft.startAt,
            endAt: normalizedPromoDraft.endAt,
            enabled: normalizedPromoDraft.enabled,
            isPrimary: normalizedPromoDraft.isPrimary,
            priority: Math.max(1, Number(normalizedPromoDraft.priority || 1)),
            status: normalizedPromoDraft.status || "active",
            conditions: {
              offerType: normalizedPromoDraft.campaignType,
              categoryNames: normalizedPromoDraft.category ? [normalizedPromoDraft.category] : [],
              productIds: normalizedPromoDraft.productIds,
              variantIds: normalizedPromoDraft.variantIds,
              minCartSubtotal: Number(normalizedPromoDraft.minCartSubtotal || 0),
            },
            displayMode: normalizedPromoDraft.displayMode || "both",
            actions: {
              discountType: normalizedPromoDraft.discountType || undefined,
              discountValue: Number(normalizedPromoDraft.discountValue || 0),
              freeShipping: Boolean(normalizedPromoDraft.freeShipping),
              buyQuantity: Math.max(1, Number(normalizedPromoDraft.buyQuantity || 2)),
              freeQuantity: Math.max(1, Number(normalizedPromoDraft.freeQuantity || 1)),
              stackable: Boolean(normalizedPromoDraft.stackable),
            }
          }
        })
      });

      setDbPromoCampaigns(Array.isArray(payload.promotions) ? payload.promotions : []);
      if (Array.isArray(payload.templates) && payload.templates.length > 0) {
        setPromoTemplates(payload.templates.map(normalizePromoTemplateOption).filter(Boolean));
      }
      setSuccess(
        promoModalMode === "edit"
          ? "Promo offer updated in the database."
          : "Promo offer added to the database."
      );
      closePromoModal();
    } catch (err) {
      setError(err.message || "Failed to save promo offer");
    } finally {
      setPromoSaving(false);
    }
  };

  const deletePromoCampaign = async (campaignId) => {
    try {
      const payload = await adminFetch("admin_promotions.php", {
        method: "POST",
        body: JSON.stringify({ action: "delete", id: campaignId })
      });
      setDbPromoCampaigns(Array.isArray(payload.promotions) ? payload.promotions : dbPromoCampaigns.filter((campaign) => campaign.id !== campaignId));
      if (Array.isArray(payload.templates) && payload.templates.length > 0) {
        setPromoTemplates(payload.templates.map(normalizePromoTemplateOption).filter(Boolean));
      }
      setError("");
      setSuccess("Promo offer removed from the database.");
    } catch (err) {
      setError(err.message || "Failed to delete promo offer");
    }
  };

  const loadPromoCampaignIntoStrip = (campaign) => {
    setContent((prev) => ({
      ...prev,
      offers: {
        ...prev.offers,
        promoStrip: {
          ...prev.offers.promoStrip,
          enabled: campaign.enabled !== false,
          text: campaign.banner_text || campaign.text,
          to: campaign.target_url || campaign.to
        }
      }
    }));
    setError("");
    setSuccess("Promo copied into the legacy fallback strip preview. The real promo remains stored in the database.");
  };

  const updateProductPageText = (key, value) => {
    setContent((prev) => ({
      ...prev,
      productsPage: {
        ...prev.productsPage,
        [key]: value
      }
    }));
  };

  const updateCartPageText = (key, value) => {
    setContent((prev) => ({
      ...prev,
      cartPage: {
        ...prev.cartPage,
        [key]: value
      }
    }));
  };

  const updateGuestOrderTrackText = (key, value) => {
    setContent((prev) => ({
      ...prev,
      guestOrderTrackPage: {
        ...prev.guestOrderTrackPage,
        [key]: value
      }
    }));
  };

  const updateConfirmationPageText = (key, value) => {
    setContent((prev) => ({
      ...prev,
      confirmationPage: {
        ...prev.confirmationPage,
        [key]: value
      }
    }));
  };

  const updateHomePage = (key, value) => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        [key]: value
      }
    }));
  };

  const updateHomePageSection = (sectionKey, key, value) => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        [sectionKey]: {
          ...prev.homePage[sectionKey],
          [key]: value
        }
      }
    }));
  };

  const updateHomeHeroSlide = (index, key, value) => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        heroSlides: prev.homePage.heroSlides.map((slide, i) => (i === index ? { ...slide, [key]: value } : slide))
      }
    }));
  };

  const addHomeHeroSlide = () => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        heroSlides: [
          ...prev.homePage.heroSlides,
          {
            id: createId("hero"),
            title: "New hero title",
            subtitle: "New hero subtitle",
            image: "",
            ctaLabel: "Shop now",
            ctaTo: "/products"
          }
        ]
      }
    }));
  };

  const deleteHomeHeroSlide = (index) => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        heroSlides: prev.homePage.heroSlides.filter((_, i) => i !== index)
      }
    }));
  };

  const updateHomeTrustBadges = (value) => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        trustBadges: value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      }
    }));
  };

  const updateHomeCategory = (index, key, value) => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        primaryCategories: prev.homePage.primaryCategories.map((item, i) =>
          i === index ? { ...item, [key]: value } : item
        )
      }
    }));
  };

  const addHomeCategory = () => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        primaryCategories: [
          ...prev.homePage.primaryCategories,
          {
            id: createId("home-category"),
            label: "New category",
            to: "/products",
            image: ""
          }
        ]
      }
    }));
  };

  const deleteHomeCategory = (index) => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        primaryCategories: prev.homePage.primaryCategories.filter((_, i) => i !== index)
      }
    }));
  };

  const updateSpotlightCard = (index, key, value) => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        spotlightCards: prev.homePage.spotlightCards.map((item, i) =>
          i === index ? { ...item, [key]: value } : item
        )
      }
    }));
  };

  const addSpotlightCard = () => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        spotlightCards: [
          ...prev.homePage.spotlightCards,
          {
            id: createId("spotlight"),
            title: "New spotlight",
            subtitle: "Describe this promotion",
            to: "/products",
            tone: "warm"
          }
        ]
      }
    }));
  };

  const deleteSpotlightCard = (index) => {
    setContent((prev) => ({
      ...prev,
      homePage: {
        ...prev.homePage,
        spotlightCards: prev.homePage.spotlightCards.filter((_, i) => i !== index)
      }
    }));
  };

  const updateCheckoutConfig = (key, value) => {
    setContent((prev) => ({
      ...prev,
      checkout: {
        ...prev.checkout,
        [key]: value
      }
    }));
  };

  const updateCheckoutGuestUpsell = (key, value) => {
    setContent((prev) => ({
      ...prev,
      checkout: {
        ...prev.checkout,
        guestUpsell: {
          ...prev.checkout.guestUpsell,
          [key]: value
        }
      }
    }));
  };

  const updateCheckoutMethod = (methodId, key, value) => {
    setContent((prev) => ({
      ...prev,
      checkout: {
        ...prev.checkout,
        paymentMethods: prev.checkout.paymentMethods.map((method) =>
          method.id === methodId ? { ...method, [key]: value } : method
        )
      }
    }));
  };

  const updateNavItem = (index, key, value) => {
    setContent((prev) => ({
      ...prev,
      navbar: {
        ...prev.navbar,
        links: prev.navbar.links.map((item, i) => (i === index ? { ...item, [key]: value } : item))
      }
    }));
  };

  const addNavItem = () => {
    setContent((prev) => ({
      ...prev,
      navbar: {
        ...prev.navbar,
        links: [
          ...prev.navbar.links,
          {
            id: createId("nav"),
            label: "New Link",
            to: "/",
            enabled: true,
            requiresAuth: false,
            adminOnly: false
          }
        ]
      }
    }));
  };

  const deleteNavItem = (index) => {
    setContent((prev) => ({
      ...prev,
      navbar: {
        ...prev.navbar,
        links: prev.navbar.links.filter((_, i) => i !== index)
      }
    }));
  };

  const addFooterSection = () => {
    setContent((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        sections: [
          ...prev.footer.sections,
          {
            id: createId("footer-section"),
            title: "New Section",
            links: []
          }
        ]
      }
    }));
  };

  const updateFooterSectionTitle = (sectionIndex, value) => {
    setContent((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        sections: prev.footer.sections.map((section, i) =>
          i === sectionIndex ? { ...section, title: value } : section
        )
      }
    }));
  };

  const deleteFooterSection = (sectionIndex) => {
    setContent((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        sections: prev.footer.sections.filter((_, i) => i !== sectionIndex)
      }
    }));
  };

  const addFooterLink = (sectionIndex) => {
    setContent((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        sections: prev.footer.sections.map((section, i) => {
          if (i !== sectionIndex) return section;

          return {
            ...section,
            links: [
              ...section.links,
              {
                id: createId("footer-link"),
                label: "New Link",
                to: "/",
                type: "internal"
              }
            ]
          };
        })
      }
    }));
  };

  const updateFooterLink = (sectionIndex, linkIndex, key, value) => {
    setContent((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        sections: prev.footer.sections.map((section, i) => {
          if (i !== sectionIndex) return section;

          return {
            ...section,
            links: section.links.map((link, j) => (j === linkIndex ? { ...link, [key]: value } : link))
          };
        })
      }
    }));
  };

  const deleteFooterLink = (sectionIndex, linkIndex) => {
    setContent((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        sections: prev.footer.sections.map((section, i) => {
          if (i !== sectionIndex) return section;

          return {
            ...section,
            links: section.links.filter((_, j) => j !== linkIndex)
          };
        })
      }
    }));
  };

  const updatePaymentBadges = (value) => {
    setContent((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        paymentBadges: value
          .split(",")
          .map((badge) => badge.trim())
          .filter(Boolean)
      }
    }));
  };

  const promoCampaigns = useMemo(
    () => [...dbPromoCampaigns].sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100)),
    [dbPromoCampaigns]
  );
  const activeScheduledPromos = promoCampaigns.filter((campaign) => (campaign.runtime_status || campaign.status) === "active");
  const stackablePromoCount = promoCampaigns.filter((campaign) => Boolean(campaign.actions?.stackable)).length;
  const scheduledPromoCount = promoCampaigns.filter((campaign) => (campaign.runtime_status || campaign.status) === "scheduled" || (campaign.runtime_status || campaign.status) === "draft").length;
  const livePrimaryPromo = activeScheduledPromos.find((campaign) => campaign.is_primary)
    || [...activeScheduledPromos].sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100))[0]
    || null;
  const livePromoPreview = livePrimaryPromo
    ? {
        text: livePrimaryPromo.banner_text || livePrimaryPromo.text,
        to: livePrimaryPromo.target_url || livePrimaryPromo.to,
        sourceCampaignName: livePrimaryPromo.name
      }
    : null;
  const editingPromoPreview = {
    text: content.offers?.promoStrip?.text,
    to: content.offers?.promoStrip?.to,
    enabled: content.offers?.promoStrip?.enabled !== false,
  };

  const selectedPromoProductIds = useMemo(
    () => extractProductIdsFromTarget(content.offers.promoStrip.to),
    [content.offers.promoStrip.to]
  );
  const selectedPromoVariantIds = useMemo(
    () => extractVariantIdsFromTarget(content.offers.promoStrip.to),
    [content.offers.promoStrip.to]
  );
  const selectedPromoOffer = useMemo(
    () => extractOfferFromTarget(content.offers.promoStrip.to) || "promo-group",
    [content.offers.promoStrip.to]
  );
  const selectedPromoCategory = useMemo(
    () => extractCategoryFromTarget(content.offers.promoStrip.to),
    [content.offers.promoStrip.to]
  );
  const filteredPromoProducts = useMemo(() => {
    const query = promoProductSearch.trim().toLowerCase();
    const selectedCategory = String(promoDraft.category || "").trim().toLowerCase();

    return promoProducts.filter((item) => {
      const matchesCategory = !selectedCategory || String(item.category || "").trim().toLowerCase() === selectedCategory;
      const matchesQuery = !query || item.label.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [promoDraft.category, promoProductSearch, promoProducts]);
  const filteredPromoVariants = useMemo(() => {
    const query = promoVariantSearch.trim().toLowerCase();
    const selectedCategory = String(promoDraft.category || "").trim().toLowerCase();
    const selectedProductIds = new Set((promoDraft.productIds || []).map((value) => normalizeChoiceId(value)));

    return promoVariants.filter((item) => {
      const matchesCategory = !selectedCategory || String(item.category || "").trim().toLowerCase() === selectedCategory;
      const matchesProduct = selectedProductIds.size === 0 || selectedProductIds.has(normalizeChoiceId(item.productId));
      const matchesQuery = !query || item.label.toLowerCase().includes(query);
      return matchesCategory && matchesProduct && matchesQuery;
    });
  }, [promoDraft.category, promoDraft.productIds, promoVariantSearch, promoVariants]);
  const promoCampaignOptions = useMemo(() => {
    const dbTemplateOptions = (Array.isArray(promoTemplates) ? promoTemplates : [])
      .map(normalizePromoTemplateOption)
      .filter(Boolean)
      .filter((option) => option.enabled !== false);

    if (dbTemplateOptions.length > 0) {
      return dbTemplateOptions;
    }

    const derivedOfferTypes = Array.from(new Set(
      (Array.isArray(dbPromoCampaigns) ? dbPromoCampaigns : [])
        .map((campaign) => String(campaign?.campaignType || campaign?.conditions?.offerType || "").trim())
        .filter(Boolean)
    ));

    const derivedOptions = derivedOfferTypes
      .map((offerType) => normalizePromoTemplateOption({
        value: offerType,
        label: toPromoLabel(offerType),
        threshold: Number(content.offers?.freeShippingThreshold || 0),
        shippingFee: Number(content.offers?.standardShippingFee || 80),
        progressTemplate: String(content.offers?.freeShippingProgressTemplate || "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}."),
        unlockedText: String(content.offers?.freeShippingUnlockedText || "Free shipping applied."),
        summary: buildPromoGuideFallback(offerType).summary,
        example: buildPromoGuideFallback(offerType).example,
        multiOfferTip: buildPromoGuideFallback(offerType).multiOfferTip,
      }))
      .filter(Boolean);

    return derivedOptions.length > 0 ? derivedOptions : PROMO_CAMPAIGN_OPTIONS;
  }, [content.offers, dbPromoCampaigns, promoTemplates]);
  const promoModeLabel =
    promoCampaignOptions.find((option) => option.value === selectedPromoOffer)?.label ||
    (selectedPromoVariantIds.length > 0
      ? "Specific variants"
      : selectedPromoProductIds.length > 0
        ? "Selected products"
        : "No promo filter");
  const activePromoConfig =
    promoCampaignOptions.find((option) => option.value === selectedPromoOffer) ||
    promoCampaignOptions[0] ||
    normalizePromoTemplateOption({ value: selectedPromoOffer || "promo-group", label: toPromoLabel(selectedPromoOffer || "promo-group") });
  const defaultPromoOptions = promoCampaignOptions.filter(
    (option) => option.value !== "buy-x-get-y" || option.value === selectedPromoOffer
  );
  const showBundleRuleFields = promoDraft.campaignType === "buy-x-get-y" || ["buy_x_get_y", "bundle_fixed_total"].includes(promoDraft.discountType);
  const showBundleFreeFields = promoDraft.campaignType === "buy-x-get-y" || promoDraft.discountType === "buy_x_get_y";
  const selectedPromoTemplateMeta =
    promoCampaignOptions.find((option) => option.value === promoDraft.campaignType) ||
    promoCampaignOptions.find((option) => option.value === "promo-group") ||
    normalizePromoTemplateOption({ value: promoDraft.campaignType || "promo-group", label: toPromoLabel(promoDraft.campaignType || "promo-group") });
  const fallbackGuide = buildPromoGuideFallback(promoDraft.campaignType || "promo-group");
  const selectedPromoGuide = {
    summary: selectedPromoTemplateMeta?.summary || fallbackGuide.summary,
    example: selectedPromoTemplateMeta?.example || fallbackGuide.example,
    multiOfferTip: selectedPromoTemplateMeta?.multiOfferTip || fallbackGuide.multiOfferTip,
  };

  const updatePromoSelections = ({
    campaignType = selectedPromoOffer,
    category = selectedPromoCategory,
    productIds = selectedPromoProductIds,
    variantIds = selectedPromoVariantIds,
    threshold = content.offers.freeShippingThreshold
  }) => {
    updatePromoStrip(
      "to",
      buildPromoTargetUrl({
        campaignType,
        category,
        minPrice: threshold,
        productIds,
        variantIds
      })
    );
  };

  const clearPromoProducts = () => {
    updatePromoSelections({ productIds: [] });
  };

  const clearPromoVariants = () => {
    updatePromoSelections({ variantIds: [] });
  };

  const handlePromoOfferChange = (campaignType) => {
    const shouldUseGenericTarget = ["sale", "clearance-sale", "summer-sale", "free-shipping", "flash-sale", "happy-hour", "threshold-offer"].includes(campaignType);

    updatePromoSelections({
      campaignType,
      category: campaignType === "free-shipping" ? "" : selectedPromoCategory,
      productIds: shouldUseGenericTarget ? [] : selectedPromoProductIds,
      variantIds: shouldUseGenericTarget ? [] : selectedPromoVariantIds,
    });
  };

  const handlePromoCategoryChange = (category) => {
    updatePromoSelections({ category });
  };

  const togglePromoProduct = (productId) => {
    const normalizedProductId = normalizeChoiceId(productId);
    const nextProductIds = selectedPromoProductIds.includes(normalizedProductId)
      ? selectedPromoProductIds.filter((id) => id !== normalizedProductId)
      : [...selectedPromoProductIds, normalizedProductId];

    updatePromoSelections({ productIds: nextProductIds });
  };

  const togglePromoVariant = (variantId) => {
    const normalizedVariantId = normalizeChoiceId(variantId);
    const nextVariantIds = selectedPromoVariantIds.includes(normalizedVariantId)
      ? selectedPromoVariantIds.filter((id) => id !== normalizedVariantId)
      : [...selectedPromoVariantIds, normalizedVariantId];

    updatePromoSelections({ variantIds: nextVariantIds });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = await adminFetch("admin_site_content.php", {
        method: "POST",
        body: JSON.stringify({
          action: "upsert",
          settings: normalizedContent
        })
      });
      setContent(normalizedContent);
      setJsonDraft(JSON.stringify(normalizedContent, null, 2));
      if (Array.isArray(payload.promotions)) {
        setDbPromoCampaigns(payload.promotions);
      }
      setSuccess(
        Array.isArray(payload.syncedPromotionCodes) && payload.syncedPromotionCodes.length > 0
          ? `Site content saved and ${payload.syncedPromotionCodes.length} promo record(s) synced to the database.`
          : "Site content saved successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyJson = () => {
    setJsonError("");

    try {
      const parsed = JSON.parse(jsonDraft || "{}");
      setContent(normalizeSiteContent(parsed));
      setSuccess("JSON applied. Click Save Site Content to persist.");
    } catch (err) {
      setJsonError(err.message || "Invalid JSON");
    }
  };

  const handleRefreshJson = () => {
    setJsonDraft(JSON.stringify(normalizedContent, null, 2));
    setJsonError("");
  };

  if (loading) {
    return <p>Loading site content...</p>;
  }

  return (
    <section>
      <header className="admin-page-head">
        <h2>Site Content</h2>
        <p>Control branding, promo offers, navbar, footer links, and product-page copy from admin.</p>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {success && <p className="admin-success">{success}</p>}

      <div className="admin-card">
        <h3>Branding</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <input
            placeholder="Store name"
            value={content.brand.name}
            onChange={(e) => updateBrand("name", e.target.value)}
          />
          <input
            placeholder="Support email"
            value={content.brand.supportEmail}
            onChange={(e) => updateBrand("supportEmail", e.target.value)}
          />
          <input
            placeholder="Support phone"
            value={content.brand.supportPhone}
            onChange={(e) => updateBrand("supportPhone", e.target.value)}
          />
          <input
            placeholder="Support hours"
            value={content.brand.supportHours}
            onChange={(e) => updateBrand("supportHours", e.target.value)}
          />
          <textarea
            placeholder="Brand tagline"
            value={content.brand.tagline}
            onChange={(e) => updateBrand("tagline", e.target.value)}
          />
        </form>
      </div>

      <div className="admin-card">
        <h3>Default Store Offer</h3>
        <p className="admin-section-note">
          This is your safe fallback banner. It stays live unless a custom promo below is marked as primary during its active date window.
        </p>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <input
            placeholder="Promo text"
            value={content.offers.promoStrip.text}
            onChange={(e) => updatePromoStrip("text", e.target.value)}
          />
          <input
            placeholder="Promo target URL"
            value={content.offers.promoStrip.to}
            onChange={(e) => updatePromoStrip("to", e.target.value)}
          />
          <div className="admin-promo-shell">
            <aside className="admin-promo-sidebar">
              <div className="admin-promo-summary-card">
                <span className="admin-summary-label">Fallback mode</span>
                <strong>{promoModeLabel}</strong>
                <small>{content.offers.promoStrip.to || "/products"}</small>
              </div>
              <div className="admin-promo-live-preview">
                <span className="admin-summary-label">Storefront preview</span>
                <div className="admin-promo-preview-pill">
                  {editingPromoPreview.enabled ? "Fallback is ready" : "Fallback hidden"}
                </div>
                <strong>{editingPromoPreview?.text || "Add promo copy to preview it here"}</strong>
                <small>Shoppers land on: {editingPromoPreview?.to || "/products"}</small>
                {livePromoPreview?.sourceCampaignName && (
                  <small className="admin-picker-note">
                    Live override right now: {livePromoPreview.text} ({livePromoPreview.sourceCampaignName})
                  </small>
                )}
                <div className="admin-promo-defaults-grid">
                  <div className="admin-promo-default">
                    <span>Amount</span>
                    <strong>{activePromoConfig.defaultDiscount}</strong>
                  </div>
                  <div className="admin-promo-default">
                    <span>Tax</span>
                    <strong>{activePromoConfig.taxMode}</strong>
                  </div>
                  <div className="admin-promo-default">
                    <span>Delivery</span>
                    <strong>{activePromoConfig.shippingMode}</strong>
                  </div>
                </div>
              </div>
            </aside>

            <div className="admin-promo-main">
              <div className="admin-picker-panel">
                <div className="admin-picker-head">
                  <strong>Default offer setup</strong>
                  <span>Fallback only</span>
                </div>
                <p className="admin-picker-note">
                  Keep this simple for your regular always-on banner. Use <strong>Add Custom Promo</strong> below for limited-time deals or bundle campaigns like “Buy 2 T-shirts, get 1 free”.
                </p>
                <div className="admin-form-grid">
                  <label className="admin-field-stack">
                    <span>Default offer type</span>
                    <select value={selectedPromoOffer} onChange={(e) => handlePromoOfferChange(e.target.value)}>
                      {defaultPromoOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field-stack">
                    <span>Target category</span>
                    <select
                      value={selectedPromoCategory}
                      onChange={(e) => handlePromoCategoryChange(e.target.value)}
                      disabled={promoCategories.length === 0}
                    >
                      <option value="">All categories</option>
                      {promoCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label} ({category.count})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="admin-promo-summary-grid">
                  <div className="admin-promo-stat">
                    <span>Selected products</span>
                    <strong>{selectedPromoProductIds.length}</strong>
                  </div>
                  <div className="admin-promo-stat">
                    <span>Selected variants</span>
                    <strong>{selectedPromoVariantIds.length}</strong>
                  </div>
                  <div className="admin-promo-stat">
                    <span>Target category</span>
                    <strong>{selectedPromoCategory || "All"}</strong>
                  </div>
                </div>

                {selectedPromoProductIds.length > 0 || selectedPromoVariantIds.length > 0 ? (
                  <div className="admin-promo-warning">
                    <strong>Specific product targeting is still attached to this fallback banner.</strong>
                    <span>Clear it here if you want the default offer to stay generic and use custom promos for product-level campaigns instead.</span>
                    <div className="admin-promo-actions">
                      <button type="button" onClick={clearPromoProducts} disabled={selectedPromoProductIds.length === 0}>
                        Clear products
                      </button>
                      <button type="button" onClick={clearPromoVariants} disabled={selectedPromoVariantIds.length === 0}>
                        Clear variants
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-promo-note-box">
                    <strong>Recommended:</strong>
                    <span>
                      Use this fallback for your normal hardcoded/default offer. Custom promos stay separate unless you explicitly mark them as primary.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {selectedPromoOffer === "free-shipping" && (
            <>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Storewide free shipping threshold"
                value={content.offers.freeShippingThreshold}
                onChange={(e) => updateOffer("freeShippingThreshold", Number(e.target.value || 0))}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Storewide shipping fee"
                value={content.offers.standardShippingFee}
                onChange={(e) => updateOffer("standardShippingFee", Number(e.target.value || 0))}
              />
              <input
                placeholder="Free shipping progress template"
                value={content.offers.freeShippingProgressTemplate}
                onChange={(e) => updateOffer("freeShippingProgressTemplate", e.target.value)}
              />
              <input
                placeholder="Free shipping unlocked text"
                value={content.offers.freeShippingUnlockedText}
                onChange={(e) => updateOffer("freeShippingUnlockedText", e.target.value)}
              />
            </>
          )}
          {selectedPromoOffer !== "free-shipping" && (
            <p className="admin-section-note" style={{ gridColumn: "1 / -1" }}>
              This promo uses your existing catalog prices. Shipping threshold and shipping fee are only used for Free Shipping promos.
            </p>
          )}
          <label className="admin-inline-check">
            <input
              type="checkbox"
              checked={content.offers.promoStrip.enabled}
              onChange={(e) => updatePromoStrip("enabled", e.target.checked)}
            />
            Enable promo strip
          </label>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar admin-promo-offers-head">
          <div>
            <h3>Custom Promo Offers</h3>
            <p className="admin-section-note">
              Use this section for seasonal, category, or bundle deals. Your default store offer above stays untouched unless you mark a promo as primary.
            </p>
          </div>
          <button type="button" onClick={openCreatePromoModal}>Add Custom Promo</button>
        </div>

        <div className="admin-promo-summary-grid">
          <div className="admin-promo-stat">
            <span>Total promos</span>
            <strong>{promoCampaigns.length}</strong>
          </div>
          <div className="admin-promo-stat">
            <span>Active now</span>
            <strong>{activeScheduledPromos.length}</strong>
          </div>
          <div className="admin-promo-stat">
            <span>Queued / draft</span>
            <strong>{scheduledPromoCount}</strong>
          </div>
          <div className="admin-promo-stat">
            <span>Stackable offers</span>
            <strong>{stackablePromoCount}</strong>
          </div>
          <div className="admin-promo-stat">
            <span>Primary promo</span>
            <strong>{livePrimaryPromo?.name || "No active promo"}</strong>
          </div>
        </div>

        <div className="admin-promo-note-box" style={{ marginBottom: 12 }}>
          <strong>How multiple offers work</strong>
          <span>
            Promotions are ordered by <strong>priority</strong>. Mark a campaign as <strong>stackable</strong> if it should combine with other eligible offers. Use <strong>display mode</strong> to choose banner only, pricing only, or both.
          </span>
        </div>

        {promoCampaigns.length === 0 ? (
          <p className="admin-picker-empty">No scheduled promo offers yet. Add one to automate promo launch windows.</p>
        ) : (
          <div className="admin-promo-offers-list">
            {promoCampaigns.map((campaign) => {
              const runtimeStatus = campaign.runtime_status || campaign.status;
              const statusMeta = getPromoStatusMeta(runtimeStatus);
              return (
                <article key={campaign.id} className="admin-promo-offer-item">
                  <div className="admin-promo-offer-copy">
                    <div className="admin-promo-offer-headline">
                      <strong>{campaign.name}</strong>
                      <span className={`admin-status-badge ${statusMeta.className}`}>{statusMeta.label}</span>
                      {campaign.is_primary && <span className="admin-status-badge admin-status-primary">Primary strip</span>}
                      <span className="admin-promo-offer-chip">{promoCampaignOptions.find((option) => option.value === (campaign.conditions?.offerType || campaign.campaignType))?.label || "Custom promo"}</span>
                      <span className="admin-promo-offer-chip">{getDisplayModeLabel(campaign.display_mode || campaign.displayMode)}</span>
                      {campaign.actions?.stackable && <span className="admin-promo-offer-chip">Stackable</span>}
                      <span className="admin-promo-offer-chip">Priority {campaign.priority || 100}</span>
                    </div>
                    <p>{campaign.banner_text || campaign.text}</p>
                    <div className="admin-promo-offer-meta">
                      <small><strong>Rule:</strong> {getPromoActionSummary(campaign)}</small>
                      <small><strong>Target:</strong> {getPromoScopeSummary(campaign)}</small>
                      <small><strong>Start:</strong> {formatPromoDateValue(campaign.start_date || campaign.startAt, "Immediate")}</small>
                      <small><strong>End:</strong> {formatPromoDateValue(campaign.end_date || campaign.endAt, "No end date")}</small>
                      <small><strong>Window:</strong> {formatPromoSchedule(campaign.start_date || campaign.startAt, campaign.end_date || campaign.endAt)}</small>
                    </div>
                    <small className="admin-promo-offer-target">{campaign.target_url || campaign.to}</small>
                  </div>
                  <div className="admin-promo-offer-actions">
                    <button type="button" className="admin-secondary-btn" onClick={() => openEditPromoModal(campaign)}>
                      Edit
                    </button>
                    <button type="button" className="admin-danger-btn" onClick={() => deletePromoCampaign(campaign.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <h3>Navbar Links</h3>
          <button type="button" onClick={addNavItem}>Add Link</button>
        </div>
        <div className="admin-stack">
          {content.navbar.links.map((item, index) => (
            <div className="admin-row-card" key={item.id}>
              <input
                value={item.label}
                onChange={(e) => updateNavItem(index, "label", e.target.value)}
                placeholder="Label"
              />
              <input
                value={item.to}
                onChange={(e) => updateNavItem(index, "to", e.target.value)}
                placeholder="Path or URL"
              />
              <label className="admin-inline-check">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => updateNavItem(index, "enabled", e.target.checked)}
                />
                Enabled
              </label>
              <label className="admin-inline-check">
                <input
                  type="checkbox"
                  checked={item.requiresAuth}
                  onChange={(e) => updateNavItem(index, "requiresAuth", e.target.checked)}
                />
                Login required
              </label>
              <label className="admin-inline-check">
                <input
                  type="checkbox"
                  checked={item.adminOnly}
                  onChange={(e) => updateNavItem(index, "adminOnly", e.target.checked)}
                />
                Admin only
              </label>
              <button type="button" className="admin-danger" onClick={() => deleteNavItem(index)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <h3>Footer Sections</h3>
          <button type="button" onClick={addFooterSection}>Add Section</button>
        </div>

        <div className="admin-stack">
          {content.footer.sections.map((section, sectionIndex) => (
            <div className="admin-section-card" key={section.id}>
              <div className="admin-toolbar">
                <input
                  value={section.title}
                  onChange={(e) => updateFooterSectionTitle(sectionIndex, e.target.value)}
                  placeholder="Section title"
                />
                <button type="button" onClick={() => addFooterLink(sectionIndex)}>Add Link</button>
                <button type="button" className="admin-danger" onClick={() => deleteFooterSection(sectionIndex)}>
                  Delete Section
                </button>
              </div>

              <div className="admin-stack">
                {section.links.map((link, linkIndex) => (
                  <div className="admin-row-card" key={link.id}>
                    <input
                      value={link.label}
                      onChange={(e) => updateFooterLink(sectionIndex, linkIndex, "label", e.target.value)}
                      placeholder="Link label"
                    />
                    <input
                      value={link.to}
                      onChange={(e) => updateFooterLink(sectionIndex, linkIndex, "to", e.target.value)}
                      placeholder="Path or URL"
                    />
                    <select
                      value={link.type}
                      onChange={(e) => updateFooterLink(sectionIndex, linkIndex, "type", e.target.value)}
                    >
                      <option value="internal">Internal</option>
                      <option value="external">External</option>
                    </select>
                    <button
                      type="button"
                      className="admin-danger"
                      onClick={() => deleteFooterLink(sectionIndex, linkIndex)}
                    >
                      Delete Link
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="admin-form-grid" style={{ marginTop: 12 }}>
          <input
            placeholder="Payment badges (comma separated)"
            value={content.footer.paymentBadges.join(", ")}
            onChange={(e) => updatePaymentBadges(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-card">
        <h3>Checkout Settings</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <input
            placeholder="Payment section title"
            value={content.checkout.paymentSectionTitle}
            onChange={(e) => updateCheckoutConfig("paymentSectionTitle", e.target.value)}
          />
          <input
            placeholder="Mock gateway note"
            value={content.checkout.gatewayNoteMock}
            onChange={(e) => updateCheckoutConfig("gatewayNoteMock", e.target.value)}
          />
          <input
            placeholder="Sandbox gateway note"
            value={content.checkout.gatewayNoteSandbox}
            onChange={(e) => updateCheckoutConfig("gatewayNoteSandbox", e.target.value)}
          />
          <input
            placeholder="Place order button label"
            value={content.checkout.placeOrderLabel}
            onChange={(e) => updateCheckoutConfig("placeOrderLabel", e.target.value)}
          />
          <input
            placeholder="Placing order label"
            value={content.checkout.placingOrderLabel}
            onChange={(e) => updateCheckoutConfig("placingOrderLabel", e.target.value)}
          />
          <input
            placeholder="Selected payment prefix"
            value={content.checkout.selectedPaymentPrefix}
            onChange={(e) => updateCheckoutConfig("selectedPaymentPrefix", e.target.value)}
          />
        </form>

        <div className="admin-stack" style={{ marginTop: 12 }}>
          {content.checkout.paymentMethods.map((method) => (
            <div className="admin-row-card" key={method.id}>
              <input
                value={method.label}
                onChange={(e) => updateCheckoutMethod(method.id, "label", e.target.value)}
                placeholder="Method label"
              />
              <input value={method.id.toUpperCase()} disabled />
              <label className="admin-inline-check">
                <input
                  type="checkbox"
                  checked={method.enabled}
                  onChange={(e) => updateCheckoutMethod(method.id, "enabled", e.target.checked)}
                />
                Enabled
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <h3>Checkout Guest Upsell Copy</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <input
            placeholder="Upsell title"
            value={content.checkout.guestUpsell.title}
            onChange={(e) => updateCheckoutGuestUpsell("title", e.target.value)}
          />
          <input
            placeholder="Upsell body template ({coupon})"
            value={content.checkout.guestUpsell.bodyTemplate}
            onChange={(e) => updateCheckoutGuestUpsell("bodyTemplate", e.target.value)}
          />
          <input
            placeholder="Reward code label"
            value={content.checkout.guestUpsell.rewardCodeLabel}
            onChange={(e) => updateCheckoutGuestUpsell("rewardCodeLabel", e.target.value)}
          />
          <input
            placeholder="Email template ({email})"
            value={content.checkout.guestUpsell.emailTemplate}
            onChange={(e) => updateCheckoutGuestUpsell("emailTemplate", e.target.value)}
          />
          <input
            placeholder="Support template ({email}, {orderId})"
            value={content.checkout.guestUpsell.supportTemplate}
            onChange={(e) => updateCheckoutGuestUpsell("supportTemplate", e.target.value)}
          />
          <input
            placeholder="Upsell button label"
            value={content.checkout.guestUpsell.ctaLabel}
            onChange={(e) => updateCheckoutGuestUpsell("ctaLabel", e.target.value)}
          />
        </form>
      </div>

      <div className="admin-card">
        <h3>Cart Page Copy</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <input placeholder="Cart title" value={content.cartPage.title} onChange={(e) => updateCartPageText("title", e.target.value)} />
          <input placeholder="Loading text" value={content.cartPage.loadingText} onChange={(e) => updateCartPageText("loadingText", e.target.value)} />
          <input placeholder="Empty title" value={content.cartPage.emptyTitle} onChange={(e) => updateCartPageText("emptyTitle", e.target.value)} />
          <input placeholder="Empty description" value={content.cartPage.emptyDescription} onChange={(e) => updateCartPageText("emptyDescription", e.target.value)} />
          <input placeholder="Continue shopping label" value={content.cartPage.continueShoppingLabel} onChange={(e) => updateCartPageText("continueShoppingLabel", e.target.value)} />
          <input placeholder="Summary title" value={content.cartPage.summaryTitle} onChange={(e) => updateCartPageText("summaryTitle", e.target.value)} />
          <input placeholder="Subtotal label" value={content.cartPage.subtotalLabel} onChange={(e) => updateCartPageText("subtotalLabel", e.target.value)} />
          <input placeholder="Shipping label" value={content.cartPage.shippingLabel} onChange={(e) => updateCartPageText("shippingLabel", e.target.value)} />
          <input placeholder="Total label" value={content.cartPage.totalLabel} onChange={(e) => updateCartPageText("totalLabel", e.target.value)} />
          <input placeholder="Checkout button label" value={content.cartPage.checkoutLabel} onChange={(e) => updateCartPageText("checkoutLabel", e.target.value)} />
        </form>
      </div>

      <div className="admin-card">
        <h3>Guest Order Tracking Copy</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <input placeholder="Page title" value={content.guestOrderTrackPage.title} onChange={(e) => updateGuestOrderTrackText("title", e.target.value)} />
          <input placeholder="Description" value={content.guestOrderTrackPage.description} onChange={(e) => updateGuestOrderTrackText("description", e.target.value)} />
          <input placeholder="Order number label" value={content.guestOrderTrackPage.orderNumberLabel} onChange={(e) => updateGuestOrderTrackText("orderNumberLabel", e.target.value)} />
          <input placeholder="Order number placeholder" value={content.guestOrderTrackPage.orderNumberPlaceholder} onChange={(e) => updateGuestOrderTrackText("orderNumberPlaceholder", e.target.value)} />
          <input placeholder="Email label" value={content.guestOrderTrackPage.emailLabel} onChange={(e) => updateGuestOrderTrackText("emailLabel", e.target.value)} />
          <input placeholder="Email placeholder" value={content.guestOrderTrackPage.emailPlaceholder} onChange={(e) => updateGuestOrderTrackText("emailPlaceholder", e.target.value)} />
          <input placeholder="Submit label" value={content.guestOrderTrackPage.submitLabel} onChange={(e) => updateGuestOrderTrackText("submitLabel", e.target.value)} />
          <input placeholder="Submit loading label" value={content.guestOrderTrackPage.submitLoadingLabel} onChange={(e) => updateGuestOrderTrackText("submitLoadingLabel", e.target.value)} />
          <input placeholder="Summary title" value={content.guestOrderTrackPage.summaryTitle} onChange={(e) => updateGuestOrderTrackText("summaryTitle", e.target.value)} />
          <input placeholder="Status label" value={content.guestOrderTrackPage.statusLabel} onChange={(e) => updateGuestOrderTrackText("statusLabel", e.target.value)} />
          <input placeholder="Payment label" value={content.guestOrderTrackPage.paymentLabel} onChange={(e) => updateGuestOrderTrackText("paymentLabel", e.target.value)} />
          <input placeholder="Total label" value={content.guestOrderTrackPage.totalLabel} onChange={(e) => updateGuestOrderTrackText("totalLabel", e.target.value)} />
          <input placeholder="Placed label" value={content.guestOrderTrackPage.placedLabel} onChange={(e) => updateGuestOrderTrackText("placedLabel", e.target.value)} />
          <input placeholder="Items title" value={content.guestOrderTrackPage.itemsTitle} onChange={(e) => updateGuestOrderTrackText("itemsTitle", e.target.value)} />
          <input placeholder="Updates title" value={content.guestOrderTrackPage.updatesTitle} onChange={(e) => updateGuestOrderTrackText("updatesTitle", e.target.value)} />
        </form>
      </div>

      <div className="admin-card">
        <h3>Order Confirmation Copy</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <input placeholder="Missing details title" value={content.confirmationPage.missingTitle} onChange={(e) => updateConfirmationPageText("missingTitle", e.target.value)} />
          <input placeholder="Missing details description" value={content.confirmationPage.missingDescription} onChange={(e) => updateConfirmationPageText("missingDescription", e.target.value)} />
          <input placeholder="Success title" value={content.confirmationPage.successTitle} onChange={(e) => updateConfirmationPageText("successTitle", e.target.value)} />
          <input placeholder="Order ID label" value={content.confirmationPage.orderIdLabel} onChange={(e) => updateConfirmationPageText("orderIdLabel", e.target.value)} />
          <input placeholder="Order number label" value={content.confirmationPage.orderNumberLabel} onChange={(e) => updateConfirmationPageText("orderNumberLabel", e.target.value)} />
          <input placeholder="Total paid label" value={content.confirmationPage.totalPaidLabel} onChange={(e) => updateConfirmationPageText("totalPaidLabel", e.target.value)} />
          <input placeholder="Payment method label" value={content.confirmationPage.paymentMethodLabel} onChange={(e) => updateConfirmationPageText("paymentMethodLabel", e.target.value)} />
          <input placeholder="Gateway label" value={content.confirmationPage.gatewayLabel} onChange={(e) => updateConfirmationPageText("gatewayLabel", e.target.value)} />
          <input placeholder="Shipping address label" value={content.confirmationPage.shippingAddressLabel} onChange={(e) => updateConfirmationPageText("shippingAddressLabel", e.target.value)} />
          <input placeholder="Gateway reference title" value={content.confirmationPage.gatewayReferenceTitle} onChange={(e) => updateConfirmationPageText("gatewayReferenceTitle", e.target.value)} />
          <input placeholder="Gateway order ID label" value={content.confirmationPage.gatewayOrderIdLabel} onChange={(e) => updateConfirmationPageText("gatewayOrderIdLabel", e.target.value)} />
          <input placeholder="Gateway payment ID label" value={content.confirmationPage.gatewayPaymentIdLabel} onChange={(e) => updateConfirmationPageText("gatewayPaymentIdLabel", e.target.value)} />
          <input placeholder="Gateway signature label" value={content.confirmationPage.gatewaySignatureLabel} onChange={(e) => updateConfirmationPageText("gatewaySignatureLabel", e.target.value)} />
          <input placeholder="Items title" value={content.confirmationPage.itemsTitle} onChange={(e) => updateConfirmationPageText("itemsTitle", e.target.value)} />
          <input placeholder="Guest confirmed title" value={content.confirmationPage.guestConfirmedTitle} onChange={(e) => updateConfirmationPageText("guestConfirmedTitle", e.target.value)} />
          <input placeholder="Guest tracking template ({email}, {orderId})" value={content.confirmationPage.guestTrackingTemplate} onChange={(e) => updateConfirmationPageText("guestTrackingTemplate", e.target.value)} />
          <input placeholder="View orders label" value={content.confirmationPage.viewOrdersLabel} onChange={(e) => updateConfirmationPageText("viewOrdersLabel", e.target.value)} />
          <input placeholder="Continue shopping label" value={content.confirmationPage.continueShoppingLabel} onChange={(e) => updateConfirmationPageText("continueShoppingLabel", e.target.value)} />
        </form>
      </div>

      <div className="admin-card">
        <h3>Products Page Copy</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <input
            placeholder="Hero kicker"
            value={content.productsPage.heroKicker}
            onChange={(e) => updateProductPageText("heroKicker", e.target.value)}
          />
          <input
            placeholder="Hero title"
            value={content.productsPage.heroTitle}
            onChange={(e) => updateProductPageText("heroTitle", e.target.value)}
          />
          <textarea
            placeholder="Hero description"
            value={content.productsPage.heroDescription}
            onChange={(e) => updateProductPageText("heroDescription", e.target.value)}
          />
          <input
            placeholder="Free shipping chip template"
            value={content.productsPage.freeShippingLabelTemplate}
            onChange={(e) => updateProductPageText("freeShippingLabelTemplate", e.target.value)}
          />
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <h3>Home Hero Banners</h3>
          <button type="button" onClick={addHomeHeroSlide}>Add Banner</button>
        </div>

        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <input
            placeholder="Homepage announcement"
            value={content.homePage.announcement}
            onChange={(e) => updateHomePage("announcement", e.target.value)}
          />
          <input
            placeholder="Trust badges (comma separated)"
            value={content.homePage.trustBadges.join(", ")}
            onChange={(e) => updateHomeTrustBadges(e.target.value)}
          />
        </form>

        <div className="admin-stack" style={{ marginTop: 12 }}>
          {content.homePage.heroSlides.map((slide, index) => (
            <div className="admin-section-card" key={slide.id}>
              <div className="admin-toolbar">
                <strong>Banner {index + 1}</strong>
                <button type="button" className="admin-danger" onClick={() => deleteHomeHeroSlide(index)}>
                  Delete Banner
                </button>
              </div>
              <div className="admin-form-grid">
                <input
                  placeholder="Title"
                  value={slide.title}
                  onChange={(e) => updateHomeHeroSlide(index, "title", e.target.value)}
                />
                <input
                  placeholder="Subtitle"
                  value={slide.subtitle}
                  onChange={(e) => updateHomeHeroSlide(index, "subtitle", e.target.value)}
                />
                <input
                  placeholder="Banner image URL"
                  value={slide.image}
                  onChange={(e) => updateHomeHeroSlide(index, "image", e.target.value)}
                />
                <input
                  placeholder="CTA label"
                  value={slide.ctaLabel}
                  onChange={(e) => updateHomeHeroSlide(index, "ctaLabel", e.target.value)}
                />
                <input
                  placeholder="CTA link"
                  value={slide.ctaTo}
                  onChange={(e) => updateHomeHeroSlide(index, "ctaTo", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <h3>Home Category Tiles</h3>
          <button type="button" onClick={addHomeCategory}>Add Category Tile</button>
        </div>

        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()} style={{ marginBottom: 12 }}>
          <input
            placeholder="Section kicker"
            value={content.homePage.categorySection.kicker}
            onChange={(e) => updateHomePageSection("categorySection", "kicker", e.target.value)}
          />
          <input
            placeholder="Section title"
            value={content.homePage.categorySection.title}
            onChange={(e) => updateHomePageSection("categorySection", "title", e.target.value)}
          />
          <input
            placeholder="Header CTA label"
            value={content.homePage.categorySection.ctaLabel}
            onChange={(e) => updateHomePageSection("categorySection", "ctaLabel", e.target.value)}
          />
          <input
            placeholder="Tile CTA label"
            value={content.homePage.categorySection.tileCtaLabel}
            onChange={(e) => updateHomePageSection("categorySection", "tileCtaLabel", e.target.value)}
          />
        </form>

        <div className="admin-stack">
          {content.homePage.primaryCategories.map((category, index) => (
            <div className="admin-section-card" key={category.id}>
              <div className="admin-toolbar">
                <strong>Category Tile {index + 1}</strong>
                <button type="button" className="admin-danger" onClick={() => deleteHomeCategory(index)}>
                  Delete Tile
                </button>
              </div>
              <div className="admin-form-grid">
                <input
                  placeholder="Label"
                  value={category.label}
                  onChange={(e) => updateHomeCategory(index, "label", e.target.value)}
                />
                <input
                  placeholder="Destination URL"
                  value={category.to}
                  onChange={(e) => updateHomeCategory(index, "to", e.target.value)}
                />
                <input
                  placeholder="Image URL"
                  value={category.image}
                  onChange={(e) => updateHomeCategory(index, "image", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <h3>Home Campaign Cards</h3>
          <button type="button" onClick={addSpotlightCard}>Add Campaign Card</button>
        </div>

        <div className="admin-stack">
          {content.homePage.spotlightCards.map((card, index) => (
            <div className="admin-section-card" key={card.id}>
              <div className="admin-toolbar">
                <strong>Campaign Card {index + 1}</strong>
                <button type="button" className="admin-danger" onClick={() => deleteSpotlightCard(index)}>
                  Delete Card
                </button>
              </div>

              <div className="admin-form-grid">
                <input
                  placeholder="Title"
                  value={card.title}
                  onChange={(e) => updateSpotlightCard(index, "title", e.target.value)}
                />
                <input
                  placeholder="Subtitle"
                  value={card.subtitle}
                  onChange={(e) => updateSpotlightCard(index, "subtitle", e.target.value)}
                />
                <input
                  placeholder="Destination URL"
                  value={card.to}
                  onChange={(e) => updateSpotlightCard(index, "to", e.target.value)}
                />
                <select
                  value={card.tone || "warm"}
                  onChange={(e) => updateSpotlightCard(index, "tone", e.target.value)}
                >
                  <option value="warm">Warm</option>
                  <option value="mint">Mint</option>
                  <option value="sky">Sky</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <h3>Homepage Section Copy</h3>

        <div className="admin-stack">
          <div className="admin-section-card">
            <strong>Deal Banners</strong>
            <div className="admin-form-grid" style={{ marginTop: 12 }}>
              <input
                placeholder="Primary banner kicker"
                value={content.homePage.dealBanners.primaryKicker}
                onChange={(e) => updateHomePageSection("dealBanners", "primaryKicker", e.target.value)}
              />
              <input
                placeholder="Primary banner CTA"
                value={content.homePage.dealBanners.primaryCtaLabel}
                onChange={(e) => updateHomePageSection("dealBanners", "primaryCtaLabel", e.target.value)}
              />
              <input
                placeholder="Secondary banner kicker"
                value={content.homePage.dealBanners.secondaryKicker}
                onChange={(e) => updateHomePageSection("dealBanners", "secondaryKicker", e.target.value)}
              />
              <input
                placeholder="Secondary banner CTA"
                value={content.homePage.dealBanners.secondaryCtaLabel}
                onChange={(e) => updateHomePageSection("dealBanners", "secondaryCtaLabel", e.target.value)}
              />
            </div>
          </div>

          <div className="admin-section-card">
            <strong>Featured Section</strong>
            <div className="admin-form-grid" style={{ marginTop: 12 }}>
              <input
                placeholder="Featured kicker"
                value={content.homePage.featuredSection.kicker}
                onChange={(e) => updateHomePageSection("featuredSection", "kicker", e.target.value)}
              />
              <input
                placeholder="Featured title"
                value={content.homePage.featuredSection.title}
                onChange={(e) => updateHomePageSection("featuredSection", "title", e.target.value)}
              />
              <input
                placeholder="Featured CTA label"
                value={content.homePage.featuredSection.ctaLabel}
                onChange={(e) => updateHomePageSection("featuredSection", "ctaLabel", e.target.value)}
              />
            </div>
          </div>

          <div className="admin-section-card">
            <strong>Top Selling Section</strong>
            <div className="admin-form-grid" style={{ marginTop: 12 }}>
              <input
                placeholder="Top selling kicker"
                value={content.homePage.topSellingSection.kicker}
                onChange={(e) => updateHomePageSection("topSellingSection", "kicker", e.target.value)}
              />
              <input
                placeholder="Top selling title"
                value={content.homePage.topSellingSection.title}
                onChange={(e) => updateHomePageSection("topSellingSection", "title", e.target.value)}
              />
              <input
                placeholder="Top selling CTA label"
                value={content.homePage.topSellingSection.ctaLabel}
                onChange={(e) => updateHomePageSection("topSellingSection", "ctaLabel", e.target.value)}
              />
              <input
                placeholder="Rating template ({rating}, {count})"
                value={content.homePage.topSellingSection.ratingTemplate}
                onChange={(e) => updateHomePageSection("topSellingSection", "ratingTemplate", e.target.value)}
              />
            </div>
          </div>

          <div className="admin-section-card">
            <strong>New Arrivals Section</strong>
            <div className="admin-form-grid" style={{ marginTop: 12 }}>
              <input
                placeholder="New arrivals kicker"
                value={content.homePage.newArrivalsSection.kicker}
                onChange={(e) => updateHomePageSection("newArrivalsSection", "kicker", e.target.value)}
              />
              <input
                placeholder="New arrivals title"
                value={content.homePage.newArrivalsSection.title}
                onChange={(e) => updateHomePageSection("newArrivalsSection", "title", e.target.value)}
              />
              <input
                placeholder="New arrivals CTA label"
                value={content.homePage.newArrivalsSection.ctaLabel}
                onChange={(e) => updateHomePageSection("newArrivalsSection", "ctaLabel", e.target.value)}
              />
            </div>
          </div>

          <div className="admin-section-card">
            <strong>Reviews Section</strong>
            <div className="admin-form-grid" style={{ marginTop: 12 }}>
              <input
                placeholder="Reviews kicker"
                value={content.homePage.reviewsSection.kicker}
                onChange={(e) => updateHomePageSection("reviewsSection", "kicker", e.target.value)}
              />
              <input
                placeholder="Reviews title"
                value={content.homePage.reviewsSection.title}
                onChange={(e) => updateHomePageSection("reviewsSection", "title", e.target.value)}
              />
              <input
                placeholder="Reviews CTA label"
                value={content.homePage.reviewsSection.ctaLabel}
                onChange={(e) => updateHomePageSection("reviewsSection", "ctaLabel", e.target.value)}
              />
              <input
                placeholder="Product link prefix"
                value={content.homePage.reviewsSection.productPrefix}
                onChange={(e) => updateHomePageSection("reviewsSection", "productPrefix", e.target.value)}
              />
              <input
                placeholder="Empty reviews text"
                value={content.homePage.reviewsSection.emptyText}
                onChange={(e) => updateHomePageSection("reviewsSection", "emptyText", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3>Advanced Site Content JSON</h3>
        <p style={{ marginTop: 0 }}>Use this for any visible text not covered by the form fields above.</p>
        <textarea
          value={jsonDraft}
          onChange={(e) => setJsonDraft(e.target.value)}
          style={{ width: "100%", minHeight: 280, fontFamily: "monospace", fontSize: 12 }}
        />
        {jsonError && <p className="admin-error">{jsonError}</p>}
        <div className="admin-toolbar" style={{ marginTop: 10 }}>
          <button type="button" onClick={handleApplyJson}>Apply JSON</button>
          <button type="button" onClick={handleRefreshJson}>Refresh From Form</button>
        </div>
      </div>

      {isPromoModalOpen && (
        <div className="admin-modal-backdrop" role="presentation" onClick={closePromoModal}>
          <div className="admin-modal-card" role="dialog" aria-modal="true" aria-labelledby="promo-offer-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="admin-toolbar">
              <h3 id="promo-offer-modal-title">{promoModalMode === "edit" ? "Edit Promo Offer" : "Add Promo Offer"}</h3>
              <button type="button" className="admin-secondary-btn" onClick={closePromoModal}>Close</button>
            </div>
            <p className="admin-section-note" style={{ marginTop: 0 }}>
              This form writes directly to the `promotions` table. By default it will <strong>not</strong> replace your fallback store offer — only promos marked as primary can take over the storefront strip while active.
            </p>
            <div className="admin-form-grid admin-modal-grid">
              <label className="admin-field-stack">
                <span>Promo name</span>
                <input
                  placeholder="Internal promo name"
                  value={promoDraft.name}
                  onChange={(e) => updatePromoDraft("name", e.target.value)}
                />
              </label>
              <div className="admin-field-stack" style={{ gridColumn: "1 / -1" }}>
                <span>Offer template</span>
                <div className="admin-promo-template-grid">
                  {promoCampaignOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`admin-promo-template ${promoDraft.campaignType === option.value ? "is-active" : ""}`}
                      onClick={() => updatePromoDraft("campaignType", option.value)}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </button>
                  ))}
                </div>
              </div>
              <label className="admin-field-stack" style={{ gridColumn: "1 / -1" }}>
                <span>Promo text</span>
                <textarea
                  placeholder="Promo strip text shoppers will see"
                  value={promoDraft.text}
                  onChange={(e) => updatePromoDraft("text", e.target.value)}
                />
              </label>
              <label className="admin-field-stack">
                <span>Target URL</span>
                <input
                  placeholder="Generated target URL"
                  value={promoDraft.to}
                  readOnly
                />
              </label>
              <label className="admin-field-stack">
                <span>Target category</span>
                <select
                  value={promoDraft.category}
                  onChange={(e) => updatePromoDraft("category", e.target.value)}
                >
                  <option value="">All categories</option>
                  {promoCategories.map((category) => (
                    <option key={`modal-category-${category.id}`} value={category.id}>
                      {category.label} ({category.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field-stack">
                <span>Minimum cart total (optional)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Minimum cart total"
                  value={promoDraft.minCartSubtotal}
                  onChange={(e) => updatePromoDraft("minCartSubtotal", e.target.value)}
                />
              </label>
              <label className="admin-field-stack">
                <span>Reward type</span>
                <select
                  value={promoDraft.discountType}
                  onChange={(e) => updatePromoDraft("discountType", e.target.value)}
                >
                  <option value="">Use default for this promo type</option>
                  <option value="percent">Percentage off</option>
                  <option value="fixed">Flat Rs. off</option>
                  <option value="threshold_fixed">Spend ₹X, get ₹Y off</option>
                  <option value="threshold_percent">Spend ₹X, get % off</option>
                  <option value="buy_x_get_y">Buy X Get Y free</option>
                  <option value="bundle_fixed_total">Buy N for fixed total</option>
                  <option value="flash_sale">Flash sale (time-based)</option>
                  <option value="happy_hour">Happy hour (time-based)</option>
                  <option value="none">Banner only / no price cut</option>
                </select>
                {[
                  "threshold_fixed",
                  "threshold_percent"
                ].includes(promoDraft.discountType) && (
                  <small>Use the minimum cart total field above for offers like “Spend ₹2000, get ₹200 off”.</small>
                )}
                {[
                  "flash_sale",
                  "happy_hour"
                ].includes(promoDraft.discountType) && (
                  <small>This reward becomes active only during the start/end time window below.</small>
                )}
              </label>
              <label className="admin-field-stack">
                <span>{promoDraft.discountType === "bundle_fixed_total" ? "Bundle total price" : promoDraft.discountType === "threshold_fixed" ? "Discount after threshold" : "Discount value"}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={promoDraft.discountType === "bundle_fixed_total" ? "Example: 700 for the bundle" : promoDraft.discountType === "threshold_fixed" ? "Example: 200 off after threshold" : promoDraft.discountType === "threshold_percent" ? "Example: 10% after threshold" : "Discount amount"}
                  value={promoDraft.discountValue}
                  onChange={(e) => updatePromoDraft("discountValue", e.target.value)}
                  disabled={showBundleFreeFields || promoDraft.discountType === "none"}
                />
              </label>
              {showBundleRuleFields && (
                <>
                  <label className="admin-field-stack">
                    <span>Buy quantity</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={promoDraft.buyQuantity}
                      onChange={(e) => updatePromoDraft("buyQuantity", e.target.value)}
                    />
                  </label>
                  {showBundleFreeFields && (
                    <label className="admin-field-stack">
                      <span>Free quantity</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={promoDraft.freeQuantity}
                        onChange={(e) => updatePromoDraft("freeQuantity", e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
              <label className="admin-field-stack">
                <span>Start date & time</span>
                <input
                  type="datetime-local"
                  value={promoDraft.startAt}
                  onChange={(e) => updatePromoDraft("startAt", e.target.value)}
                />
              </label>
              <label className="admin-field-stack">
                <span>End date & time</span>
                <input
                  type="datetime-local"
                  value={promoDraft.endAt}
                  onChange={(e) => updatePromoDraft("endAt", e.target.value)}
                />
              </label>
              <label className="admin-field-stack">
                <span>Priority</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Priority"
                  value={promoDraft.priority}
                  onChange={(e) => updatePromoDraft("priority", e.target.value)}
                />
              </label>
              <label className="admin-field-stack">
                <span>Display mode</span>
                <select
                  value={promoDraft.displayMode}
                  onChange={(e) => updatePromoDraft("displayMode", e.target.value)}
                >
                  {DISPLAY_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field-stack">
                <span>Status</span>
                <select
                  value={promoDraft.status}
                  onChange={(e) => updatePromoDraft("status", e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <div className="admin-promo-note-box" style={{ gridColumn: "1 / -1" }}>
                <strong>{promoCampaignOptions.find((option) => option.value === promoDraft.campaignType)?.label || "Custom promo"}</strong>
                <span>{selectedPromoGuide.summary}</span>
                <span>{selectedPromoGuide.example}</span>
                <span>{selectedPromoGuide.multiOfferTip}</span>
              </div>
              <label className="admin-inline-check">
                <input
                  type="checkbox"
                  checked={promoDraft.enabled}
                  onChange={(e) => updatePromoDraft("enabled", e.target.checked)}
                />
                Enabled
              </label>
              <label className="admin-inline-check">
                <input
                  type="checkbox"
                  checked={promoDraft.stackable}
                  onChange={(e) => updatePromoDraft("stackable", e.target.checked)}
                />
                Allow this promo to stack with others
              </label>
              <label className="admin-inline-check">
                <input
                  type="checkbox"
                  checked={promoDraft.isPrimary}
                  onChange={(e) => updatePromoDraft("isPrimary", e.target.checked)}
                />
                Use as primary promo strip when active
              </label>
              <label className="admin-inline-check">
                <input
                  type="checkbox"
                  checked={promoDraft.freeShipping}
                  onChange={(e) => updatePromoDraft("freeShipping", e.target.checked)}
                />
                Apply free shipping with this promo
              </label>
            </div>

            <div className="admin-picker-panel" style={{ marginTop: 12 }}>
              <div className="admin-picker-head">
                <strong>Promo products</strong>
                <span>{promoDraft.productIds.length} selected</span>
              </div>
              <input
                className="admin-picker-search"
                type="text"
                placeholder="Search products to include"
                value={promoProductSearch}
                onChange={(e) => setPromoProductSearch(e.target.value)}
                disabled={promoProductsLoading}
              />
              <div className="admin-chip-list">
                {promoDraft.productIds.length === 0 ? (
                  <span className="admin-picker-empty">This promo currently targets all products matching the other rules.</span>
                ) : (
                  promoDraft.productIds.map((productId) => {
                    const selectedItem = promoProducts.find((item) => normalizeChoiceId(item.id) === normalizeChoiceId(productId));
                    const choiceMeta = splitPromoChoiceLabel(selectedItem?.label || `Product #${productId}`);
                    return (
                      <button
                        key={`modal-product-${productId}`}
                        type="button"
                        className="admin-chip"
                        onClick={() => togglePromoDraftProduct(productId)}
                      >
                        {choiceMeta.title} {choiceMeta.badge || ""} ×
                      </button>
                    );
                  })
                )}
              </div>
              <div className="admin-choice-grid">
                {filteredPromoProducts.slice(0, 18).map((item) => {
                  const choiceMeta = splitPromoChoiceLabel(item.label);
                  return (
                    <label key={`modal-choice-product-${item.id}`} className={`admin-choice ${promoDraft.productIds.includes(normalizeChoiceId(item.id)) ? "is-selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={promoDraft.productIds.includes(normalizeChoiceId(item.id))}
                        onChange={() => togglePromoDraftProduct(item.id)}
                      />
                      <span className="admin-choice-copy">
                        <strong>{choiceMeta.title}</strong>
                        {choiceMeta.badge && <small className="admin-choice-badge">{choiceMeta.badge}</small>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="admin-picker-panel" style={{ marginTop: 12 }}>
              <div className="admin-picker-head">
                <strong>Promo variants</strong>
                <span>{promoDraft.variantIds.length} selected</span>
              </div>
              <input
                className="admin-picker-search"
                type="text"
                placeholder="Search exact variants"
                value={promoVariantSearch}
                onChange={(e) => setPromoVariantSearch(e.target.value)}
                disabled={promoProductsLoading}
              />
              <div className="admin-chip-list">
                {promoDraft.variantIds.length === 0 ? (
                  <span className="admin-picker-empty">Optional: target specific sizes or colors too.</span>
                ) : (
                  promoDraft.variantIds.map((variantId) => {
                    const selectedItem = promoVariants.find((item) => normalizeChoiceId(item.id) === normalizeChoiceId(variantId));
                    const choiceMeta = splitPromoChoiceLabel(selectedItem?.label || `Variant #${variantId}`);
                    return (
                      <button
                        key={`modal-variant-${variantId}`}
                        type="button"
                        className="admin-chip"
                        onClick={() => togglePromoDraftVariant(variantId)}
                      >
                        {choiceMeta.title} {choiceMeta.badge || ""} ×
                      </button>
                    );
                  })
                )}
              </div>
              <div className="admin-choice-grid admin-choice-grid--compact">
                {filteredPromoVariants.slice(0, 18).map((item) => {
                  const choiceMeta = splitPromoChoiceLabel(item.label);
                  return (
                    <label key={`modal-choice-variant-${item.id}`} className={`admin-choice ${promoDraft.variantIds.includes(normalizeChoiceId(item.id)) ? "is-selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={promoDraft.variantIds.includes(normalizeChoiceId(item.id))}
                        onChange={() => togglePromoDraftVariant(item.id)}
                      />
                      <span className="admin-choice-copy">
                        <strong>{choiceMeta.title}</strong>
                        {choiceMeta.badge && <small className="admin-choice-badge">{choiceMeta.badge}</small>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <p className="admin-picker-note">
              Only promos marked as <strong>primary</strong> can replace the fallback storefront banner during their active date window.
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-btn" onClick={closePromoModal}>Cancel</button>
              <button type="button" onClick={savePromoDraft} disabled={promoSaving}>
                {promoSaving ? "Saving..." : (promoModalMode === "edit" ? "Update Promo" : "Add Custom Promo")}
              </button>
            </div>
          </div>
        </div>
      )}

      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Site Content"}
      </button>
    </section>
  );
}

export default AdminContent;
