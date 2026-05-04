import React, { useState, useEffect } from "react";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";

function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());

  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicSiteContent(controller.signal)
      .then((content) => setSiteContent(content))
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const profileCopy = siteContent.profilePage || {};

  useEffect(() => {
    if (!token) {
      return;
    }

    fetch("/ecommerce/profile.php", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setProfile(data.profile);
          setForm({
            first_name: data.profile.first_name || "",
            last_name: data.profile.last_name || "",
            phone_number: data.profile.phone_number || "",
            date_of_birth: data.profile.date_of_birth || "",
          });
        } else {
          setError(data.error || profileCopy.loadFailedText || "Failed to load profile.");
        }
      })
      .catch(() => setError(profileCopy.networkErrorText || "Could not reach server."))
      .finally(() => setLoading(false));
  }, [token, profileCopy.loadFailedText, profileCopy.networkErrorText]);

  if (!token) {
    return <div style={{ padding: 24, color: "red" }}>{profileCopy.loginRequiredText || "Please log in to view your profile."}</div>;
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    fetch("/ecommerce/profile.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    })
      .then((r) => r.json())
      .then((data) => {
        setMessage(data.message || (data.success ? (profileCopy.saveSuccessText || "Saved!") : (profileCopy.saveFailedText || "Failed to save.")));
      })
      .catch(() => setMessage(profileCopy.networkErrorText || "Could not reach server."))
      .finally(() => setSaving(false));
  }

  if (loading) return <div style={{ padding: 24 }}>{profileCopy.loadingText || "Loading profile..."}</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>{error}</div>;

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 15,
    marginTop: 4,
    boxSizing: "border-box",
  };

  const labelStyle = { fontWeight: 600, fontSize: 14, color: "#374151" };

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 4 }}>{profileCopy.title || "My Profile"}</h2>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>{profile?.email}</p>

      <form onSubmit={handleSave}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>{profileCopy.firstNameLabel || "First Name"}</label>
            <input
              style={inputStyle}
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
            />
          </div>
          <div>
            <label style={labelStyle}>{profileCopy.lastNameLabel || "Last Name"}</label>
            <input
              style={inputStyle}
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>{profileCopy.phoneLabel || "Phone Number"}</label>
          <input
            style={inputStyle}
            name="phone_number"
            value={form.phone_number}
            onChange={handleChange}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>{profileCopy.dobLabel || "Date of Birth"}</label>
          <input
            style={inputStyle}
            type="date"
            name="date_of_birth"
            value={form.date_of_birth}
            onChange={handleChange}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>{profileCopy.emailLabel || "Email"}</label>
          <input
            style={{ ...inputStyle, background: "#f3f4f6", color: "#6b7280" }}
            value={profile?.email || ""}
            disabled
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>{profileCopy.memberSinceLabel || "Member Since"}</label>
          <input
            style={{ ...inputStyle, background: "#f3f4f6", color: "#6b7280" }}
            value={
              profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : ""
            }
            disabled
          />
        </div>

        {message && (
          <div
            style={{
              marginTop: 12,
              color: message.toLowerCase().includes("fail") ? "red" : "#22c55e",
              fontWeight: 600,
            }}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "12px",
            background: saving ? "#9ca3af" : "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? (profileCopy.savingLabel || "Saving...") : (profileCopy.saveLabel || "Save Changes")}
        </button>
      </form>
    </div>
  );
}

export default Profile;
