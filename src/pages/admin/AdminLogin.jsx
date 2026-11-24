import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../../components/Seo";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/dataStore";
import "./AdminLogin.css";

export default function AdminLogin() {
  const { t } = useTranslation();
  const { login, logout, isAuthenticated, isDemoMode, mfaPending, verifyMfaCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetInfo, setResetInfo] = useState("");
  const [code, setCode] = useState("");

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

  // Segundo paso: la cuenta tiene la verificación en dos pasos y la sesión ya tiene la contraseña correcta.
  const handleCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyMfaCode(code);
    } catch {
      setError(t("mfa.badCode"));
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  // «Olvidé mi contraseña»: siempre el mismo mensaje exista o no la cuenta (no se revela qué correos están registrados).
  const handleForgot = async (e) => {
    e.preventDefault();
    setError("");
    setResetInfo("");
    if (!email.trim()) {
      setError(t("passwordReset.needEmail"));
      return;
    }
    setLoading(true);
    try {
      await db.requestPasswordReset(email);
      setResetInfo(t("passwordReset.sent"));
    } catch (err) {
      if (err?.message === "passwordReset:demo") setError(t("passwordReset.demo"));
      else setResetInfo(t("passwordReset.sent"));
    } finally {
      setLoading(false);
    }
  };

  if (mfaPending) {
    return (
      <div className="admin-login">
        <Seo title={t("admin.loginTitle")} noindex />
        <form className="admin-login__card card" onSubmit={handleCode}>
          <div className="admin-login__logo">
            <Logo size="lg" />
          </div>
          <h1>{t("mfa.loginTitle")}</h1>
          <p className="form-hint">{t("mfa.loginHint")}</p>
          <div className="form-field">
            <label htmlFor="mfa-code">{t("mfa.codeLabel")}</label>
            <input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading || code.replace(/\s/g, "").length < 6}>
            {loading ? <span className="spinner" /> : null}
            {t("mfa.verify")}
          </button>
          <button type="button" className="admin-login__forgot" onClick={() => { setCode(""); setError(""); logout(); }}>
            {t("mfa.useOtherAccount")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-login">
      <Seo title={t("admin.loginTitle")} noindex />
      <form className="admin-login__card card" onSubmit={forgot ? handleForgot : handleSubmit}>
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

        {!forgot && (
          <div className="form-field">
            <label htmlFor="admin-password">{t("admin.password")}</label>
            <div className="admin-login__pass">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button type="button" className="admin-login__toggle" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
                {showPassword ? t("admin.hidePassword") : t("admin.showPassword")}
              </button>
            </div>
          </div>
        )}

        {location.state?.idle && !error && <p className="form-hint" role="status">{t("idle.expired")}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {resetInfo && <p className="form-hint" role="status">{resetInfo}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {forgot ? t("passwordReset.sendLink") : t("admin.login")}
        </button>
        <button
          type="button"
          className="admin-login__forgot"
          onClick={() => {
            setForgot((v) => !v);
            setError("");
            setResetInfo("");
          }}
        >
          {forgot ? t("passwordReset.backToLogin") : t("passwordReset.forgot")}
        </button>
      </form>
    </div>
  );
}
