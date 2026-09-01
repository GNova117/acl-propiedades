-- ACL Propiedades — seed data
-- Run AFTER schema.sql. Safe to re-run: it clears the demo rows first.

truncate table property_advisors, properties, advisors, zones restart identity cascade;

-- Zones & reference price per m²
insert into zones (id, name, price_per_m2) values
  ('11111111-1111-1111-1111-111111111101', 'Torreón', 7000),
  ('11111111-1111-1111-1111-111111111102', 'Gómez Palacio', 5500),
  ('11111111-1111-1111-1111-111111111103', 'Lerdo', 4000);

-- Advisors
insert into advisors (id, name, photo_url, phone, email, whatsapp, bio, active) values
  ('22222222-2222-2222-2222-222222222201', 'Carlos Delgado', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80', '+52 871 123 4567', 'carlos.delgado@aclpropiedades.com', '528711234567', 'Asesor certificado con más de 8 años de experiencia en crédito INFONAVIT y bancario.', true),
  ('22222222-2222-2222-2222-222222222202', 'Ana Martínez', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80', '+52 871 234 5678', 'ana.martinez@aclpropiedades.com', '528712345678', 'Especialista en propiedades residenciales en Torreón y Gómez Palacio.', true),
  ('22222222-2222-2222-2222-222222222203', 'Luis Hernández', 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&q=80', '+52 871 345 6789', 'luis.hernandez@aclpropiedades.com', '528713456789', 'Enfocado en naves industriales y locales comerciales para negocios en crecimiento.', true);

-- Properties: 3 casas, 3 departamentos, 3 naves industriales
insert into properties (id, title, type, description, price, area_m2, bedrooms, bathrooms, parking, zone, address, lat, lng, status, images, main_image, active) values
  ('33333333-3333-3333-3333-333333333301', 'Casa en Residencial Senderos', 'casa', 'Amplia casa de dos plantas en Residencial Senderos, con acabados modernos, cocina integral y jardín. Cerca de escuelas, plazas comerciales y vialidades principales de Torreón.', 2450000, 180, 3, 2.5, 2, 'Torreón', 'Residencial Senderos, Torreón, Coahuila', 25.5719, -103.3859, 'disponible', array['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&q=80','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1000&q=80','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1000&q=80'], 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&q=80', true),
  ('33333333-3333-3333-3333-333333333302', 'Casa en Las Fuentes', 'casa', 'Casa de una planta con amplio patio trasero en el fraccionamiento Las Fuentes, Gómez Palacio. Ideal para crédito INFONAVIT o cofinavit.', 1350000, 120, 3, 2, 1, 'Gómez Palacio', 'Fracc. Las Fuentes, Gómez Palacio, Durango', 25.5928, -103.4884, 'disponible', array['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1000&q=80','https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1000&q=80'], 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1000&q=80', true),
  ('33333333-3333-3333-3333-333333333303', 'Casa en Los Fresnos', 'casa', 'Casa seminueva en fraccionamiento Los Fresnos, Lerdo. Cuenta con cochera techada, cuarto de servicio y área de tendido.', 980000, 95, 2, 1.5, 1, 'Lerdo', 'Fracc. Los Fresnos, Lerdo, Durango', 25.5361, -103.5297, 'apartada', array['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000&q=80'], 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000&q=80', true),
  ('33333333-3333-3333-3333-333333333304', 'Departamento en Centro de Torreón', 'departamento', 'Departamento remodelado en el corazón de Torreón, a pasos de la Plaza de Armas. Excelente para renta o inversión.', 1650000, 85, 2, 2, 1, 'Torreón', 'Centro, Torreón, Coahuila', 25.5445, -103.4425, 'disponible', array['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000&q=80','https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1000&q=80'], 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000&q=80', true),
  ('33333333-3333-3333-3333-333333333305', 'Departamento en Valle del Guadiana', 'departamento', 'Departamento en planta baja con patio privado, dentro de coto con vigilancia en Gómez Palacio.', 890000, 68, 2, 1, 1, 'Gómez Palacio', 'Valle del Guadiana, Gómez Palacio, Durango', 25.5590, -103.4970, 'disponible', array['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1000&q=80'], 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1000&q=80', true),
  ('33333333-3333-3333-3333-333333333306', 'Departamento en Lerdo Centro', 'departamento', 'Cómodo departamento de un nivel cerca del centro de Lerdo, ideal para parejas o inversión en renta.', 620000, 55, 1, 1, 1, 'Lerdo', 'Centro, Lerdo, Durango', 25.5449, -103.5210, 'vendida', array['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1000&q=80'], 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1000&q=80', true),
  ('33333333-3333-3333-3333-333333333307', 'Nave Industrial en Parque Industrial Lagunero', 'nave_industrial', 'Nave industrial de gran altura con oficinas, patio de maniobras y acceso para tráileres. Ubicada en el Parque Industrial Lagunero.', 12500000, 2200, null, 2, 10, 'Gómez Palacio', 'Parque Industrial Lagunero, Gómez Palacio, Durango', 25.6265, -103.4429, 'disponible', array['https://images.unsplash.com/photo-1601599963565-b7f49deb2748?w=1000&q=80','https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=1000&q=80'], 'https://images.unsplash.com/photo-1601599963565-b7f49deb2748?w=1000&q=80', true),
  ('33333333-3333-3333-3333-333333333308', 'Nave Industrial en Parque Industrial Torreón', 'nave_industrial', 'Nave con estructura de acero, andenes de carga y oficinas administrativas, ideal para logística o manufactura ligera.', 9800000, 1800, null, 2, 8, 'Torreón', 'Parque Industrial, Torreón, Coahuila', 25.4900, -103.3800, 'disponible', array['https://images.unsplash.com/photo-1553413077-190dd305871c?w=1000&q=80'], 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1000&q=80', true),
  ('33333333-3333-3333-3333-333333333309', 'Nave Industrial en Lerdo', 'nave_industrial', 'Nave industrial sobre la carretera Lerdo-Torreón, terreno amplio para expansión y fácil acceso para vehículos pesados.', 6200000, 1400, null, 1, 6, 'Lerdo', 'Carretera Lerdo-Torreón, Lerdo, Durango', 25.5200, -103.5400, 'disponible', array['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&q=80'], 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&q=80', true);

-- Advisor assignments
insert into property_advisors (property_id, advisor_id) values
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201'),
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222202'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202'),
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201'),
  ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222202'),
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222203'),
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222202'),
  ('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222201'),
  ('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222203'),
  ('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222203'),
  ('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222201'),
  ('33333333-3333-3333-3333-333333333309', '22222222-2222-2222-2222-222222222203');
