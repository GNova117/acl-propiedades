import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import "./LoadingScreen.css";

export default function LoadingScreen() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 1100);
    const removeTimer = setTimeout(() => setVisible(false), 1500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`loading-screen ${fadeOut ? "loading-screen--out" : ""}`} role="status" aria-live="polite">
      <div className="loading-screen__content">
        <Logo size="lg" />
        <span className="visually-hidden">{t("a11y.loadingSite")}</span>
      </div>
    </div>
  );
}
