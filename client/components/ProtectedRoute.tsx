import React from 'react';
import { Navigate } from 'react-router-dom';
import { User, UserRole } from '../types';

interface ProtectedRouteProps {
  user: User | null;
  isAuthenticated: boolean;
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  user,
  isAuthenticated,
  children,
  requireAdmin = false
}) => {
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== UserRole.ADMIN) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
