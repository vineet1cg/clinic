import { Navigate, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../feedback/LoadingScreen.jsx';
import { useAuth } from '../../hooks/useAuth.js';

export function ProtectedRoute({ children, allowPasswordReset = false }) {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen label="Checking your secure session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.passwordResetRequired && !allowPasswordReset) {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}
