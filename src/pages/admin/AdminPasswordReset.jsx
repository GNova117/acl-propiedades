import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../../components/Seo";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/useAuth.js";
import { db } from "../../lib/dataStore";
import { validateNewPassword } from "../../lib/passwordRules";
import "./AdminLogin.css";

// Destino del enlace «Olvidé mi contraseña»: Supabase abre aquí con una sesión de recuperación. Sin sesión (enlace
// vencido o ya usado, o alguien que entra directo) no hay nada que cambiar.
export default function AdminPasswordReset() {
  const { t } = useTranslation();
  const { isAuthenticated, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setError(t(problem));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await db.updatePassword(password);
      setDone(true);
      setTimeout(() => navigate("/admin", { replace: true }), 1500);
    } catch (err) {
      setError(err?.message === "passwordReset:demo" ? t("passwordReset.demo") : t("passwordReset.errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  const usable = isAuthenticated && !isDemoMode;

  return (
    <div className="admin-login">
      <Seo title={t("passwordReset.title")} noindex />
      <form className="admin-login__card card" onSubmit={submit} noValidate>
        <div className="admin-login__logo">
          <Logo size="lg" />
        </div>
        <h1>{t("passwordReset.title")}</h1>
        {done ? (
          <p role="status">{t("passwordReset.done")}</p>
        ) : !usable ? (
          <>
            <p className="form-error" role="alert">
              {isDemoMode ? t("passwordReset.demo") : t("passwordReset.invalidLink")}
            </p>
            <Link to="/admin/login" className="btn btn-outline btn-block">
              {t("passwordReset.backToLogin")}
            </Link>
          </>
        ) : (
          <>
            <p className="form-hint">{t("passwordReset.hint")}</p>
            <div className="form-field">
              <label htmlFor="reset-password">{t("passwordReset.newPassword")}</label>
              <input id="reset-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="form-field">
              <label htmlFor="reset-confirm">{t("passwordReset.confirm")}</label>
              <input id="reset-confirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            <label className="admin-login__show">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {t("admin.showPassword")}
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              {t("passwordReset.save")}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
