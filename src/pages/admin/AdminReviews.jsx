import React, { useEffect, useState } from "react";
import { adminFetch } from "../../utils/adminApi";

function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());

    adminFetch(`admin_reviews.php?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        setReviews(payload.reviews || []);
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

  const handleDelete = async (reviewId) => {
    const confirmed = window.confirm("Delete this review?");
    if (!confirmed) return;

    try {
      await adminFetch("admin_reviews.php", {
        method: "POST",
        body: JSON.stringify({ action: "delete", review_id: reviewId })
      });
      setLoading(true);
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <header className="admin-page-head">
        <h2>Reviews</h2>
        <p>Moderate customer reviews and remove spam/abusive content.</p>
      </header>

      <div className="admin-card">
        <div className="admin-toolbar">
          <input
            placeholder="Search product / user / content"
            value={query}
            onChange={(e) => {
              setLoading(true);
              setQuery(e.target.value);
            }}
          />
        </div>

        {loading ? (
          <p>Loading reviews...</p>
        ) : error ? (
          <p className="admin-error">{error}</p>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Product</th>
                  <th>User</th>
                  <th>Rating</th>
                  <th>Review</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 && (
                  <tr>
                    <td colSpan="6">No reviews found.</td>
                  </tr>
                )}
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>{review.id}</td>
                    <td>{review.product_name || `Product #${review.product_id}`}</td>
                    <td>{review.user_name || `User #${review.user_id}`}</td>
                    <td>{review.rating}</td>
                    <td className="admin-review-text">{review.review_text}</td>
                    <td>
                      <button type="button" className="admin-danger" onClick={() => handleDelete(review.id)}>
                        Delete
                      </button>
                    </td>
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

export default AdminReviews;
