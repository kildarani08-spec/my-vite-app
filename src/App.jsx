import { BrowserRouter as Router, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Login from "./pages/login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Products from "./pages/products";
import Register from "./pages/register";
import ProductDetail from "./pages/products_detail";
import Checkout from "./pages/Checkout";
import HomePage from "./pages/HomePage";   // ✅ make sure this file exists
import GuestOrderTrack from "./pages/GuestOrderTrack";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Cart from "./pages/cart";
import Profile from "./pages/Profile";
import Orders from "./pages/Orders";
import Wishlist from "./pages/Wishlist";
import Confirmation from "./pages/confirmation";
import AdminRoute from "./components/AdminRoute";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminContent from "./pages/admin/AdminContent";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminPaymentTransactions from "./pages/admin/AdminPaymentTransactions";
import { fetchPublicSiteContent, getDefaultSiteContent } from "./utils/siteContent";
import './App.css';

function parseInternalRoute(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [pathPart, searchPart = ""] = trimmed.split("?", 2);
  const normalizedPath = (pathPart || "/").replace(/\/+$/, "") || "/";
  const searchParams = new URLSearchParams(searchPart);

  return {
    pathname: normalizedPath,
    searchParams
  };
}

function isRouteProtectedByLink(currentRoute, protectedRoute) {
  if (!currentRoute || !protectedRoute) {
    return false;
  }

  if (currentRoute.pathname !== protectedRoute.pathname) {
    return false;
  }

  // A protected link applies when its query requirements are a subset of the current route.
  // Example: protected `/products?sort=relevance` also protects
  // `/products?sort=relevance&limit=2`, but not `/products?category=Books`.
  for (const [key, value] of protectedRoute.searchParams.entries()) {
    const currentValues = currentRoute.searchParams.getAll(key);
    if (!currentValues.includes(value)) {
      return false;
    }
  }

  return true;
}

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicSiteContent(controller.signal)
      .then((content) => {
        setSiteContent(content);
      })
      .catch(() => {
        // Keep defaults when content API is unavailable.
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isAdminRoute) {
      return undefined;
    }

    const controller = new AbortController();

    fetch("https://my-vite-app-backend.onrender.com/products.php?limit=1", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    })
      .then(async (response) => {
        if (response.status === 503) {
          setMaintenanceMode(true);
          return;
        }

        if (response.ok) {
          setMaintenanceMode(false);
        }
      })
      .catch(() => {
        // Leave existing UI state unchanged on transient network issues.
      });

    return () => controller.abort();
  }, [isAdminRoute]);

  const isLoggedIn = Boolean(localStorage.getItem("token") || sessionStorage.getItem("token"));
  const currentRoute = parseInternalRoute(`${location.pathname}${location.search}`);
  const requiresAuthForCurrentRoute = useMemo(() => {
    const links = siteContent?.navbar?.links;
    if (!Array.isArray(links) || links.length === 0 || !currentRoute) {
      return false;
    }

    return links.some((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }

      if (item.enabled === false || item.requiresAuth !== true) {
        return false;
      }

      const targetRoute = parseInternalRoute(item.to || "");
      return isRouteProtectedByLink(currentRoute, targetRoute);
    });
  }, [siteContent, currentRoute]);

  if (!isLoggedIn && requiresAuthForCurrentRoute && location.pathname !== "/login") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          redirectTo: `${location.pathname}${location.search}`,
          guestUpgradeMessage: siteContent.maintenancePage?.loginRequiredText || "Please login to continue."
        }}
      />
    );
  }

  if (!isAdminRoute && maintenanceMode) {
    return (
      <main className="products-container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <section className="admin-card" style={{ maxWidth: "720px", width: "100%", textAlign: "center" }}>
          <h1>{siteContent.maintenancePage?.title || "Store Under Maintenance"}</h1>
          <p>{siteContent.maintenancePage?.description || "We are making updates right now. Please try again later."}</p>
        </section>
      </main>
    );
  }

  return (
    <>
      {!isAdminRoute && <Navbar />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/guest-order-track" element={<GuestOrderTrack />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account/profile" element={<Profile />} />
        <Route path="/account/orders" element={<Orders />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/confirmation" element={<Confirmation />} />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="payment-transactions" element={<AdminPaymentTransactions />} />
        </Route>
      </Routes>
      {!isAdminRoute && <Footer />}
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
