import React, { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../utils/adminApi";

function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    if (query.trim()) params.set("q", query.trim());
    if (actionFilter) params.set("action", actionFilter);

    adminFetch(`admin_audit_logs.php?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        setLogs(payload.logs || []);
        setMeta(payload.meta || { page: 1, limit: 20, total: 0, totalPages: 1 });
        setActions(payload.actions || []);
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
  }, [page, query, actionFilter]);

  const actionOptions = useMemo(() => actions.map((row) => row.action_type), [actions]);

  return (
    <section>
      <header className="admin-page-head">
        <h2>Audit Logs</h2>
        <p>Track all critical admin changes with actor, target, and timestamp.</p>
      </header>

      <div className="admin-card">
        <div className="admin-toolbar">
          <input
            placeholder="Search action, target, admin name/email"
            value={query}
            onChange={(e) => {
              setLoading(true);
              setPage(1);
              setQuery(e.target.value);
            }}
          />
          <select
            value={actionFilter}
            onChange={(e) => {
              setLoading(true);
              setPage(1);
              setActionFilter(e.target.value);
            }}
          >
            <option value="">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <span className="admin-toolbar-info">Total: {meta.total || 0}</span>
        </div>

        {loading ? (
          <p>Loading audit logs...</p>
        ) : error ? (
          <p className="admin-error">{error}</p>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>When</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Metadata</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan="7">No audit records found.</td>
                    </tr>
                  )}
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{log.created_at}</td>
                      <td>{log.admin_name || "Unknown"}<br />{log.admin_email || ""}</td>
                      <td>{log.action_type}</td>
                      <td>{log.target_type} {log.target_id ? `#${log.target_id}` : ""}</td>
                      <td>
                        <pre className="admin-audit-meta">{log.metadata || "{}"}</pre>
                      </td>
                      <td>{log.ip_address || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-pagination">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.max(1, p - 1));
                }}
              >
                Previous
              </button>
              <span>Page {meta.page} / {meta.totalPages}</span>
              <button
                type="button"
                disabled={meta.page >= meta.totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.min(meta.totalPages, p + 1));
                }}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default AdminAuditLogs;
