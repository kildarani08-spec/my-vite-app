import { API_BASE } from "./adminApi";

const DEFAULT_FREE_SHIPPING_THRESHOLD = 699;

const DEFAULT_SITE_CONTENT = {
  brand: {
    name: "MYSHOP",
    tagline: "Everyday products, clear prices, fast checkout.",
    supportEmail: "support@myshop.com",
    supportPhone: "+910000000000",
    supportHours: "Mon - Sat, 9:00 AM to 8:00 PM"
  },
  offers: {
    promoStrip: {
      enabled: true,
      text: "Free shipping on orders over Rs.699",
      to: "/products?offer=free-shipping&cartMin=699"
    },
    promoCampaigns: [],
    freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD,
    standardShippingFee: 80,
    freeShippingProgressTemplate: "Add Rs.{remaining} more to unlock free shipping over Rs.{threshold}.",
    freeShippingUnlockedText: "Free shipping applied."
  },
  navbar: {
    ui: {
      mobileToggleAriaLabel: "Toggle navigation menu",
      mobileMenuLabel: "Menu",
      mobileCloseLabel: "Close",
      adminLinkLabel: "Super Admin",
      searchPlaceholder: "Search for products, brands and categories",
      searchButtonLabel: "Search",
      searchSuggestionsAriaLabel: "Search suggestions",
      noSearchSuggestionsText: "No matching products found",
      accountDefaultLabel: "My Account",
      accountHeadingLoggedIn: "My Account",
      accountHeadingGuest: "Welcome",
      profileLabel: "Profile",
      ordersLabel: "My Orders",
      cartLabel: "Cart",
      adminPanelLabel: "Super Admin Panel",
      logoutLabel: "Logout",
      loginLabel: "Login",
      signUpLabel: "Sign Up",
      wishlistLabel: "Wishlist",
      shopByCategoriesLabel: "Shop by categories",
      homeLabel: "Home",
      allCategoryLabel: "All Category"
    },
    links: [
      { id: "home", label: "Home", to: "/", enabled: true, requiresAuth: false, adminOnly: false },
      { id: "all-products", label: "All Products", to: "/products", enabled: true, requiresAuth: false, adminOnly: false },
      {
        id: "deals",
        label: "Deals",
        to: "/products?offer=free-shipping&cartMin=699",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      {
        id: "new-arrivals",
        label: "New Arrivals",
        to: "/products?sort=relevance",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      {
        id: "top-rated",
        label: "Top Rated",
        to: "/products?sort=rating",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      {
        id: "electronics",
        label: "Electronics",
        to: "/products?category=Electronics",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      {
        id: "mobiles",
        label: "Mobiles",
        to: "/products?category=Mobiles",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      {
        id: "clothing",
        label: "Clothing",
        to: "/products?category=Clothing",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      {
        id: "shoes",
        label: "Shoes",
        to: "/products?category=Shoes",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      {
        id: "mens-shirts",
        label: "Men's Shirts",
        to: "/products?category=Men%27s%20Shirts",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      {
        id: "womens-dresses",
        label: "Women's Dresses",
        to: "/products?category=Women%27s%20Dresses",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      {
        id: "books",
        label: "Books",
        to: "/products?category=Books",
        enabled: true,
        requiresAuth: false,
        adminOnly: false
      },
      { id: "wishlist", label: "Wishlist", to: "/wishlist", enabled: true, requiresAuth: false, adminOnly: false }
    ]
  },
  footer: {
    ui: {
      copyrightTemplate: "© {year} {brand}. All rights reserved."
    },
    sections: [
      {
        id: "shop",
        title: "Shop",
        links: [
          { id: "all-products", label: "All Products", to: "/products", type: "internal" },
          {
            id: "shipping-deals",
            label: "Free Shipping Deals",
            to: "/products?offer=free-shipping&cartMin=699",
            type: "internal"
          },
          { id: "wishlist", label: "Wishlist", to: "/wishlist", type: "internal" },
          { id: "cart", label: "Cart", to: "/cart", type: "internal" }
        ]
      },
      {
        id: "my-account",
        title: "My Account",
        links: [
          { id: "profile", label: "Profile", to: "/account/profile", type: "internal" },
          { id: "orders", label: "My Orders", to: "/account/orders", type: "internal" },
          { id: "login", label: "Login", to: "/login", type: "internal" },
          { id: "signup", label: "Sign Up", to: "/register", type: "internal" }
        ]
      },
      {
        id: "customer-care",
        title: "Customer Care",
        links: [
          { id: "support", label: "Contact Support", to: "mailto:support@myshop.com", type: "external" },
          { id: "call", label: "Call Us", to: "tel:+910000000000", type: "external" },
          {
            id: "returns",
            label: "Returns Help",
            to: "mailto:support@myshop.com?subject=Returns%20Help",
            type: "external"
          }
        ]
      }
    ],
    paymentBadges: ["VISA", "MASTERCARD", "UPI", "COD"]
  },
  productsPage: {
    heroKicker: "Fresh picks",
    heroTitle: "Discover products that actually fit your style.",
    heroDescription: "Curated assortment with clean pricing, trusted ratings, and fast checkout across categories.",
    freeShippingLabelTemplate: "Free shipping above Rs.{minPrice}",
    loadingText: "Loading products...",
    filtersAriaLabel: "Product filters and sorting",
    categoryLabel: "Category",
    allCategoryOption: "All",
    sortLabel: "Sort by",
    sortOptions: {
      relevance: "Relevance",
      priceAsc: "Price: Low to High",
      priceDesc: "Price: High to Low",
      rating: "Rating",
      name: "Name: A to Z"
    },
    maxPriceLabel: "Max price",
    clearPriceCapLabel: "Clear price cap",
    showingTemplate: "Showing {count} products",
    searchChipPrefix: "Search:",
    categoryChipPrefix: "Category:"
  },
  homePage: {
    announcement: "Everything store for everyday life",
    heroSlides: [
      {
        id: "hero-1",
        title: "Shop electronics, mobiles, clothing, books and more.",
        subtitle: "Browse the categories you actually sell with cleaner discovery and faster checkout.",
        image:
          "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=1600&q=80",
        ctaLabel: "Shop all categories",
        ctaTo: "/products"
      },
      {
        id: "hero-2",
        title: "Daily deals across every department.",
        subtitle: "Compare prices, ratings, and delivery options before you buy.",
        image:
          "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1600&q=80",
        ctaLabel: "Explore best rated",
        ctaTo: "/products?sort=rating"
      },
      {
        id: "hero-3",
        title: "Big basket energy, small-cart convenience.",
        subtitle: "From single-item buys to bulk household orders, checkout stays simple.",
        image:
          "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80",
        ctaLabel: "View offers",
        ctaTo: "/products?offer=free-shipping&cartMin=699"
      }
    ],
    trustBadges: ["Secure checkout", "Easy returns", "Support 7 days", "Fast dispatch"],
    primaryCategories: [
      {
        id: "cat-electronics",
        label: "Electronics",
        to: "/products?category=Electronics",
        image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80"
      },
      {
        id: "cat-mobiles",
        label: "Mobiles",
        to: "/products?category=Mobiles",
        image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80"
      },
      {
        id: "cat-clothing",
        label: "Clothing",
        to: "/products?category=Clothing",
        image: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=800&q=80"
      },
      {
        id: "cat-shoes",
        label: "Shoes",
        to: "/products?category=Shoes",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80"
      },
      {
        id: "cat-mens-shirts",
        label: "Men's Shirts",
        to: "/products?category=Men%27s%20Shirts",
        image: "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80"
      },
      {
        id: "cat-womens-dresses",
        label: "Women's Dresses",
        to: "/products?category=Women%27s%20Dresses",
        image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80"
      },
      {
        id: "cat-books",
        label: "Books",
        to: "/products?category=Books",
        image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80"
      }
    ],
    spotlightCards: [
      {
        id: "spot-1",
        title: "Top picks this week",
        subtitle: "High-rated products across categories.",
        to: "/products?sort=rating&limit=2",
        tone: "warm"
      },
      {
        id: "spot-2",
        title: "Free shipping zone",
        subtitle: "Unlock delivery savings on larger carts.",
        to: "/products",
        tone: "mint"
      },
      {
        id: "spot-3",
        title: "New arrivals",
        subtitle: "Fresh stock added recently.",
        to: "/products?sort=relevance&limit=2",
        tone: "sky"
      }
    ],
    categorySection: {
      kicker: "Shop your way",
      title: "Popular Departments",
      ctaLabel: "Browse all products",
      tileCtaLabel: "Explore now"
    },
    dealBanners: {
      primaryKicker: "Featured department",
      primaryCtaLabel: "Shop now",
      secondaryKicker: "Trending picks",
      secondaryCtaLabel: "Explore collection"
    },
    featuredSection: {
      kicker: "Featured products",
      title: "Hot Deals From Your Catalog",
      ctaLabel: "View all"
    },
    topSellingSection: {
      kicker: "Top selling",
      title: "Most Ordered By Customers",
      ctaLabel: "See bestsellers",
      ratingTemplate: "{rating} rating ({count})"
    },
    newArrivalsSection: {
      kicker: "New arrivals",
      title: "Freshly Added Products",
      ctaLabel: "Explore new"
    },
    reviewsSection: {
      kicker: "Review",
      title: "What Customers Say",
      ctaLabel: "Read all reviews",
      productPrefix: "See product:",
      emptyText: "No reviews available yet."
    }
  },
  cartPage: {
    title: "Your Shopping Cart",
    loadingText: "Loading cart...",
    emptyTitle: "Your cart is empty",
    emptyDescription: "Add products to your cart to see them here.",
    continueShoppingLabel: "Continue Shopping",
    summaryTitle: "Order Summary",
    subtotalLabel: "Subtotal",
    shippingLabel: "Shipping",
    totalLabel: "Total",
    checkoutLabel: "Proceed to Checkout"
  },
  guestOrderTrackPage: {
    title: "Order Tracking",
    description: "Check the latest status for a recent order using your order number and email address.",
    orderNumberLabel: "Order Number",
    orderNumberPlaceholder: "ORD-20260330-ABC123",
    emailLabel: "Email Address",
    emailPlaceholder: "you@example.com",
    submitLabel: "Check Order Status",
    submitLoadingLabel: "Checking...",
    summaryTitle: "Order Summary",
    statusLabel: "Status",
    paymentLabel: "Payment",
    totalLabel: "Total",
    placedLabel: "Placed",
    itemsTitle: "Items in this order",
    updatesTitle: "Latest updates"
  },
  confirmationPage: {
    missingTitle: "Order details are not available",
    missingDescription: "Please place an order from checkout to view confirmation details here.",
    successTitle: "Order placed successfully",
    orderIdLabel: "Order ID",
    orderNumberLabel: "Order Number",
    totalPaidLabel: "Total Paid",
    paymentMethodLabel: "Payment Method",
    gatewayLabel: "Gateway",
    shippingAddressLabel: "Shipping Address",
    gatewayReferenceTitle: "Gateway Reference",
    gatewayOrderIdLabel: "Gateway Order ID",
    gatewayPaymentIdLabel: "Gateway Payment ID",
    gatewaySignatureLabel: "Gateway Signature",
    itemsTitle: "Items",
    guestConfirmedTitle: "Guest order confirmed",
    guestTrackingTemplate: "Your order tracking is sent to {email}. Use Order ID {orderId} in all support emails.",
    viewOrdersLabel: "View My Orders",
    continueShoppingLabel: "Continue Shopping"
  },
  authPages: {
    login: {
      title: "Login",
      emailPlaceholder: "Email",
      passwordPlaceholder: "Password",
      rememberMeLabel: "Remember Me",
      forgotPasswordLabel: "Forgot Password?",
      loadingLabel: "Logging in...",
      submitLabel: "Login",
      invalidCredentialsText: "Invalid credentials",
      networkErrorText: "Network error. Please try again."
    },
    register: {
      title: "Create Account",
      rewardPrefix: "Welcome reward unlocked:",
      firstNamePlaceholder: "First Name",
      lastNamePlaceholder: "Last Name",
      emailPlaceholder: "Email",
      passwordPlaceholder: "Password",
      phonePlaceholder: "Phone Number",
      dobPlaceholder: "Date of Birth",
      submitLabel: "Register",
      alreadyRegisteredPrefix: "Already registered?",
      loginHereLabel: "Login here",
      successRedirectMessage: "Registration successful! Please log in.",
      validationPasswordText: "Password must be at least 8 characters long and include a number and a symbol.",
      validationPhoneText: "Phone number must be 10-15 digits.",
      validationDobRequiredText: "Date of birth is required.",
      validationDobPastText: "Date of birth must be in the past.",
      validationAgeText: "You must be at least 18 years old to register.",
      registrationFailedText: "Registration failed",
      networkErrorText: "Network error"
    },
    forgotPassword: {
      title: "Forgot Password",
      subtitle: "Enter your account email to request a password reset link.",
      emailPlaceholder: "Email",
      loadingLabel: "Sending...",
      submitLabel: "Send Reset Link",
      devResetLinkPrefix: "Dev reset link:",
      devResetLinkLabel: "Open reset form",
      devResetTokenPrefix: "Dev reset token:",
      rememberPasswordPrefix: "Remember password?",
      backToLoginLabel: "Back to login",
      failedRequestText: "Failed to process request",
      fallbackSuccessText: "If this email address is registered, a password reset link will be sent.",
      networkErrorText: "Network error. Please try again."
    },
    resetPassword: {
      title: "Reset Password",
      subtitle: "Enter your reset token and a new password.",
      tokenPlaceholder: "Reset Token",
      passwordPlaceholder: "New Password",
      confirmPasswordPlaceholder: "Confirm New Password",
      loadingLabel: "Updating...",
      submitLabel: "Reset Password",
      backToLoginPrefix: "Back to",
      backToLoginLabel: "login",
      tokenRequiredText: "Reset token is required.",
      passwordMismatchText: "Passwords do not match.",
      passwordMinText: "Password must be at least 8 characters.",
      failedText: "Password reset failed.",
      successText: "Password reset successful.",
      networkErrorText: "Network error. Please try again."
    }
  },
  profilePage: {
    loginRequiredText: "Please log in to view your profile.",
    loadingText: "Loading profile...",
    title: "My Profile",
    firstNameLabel: "First Name",
    lastNameLabel: "Last Name",
    phoneLabel: "Phone Number",
    dobLabel: "Date of Birth",
    emailLabel: "Email",
    memberSinceLabel: "Member Since",
    saveLabel: "Save Changes",
    savingLabel: "Saving...",
    saveSuccessText: "Saved!",
    saveFailedText: "Failed to save.",
    loadFailedText: "Failed to load profile.",
    networkErrorText: "Could not reach server."
  },
  ordersPage: {
    loginRequiredText: "Please log in to view your orders.",
    loadingText: "Loading orders...",
    title: "My Orders",
    emptyText: "You have no orders yet.",
    backToOrdersLabel: "Back to orders",
    statusLabel: "Status",
    trackingLabel: "Tracking",
    itemLabel: "Item",
    qtyLabel: "Qty",
    priceLabel: "Price",
    totalLabel: "Total",
    subtotalLabel: "Subtotal",
    shippingLabel: "Shipping",
    discountLabel: "Discount",
    grandTotalLabel: "Grand Total",
    timelineTitle: "Order Timeline",
    noTimelineText: "No timeline updates yet.",
    loadFailedText: "Failed to load orders.",
    networkErrorText: "Could not reach server."
  },
  wishlistPage: {
    loginRequiredText: "Please log in to view your wishlist.",
    loadingText: "Loading wishlist...",
    title: "Wishlist",
    emptyText: "No saved items yet.",
    continueShoppingLabel: "Continue Shopping",
    addToCartLabel: "Add to Cart",
    addingLabel: "Adding...",
    removeLabel: "Remove",
    inStockLabel: "In Stock",
    outOfStockLabel: "Out of Stock",
    addedToCartText: "Added to cart",
    addToCartFailedText: "Failed to add to cart",
    loadFailedText: "Failed to load wishlist.",
    networkErrorText: "Could not reach server."
  },
  productGrid: {
    emptyText: "No products available",
    endsInPrefix: "Ends in",
    newArrivalText: "New arrival",
    viewLabel: "View",
    noDescriptionText: "No description available."
  },
  productDetailPage: {
    loadingText: "Loading product details...",
    errorPrefix: "Error:",
    noProductText: "No product found.",
    defaultTitle: "Product Detail",
    eyebrow: "Product Detail",
    inclusiveTaxLabel: "Inclusive of tax",
    colorLabel: "Color",
    sizeLabel: "Size",
    chooseVariantLabel: "Choose variant",
    wishlistUpdatingLabel: "Updating...",
    removeFromWishlistLabel: "Remove from Wishlist",
    addToWishlistLabel: "Add to Wishlist",
    addToCartLabel: "Add to Cart",
    customerReviewsTitle: "Customer Reviews",
    ratingPrefix: "Rating:",
    ratingBreakdownTitle: "Rating Breakdown",
    recentReviewsTitle: "Recent Reviews",
    noReviewsText: "No reviews yet for this product.",
    checkingReviewEligibilityText: "Checking review eligibility...",
    loginToReviewText: "Please log in to write a review.",
    mustPurchaseToReviewText: "You can review this product only after purchasing it.",
    writeReviewTitle: "Write a Review",
    ratingLabel: "Rating:",
    reviewPlaceholder: "Share your experience...",
    submitReviewLabel: "Submit Review",
    specificationsTitle: "Specifications",
    shippingReturnsTitle: "Shipping & Returns",
    shippingLabel: "Shipping:",
    returnPolicyLabel: "Return Policy:",
    warrantyTitle: "Warranty",
    aboutItemTitle: "About this item",
    unknownStockText: "Unknown",
    inStockText: "In Stock",
    outOfStockText: "Out of Stock",
    variantPrefix: "Variant",
    productIdMissingText: "Product ID missing",
    variantIdMissingText: "Variant ID missing",
    outOfStockVariantText: "This variant is out of stock",
    addedToCartText: "Product added to cart!",
    failedToAddProductPrefix: "Failed to add product:",
    mustLoginReviewText: "You must be logged in to submit a review.",
    reviewSubmittedText: "Review submitted successfully!",
    reviewFailedText: "Failed to submit review",
    reviewNetworkErrorText: "Network error while submitting review",
    loginToWishlistText: "Please log in to use wishlist",
    wishlistUpdateFailedText: "Failed to update wishlist",
    invalidJsonText: "Server returned an invalid JSON response"
  },
  maintenancePage: {
    title: "Store Under Maintenance",
    description: "We are making updates right now. Please try again later.",
    loginRequiredText: "Please login to continue."
  },
  checkout: {
    paymentMethods: [
      { id: "card", label: "Credit/Debit Card", enabled: true },
      { id: "upi", label: "UPI", enabled: true },
      { id: "cod", label: "Cash on Delivery", enabled: true }
    ],
    paymentSectionTitle: "Payment Method",
    paymentProvider: "razorpay",
    gatewayNoteMock: "Mock payment API is active. This flow is fully simulated for integration testing with no real charge.",
    gatewayNoteSandbox: "Payment gateway is integrated. If sandbox mode is enabled in Admin Settings, this flow is simulated with no real charge.",
    placeOrderLabel: "Place Order",
    placingOrderLabel: "Placing Order...",
    selectedPaymentPrefix: "Selected payment:",
    guestUpsell: {
      title: "Sign up now and claim your next-order reward",
      bodyTemplate: "Sign up now and get 10% off your next order with {coupon}. Save this order to your account and check out faster next time.",
      rewardCodeLabel: "Sign-up reward code:",
      emailTemplate: "Sign up with {email} to keep this order linked to your account.",
      supportTemplate: "Your order tracking is already going to {email}. Keep Order ID {orderId} for support.",
      ctaLabel: "Sign Up Now"
    }
  }
};

const asArray = (value) => (Array.isArray(value) ? value : []);
const asString = (value, fallback = "") => (typeof value === "string" ? value : fallback);
const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const withDefaultId = (value, prefix) => {
  if (value && typeof value === "string") {
    return value;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
};

const normalizeDateTimeString = (value) => (typeof value === "string" ? value.trim() : "");

const toTimestamp = (value) => {
  const normalized = normalizeDateTimeString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPromoCampaignStatus = (campaign, now = Date.now()) => {
  if (!campaign?.enabled) {
    return "disabled";
  }

  const startTs = toTimestamp(campaign.startAt);
  const endTs = toTimestamp(campaign.endAt);

  if (startTs !== null && now < startTs) {
    return "scheduled";
  }

  if (endTs !== null && now > endTs) {
    return "expired";
  }

  return "active";
};

const sortPromoCampaigns = (campaigns = []) => [...campaigns].sort((a, b) => {
  const byPriority = asNumber(a?.priority, 999) - asNumber(b?.priority, 999);
  if (byPriority !== 0) {
    return byPriority;
  }

  const aStart = toTimestamp(a?.startAt) ?? Number.MAX_SAFE_INTEGER;
  const bStart = toTimestamp(b?.startAt) ?? Number.MAX_SAFE_INTEGER;
  if (aStart !== bStart) {
    return aStart - bStart;
  }

  return String(a?.name || a?.text || a?.id || "").localeCompare(String(b?.name || b?.text || b?.id || ""));
});

const normalizePromoTargetUrl = (value, options = {}) => {
  const rawTarget = asString(value, "/products");
  if (!rawTarget.includes("?")) {
    return rawTarget;
  }

  const [path, queryString] = rawTarget.split("?");
  const params = new URLSearchParams(queryString || "");
  const offer = asString(params.get("offer"), "").trim().toLowerCase();
  const resolvedFreeShippingThreshold = asNumber(
    options.freeShippingThreshold,
    DEFAULT_FREE_SHIPPING_THRESHOLD
  );

  if (offer === "free-shipping" || offer === "threshold-offer") {
    const threshold = asString(params.get("cartMin") || params.get("minPrice"), "").trim();
    params.delete("minPrice");

    if (offer === "free-shipping") {
      params.delete("ids");
      params.delete("variantIds");
      params.delete("productId");
      params.delete("promoProduct");
      params.delete("category");
    }

    const nextThreshold = offer === "free-shipping" && resolvedFreeShippingThreshold > 0
      ? String(resolvedFreeShippingThreshold)
      : threshold;

    if (nextThreshold) {
      params.set("cartMin", nextThreshold);
    }
  }

  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
};

const normalizePromoCampaign = (campaign, options = {}) => {
  const displayMode = asString(campaign?.displayMode || campaign?.display_mode, "both").toLowerCase();
  const normalized = {
    id: withDefaultId(campaign?.id, "promo-campaign"),
    name: asString(campaign?.name, "Promo offer"),
    text: asString(campaign?.text || campaign?.banner_text, "Limited time offer"),
    to: normalizePromoTargetUrl(campaign?.to || campaign?.target_url || "/products", options),
    enabled: campaign?.enabled !== false,
    isPrimary: Boolean(campaign?.isPrimary ?? campaign?.is_primary),
    displayMode: ["banner", "silent", "both"].includes(displayMode) ? displayMode : "both",
    stackable: Boolean(campaign?.stackable ?? campaign?.actions?.stackable),
    conditions: campaign?.conditions && typeof campaign.conditions === "object" ? campaign.conditions : {},
    actions: campaign?.actions && typeof campaign.actions === "object" ? campaign.actions : {},
    startAt: normalizeDateTimeString(campaign?.startAt || campaign?.start_date),
    endAt: normalizeDateTimeString(campaign?.endAt || campaign?.end_date),
    priority: Math.max(1, asNumber(campaign?.priority, 1))
  };

  return {
    ...normalized,
    status: getPromoCampaignStatus(normalized)
  };
};

const resolveActivePromoStrip = (fallbackPromo, promoCampaigns = []) => {
  const activeCampaigns = sortPromoCampaigns(
    promoCampaigns.filter((campaign) => campaign?.status === "active" && (campaign?.displayMode || "both") !== "silent")
  );
  const primaryCampaign = activeCampaigns.find((campaign) => campaign.isPrimary) || activeCampaigns[0] || null;

  if (!primaryCampaign) {
    return {
      ...fallbackPromo,
      sourceCampaignId: "",
      sourceCampaignName: ""
    };
  }

  return {
    enabled: true,
    text: primaryCampaign.text,
    to: primaryCampaign.to,
    sourceCampaignId: primaryCampaign.id,
    sourceCampaignName: primaryCampaign.name,
    startAt: primaryCampaign.startAt,
    endAt: primaryCampaign.endAt
  };
};

const resolveVisiblePromoStrips = (fallbackPromo, promoCampaigns = []) => {
  const visibleItems = [];
  const seen = new Set();

  if (fallbackPromo?.enabled !== false) {
    const fallbackText = asString(fallbackPromo?.text, DEFAULT_SITE_CONTENT.offers.promoStrip.text);
    const fallbackTo = asString(fallbackPromo?.to, DEFAULT_SITE_CONTENT.offers.promoStrip.to);
    const fallbackKey = `${fallbackText}::${fallbackTo}`;
    seen.add(fallbackKey);
    visibleItems.push({
      id: "permanent-offer",
      text: fallbackText,
      to: fallbackTo,
      enabled: true,
      priority: 0,
      badge: "Always on",
      isFallback: true,
      status: "active"
    });
  }

  sortPromoCampaigns(
    promoCampaigns.filter((campaign) => campaign?.status === "active" && (campaign?.displayMode || "both") !== "silent")
  ).forEach((campaign) => {
    const text = asString(campaign?.text, "Limited time offer");
    const to = asString(campaign?.to, "/products");
    const key = `${text}::${to}`;

    if (!text || seen.has(key)) {
      return;
    }

    seen.add(key);
    visibleItems.push({
      id: withDefaultId(campaign?.id, "promo-banner"),
      text,
      to,
      enabled: true,
      priority: Math.max(1, asNumber(campaign?.priority, 100)),
      badge: campaign?.isPrimary ? "Featured" : "Seasonal",
      isFallback: false,
      status: asString(campaign?.status, "active")
    });
  });

  return visibleItems;
};

export function normalizeSiteContent(input) {
  const source = input && typeof input === "object" ? input : {};
  const brandSource = source.brand && typeof source.brand === "object" ? source.brand : {};
  const offerSource = source.offers && typeof source.offers === "object" ? source.offers : {};
  const promoSource = offerSource.promoStrip && typeof offerSource.promoStrip === "object" ? offerSource.promoStrip : {};
  const rawActivePromoSource = offerSource.activePromoStrip && typeof offerSource.activePromoStrip === "object"
    ? offerSource.activePromoStrip
    : null;
  const navbarSource = source.navbar && typeof source.navbar === "object" ? source.navbar : {};
  const footerSource = source.footer && typeof source.footer === "object" ? source.footer : {};
  const productsPageSource = source.productsPage && typeof source.productsPage === "object" ? source.productsPage : {};
  const homePageSource = source.homePage && typeof source.homePage === "object" ? source.homePage : {};
  const authPagesSource = source.authPages && typeof source.authPages === "object" ? source.authPages : {};
  const authLoginSource = authPagesSource.login && typeof authPagesSource.login === "object" ? authPagesSource.login : {};
  const authRegisterSource = authPagesSource.register && typeof authPagesSource.register === "object" ? authPagesSource.register : {};
  const authForgotSource = authPagesSource.forgotPassword && typeof authPagesSource.forgotPassword === "object"
    ? authPagesSource.forgotPassword
    : {};
  const authResetSource = authPagesSource.resetPassword && typeof authPagesSource.resetPassword === "object"
    ? authPagesSource.resetPassword
    : {};
  const navbarUiSource = navbarSource.ui && typeof navbarSource.ui === "object" ? navbarSource.ui : {};
  const footerUiSource = footerSource.ui && typeof footerSource.ui === "object" ? footerSource.ui : {};
  const cartPageSource = source.cartPage && typeof source.cartPage === "object" ? source.cartPage : {};
  const guestOrderTrackPageSource = source.guestOrderTrackPage && typeof source.guestOrderTrackPage === "object"
    ? source.guestOrderTrackPage
    : {};
  const confirmationPageSource = source.confirmationPage && typeof source.confirmationPage === "object"
    ? source.confirmationPage
    : {};
  const profilePageSource = source.profilePage && typeof source.profilePage === "object" ? source.profilePage : {};
  const ordersPageSource = source.ordersPage && typeof source.ordersPage === "object" ? source.ordersPage : {};
  const wishlistPageSource = source.wishlistPage && typeof source.wishlistPage === "object" ? source.wishlistPage : {};
  const productGridSource = source.productGrid && typeof source.productGrid === "object" ? source.productGrid : {};
  const productDetailPageSource = source.productDetailPage && typeof source.productDetailPage === "object"
    ? source.productDetailPage
    : {};
  const maintenancePageSource = source.maintenancePage && typeof source.maintenancePage === "object"
    ? source.maintenancePage
    : {};
  const checkoutSource = source.checkout && typeof source.checkout === "object" ? source.checkout : {};
  const checkoutGuestUpsellSource = checkoutSource.guestUpsell && typeof checkoutSource.guestUpsell === "object"
    ? checkoutSource.guestUpsell
    : {};
  const resolvedFreeShippingThreshold = asNumber(
    offerSource.freeShippingThreshold,
    DEFAULT_SITE_CONTENT.offers.freeShippingThreshold
  );

  const normalizedNavbarLinks = asArray(navbarSource.links)
    .filter((link) => link && typeof link === "object")
    .map((link) => ({
      id: withDefaultId(link.id, "nav"),
      label: asString(link.label, "Untitled"),
      to: normalizePromoTargetUrl(asString(link.to, "/"), { freeShippingThreshold: resolvedFreeShippingThreshold }),
      enabled: link.enabled !== false,
      requiresAuth: Boolean(link.requiresAuth),
      adminOnly: Boolean(link.adminOnly)
    }));

  const normalizedFooterSections = asArray(footerSource.sections)
    .filter((section) => section && typeof section === "object")
    .map((section) => ({
      id: withDefaultId(section.id, "footer-section"),
      title: asString(section.title, "Section"),
      links: asArray(section.links)
        .filter((link) => link && typeof link === "object")
        .map((link) => ({
          id: withDefaultId(link.id, "footer-link"),
          label: asString(link.label, "Link"),
          to: normalizePromoTargetUrl(asString(link.to, "/"), { freeShippingThreshold: resolvedFreeShippingThreshold }),
          type: link.type === "external" ? "external" : "internal"
        }))
    }));

  const normalizedPaymentMethods = asArray(checkoutSource.paymentMethods)
    .filter((method) => method && typeof method === "object")
    .map((method) => {
      const id = asString(method.id).toLowerCase();
      if (!["card", "upi", "cod"].includes(id)) {
        return null;
      }

      return {
        id,
        label: asString(
          method.label,
          DEFAULT_SITE_CONTENT.checkout.paymentMethods.find((item) => item.id === id)?.label || id.toUpperCase()
        ),
        enabled: method.enabled !== false
      };
    })
    .filter(Boolean);

  const normalizedHeroSlides = asArray(homePageSource.heroSlides)
    .filter((slide) => slide && typeof slide === "object")
    .map((slide) => ({
      id: withDefaultId(slide.id, "hero"),
      title: asString(slide.title, "Banner title"),
      subtitle: asString(slide.subtitle, "Banner subtitle"),
      image: asString(slide.image, ""),
      ctaLabel: asString(slide.ctaLabel, "Shop now"),
      ctaTo: normalizePromoTargetUrl(asString(slide.ctaTo, "/products"), { freeShippingThreshold: resolvedFreeShippingThreshold })
    }))
    .filter((slide) => slide.image);

  const manualPromoStrip = {
    enabled: promoSource.enabled !== false,
    text: asString(promoSource.text, DEFAULT_SITE_CONTENT.offers.promoStrip.text),
    to: normalizePromoTargetUrl(asString(promoSource.to, DEFAULT_SITE_CONTENT.offers.promoStrip.to), {
      freeShippingThreshold: resolvedFreeShippingThreshold
    })
  };
  const normalizedPromoCampaigns = sortPromoCampaigns(
    asArray(offerSource.promoCampaigns)
      .filter((campaign) => campaign && typeof campaign === "object")
      .map((campaign) => normalizePromoCampaign(campaign, { freeShippingThreshold: resolvedFreeShippingThreshold }))
  );
  const providedActivePromoCampaigns = sortPromoCampaigns(
    asArray(offerSource.activePromoCampaigns)
      .filter((campaign) => campaign && typeof campaign === "object")
      .map((campaign) => ({
        id: withDefaultId(campaign.id, "promo-campaign"),
        name: asString(campaign.name, "Promo offer"),
        text: asString(campaign.text, "Limited time offer"),
        to: asString(campaign.to, "/products"),
        priority: Math.max(1, asNumber(campaign.priority, 100)),
        status: asString(campaign.status, "active"),
        displayMode: asString(campaign.displayMode, "both"),
        isPrimary: Boolean(campaign.isPrimary),
      }))
  );
  const activePromoCampaigns = providedActivePromoCampaigns.length > 0
    ? providedActivePromoCampaigns
    : normalizedPromoCampaigns.filter((campaign) => campaign.status === "active");
  const activePromoSource = rawActivePromoSource && (
    asString(rawActivePromoSource.sourceCampaignId || rawActivePromoSource.sourcePromotionId, "") ||
    asString(rawActivePromoSource.sourceCampaignName || rawActivePromoSource.sourcePromotionName, "") ||
    activePromoCampaigns.length > 0
  )
    ? rawActivePromoSource
    : null;
  const activePromoStrip = activePromoSource
    ? {
        enabled: activePromoSource.enabled !== false,
        text: asString(activePromoSource.text, manualPromoStrip.text),
        to: normalizePromoTargetUrl(asString(activePromoSource.to, manualPromoStrip.to), {
          freeShippingThreshold: resolvedFreeShippingThreshold
        }),
        sourceCampaignId: asString(activePromoSource.sourceCampaignId || activePromoSource.sourcePromotionId, ""),
        sourceCampaignName: asString(activePromoSource.sourceCampaignName || activePromoSource.sourcePromotionName, ""),
        startAt: normalizeDateTimeString(activePromoSource.startAt),
        endAt: normalizeDateTimeString(activePromoSource.endAt)
      }
    : resolveActivePromoStrip(manualPromoStrip, normalizedPromoCampaigns);
  const visiblePromoStrips = resolveVisiblePromoStrips(manualPromoStrip, activePromoCampaigns);

  const normalizedPrimaryCategories = asArray(homePageSource.primaryCategories)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: withDefaultId(item.id, "home-category"),
      label: asString(item.label, "Category"),
      to: asString(item.to, "/products"),
      image: asString(item.image, "")
    }))
    .filter((item) => item.image);

  const normalizedSpotlightCards = asArray(homePageSource.spotlightCards)
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const tone = asString(item.tone, "warm").toLowerCase();
      return {
        id: withDefaultId(item.id, "spotlight"),
        title: asString(item.title, "Spotlight"),
        subtitle: asString(item.subtitle, ""),
        to: asString(item.to, "/products"),
        tone: ["warm", "mint", "sky"].includes(tone) ? tone : "warm"
      };
    });

  const normalizedTrustBadges = asArray(homePageSource.trustBadges)
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim());

  const homeCategorySectionSource = homePageSource.categorySection && typeof homePageSource.categorySection === "object"
    ? homePageSource.categorySection
    : {};
  const homeDealBannersSource = homePageSource.dealBanners && typeof homePageSource.dealBanners === "object"
    ? homePageSource.dealBanners
    : {};
  const homeFeaturedSectionSource = homePageSource.featuredSection && typeof homePageSource.featuredSection === "object"
    ? homePageSource.featuredSection
    : {};
  const homeTopSellingSectionSource = homePageSource.topSellingSection && typeof homePageSource.topSellingSection === "object"
    ? homePageSource.topSellingSection
    : {};
  const homeNewArrivalsSectionSource = homePageSource.newArrivalsSection && typeof homePageSource.newArrivalsSection === "object"
    ? homePageSource.newArrivalsSection
    : {};
  const homeReviewsSectionSource = homePageSource.reviewsSection && typeof homePageSource.reviewsSection === "object"
    ? homePageSource.reviewsSection
    : {};

  return {
    brand: {
      name: asString(brandSource.name, DEFAULT_SITE_CONTENT.brand.name),
      tagline: asString(brandSource.tagline, DEFAULT_SITE_CONTENT.brand.tagline),
      supportEmail: asString(brandSource.supportEmail, DEFAULT_SITE_CONTENT.brand.supportEmail),
      supportPhone: asString(brandSource.supportPhone, DEFAULT_SITE_CONTENT.brand.supportPhone),
      supportHours: asString(brandSource.supportHours, DEFAULT_SITE_CONTENT.brand.supportHours)
    },
    offers: {
      promoStrip: manualPromoStrip,
      activePromoStrip,
      visiblePromoStrips,
      promoCampaigns: normalizedPromoCampaigns,
      activePromoCampaigns,
      freeShippingThreshold: resolvedFreeShippingThreshold,
      standardShippingFee: asNumber(
        offerSource.standardShippingFee,
        DEFAULT_SITE_CONTENT.offers.standardShippingFee
      ),
      freeShippingProgressTemplate: asString(
        offerSource.freeShippingProgressTemplate,
        DEFAULT_SITE_CONTENT.offers.freeShippingProgressTemplate
      ),
      freeShippingUnlockedText: asString(
        offerSource.freeShippingUnlockedText,
        DEFAULT_SITE_CONTENT.offers.freeShippingUnlockedText
      )
    },
    navbar: {
      ui: {
        mobileToggleAriaLabel: asString(navbarUiSource.mobileToggleAriaLabel, DEFAULT_SITE_CONTENT.navbar.ui.mobileToggleAriaLabel),
        mobileMenuLabel: asString(navbarUiSource.mobileMenuLabel, DEFAULT_SITE_CONTENT.navbar.ui.mobileMenuLabel),
        mobileCloseLabel: asString(navbarUiSource.mobileCloseLabel, DEFAULT_SITE_CONTENT.navbar.ui.mobileCloseLabel),
        adminLinkLabel: asString(navbarUiSource.adminLinkLabel, DEFAULT_SITE_CONTENT.navbar.ui.adminLinkLabel),
        searchPlaceholder: asString(navbarUiSource.searchPlaceholder, DEFAULT_SITE_CONTENT.navbar.ui.searchPlaceholder),
        searchButtonLabel: asString(navbarUiSource.searchButtonLabel, DEFAULT_SITE_CONTENT.navbar.ui.searchButtonLabel),
        searchSuggestionsAriaLabel: asString(navbarUiSource.searchSuggestionsAriaLabel, DEFAULT_SITE_CONTENT.navbar.ui.searchSuggestionsAriaLabel),
        noSearchSuggestionsText: asString(navbarUiSource.noSearchSuggestionsText, DEFAULT_SITE_CONTENT.navbar.ui.noSearchSuggestionsText),
        accountDefaultLabel: asString(navbarUiSource.accountDefaultLabel, DEFAULT_SITE_CONTENT.navbar.ui.accountDefaultLabel),
        accountHeadingLoggedIn: asString(navbarUiSource.accountHeadingLoggedIn, DEFAULT_SITE_CONTENT.navbar.ui.accountHeadingLoggedIn),
        accountHeadingGuest: asString(navbarUiSource.accountHeadingGuest, DEFAULT_SITE_CONTENT.navbar.ui.accountHeadingGuest),
        profileLabel: asString(navbarUiSource.profileLabel, DEFAULT_SITE_CONTENT.navbar.ui.profileLabel),
        ordersLabel: asString(navbarUiSource.ordersLabel, DEFAULT_SITE_CONTENT.navbar.ui.ordersLabel),
        cartLabel: asString(navbarUiSource.cartLabel, DEFAULT_SITE_CONTENT.navbar.ui.cartLabel),
        adminPanelLabel: asString(navbarUiSource.adminPanelLabel, DEFAULT_SITE_CONTENT.navbar.ui.adminPanelLabel),
        logoutLabel: asString(navbarUiSource.logoutLabel, DEFAULT_SITE_CONTENT.navbar.ui.logoutLabel),
        loginLabel: asString(navbarUiSource.loginLabel, DEFAULT_SITE_CONTENT.navbar.ui.loginLabel),
        signUpLabel: asString(navbarUiSource.signUpLabel, DEFAULT_SITE_CONTENT.navbar.ui.signUpLabel),
        wishlistLabel: asString(navbarUiSource.wishlistLabel, DEFAULT_SITE_CONTENT.navbar.ui.wishlistLabel),
        shopByCategoriesLabel: asString(navbarUiSource.shopByCategoriesLabel, DEFAULT_SITE_CONTENT.navbar.ui.shopByCategoriesLabel),
        homeLabel: asString(navbarUiSource.homeLabel, DEFAULT_SITE_CONTENT.navbar.ui.homeLabel),
        allCategoryLabel: asString(navbarUiSource.allCategoryLabel, DEFAULT_SITE_CONTENT.navbar.ui.allCategoryLabel)
      },
      links: normalizedNavbarLinks.length ? normalizedNavbarLinks : DEFAULT_SITE_CONTENT.navbar.links
    },
    footer: {
      ui: {
        copyrightTemplate: asString(footerUiSource.copyrightTemplate, DEFAULT_SITE_CONTENT.footer.ui.copyrightTemplate)
      },
      sections: normalizedFooterSections.length ? normalizedFooterSections : DEFAULT_SITE_CONTENT.footer.sections,
      paymentBadges: asArray(footerSource.paymentBadges)
        .filter((badge) => typeof badge === "string" && badge.trim())
        .map((badge) => badge.trim())
    },
    productsPage: {
      heroKicker: asString(productsPageSource.heroKicker, DEFAULT_SITE_CONTENT.productsPage.heroKicker),
      heroTitle: asString(productsPageSource.heroTitle, DEFAULT_SITE_CONTENT.productsPage.heroTitle),
      heroDescription: asString(productsPageSource.heroDescription, DEFAULT_SITE_CONTENT.productsPage.heroDescription),
      freeShippingLabelTemplate: asString(
        productsPageSource.freeShippingLabelTemplate,
        DEFAULT_SITE_CONTENT.productsPage.freeShippingLabelTemplate
      ),
      loadingText: asString(productsPageSource.loadingText, DEFAULT_SITE_CONTENT.productsPage.loadingText),
      filtersAriaLabel: asString(productsPageSource.filtersAriaLabel, DEFAULT_SITE_CONTENT.productsPage.filtersAriaLabel),
      categoryLabel: asString(productsPageSource.categoryLabel, DEFAULT_SITE_CONTENT.productsPage.categoryLabel),
      allCategoryOption: asString(productsPageSource.allCategoryOption, DEFAULT_SITE_CONTENT.productsPage.allCategoryOption),
      sortLabel: asString(productsPageSource.sortLabel, DEFAULT_SITE_CONTENT.productsPage.sortLabel),
      sortOptions: {
        relevance: asString(productsPageSource.sortOptions?.relevance, DEFAULT_SITE_CONTENT.productsPage.sortOptions.relevance),
        priceAsc: asString(productsPageSource.sortOptions?.priceAsc, DEFAULT_SITE_CONTENT.productsPage.sortOptions.priceAsc),
        priceDesc: asString(productsPageSource.sortOptions?.priceDesc, DEFAULT_SITE_CONTENT.productsPage.sortOptions.priceDesc),
        rating: asString(productsPageSource.sortOptions?.rating, DEFAULT_SITE_CONTENT.productsPage.sortOptions.rating),
        name: asString(productsPageSource.sortOptions?.name, DEFAULT_SITE_CONTENT.productsPage.sortOptions.name)
      },
      maxPriceLabel: asString(productsPageSource.maxPriceLabel, DEFAULT_SITE_CONTENT.productsPage.maxPriceLabel),
      clearPriceCapLabel: asString(productsPageSource.clearPriceCapLabel, DEFAULT_SITE_CONTENT.productsPage.clearPriceCapLabel),
      showingTemplate: asString(productsPageSource.showingTemplate, DEFAULT_SITE_CONTENT.productsPage.showingTemplate),
      searchChipPrefix: asString(productsPageSource.searchChipPrefix, DEFAULT_SITE_CONTENT.productsPage.searchChipPrefix),
      categoryChipPrefix: asString(productsPageSource.categoryChipPrefix, DEFAULT_SITE_CONTENT.productsPage.categoryChipPrefix)
    },
    homePage: {
      announcement: asString(homePageSource.announcement, DEFAULT_SITE_CONTENT.homePage.announcement),
      heroSlides: normalizedHeroSlides.length ? normalizedHeroSlides : DEFAULT_SITE_CONTENT.homePage.heroSlides,
      trustBadges: normalizedTrustBadges.length
        ? normalizedTrustBadges
        : DEFAULT_SITE_CONTENT.homePage.trustBadges,
      primaryCategories: normalizedPrimaryCategories.length
        ? normalizedPrimaryCategories
        : DEFAULT_SITE_CONTENT.homePage.primaryCategories,
      spotlightCards: normalizedSpotlightCards.length
        ? normalizedSpotlightCards
        : DEFAULT_SITE_CONTENT.homePage.spotlightCards,
      categorySection: {
        kicker: asString(homeCategorySectionSource.kicker, DEFAULT_SITE_CONTENT.homePage.categorySection.kicker),
        title: asString(homeCategorySectionSource.title, DEFAULT_SITE_CONTENT.homePage.categorySection.title),
        ctaLabel: asString(homeCategorySectionSource.ctaLabel, DEFAULT_SITE_CONTENT.homePage.categorySection.ctaLabel),
        tileCtaLabel: asString(homeCategorySectionSource.tileCtaLabel, DEFAULT_SITE_CONTENT.homePage.categorySection.tileCtaLabel)
      },
      dealBanners: {
        primaryKicker: asString(homeDealBannersSource.primaryKicker, DEFAULT_SITE_CONTENT.homePage.dealBanners.primaryKicker),
        primaryCtaLabel: asString(homeDealBannersSource.primaryCtaLabel, DEFAULT_SITE_CONTENT.homePage.dealBanners.primaryCtaLabel),
        secondaryKicker: asString(homeDealBannersSource.secondaryKicker, DEFAULT_SITE_CONTENT.homePage.dealBanners.secondaryKicker),
        secondaryCtaLabel: asString(homeDealBannersSource.secondaryCtaLabel, DEFAULT_SITE_CONTENT.homePage.dealBanners.secondaryCtaLabel)
      },
      featuredSection: {
        kicker: asString(homeFeaturedSectionSource.kicker, DEFAULT_SITE_CONTENT.homePage.featuredSection.kicker),
        title: asString(homeFeaturedSectionSource.title, DEFAULT_SITE_CONTENT.homePage.featuredSection.title),
        ctaLabel: asString(homeFeaturedSectionSource.ctaLabel, DEFAULT_SITE_CONTENT.homePage.featuredSection.ctaLabel)
      },
      topSellingSection: {
        kicker: asString(homeTopSellingSectionSource.kicker, DEFAULT_SITE_CONTENT.homePage.topSellingSection.kicker),
        title: asString(homeTopSellingSectionSource.title, DEFAULT_SITE_CONTENT.homePage.topSellingSection.title),
        ctaLabel: asString(homeTopSellingSectionSource.ctaLabel, DEFAULT_SITE_CONTENT.homePage.topSellingSection.ctaLabel),
        ratingTemplate: asString(homeTopSellingSectionSource.ratingTemplate, DEFAULT_SITE_CONTENT.homePage.topSellingSection.ratingTemplate)
      },
      newArrivalsSection: {
        kicker: asString(homeNewArrivalsSectionSource.kicker, DEFAULT_SITE_CONTENT.homePage.newArrivalsSection.kicker),
        title: asString(homeNewArrivalsSectionSource.title, DEFAULT_SITE_CONTENT.homePage.newArrivalsSection.title),
        ctaLabel: asString(homeNewArrivalsSectionSource.ctaLabel, DEFAULT_SITE_CONTENT.homePage.newArrivalsSection.ctaLabel)
      },
      reviewsSection: {
        kicker: asString(homeReviewsSectionSource.kicker, DEFAULT_SITE_CONTENT.homePage.reviewsSection.kicker),
        title: asString(homeReviewsSectionSource.title, DEFAULT_SITE_CONTENT.homePage.reviewsSection.title),
        ctaLabel: asString(homeReviewsSectionSource.ctaLabel, DEFAULT_SITE_CONTENT.homePage.reviewsSection.ctaLabel),
        productPrefix: asString(homeReviewsSectionSource.productPrefix, DEFAULT_SITE_CONTENT.homePage.reviewsSection.productPrefix),
        emptyText: asString(homeReviewsSectionSource.emptyText, DEFAULT_SITE_CONTENT.homePage.reviewsSection.emptyText)
      }
    },
    cartPage: {
      title: asString(cartPageSource.title, DEFAULT_SITE_CONTENT.cartPage.title),
      loadingText: asString(cartPageSource.loadingText, DEFAULT_SITE_CONTENT.cartPage.loadingText),
      emptyTitle: asString(cartPageSource.emptyTitle, DEFAULT_SITE_CONTENT.cartPage.emptyTitle),
      emptyDescription: asString(cartPageSource.emptyDescription, DEFAULT_SITE_CONTENT.cartPage.emptyDescription),
      continueShoppingLabel: asString(
        cartPageSource.continueShoppingLabel,
        DEFAULT_SITE_CONTENT.cartPage.continueShoppingLabel
      ),
      summaryTitle: asString(cartPageSource.summaryTitle, DEFAULT_SITE_CONTENT.cartPage.summaryTitle),
      subtotalLabel: asString(cartPageSource.subtotalLabel, DEFAULT_SITE_CONTENT.cartPage.subtotalLabel),
      shippingLabel: asString(cartPageSource.shippingLabel, DEFAULT_SITE_CONTENT.cartPage.shippingLabel),
      totalLabel: asString(cartPageSource.totalLabel, DEFAULT_SITE_CONTENT.cartPage.totalLabel),
      checkoutLabel: asString(cartPageSource.checkoutLabel, DEFAULT_SITE_CONTENT.cartPage.checkoutLabel)
    },
    guestOrderTrackPage: {
      title: asString(guestOrderTrackPageSource.title, DEFAULT_SITE_CONTENT.guestOrderTrackPage.title),
      description: asString(
        guestOrderTrackPageSource.description,
        DEFAULT_SITE_CONTENT.guestOrderTrackPage.description
      ),
      orderNumberLabel: asString(
        guestOrderTrackPageSource.orderNumberLabel,
        DEFAULT_SITE_CONTENT.guestOrderTrackPage.orderNumberLabel
      ),
      orderNumberPlaceholder: asString(
        guestOrderTrackPageSource.orderNumberPlaceholder,
        DEFAULT_SITE_CONTENT.guestOrderTrackPage.orderNumberPlaceholder
      ),
      emailLabel: asString(guestOrderTrackPageSource.emailLabel, DEFAULT_SITE_CONTENT.guestOrderTrackPage.emailLabel),
      emailPlaceholder: asString(
        guestOrderTrackPageSource.emailPlaceholder,
        DEFAULT_SITE_CONTENT.guestOrderTrackPage.emailPlaceholder
      ),
      submitLabel: asString(guestOrderTrackPageSource.submitLabel, DEFAULT_SITE_CONTENT.guestOrderTrackPage.submitLabel),
      submitLoadingLabel: asString(
        guestOrderTrackPageSource.submitLoadingLabel,
        DEFAULT_SITE_CONTENT.guestOrderTrackPage.submitLoadingLabel
      ),
      summaryTitle: asString(
        guestOrderTrackPageSource.summaryTitle,
        DEFAULT_SITE_CONTENT.guestOrderTrackPage.summaryTitle
      ),
      statusLabel: asString(guestOrderTrackPageSource.statusLabel, DEFAULT_SITE_CONTENT.guestOrderTrackPage.statusLabel),
      paymentLabel: asString(
        guestOrderTrackPageSource.paymentLabel,
        DEFAULT_SITE_CONTENT.guestOrderTrackPage.paymentLabel
      ),
      totalLabel: asString(guestOrderTrackPageSource.totalLabel, DEFAULT_SITE_CONTENT.guestOrderTrackPage.totalLabel),
      placedLabel: asString(guestOrderTrackPageSource.placedLabel, DEFAULT_SITE_CONTENT.guestOrderTrackPage.placedLabel),
      itemsTitle: asString(guestOrderTrackPageSource.itemsTitle, DEFAULT_SITE_CONTENT.guestOrderTrackPage.itemsTitle),
      updatesTitle: asString(
        guestOrderTrackPageSource.updatesTitle,
        DEFAULT_SITE_CONTENT.guestOrderTrackPage.updatesTitle
      )
    },
    confirmationPage: {
      missingTitle: asString(confirmationPageSource.missingTitle, DEFAULT_SITE_CONTENT.confirmationPage.missingTitle),
      missingDescription: asString(
        confirmationPageSource.missingDescription,
        DEFAULT_SITE_CONTENT.confirmationPage.missingDescription
      ),
      successTitle: asString(confirmationPageSource.successTitle, DEFAULT_SITE_CONTENT.confirmationPage.successTitle),
      orderIdLabel: asString(confirmationPageSource.orderIdLabel, DEFAULT_SITE_CONTENT.confirmationPage.orderIdLabel),
      orderNumberLabel: asString(
        confirmationPageSource.orderNumberLabel,
        DEFAULT_SITE_CONTENT.confirmationPage.orderNumberLabel
      ),
      totalPaidLabel: asString(
        confirmationPageSource.totalPaidLabel,
        DEFAULT_SITE_CONTENT.confirmationPage.totalPaidLabel
      ),
      paymentMethodLabel: asString(
        confirmationPageSource.paymentMethodLabel,
        DEFAULT_SITE_CONTENT.confirmationPage.paymentMethodLabel
      ),
      gatewayLabel: asString(confirmationPageSource.gatewayLabel, DEFAULT_SITE_CONTENT.confirmationPage.gatewayLabel),
      shippingAddressLabel: asString(
        confirmationPageSource.shippingAddressLabel,
        DEFAULT_SITE_CONTENT.confirmationPage.shippingAddressLabel
      ),
      gatewayReferenceTitle: asString(
        confirmationPageSource.gatewayReferenceTitle,
        DEFAULT_SITE_CONTENT.confirmationPage.gatewayReferenceTitle
      ),
      gatewayOrderIdLabel: asString(
        confirmationPageSource.gatewayOrderIdLabel,
        DEFAULT_SITE_CONTENT.confirmationPage.gatewayOrderIdLabel
      ),
      gatewayPaymentIdLabel: asString(
        confirmationPageSource.gatewayPaymentIdLabel,
        DEFAULT_SITE_CONTENT.confirmationPage.gatewayPaymentIdLabel
      ),
      gatewaySignatureLabel: asString(
        confirmationPageSource.gatewaySignatureLabel,
        DEFAULT_SITE_CONTENT.confirmationPage.gatewaySignatureLabel
      ),
      itemsTitle: asString(confirmationPageSource.itemsTitle, DEFAULT_SITE_CONTENT.confirmationPage.itemsTitle),
      guestConfirmedTitle: asString(
        confirmationPageSource.guestConfirmedTitle,
        DEFAULT_SITE_CONTENT.confirmationPage.guestConfirmedTitle
      ),
      guestTrackingTemplate: asString(
        confirmationPageSource.guestTrackingTemplate,
        DEFAULT_SITE_CONTENT.confirmationPage.guestTrackingTemplate
      ),
      viewOrdersLabel: asString(
        confirmationPageSource.viewOrdersLabel,
        DEFAULT_SITE_CONTENT.confirmationPage.viewOrdersLabel
      ),
      continueShoppingLabel: asString(
        confirmationPageSource.continueShoppingLabel,
        DEFAULT_SITE_CONTENT.confirmationPage.continueShoppingLabel
      )
    },
    authPages: {
      login: {
        title: asString(authLoginSource.title, DEFAULT_SITE_CONTENT.authPages.login.title),
        emailPlaceholder: asString(authLoginSource.emailPlaceholder, DEFAULT_SITE_CONTENT.authPages.login.emailPlaceholder),
        passwordPlaceholder: asString(authLoginSource.passwordPlaceholder, DEFAULT_SITE_CONTENT.authPages.login.passwordPlaceholder),
        rememberMeLabel: asString(authLoginSource.rememberMeLabel, DEFAULT_SITE_CONTENT.authPages.login.rememberMeLabel),
        forgotPasswordLabel: asString(authLoginSource.forgotPasswordLabel, DEFAULT_SITE_CONTENT.authPages.login.forgotPasswordLabel),
        loadingLabel: asString(authLoginSource.loadingLabel, DEFAULT_SITE_CONTENT.authPages.login.loadingLabel),
        submitLabel: asString(authLoginSource.submitLabel, DEFAULT_SITE_CONTENT.authPages.login.submitLabel),
        invalidCredentialsText: asString(authLoginSource.invalidCredentialsText, DEFAULT_SITE_CONTENT.authPages.login.invalidCredentialsText),
        networkErrorText: asString(authLoginSource.networkErrorText, DEFAULT_SITE_CONTENT.authPages.login.networkErrorText)
      },
      register: {
        title: asString(authRegisterSource.title, DEFAULT_SITE_CONTENT.authPages.register.title),
        rewardPrefix: asString(authRegisterSource.rewardPrefix, DEFAULT_SITE_CONTENT.authPages.register.rewardPrefix),
        firstNamePlaceholder: asString(authRegisterSource.firstNamePlaceholder, DEFAULT_SITE_CONTENT.authPages.register.firstNamePlaceholder),
        lastNamePlaceholder: asString(authRegisterSource.lastNamePlaceholder, DEFAULT_SITE_CONTENT.authPages.register.lastNamePlaceholder),
        emailPlaceholder: asString(authRegisterSource.emailPlaceholder, DEFAULT_SITE_CONTENT.authPages.register.emailPlaceholder),
        passwordPlaceholder: asString(authRegisterSource.passwordPlaceholder, DEFAULT_SITE_CONTENT.authPages.register.passwordPlaceholder),
        phonePlaceholder: asString(authRegisterSource.phonePlaceholder, DEFAULT_SITE_CONTENT.authPages.register.phonePlaceholder),
        dobPlaceholder: asString(authRegisterSource.dobPlaceholder, DEFAULT_SITE_CONTENT.authPages.register.dobPlaceholder),
        submitLabel: asString(authRegisterSource.submitLabel, DEFAULT_SITE_CONTENT.authPages.register.submitLabel),
        alreadyRegisteredPrefix: asString(authRegisterSource.alreadyRegisteredPrefix, DEFAULT_SITE_CONTENT.authPages.register.alreadyRegisteredPrefix),
        loginHereLabel: asString(authRegisterSource.loginHereLabel, DEFAULT_SITE_CONTENT.authPages.register.loginHereLabel),
        successRedirectMessage: asString(authRegisterSource.successRedirectMessage, DEFAULT_SITE_CONTENT.authPages.register.successRedirectMessage),
        validationPasswordText: asString(authRegisterSource.validationPasswordText, DEFAULT_SITE_CONTENT.authPages.register.validationPasswordText),
        validationPhoneText: asString(authRegisterSource.validationPhoneText, DEFAULT_SITE_CONTENT.authPages.register.validationPhoneText),
        validationDobRequiredText: asString(authRegisterSource.validationDobRequiredText, DEFAULT_SITE_CONTENT.authPages.register.validationDobRequiredText),
        validationDobPastText: asString(authRegisterSource.validationDobPastText, DEFAULT_SITE_CONTENT.authPages.register.validationDobPastText),
        validationAgeText: asString(authRegisterSource.validationAgeText, DEFAULT_SITE_CONTENT.authPages.register.validationAgeText),
        registrationFailedText: asString(authRegisterSource.registrationFailedText, DEFAULT_SITE_CONTENT.authPages.register.registrationFailedText),
        networkErrorText: asString(authRegisterSource.networkErrorText, DEFAULT_SITE_CONTENT.authPages.register.networkErrorText)
      },
      forgotPassword: {
        title: asString(authForgotSource.title, DEFAULT_SITE_CONTENT.authPages.forgotPassword.title),
        subtitle: asString(authForgotSource.subtitle, DEFAULT_SITE_CONTENT.authPages.forgotPassword.subtitle),
        emailPlaceholder: asString(authForgotSource.emailPlaceholder, DEFAULT_SITE_CONTENT.authPages.forgotPassword.emailPlaceholder),
        loadingLabel: asString(authForgotSource.loadingLabel, DEFAULT_SITE_CONTENT.authPages.forgotPassword.loadingLabel),
        submitLabel: asString(authForgotSource.submitLabel, DEFAULT_SITE_CONTENT.authPages.forgotPassword.submitLabel),
        devResetLinkPrefix: asString(authForgotSource.devResetLinkPrefix, DEFAULT_SITE_CONTENT.authPages.forgotPassword.devResetLinkPrefix),
        devResetLinkLabel: asString(authForgotSource.devResetLinkLabel, DEFAULT_SITE_CONTENT.authPages.forgotPassword.devResetLinkLabel),
        devResetTokenPrefix: asString(authForgotSource.devResetTokenPrefix, DEFAULT_SITE_CONTENT.authPages.forgotPassword.devResetTokenPrefix),
        rememberPasswordPrefix: asString(authForgotSource.rememberPasswordPrefix, DEFAULT_SITE_CONTENT.authPages.forgotPassword.rememberPasswordPrefix),
        backToLoginLabel: asString(authForgotSource.backToLoginLabel, DEFAULT_SITE_CONTENT.authPages.forgotPassword.backToLoginLabel),
        failedRequestText: asString(authForgotSource.failedRequestText, DEFAULT_SITE_CONTENT.authPages.forgotPassword.failedRequestText),
        fallbackSuccessText: asString(authForgotSource.fallbackSuccessText, DEFAULT_SITE_CONTENT.authPages.forgotPassword.fallbackSuccessText),
        networkErrorText: asString(authForgotSource.networkErrorText, DEFAULT_SITE_CONTENT.authPages.forgotPassword.networkErrorText)
      },
      resetPassword: {
        title: asString(authResetSource.title, DEFAULT_SITE_CONTENT.authPages.resetPassword.title),
        subtitle: asString(authResetSource.subtitle, DEFAULT_SITE_CONTENT.authPages.resetPassword.subtitle),
        tokenPlaceholder: asString(authResetSource.tokenPlaceholder, DEFAULT_SITE_CONTENT.authPages.resetPassword.tokenPlaceholder),
        passwordPlaceholder: asString(authResetSource.passwordPlaceholder, DEFAULT_SITE_CONTENT.authPages.resetPassword.passwordPlaceholder),
        confirmPasswordPlaceholder: asString(authResetSource.confirmPasswordPlaceholder, DEFAULT_SITE_CONTENT.authPages.resetPassword.confirmPasswordPlaceholder),
        loadingLabel: asString(authResetSource.loadingLabel, DEFAULT_SITE_CONTENT.authPages.resetPassword.loadingLabel),
        submitLabel: asString(authResetSource.submitLabel, DEFAULT_SITE_CONTENT.authPages.resetPassword.submitLabel),
        backToLoginPrefix: asString(authResetSource.backToLoginPrefix, DEFAULT_SITE_CONTENT.authPages.resetPassword.backToLoginPrefix),
        backToLoginLabel: asString(authResetSource.backToLoginLabel, DEFAULT_SITE_CONTENT.authPages.resetPassword.backToLoginLabel),
        tokenRequiredText: asString(authResetSource.tokenRequiredText, DEFAULT_SITE_CONTENT.authPages.resetPassword.tokenRequiredText),
        passwordMismatchText: asString(authResetSource.passwordMismatchText, DEFAULT_SITE_CONTENT.authPages.resetPassword.passwordMismatchText),
        passwordMinText: asString(authResetSource.passwordMinText, DEFAULT_SITE_CONTENT.authPages.resetPassword.passwordMinText),
        failedText: asString(authResetSource.failedText, DEFAULT_SITE_CONTENT.authPages.resetPassword.failedText),
        successText: asString(authResetSource.successText, DEFAULT_SITE_CONTENT.authPages.resetPassword.successText),
        networkErrorText: asString(authResetSource.networkErrorText, DEFAULT_SITE_CONTENT.authPages.resetPassword.networkErrorText)
      }
    },
    profilePage: {
      loginRequiredText: asString(profilePageSource.loginRequiredText, DEFAULT_SITE_CONTENT.profilePage.loginRequiredText),
      loadingText: asString(profilePageSource.loadingText, DEFAULT_SITE_CONTENT.profilePage.loadingText),
      title: asString(profilePageSource.title, DEFAULT_SITE_CONTENT.profilePage.title),
      firstNameLabel: asString(profilePageSource.firstNameLabel, DEFAULT_SITE_CONTENT.profilePage.firstNameLabel),
      lastNameLabel: asString(profilePageSource.lastNameLabel, DEFAULT_SITE_CONTENT.profilePage.lastNameLabel),
      phoneLabel: asString(profilePageSource.phoneLabel, DEFAULT_SITE_CONTENT.profilePage.phoneLabel),
      dobLabel: asString(profilePageSource.dobLabel, DEFAULT_SITE_CONTENT.profilePage.dobLabel),
      emailLabel: asString(profilePageSource.emailLabel, DEFAULT_SITE_CONTENT.profilePage.emailLabel),
      memberSinceLabel: asString(profilePageSource.memberSinceLabel, DEFAULT_SITE_CONTENT.profilePage.memberSinceLabel),
      saveLabel: asString(profilePageSource.saveLabel, DEFAULT_SITE_CONTENT.profilePage.saveLabel),
      savingLabel: asString(profilePageSource.savingLabel, DEFAULT_SITE_CONTENT.profilePage.savingLabel),
      saveSuccessText: asString(profilePageSource.saveSuccessText, DEFAULT_SITE_CONTENT.profilePage.saveSuccessText),
      saveFailedText: asString(profilePageSource.saveFailedText, DEFAULT_SITE_CONTENT.profilePage.saveFailedText),
      loadFailedText: asString(profilePageSource.loadFailedText, DEFAULT_SITE_CONTENT.profilePage.loadFailedText),
      networkErrorText: asString(profilePageSource.networkErrorText, DEFAULT_SITE_CONTENT.profilePage.networkErrorText)
    },
    ordersPage: {
      loginRequiredText: asString(ordersPageSource.loginRequiredText, DEFAULT_SITE_CONTENT.ordersPage.loginRequiredText),
      loadingText: asString(ordersPageSource.loadingText, DEFAULT_SITE_CONTENT.ordersPage.loadingText),
      title: asString(ordersPageSource.title, DEFAULT_SITE_CONTENT.ordersPage.title),
      emptyText: asString(ordersPageSource.emptyText, DEFAULT_SITE_CONTENT.ordersPage.emptyText),
      backToOrdersLabel: asString(ordersPageSource.backToOrdersLabel, DEFAULT_SITE_CONTENT.ordersPage.backToOrdersLabel),
      statusLabel: asString(ordersPageSource.statusLabel, DEFAULT_SITE_CONTENT.ordersPage.statusLabel),
      trackingLabel: asString(ordersPageSource.trackingLabel, DEFAULT_SITE_CONTENT.ordersPage.trackingLabel),
      itemLabel: asString(ordersPageSource.itemLabel, DEFAULT_SITE_CONTENT.ordersPage.itemLabel),
      qtyLabel: asString(ordersPageSource.qtyLabel, DEFAULT_SITE_CONTENT.ordersPage.qtyLabel),
      priceLabel: asString(ordersPageSource.priceLabel, DEFAULT_SITE_CONTENT.ordersPage.priceLabel),
      totalLabel: asString(ordersPageSource.totalLabel, DEFAULT_SITE_CONTENT.ordersPage.totalLabel),
      subtotalLabel: asString(ordersPageSource.subtotalLabel, DEFAULT_SITE_CONTENT.ordersPage.subtotalLabel),
      shippingLabel: asString(ordersPageSource.shippingLabel, DEFAULT_SITE_CONTENT.ordersPage.shippingLabel),
      discountLabel: asString(ordersPageSource.discountLabel, DEFAULT_SITE_CONTENT.ordersPage.discountLabel),
      grandTotalLabel: asString(ordersPageSource.grandTotalLabel, DEFAULT_SITE_CONTENT.ordersPage.grandTotalLabel),
      timelineTitle: asString(ordersPageSource.timelineTitle, DEFAULT_SITE_CONTENT.ordersPage.timelineTitle),
      noTimelineText: asString(ordersPageSource.noTimelineText, DEFAULT_SITE_CONTENT.ordersPage.noTimelineText),
      loadFailedText: asString(ordersPageSource.loadFailedText, DEFAULT_SITE_CONTENT.ordersPage.loadFailedText),
      networkErrorText: asString(ordersPageSource.networkErrorText, DEFAULT_SITE_CONTENT.ordersPage.networkErrorText)
    },
    wishlistPage: {
      loginRequiredText: asString(wishlistPageSource.loginRequiredText, DEFAULT_SITE_CONTENT.wishlistPage.loginRequiredText),
      loadingText: asString(wishlistPageSource.loadingText, DEFAULT_SITE_CONTENT.wishlistPage.loadingText),
      title: asString(wishlistPageSource.title, DEFAULT_SITE_CONTENT.wishlistPage.title),
      emptyText: asString(wishlistPageSource.emptyText, DEFAULT_SITE_CONTENT.wishlistPage.emptyText),
      continueShoppingLabel: asString(wishlistPageSource.continueShoppingLabel, DEFAULT_SITE_CONTENT.wishlistPage.continueShoppingLabel),
      addToCartLabel: asString(wishlistPageSource.addToCartLabel, DEFAULT_SITE_CONTENT.wishlistPage.addToCartLabel),
      addingLabel: asString(wishlistPageSource.addingLabel, DEFAULT_SITE_CONTENT.wishlistPage.addingLabel),
      removeLabel: asString(wishlistPageSource.removeLabel, DEFAULT_SITE_CONTENT.wishlistPage.removeLabel),
      inStockLabel: asString(wishlistPageSource.inStockLabel, DEFAULT_SITE_CONTENT.wishlistPage.inStockLabel),
      outOfStockLabel: asString(wishlistPageSource.outOfStockLabel, DEFAULT_SITE_CONTENT.wishlistPage.outOfStockLabel),
      addedToCartText: asString(wishlistPageSource.addedToCartText, DEFAULT_SITE_CONTENT.wishlistPage.addedToCartText),
      addToCartFailedText: asString(wishlistPageSource.addToCartFailedText, DEFAULT_SITE_CONTENT.wishlistPage.addToCartFailedText),
      loadFailedText: asString(wishlistPageSource.loadFailedText, DEFAULT_SITE_CONTENT.wishlistPage.loadFailedText),
      networkErrorText: asString(wishlistPageSource.networkErrorText, DEFAULT_SITE_CONTENT.wishlistPage.networkErrorText)
    },
    productGrid: {
      emptyText: asString(productGridSource.emptyText, DEFAULT_SITE_CONTENT.productGrid.emptyText),
      endsInPrefix: asString(productGridSource.endsInPrefix, DEFAULT_SITE_CONTENT.productGrid.endsInPrefix),
      newArrivalText: asString(productGridSource.newArrivalText, DEFAULT_SITE_CONTENT.productGrid.newArrivalText),
      viewLabel: asString(productGridSource.viewLabel, DEFAULT_SITE_CONTENT.productGrid.viewLabel),
      noDescriptionText: asString(productGridSource.noDescriptionText, DEFAULT_SITE_CONTENT.productGrid.noDescriptionText)
    },
    productDetailPage: {
      loadingText: asString(productDetailPageSource.loadingText, DEFAULT_SITE_CONTENT.productDetailPage.loadingText),
      errorPrefix: asString(productDetailPageSource.errorPrefix, DEFAULT_SITE_CONTENT.productDetailPage.errorPrefix),
      noProductText: asString(productDetailPageSource.noProductText, DEFAULT_SITE_CONTENT.productDetailPage.noProductText),
      defaultTitle: asString(productDetailPageSource.defaultTitle, DEFAULT_SITE_CONTENT.productDetailPage.defaultTitle),
      eyebrow: asString(productDetailPageSource.eyebrow, DEFAULT_SITE_CONTENT.productDetailPage.eyebrow),
      inclusiveTaxLabel: asString(productDetailPageSource.inclusiveTaxLabel, DEFAULT_SITE_CONTENT.productDetailPage.inclusiveTaxLabel),
      colorLabel: asString(productDetailPageSource.colorLabel, DEFAULT_SITE_CONTENT.productDetailPage.colorLabel),
      sizeLabel: asString(productDetailPageSource.sizeLabel, DEFAULT_SITE_CONTENT.productDetailPage.sizeLabel),
      chooseVariantLabel: asString(productDetailPageSource.chooseVariantLabel, DEFAULT_SITE_CONTENT.productDetailPage.chooseVariantLabel),
      wishlistUpdatingLabel: asString(productDetailPageSource.wishlistUpdatingLabel, DEFAULT_SITE_CONTENT.productDetailPage.wishlistUpdatingLabel),
      removeFromWishlistLabel: asString(productDetailPageSource.removeFromWishlistLabel, DEFAULT_SITE_CONTENT.productDetailPage.removeFromWishlistLabel),
      addToWishlistLabel: asString(productDetailPageSource.addToWishlistLabel, DEFAULT_SITE_CONTENT.productDetailPage.addToWishlistLabel),
      addToCartLabel: asString(productDetailPageSource.addToCartLabel, DEFAULT_SITE_CONTENT.productDetailPage.addToCartLabel),
      customerReviewsTitle: asString(productDetailPageSource.customerReviewsTitle, DEFAULT_SITE_CONTENT.productDetailPage.customerReviewsTitle),
      ratingPrefix: asString(productDetailPageSource.ratingPrefix, DEFAULT_SITE_CONTENT.productDetailPage.ratingPrefix),
      ratingBreakdownTitle: asString(productDetailPageSource.ratingBreakdownTitle, DEFAULT_SITE_CONTENT.productDetailPage.ratingBreakdownTitle),
      recentReviewsTitle: asString(productDetailPageSource.recentReviewsTitle, DEFAULT_SITE_CONTENT.productDetailPage.recentReviewsTitle),
      noReviewsText: asString(productDetailPageSource.noReviewsText, DEFAULT_SITE_CONTENT.productDetailPage.noReviewsText),
      checkingReviewEligibilityText: asString(productDetailPageSource.checkingReviewEligibilityText, DEFAULT_SITE_CONTENT.productDetailPage.checkingReviewEligibilityText),
      loginToReviewText: asString(productDetailPageSource.loginToReviewText, DEFAULT_SITE_CONTENT.productDetailPage.loginToReviewText),
      mustPurchaseToReviewText: asString(productDetailPageSource.mustPurchaseToReviewText, DEFAULT_SITE_CONTENT.productDetailPage.mustPurchaseToReviewText),
      writeReviewTitle: asString(productDetailPageSource.writeReviewTitle, DEFAULT_SITE_CONTENT.productDetailPage.writeReviewTitle),
      ratingLabel: asString(productDetailPageSource.ratingLabel, DEFAULT_SITE_CONTENT.productDetailPage.ratingLabel),
      reviewPlaceholder: asString(productDetailPageSource.reviewPlaceholder, DEFAULT_SITE_CONTENT.productDetailPage.reviewPlaceholder),
      submitReviewLabel: asString(productDetailPageSource.submitReviewLabel, DEFAULT_SITE_CONTENT.productDetailPage.submitReviewLabel),
      specificationsTitle: asString(productDetailPageSource.specificationsTitle, DEFAULT_SITE_CONTENT.productDetailPage.specificationsTitle),
      shippingReturnsTitle: asString(productDetailPageSource.shippingReturnsTitle, DEFAULT_SITE_CONTENT.productDetailPage.shippingReturnsTitle),
      shippingLabel: asString(productDetailPageSource.shippingLabel, DEFAULT_SITE_CONTENT.productDetailPage.shippingLabel),
      returnPolicyLabel: asString(productDetailPageSource.returnPolicyLabel, DEFAULT_SITE_CONTENT.productDetailPage.returnPolicyLabel),
      warrantyTitle: asString(productDetailPageSource.warrantyTitle, DEFAULT_SITE_CONTENT.productDetailPage.warrantyTitle),
      aboutItemTitle: asString(productDetailPageSource.aboutItemTitle, DEFAULT_SITE_CONTENT.productDetailPage.aboutItemTitle),
      unknownStockText: asString(productDetailPageSource.unknownStockText, DEFAULT_SITE_CONTENT.productDetailPage.unknownStockText),
      inStockText: asString(productDetailPageSource.inStockText, DEFAULT_SITE_CONTENT.productDetailPage.inStockText),
      outOfStockText: asString(productDetailPageSource.outOfStockText, DEFAULT_SITE_CONTENT.productDetailPage.outOfStockText),
      variantPrefix: asString(productDetailPageSource.variantPrefix, DEFAULT_SITE_CONTENT.productDetailPage.variantPrefix),
      productIdMissingText: asString(productDetailPageSource.productIdMissingText, DEFAULT_SITE_CONTENT.productDetailPage.productIdMissingText),
      variantIdMissingText: asString(productDetailPageSource.variantIdMissingText, DEFAULT_SITE_CONTENT.productDetailPage.variantIdMissingText),
      outOfStockVariantText: asString(productDetailPageSource.outOfStockVariantText, DEFAULT_SITE_CONTENT.productDetailPage.outOfStockVariantText),
      addedToCartText: asString(productDetailPageSource.addedToCartText, DEFAULT_SITE_CONTENT.productDetailPage.addedToCartText),
      failedToAddProductPrefix: asString(productDetailPageSource.failedToAddProductPrefix, DEFAULT_SITE_CONTENT.productDetailPage.failedToAddProductPrefix),
      mustLoginReviewText: asString(productDetailPageSource.mustLoginReviewText, DEFAULT_SITE_CONTENT.productDetailPage.mustLoginReviewText),
      reviewSubmittedText: asString(productDetailPageSource.reviewSubmittedText, DEFAULT_SITE_CONTENT.productDetailPage.reviewSubmittedText),
      reviewFailedText: asString(productDetailPageSource.reviewFailedText, DEFAULT_SITE_CONTENT.productDetailPage.reviewFailedText),
      reviewNetworkErrorText: asString(productDetailPageSource.reviewNetworkErrorText, DEFAULT_SITE_CONTENT.productDetailPage.reviewNetworkErrorText),
      loginToWishlistText: asString(productDetailPageSource.loginToWishlistText, DEFAULT_SITE_CONTENT.productDetailPage.loginToWishlistText),
      wishlistUpdateFailedText: asString(productDetailPageSource.wishlistUpdateFailedText, DEFAULT_SITE_CONTENT.productDetailPage.wishlistUpdateFailedText),
      invalidJsonText: asString(productDetailPageSource.invalidJsonText, DEFAULT_SITE_CONTENT.productDetailPage.invalidJsonText)
    },
    maintenancePage: {
      title: asString(maintenancePageSource.title, DEFAULT_SITE_CONTENT.maintenancePage.title),
      description: asString(maintenancePageSource.description, DEFAULT_SITE_CONTENT.maintenancePage.description),
      loginRequiredText: asString(maintenancePageSource.loginRequiredText, DEFAULT_SITE_CONTENT.maintenancePage.loginRequiredText)
    },
    checkout: {
      paymentMethods: normalizedPaymentMethods.length
        ? normalizedPaymentMethods
        : DEFAULT_SITE_CONTENT.checkout.paymentMethods,
      paymentSectionTitle: asString(
        checkoutSource.paymentSectionTitle,
        DEFAULT_SITE_CONTENT.checkout.paymentSectionTitle
      ),
      paymentProvider: ["razorpay", "mock"].includes(asString(checkoutSource.paymentProvider, "").toLowerCase())
        ? asString(checkoutSource.paymentProvider, "").toLowerCase()
        : DEFAULT_SITE_CONTENT.checkout.paymentProvider,
      gatewayNoteMock: asString(checkoutSource.gatewayNoteMock, DEFAULT_SITE_CONTENT.checkout.gatewayNoteMock),
      gatewayNoteSandbox: asString(
        checkoutSource.gatewayNoteSandbox,
        DEFAULT_SITE_CONTENT.checkout.gatewayNoteSandbox
      ),
      placeOrderLabel: asString(checkoutSource.placeOrderLabel, DEFAULT_SITE_CONTENT.checkout.placeOrderLabel),
      placingOrderLabel: asString(
        checkoutSource.placingOrderLabel,
        DEFAULT_SITE_CONTENT.checkout.placingOrderLabel
      ),
      selectedPaymentPrefix: asString(
        checkoutSource.selectedPaymentPrefix,
        DEFAULT_SITE_CONTENT.checkout.selectedPaymentPrefix
      ),
      guestUpsell: {
        title: asString(checkoutGuestUpsellSource.title, DEFAULT_SITE_CONTENT.checkout.guestUpsell.title),
        bodyTemplate: asString(
          checkoutGuestUpsellSource.bodyTemplate,
          DEFAULT_SITE_CONTENT.checkout.guestUpsell.bodyTemplate
        ),
        rewardCodeLabel: asString(
          checkoutGuestUpsellSource.rewardCodeLabel,
          DEFAULT_SITE_CONTENT.checkout.guestUpsell.rewardCodeLabel
        ),
        emailTemplate: asString(
          checkoutGuestUpsellSource.emailTemplate,
          DEFAULT_SITE_CONTENT.checkout.guestUpsell.emailTemplate
        ),
        supportTemplate: asString(
          checkoutGuestUpsellSource.supportTemplate,
          DEFAULT_SITE_CONTENT.checkout.guestUpsell.supportTemplate
        ),
        ctaLabel: asString(checkoutGuestUpsellSource.ctaLabel, DEFAULT_SITE_CONTENT.checkout.guestUpsell.ctaLabel)
      }
    }
  };
}

export function getDefaultSiteContent() {
  return normalizeSiteContent(DEFAULT_SITE_CONTENT);
}

export async function fetchPublicSiteContent(signal) {
  const response = await fetch(`${API_BASE}/site_content.php`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal
  });

  if (!response.ok) {
    throw new Error(`site_content request failed (${response.status})`);
  }

  const payload = await response.json();
  if (payload.success === false) {
    throw new Error(payload.error || "Unable to load site content");
  }

  return normalizeSiteContent(payload.settings || payload.content || payload.data || {});
}
