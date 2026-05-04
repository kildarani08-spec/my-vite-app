import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";
import { resolveImageUrl } from "../utils/imageUrl";
import "../styles/HomePage.css";

const formatPrice = (value) => {
  const amount = Number(value || 0);
  const roundedAmount = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${roundedAmount.toLocaleString("en-IN")}`;
};

const getProductPrimaryVariant = (product) =>
  product?.variants && product.variants.length > 0 ? product.variants[0] : null;

const getDiscountPercent = (variant) => {
  const price = Number(variant?.price || 0);
  const effective = Number(variant?.effective_price || 0);
  if (price <= 0 || effective >= price) {
    return 0;
  }

  return Math.round(((price - effective) / price) * 100);
};

const productHasDiscountedVariant = (product) =>
  Array.isArray(product?.variants) && product.variants.some((variant) => getDiscountPercent(variant) > 0);

const sortByTopSelling = (a, b) => {
  const aVariant = getProductPrimaryVariant(a);
  const bVariant = getProductPrimaryVariant(b);

  const byCount = Number(bVariant?.rating_count || 0) - Number(aVariant?.rating_count || 0);
  if (byCount !== 0) {
    return byCount;
  }

  return Number(bVariant?.rating_avg || 0) - Number(aVariant?.rating_avg || 0);
};

const SECTION_LIMIT = 2;

const formatReviewDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const applyTemplate = (template, values, fallback) => {
  const source = typeof template === "string" && template.trim() ? template : fallback;

  return source.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in values)) {
      return match;
    }

    return String(values[key]);
  });
};

const HOME_CAMPAIGN_DISCOUNTS = {
  sale: 10,
  "clearance-sale": 50,
  "summer-sale": 6,
  "category-sale": 4,
  "promo-group": 7,
};

function HomePage() {
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [latestReviews, setLatestReviews] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);

  const activeSitePromo = useMemo(() => {
    const promoSource = siteContent.offers?.activePromoStrip || siteContent.offers?.promoStrip;
    const rawTarget = String(promoSource?.to || "").trim();
    if (!rawTarget) {
      return null;
    }

    const queryString = rawTarget.includes("?") ? rawTarget.split("?")[1] : "";
    const params = new URLSearchParams(queryString);
    const offer = String(params.get("offer") || "").trim();
    if (!offer || offer === "all") {
      return null;
    }

    const parseIds = (value) => Array.from(
      new Set(
        String(value || "")
          .split(",")
          .map((item) => Number(item.trim()))
          .filter((item) => item > 0)
      )
    );

    return {
      offer,
      category: String(params.get("category") || "all").trim(),
      ids: parseIds(params.get("ids") || params.get("productId") || params.get("promoProduct")),
      variantIds: parseIds(params.get("variantIds") || params.get("variantId")),
      discountPercent: Number(HOME_CAMPAIGN_DISCOUNTS[offer] || 0),
    };
  }, [siteContent.offers?.activePromoStrip?.to, siteContent.offers?.promoStrip?.to]);

  const getProductPromoState = useCallback((product) => {
    const variant = getProductPrimaryVariant(product);
    const basePrice = Number(variant?.price || 0);
    const baseEffectivePrice = Number(variant?.effective_price || 0);

    if (!activeSitePromo) {
      return {
        price: baseEffectivePrice,
        to: `/product/${product.product_id}`
      };
    }

    const categoryFilter = String(activeSitePromo.category || "all").trim().toLowerCase();
    const productCategory = String(product?.category_name || "").trim().toLowerCase();
    if (categoryFilter && categoryFilter !== "all" && productCategory !== categoryFilter) {
      return {
        price: baseEffectivePrice,
        to: `/product/${product.product_id}`
      };
    }

    const productId = Number(product?.product_id || product?.id || 0);
    const variantId = Number(variant?.id || variant?.variant_id || 0);
    const matchesProduct = activeSitePromo.ids.length === 0 || activeSitePromo.ids.includes(productId);
    const matchesVariant = activeSitePromo.variantIds.length === 0 || activeSitePromo.variantIds.includes(variantId);

    if (!matchesProduct || !matchesVariant) {
      return {
        price: baseEffectivePrice,
        to: `/product/${product.product_id}`
      };
    }

    const promoDiscountPercent = Number(activeSitePromo.discountPercent || 0);
    const promoCandidatePrice = promoDiscountPercent > 0
      ? Number((baseEffectivePrice * (1 - (promoDiscountPercent / 100))).toFixed(2))
      : baseEffectivePrice;

    return {
      price: promoCandidatePrice,
      to: `/product/${product.product_id}?variantId=${variantId}&offer=${encodeURIComponent(activeSitePromo.offer)}`
    };
  }, [activeSitePromo]);

  const heroSlides = useMemo(() => {
    if (catalogProducts.length > 0) {
      return catalogProducts
        .slice()
        .sort((a, b) => {
          const aVariant = getProductPrimaryVariant(a);
          const bVariant = getProductPrimaryVariant(b);
          const byDiscount = getDiscountPercent(bVariant) - getDiscountPercent(aVariant);
          if (byDiscount !== 0) {
            return byDiscount;
          }

          return sortByTopSelling(a, b);
        })
        .slice(0, 3)
        .map((product, index) => {
          const variant = getProductPrimaryVariant(product);
          const discount = getDiscountPercent(variant);

          const promoState = getProductPromoState(product);

          return {
            id: `catalog-hero-${product.product_id}`,
            title: `${product.category_name} picks: ${product.name}`,
            subtitle:
              discount > 0
                ? `Save ${discount}% on this bestseller. Starting ${formatPrice(promoState.price)}.`
                : `Trending now in ${product.category_name}. Starting ${formatPrice(promoState.price)}.`,
            image: product.image,
            ctaLabel: "View product",
            ctaTo: promoState.to,
            secondaryTo: `/products?category=${encodeURIComponent(product.category_name || "")}`,
            secondaryLabel: `Shop ${product.category_name || "category"}`,
            bannerTag: index === 0 ? "Today's spotlight" : "Trending now"
          };
        });
    }

    return siteContent.homePage.heroSlides || [];
  }, [catalogProducts, getProductPromoState, siteContent.homePage.heroSlides]);

  const activeHero = heroSlides[heroIndex] || heroSlides[0];
  const categorySection = siteContent.homePage.categorySection || {};
  const dealBanners = siteContent.homePage.dealBanners || {};
  const featuredSection = siteContent.homePage.featuredSection || {};
  const topSellingSection = siteContent.homePage.topSellingSection || {};
  const newArrivalsSection = siteContent.homePage.newArrivalsSection || {};
  const reviewsSection = siteContent.homePage.reviewsSection || {};
  const catalogCategories = useMemo(() => {
    const categoryStats = catalogProducts
      .filter((product) => product?.category_name)
      .reduce((acc, product) => {
        const categoryName = product.category_name;
        const current = acc.get(categoryName) || { count: 0, image: "" };

        acc.set(categoryName, {
          count: current.count + 1,
          image: current.image || product.image || ""
        });

        return acc;
      }, new Map());

    const sortedCategoryNames = Array.from(categoryStats.entries())
      .sort((a, b) => {
        const byCount = b[1].count - a[1].count;
        if (byCount !== 0) {
          return byCount;
        }

        return a[0].localeCompare(b[0]);
      })
      .map(([name]) => name);

    if (sortedCategoryNames.length === 0) {
      return siteContent.homePage.primaryCategories || [];
    }

    return sortedCategoryNames.map((categoryName) => ({
      id: `catalog-category-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: categoryName,
      to: `/products?category=${encodeURIComponent(categoryName)}`,
      image: categoryStats.get(categoryName)?.image || "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80"
    }));
  }, [catalogProducts, siteContent.homePage.primaryCategories]);
  const categories = catalogCategories;
  const spotlightCards = siteContent.homePage.spotlightCards || [];

  const merchSections = useMemo(() => {
    const discounted = catalogProducts
      .slice()
      .sort((a, b) => {
        const aVariant = getProductPrimaryVariant(a);
        const bVariant = getProductPrimaryVariant(b);
        return getDiscountPercent(bVariant) - getDiscountPercent(aVariant);
      })
      .filter((product) => getDiscountPercent(getProductPrimaryVariant(product)) > 0);
    const topSelling = catalogProducts.slice().sort(sortByTopSelling);
    const newArrivals = catalogProducts.slice();
    const usedProductIds = new Set();
    const takeSectionProducts = (list, limit = SECTION_LIMIT) => {
      const picked = [];
      const inSection = new Set();

      // Pass 1: prefer products not used by previous sections.
      list.forEach((product) => {
        if (picked.length >= limit) {
          return;
        }

        const productId = product?.product_id;
        if (!productId || usedProductIds.has(productId) || inSection.has(productId)) {
          return;
        }

        usedProductIds.add(productId);
        inSection.add(productId);
        picked.push(product);
      });

      // Pass 2: backfill from the same list so sections never disappear on small catalogs.
      if (picked.length < limit) {
        list.forEach((product) => {
          if (picked.length >= limit) {
            return;
          }

          const productId = product?.product_id;
          if (!productId || inSection.has(productId)) {
            return;
          }

          inSection.add(productId);
          picked.push(product);
        });
      }

      return picked;
    };

    const featuredProducts = takeSectionProducts(discounted);
    const topSellingProducts = takeSectionProducts(topSelling);
    const newArrivalProducts = takeSectionProducts(newArrivals);

    return {
      featuredProducts,
      topSellingProducts,
      newArrivalProducts,
    };
  }, [catalogProducts]);

  const {
    featuredProducts,
    topSellingProducts,
    newArrivalProducts,
  } = merchSections;

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicSiteContent(controller.signal)
      .then((content) => {
        setSiteContent(content);
      })
      .catch(() => {
        // Keep fallback content if site-content API is unavailable.
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!Array.isArray(catalogProducts) || catalogProducts.length === 0) {
      return undefined;
    }

    const controller = new AbortController();
    const productIds = catalogProducts
      .map((product) => Number(product?.product_id || 0))
      .filter((id) => id > 0)
      .slice(0, 20);

    Promise.all(
      productIds.map((productId) =>
        fetch(`/ecommerce/products_detail.php?id=${productId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal
        })
          .then((res) => res.json())
          .catch(() => null)
      )
    )
      .then((responses) => {
        const reviews = responses
          .filter((payload) => payload && Array.isArray(payload.reviews))
          .flatMap((payload) =>
            payload.reviews.map((review) => ({
              id: review.id,
              product_id: payload.product_id || payload.id,
              product_name: payload.name || "Product",
              user_name: review.user_name,
              rating: Number(review.rating || 0),
              review_text: review.review_text,
              created_at: review.created_at,
            }))
          )
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8);

        setLatestReviews(reviews);
      })
      .catch(() => {
        // Keep section empty if review aggregation fails.
      });

    return () => controller.abort();
  }, [catalogProducts]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/ecommerce/products.php?sort=relevance&limit=120", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.products)) {
          setCatalogProducts(data.products);
        }
      })
      .catch(() => {
        // Keep CMS-only homepage if products API is unavailable.
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (heroSlides.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 4800);

    return () => window.clearInterval(intervalId);
  }, [heroSlides.length]);

  const dealBannerA = categories[0] || null;
  const dealBannerB = categories[1] || null;

  return (
    <main className="home-wrap">
      <section className="home-hero" aria-label="Homepage highlights">
        {activeHero && (
          <article className="hero-slide" style={{ backgroundImage: `url(${resolveImageUrl(activeHero.image)})` }}>
            <div className="hero-overlay" />
            <div className="hero-content">
              <p className="hero-chip">{activeHero.bannerTag || siteContent.homePage.announcement}</p>
              <h1>{activeHero.title}</h1>
              <p>{activeHero.subtitle}</p>
              <div className="hero-actions">
                <Link to={activeHero.ctaTo || "/products"} className="hero-cta-main">
                  {activeHero.ctaLabel || "Shop now"}
                </Link>
                <Link to={activeHero.secondaryTo || "/products"} className="hero-cta-ghost">
                  {activeHero.secondaryLabel || "Browse catalog"}
                </Link>
              </div>
              <div className="hero-dots" role="tablist" aria-label="Hero banners">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={index === heroIndex ? "hero-dot is-active" : "hero-dot"}
                    onClick={() => setHeroIndex(index)}
                    aria-label={`Show banner ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </article>
        )}
      </section>

      <section className="home-trust" aria-label="Store trust badges">
        {(siteContent.homePage.trustBadges || []).map((badge) => (
          <span key={badge}>{badge}</span>
        ))}
      </section>

      <section className="home-categories" aria-label="Shop by category">
        <header className="home-section-head">
          <div>
            <p>{categorySection.kicker || "Shop your way"}</p>
            <h2>{categorySection.title || "Popular Departments"}</h2>
          </div>
          <Link to="/products">{categorySection.ctaLabel || "Browse all products"}</Link>
        </header>

        <div className="category-grid">
          {categories.map((category) => (
            <Link key={category.id} to={category.to || "/products"} className="category-tile">
              <img src={resolveImageUrl(category.image)} alt={category.label} loading="lazy" />
              <div>
                <strong>{category.label}</strong>
                <span>{categorySection.tileCtaLabel || "Explore now"}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-spotlights" aria-label="Campaign highlights">
        {spotlightCards.map((card) => (
          <Link key={card.id} to={card.to || "/products"} className={`spotlight-card tone-${card.tone || "warm"}`}>
            <p>{card.title}</p>
            <span>{card.subtitle}</span>
          </Link>
        ))}
      </section>

      <section className="home-deal-banners" aria-label="Category deal banners">
        {dealBannerA && (
          <Link to={dealBannerA.to || "/products"} className="deal-banner">
            <img src={resolveImageUrl(dealBannerA.image)} alt={dealBannerA.label} loading="lazy" />
            <div>
              <p>{dealBanners.primaryKicker || "Featured department"}</p>
              <h3>{dealBannerA.label}</h3>
              <span>{dealBanners.primaryCtaLabel || "Shop now"}</span>
            </div>
          </Link>
        )}
        {dealBannerB && (
          <Link to={dealBannerB.to || "/products"} className="deal-banner">
            <img src={resolveImageUrl(dealBannerB.image)} alt={dealBannerB.label} loading="lazy" />
            <div>
              <p>{dealBanners.secondaryKicker || "Trending picks"}</p>
              <h3>{dealBannerB.label}</h3>
              <span>{dealBanners.secondaryCtaLabel || "Explore collection"}</span>
            </div>
          </Link>
        )}
      </section>

      <section className="home-merch" aria-label="Featured products">
        <header className="home-section-head">
          <div>
            <p>{featuredSection.kicker || "Featured products"}</p>
            <h2>{featuredSection.title || "Hot Deals From Your Catalog"}</h2>
          </div>
          <Link to="/products">{featuredSection.ctaLabel || "View all"}</Link>
        </header>
        <div className="home-product-grid">
          {featuredProducts.map((product) => {
            const variant = getProductPrimaryVariant(product);
            const discount = getDiscountPercent(variant);
            const promoState = getProductPromoState(product);
            return (
              <Link key={`featured-${product.product_id}`} to={promoState.to} className="home-product-card">
                <img src={resolveImageUrl(product.image)} alt={product.name} loading="lazy" />
                <div>
                  <p>{product.category_name}</p>
                  <h3>{product.name}</h3>
                  <strong>{formatPrice(promoState.price)}</strong>
                  {discount > 0 && <span>{discount}% OFF</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-merch" aria-label="Top selling products">
        <header className="home-section-head">
          <div>
            <p>{topSellingSection.kicker || "Top selling"}</p>
            <h2>{topSellingSection.title || "Most Ordered By Customers"}</h2>
          </div>
          <Link to="/products?sort=rating">{topSellingSection.ctaLabel || "See bestsellers"}</Link>
        </header>
        <div className="home-rail">
          {topSellingProducts.map((product) => {
            const variant = getProductPrimaryVariant(product);
            const promoState = getProductPromoState(product);
            return (
              <Link key={`top-${product.product_id}`} to={promoState.to} className="home-rail-item">
                <img src={resolveImageUrl(product.image)} alt={product.name} loading="lazy" />
                <div>
                  <h3>{product.name}</h3>
                  <p>
                    {applyTemplate(
                      topSellingSection.ratingTemplate,
                      {
                        rating: variant?.rating_avg || 0,
                        count: variant?.rating_count || 0
                      },
                      "{rating} rating ({count})"
                    )}
                  </p>
                  <strong>{formatPrice(promoState.price)}</strong>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-merch" aria-label="New arrivals">
        <header className="home-section-head">
          <div>
            <p>{newArrivalsSection.kicker || "New arrivals"}</p>
            <h2>{newArrivalsSection.title || "Freshly Added Products"}</h2>
          </div>
          <Link to="/products">{newArrivalsSection.ctaLabel || "Explore new"}</Link>
        </header>
        <div className="home-rail">
          {newArrivalProducts.map((product) => {
            const promoState = getProductPromoState(product);
            return (
              <Link key={`new-${product.product_id}`} to={promoState.to} className="home-rail-item">
                <img src={resolveImageUrl(product.image)} alt={product.name} loading="lazy" />
                <div>
                  <h3>{product.name}</h3>
                  <p>{product.category_name}</p>
                  <strong>{formatPrice(promoState.price)}</strong>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-reviews" aria-label="Review highlights">
        <header className="home-section-head">
          <div>
            <p>{reviewsSection.kicker || "Review"}</p>
            <h2>{reviewsSection.title || "What Customers Say"}</h2>
          </div>
          <Link to="/products?sort=rating">{reviewsSection.ctaLabel || "Read all reviews"}</Link>
        </header>
        <div className="home-review-grid">
          {latestReviews.map((review, index) => {
            const rating = Math.max(0, Math.min(5, Number(review.rating || 0)));
            const userName = review.user_name || "Verified Customer";
            const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName)}`;
            const reviewKey = review.id
              ? `review-${review.id}`
              : `review-fallback-${review.product_id || "product"}-${review.created_at || "date"}-${index}`;

            return (
              <article key={reviewKey} className="home-testimonial-card">
                <div>
                  <div className="home-testimonial-head">
                    <img src={avatar} alt={userName} loading="lazy" />
                    <div>
                      <h3>{userName}</h3>
                      <p className="home-testimonial-stars" aria-label={`Rated ${rating} out of 5`}>
                        {"★".repeat(rating)}{"☆".repeat(5 - rating)}
                      </p>
                      <p className="home-testimonial-date">{formatReviewDate(review.created_at)}</p>
                    </div>
                  </div>
                  <p className="home-testimonial-text">{review.review_text}</p>
                  <Link to={`/product/${review.product_id}`} className="home-testimonial-product">
                    {reviewsSection.productPrefix || "See product:"} {review.product_name}
                  </Link>
                </div>
              </article>
            );
          })}
          {latestReviews.length === 0 && (
            <p className="home-review-empty">{reviewsSection.emptyText || "No reviews available yet."}</p>
          )}
        </div>
      </section>
    </main>
  );
}

export default HomePage;
