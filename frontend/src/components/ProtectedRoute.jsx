import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isCheckingAuth } = useAuthStore();

  // If we're still checking the backend, show a quick loading indicator
  // ONLY for protected routes
  if (isCheckingAuth) {
    return <div>Checking your session...</div>;
  }

  // Once checkAuth() finishes, if NOT authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If auth is good, render the protected content
  return children;
}

export default ProtectedRoute;
