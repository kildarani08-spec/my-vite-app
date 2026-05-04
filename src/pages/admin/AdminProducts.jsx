import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { adminFetch } from "../../utils/adminApi";

const initialForm = {
  name: "",
  description: "",
  status: "active",
  category_id: "",
  image: "",
  base_price: "",
  tax_rate: "18",
  stock_quantity: "0",
  tax_included: false,
  product_sku: "",
  variant_sku: ""
};

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    status: "active",
    category_id: "",
    image: ""
  });
  const [updating, setUpdating] = useState(false);
  const editPanelRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);

    adminFetch(`admin_products.php?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        setProducts(payload.products || []);
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
  }, [query, statusFilter, refreshKey]);

  const totalStock = useMemo(
    () => products.reduce((sum, p) => sum + Number(p.total_stock || 0), 0),
    [products]
  );

  const handleCreate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await adminFetch("admin_products.php", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          ...form,
          category_id: form.category_id === "" ? null : Number(form.category_id),
          base_price: Number(form.base_price || 0),
          tax_rate: Number(form.tax_rate || 0),
          stock_quantity: Number(form.stock_quantity || 0),
          tax_included: Boolean(form.tax_included)
        })
      });
      setForm(initialForm);
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId) => {
    const confirmed = window.confirm("Delete this product? It will be removed from the DB when possible. Products with order history will be archived.");
    if (!confirmed) return;

    try {
      setError("");
      await adminFetch("admin_products.php", {
        method: "POST",
        body: JSON.stringify({ action: "delete", product_id: productId })
      });
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (product) => {
    setEditingProductId(product.id);
    setEditForm({
      name: product.name || "",
      description: product.description || "",
      status: product.status || "active",
      category_id: product.category_id === null || product.category_id === undefined ? "" : String(product.category_id),
      image: product.image || ""
    });
    setError("");

    // Bring the edit panel into view so the action is immediately visible.
    setTimeout(() => {
      if (editPanelRef.current) {
        editPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  };

  const cancelEdit = () => {
    setEditingProductId(null);
    setEditForm({
      name: "",
      description: "",
      status: "active",
      category_id: "",
      image: ""
    });
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingProductId) return;

    setUpdating(true);
    setError("");

    try {
      await adminFetch("admin_products.php", {
        method: "POST",
        body: JSON.stringify({
          action: "update",
          product_id: editingProductId,
          name: editForm.name,
          description: editForm.description,
          status: editForm.status,
          category_id: editForm.category_id === "" ? null : Number(editForm.category_id),
          image: editForm.image
        })
      });
      cancelEdit();
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <section>
      <header className="admin-page-head">
        <h2>Products</h2>
        <p>Create, monitor stock, and remove products.</p>
      </header>

      <div className="admin-card">
        <h3>Create Product</h3>
        <form className="admin-form-grid" onSubmit={handleCreate}>
          <input
            placeholder="Product name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            placeholder="Base price"
            type="number"
            min="0"
            step="0.01"
            value={form.base_price}
            onChange={(e) => setForm((prev) => ({ ...prev, base_price: e.target.value }))}
            required
          />
          <input
            placeholder="Tax rate %"
            type="number"
            min="0"
            step="0.01"
            value={form.tax_rate}
            onChange={(e) => setForm((prev) => ({ ...prev, tax_rate: e.target.value }))}
          />
          <input
            placeholder="Stock quantity"
            type="number"
            min="0"
            value={form.stock_quantity}
            onChange={(e) => setForm((prev) => ({ ...prev, stock_quantity: e.target.value }))}
          />
          <input
            placeholder="Image path (optional)"
            value={form.image}
            onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
          />
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <input
            placeholder="Product SKU (optional)"
            value={form.product_sku}
            onChange={(e) => setForm((prev) => ({ ...prev, product_sku: e.target.value }))}
          />
          <input
            placeholder="Variant SKU (optional)"
            value={form.variant_sku}
            onChange={(e) => setForm((prev) => ({ ...prev, variant_sku: e.target.value }))}
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <label className="admin-inline-check">
            <input
              type="checkbox"
              checked={form.tax_included}
              onChange={(e) => setForm((prev) => ({ ...prev, tax_included: e.target.checked }))}
            />
            Tax included in base price
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Create Product"}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <input
            placeholder="Search name / sku"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="admin-toolbar-info">Total stock: {totalStock}</div>
        </div>

        {loading ? (
          <p>Loading products...</p>
        ) : error ? (
          <p className="admin-error">{error}</p>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Status</th>
                  <th>Variants</th>
                  <th>Min Base Price</th>
                  <th>Stock</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan="8">No products found.</td>
                  </tr>
                )}
                {products.map((product) => (
                  <Fragment key={product.id}>
                    <tr style={editingProductId === product.id ? { background: "#f2fbf6" } : undefined}>
                      <td>{product.id}</td>
                      <td>{product.name}</td>
                      <td>{product.sku}</td>
                      <td>{product.status}</td>
                      <td>{product.variant_count}</td>
                      <td>Rs. {Number(product.min_base_price || 0).toFixed(2)}</td>
                      <td>{product.total_stock}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button type="button" onClick={() => startEdit(product)}>
                            Edit
                          </button>
                          <button type="button" className="admin-danger" onClick={() => handleDelete(product.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingProductId === product.id && (
                      <tr>
                        <td colSpan="8">
                          <form className="admin-form-grid" onSubmit={handleUpdate} ref={editPanelRef}>
                            <input
                              placeholder="Product name"
                              value={editForm.name}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                              required
                            />
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                            <input
                              placeholder="Category ID (optional)"
                              type="number"
                              min="1"
                              value={editForm.category_id}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, category_id: e.target.value }))}
                            />
                            <input
                              placeholder="Image path (optional)"
                              value={editForm.image}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, image: e.target.value }))}
                            />
                            <textarea
                              placeholder="Description"
                              value={editForm.description}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                            />
                            <div style={{ display: "flex", gap: "0.6rem" }}>
                              <button type="submit" disabled={updating}>
                                {updating ? "Updating..." : "Save Product"}
                              </button>
                              <button type="button" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminProducts;
