import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../../components/Seo";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";
import "./AdminLogin.css";

export default function AdminLogin() {
  const { t } = useTranslation();
  const { login, isAuthenticated, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={location.state?.from?.pathname || "/admin"} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/admin", { replace: true });
    } catch {
      setError(t("admin.loginError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <Seo title={t("admin.loginTitle")} />
      <form className="admin-login__card card" onSubmit={handleSubmit}>
        <div className="admin-login__logo">
          <Logo size="lg" />
        </div>
        <h1>{t("admin.loginTitle")}</h1>

        {isDemoMode && (
          <div className="admin-login__demo">
            <strong>{t("admin.demoModeTitle")}</strong>
            <p>{t("admin.demoModeBody")}</p>
            <p>
              {t("admin.demoCredentials", {
                email: "admin@aclpropiedades.com",
                password: "Admin123!",
              })}
            </p>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="admin-email">{t("admin.email")}</label>
          <input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>

        <div className="form-field">
          <label htmlFor="admin-password">{t("admin.password")}</label>
          <input
            id="admin-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {t("admin.login")}
        </button>
      </form>
    </div>
  );
}
