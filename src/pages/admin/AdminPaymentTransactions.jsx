import React, { useEffect, useState } from "react";
import { adminFetch } from "../../utils/adminApi";

function AdminPaymentTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (providerFilter) params.set("provider", providerFilter);

    adminFetch(`admin_payment_transactions.php?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        setTransactions(payload.transactions || []);
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
  }, [query, statusFilter, providerFilter]);

  return (
    <section>
      <header className="admin-page-head">
        <h2>Payment Transactions</h2>
        <p>Read-only financial transaction log for audit and reconciliation.</p>
      </header>

      <div className="admin-card">
        <div className="admin-toolbar">
          <input
            placeholder="Search token / order / payment id"
            value={query}
            onChange={(e) => {
              setLoading(true);
              setQuery(e.target.value);
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setLoading(true);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            <option value="created">Created</option>
            <option value="captured">Captured</option>
            <option value="failed">Failed</option>
            <option value="expired">Expired</option>
          </select>
          <input
            placeholder="Provider (razorpay/mock)"
            value={providerFilter}
            onChange={(e) => {
              setLoading(true);
              setProviderFilter(e.target.value);
            }}
          />
        </div>

        {loading ? (
          <p>Loading payment transactions...</p>
        ) : error ? (
          <p className="admin-error">{error}</p>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Provider</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Order</th>
                  <th>Provider Payment ID</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan="8">No payment transactions found.</td>
                  </tr>
                )}
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.id}</td>
                    <td>{tx.provider || "-"}</td>
                    <td>{tx.payment_method || "-"}</td>
                    <td>{tx.status || "-"}</td>
                    <td>
                      {tx.currency || "INR"} {Number(tx.amount || 0).toFixed(2)}
                    </td>
                    <td>{tx.order_id || "-"}</td>
                    <td>{tx.provider_payment_id || "-"}</td>
                    <td>{tx.created_at || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminPaymentTransactions;
