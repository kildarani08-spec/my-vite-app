import React, { useEffect, useState } from "react";
import "../styles/Login.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../contexts/useCart";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.success;
  const guestUpgradeMessage = location.state?.guestUpgradeMessage;
  const redirectTo = typeof location.state?.redirectTo === "string" ? location.state.redirectTo : "";
  const { fetchCart } = useCart();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefillEmail = params.get("email") || location.state?.prefillEmail;
    if (prefillEmail) {
      setEmail(prefillEmail);
      return;
    }

    const rememberedEmail = localStorage.getItem("remembered_email");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, [location.search, location.state]);

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicSiteContent(controller.signal)
      .then((content) => {
        setSiteContent(content);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const loginCopy = siteContent.authPages?.login || {};

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const guestToken = localStorage.getItem("guest_token");

      const res = await fetch("https://my-vite-app-backend.onrender.com/login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, guest_token: guestToken })
      });

      const data = await res.json();

      if (res.ok && data.token) {
        // Save token + user
        if (rememberMe) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("remembered_email", email);
        } else {
          sessionStorage.setItem("token", data.token);
          sessionStorage.setItem("user", JSON.stringify(data.user));
          localStorage.removeItem("remembered_email");
        }
        console.log("Logged in user ID:", data.user.id);

        // Optionally store merged cart returned from backend
        if (data.cart) {
          localStorage.setItem("userCart", JSON.stringify(data.cart));
        }

        await fetchCart();

        if (redirectTo && redirectTo.startsWith("/")) {
          navigate(redirectTo, { replace: true });
          return;
        }

        // Role-based redirect
        if (String(data.user.role || "").toLowerCase() === "super_admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/products");
        }
      } else {
        setError(data.error || loginCopy.invalidCredentialsText || "Invalid credentials");
      }
    } catch {
      setError(loginCopy.networkErrorText || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form" autoComplete="on">
        <h2 className="login-title">{loginCopy.title || "Login"}</h2>
        {successMessage && <p className="success-text">{successMessage}</p>}
        {guestUpgradeMessage && <p className="success-text">{guestUpgradeMessage}</p>}

        <input
          name="email"
          type="email"
          autoComplete="username"
          placeholder={loginCopy.emailPlaceholder || "Email"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={loginCopy.passwordPlaceholder || "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="login-options">
          <label>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={() => setRememberMe(!rememberMe)}
            />
            {loginCopy.rememberMeLabel || "Remember Me"}
          </label>
          <Link to="/forgot-password" className="forgot-link">
            {loginCopy.forgotPasswordLabel || "Forgot Password?"}
          </Link>
        </div>

        <button type="submit" disabled={loading} className="login-btn">
          {loading ? (loginCopy.loadingLabel || "Logging in...") : (loginCopy.submitLabel || "Login")}
        </button>

        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}

export default Login;
