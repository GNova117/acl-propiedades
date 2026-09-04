import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { SECTION_KEYS, ADMIN_ROLE_SLUG } from "../../lib/accessControl";
import "./admin.css";

export default function AdminRoles() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState([]);
  const [access, setAccess] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleSections, setNewRoleSections] = useState([]);
  const [addingRole, setAddingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState(null);
  const [newAccessEmail, setNewAccessEmail] = useState("");
  const [newAccessRoleId, setNewAccessRoleId] = useState("");
  const [addingAccess, setAddingAccess] = useState(false);
  const [deletingAccessId, setDeletingAccessId] = useState(null);
  const [changingAccessId, setChangingAccessId] = useState(null);

  const load = () => {
    Promise.all([db.getRoles(), db.getAccess()]).then(([roleData, accessData]) => {
      setRoles(roleData);
      setAccess(accessData);
    });
  };

  useEffect(load, []);

  const toggleNewRoleSection = (key) => {
    setNewRoleSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleAddRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setAddingRole(true);
    try {
      await db.addRole({ name: newRoleName, sections: newRoleSections });
      setNewRoleName("");
      setNewRoleSections([]);
      load();
    } catch (err) {
      window.alert(err.message || "Error al crear el rol");
    } finally {
      setAddingRole(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingRoleId(role.id);
    try {
      await db.deleteRole(role.id);
      load();
    } catch (err) {
      window.alert(err.message || t("accessControl.roleInUse"));
    } finally {
      setDeletingRoleId(null);
    }
  };

  const handleAddAccess = async (e) => {
    e.preventDefault();
    if (!newAccessEmail.trim() || !newAccessRoleId) return;
    setAddingAccess(true);
    try {
      await db.addAccess({ email: newAccessEmail, role_id: newAccessRoleId });
      setNewAccessEmail("");
      setNewAccessRoleId("");
      load();
    } catch (err) {
      window.alert(err.message || "Error al dar acceso");
    } finally {
      setAddingAccess(false);
    }
  };

  const handleChangeAccessRole = async (accessRow, roleId) => {
    setChangingAccessId(accessRow.id);
    try {
      await db.updateAccess(accessRow.id, { role_id: roleId });
      load();
    } catch (err) {
      window.alert(err.message || "Error al cambiar el rol");
    } finally {
      setChangingAccessId(null);
    }
  };

  const handleDeleteAccess = async (accessRow) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingAccessId(accessRow.id);
    try {
      await db.deleteAccess(accessRow.id);
      load();
    } finally {
      setDeletingAccessId(null);
    }
  };

  const inUseCount = (roleId) => access.filter((a) => a.role_id === roleId).length;

  return (
    <div>
      <div className="admin-header">
        <h1>{t("accessControl.rolesTitle")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleAddRole} style={{ maxWidth: 560, marginBottom: "1.5rem" }}>
        <h2 className="profiling-section-title">{t("accessControl.newRole")}</h2>
        <div className="form-field">
          <label htmlFor="role-new-name">{t("accessControl.roleName")}</label>
          <input id="role-new-name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Ventas" />
        </div>
        <div className="form-field">
          <label>{t("accessControl.roleSections")}</label>
          <div className="access-control__checkbox-grid">
            {SECTION_KEYS.map((key) => (
              <label key={key} className="access-control__checkbox">
                <input type="checkbox" checked={newRoleSections.includes(key)} onChange={() => toggleNewRoleSection(key)} />
                {t(`accessControl.sections.${key}`)}
              </label>
            ))}
          </div>
        </div>
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={addingRole || !newRoleName.trim()}>
            {addingRole ? <span className="spinner" /> : null}
            {t("accessControl.addRole")}
          </button>
        </div>
      </form>

      <div className="admin-zones-grid">
        {roles.map((role) => {
          const locked = role.slug === ADMIN_ROLE_SLUG;
          const inUse = inUseCount(role.id);
          return (
            <div key={role.id} className="card admin-zone-card">
              <h3>{role.name}</h3>
              <p className="form-hint">
                {role.sections.length > 0 ? role.sections.map((key) => t(`accessControl.sections.${key}`)).join(", ") : "—"}
              </p>
              {locked ? (
                <p className="form-hint">{t("accessControl.adminRoleLocked")}</p>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteRole(role)}
                  disabled={inUse > 0 || deletingRoleId === role.id}
                  title={inUse > 0 ? t("accessControl.roleInUse") : undefined}
                >
                  {t("common.delete")}
                </button>
              )}
            </div>
          );
        })}
        {roles.length === 0 && <p className="form-hint">{t("accessControl.noRoles")}</p>}
      </div>

      <div className="admin-header" style={{ marginTop: "2.5rem" }}>
        <h1>{t("accessControl.accessesTitle")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleAddAccess} style={{ maxWidth: 560, marginBottom: "1.5rem" }}>
        <h2 className="profiling-section-title">{t("accessControl.newAccess")}</h2>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="access-new-email">{t("accessControl.accessEmail")}</label>
            <input
              id="access-new-email"
              type="email"
              value={newAccessEmail}
              onChange={(e) => setNewAccessEmail(e.target.value)}
              placeholder="correo@aclpropiedades.com"
            />
          </div>
          <div className="form-field">
            <label htmlFor="access-new-role">{t("accessControl.accessRole")}</label>
            <select id="access-new-role" value={newAccessRoleId} onChange={(e) => setNewAccessRoleId(e.target.value)}>
              <option value="">—</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={addingAccess || !newAccessEmail.trim() || !newAccessRoleId}>
            {addingAccess ? <span className="spinner" /> : null}
            {t("accessControl.addAccess")}
          </button>
        </div>
      </form>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("accessControl.accessEmail")}</th>
              <th>{t("accessControl.accessRole")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {access.map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>
                  <select value={row.role_id} onChange={(e) => handleChangeAccessRole(row, e.target.value)} disabled={changingAccessId === row.id}>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="admin-table__actions">
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteAccess(row)} disabled={deletingAccessId === row.id}>
                    {t("accessControl.removeAccess")}
                  </button>
                </td>
              </tr>
            ))}
            {access.length === 0 && (
              <tr>
                <td colSpan={3}>{t("accessControl.noAccess")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
