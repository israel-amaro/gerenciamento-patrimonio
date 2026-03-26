import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const RoleRoute = ({ roles, children }) => {
  const { profile, loading, isAnonymous } = useAuth();

  if (loading) {
    return null;
  }

  if (!profile) {
    return <Navigate to="/app/loans" replace />;
  }

  if (!roles.includes(profile.role)) {
    return <Navigate to={isAnonymous ? "/app/loans" : "/admin/login"} replace />;
  }

  return children;
};

export default RoleRoute;
