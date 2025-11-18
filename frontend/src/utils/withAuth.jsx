// frontend/src/utils/withAuth.jsx
import React, { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function withAuth(Component) {
  return function Wrapper(props) {
    const { token } = useContext(AuthContext);
    if (!token) return <Navigate to="/auth" replace />;
    return <Component {...props} />;
  };
}
