import React, { useEffect, useState } from "react";
import { adminFetch } from "../../utils/adminApi";

function AdminNotifications() {
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState({ queued: 0, sent: 0, failed: 0 });
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());

    adminFetch(`admin_notifications.php?${params.toString()}`)
      .then((payload) => {
        setItems(payload.notifications || []);
        setMeta(payload.meta || { page: 1, limit: 20, total: 0, totalPages: 1 });
        setMetrics(payload.metrics || { queued: 0, sent: 0, failed: 0 });
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, query]);

  const processOutbox = async () => {
    setProcessing(true);
    setMessage("");
    setError("");

    try {
      const payload = await adminFetch("admin_notifications.php", {
        method: "POST",
        body: JSON.stringify({ action: "process", limit: 25 })
      });
      const result = payload.result || { processed: 0, sent: 0, failed: 0, requeued: 0 };
      setMessage(`Processed ${result.processed}, sent ${result.sent}, requeued ${result.requeued}, failed ${result.failed}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section>
      <header className="admin-page-head">
        <h2>Notifications</h2>
        <p>Monitor transactional email queue and process pending messages.</p>
      </header>

      <div className="admin-metric-grid">
        <article>
          <h3>Queued</h3>
          <strong>{metrics.queued || 0}</strong>
        </article>
        <article>
          <h3>Sent</h3>
          <strong>{metrics.sent || 0}</strong>
        </article>
        <article>
          <h3>Failed</h3>
          <strong>{metrics.failed || 0}</strong>
        </article>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <input
            placeholder="Search recipient or subject"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
          />
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            <option value="queued">queued</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
          </select>
          <button type="button" onClick={processOutbox} disabled={processing}>
            {processing ? "Processing..." : "Process Outbox"}
          </button>
          <span className="admin-toolbar-info">Total: {meta.total || 0}</span>
        </div>

        {message && <p className="admin-success">{message}</p>}
        {error && <p className="admin-error">{error}</p>}

        {loading ? (
          <p>Loading notifications...</p>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Created</th>
                  <th>Next Attempt</th>
                  <th>Sent</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan="9">No notifications found.</td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.recipient}</td>
                    <td>{item.subject}</td>
                    <td>{item.status}</td>
                    <td>{item.attempts}</td>
                    <td>{item.created_at}</td>
                    <td>{item.next_attempt_at || "-"}</td>
                    <td>{item.sent_at || "-"}</td>
                    <td>{item.last_error || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
          <span>Page {meta.page} / {meta.totalPages}</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}>Next</button>
        </div>
      </div>
    </section>
  );
}

export default AdminNotifications;
