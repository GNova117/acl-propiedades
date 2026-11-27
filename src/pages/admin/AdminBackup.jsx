import { useTranslation } from "react-i18next";
import BackupCard from "../../components/BackupCard";
import RetentionCard from "../../components/RetentionCard";
import "./admin.css";

// 332: el respaldo (y la retención de papelería) tienen su propio apartado; antes vivían dentro de «Roles y accesos», donde nadie los buscaba.
export default function AdminBackup() {
  const { t } = useTranslation();
  return (
    <div>
      <div className="admin-header">
        <h1>{t("backup.navTitle")}</h1>
      </div>
      <BackupCard />
      <RetentionCard />
    </div>
  );
}
