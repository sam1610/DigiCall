import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, UserRole } from '@/stores/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  // Changed to plural array to fix the App.tsx TypeScript error
  allowedRoles?: UserRole[]; 
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user } = useAuthStore();
  const location = useLocation();

  // Not logged in - redirect to sign in
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // User logged in but accessing wrong role's route
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const redirectPath = user.role === 'supervisor' ? '/supervisor' : '/agent';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}