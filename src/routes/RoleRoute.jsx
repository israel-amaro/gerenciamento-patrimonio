import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const RoleRoute = ({ roles, children }) => {
  const { profile, loading, isAnonymous, isAdmin } = useAuth();

  if (loading) {
    return null;
  }

  if (isAdmin && roles.includes("admin")) {
    return children;
  }

  if (!profile) {
    return <Navigate to={isAnonymous ? "/admin/login" : "/app/loans"} replace />;
  }

  if (!roles.includes(profile.role)) {
    return <Navigate to="/app/loans" replace />;
  }

  return children;
};

export default RoleRoute;
