import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { formatMXN, propertyTypeLabel } from "../../lib/format";
import { applyPropertyTypeLabels } from "../../lib/propertyTypeLabels";
import InlineRename from "../../components/InlineRename";
import "./admin.css";

export default function AdminZones() {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [properties, setProperties] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newLandPrice, setNewLandPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [addingType, setAddingType] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState(null);
  const [togglingTypeId, setTogglingTypeId] = useState(null);
  const [uploadingImageId, setUploadingImageId] = useState(null);
  const [newAmenityLabel, setNewAmenityLabel] = useState("");
  const [addingAmenity, setAddingAmenity] = useState(false);
  const [deletingAmenityId, setDeletingAmenityId] = useState(null);

  const load = () => {
    Promise.all([db.getZones(), db.getProperties({}), db.getPropertyTypes(), db.getAmenities()]).then(
      ([zoneData, propertyData, typeData, amenityData]) => {
        setZones(zoneData);
        setProperties(propertyData);
        setPropertyTypes(typeData);
        applyPropertyTypeLabels(typeData);
        setAmenities(amenityData);
        setDrafts(
          Object.fromEntries(zoneData.map((z) => [z.id, { built: z.price_per_m2, land: z.land_price_per_m2 ?? 0 }]))
        );
      }
    );
  };

  useEffect(load, []);

  const propertyCountByZone = (zoneName) => properties.filter((p) => p.zone === zoneName).length;
  const propertyCountByType = (typeKey) => properties.filter((p) => p.type === typeKey).length;
  const propertyCountByAmenity = (key) => properties.filter((p) => (p.amenities || []).includes(key)).length;

  const handleSave = async (zone) => {
    setSavingId(zone.id);
    try {
      const draft = drafts[zone.id];
      // El precio de terreno solo viaja si cambió: así guardar la construcción
      // no falla en una base a la que aún no se le agregó esa columna.
      const landChanged = Number(draft.land) !== Number(zone.land_price_per_m2 ?? 0);
      await db.updateZonePrice(zone.id, draft.built, landChanged ? draft.land : undefined);
      setSavedId(zone.id);
      setTimeout(() => setSavedId(null), 1500);
      load();
    } catch (err) {
      window.alert(err.message || "Error al guardar la zona");
    } finally {
      setSavingId(null);
    }
  };

  // Las propiedades guardan el nombre de la zona como texto: renombrarla las
  // renombra también (ver db.renameZone), así que se avisa antes si hay alguna.
  const handleRenameZone = async (zone, name) => {
    const inUse = propertyCountByZone(zone.name);
    if (inUse > 0 && !window.confirm(t("zones.renameConfirm", { count: inUse, name }))) return;
    await db.renameZone(zone.id, name);
    load();
  };

  const handleRenameType = async (type, label) => {
    await db.renamePropertyType(type.id, label);
    load();
  };

  const handleRenameAmenity = async (amenity, label) => {
    await db.renameAmenity(amenity.id, label);
    load();
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await db.addZone({ name: newName, price_per_m2: newPrice, land_price_per_m2: newLandPrice });
      setNewName("");
      setNewPrice("");
      setNewLandPrice("");
      load();
    } catch (err) {
      window.alert(err.message || "Error al agregar la zona");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (zone) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingId(zone.id);
    try {
      await db.deleteZone(zone.id);
      load();
    } catch (err) {
      window.alert(err.message || "Error al eliminar la zona");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddType = async (e) => {
    e.preventDefault();
    if (!newTypeLabel.trim()) return;
    setAddingType(true);
    try {
      await db.addPropertyType({ label: newTypeLabel });
      setNewTypeLabel("");
      load();
    } catch (err) {
      window.alert(err.message || "Error al agregar el tipo de propiedad");
    } finally {
      setAddingType(false);
    }
  };

  const handleDeleteType = async (type) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingTypeId(type.id);
    try {
      await db.deletePropertyType(type.id);
      load();
    } catch (err) {
      window.alert(err.message || "Error al eliminar el tipo de propiedad");
    } finally {
      setDeletingTypeId(null);
    }
  };

  const handleToggleTypeActive = async (type) => {
    setTogglingTypeId(type.id);
    try {
      await db.togglePropertyTypeActive(type.id, type.active === false);
      load();
    } catch (err) {
      window.alert(err.message || "Error al cambiar el estado del tipo de propiedad");
    } finally {
      setTogglingTypeId(null);
    }
  };

  const handleTypeImageChange = async (type, file) => {
    if (!file) return;
    setUploadingImageId(type.id);
    try {
      await db.updatePropertyTypeImage(type.id, file);
      load();
    } catch (err) {
      window.alert(err.message || "Error al subir la imagen");
    } finally {
      setUploadingImageId(null);
    }
  };

  const handleAddAmenity = async (e) => {
    e.preventDefault();
    if (!newAmenityLabel.trim()) return;
    setAddingAmenity(true);
    try {
      await db.addAmenity({ label: newAmenityLabel });
      setNewAmenityLabel("");
      load();
    } catch (err) {
      window.alert(err.message || "Error al agregar la amenidad");
    } finally {
      setAddingAmenity(false);
    }
  };

  const handleDeleteAmenity = async (amenity) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingAmenityId(amenity.id);
    try {
      await db.deleteAmenity(amenity.id);
      load();
    } catch (err) {
      window.alert(err.message || "Error al eliminar la amenidad");
    } finally {
      setDeletingAmenityId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("admin.zones")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleAdd} style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
        <h2 className="profiling-section-title">{t("admin.newZone")}</h2>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="zone-new-name">{t("zones.name")}</label>
            <input id="zone-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Matamoros" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="zone-new-price">{t("zones.builtPricePerM2")}</label>
            <input id="zone-new-price" type="number" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="zone-new-land-price">{t("zones.landPricePerM2")}</label>
            <input
              id="zone-new-land-price"
              type="number"
              min="0"
              value={newLandPrice}
              onChange={(e) => setNewLandPrice(e.target.value)}
            />
          </div>
        </div>
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={adding || !newName.trim()}>
            {adding ? <span className="spinner" /> : null}
            {t("zones.add")}
          </button>
        </div>
      </form>

      <div className="admin-zones-grid">
        {zones.map((zone) => {
          const inUse = propertyCountByZone(zone.name);
          return (
            <div key={zone.id} className="card admin-zone-card">
              <InlineRename value={zone.name} label={t("zones.name")} onSave={(name) => handleRenameZone(zone, name)} />
              <p className="form-hint">{t("zones.builtPricePerM2")}: {formatMXN(zone.price_per_m2)}</p>
              <p className="form-hint">{t("zones.landPricePerM2")}: {formatMXN(zone.land_price_per_m2 ?? 0)}</p>
              <p className="form-hint">{t(inUse === 1 ? "zones.inUse_one" : "zones.inUse_other", { count: inUse })}</p>
              <div className="form-field">
                <label htmlFor={`zone-built-${zone.id}`}>{t("zones.builtPricePerM2")}</label>
                <input
                  id={`zone-built-${zone.id}`}
                  type="number"
                  min="0"
                  value={drafts[zone.id]?.built ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [zone.id]: { ...prev[zone.id], built: e.target.value } }))}
                />
              </div>
              <div className="form-field">
                <label htmlFor={`zone-land-${zone.id}`}>{t("zones.landPricePerM2")}</label>
                <input
                  id={`zone-land-${zone.id}`}
                  type="number"
                  min="0"
                  value={drafts[zone.id]?.land ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [zone.id]: { ...prev[zone.id], land: e.target.value } }))}
                />
              </div>
              <div className="admin-zone-card__row">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSave(zone)} disabled={savingId === zone.id}>
                  {savedId === zone.id ? "✓" : t("common.save")}
                </button>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ marginTop: "0.6rem" }}
                onClick={() => handleDelete(zone)}
                disabled={inUse > 0 || deletingId === zone.id}
                title={inUse > 0 ? t("zones.cannotDelete") : undefined}
              >
                {t("common.delete")}
              </button>
            </div>
          );
        })}
      </div>

      <div className="admin-header" style={{ marginTop: "2.5rem" }}>
        <h1>{t("admin.propertyTypes")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleAddType} style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
        <h2 className="profiling-section-title">{t("admin.newPropertyType")}</h2>
        <div className="form-field">
          <label htmlFor="type-new-name">{t("propertyTypesModule.name")}</label>
          <input id="type-new-name" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} placeholder="Bodega" />
        </div>
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={addingType || !newTypeLabel.trim()}>
            {addingType ? <span className="spinner" /> : null}
            {t("propertyTypesModule.add")}
          </button>
        </div>
      </form>

      <div className="admin-zones-grid">
        {propertyTypes.map((type) => {
          const inUse = propertyCountByType(type.key);
          const isActive = type.active !== false;
          return (
            <div key={type.id} className="card admin-zone-card">
              {type.image_url && <img src={type.image_url} alt="" className="admin-zone-card__thumb" />}
              <InlineRename
                value={propertyTypeLabel(t, type.key)}
                editValue={type.label}
                label={t("propertyTypesModule.name")}
                onSave={(label) => handleRenameType(type, label)}
              />
              <p className="form-hint">{t(inUse === 1 ? "propertyTypesModule.inUse_one" : "propertyTypesModule.inUse_other", { count: inUse })}</p>

              <label className="btn btn-outline btn-sm" style={{ marginBottom: "0.6rem", display: "inline-block" }}>
                {uploadingImageId === type.id ? <span className="spinner" /> : t("propertyTypesModule.changeImage")}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleTypeImageChange(type, e.target.files?.[0])}
                  disabled={uploadingImageId === type.id}
                />
              </label>

              <div className="admin-zone-card__row">
                <button
                  type="button"
                  className={`badge ${isActive ? "badge-available" : "badge-sold"}`}
                  onClick={() => handleToggleTypeActive(type)}
                  disabled={togglingTypeId === type.id}
                >
                  {isActive ? t("common.active") : t("propertyTypesModule.comingSoon")}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteType(type)}
                  disabled={inUse > 0 || deletingTypeId === type.id}
                  title={inUse > 0 ? t("propertyTypesModule.cannotDelete") : undefined}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-header" style={{ marginTop: "2.5rem" }}>
        <h1>{t("admin.amenities")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleAddAmenity} style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
        <h2 className="profiling-section-title">{t("admin.newAmenity")}</h2>
        <div className="form-field">
          <label htmlFor="amenity-new-name">{t("properties.amenities")}</label>
          <input id="amenity-new-name" value={newAmenityLabel} onChange={(e) => setNewAmenityLabel(e.target.value)} placeholder="Alberca" />
        </div>
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={addingAmenity || !newAmenityLabel.trim()}>
            {addingAmenity ? <span className="spinner" /> : null}
            {t("admin.newAmenity")}
          </button>
        </div>
      </form>

      <div className="admin-zones-grid">
        {amenities.map((amenity) => {
          const inUse = propertyCountByAmenity(amenity.key);
          return (
            <div key={amenity.id} className="card admin-zone-card">
              <InlineRename value={amenity.label} label={t("properties.amenities")} onSave={(label) => handleRenameAmenity(amenity, label)} />
              <p className="form-hint">{t(inUse === 1 ? "propertyTypesModule.inUse_one" : "propertyTypesModule.inUse_other", { count: inUse })}</p>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteAmenity(amenity)}
                disabled={inUse > 0 || deletingAmenityId === amenity.id}
                title={inUse > 0 ? t("propertyTypesModule.cannotDelete") : undefined}
              >
                {t("common.delete")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
