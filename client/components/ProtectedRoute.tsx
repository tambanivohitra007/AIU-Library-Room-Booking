import React from 'react';
import { Navigate } from 'react-router-dom';
import { User, UserRole, isGlobalAdminRole } from '../types';

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
  requireAdmin = false,
}) => {
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const isDeptAdmin = (user.managedDepartmentIds?.length || 0) > 0;

  if (
    requireAdmin &&
    !isGlobalAdminRole(user.role) &&
    user.role !== UserRole.STUDENT_WORKER &&
    !isDeptAdmin
  ) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
