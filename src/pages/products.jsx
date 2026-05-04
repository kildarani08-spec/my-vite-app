import React, { useEffect, useMemo, useState } from "react";
import ProductGrid from "../components/ProductGrid";
import { useSearchParams } from "react-router-dom";
import "../styles/Products.css";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";

const getPriceStep = (maxPrice) => {
  if (maxPrice >= 5000) {
    return 1000;
  }

  if (maxPrice >= 1000) {
    return 500;
  }

  if (maxPrice >= 500) {
    return 100;
  }

  return 50;
};

const roundUpToStep = (value, step) => Math.ceil(value / step) * step;

const snapToStep = (value, step, maxPrice) => {
  if (maxPrice <= 0) {
    return 0;
  }

  return Math.min(roundUpToStep(Math.max(0, value), step), maxPrice);
};

const formatPriceLabel = (value) => value.toLocaleString("en-IN");

const getProductLowestPrice = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const prices = variants
    .map((variant) => Number(variant?.effective_price ?? variant?.price ?? NaN))
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (prices.length > 0) {
    return Math.min(...prices);
  }

  return Number(product?.effective_price ?? product?.price ?? product?.base_price ?? 0);
};

const getVariantDiscountPercent = (variant) => {
  const price = Number(variant?.price ?? 0);
  const effectivePrice = Number(variant?.effective_price ?? price);

  if (price <= 0 || effectivePrice >= price) {
    return 0;
  }

  return Math.round(((price - effectivePrice) / price) * 100);
};

const getProductDiscountPercent = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const discounts = variants.map(getVariantDiscountPercent);

  if (discounts.length > 0) {
    return Math.max(...discounts);
  }

  return 0;
};

const isProductOnSale = (product) => getProductDiscountPercent(product) > 0;

const isSummerSaleProduct = (product) => {
  const category = String(product?.category_name || "").toLowerCase();
  return /(clothing|shoe|dress|shirt|summer|apparel)/i.test(category);
};

const productMatchesPromoSelection = (product, productIds = [], variantIds = []) => {
  const matchesProduct = productIds.length === 0 || productIds.includes(Number(product?.product_id || product?.id || 0));

  if (variantIds.length === 0) {
    return matchesProduct;
  }

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const matchesVariant = variants.some((variant) =>
    variantIds.includes(Number(variant?.id || variant?.variant_id || 0))
  );

  return matchesProduct && matchesVariant;
};

const getOfferLabel = (offerValue, productsPageContent, freeShippingLabel) => {
  switch (offerValue) {
    case "free-shipping":
      return freeShippingLabel;
    case "sale":
      return productsPageContent.saleOption || "On sale";
    case "clearance-sale":
      return productsPageContent.clearanceOption || "Clearance sale";
    case "summer-sale":
      return productsPageContent.summerSaleOption || "Summer sale";
    case "category-sale":
      return productsPageContent.categorySaleOption || "Category sale";
    case "promo-group":
      return productsPageContent.promoOption || "Promo picks";
    default:
      return productsPageContent.allProductsOption || "All products";
  }
};

const OFFER_CAMPAIGN_PRESETS = {
  all: {
    priceLabel: "Catalog price",
    priceNote: "Shows the normal catalog pricing from your backend.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Store shipping rules"
  },
  sale: {
    priceLabel: "Sale campaign",
    priceNote: "Shows the live catalog price. Cart and checkout use the real backend promo rules.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Store shipping rules"
  },
  "clearance-sale": {
    priceLabel: "Clearance campaign",
    priceNote: "Shows the live catalog clearance price. Cart and checkout use the same backend price logic.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Store shipping rules"
  },
  "summer-sale": {
    priceLabel: "Summer campaign",
    priceNote: "Shows the current catalog price. Any extra promo is applied only by the backend pricing engine.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Store shipping rules"
  },
  "category-sale": {
    priceLabel: "Category campaign",
    priceNote: "Shows the current catalog price. Cart and checkout use the real promo engine.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Store shipping rules"
  },
  "promo-group": {
    priceLabel: "Selected promo",
    priceNote: "Shows the current catalog price. Exact promo discounts are confirmed in cart and checkout.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Store shipping rules"
  },
  "flash-sale": {
    priceLabel: "Flash sale",
    priceNote: "Limited-time pricing is controlled by the backend promo engine during the scheduled window.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Store shipping rules"
  },
  "happy-hour": {
    priceLabel: "Happy hour",
    priceNote: "Short-window happy-hour pricing is applied by the backend when the promo is active.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Store shipping rules"
  },
  "threshold-offer": {
    priceLabel: "Spend & save",
    priceNote: "The cart discount is unlocked only after the minimum cart total is reached.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Store shipping rules"
  },
  "free-shipping": {
    priceLabel: "Cart offer",
    priceNote: "Free delivery is unlocked only when the cart total crosses the required amount.",
    extraDiscountPercent: 0,
    taxLabel: "Standard checkout tax rules",
    shippingLabel: "Free delivery only above the cart threshold"
  }
};

