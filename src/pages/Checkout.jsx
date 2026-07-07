import React, { useEffect, useMemo, useState } from "react";
import { useCart } from "../contexts/useCart";
import { useLocation, useNavigate } from "react-router-dom";
import {
  buildOrderSummary,
  roundPayableTotal,
} from "../utils/pricing";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";
import { getDeliveryEstimate } from "../utils/delivery";
import "../styles/Checkout.css";

const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

function createCheckoutKey() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `ck_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function getGuestToken() {
  let token = localStorage.getItem("guest_token");
  if (!token) {
    token = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("guest_token", token);
  }
  return token;
}

function loadRazorpayScript() {
  const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
  if (existing) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function buildSandboxGatewayResult(prepare) {
  const sessionId = String(prepare.checkout_session_id || "");
  const orderId = String(prepare.order_id || "");
  const suffix = sessionId.slice(-10) || Math.random().toString(36).slice(2, 12);

  return {
    razorpay_order_id: orderId,
    razorpay_payment_id: `pay_sim_${suffix}`,
    razorpay_signature: `sim_signature_${suffix}`,
  };
}

function normalizeCardExpiryInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isValidCardExpiry(value) {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})$/);
  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) {
    return false;
  }

  if (year === currentYear && month < currentMonth) {
    return false;
  }

  return true;
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();
  const trimmed = rawText.trim();

  let data = null;
  if (trimmed) {
    if (contentType.includes("application/json")) {
      data = JSON.parse(trimmed);
    } else {
      try {
        data = JSON.parse(trimmed);
      } catch {
        data = null;
      }
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        (trimmed ? `Request failed with status ${response.status}` : `Request failed with status ${response.status} (empty response)`)
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("Server returned an empty or invalid response. Please try again.");
  }

  return data;
}

function applyTemplate(template, values, fallback) {
  const source = typeof template === "string" && template.trim() ? template : fallback;

  return source.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in values)) {
      return match;
    }

    return String(values[key]);
  });
}

function Checkout() {
  const { cartItems, cartSummary, appliedPromotions, clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const readStoredToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const readStoredUser = () => {
    const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user") || "";
    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser);
    } catch {
      return null;
    }
  };

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddressMode, setNewAddressMode] = useState("shipping");
  const [newAddress, setNewAddress] = useState({
    full_name: "",
    street_address: "",
    city: "",
    state: "",
    zip: "",
    phone_number: "",
    email: "",
    label: "",
    country: "India",
    is_default: false,
    use_for_billing: false,
  });
  const [pincodeData, setPincodeData] = useState({
    zip: "",
    cities: [],
    state: "",
    loading: false,
  });

  const [payment, setPayment] = useState("card");
  const [confirmedTotal, setConfirmedTotal] = useState(null);
  const [message, setMessage] = useState("");
  const [guestUpsell, setGuestUpsell] = useState("");
  const [guestUpsellCoupon, setGuestUpsellCoupon] = useState("");
  const [guestOrderNumber, setGuestOrderNumber] = useState("");
  const [guestCheckoutEmail, setGuestCheckoutEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState(null);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createCheckoutKey());
  const [authToken, setAuthToken] = useState(
    () => readStoredToken()
  );
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  const [shippingConfig, setShippingConfig] = useState(() => ({
    freeShippingThreshold: getDefaultSiteContent().offers.freeShippingThreshold,
    standardShippingFee: getDefaultSiteContent().offers.standardShippingFee,
    freeShippingProgressTemplate: getDefaultSiteContent().offers.freeShippingProgressTemplate,
    freeShippingUnlockedText: getDefaultSiteContent().offers.freeShippingUnlockedText,
    activePromoTarget: getDefaultSiteContent().offers.activePromoStrip?.to || getDefaultSiteContent().offers.promoStrip?.to || ""
  }));
  const [checkoutConfig, setCheckoutConfig] = useState(() => ({
    paymentMethods: getDefaultSiteContent().checkout.paymentMethods,
    paymentSectionTitle: getDefaultSiteContent().checkout.paymentSectionTitle,
    paymentProvider: getDefaultSiteContent().checkout.paymentProvider,
    gatewayNoteMock: getDefaultSiteContent().checkout.gatewayNoteMock,
    gatewayNoteSandbox: getDefaultSiteContent().checkout.gatewayNoteSandbox,
    placeOrderLabel: getDefaultSiteContent().checkout.placeOrderLabel,
    placingOrderLabel: getDefaultSiteContent().checkout.placingOrderLabel,
    selectedPaymentPrefix: getDefaultSiteContent().checkout.selectedPaymentPrefix,
    guestUpsell: getDefaultSiteContent().checkout.guestUpsell
  }));
    const [showMockPaymentForm, setShowMockPaymentForm] = useState(false);
    const [mockPaymentData, setMockPaymentData] = useState({
      cardNumber: '',
      cardName: '',
      cardExpiry: '',
      cardCvv: '',
      upiId: '',
    });
    const [mockPaymentErrors, setMockPaymentErrors] = useState({});
    const [pendingPaymentConfirm, setPendingPaymentConfirm] = useState(null);
  const availablePaymentMethods = useMemo(
    () => (checkoutConfig.paymentMethods || []).filter((method) => method.enabled !== false),
    [checkoutConfig.paymentMethods]
  );

  // Authentication token from either storage
  const guestToken = getGuestToken();
  const isGuestCheckout = !authToken;
  const currentUserRole = String(currentUser?.role || "").trim().toLowerCase();
  const isAdminUser = currentUserRole === "admin" || currentUserRole === "super_admin";
  const adminCheckoutBlockedMessage = checkoutConfig.adminPurchaseBlockedText || "Admin accounts can manage the store but cannot place orders. Please use a customer account.";

  useEffect(() => {
    const syncAuthToken = () => {
      setAuthToken(readStoredToken());
      setCurrentUser(readStoredUser());
    };

    syncAuthToken();
    window.addEventListener("focus", syncAuthToken);
    window.addEventListener("storage", syncAuthToken);

    return () => {
      window.removeEventListener("focus", syncAuthToken);
      window.removeEventListener("storage", syncAuthToken);
    };
  }, [location.key]);

  const clearAuthSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setAuthToken("");
    setCurrentUser(null);
  };

  const resetNewAddressForm = () => {
    setNewAddress({
      full_name: "",
      street_address: "",
      city: "",
      state: "",
      zip: "",
      phone_number: "",
      email: "",
      label: "",
      country: "India",
      is_default: false,
      use_for_billing: false,
      landmark: "",
      instructions: "",
    });
    setPincodeData({ zip: "", cities: [], state: "", loading: false });
    setErrors({});
  };

  const openNewAddressModal = (mode) => {
    setNewAddressMode(mode);
    resetNewAddressForm();
    setShowNewAddress(true);
  };

  const normalizeLocationText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const fetchPincodeData = async (zip) => {
    const cleanZip = String(zip || "").trim();
    if (!/^\d{6}$/.test(cleanZip)) {
      return { valid: false, cities: [], state: "" };
    }

    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanZip}`);
    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry || entry.Status !== "Success" || !Array.isArray(entry.PostOffice) || !entry.PostOffice.length) {
      return { valid: false, cities: [], state: "" };
    }

    const citySet = new Set();
    const stateSet = new Set();
    entry.PostOffice.forEach((office) => {
      const district = String(office.District || "").trim();
      const state = String(office.State || "").trim();
      if (district) citySet.add(district);
      if (state) stateSet.add(state);
    });

    return {
      valid: true,
      cities: Array.from(citySet),
      state: Array.from(stateSet)[0] || "",
    };
  };

  useEffect(() => {
    const cleanZip = String(newAddress.zip || "").replace(/\D/g, "").slice(0, 6);
    if (cleanZip !== newAddress.zip) {
      setNewAddress((prev) => ({ ...prev, zip: cleanZip }));
      return;
    }

    if (cleanZip.length !== 6) {
      setPincodeData({ zip: cleanZip, cities: [], state: "", loading: false });
      return;
    }

    let cancelled = false;
    setPincodeData((prev) => ({ ...prev, zip: cleanZip, loading: true }));

    fetchPincodeData(cleanZip)
      .then((result) => {
        if (cancelled) return;
        if (!result.valid) {
          setPincodeData({ zip: cleanZip, cities: [], state: "", loading: false });
          return;
        }
        setPincodeData({ zip: cleanZip, cities: result.cities, state: result.state, loading: false });
        setNewAddress((prev) => ({
          ...prev,
          city: result.cities.includes(prev.city) ? prev.city : (result.cities[0] || ""),
          state: result.state || prev.state,
          country: "India",
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setPincodeData({ zip: cleanZip, cities: [], state: "", loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [newAddress.zip]);

  const validatePincodeCityState = async (zip, city, state) => {
    const cleanZip = String(zip || "").trim();
    const cleanCity = normalizeLocationText(city);
    const cleanState = normalizeLocationText(state);

    if (!/^\d{6}$/.test(cleanZip) || !cleanCity || !cleanState) {
      return true;
    }

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanZip}`);
      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : null;
      if (!entry || entry.Status !== "Success" || !Array.isArray(entry.PostOffice)) {
        setErrors((prev) => ({ ...prev, zip: "Invalid pincode. Please verify." }));
        return false;
      }

      const matches = entry.PostOffice.some((office) => {
        const district = normalizeLocationText(office.District || "");
        const name = normalizeLocationText(office.Name || "");
        const division = normalizeLocationText(office.Division || "");
        return district.includes(cleanCity) || cleanCity.includes(district) || name.includes(cleanCity) || division.includes(cleanCity);
      });

      if (!matches) {
        setErrors((prev) => ({ ...prev, city: "City does not match the entered pincode." }));
        return false;
      }

      const stateMatches = entry.PostOffice.some((office) => {
        const postOfficeState = normalizeLocationText(office.State || "");
        const district = normalizeLocationText(office.District || "");
        return (
          postOfficeState.includes(cleanState) ||
          cleanState.includes(postOfficeState) ||
          district.includes(cleanState) ||
          cleanState.includes(district)
        );
      });

      if (!stateMatches) {
        setErrors((prev) => ({ ...prev, state: "State does not match the entered pincode." }));
        return false;
      }

      return true;
    } catch {
      return true;
    }
  };

  const validateAddress = () => {
    const newErrors = {};
    if (!newAddress.full_name.trim()) newErrors.full_name = "Full name is required";
    if (!newAddress.phone_number.trim()) newErrors.phone_number = "Phone number is required";
    else if (!/^\d{10}$/.test(newAddress.phone_number.replace(/\D/g, ""))) newErrors.phone_number = "Phone number must be 10 digits";
    if (!newAddress.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(newAddress.email)) newErrors.email = "Email is invalid";
    if (!newAddress.street_address.trim()) newErrors.street_address = "Street address is required";
    if (!newAddress.city.trim()) newErrors.city = "City is required";
    else if (/\d/.test(newAddress.city)) newErrors.city = "City name should not contain numbers";
    if (!newAddress.state.trim()) newErrors.state = "State is required";
    else if (/\d/.test(newAddress.state)) newErrors.state = "State name should not contain numbers";
    else if (!INDIA_STATES.includes(newAddress.state.trim())) newErrors.state = "Please select a valid Indian state";
    if (!newAddress.zip.trim()) newErrors.zip = "ZIP code is required";
    else if (!/^\d{6}$/.test(newAddress.zip)) newErrors.zip = "Pincode must be 6 digits";
    if (pincodeData.cities.length > 0 && newAddress.city && !pincodeData.cities.includes(newAddress.city)) {
      newErrors.city = "Please select a valid city for this pincode";
    }
    if (pincodeData.state && newAddress.state && normalizeLocationText(pincodeData.state) !== normalizeLocationText(newAddress.state)) {
      newErrors.state = "State must match the selected pincode";
    }
    if (!newAddress.label.trim()) newErrors.label = "Address label is required";
    if ((newAddress.country || "India") !== "India") newErrors.country = "Only India addresses are supported";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = () => {
    const newErrors = {};
    const methodAllowed = availablePaymentMethods.some((method) => method.id === payment);
    if (!methodAllowed) {
      newErrors.payment = "Selected payment method is unavailable";
      setErrors(newErrors);
      return false;
    }

    setErrors((prev) => ({
      ...prev,
      payment: undefined,
    }));
    return true;
  };

  const validateCheckout = () => {
    const newErrors = {};
    if (isGuestCheckout) {
      if (!validateAddress()) {
        return false;
      }
    } else if (!selectedAddress) {
      newErrors.address = "Please select a shipping address";
    } else if (!billingSameAsShipping && !selectedBillingAddress) {
      newErrors.billingAddress = "Please select a billing address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Redirect guests
  useEffect(() => {
    const controller = new AbortController();

    fetchPublicSiteContent(controller.signal)
      .then((content) => {
        setShippingConfig({
          freeShippingThreshold: content.offers.freeShippingThreshold,
          standardShippingFee: content.offers.standardShippingFee,
          freeShippingProgressTemplate: content.offers.freeShippingProgressTemplate,
          freeShippingUnlockedText: content.offers.freeShippingUnlockedText,
          activePromoTarget: content.offers?.activePromoStrip?.to || content.offers?.promoStrip?.to || ""
        });
        setCheckoutConfig({
          paymentMethods: content.checkout.paymentMethods,
          paymentSectionTitle: content.checkout.paymentSectionTitle,
          paymentProvider: content.checkout.paymentProvider,
          gatewayNoteMock: content.checkout.gatewayNoteMock,
          gatewayNoteSandbox: content.checkout.gatewayNoteSandbox,
          placeOrderLabel: content.checkout.placeOrderLabel,
          placingOrderLabel: content.checkout.placingOrderLabel,
          selectedPaymentPrefix: content.checkout.selectedPaymentPrefix,
          guestUpsell: content.checkout.guestUpsell
        });
      })
      .catch(() => {
        // Keep fallback config when content API is unavailable.
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!availablePaymentMethods.length) {
      return;
    }

    const currentMethodAvailable = availablePaymentMethods.some((method) => method.id === payment);
    if (!currentMethodAvailable) {
      setPayment(availablePaymentMethods[0].id);
    }
  }, [availablePaymentMethods, payment]);

  // Fetch saved addresses
  useEffect(() => {
    if (!authToken) return;
    fetch("/ecommerce/user_addresses.php", {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          clearAuthSession();
          setMessage("Your previous session expired. Continue with guest checkout below.");
          return { success: false, unauthorized: true };
        }
        return res.json();
      })
      .then((data) => {
        if (data?.unauthorized) {
          return;
        }
        if (data.success) {
          setSavedAddresses(data.addresses);
          // Auto-select default address, or first address
          const defaultAddr = data.addresses.find(a => a.is_default);
          const billingAddr = data.addresses.find(a => a.use_for_billing);
          if (defaultAddr) {
            setSelectedAddress(defaultAddr.id);
          } else if (data.addresses.length > 0) {
            setSelectedAddress(data.addresses[0].id);
          }
          if (billingAddr) {
            setSelectedBillingAddress(billingAddr.id);
            setBillingSameAsShipping(false);
          } else if (defaultAddr) {
            setSelectedBillingAddress(defaultAddr.id);
            setBillingSameAsShipping(true);
          } else if (data.addresses.length > 0) {
            setSelectedBillingAddress(data.addresses[0].id);
            setBillingSameAsShipping(true);
          }
        }
      })
      .catch(() => {
        clearAuthSession();
      });
  }, [authToken]);

  const hasFreeDeliveryPromo = appliedPromotions.some((promo) => {
    const offerType = String(promo?.offer_type || "").trim().toLowerCase();
    const promoName = String(promo?.name || promo?.code || "").trim().toLowerCase();
    return Boolean(promo?.free_shipping) || offerType === "free-shipping" || promoName.includes("free shipping") || promoName.includes("free delivery");
  });
  const activePromoTarget = String(shippingConfig.activePromoTarget || "")
    .trim()
    .toLowerCase();
  const siteHasFreeDeliveryOffer = activePromoTarget.includes("offer=free-shipping");
  const freeShippingMessageEnabled = siteHasFreeDeliveryOffer || Boolean(cartSummary?.free_shipping_offer_active) || hasFreeDeliveryPromo;
  const freeShippingThreshold = Number(cartSummary?.free_shipping_threshold ?? shippingConfig.freeShippingThreshold ?? 0);
  const previewSummary = buildOrderSummary(cartItems, {
    ...shippingConfig,
    paymentMethod: payment,
    freeShippingEnabled: freeShippingMessageEnabled,
  });
  const previewSubtotal = Number(cartSummary?.subtotal ?? previewSummary.subtotal ?? 0);
  const previewShipping = Number(cartSummary?.shipping_cost ?? previewSummary.shipping ?? 0);
  const previewTotal = Number(cartSummary?.grand_total ?? previewSummary.grandTotal ?? 0);
  const freeDeliveryUnlocked = freeShippingMessageEnabled && freeShippingThreshold > 0 && previewSubtotal >= freeShippingThreshold;
  const remainingForFreeShipping = freeShippingMessageEnabled && !freeDeliveryUnlocked
    ? Math.max(0, roundPayableTotal(freeShippingThreshold - previewSubtotal))
    : 0;
  const freeShippingProgressMessage = `Add Rs.${roundPayableTotal(remainingForFreeShipping)} more to unlock free delivery.`;
  const unlockedShippingMessage = "Free delivery unlocked on this order.";
  const deliveryEstimate = getDeliveryEstimate();
  const estimatedDeliveryLabel = deliveryEstimate.rangeLabel;
  const paymentLabelMap = availablePaymentMethods.reduce((acc, method) => {
    acc[method.id] = method.label;
    return acc;
  }, {});

  useEffect(() => {
    if (!availablePaymentMethods.length) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const requestedPaymentRaw = (params.get("payment") || "").toLowerCase();
    if (!requestedPaymentRaw) {
      return;
    }

    const requestedPayment =
      requestedPaymentRaw === "wallet" || requestedPaymentRaw === "paytm" || requestedPaymentRaw === "phonepe"
        ? "upi"
        : requestedPaymentRaw;

    const requestedMethodAvailable = availablePaymentMethods.some((method) => method.id === requestedPayment);
    if (requestedMethodAvailable && requestedPayment !== payment) {
      setPayment(requestedPayment);
    }
  }, [availablePaymentMethods, location.search, payment]);

  // Save new address
  const handleSaveAddress = async () => {
    if (!validateAddress()) return;
    const pincodeCityValid = await validatePincodeCityState(newAddress.zip, newAddress.city, newAddress.state);
    if (!pincodeCityValid) return;

    const payload = {
      ...newAddress,
      use_for_billing: newAddressMode === "billing",
    };

    try {
      const response = await fetch("https://my-vite-app-backend.onrender.com/user_addresses.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        setSavedAddresses((prev) => [result.address, ...prev]);
        if (newAddressMode === "billing") {
          setSelectedBillingAddress(result.address.id);
          setBillingSameAsShipping(false);
        } else {
          setSelectedAddress(result.address.id);
          if (billingSameAsShipping) {
            setSelectedBillingAddress(result.address.id);
          }
        }
        setShowNewAddress(false);
        resetNewAddressForm();
        setMessage(
          newAddressMode === "billing"
            ? "Billing address saved successfully!"
            : "Shipping address saved successfully!"
        );
      } else {
        setMessage(result.error || "Failed to save address.");
      }
    } catch {
      setMessage("Network error while saving address.");
    }
  };

  const buildCheckoutFormData = () => {
    const formData = new FormData();
    if (!isGuestCheckout) {
      const selectedShippingAddress = savedAddresses.find((item) => item.id === selectedAddress) || null;
      const selectedBilling = savedAddresses.find((item) => item.id === selectedBillingAddress) || selectedShippingAddress;
      const storedUser = readStoredUser();

      formData.append("address", selectedAddress);
      const billingAddressPayload = billingSameAsShipping ? selectedAddress : selectedBillingAddress;
      formData.append("billingAddress", billingAddressPayload);
      formData.append("guestEmail", selectedShippingAddress?.email || storedUser?.email || "");
      formData.append("guest_email", selectedShippingAddress?.email || storedUser?.email || "");
      formData.append("guestFullName", selectedShippingAddress?.full_name || storedUser?.name || "");
      formData.append("guest_full_name", selectedShippingAddress?.full_name || storedUser?.name || "");
      formData.append("guestPhone", selectedShippingAddress?.phone_number || "");
      formData.append("guest_phone", selectedShippingAddress?.phone_number || "");
      formData.append("guestStreetAddress", selectedShippingAddress?.street_address || "");
      formData.append("guest_street_address", selectedShippingAddress?.street_address || "");
      formData.append("guestCity", selectedShippingAddress?.city || "");
      formData.append("guest_city", selectedShippingAddress?.city || "");
      formData.append("guestState", selectedShippingAddress?.state || "");
      formData.append("guest_state", selectedShippingAddress?.state || "");
      formData.append("guestZip", selectedShippingAddress?.zip || "");
      formData.append("guest_zip", selectedShippingAddress?.zip || "");
      formData.append("guestCountry", selectedShippingAddress?.country || "India");
      formData.append("guest_country", selectedShippingAddress?.country || "India");
      formData.append("guestLabel", selectedShippingAddress?.label || "Saved Address");
      formData.append("guest_label", selectedShippingAddress?.label || "Saved Address");
      formData.append("guestLandmark", selectedShippingAddress?.landmark || "");
      formData.append("guest_landmark", selectedShippingAddress?.landmark || "");
      formData.append("guestInstructions", selectedBilling?.instructions || selectedShippingAddress?.instructions || "");
      formData.append("guest_instructions", selectedBilling?.instructions || selectedShippingAddress?.instructions || "");
    } else {
      formData.append("guestToken", guestToken);
      formData.append("guest_token", guestToken);
      formData.append("guestFullName", newAddress.full_name);
      formData.append("guest_full_name", newAddress.full_name);
      formData.append("guestEmail", newAddress.email || "");
      formData.append("guest_email", newAddress.email || "");
      formData.append("guestPhone", newAddress.phone_number);
      formData.append("guest_phone", newAddress.phone_number);
      formData.append("guestLabel", newAddress.label || "Guest Checkout");
      formData.append("guest_label", newAddress.label || "Guest Checkout");
      formData.append("guestStreetAddress", newAddress.street_address);
      formData.append("guest_street_address", newAddress.street_address);
      formData.append("guestCity", newAddress.city);
      formData.append("guest_city", newAddress.city);
      formData.append("guestState", newAddress.state);
      formData.append("guest_state", newAddress.state);
      formData.append("guestZip", newAddress.zip);
      formData.append("guest_zip", newAddress.zip);
      formData.append("guestCountry", newAddress.country || "India");
      formData.append("guest_country", newAddress.country || "India");
      formData.append("guestLandmark", newAddress.landmark || "");
      formData.append("guest_landmark", newAddress.landmark || "");
      formData.append("guestInstructions", newAddress.instructions || "");
      formData.append("guest_instructions", newAddress.instructions || "");
    }

    formData.append("payment", payment);
    formData.append("idempotencyKey", idempotencyKey);
    formData.append("cartItems", JSON.stringify(cartItems));
    return formData;
  };

  const submitFormData = async (url, formData) => {
    const currentToken = readStoredToken();
    const response = await fetch(url, {
      method: "POST",
      headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : undefined,
      body: formData,
    });

    const data = await parseApiResponse(response);
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || "Request failed");
    }

    return data;
  };

  const resolveShippingAddressText = () => {
    if (isGuestCheckout) {
      const parts = [newAddress.street_address, newAddress.city, newAddress.state, newAddress.zip]
        .map((part) => String(part || "").trim())
        .filter(Boolean);
      return parts.join(", ");
    }

    const addr = savedAddresses.find((item) => item.id === selectedAddress);
    if (!addr) {
      return "Saved address";
    }

    return [addr.street_address, addr.city, addr.state, addr.zip]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(", ");
  };

  const finalizeSuccess = (result) => {
    const guestCouponCode = result.guest_checkout ? (result.upsell_coupon || "WELCOME10") : "";
    const guestSignupOffer = result.guest_checkout
      ? applyTemplate(
          checkoutConfig.guestUpsell?.bodyTemplate,
          { coupon: guestCouponCode },
          "Sign up now and get 10% off your next order with {coupon}. Save this order to your account and check out faster next time."
        )
      : "";
    const orderItems = cartItems.map((item) => {
      const unitPrice = Number(item.effective_price ?? item.snapshot_price ?? item.price ?? 0);
      const quantity = Number(item.quantity || 0);
      return {
        id: item.cart_id || `${item.product_id}-${item.variant_id || "na"}`,
        name: item.name || `Product #${item.product_id}`,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
      };
    });

    const resolvedPaymentProvider = payment === "cod"
      ? "Cash on Delivery"
      : payment === "upi"
        ? "UPI"
        : String(checkoutConfig.paymentProvider || "Razorpay");

    const confirmationPayload = {
      orderId: result.order_id,
      orderNumber: result.order_number || "",
      total: Number(result.grand_total ?? result.total ?? 0),
      paymentMethod: paymentLabelMap[payment] || payment,
      paymentProvider: resolvedPaymentProvider,
      shippingAddress: resolveShippingAddressText(),
      deliveryEstimateLabel: estimatedDeliveryLabel,
      placedAt: new Date().toISOString(),
      isGuestCheckout,
      guestEmail: result.guest_email || newAddress.email || "",
      upsellOffer: guestSignupOffer,
      upsellCoupon: guestCouponCode,
      gatewayReference: result.provider_reference || null,
      items: orderItems,
    };

    setConfirmedTotal(Number(result.grand_total ?? result.total));
    setMessage(`Order placed successfully! Order ID: ${result.order_id}`);
    setGuestUpsell(guestSignupOffer);
    setGuestUpsellCoupon(guestCouponCode);
    setGuestOrderNumber(result.order_number || "");
    setGuestCheckoutEmail(result.guest_email || newAddress.email || "");
    clearCart();
    setErrors({});
    setIdempotencyKey(createCheckoutKey());

    navigate("/confirmation", {
      state: {
        checkoutDetails: confirmationPayload,
      },
    });
  };

  const handleMockPaymentSubmit = async () => {
    if (!pendingPaymentConfirm) return;

    const newMockErrors = {};

    if (payment === "card") {
      if (!mockPaymentData.cardNumber || mockPaymentData.cardNumber.length < 12) {
        newMockErrors.cardNumber = "Please enter a valid card number.";
      }
      if (!mockPaymentData.cardName.trim() || !mockPaymentData.cardExpiry.trim() || !mockPaymentData.cardCvv.trim()) {
        if (!mockPaymentData.cardName.trim()) {
          newMockErrors.cardName = "Cardholder name is required.";
        }
        if (!mockPaymentData.cardExpiry.trim()) {
          newMockErrors.cardExpiry = "Card expiry is required.";
        }
        if (!mockPaymentData.cardCvv.trim()) {
          newMockErrors.cardCvv = "CVV is required.";
        }
      }
      if (mockPaymentData.cardExpiry.trim() && !isValidCardExpiry(mockPaymentData.cardExpiry)) {
        newMockErrors.cardExpiry = "Please enter a valid expiry in MM/YY format.";
      }
    }

    if (payment === "upi" && !mockPaymentData.upiId.trim()) {
      newMockErrors.upiId = "Please enter a UPI ID.";
    }

    if (Object.keys(newMockErrors).length > 0) {
      setMockPaymentErrors(newMockErrors);
      setMessage("Please correct the payment details and try again.");
      return;
    }

    setMockPaymentErrors({});

    try {
      const { prepare, confirmEndpoint, formData } = pendingPaymentConfirm;
      formData.append("checkoutSessionId", prepare.checkout_session_id);
      formData.append("razorpayOrderId", prepare.order_id || "");
      formData.append("razorpayPaymentId", `mock_${Date.now()}`);
      formData.append("razorpaySignature", `sig_${Date.now()}`);

      const confirmed = await submitFormData(confirmEndpoint, formData);
      setShowMockPaymentForm(false);
      setPendingPaymentConfirm(null);
      setMockPaymentErrors({});
      setMockPaymentData({ cardNumber: "", cardName: "", cardExpiry: "", cardCvv: "", upiId: "" });
      finalizeSuccess(confirmed);
    } catch (err) {
      setMessage(err?.message || "Payment failed. Please try again.");
    }
  };

  // Handle placing order
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isAdminUser) {
      setMessage(adminCheckoutBlockedMessage);
      return;
    }

    if (!validateCheckout() || !validatePayment()) return;

    if (isGuestCheckout) {
      const pincodeCityValid = await validatePincodeCityState(newAddress.zip, newAddress.city, newAddress.state);
      if (!pincodeCityValid) {
        return;
      }
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      if (payment === "cod") {
        const codForm = buildCheckoutFormData();
        const result = await submitFormData("https://my-vite-app-backend.onrender.com/checkout.php", codForm);
        finalizeSuccess(result);
        return;
      }

      const prepareForm = buildCheckoutFormData();
      const provider = "mock";
      const prepareEndpoint = "https://my-vite-app-backend.onrender.com/payment_mock_prepare.php";
      const confirmEndpoint = "https://my-vite-app-backend.onrender.com/payment_mock_confirm.php";

      const prepare = await submitFormData(prepareEndpoint, prepareForm);

      if (prepare.completed) {
        finalizeSuccess(prepare);
        return;
      }

      if (provider === "mock") {
        setMockPaymentErrors({});
        setPendingPaymentConfirm({
          prepare,
          confirmEndpoint,
          formData: buildCheckoutFormData(),
        });
        setShowMockPaymentForm(true);
        return;
      }

      const paymentResult = prepare.sandbox_mode
        ? buildSandboxGatewayResult(prepare)
        : await (async () => {
          const loaded = await loadRazorpayScript();
          if (!loaded || typeof globalThis.Razorpay !== "function") {
            throw new Error("Unable to load Razorpay checkout. Check your internet and try again.");
          }

          return new Promise((resolve, reject) => {
            const rz = new globalThis.Razorpay({
              key: prepare.key_id,
              amount: prepare.amount,
              currency: prepare.currency || "INR",
              name: prepare.name || "MYSHOP",
              description: prepare.description || "Secure payment",
              order_id: prepare.order_id,
              prefill: prepare.prefill || {},
              notes: { checkout_session_id: prepare.checkout_session_id },
              theme: { color: "#bb3e03" },
              handler: (responseData) => resolve(responseData),
              modal: {
                ondismiss: () => reject(new Error("Payment was cancelled.")),
              },
            });

            rz.on("payment.failed", (response) => {
              const reason = response?.error?.description || response?.error?.reason || "Payment failed";
              reject(new Error(reason));
            });

            rz.open();
          });
        })();

      const confirmForm = buildCheckoutFormData();
      confirmForm.append("checkoutSessionId", prepare.checkout_session_id);
      confirmForm.append("razorpayOrderId", paymentResult.razorpay_order_id || "");
      confirmForm.append("razorpayPaymentId", paymentResult.razorpay_payment_id || "");
      confirmForm.append("razorpaySignature", paymentResult.razorpay_signature || "");

      const confirmed = await submitFormData(confirmEndpoint, confirmForm);
      finalizeSuccess(confirmed);
    } catch (err) {
      const lower = String(err?.message || "").toLowerCase();
      if (lower.includes("unauthorized") || lower.includes("session")) {
        clearAuthSession();
        setMessage("Session expired. Continue with guest checkout below and place order again.");
        return;
      }
      setMessage(err.message || "Failed to place order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="checkout-page" onSubmit={handleSubmit}>
      {isGuestCheckout && (
        <section className="checkout-guest-banner">
          <h2>Guest Checkout</h2>
          <p>Place your order without logging in. We will send confirmation and tracking updates to your email.</p>
        </section>
      )}

      <section className="checkout-summary-card">
        <h2>Order Summary</h2>
        <div className="checkout-summary-rows">
          <div className="checkout-summary-row">
            <span>Item Subtotal</span>
            <strong>₹{roundPayableTotal(previewSubtotal)}</strong>
          </div>
          {Number(cartSummary?.discount_amount ?? 0) > 0 && (
            <div className="checkout-summary-row checkout-summary-row--discount">
              <span>Promotions</span>
              <strong>-₹{roundPayableTotal(cartSummary?.discount_amount ?? 0)}</strong>
            </div>
          )}
          <div className="checkout-summary-row">
            <span>Delivery Charge</span>
            <strong>{previewShipping === 0 ? "Free" : `₹${roundPayableTotal(previewShipping)}`}</strong>
          </div>
          <div className="checkout-summary-row checkout-summary-row--muted">
            <span>Tax</span>
            <strong>Inclusive</strong>
          </div>
          <div className="checkout-summary-row checkout-summary-row--total">
            <span>Estimated Total</span>
            <strong>₹{previewTotal.toFixed(0)}</strong>
          </div>
        </div>

        <div className="checkout-delivery-estimate">
          <h3>Estimated Delivery</h3>
          <p>{estimatedDeliveryLabel}</p>
          <small>Home delivery in 3-5 business days.</small>
        </div>

        {freeShippingMessageEnabled && (freeDeliveryUnlocked ? (
          <p className="checkout-delivery-note checkout-delivery-note--success">{unlockedShippingMessage}</p>
        ) : remainingForFreeShipping > 0 ? (
          <p className="checkout-delivery-note">{freeShippingProgressMessage}</p>
        ) : null)}

        {confirmedTotal !== null && (
          <p className="checkout-confirmed-total">Confirmed Total: ₹{confirmedTotal.toFixed(0)}</p>
        )}
      </section>

      <section className="checkout-delivery-method">
        <h3>Delivery Method</h3>
        <label className="checkout-delivery-option">
          <input type="radio" checked readOnly />
          <span>
            <strong>Home Delivery</strong>
            <small>{estimatedDeliveryLabel}</small>
          </span>
        </label>
      </section>

      <h3>{isGuestCheckout ? "Shipping Details" : "Shipping Address"}</h3>
      {!isGuestCheckout ? (
        <>
          {savedAddresses.map((addr) => (
            <div key={addr.id} className={`address-card ${addr.is_default ? 'default-address' : ''}`}>
              <input
                type="radio"
                name="address"
                value={addr.id}
                checked={selectedAddress === addr.id}
                onChange={() => {
                  setSelectedAddress(addr.id);
                  if (billingSameAsShipping) {
                    setSelectedBillingAddress(addr.id);
                  }
                }}
              />
              <span>
                {addr.label}: {addr.street_address}, {addr.city}, {addr.state}{" "}
                {addr.zip}
                {addr.is_default && <strong className="default-badge"> (Default)</strong>}
                {addr.use_for_billing && <strong className="billing-badge"> (Billing)</strong>}
              </span>
            </div>
          ))}

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={billingSameAsShipping}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setBillingSameAsShipping(isChecked);
                  if (isChecked) setSelectedBillingAddress(selectedAddress);
                }}
              />
              Use shipping address for billing
            </label>
          </div>

          {!billingSameAsShipping && (
            <>
              <h3>Billing Address</h3>
              {savedAddresses.map((addr) => (
                <div key={`billing-${addr.id}`} className={`address-card ${addr.use_for_billing ? 'billing-address' : ''}`}>
                  <input
                    type="radio"
                    name="billingAddress"
                    value={addr.id}
                    checked={selectedBillingAddress === addr.id}
                    onChange={() => setSelectedBillingAddress(addr.id)}
                  />
                  <span>
                    {addr.label}: {addr.street_address}, {addr.city}, {addr.state} {addr.zip}
                    {addr.use_for_billing && <strong className="billing-badge"> (Billing)</strong>}
                  </span>
                </div>
              ))}
              <button type="button" onClick={() => openNewAddressModal("billing")}>
                + Add New Billing Address
              </button>
            </>
          )}
          <div className="checkout-address-actions">
            <button type="button" onClick={() => openNewAddressModal("shipping")}>
              + Add New Shipping Address
            </button>
            {billingSameAsShipping && (
              <button type="button" onClick={() => openNewAddressModal("billing")}>
                + Add New Billing Address
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="guest-checkout-fields">
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} />
            {errors.full_name && <p className="error">{errors.full_name}</p>}
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={newAddress.email || ""} onChange={(e) => setNewAddress({ ...newAddress, email: e.target.value })} />
            {errors.email && <p className="error">{errors.email}</p>}
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="text" value={newAddress.phone_number} onChange={(e) => setNewAddress({ ...newAddress, phone_number: e.target.value })} />
            {errors.phone_number && <p className="error">{errors.phone_number}</p>}
          </div>
          <div className="form-group">
            <label>Street Address / House No.</label>
            <input type="text" value={newAddress.street_address} onChange={(e) => setNewAddress({ ...newAddress, street_address: e.target.value })} />
            {errors.street_address && <p className="error">{errors.street_address}</p>}
          </div>
          <div className="form-group">
            <label>Area / Locality / Landmark</label>
            <input type="text" value={newAddress.landmark || ""} onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })} />
          </div>
          <div className="form-group">
            <label>City</label>
            {pincodeData.cities.length > 0 ? (
              <select value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}>
                {pincodeData.cities.map((cityOption) => (
                  <option key={cityOption} value={cityOption}>{cityOption}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
            )}
            {errors.city && <p className="error">{errors.city}</p>}
          </div>
          <div className="form-group">
            <label>State / Province</label>
            <input type="text" value={newAddress.state} readOnly />
            {errors.state && <p className="error">{errors.state}</p>}
          </div>
          <div className="form-group">
            <label>ZIP / Postal Code</label>
            <input type="text" value={newAddress.zip} onChange={(e) => setNewAddress({ ...newAddress, zip: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
            {errors.zip && <p className="error">{errors.zip}</p>}
            {pincodeData.loading && <p>Checking pincode...</p>}
          </div>
          <div className="form-group">
            <label>Country</label>
            <input type="text" value="India" readOnly />
            {errors.country && <p className="error">{errors.country}</p>}
          </div>
          <div className="form-group">
            <label>Address Label</label>
            <input type="text" value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} />
            {errors.label && <p className="error">{errors.label}</p>}
          </div>
          <div className="form-group">
            <label>Delivery Instructions</label>
            <textarea value={newAddress.instructions || ""} onChange={(e) => setNewAddress({ ...newAddress, instructions: e.target.value })} />
          </div>
        </div>
      )}

      {showNewAddress && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{newAddressMode === "billing" ? "Add New Billing Address" : "Add New Shipping Address"}</h3>
            <p className="checkout-modal-copy">
              {newAddressMode === "billing"
                ? "This address will be used only for billing in checkout."
                : "This address will be saved as a shipping address for checkout."}
            </p>

            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={newAddress.full_name}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, full_name: e.target.value })
                }
              />
              {errors.full_name && <p className="error">{errors.full_name}</p>}
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="text"
                value={newAddress.phone_number}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, phone_number: e.target.value })
                }
              />
              {errors.phone_number && <p className="error">{errors.phone_number}</p>}
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={newAddress.email || ""}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, email: e.target.value })
                }
              />
              {errors.email && <p className="error">{errors.email}</p>}
            </div>

            <div className="form-group">
              <label>Street Address / House No.</label>
              <input
                type="text"
                value={newAddress.street_address}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, street_address: e.target.value })
                }
              />
              {errors.street_address && <p className="error">{errors.street_address}</p>}
            </div>

            <div className="form-group">
              <label>Area / Locality / Landmark</label>
              <input
                type="text"
                value={newAddress.landmark || ""}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, landmark: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label>City</label>
              {pincodeData.cities.length > 0 ? (
                <select
                  value={newAddress.city}
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, city: e.target.value })
                  }
                >
                  {pincodeData.cities.map((cityOption) => (
                    <option key={cityOption} value={cityOption}>{cityOption}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={newAddress.city}
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, city: e.target.value })
                  }
                />
              )}
              {errors.city && <p className="error">{errors.city}</p>}
            </div>

            <div className="form-group">
              <label>State / Province</label>
              <input
                type="text"
                value={newAddress.state}
                readOnly
              />
              {errors.state && <p className="error">{errors.state}</p>}
            </div>

            <div className="form-group">
              <label>ZIP / Postal Code</label>
              <input
                type="text"
                value={newAddress.zip}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, zip: e.target.value.replace(/\D/g, "").slice(0, 6) })
                }
              />
              {errors.zip && <p className="error">{errors.zip}</p>}
              {pincodeData.loading && <p>Checking pincode...</p>}
            </div>

            <div className="form-group">
              <label>Country</label>
              <input
                type="text"
                value="India"
                readOnly
              />
              {errors.country && <p className="error">{errors.country}</p>}
            </div>

            <div className="form-group">
              <label>Address Label (Home / Work)</label>
              <input
                type="text"
                value={newAddress.label}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, label: e.target.value })
                }
              />
              {errors.label && <p className="error">{errors.label}</p>}
            </div>

            <div className="form-group">
              <label>Delivery Instructions (optional)</label>
              <textarea
                value={newAddress.instructions || ""}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, instructions: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={newAddress.is_default}
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, is_default: e.target.checked })
                  }
                />{" "}
                Set as Default Address
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setShowNewAddress(false);
                  resetNewAddressForm();
                }}
              >
                Cancel
              </button>
              <button type="button" onClick={handleSaveAddress}>
                Save Address
              </button>
            </div>
          </div>
        </div>
      )}
      <h3>{checkoutConfig.paymentSectionTitle || "Payment Method"}</h3>
        {showMockPaymentForm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Enter Payment Details</h3>
              <div>
                {payment === 'card' && (
                  <>
                    <div className="form-group">
                      <label>Card Number</label>
                      <input
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        maxLength="19"
                        value={mockPaymentData.cardNumber}
                        onChange={(e) => {
                          setMockPaymentData({...mockPaymentData, cardNumber: e.target.value.replace(/\D/g, '').slice(0, 16)});
                          setMockPaymentErrors((prev) => ({ ...prev, cardNumber: undefined }));
                        }}
                      />
                      {mockPaymentErrors.cardNumber && <p className="error">{mockPaymentErrors.cardNumber}</p>}
                    </div>
                    <div className="form-group">
                      <label>Cardholder Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={mockPaymentData.cardName}
                        onChange={(e) => {
                          setMockPaymentData({...mockPaymentData, cardName: e.target.value});
                          setMockPaymentErrors((prev) => ({ ...prev, cardName: undefined }));
                        }}
                      />
                      {mockPaymentErrors.cardName && <p className="error">{mockPaymentErrors.cardName}</p>}
                    </div>
                    <div className="form-group">
                      <label>Expiry Date (MM/YY)</label>
                      <input
                        type="text"
                        placeholder="12/25"
                        maxLength="5"
                        value={mockPaymentData.cardExpiry}
                        onChange={(e) => {
                          setMockPaymentData({...mockPaymentData, cardExpiry: normalizeCardExpiryInput(e.target.value)});
                          setMockPaymentErrors((prev) => ({ ...prev, cardExpiry: undefined }));
                        }}
                      />
                      {mockPaymentErrors.cardExpiry && <p className="error">{mockPaymentErrors.cardExpiry}</p>}
                    </div>
                    <div className="form-group">
                      <label>CVV</label>
                      <input
                        type="text"
                        placeholder="123"
                        maxLength="4"
                        value={mockPaymentData.cardCvv}
                        onChange={(e) => {
                          setMockPaymentData({...mockPaymentData, cardCvv: e.target.value.replace(/\D/g, '').slice(0, 4)});
                          setMockPaymentErrors((prev) => ({ ...prev, cardCvv: undefined }));
                        }}
                      />
                      {mockPaymentErrors.cardCvv && <p className="error">{mockPaymentErrors.cardCvv}</p>}
                    </div>
                  </>
                )}
                {payment === 'upi' && (
                  <div className="form-group">
                    <label>UPI ID</label>
                    <input
                      type="text"
                      placeholder="username@bankname"
                      value={mockPaymentData.upiId}
                      onChange={(e) => {
                        setMockPaymentData({...mockPaymentData, upiId: e.target.value});
                        setMockPaymentErrors((prev) => ({ ...prev, upiId: undefined }));
                      }}
                    />
                    {mockPaymentErrors.upiId && <p className="error">{mockPaymentErrors.upiId}</p>}
                  </div>
                )}
                <p style={{fontSize: '12px', color: '#666', marginTop: '10px'}}>
                  This is a mock payment gateway. No real charge will be made.
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMockPaymentForm(false);
                      setPendingPaymentConfirm(null);
                      setMockPaymentErrors({});
                      setIsSubmitting(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="button" onClick={handleMockPaymentSubmit}>
                    Pay Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      {availablePaymentMethods.map((method) => (
        <label key={method.id}>
          <input
            type="radio"
            name="payment"
            value={method.id}
            checked={payment === method.id}
            onChange={() => setPayment(method.id)}
          />{" "}
          {method.label}
        </label>
      ))}
      {(payment === "card" || payment === "upi") && (
        <p className="checkout-gateway-note">
          {String(checkoutConfig.paymentProvider || "").toLowerCase() === "mock"
            ? checkoutConfig.gatewayNoteMock || "Mock payment API is active. This flow is fully simulated for integration testing with no real charge."
            : checkoutConfig.gatewayNoteSandbox || "Payment gateway is integrated. If sandbox mode is enabled in Admin Settings, this flow is simulated with no real charge."}
        </p>
      )}

      <button type="submit" disabled={isSubmitting || isAdminUser}>
        {isAdminUser
          ? (checkoutConfig.adminPlaceOrderBlockedLabel || "Admin purchase blocked")
          : isSubmitting
            ? checkoutConfig.placingOrderLabel || "Placing Order..."
            : checkoutConfig.placeOrderLabel || "Place Order"}
      </button>
      {errors.address && <p className="error">{errors.address}</p>}
      {errors.billingAddress && <p className="error">{errors.billingAddress}</p>}
      {errors.payment && <p className="error">{errors.payment}</p>}
      {paymentLabelMap[payment] && <p>{checkoutConfig.selectedPaymentPrefix || "Selected payment:"} {paymentLabelMap[payment]}</p>}
      {isAdminUser && <p className="error">{adminCheckoutBlockedMessage}</p>}
      {message && <p>{message}</p>}
      {guestUpsell && (
        <div className="checkout-guest-upsell">
          <h3>{checkoutConfig.guestUpsell?.title || "Sign up now and claim your next-order reward"}</h3>
          <p>{guestUpsell}</p>
          {guestUpsellCoupon && (
            <p>
              {checkoutConfig.guestUpsell?.rewardCodeLabel || "Sign-up reward code:"} <strong>{guestUpsellCoupon}</strong>
            </p>
          )}
          {guestCheckoutEmail && (
            <p>
              {applyTemplate(
                checkoutConfig.guestUpsell?.emailTemplate,
                { email: guestCheckoutEmail },
                "Sign up with {email} to keep this order linked to your account."
              )}
            </p>
          )}
          {guestOrderNumber && (
            <p>
              {applyTemplate(
                checkoutConfig.guestUpsell?.supportTemplate,
                { email: guestCheckoutEmail || "your email", orderId: guestOrderNumber },
                "Your order tracking is already going to {email}. Keep Order ID {orderId} for support."
              )}
            </p>
          )}
          <div className="checkout-guest-upsell-actions">
            <button
              type="button"
              onClick={() =>
                navigate(`/register?email=${encodeURIComponent(guestCheckoutEmail)}&coupon=${encodeURIComponent(guestUpsellCoupon || "")}`)
              }
            >
              {checkoutConfig.guestUpsell?.ctaLabel || "Sign Up Now"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export default Checkout;
