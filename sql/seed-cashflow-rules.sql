-- =============================================================================
-- Seed known category rules for cashflow_category_rules
-- Run in Supabase SQL editor (or psql).
-- ON CONFLICT DO UPDATE so it is safe to re-run.
--
-- NOTE: 'From SMASHBURGER SL.' appears in both Ingreso cliente and Préstamos.
-- Because description_pattern is UNIQUE, the last row wins → Préstamos.
-- If you want it as Ingreso cliente, swap the order or delete the Préstamos row.
-- =============================================================================

INSERT INTO cashflow_category_rules (description_pattern, category) VALUES

  -- Ingreso cliente
  ('From RED OPS NOROESTE SL.', 'Ingreso cliente'),
  -- REMOVED,    -- overridden by Préstamos row below

  -- Nómina
  ('To LUIJAVIER ANTONIO MARCANO MILLAN', 'Nómina'),
  ('To LUIS LUCENA DURAN', 'Nómina'),
  ('To LUNIEL JOSE GONZALEZ MENDEZ', 'Nómina'),
  ('To MARCO DAVIS DE LUCA', 'Nómina'),
  ('To MICHAEL ARISMENDI ARRAIZ', 'Nómina'),
  ('To ROMULO ERNESTO GEDLER PALMA', 'Nómina'),
  ('To SERGIO CERRO PASCUAL', 'Nómina'),
  ('To YOLGELIS GUEVARA', 'Nómina'),
  ('To SERGIO CERRO PASCUAL PASCUAL', 'Nómina'),
  ('To MARCO ROBERTO DAVIS DE LUCA', 'Nómina'),
  ('To LUIS ALE LUCENA DURAN', 'Nómina'),
  ('To Luis Alejandro Lucena Duran', 'Nómina'),
  ('To Luis Lucena Duran', 'Nómina'),
  ('To Sergio Cerro', 'Nómina'),
  ('To Sergio Cerro Pascual', 'Nómina'),
  ('To Marco Roberto Davis De Luca', 'Nómina'),
  ('To Michael Anthony Arismendi Arraiz', 'Nómina'),
  ('To Luijavier Antonio Marcano Millan', 'Nómina'),
  ('To YOLGELIS GUEVARA HERNANDEZ', 'Nómina'),
  ('To Yolgelis Guevara', 'Nómina'),

  -- Hardware
  ('To HUMBERTO JOSE FERNANDEZ FONT', 'Hardware'),
  ('Back Market', 'Hardware'),
  ('Grover Rental Apr 14', 'Hardware'),
  ('Grover Rental Apr 2', 'Hardware'),
  ('Grover Rental Feb 14', 'Hardware'),
  ('Grover Rental Mar 14', 'Hardware'),
  ('Grover Rental Mar 2', 'Hardware'),
  ('Grover Rental May 2', 'Hardware'),
  ('Grover Order F26122751', 'Hardware'),
  ('Grover Order F88457536', 'Hardware'),
  ('To Tabletpro B.V.', 'Hardware'),

  -- Administrativo
  ('To Gacimartin Asesores y Asociados SL', 'Administrativo'),
  ('To MANUEL SOLER LLUCH', 'Administrativo'),
  ('To SOLER LLUCH MANUEL', 'Administrativo'),
  ('To Inversiones Toribio S.L', 'Administrativo'),
  ('To Inversiones Toribio SL', 'Administrativo'),

  -- Impuestos
  ('To Tesoreria General de la Seguridad Social', 'Impuestos'),
  ('365 T115', 'Impuestos'),

  -- Préstamos (intentionally overrides 'From SMASHBURGER SL.' from Ingreso cliente above)
  ('To SMASHBURGER SL (Revolut)', 'Préstamos'),
  ('To Smashburger SL', 'Préstamos'),
  ('From SMASHBURGER SL.', 'Préstamos'),

  -- Oficina
  ('Ferreteria Fersanz', 'Oficina'),
  ('Verdecora Rio Rosas', 'Oficina'),
  ('Hiper Bazar', 'Oficina'),
  ('Copy 5', 'Oficina'),
  ('Workcenter Sgd', 'Oficina'),
  ('Dhl Express Spain', 'Oficina'),
  ('Ups_es', 'Oficina'),
  ('D.a.b.a. Sa -nespresso Profesional', 'Oficina'),
  ('Viva Aqua Service Spain S.a', 'Oficina'),
  ('Blt', 'Oficina'),
  ('Fic Rios Rosas', 'Oficina'),
  ('Bm Shop Donoso Cortes', 'Oficina'),
  ('Deco Eixample', 'Oficina'),

  -- Viajes
  ('Uber   * Eats Pending', 'Viajes'),
  ('Uber   *trip', 'Viajes'),
  ('Uber *trip Help.uber.c', 'Viajes'),
  ('Ubr* Pending.uber.com', 'Viajes'),
  ('Iryob2c', 'Viajes'),
  ('Free2move* Nr012812556', 'Viajes'),
  ('Free2move* Nr012889903', 'Viajes'),
  ('Es Autovia De Pantanos', 'Viajes'),
  ('11379lic.taxi', 'Viajes'),
  ('13660 Nc Licencia', 'Viajes'),
  ('Autotaxis Licencia 15', 'Viajes'),
  ('Federico Taxi Lic.1334', 'Viajes'),
  ('Lic. 15.569 Taxi', 'Viajes'),
  ('Licencia 04510', 'Viajes'),
  ('Licencia 10396', 'Viajes'),
  ('07961', 'Viajes'),
  ('Comeporketa', 'Viajes'),
  ('Cappuccino Madrid', 'Viajes'),
  ('El Kiosko Ponzano', 'Viajes'),
  ('Comete Mexico 2', 'Viajes'),
  ('Ifema', 'Viajes'),
  ('Ifema Parking', 'Viajes'),

  -- Servidores/Hosting
  ('Vercel Inc.', 'Servidores/Hosting'),
  ('Aws Emea', 'Servidores/Hosting'),

  -- Base de datos
  ('Vercel Mkt Supabase', 'Base de datos'),
  ('Www.redis.com', 'Base de datos'),

  -- Herramientas IA
  ('Anthropic', 'Herramientas IA'),
  ('Anthropic: Claude Team', 'Herramientas IA'),
  ('Elevenlabs.io', 'Herramientas IA'),
  ('In *maera Inc', 'Herramientas IA'),

  -- Comunicaciones
  ('Twilio.com', 'Comunicaciones'),

  -- Marketing
  ('Google *ads9892316260', 'Marketing'),

  -- Otras herramientas
  ('Holded Technologies Sl', 'Otras herramientas'),
  ('650 Industries (expo)', 'Otras herramientas'),
  ('Apple.com', 'Otras herramientas'),
  ('Business Prime', 'Otras herramientas'),

  -- Traspaso interno
  ('From Platomico LLC', 'Traspaso interno'),
  ('To Platomico LLC', 'Traspaso interno'),
  ('To PLATOMICO', 'Traspaso interno'),
  ('From Sergio C', 'Traspaso interno'),
  ('To PCMIRA', 'Traspaso interno'),
  ('To YARUSSI ALVARADO SL', 'Traspaso interno'),
  ('To Yarussi Alvarado Sl', 'Traspaso interno'),
  ('Yarussi Alvarado Sl', 'Traspaso interno'),

  -- Otros
  ('Amazon* Eg2267od5', 'Otros'),
  ('Amazon* To7x24cl5', 'Otros'),
  ('Amazon* W52eg0705', 'Otros'),
  ('Amzn Mktp Es*3w6qq3365', 'Otros'),
  ('Www.amazon* N68o382y4', 'Otros')

ON CONFLICT (description_pattern) DO UPDATE
  SET category = EXCLUDED.category;