function Products() {
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [sliderMaxPrice, setSliderMaxPrice] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = (searchParams.get("category") || "").trim();
  const sortFromUrl = (searchParams.get("sort") || "relevance").trim();
  const limitFromUrl = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 100)));
  const maxPriceFromUrlValue = Number(searchParams.get("maxPrice") || "");
  const maxPriceFromUrl = Number.isFinite(maxPriceFromUrlValue) && maxPriceFromUrlValue > 0 ? maxPriceFromUrlValue : null;
  const selectedCategory = categoryFromUrl || "all";
  const sortBy = sortFromUrl || "relevance";
  const [appliedMaxPrice, setAppliedMaxPrice] = useState(maxPriceFromUrl);
  const [draftMaxPrice, setDraftMaxPrice] = useState(maxPriceFromUrl);
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const query = (searchParams.get("query") || "").trim().toLowerCase();
  const offer = (searchParams.get("offer") || "").trim();
  const activeOffer = offer || "all";
  const isFreeShippingOffer = offer === "free-shipping";
  const isCartThresholdOffer = ["free-shipping", "threshold-offer"].includes(offer);
  const promoProductIds = Array.from(
    new Set(
      [
        ...String(searchParams.get("ids") || "")
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => value > 0),
        Number(searchParams.get("productId") || searchParams.get("promoProduct") || 0)
      ].filter((value) => value > 0)
    )
  );
  const promoVariantIds = Array.from(
    new Set(
      [
        ...String(searchParams.get("variantIds") || "")
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => value > 0),
        Number(searchParams.get("variantId") || 0)
      ].filter((value) => value > 0)
    )
  );
  const promoIdsQuery = promoProductIds.join(",");
  const promoVariantIdsQuery = promoVariantIds.join(",");
  const hasExplicitPromoSelection = promoProductIds.length > 0 || promoVariantIds.length > 0;
  const minPrice = Number(searchParams.get("cartMin") || searchParams.get("minPrice") || 0);
  const priceStep = useMemo(() => getPriceStep(sliderMaxPrice), [sliderMaxPrice]);
  const sliderCeiling = useMemo(() => roundUpToStep(sliderMaxPrice, priceStep), [priceStep, sliderMaxPrice]);
  const effectiveMaxSelectedPrice = useMemo(() => {
    if (sliderCeiling <= 0) {
      return 0;
    }

    const baseValue = draftMaxPrice ?? appliedMaxPrice ?? sliderCeiling;
    return snapToStep(baseValue, priceStep, sliderCeiling);
  }, [appliedMaxPrice, draftMaxPrice, priceStep, sliderCeiling]);

  useEffect(() => {
    setAppliedMaxPrice(maxPriceFromUrl);
    setDraftMaxPrice(maxPriceFromUrl);
  }, [maxPriceFromUrl]);

  useEffect(() => {
    if (sliderCeiling <= 0) {
      if (draftMaxPrice !== null) {
        setDraftMaxPrice(null);
      }
      if (appliedMaxPrice !== null) {
        setAppliedMaxPrice(null);
      }
      return;
    }

    if (appliedMaxPrice === null) {
      if (draftMaxPrice !== null && draftMaxPrice > sliderCeiling) {
        setDraftMaxPrice(null);
      }
      return;
    }

    const normalizedAppliedMaxPrice = snapToStep(appliedMaxPrice, priceStep, sliderCeiling);

    if (normalizedAppliedMaxPrice >= sliderCeiling) {
      setAppliedMaxPrice(null);
      if (draftMaxPrice !== null && draftMaxPrice > sliderCeiling) {
        setDraftMaxPrice(null);
      }
      return;
    }

    if (normalizedAppliedMaxPrice !== appliedMaxPrice) {
      setAppliedMaxPrice(normalizedAppliedMaxPrice);
      return;
    }

    if (draftMaxPrice === null || draftMaxPrice > sliderCeiling) {
      setDraftMaxPrice(normalizedAppliedMaxPrice);
    }
  }, [appliedMaxPrice, draftMaxPrice, priceStep, sliderCeiling]);

  useEffect(() => {
    if (sliderCeiling <= 0) {
      return undefined;
    }

    const normalizedDraftMaxPrice =
      draftMaxPrice === null || effectiveMaxSelectedPrice >= sliderCeiling
        ? null
        : effectiveMaxSelectedPrice;

    if (normalizedDraftMaxPrice === appliedMaxPrice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setAppliedMaxPrice(normalizedDraftMaxPrice);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [appliedMaxPrice, draftMaxPrice, effectiveMaxSelectedPrice, sliderCeiling]);

  useEffect(() => {
    if (appliedMaxPrice === null) {
      setDraftMaxPrice(null);
    }
  }, [appliedMaxPrice, query, selectedCategory, sortBy, offer, promoIdsQuery, promoVariantIdsQuery, minPrice]);

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicSiteContent(controller.signal)
      .then((content) => {
        setSiteContent(content);
      })
      .catch(() => {
        // Keep fallback content when content API is unavailable.
      });

    return () => controller.abort();
  }, []);

  const updateFilterParam = (key, value, defaultValue) => {
    const nextParams = new URLSearchParams(searchParams);
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue || normalizedValue === defaultValue) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, normalizedValue);
    }

    setSearchParams(nextParams);
  };

  const clearFilterParam = (key) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(key);
    setSearchParams(nextParams);
  };

  const handleOfferChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);
    const nextValue = String(value || "all").trim();

    nextParams.delete("offer");
    if (nextValue === "all") {
      nextParams.delete("cartMin");
      nextParams.delete("minPrice");
      nextParams.delete("ids");
      nextParams.delete("variantIds");
      nextParams.delete("productId");
      nextParams.delete("promoProduct");
      setSearchParams(nextParams);
      return;
    }

    nextParams.set("offer", nextValue);
    nextParams.delete("cartMin");

    if (nextValue === "free-shipping") {
      nextParams.set("cartMin", String(siteContent.offers?.freeShippingThreshold || 699));
      nextParams.delete("minPrice");
      nextParams.delete("category");
      nextParams.delete("ids");
      nextParams.delete("variantIds");
      nextParams.delete("productId");
      nextParams.delete("promoProduct");
    }

    setSearchParams(nextParams);
  };

  const clearAllFilters = () => {
    setDraftMaxPrice(null);
    setAppliedMaxPrice(null);
    setSearchParams({});
  };

  const handlePricePresetSelect = (value) => {
    if (value === null || sliderCeiling <= 0) {
      setDraftMaxPrice(null);
      setAppliedMaxPrice(null);
      return;
    }

    const nextValue = snapToStep(Number(value), priceStep, sliderCeiling);
    setDraftMaxPrice(nextValue);
    setAppliedMaxPrice(nextValue >= sliderCeiling ? null : nextValue);
  };

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const controller = new AbortController();
    const params = new URLSearchParams();

    if (query) {
      params.set("query", query);
    }
    if (offer) {
      params.set("offer", offer);
    }
    if (promoIdsQuery) {
      params.set("ids", promoIdsQuery);
    }
    if (promoVariantIdsQuery) {
      params.set("variantIds", promoVariantIdsQuery);
    }
    if (minPrice > 0 && !isCartThresholdOffer) {
      params.set("minPrice", String(minPrice));
    }
    if (selectedCategory !== "all" && !hasExplicitPromoSelection) {
      params.set("category", selectedCategory);
    }
    if (sortBy !== "relevance") {
      params.set("sort", sortBy);
    }
    if (appliedMaxPrice !== null) {
      params.set("maxPrice", String(appliedMaxPrice));
    }
    params.set("limit", String(limitFromUrl));

    fetch(`/ecommerce/products.php?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setError("");
          setProducts(Array.isArray(data.products) ? data.products : []);
          setTotalProducts(Number(data?.meta?.total ?? data?.products?.length ?? 0));

          const nextMaxAvailablePrice = Math.max(0, Math.ceil(Number(data?.meta?.maxAvailablePrice ?? 0)));
          setSliderMaxPrice((currentMaxPrice) => {
            if (appliedMaxPrice !== null) {
              return Math.max(currentMaxPrice, nextMaxAvailablePrice);
            }

            return nextMaxAvailablePrice;
          });
        } else {
          setError(data.error || "Failed to fetch products");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Network error");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query, offer, promoIdsQuery, promoVariantIdsQuery, minPrice, isCartThresholdOffer, selectedCategory, sortBy, appliedMaxPrice, limitFromUrl, hasExplicitPromoSelection]);

  const productsPageContent = siteContent.productsPage;
  const siteFreeShippingThreshold = Number(siteContent.offers?.freeShippingThreshold || 699);
  const shippingThreshold = activeOffer === "free-shipping"
    ? siteFreeShippingThreshold
    : (minPrice > 0 ? minPrice : siteFreeShippingThreshold);
  const freeShippingLabelTemplate = productsPageContent.freeShippingLabelTemplate || "Free shipping above Rs.{minPrice}";
  const freeShippingLabel = freeShippingLabelTemplate.replace("{minPrice}", String(shippingThreshold));
  const activeCampaignPreset = useMemo(() => {
    const basePreset = OFFER_CAMPAIGN_PRESETS[activeOffer] || OFFER_CAMPAIGN_PRESETS.all;

    if (activeOffer === "free-shipping") {
      return {
        ...basePreset,
        shippingLabel: `${freeShippingLabel} on cart total`,
        priceNote: `Free delivery is not for a single product automatically. It unlocks only when the cart total reaches ₹${formatPriceLabel(shippingThreshold)} or more.`,
        cartThreshold: shippingThreshold,
      };
    }

    return basePreset;
  }, [activeOffer, freeShippingLabel, shippingThreshold]);

  const priceFilteredProducts = useMemo(() => {
    const productList = Array.isArray(products) ? products : [];

    if (appliedMaxPrice === null) {
      return productList;
    }

    return productList.filter((product) => getProductLowestPrice(product) <= appliedMaxPrice);
  }, [appliedMaxPrice, products]);

  const categoryCounts = useMemo(() => {
    return priceFilteredProducts.reduce((acc, product) => {
      const categoryName = String(product?.category_name || "").trim();

      if (!categoryName) {
        return acc;
      }

      acc.set(categoryName, (acc.get(categoryName) || 0) + 1);
      return acc;
    }, new Map());
  }, [priceFilteredProducts]);

  const categoryOptions = useMemo(() => Array.from(categoryCounts.keys()).sort((a, b) => a.localeCompare(b)), [categoryCounts]);

  const offerCounts = useMemo(() => {
    const productList = priceFilteredProducts;

    return {
      all: productList.length,
      sale: productList.filter(isProductOnSale).length,
      "clearance-sale": productList.filter((product) => getProductDiscountPercent(product) >= 15).length,
      "summer-sale": productList.filter((product) => isProductOnSale(product) && isSummerSaleProduct(product)).length,
      "free-shipping": productList.length,
      "promo-group": productList.filter((product) => productMatchesPromoSelection(product, promoProductIds, promoVariantIds)).length
    };
  }, [priceFilteredProducts, promoProductIds, promoVariantIds, shippingThreshold]);

  const pricePresetOptions = useMemo(() => {
    if (sliderCeiling <= 0) {
      return [];
    }

    return Array.from(
      new Set(
        [500, 1000, 2000, 5000, sliderCeiling]
          .filter((value) => value > 0 && value < sliderCeiling)
          .map((value) => snapToStep(value, priceStep, sliderCeiling))
      )
    ).sort((a, b) => a - b);
  }, [priceStep, sliderCeiling]);

  const hasPromoSelection = hasExplicitPromoSelection;
  const activeOfferLabel = getOfferLabel(activeOffer, productsPageContent, freeShippingLabel);
  const hasActiveFilters = Boolean(query || selectedCategory !== "all" || activeOffer !== "all" || appliedMaxPrice !== null);
  const isPromoFocusedView = activeOffer !== "all" || hasPromoSelection;
  const promoStripTarget = useMemo(() => {
    const promoSource = siteContent.offers?.activePromoStrip || siteContent.offers?.promoStrip;
    const rawTarget = String(promoSource?.to || "").trim();

    if (!rawTarget) {
      return null;
    }

    const queryString = rawTarget.includes("?") ? rawTarget.split("?")[1] : "";
    const targetParams = new URLSearchParams(queryString);
    const parseIdList = (value) => Array.from(
      new Set(
        String(value || "")
          .split(",")
          .map((item) => Number(item.trim()))
          .filter((item) => item > 0)
      )
    );

    return {
      offer: (targetParams.get("offer") || "all").trim(),
      category: (targetParams.get("category") || "all").trim(),
      ids: parseIdList(targetParams.get("ids") || targetParams.get("productId") || targetParams.get("promoProduct")),
      variantIds: parseIdList(targetParams.get("variantIds") || targetParams.get("variantId"))
    };
  }, [siteContent]);
  const isAdminApprovedPromoView = useMemo(() => {
    if (!isPromoFocusedView || !promoStripTarget) {
      return false;
    }

    const offerMatches = (promoStripTarget.offer || "all") === activeOffer;
    const categoryMatches = !promoStripTarget.category || promoStripTarget.category === "all" || promoStripTarget.category === selectedCategory;
    const idsMatch = promoStripTarget.ids.length === 0 || promoStripTarget.ids.every((id) => promoProductIds.includes(id));
    const variantIdsMatch = promoStripTarget.variantIds.length === 0 || promoStripTarget.variantIds.every((id) => promoVariantIds.includes(id));

    return offerMatches && categoryMatches && idsMatch && variantIdsMatch;
  }, [activeOffer, isPromoFocusedView, promoProductIds, promoStripTarget, promoVariantIds, selectedCategory]);
  const showPromoMerchandising = isPromoFocusedView && !isAdminApprovedPromoView;
  const isAdminCategoryCampaignView = Boolean(
    isAdminApprovedPromoView &&
    promoStripTarget?.category &&
    promoStripTarget.category !== "all" &&
    promoStripTarget.ids.length === 0 &&
    promoStripTarget.variantIds.length === 0
  );
  const siteWidePromoCampaignContext = useMemo(() => {
    if (!promoStripTarget || !promoStripTarget.offer || promoStripTarget.offer === "all") {
      return null;
    }

    const preset = OFFER_CAMPAIGN_PRESETS[promoStripTarget.offer] || null;
    if (!preset) {
      return null;
    }

    const promoLabel = getOfferLabel(promoStripTarget.offer, productsPageContent, freeShippingLabel);
    const category = promoStripTarget.category || "all";
    const applyToAll = promoStripTarget.ids.length === 0 && promoStripTarget.variantIds.length === 0 && (!category || category === "all");

    return {
      ...preset,
      badge: promoStripTarget.offer === "free-shipping" ? `Free on ₹${formatPriceLabel(shippingThreshold)}+` : promoLabel,
      offerParam: promoStripTarget.offer,
      productIds: promoStripTarget.ids,
      variantIds: promoStripTarget.variantIds,
      category,
      applyToAll,
      cartThreshold: shippingThreshold,
    };
  }, [freeShippingLabel, productsPageContent, promoStripTarget, shippingThreshold]);

  const dealCards = useMemo(() => {
    const cards = [
      {
        value: "all",
        eyebrow: "Browse all",
        title: productsPageContent.allProductsOption || "All products",
        description: "Start with the full catalog across every department.",
        meta: `${offerCounts.all} products`
      },
      {
        value: "sale",
        eyebrow: "Top deals",
        title: productsPageContent.saleOption || "On sale",
        description: "Live discounts across popular products and daily picks.",
        meta: `${offerCounts.sale} discounted items`
      },
      {
        value: "clearance-sale",
        eyebrow: "Last chance",
        title: productsPageContent.clearanceOption || "Clearance sale",
        description: "End-of-line markdowns that move fast.",
        meta: `${offerCounts["clearance-sale"]} clearance deals`
      },
      {
        value: "summer-sale",
        eyebrow: "Seasonal edit",
        title: productsPageContent.summerSaleOption || "Summer sale",
        description: "Warm-weather fashion and seasonal picks in one view.",
        meta: `${offerCounts["summer-sale"]} summer-ready styles`
      },
      {
        value: "free-shipping",
        eyebrow: "Delivery saver",
        title: productsPageContent.freeShippingOption || "Free shipping",
        description: freeShippingLabel,
        meta: `${offerCounts["free-shipping"]} eligible products`
      }
    ];

    if (hasPromoSelection) {
      cards.push({
        value: offer || "promo-group",
        eyebrow: "Curated promo",
        title: productsPageContent.promoOption || "Promo picks",
        description: "Hand-picked products and variants from the active campaign.",
        meta: `${offerCounts["promo-group"]} promo matches`
      });
    }

    return cards;
  }, [freeShippingLabel, hasPromoSelection, offer, offerCounts, productsPageContent]);

  const displayedDealCards = useMemo(() => {
    if (activeOffer === "all") {
      return dealCards;
    }

    return dealCards.filter((card) => card.value === "all" || card.value === activeOffer);
  }, [activeOffer, dealCards]);

  const visibleProducts = useMemo(() => {
    let nextProducts = [...priceFilteredProducts];
    const keepFullCategoryCatalogVisible = isAdminCategoryCampaignView && ["sale", "clearance-sale", "summer-sale", "category-sale"].includes(activeOffer);
    const shouldApplyGenericOfferFilters = !keepFullCategoryCatalogVisible && !hasExplicitPromoSelection;

    if (shouldApplyGenericOfferFilters && (activeOffer === "sale" || activeOffer === "category-sale")) {
      nextProducts = nextProducts.filter(isProductOnSale);
    }

    if (shouldApplyGenericOfferFilters && activeOffer === "clearance-sale") {
      nextProducts = nextProducts.filter((product) => getProductDiscountPercent(product) >= 15);
    }

    if (shouldApplyGenericOfferFilters && activeOffer === "summer-sale") {
      nextProducts = nextProducts.filter((product) => isProductOnSale(product) && isSummerSaleProduct(product));
    }

    if (promoProductIds.length > 0 || promoVariantIds.length > 0) {
      nextProducts = nextProducts.filter((product) => productMatchesPromoSelection(product, promoProductIds, promoVariantIds));
    }

    return nextProducts;
  }, [activeOffer, hasExplicitPromoSelection, isAdminCategoryCampaignView, priceFilteredProducts, promoProductIds, promoVariantIds, shippingThreshold]);

  if (loading) return <p className="products-state">{productsPageContent.loadingText || "Loading products..."}</p>;
  if (error) return <p className="products-state products-state-error">{error}</p>;

  return (
    <div className="products-container">
      <section className="products-hero">
        <p className="products-kicker">{productsPageContent.heroKicker}</p>
        <h1>{productsPageContent.heroTitle}</h1>
        <p>{productsPageContent.heroDescription}</p>
      </section>

      {showPromoMerchandising && (
        <section className="products-deal-strip" aria-label={productsPageContent.dealZoneAriaLabel || "Shop deal zones"}>
          {displayedDealCards.map((card) => (
            <button
              key={card.value}
              type="button"
              className={`products-deal-card ${activeOffer === card.value ? "is-active" : ""}`}
              onClick={() => handleOfferChange(card.value)}
            >
              <span>{card.eyebrow}</span>
              <strong>{card.title}</strong>
              <small>{card.description}</small>
              <em>{card.meta}</em>
            </button>
          ))}
        </section>
      )}

      <div className={`products-layout ${isPromoFocusedView ? "" : "products-layout--catalog"}`.trim()}>
        <aside className="products-sidebar" aria-label={productsPageContent.filtersTitle || "Shop filters"}>
          {showPromoMerchandising && (
            <>
              <div className="products-side-card products-side-card-highlight">
                <span className="products-side-eyebrow">{`${activeOfferLabel} spotlight`}</span>
                <strong>
                  {activeCampaignPreset.extraDiscountPercent > 0
                    ? `Extra ${activeCampaignPreset.extraDiscountPercent}% off`
                    : activeOfferLabel}
                </strong>
                <p>{activeCampaignPreset.priceNote}</p>
                <button
                  type="button"
                  className="products-side-cta"
                  onClick={() => handleOfferChange("all")}
                >
                  View all products
                </button>
              </div>

              <div className="products-side-card products-side-card-campaign">
                <div className="products-side-head">
                  <strong>{`${activeOfferLabel} defaults`}</strong>
                  <span>{activeCampaignPreset.priceLabel}</span>
                </div>
                <div className="products-policy-list">
                  <div className="products-policy-row">
                    <span>Amount</span>
                    <strong>
                      {activeCampaignPreset.extraDiscountPercent > 0
                        ? `Extra ${activeCampaignPreset.extraDiscountPercent}% off`
                        : "Live catalog price"}
                    </strong>
                  </div>
                  <div className="products-policy-row">
                    <span>Tax</span>
                    <strong>{activeCampaignPreset.taxLabel}</strong>
                  </div>
                  <div className="products-policy-row">
                    <span>Delivery</span>
                    <strong>{activeCampaignPreset.shippingLabel}</strong>
                  </div>
                </div>
                <p>{activeCampaignPreset.priceNote}</p>
              </div>
            </>
          )}

          <div className="products-side-card">
            <div className="products-side-head">
              <strong>{productsPageContent.shopByLabel || "Shop by department"}</strong>
              <span>{categoryOptions.length} categories</span>
            </div>
            <div className="products-side-list">
              <button
                type="button"
                className={`products-side-option ${selectedCategory === "all" ? "is-active" : ""}`}
                onClick={() => updateFilterParam("category", "all", "all")}
              >
                <span>{productsPageContent.allCategoryOption || "All"}</span>
                <strong>{offerCounts.all}</strong>
              </button>
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`products-side-option ${selectedCategory === category ? "is-active" : ""}`}
                  onClick={() => updateFilterParam("category", category, "all")}
                >
                  <span>{category}</span>
                  <strong>{categoryCounts.get(category) || 0}</strong>
                </button>
              ))}
            </div>
          </div>

          {showPromoMerchandising && activeOffer !== "free-shipping" && (
            <div className="products-side-card">
              <div className="products-side-head">
                <strong>{productsPageContent.dealZoneTitle || "Deals & delivery"}</strong>
                <span>{activeOfferLabel}</span>
              </div>
              <div className="products-side-list">
                {dealCards
                  .filter((card) => card.value !== "all")
                  .map((card) => (
                    <button
                      key={`sidebar-${card.value}`}
                      type="button"
                      className={`products-side-option ${activeOffer === card.value ? "is-active" : ""}`}
                      onClick={() => handleOfferChange(card.value)}
                    >
                      <span>{card.title}</span>
                      <strong>{card.meta}</strong>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="products-side-card">
            <div className="products-side-head">
              <strong>{productsPageContent.priceRangeTitle || "Price range"}</strong>
              <span>{productsPageContent.budgetHint || "Set your budget"}</span>
            </div>
            <label className="products-range-field products-range-field-sidebar">
              <span>{productsPageContent.maxPriceLabel || "Max price"}</span>
              <strong>
                {sliderCeiling <= 0
                  ? "Any price"
                  : draftMaxPrice === null
                    ? `Up to ₹${formatPriceLabel(sliderCeiling)}`
                    : `Under ₹${formatPriceLabel(Number(effectiveMaxSelectedPrice).toFixed(0) * 1)}`}
              </strong>
              <input
                type="range"
                min="0"
                max={sliderCeiling}
                step={priceStep}
                value={effectiveMaxSelectedPrice}
                onChange={(e) => setDraftMaxPrice(snapToStep(Number(e.target.value), priceStep, sliderCeiling))}
                disabled={sliderCeiling <= 0}
              />
            </label>
            <div className="products-preset-list">
              <button
                type="button"
                className={`products-preset ${draftMaxPrice === null ? "is-active" : ""}`}
                onClick={() => handlePricePresetSelect(null)}
                disabled={sliderCeiling <= 0}
              >
                Any price
              </button>
              {pricePresetOptions.map((value) => (
                <button
                  key={`price-${value}`}
                  type="button"
                  className={`products-preset ${draftMaxPrice !== null && effectiveMaxSelectedPrice === value ? "is-active" : ""}`}
                  onClick={() => handlePricePresetSelect(value)}
                  disabled={sliderCeiling <= 0}
                >
                  Under ₹{formatPriceLabel(value)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="clear-filter-btn"
              onClick={() => handlePricePresetSelect(null)}
              disabled={sliderCeiling <= 0 || draftMaxPrice === null}
            >
              {productsPageContent.clearPriceCapLabel || "Clear price cap"}
            </button>
          </div>
        </aside>

        <div className="products-main">
          <section className="products-toolbar" aria-label={productsPageContent.filtersAriaLabel || "Product filters and sorting"}>
            <label className="products-field">
              <span>{productsPageContent.categoryLabel || "Category"}</span>
              <select value={selectedCategory} onChange={(e) => updateFilterParam("category", e.target.value, "all")}>
                <option value="all">{productsPageContent.allCategoryOption || "All"}</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="products-field">
              <span>{productsPageContent.sortLabel || "Sort by"}</span>
              <select value={sortBy} onChange={(e) => updateFilterParam("sort", e.target.value, "relevance")}>
                <option value="relevance">{productsPageContent.sortOptions?.relevance || "Relevance"}</option>
                <option value="price-asc">{productsPageContent.sortOptions?.priceAsc || "Price: Low to High"}</option>
                <option value="price-desc">{productsPageContent.sortOptions?.priceDesc || "Price: High to Low"}</option>
                <option value="rating">{productsPageContent.sortOptions?.rating || "Rating"}</option>
                <option value="name">{productsPageContent.sortOptions?.name || "Name: A to Z"}</option>
              </select>
            </label>

            {showPromoMerchandising && (
              <label className="products-field">
                <span>{productsPageContent.offerLabel || "Offer"}</span>
                <select value={activeOffer} onChange={(e) => handleOfferChange(e.target.value)}>
                  <option value="all">{productsPageContent.allProductsOption || "All products"}</option>
                  <option value="sale">{productsPageContent.saleOption || "On sale"}</option>
                  <option value="clearance-sale">{productsPageContent.clearanceOption || "Clearance sale"}</option>
                  <option value="summer-sale">{productsPageContent.summerSaleOption || "Summer sale"}</option>
                  <option value="category-sale">{productsPageContent.categorySaleOption || "Category sale"}</option>
                  <option value="free-shipping">{productsPageContent.freeShippingOption || "Free shipping"}</option>
                  {hasPromoSelection && (
                    <option value={offer || "promo-group"}>{productsPageContent.promoOption || "Promo picks"}</option>
                  )}
                </select>
              </label>
            )}

            <button
              type="button"
              className="clear-filter-btn"
              onClick={clearAllFilters}
              disabled={!hasActiveFilters}
            >
              {productsPageContent.clearAllFiltersLabel || "Clear all filters"}
            </button>
          </section>

          <section className="products-meta" aria-live="polite">
            <div className="products-meta-copy">
              <p>
                {(productsPageContent.showingTemplate || "Showing {count} products")
                  .replace("{count}", String(visibleProducts.length))
                  .replace("{total}", String(totalProducts || visibleProducts.length))}
              </p>
              <small className="products-meta-subtext">
                {hasActiveFilters
                  ? "Your selected filters are applied live to the catalog."
                  : isPromoFocusedView
                    ? "Only the admin-approved promo is shown on this page."
                    : "Browse the full catalog and use filters only when you need them."}
              </small>
            </div>
            <div className="products-chips">
              {query && (
                <button type="button" className="products-chip products-chip-btn" onClick={() => clearFilterParam("query")}>
                  {productsPageContent.searchChipPrefix || "Search:"} {searchParams.get("query")} ×
                </button>
              )}
              {activeOffer !== "all" && (
                <button type="button" className="products-chip products-chip-btn" onClick={() => handleOfferChange("all")}>
                  {activeOfferLabel} ×
                </button>
              )}
              {hasPromoSelection && (
                <button type="button" className="products-chip products-chip-btn" onClick={() => handleOfferChange("all")}>
                  {promoVariantIds.length > 0
                    ? `Promo variants: ${promoVariantIds.length} selected`
                    : promoProductIds.length === 1
                      ? `Promo product${visibleProducts[0]?.name ? `: ${visibleProducts[0].name}` : ""}`
                      : `Promo products: ${promoProductIds.length} selected`} ×
                </button>
              )}
              {selectedCategory !== "all" && (
                <button type="button" className="products-chip products-chip-btn" onClick={() => clearFilterParam("category")}>
                  {productsPageContent.categoryChipPrefix || "Category:"} {selectedCategory} ×
                </button>
              )}
              {appliedMaxPrice !== null && (
                <button type="button" className="products-chip products-chip-btn" onClick={() => handlePricePresetSelect(null)}>
                  Under ₹{formatPriceLabel(appliedMaxPrice)} ×
                </button>
              )}
              {hasActiveFilters && (
                <button type="button" className="products-chip products-chip-clear" onClick={clearAllFilters}>
                  {productsPageContent.clearAllFiltersLabel || "Clear all filters"}
                </button>
              )}
            </div>
          </section>

          <div className="products-grid-wrap">
            <ProductGrid
              products={visibleProducts}
              copy={siteContent.productGrid}
              campaignContext={activeOffer !== "all"
                ? {
                    ...activeCampaignPreset,
                    badge: activeOffer === "free-shipping" ? `Free on ₹${formatPriceLabel(shippingThreshold)}+` : activeOfferLabel,
                    offerParam: activeOffer,
                    applyToAll: true,
                    cartThreshold: shippingThreshold,
                  }
                : siteWidePromoCampaignContext}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Products;
