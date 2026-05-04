import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "../styles/Login.css";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromQuery = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [token, setToken] = useState(tokenFromQuery);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());
  const resetCopy = siteContent.authPages?.resetPassword || {};

  React.useEffect(() => {
    const controller = new AbortController();
    fetchPublicSiteContent(controller.signal)
      .then((content) => setSiteContent(content))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!token.trim()) {
      setError(resetCopy.tokenRequiredText || "Reset token is required.");
      return;
    }

    if (password !== confirmPassword) {
      setError(resetCopy.passwordMismatchText || "Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError(resetCopy.passwordMinText || "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/ecommerce/reset_password.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token: token.trim(), password })
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        setError(data.error || resetCopy.failedText || "Password reset failed.");
        return;
      }

      setMessage(data.message || resetCopy.successText || "Password reset successful.");
      setTimeout(() => navigate("/login"), 1200);
    } catch {
      setError(resetCopy.networkErrorText || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
        <h2 className="login-title">{resetCopy.title || "Reset Password"}</h2>
        <p className="subtext">{resetCopy.subtitle || "Enter your reset token and a new password."}</p>

        <input
          type="text"
          placeholder={resetCopy.tokenPlaceholder || "Reset Token"}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder={resetCopy.passwordPlaceholder || "New Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder={resetCopy.confirmPasswordPlaceholder || "Confirm New Password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading} className="login-btn">
          {loading ? (resetCopy.loadingLabel || "Updating...") : (resetCopy.submitLabel || "Reset Password")}
        </button>

        {message && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}

        <p className="login-footer-link">
          {resetCopy.backToLoginPrefix || "Back to"} <Link to="/login">{resetCopy.backToLoginLabel || "login"}</Link>
        </p>
      </form>
    </div>
  );
}

export default ResetPassword;
