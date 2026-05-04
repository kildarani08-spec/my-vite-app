import React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { getStoredUser, logoutUser } from "../../utils/adminApi";
import "../../styles/Admin.css";

function AdminLayout() {
  const user = getStoredUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <h1>Store Super Admin</h1>
        <p className="admin-user">{user?.name || "Super Admin"}</p>
        <nav>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/products">Products</NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
          <NavLink to="/admin/users">Users</NavLink>
          <NavLink to="/admin/reviews">Reviews</NavLink>
          <NavLink to="/admin/content">Site Content</NavLink>
          <NavLink to="/admin/audit-logs">Audit Logs</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
          <NavLink to="/admin/notifications">Notifications</NavLink>
          <NavLink to="/admin/payment-transactions">Payment Transactions</NavLink>
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-link-home">
            Back to Store
          </Link>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
