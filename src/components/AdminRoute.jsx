import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuthToken, getStoredUser } from "../utils/adminApi";

function AdminRoute({ children }) {
  const location = useLocation();
  const token = getAuthToken();
  const user = getStoredUser();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!user || String(user.role).toLowerCase() !== "super_admin") {
    return <Navigate to="/products" replace />;
  }

  return children;
}

export default AdminRoute;
