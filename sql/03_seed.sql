-- ============================================================
--  Daily Do – Mandanten-System
--  03_seed.sql · Die zwei Firmen + dein Admin-Zugang
--
--  Ausführen NACH 02_rls.sql.
--
--  VORHER ERLEDIGEN:
--  1. In Supabase unter Authentication → Users deinen Login anlegen
--     (E-Mail + Passwort).
--  2. Unten bei v_admin_email genau diese E-Mail eintragen.
--
--  Läuft dieses Skript ohne den Auth-User, bricht es mit einer
--  klaren Meldung ab, statt halb fertige Daten zu hinterlassen.
-- ============================================================

do $$
declare
  -- >>> HIER DEINE LOGIN-E-MAIL EINTRAGEN <<<
  v_admin_email text := 'daniel.dmytrov@freenet.de';

  v_admin_id       uuid;
  v_fensterputz_id uuid;
  v_alltagshilfe_id uuid;
begin

  -- ----------------------------------------------------------
  --  Admin-Login suchen
  -- ----------------------------------------------------------
  select id into v_admin_id
  from auth.users
  where lower(email) = lower(v_admin_email)
  limit 1;

  if v_admin_id is null then
    raise exception
      'Kein Auth-User mit der E-Mail % gefunden. Bitte zuerst unter Authentication → Users anlegen und v_admin_email in diesem Skript prüfen.',
      v_admin_email;
  end if;


  -- ----------------------------------------------------------
  --  Firma 1 · Fensterputz-Service UG
  --  Eigenes Farbschema, damit auf einen Blick klar ist,
  --  in welcher Firma man arbeitet.
  -- ----------------------------------------------------------
  insert into public.firmen (
    slug, name, firma,
    strasse, plz, ort, email, webseite,
    geschaeftsfuehrer, sortierung, design, module
  ) values (
    'fensterputz',
    'Fensterputz-Service',
    'Fensterputz-Service UG (haftungsbeschränkt)',
    'Bahnhofstraße 85', '31515', 'Wunstorf',
    'info@fensterputz-service.de', 'https://fensterputz-service.de',
    'Daniel Dmytrov',
    1,
    jsonb_build_object(
      'petrol',      '#0e7490',
      'petrol-dark', '#0b5566',
      'petrol-soft', '#e0f2fe',
      'amber',       '#f59e0b',
      'amber-soft',  '#fef3c7',
      'ink',         '#10262e',
      'muted',       '#5b7683',
      'line',        '#d9e8ef',
      'bg',          '#f5f9fc',
      'card',        '#ffffff'
    ),
    jsonb_build_object(
      'dashboard',     true,
      'karte',         true,
      'routenplanung', true,     -- nur hier
      'kunden',        true,
      'mitarbeiter',   true,
      'kommunikation', true,
      'stundenzettel', true,
      'lohn',          true,
      'notizen',       true,
      'kalender',      true,
      'einstellungen', true
    )
  )
  on conflict (slug) do update set updated_at = now()
  returning id into v_fensterputz_id;


  -- ----------------------------------------------------------
  --  Firma 2 · Alltagshilfe Hannover UG
  --  Behält das bisherige Violett – das ist die eingeführte Marke.
  -- ----------------------------------------------------------
  insert into public.firmen (
    slug, name, firma,
    strasse, plz, ort,
    geschaeftsfuehrer, sortierung, design, module
  ) values (
    'alltagshilfe',
    'Alltagshilfe Hannover',
    'Alltagshilfe Hannover UG (haftungsbeschränkt)',
    'Bahnhofstraße 85', '31515', 'Wunstorf',
    'Daniel Dmytrov',
    2,
    jsonb_build_object(
      'petrol',      '#6d28d9',
      'petrol-dark', '#4c1d95',
      'petrol-soft', '#f0e9ff',
      'amber',       '#ff6b9d',
      'amber-soft',  '#ffe4ee',
      'ink',         '#1f1633',
      'muted',       '#6b6480',
      'line',        '#e8e2f5',
      'bg',          '#f7f5fc',
      'card',        '#ffffff'
    ),
    jsonb_build_object(
      'dashboard',     true,
      'karte',         true,
      'routenplanung', false,    -- bewusst aus
      'kunden',        true,
      'mitarbeiter',   true,
      'kommunikation', true,
      'stundenzettel', true,
      'lohn',          true,
      'notizen',       true,
      'kalender',      true,
      'einstellungen', true
    )
  )
  on conflict (slug) do update set updated_at = now()
  returning id into v_alltagshilfe_id;


  -- ----------------------------------------------------------
  --  Admin in beiden Firmen
  --  Genau diese zwei Zeilen erzeugen die zwei Kacheln.
  -- ----------------------------------------------------------
  insert into public.firmen_mitglieder (firma_id, user_id, rolle)
  values (v_fensterputz_id,  v_admin_id, 'admin'),
         (v_alltagshilfe_id, v_admin_id, 'admin')
  on conflict (firma_id, user_id) do update set rolle = 'admin', aktiv = true;

  -- Profil sicherstellen (falls der User vor dem Trigger existierte)
  insert into public.profile (id, email, name)
  values (v_admin_id, v_admin_email, 'Daniel Dmytrov')
  on conflict (id) do nothing;


  -- ----------------------------------------------------------
  --  Startvorlagen
  --  Die Beratungsvorlage liegt als Vorlagentyp bereit, auch wenn
  --  das Beratungsmodul vorerst nicht gebaut wird.
  -- ----------------------------------------------------------
  insert into public.vorlagen (firma_id, typ, schluessel, name, betreff, text)
  values
    (v_fensterputz_id,  'email',    'willkommen', 'Willkommen',
     'Willkommen bei Fensterputz-Service',
     'Sehr geehrte/r {{anrede}} {{nachname}},'),
    (v_alltagshilfe_id, 'email',    'willkommen', 'Willkommen',
     'Willkommen bei Alltagshilfe Hannover',
     'Sehr geehrte/r {{anrede}} {{nachname}},'),
    (v_alltagshilfe_id, 'beratung', 'standard',   'Beratungsvorlage', null, '')
  on conflict do nothing;


  raise notice 'Fertig. Fensterputz-Service: %, Alltagshilfe Hannover: %, Admin: %',
    v_fensterputz_id, v_alltagshilfe_id, v_admin_id;

end $$;


-- ============================================================
--  Kontrolle
--  Sollte zwei Zeilen liefern – deine zwei Kacheln.
-- ============================================================
select f.slug, f.name, m.rolle
from public.firmen f
join public.firmen_mitglieder m on m.firma_id = f.id
order by f.sortierung;


-- ============================================================
--  NOCH ZU ERGÄNZEN (bewusst leer gelassen statt geraten):
--    firmen.ik_nummer         – IK-Nummer der Alltagshilfe (SGB XI)
--    firmen.handelsregister   – HRB-Nummern beider UGs
--    firmen.ust_id            – USt-IdNr.
--    firmen.iban / bank_name  – für die Rechnungs-PDFs
--    firmen.unterschrift      – Base64-Signatur für PDFs
--    firmen.logo              – Base64-Logo
--
--  Kostenträger lassen sich aus der vorhandenen Datei importieren:
--    Allgemeines Wissen/kostentraeger_import_formatiert.csv
-- ============================================================
