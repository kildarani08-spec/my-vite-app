import React, { useEffect, useState } from "react";
import { adminFetch } from "../../utils/adminApi";

const defaultSettings = {
  paymentGateway: {
    provider: "razorpay",
    sandboxMode: true,
    webhookEnabled: false,
    webhookSecret: ""
  },
  notifications: {
    provider: "mail",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    sendgridApiKey: "",
    mailgunDomain: "",
    mailgunApiKey: "",
    fromEmail: "support@myshop.com",
    enabled: false
  },
  features: {
    allowGuestCheckout: true,
    maintenanceMode: false
  },
  jobs: {
    workerEnabled: false,
    workerToken: "",
    outboxBatchSize: 25,
    maxEmailAttempts: 3,
    retryBackoffSeconds: 90
  }
};

function AdminSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    adminFetch("admin_settings.php")
      .then((payload) => {
        if (!active) return;
        setSettings({
          paymentGateway: {
            ...defaultSettings.paymentGateway,
            ...(payload.settings?.paymentGateway || {})
          },
          notifications: {
            ...defaultSettings.notifications,
            ...(payload.settings?.notifications || {})
          },
          features: {
            ...defaultSettings.features,
            ...(payload.settings?.features || {})
          },
          jobs: {
            ...defaultSettings.jobs,
            ...(payload.settings?.jobs || {})
          }
        });
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateSection = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await adminFetch("admin_settings.php", {
        method: "POST",
        body: JSON.stringify({
          action: "upsert",
          settings
        })
      });
      setSuccess("Operational settings saved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p>Loading settings...</p>;
  }

  return (
    <section>
      <header className="admin-page-head">
        <h2>Operational Settings</h2>
        <p>Manage payment webhook security, email delivery, and global store behavior.</p>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {success && <p className="admin-success">{success}</p>}

      <div className="admin-card">
        <h3>Payment Gateway</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <select
            value={settings.paymentGateway.provider}
            onChange={(e) => updateSection("paymentGateway", "provider", e.target.value)}
          >
            <option value="razorpay">Razorpay</option>
            <option value="mock">Mock API (No real charge)</option>
          </select>
          <label className="admin-inline-check">
            <input
              type="checkbox"
              checked={Boolean(settings.paymentGateway.sandboxMode)}
              onChange={(e) => updateSection("paymentGateway", "sandboxMode", e.target.checked)}
            />
            Sandbox mode (simulate payment, no real charge)
          </label>
          <input
            placeholder="Webhook secret"
            value={settings.paymentGateway.webhookSecret}
            onChange={(e) => updateSection("paymentGateway", "webhookSecret", e.target.value)}
          />
          <label className="admin-inline-check">
            <input
              type="checkbox"
              checked={Boolean(settings.paymentGateway.webhookEnabled)}
              onChange={(e) => updateSection("paymentGateway", "webhookEnabled", e.target.checked)}
            />
            Enable signed payment webhooks
          </label>
        </form>
      </div>

      <div className="admin-card">
        <h3>Email Notifications</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <select
            value={settings.notifications.provider}
            onChange={(e) => updateSection("notifications", "provider", e.target.value)}
          >
            <option value="mail">PHP mail()</option>
            <option value="sendgrid">SendGrid API</option>
            <option value="mailgun">Mailgun API</option>
          </select>
          <input
            type="email"
            placeholder="From email"
            value={settings.notifications.fromEmail}
            onChange={(e) => updateSection("notifications", "fromEmail", e.target.value)}
          />

          {settings.notifications.provider === "sendgrid" && (
            <>
              <input
                placeholder="SendGrid API key"
                value={settings.notifications.sendgridApiKey}
                onChange={(e) => updateSection("notifications", "sendgridApiKey", e.target.value)}
              />
              <input value="SendGrid uses HTTPS API (no SMTP host needed)" disabled />
            </>
          )}

          {settings.notifications.provider === "mailgun" && (
            <>
              <input
                placeholder="Mailgun domain (e.g. mg.example.com)"
                value={settings.notifications.mailgunDomain}
                onChange={(e) => updateSection("notifications", "mailgunDomain", e.target.value)}
              />
              <input
                placeholder="Mailgun API key"
                value={settings.notifications.mailgunApiKey}
                onChange={(e) => updateSection("notifications", "mailgunApiKey", e.target.value)}
              />
            </>
          )}

          {settings.notifications.provider === "mail" && (
            <>
          <input
            placeholder="SMTP host"
            value={settings.notifications.smtpHost}
            onChange={(e) => updateSection("notifications", "smtpHost", e.target.value)}
          />
          <input
            type="number"
            min="1"
            placeholder="SMTP port"
            value={settings.notifications.smtpPort}
            onChange={(e) => updateSection("notifications", "smtpPort", Number(e.target.value || 587))}
          />
          <input
            placeholder="SMTP user"
            value={settings.notifications.smtpUser}
            onChange={(e) => updateSection("notifications", "smtpUser", e.target.value)}
          />
          <input
            placeholder="SMTP password"
            value={settings.notifications.smtpPass}
            onChange={(e) => updateSection("notifications", "smtpPass", e.target.value)}
          />
            </>
          )}

          <label className="admin-inline-check">
            <input
              type="checkbox"
              checked={Boolean(settings.notifications.enabled)}
              onChange={(e) => updateSection("notifications", "enabled", e.target.checked)}
            />
            Enable transactional emails
          </label>
        </form>
      </div>

      <div className="admin-card">
        <h3>Store Features</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <label className="admin-inline-check">
            <input
              type="checkbox"
              checked={Boolean(settings.features.allowGuestCheckout)}
              onChange={(e) => updateSection("features", "allowGuestCheckout", e.target.checked)}
            />
            Allow guest checkout
          </label>
          <label className="admin-inline-check">
            <input
              type="checkbox"
              checked={Boolean(settings.features.maintenanceMode)}
              onChange={(e) => updateSection("features", "maintenanceMode", e.target.checked)}
            />
            Enable maintenance mode
          </label>
        </form>
      </div>

      <div className="admin-card">
        <h3>Background Jobs</h3>
        <form className="admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <label className="admin-inline-check">
            <input
              type="checkbox"
              checked={Boolean(settings.jobs.workerEnabled)}
              onChange={(e) => updateSection("jobs", "workerEnabled", e.target.checked)}
            />
            Enable outbox worker endpoint
          </label>
          <input
            placeholder="Worker token (X-Worker-Token)"
            value={settings.jobs.workerToken}
            onChange={(e) => updateSection("jobs", "workerToken", e.target.value)}
          />
          <input
            type="number"
            min="1"
            max="100"
            placeholder="Outbox batch size"
            value={settings.jobs.outboxBatchSize}
            onChange={(e) => updateSection("jobs", "outboxBatchSize", Number(e.target.value || 25))}
          />
          <input
            type="number"
            min="1"
            max="10"
            placeholder="Max email attempts"
            value={settings.jobs.maxEmailAttempts}
            onChange={(e) => updateSection("jobs", "maxEmailAttempts", Number(e.target.value || 3))}
          />
          <input
            type="number"
            min="10"
            max="3600"
            placeholder="Retry backoff seconds"
            value={settings.jobs.retryBackoffSeconds}
            onChange={(e) => updateSection("jobs", "retryBackoffSeconds", Number(e.target.value || 90))}
          />
        </form>
      </div>

      <div className="admin-card">
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Operational Settings"}
        </button>
      </div>
    </section>
  );
}

export default AdminSettings;
