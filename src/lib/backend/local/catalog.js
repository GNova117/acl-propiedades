// Backend de modo demo (localStorage): métodos de «catalog» (20). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { ZONES, ADVISORS, PROPERTIES, PROPERTY_TYPES_SEED, AMENITIES_SEED } from "../../seedData";
import { slugify } from "../../format";
import { compressImageFile, compressImageFiles } from "../../imageCompression";
import { KEYS, readStore, writeStore, uid, fileToDataUrl, filesToDataUrls } from "./shared.js";
import { zoneFields, zonePriceFields } from "../../backendRules";

export const catalogMethods = {
  async getAdvisors() {
    return readStore(KEYS.advisors, ADVISORS);
  },

  async getAdvisorById(id) {
    const advisors = readStore(KEYS.advisors, ADVISORS);
    return advisors.find((a) => a.id === id) || null;
  },

  async addAdvisor(data) {
    const advisors = readStore(KEYS.advisors, ADVISORS);
    let photo_url = data.existingPhoto || "";
    if (data.photoFile) photo_url = await fileToDataUrl(await compressImageFile(data.photoFile));
    const record = {
      id: uid("advisor"),
      name: data.name,
      phone: data.phone,
      email: data.email,
      whatsapp: data.whatsapp,
      bio: data.bio,
      photo_url,
      active: data.active !== false,
      show_in_team: data.show_in_team !== false,
    };
    advisors.push(record);
    writeStore(KEYS.advisors, advisors);
    return record;
  },

  async updateAdvisor(id, data) {
    const advisors = readStore(KEYS.advisors, ADVISORS);
    const idx = advisors.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Asesor no encontrado");
    let photo_url = data.existingPhoto || advisors[idx].photo_url;
    if (data.photoFile) photo_url = await fileToDataUrl(await compressImageFile(data.photoFile));
    const updated = { ...advisors[idx], ...data, photo_url };
    delete updated.photoFile;
    delete updated.existingPhoto;
    advisors[idx] = updated;
    writeStore(KEYS.advisors, advisors);
    return updated;
  },

  async deleteAdvisor(id) {
    const advisors = readStore(KEYS.advisors, ADVISORS);
    writeStore(
      KEYS.advisors,
      advisors.filter((a) => a.id !== id)
    );
  },

  async getZones() {
    return readStore(KEYS.zones, ZONES);
  },

  async addZone(data) {
    const zones = readStore(KEYS.zones, ZONES);
    const name = data.name.trim();
    if (zones.some((z) => z.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ya existe una zona con ese nombre");
    }
    const record = { id: uid("zone"), ...zoneFields({ ...data, name }) };
    zones.push(record);
    writeStore(KEYS.zones, zones);
    return record;
  },

  async deleteZone(id) {
    const zones = readStore(KEYS.zones, ZONES);
    writeStore(KEYS.zones, zones.filter((z) => z.id !== id));
  },

  // Igual que en supabaseBackend: properties.zone guarda el nombre como texto,
  // así que las propiedades de la zona se renombran junto con ella.
  async renameZone(id, name) {
    const zones = readStore(KEYS.zones, ZONES);
    const idx = zones.findIndex((z) => z.id === id);
    if (idx === -1) throw new Error("Zona no encontrada");
    const newName = name.trim();
    if (zones.some((z) => z.id !== id && z.name.toLowerCase() === newName.toLowerCase())) {
      throw new Error("Ya existe una zona con ese nombre");
    }
    const oldName = zones[idx].name;
    zones[idx] = { ...zones[idx], name: newName };
    const properties = readStore(KEYS.properties, PROPERTIES).map((p) => (p.zone === oldName ? { ...p, zone: newName } : p));
    writeStore(KEYS.zones, zones);
    writeStore(KEYS.properties, properties);
    return zones[idx];
  },

  // `land_price_per_m2` es opcional: undefined = no tocar (ver supabaseBackend).
  async updateZonePrice(id, price_per_m2, land_price_per_m2) {
    const zones = readStore(KEYS.zones, ZONES);
    const idx = zones.findIndex((z) => z.id === id);
    if (idx === -1) throw new Error("Zona no encontrada");
    zones[idx] = { ...zones[idx], ...zonePriceFields(price_per_m2, land_price_per_m2) };
    writeStore(KEYS.zones, zones);
    return zones[idx];
  },

  async getPropertyTypes() {
    return readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
  },

  async addPropertyType(data) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    const label = data.label.trim();
    const key = slugify(label);
    if (types.some((t) => t.key === key)) {
      throw new Error("Ya existe un tipo de propiedad con ese nombre");
    }
    const record = { id: uid("type"), key, label };
    types.push(record);
    writeStore(KEYS.propertyTypes, types);
    return record;
  },

  async deletePropertyType(id) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    writeStore(KEYS.propertyTypes, types.filter((t) => t.id !== id));
  },

  async renamePropertyType(id, label) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    const idx = types.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Tipo de propiedad no encontrado");
    types[idx] = { ...types[idx], label: label.trim() };
    writeStore(KEYS.propertyTypes, types);
    return types[idx];
  },

  async getAmenities() {
    return readStore(KEYS.amenities, AMENITIES_SEED);
  },

  async addAmenity(data) {
    const amenities = readStore(KEYS.amenities, AMENITIES_SEED);
    const label = data.label.trim();
    const key = slugify(label);
    if (amenities.some((a) => a.key === key)) {
      throw new Error("Ya existe una amenidad con ese nombre");
    }
    const record = { id: uid("amenity"), key, label, active: true };
    amenities.push(record);
    writeStore(KEYS.amenities, amenities);
    return record;
  },

  async renameAmenity(id, label) {
    const amenities = readStore(KEYS.amenities, AMENITIES_SEED);
    const idx = amenities.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Amenidad no encontrada");
    amenities[idx] = { ...amenities[idx], label: label.trim() };
    writeStore(KEYS.amenities, amenities);
    return amenities[idx];
  },

  async deleteAmenity(id) {
    const amenities = readStore(KEYS.amenities, AMENITIES_SEED);
    writeStore(KEYS.amenities, amenities.filter((a) => a.id !== id));
  },

  async togglePropertyTypeActive(id, active) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    const idx = types.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Tipo de propiedad no encontrado");
    types[idx] = { ...types[idx], active };
    writeStore(KEYS.propertyTypes, types);
    return types[idx];
  },

  async updatePropertyTypeImage(id, file) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    const idx = types.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Tipo de propiedad no encontrado");
    const [image_url] = await filesToDataUrls(await compressImageFiles([file]));
    types[idx] = { ...types[idx], image_url };
    writeStore(KEYS.propertyTypes, types);
    return types[idx];
  },
};
