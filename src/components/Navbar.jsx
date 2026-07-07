import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Navbar.css";
import { useCart } from "../contexts/useCart";
import { Link, useNavigate } from "react-router-dom";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";
import { logoutUser } from "../utils/adminApi";
import { resolveImageUrl } from "../utils/imageUrl";

function normalizePathOnly(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return "";
  }

  const [pathOnly] = trimmed.split("?", 1);
  return (pathOnly || "/").replace(/\/+$/, "") || "/";
}

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearchQuery(value) {
  return Array.from(
    new Set(
      normalizeSearchText(value)
        .split(/[\s\-_]+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
}

function formatSearchLabel(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const SEARCH_STOP_WORDS = new Set(["and", "for", "the", "with", "from", "only", "your", "this", "that", "set", "pack", "pro"]);

function parseInternalLink(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [pathPart, searchPart = ""] = trimmed.split("?", 2);
  const path = (pathPart || "/").replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(searchPart);
  const normalizedParams = Array.from(params.entries())
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  return { path, params: normalizedParams };
}

function areRoutesEquivalent(a, b) {
  if (!a || !b) {
    return false;
  }

  if (a.path !== b.path || a.params.length !== b.params.length) {
    return false;
  }

  for (let i = 0; i < a.params.length; i += 1) {
    if (a.params[i][0] !== b.params[i][0] || a.params[i][1] !== b.params[i][1]) {
      return false;
    }
  }

  return true;
}

function ensureQueryParam(to, key, value) {
  if (typeof to !== "string" || !to.startsWith("/")) {
    return to;
  }

  const [pathPart, searchPart = ""] = to.split("?", 2);
  const params = new URLSearchParams(searchPart);
  params.set(key, value);
  const query = params.toString();
  return query ? `${pathPart}?${query}` : pathPart;
}

function getStoredUser() {
  const userData = localStorage.getItem("user") || sessionStorage.getItem("user");

  if (!userData) {
    return null;
  }

  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => Boolean(localStorage.getItem("token") || sessionStorage.getItem("token"))
  );
  const [user, setUser] = useState(() => getStoredUser());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCatalog, setSearchCatalog] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isAllCategoryMenuOpen, setIsAllCategoryMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const [isPromoPaused, setIsPromoPaused] = useState(false);
  const accountMenuRef = useRef(null);
  const searchMenuRef = useRef(null);
  const categoryMenuRef = useRef(null);
  const allCategoryMenuRef = useRef(null);
  const { cartCount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setIsAccountOpen(false);
      }

      if (searchMenuRef.current && !searchMenuRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }

      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target)) {
        setIsCategoryMenuOpen(false);
      }

      if (allCategoryMenuRef.current && !allCategoryMenuRef.current.contains(event.target)) {
        setIsAllCategoryMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("https://my-vite-app-backend.onrender.com/products.php?sort=relevance&limit=300", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success || !Array.isArray(data.products)) {
          return;
        }

        const normalized = data.products
          .filter((product) => product?.product_id && product?.name)
          .map((product) => ({
            productId: product.product_id,
            name: product.name,
            category: product.category_name || "General",
            description: product.description || "",
            skuKeywords: Array.isArray(product.variants)
              ? product.variants.map((variant) => variant?.sku).filter(Boolean).join(" ")
              : "",
            image: resolveImageUrl(product.image, "https://via.placeholder.com/120?text=Product"),
            to: `/product/${product.product_id}`
          }));

        setSearchCatalog(normalized);
      })
      .catch(() => {
        // Suggestions remain disabled if product API is unavailable.
      });

    return () => controller.abort();
  }, []);

  const searchSuggestions = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (query.length < 2) {
      return [];
    }

    const tokens = tokenizeSearchQuery(query);

    return searchCatalog
      .map((item) => {
        const name = normalizeSearchText(item.name);
        const category = normalizeSearchText(item.category);
        const description = normalizeSearchText(item.description);
        const skuKeywords = normalizeSearchText(item.skuKeywords);
        const haystack = `${name} ${category} ${description} ${skuKeywords}`.trim();
        const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;

        if (matchedTokens === 0 && !haystack.includes(query)) {
          return null;
        }

        let score = matchedTokens * 70;

        if (name === query) score += 1000;
        if (name.startsWith(query)) score += 300;
        if (name.includes(query)) score += 140;
        if (category.startsWith(query)) score += 110;
        if (category.includes(query)) score += 70;
        if (skuKeywords.includes(query)) score += 50;
        if (description.includes(query)) score += 30;

        tokens.forEach((token) => {
          if (name.startsWith(token)) score += 80;
          if (name.includes(token)) score += 45;
          if (category.includes(token)) score += 30;
        });

        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return a.item.name.localeCompare(b.item.name);
      })
      .slice(0, 3)
      .map((entry) => entry.item);
  }, [searchCatalog, searchQuery]);

  const searchSuggestedTerms = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (query.length < 2) {
      return [];
    }

    const suggestions = new Map();

    searchCatalog.forEach((item) => {
      [item.name, item.category].forEach((value) => {
        const normalized = normalizeSearchText(value);
        if (!normalized || normalized === query || !normalized.startsWith(query)) {
          return;
        }

        suggestions.set(normalized, value);
      });

      tokenizeSearchQuery(`${item.name} ${item.category}`)
        .filter((token) => token.length >= 3 && !SEARCH_STOP_WORDS.has(token) && token.startsWith(query) && token !== query)
        .forEach((token) => {
          if (!suggestions.has(token)) {
            suggestions.set(token, formatSearchLabel(token));
          }
        });
    });

    return Array.from(suggestions.entries())
      .sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([, label]) => label);
  }, [searchCatalog, searchQuery]);

  const searchMatchingCategories = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (query.length < 2) {
      return [];
    }

    const tokens = tokenizeSearchQuery(query);
    const categoryMap = new Map();

    searchCatalog.forEach((item) => {
      const categoryName = String(item.category || "General").trim();
      const normalizedCategory = normalizeSearchText(categoryName);
      const haystack = `${normalizedCategory} ${normalizeSearchText(item.name)} ${normalizeSearchText(item.description)}`;
      const isMatch = normalizedCategory.includes(query) || tokens.some((token) => haystack.includes(token));

      if (!isMatch) {
        return;
      }

      const current = categoryMap.get(categoryName) || { label: categoryName, count: 0 };
      current.count += 1;
      categoryMap.set(categoryName, current);
    });

    return Array.from(categoryMap.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 6);
  }, [searchCatalog, searchQuery]);

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

  const handleLogout = async () => {
    await logoutUser();
    setIsLoggedIn(false);
    setUser(null);
    setIsAccountOpen(false);
    navigate("/");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      navigate(`/products?query=${encodeURIComponent(query)}`);
      setIsSearchFocused(false);
      setIsMobileMenuOpen(false);
    }
  };

  const handleSuggestionSelect = (item) => {
    setSearchQuery(item.name);
    setIsSearchFocused(false);
    setIsMobileMenuOpen(false);
    navigate(item.to);
  };

  const handleSuggestedTermSelect = (term) => {
    const nextQuery = String(term || "").trim();
    if (!nextQuery) {
      return;
    }

    setSearchQuery(nextQuery);
    setIsSearchFocused(false);
    setIsMobileMenuOpen(false);
    navigate(`/products?query=${encodeURIComponent(nextQuery)}`);
  };

  const handleCategorySearchSelect = (categoryName) => {
    const params = new URLSearchParams();
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery) {
      params.set("query", trimmedQuery);
    }
    if (categoryName) {
      params.set("category", categoryName);
    }

    setIsSearchFocused(false);
    setIsMobileMenuOpen(false);
    navigate(`/products?${params.toString()}`);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setIsCategoryMenuOpen(false);
    setIsAllCategoryMenuOpen(false);
  };
  const isAdmin = ["admin", "super_admin"].includes(String(user?.role || "").toLowerCase());
  const canViewLink = useCallback((item) => {
    if (item.enabled === false) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  }, [isAdmin]);
  const handleNavItemClick = (event, item) => {
    if (!item) {
      return;
    }

    if (item.requiresAuth && !isLoggedIn) {
      event.preventDefault();
      closeMobileMenu();
      navigate("/login", {
        state: {
          redirectTo: item.to || "/",
          guestUpgradeMessage: "Please login to continue."
        }
      });
      return;
    }

    closeMobileMenu();
  };
  const logoName = siteContent.brand.name || "MYSHOP";
  const logoTagline = siteContent.brand.tagline || "Everyday products, clear prices, fast checkout.";
  const promoItems = useMemo(() => {
    const visible = Array.isArray(siteContent?.offers?.visiblePromoStrips) ? siteContent.offers.visiblePromoStrips : [];
    if (visible.length > 0) {
      return visible.filter((item) => item?.enabled !== false);
    }

    const fallbackPromo = siteContent?.offers?.activePromoStrip || siteContent?.offers?.promoStrip;
    return fallbackPromo?.enabled === false || !fallbackPromo
      ? []
      : [{ ...fallbackPromo, id: "fallback-promo", badge: "Offer", isFallback: true }];
  }, [siteContent]);
  const activePromo = promoItems[activePromoIndex] || promoItems[0] || null;
  const showPromoControls = promoItems.length > 1;

  useEffect(() => {
    setActivePromoIndex(0);
  }, [promoItems.length]);

  useEffect(() => {
    if (promoItems.length <= 1 || isPromoPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActivePromoIndex((prev) => (prev + 1) % promoItems.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [promoItems.length, isPromoPaused]);

  const stepPromo = useCallback((direction) => {
    if (promoItems.length <= 1) {
      return;
    }

    setActivePromoIndex((prev) => (prev + direction + promoItems.length) % promoItems.length);
  }, [promoItems.length]);
  const navUi = siteContent.navbar.ui || {};
  const navAccessRules = useMemo(() => {
    const links = siteContent?.navbar?.links;
    if (!Array.isArray(links)) {
      return [];
    }

    return links
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        label: normalizeLabel(item.label),
        to: item.to || "/",
        route: parseInternalLink(item.to || "/"),
        enabled: item.enabled !== false,
        requiresAuth: item.requiresAuth === true,
        adminOnly: item.adminOnly === true
      }));
  }, [siteContent]);

  const resolveNavRule = useCallback((to, label) => {
    const targetRoute = parseInternalLink(to || "");
    const targetLabel = normalizeLabel(label);

    const exactMatch = navAccessRules.find((rule) => areRoutesEquivalent(rule.route, targetRoute));
    if (exactMatch) {
      return exactMatch;
    }

    const labelMatch = navAccessRules.find((rule) => rule.label !== "" && rule.label === targetLabel);
    if (labelMatch) {
      return labelMatch;
    }

    return {
      label: targetLabel,
      to: to || "/",
      route: targetRoute,
      enabled: true,
      requiresAuth: false,
      adminOnly: false
    };
  }, [navAccessRules]);
  const protectedPaths = useMemo(() => {
    const links = siteContent?.navbar?.links;
    if (!Array.isArray(links)) {
      return new Set();
    }

    return new Set(
      links
        .filter((item) => item && typeof item === "object")
        .filter((item) => item.enabled !== false && item.requiresAuth === true)
        .map((item) => normalizePathOnly(item.to || ""))
        .filter(Boolean)
    );
  }, [siteContent]);

  const handleGenericLinkClick = (event, to) => {
    const pathOnly = normalizePathOnly(to || "");
    if (pathOnly && protectedPaths.has(pathOnly) && !isLoggedIn) {
      event.preventDefault();
      closeMobileMenu();
      navigate("/login", {
        state: {
          redirectTo: to || pathOnly,
          guestUpgradeMessage: "Please login to continue."
        }
      });
      return;
    }

    closeMobileMenu();
  };
  const primaryNavItems = (siteContent?.navbar?.links || [])
    .filter((item) => item && typeof item === "object")
    .filter(canViewLink)
    .map((item) => ({
      id: item.id || `${String(item.label || "link").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: item.label || "Link",
      to: item.to || "/",
      requiresAuth: item.requiresAuth === true
    }));
  const secondaryNavItems = [
    { id: "shop-all-secondary", label: "Shop All", to: "/products" },
    { id: "new-arrivals-secondary", label: "New arrivals", to: "/products?sort=relevance&limit=2" }
  ]
    .map((item) => {
      const resolved = { ...item, ...resolveNavRule(item.to, item.label) };
      if (item.id === "new-arrivals-secondary") {
        resolved.to = ensureQueryParam(resolved.to || item.to, "limit", "2");
      }
      return resolved;
    })
    .filter(canViewLink);
  const categoryMenuItems = useMemo(() => {
    const categoryStats = searchCatalog
      .filter((item) => item?.category)
      .reduce((acc, item) => {
        const category = item.category;
        const currentCount = acc.get(category) || 0;
        acc.set(category, currentCount + 1);
        return acc;
      }, new Map());

    const categoryNames = Array.from(categoryStats.entries())
      .sort((a, b) => {
        const byCount = b[1] - a[1];
        if (byCount !== 0) {
          return byCount;
        }

        return a[0].localeCompare(b[0]);
      })
      .map(([name]) => name);

    if (categoryNames.length === 0) {
      return [];
    }

    return categoryNames
      .map((categoryName) => {
        const to = `/products?category=${encodeURIComponent(categoryName)}`;
        const rule = resolveNavRule(to, categoryName);

        return {
          id: `category-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          label: categoryName,
          to,
          note: `${categoryStats.get(categoryName) || 0} products`,
          enabled: rule.enabled,
          requiresAuth: rule.requiresAuth,
          adminOnly: rule.adminOnly
        };
      })
      .filter(canViewLink);
  }, [searchCatalog, canViewLink, resolveNavRule]);
  const allCategorySections = useMemo(() => {
    if (searchCatalog.length === 0) {
      return [];
    }

    const grouped = searchCatalog.reduce((acc, item) => {
      const categoryName = item.category || "General";
      const current = acc.get(categoryName) || [];
      current.push(item);
      acc.set(categoryName, current);
      return acc;
    }, new Map());

    return Array.from(grouped.entries())
      .filter(([categoryName]) => {
        const to = `/products?category=${encodeURIComponent(categoryName)}`;
        const rule = resolveNavRule(to, categoryName);
        return canViewLink(rule);
      })
      .sort((a, b) => {
        const byCount = b[1].length - a[1].length;
        if (byCount !== 0) {
          return byCount;
        }

        return a[0].localeCompare(b[0]);
      })
      .slice(0, 6)
      .map(([categoryName, items]) => ({
        id: `all-category-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: categoryName,
        items: items.slice(0, 5).map((item) => ({
          id: `all-item-${item.productId}`,
          label: item.name,
          to: item.to,
          enabled: true,
          requiresAuth: resolveNavRule(item.to, item.name).requiresAuth,
          adminOnly: false
        }))
      }));
  }, [searchCatalog, canViewLink, resolveNavRule]);

  return (
    <header className="navbar-wrap">
      {activePromo && (
        <div className="promo-strip-list" aria-label="Current store offers">
          <div className="promo-strip-shell">
            <Link
              key={activePromo.id || `${activePromo.text}-${activePromo.to}`}
              to={activePromo.to || "/products"}
              className={`promo-strip ${activePromo.isFallback ? "is-default" : "is-live"}`}
              onClick={closeMobileMenu}
            >
              <span className="promo-strip-badge">{activePromo.badge || (activePromo.isFallback ? "Always on" : "Live")}</span>
              <span className="promo-strip-text">{activePromo.text || "Shop now"}</span>
              <span className="promo-strip-cta">Shop now</span>
            </Link>
            {showPromoControls && (
              <div className="promo-strip-controls" aria-label="Promo strip controls">
                <span className="promo-strip-counter">{activePromoIndex + 1}/{promoItems.length}</span>
                <button
                  type="button"
                  className="promo-strip-control"
                  onClick={() => stepPromo(-1)}
                  aria-label="Show previous offer"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="promo-strip-control"
                  onClick={() => setIsPromoPaused((prev) => !prev)}
                  aria-label={isPromoPaused ? "Resume rotating offers" : "Pause rotating offers"}
                >
                  {isPromoPaused ? "▶" : "❚❚"}
                </button>
                <button
                  type="button"
                  className="promo-strip-control"
                  onClick={() => stepPromo(1)}
                  aria-label="Show next offer"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="navbar">
        <div className="logo-block">
          <Link to="/" className="logo" onClick={closeMobileMenu}>{logoName}</Link>
          <span className="logo-tagline">{logoTagline}</span>
        </div>

        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={navUi.mobileToggleAriaLabel || "Toggle navigation menu"}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? (navUi.mobileCloseLabel || "Close") : (navUi.mobileMenuLabel || "Menu")}
        </button>

        <nav className={`nav-links ${isMobileMenuOpen ? "is-open" : ""}`}>
          {primaryNavItems.map((item) => (
            <Link key={item.id} to={item.to || "/"} onClick={(event) => handleNavItemClick(event, item)}>
              {item.label}
            </Link>
          ))}
          {isAdmin && <Link to="/admin/dashboard" onClick={closeMobileMenu}>{navUi.adminLinkLabel || "Super Admin"}</Link>}
        </nav>

        <div className="search-shell" ref={searchMenuRef}>
          <form className="search-bar" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder={navUi.searchPlaceholder || "Search for products, brands and categories"}
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">{navUi.searchButtonLabel || "Search"}</button>
          </form>
          {isSearchFocused && normalizeSearchText(searchQuery).length >= 2 && (
            <div className="search-suggestions" role="dialog" aria-label={navUi.searchSuggestionsAriaLabel || "Search suggestions"}>
              {searchSuggestedTerms.length > 0 && (
                <section className="search-panel-section">
                  <p className="search-panel-title">Do you mean?</p>
                  <div className="search-chip-list">
                    {searchSuggestedTerms.map((term) => (
                      <button
                        key={`term-${term}`}
                        type="button"
                        className="search-chip-link"
                        onClick={() => handleSuggestedTermSelect(term)}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {searchMatchingCategories.length > 0 && (
                <section className="search-panel-section">
                  <p className="search-panel-title">Categories</p>
                  <div className="search-chip-list">
                    {searchMatchingCategories.map((item) => (
                      <button
                        key={`category-${item.label}`}
                        type="button"
                        className="search-chip-link search-category-chip"
                        onClick={() => handleCategorySearchSelect(item.label)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="search-panel-section">
                <p className="search-panel-title">Top results</p>
                {searchSuggestions.length > 0 ? (
                  <div className="search-top-results">
                    {searchSuggestions.map((item) => (
                      <button
                        type="button"
                        key={`suggest-${item.productId}`}
                        className="search-result-card"
                        onClick={() => handleSuggestionSelect(item)}
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = "https://via.placeholder.com/120?text=Product";
                          }}
                        />
                        <span className="search-result-copy">
                          <strong>{item.name}</strong>
                          <small>{item.category}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="search-no-suggestions">{navUi.noSearchSuggestionsText || "No matching products found"}</p>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="user-actions">
          <div className="account-menu" ref={accountMenuRef}>
            <button
              type="button"
              className="account-label"
              onClick={() => setIsAccountOpen((prev) => !prev)}
            >
              {user?.name || navUi.accountDefaultLabel || "My Account"}
            </button>

            {isAccountOpen && (
              <div className="account-dropdown">
                {isLoggedIn ? (
                  <>
                    <p className="account-dropdown-heading">{navUi.accountHeadingLoggedIn || "My Account"}</p>
                    <Link to="/account/profile" onClick={() => setIsAccountOpen(false)}>{navUi.profileLabel || "Profile"}</Link>
                    <Link to="/account/orders" onClick={() => setIsAccountOpen(false)}>{navUi.ordersLabel || "My Orders"}</Link>
                    <Link to="/cart" onClick={() => setIsAccountOpen(false)}>{navUi.cartLabel || "Cart"}</Link>
                    {isAdmin && <Link to="/admin/dashboard" onClick={() => setIsAccountOpen(false)}>{navUi.adminPanelLabel || "Super Admin Panel"}</Link>}
                    <button type="button" onClick={handleLogout} className="logout-btn">
                      {navUi.logoutLabel || "Logout"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="account-dropdown-heading">{navUi.accountHeadingGuest || "Welcome"}</p>
                    <Link to="/account/orders" onClick={() => setIsAccountOpen(false)}>
                      {navUi.trackOrderLabel || "Check Order Status"}
                    </Link>
                    <Link to="/login" onClick={() => setIsAccountOpen(false)}>{navUi.loginLabel || "Login"}</Link>
                    <Link to="/register" onClick={() => setIsAccountOpen(false)}>{navUi.signUpLabel || "Sign Up"}</Link>
                  </>
                )}
              </div>
            )}
          </div>

          {!isAdmin && (
            <Link to="/wishlist" className="wishlist-link" onClick={closeMobileMenu}>
              {navUi.wishlistLabel || "Wishlist"}
            </Link>
          )}

          <Link to="/cart" className="cart-link" onClick={closeMobileMenu}>
            {navUi.cartLabel || "Cart"} <span className="cart-count">{cartCount}</span>
          </Link>
        </div>
      </div>

      <div className="navbar-secondary">
        <div className="navbar-secondary-inner">
          <div className="category-dropdown" ref={categoryMenuRef}>
            <button
              type="button"
              className="category-dropdown-trigger"
              onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
              aria-expanded={isCategoryMenuOpen}
            >
              <span className="category-dropdown-icon" aria-hidden="true">☰</span>
              <span>{navUi.shopByCategoriesLabel || "Shop by categories"}</span>
            </button>
            {isCategoryMenuOpen && (
              <div className="category-dropdown-panel">
                {categoryMenuItems.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    className="category-dropdown-item"
                    onClick={(event) => handleNavItemClick(event, item)}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.note}</small>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <nav className={`secondary-links ${isMobileMenuOpen ? "is-open" : ""}`}>
            <Link to="/" onClick={closeMobileMenu}>{navUi.homeLabel || "Home"}</Link>
            <div className="all-category-menu" ref={allCategoryMenuRef}>
              <button
                type="button"
                className={`secondary-link-trigger ${isAllCategoryMenuOpen ? "is-open" : ""}`}
                onClick={() => setIsAllCategoryMenuOpen((prev) => !prev)}
                aria-expanded={isAllCategoryMenuOpen}
              >
                <span>{navUi.allCategoryLabel || "All Category"}</span>
              </button>
              {isAllCategoryMenuOpen && (
                <div className="all-category-panel">
                  {allCategorySections.map((section) => (
                    <section key={section.id} className="all-category-section">
                      <div className="all-category-section-heading">
                        <h3>{section.title}</h3>
                      </div>
                      <div className="all-category-links">
                        {section.items.map((item) => (
                          <Link
                            key={item.id}
                            to={item.to}
                            className="all-category-item"
                            onClick={(event) => handleNavItemClick(event, item)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
            {secondaryNavItems.map((item) => (
              <Link
                key={`secondary-${item.id}`}
                to={item.to || "/"}
                onClick={(event) => handleGenericLinkClick(event, item.to || "/")}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
