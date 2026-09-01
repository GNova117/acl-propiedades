import { useTranslation } from "react-i18next";
import { BUYER_PROFILE_FIELDS, SELLER_PROFILE_FIELDS } from "../lib/profileFields";

function FieldInput({ field, value, onChange }) {
  const { t } = useTranslation();
  const id = `profile-${field.key}`;

  if (field.type === "textarea") {
    return <textarea id={id} rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "select") {
    return (
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {t(`clientProfile.options.${field.key}.${opt}`)}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "boolean") {
    return <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  }
  return (
    <input id={id} type={field.type === "number" ? "number" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  );
}

function FieldGroup({ title, fields, values, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="client-profile-form__group">
      <h4>{title}</h4>
      {fields.length === 0 ? (
        <p className="form-hint">{t("clientProfile.noFields")}</p>
      ) : (
        <div className="form-row">
          {fields.map((field) => (
            <div className="form-field" key={field.key}>
              <label htmlFor={`profile-${field.key}`}>{t(field.label)}</label>
              <FieldInput field={field} value={values[field.key]} onChange={(value) => onChange(field.key, value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientProfileForm({ type, profile, onChange }) {
  const { t } = useTranslation();
  const buyer = profile?.buyer || {};
  const seller = profile?.seller || {};

  const updateBuyer = (key, value) => onChange({ ...profile, buyer: { ...buyer, [key]: value } });
  const updateSeller = (key, value) => onChange({ ...profile, seller: { ...seller, [key]: value } });

  const showBuyer = type === "comprador" || type === "ambos";
  const showSeller = type === "vendedor" || type === "ambos";

  return (
    <div className="client-profile-form">
      {showBuyer && (
        <FieldGroup title={t("clientProfile.buyerSection")} fields={BUYER_PROFILE_FIELDS} values={buyer} onChange={updateBuyer} />
      )}
      {showSeller && (
        <FieldGroup title={t("clientProfile.sellerSection")} fields={SELLER_PROFILE_FIELDS} values={seller} onChange={updateSeller} />
      )}
    </div>
  );
}
