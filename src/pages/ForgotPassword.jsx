import React, { useState } from "react";
import "../styles/Login.css";
import { Link } from "react-router-dom";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const forgotCopy = siteContent.authPages?.forgotPassword || {};

  React.useEffect(() => {
    const controller = new AbortController();
    fetchPublicSiteContent(controller.signal)
      .then((content) => setSiteContent(content))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/ecommerce/forgot_password.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const raw = await res.text();
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!res.ok || data.success === false) {
        setError(data.error || forgotCopy.failedRequestText || `Request failed (${res.status})`);
        return;
      }

      setMessage(
        data.message ||
          forgotCopy.fallbackSuccessText ||
          "If this email address is registered, a password reset link will be sent."
      );
    } catch {
      setError(forgotCopy.networkErrorText || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
        <h2 className="login-title">{forgotCopy.title || "Forgot Password"}</h2>
        <p className="subtext">{forgotCopy.subtitle || "Enter your account email to request a password reset link."}</p>

        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder={forgotCopy.emailPlaceholder || "Email"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button type="submit" disabled={loading} className="login-btn">
          {loading ? (forgotCopy.loadingLabel || "Sending...") : (forgotCopy.submitLabel || "Send Reset Link")}
        </button>

        {message && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}

        <p className="login-footer-link">
          {forgotCopy.rememberPasswordPrefix || "Remember password?"} <Link to="/login">{forgotCopy.backToLoginLabel || "Back to login"}</Link>
        </p>
      </form>
    </div>
  );
}

export default ForgotPassword;
