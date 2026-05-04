import React, { useEffect, useState } from "react";
import { adminFetch, getStoredUser } from "../../utils/adminApi";

const ROLES = ["customer", "super_admin"];
const STATUSES = [
  { value: "active", label: "active" },
  { value: "inactive", label: "inactive" },
  { value: "banned", label: "blocked" }
];

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState({ name: "", email: "", role: "customer", status: "active", phone_number: "" });
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const currentUser = getStoredUser();

  const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

  useEffect(() => {
    let active = true;
    setLoading(true);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());

    adminFetch(`admin_users.php?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        setUsers(payload.users || []);
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
  }, [query, refreshKey]);

  const handleUpdate = async (userId, role, status) => {
    try {
      await adminFetch("admin_users.php", {
        method: "POST",
        body: JSON.stringify({ action: "update", user_id: userId, role, status })
      });
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError("");

    try {
      await adminFetch("admin_users.php", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          name: createForm.name,
          email: createForm.email,
          role: createForm.role,
          status: createForm.status,
          phone_number: createForm.phone_number
        })
      });
      setCreateForm({ name: "", email: "", role: "customer", status: "active", phone_number: "" });
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (user) => {
    const userId = Number(user?.id || 0);
    const isSelf = Number(currentUser?.id) === userId;
    const isActive = normalizeStatus(user?.status) === "active";

    if (isSelf) {
      const message = "You cannot deactivate your own account.";
      setError(message);
      window.alert(message);
      return;
    }

    if (!isActive) {
      const message = "Only active users can be deactivated.";
      setError(message);
      window.alert(message);
      return;
    }

    const confirmed = window.confirm("Deactivate this user account?");
    if (!confirmed) return;

    try {
      await adminFetch("admin_users.php", {
        method: "POST",
        body: JSON.stringify({ action: "deactivate", user_id: userId })
      });
      setError("");
      window.alert("User deactivated successfully.");
      setRefreshKey((v) => v + 1);
    } catch (err) {
      const message = err?.message || "Failed to deactivate user.";
      setError(message);
      window.alert(message);
    }
  };

  return (
    <section>
      <header className="admin-page-head">
        <h2>Users</h2>
        <p>Create users, manage roles, and deactivate accounts instead of hard delete.</p>
      </header>

      <div className="admin-card">
        <h3>Create User</h3>
        <form className="admin-form-grid" onSubmit={handleCreate}>
          <input
            placeholder="Name"
            value={createForm.name}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
          <input
            placeholder="Phone (optional)"
            value={createForm.phone_number}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, phone_number: e.target.value }))}
          />
          <select
            value={createForm.role}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={createForm.status}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <input
            placeholder="Search name / email / phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <p>Loading users...</p>
        ) : error ? (
          <p className="admin-error">{error}</p>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Update</th>
                  <th>Deactivate</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan="7">No users found.</td>
                  </tr>
                )}
                {users.map((user) => {
                  const isSelf = Number(currentUser?.id) === Number(user.id);
                  const isActive = normalizeStatus(user.status) === "active";
                  const roleId = `role-${user.id}`;
                  const statusId = `status-${user.id}`;

                  return (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <select id={roleId} defaultValue={user.role} disabled={isSelf}>
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select id={statusId} defaultValue={String(user.status || "").toLowerCase() === "blocked" ? "banned" : user.status}>
                          {STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            const roleValue = document.getElementById(roleId)?.value || user.role;
                            const statusValue = document.getElementById(statusId)?.value || user.status;
                            handleUpdate(user.id, roleValue, statusValue);
                          }}
                        >
                          Save
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-danger"
                          onClick={() => handleDeactivate(user)}
                          title={isSelf ? "You cannot deactivate your own account" : (!isActive ? "Only active users can be deactivated" : "Deactivate user")}
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminUsers;
