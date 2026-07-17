-- ============================================================
--  Daily Do – Mandanten-System
--  01_schema.sql · Tabellen
--
--  Reihenfolge: 01_schema.sql → 02_rls.sql → 03_seed.sql
--  Ausführen im Supabase SQL Editor des NEUEN Projekts.
--
--  Grundprinzip: Jede Fachtabelle trägt eine firma_id.
--  Sie ersetzt die bisherige standort_id aus dem Altsystem.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  Hilfsfunktion: updated_at automatisch mitführen
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
--  KERN
-- ============================================================

-- ------------------------------------------------------------
--  firmen · ersetzt "standorte" aus dem Altsystem
--  Enthält alles, was Briefkopf, Rechnung und PDF brauchen.
-- ------------------------------------------------------------
create table public.firmen (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,          -- 'fensterputz' | 'alltagshilfe'
  name               text not null,                 -- Anzeigename auf der Kachel
  firma              text not null,                 -- vollständige Firmierung
  strasse            text,
  plz                text,
  ort                text,
  telefon            text,
  email              text,
  webseite           text,

  -- Rechtliches / Abrechnung
  ik_nummer          text,                          -- SGB XI, nur Alltagshilfe
  handelsregister    text,
  ust_id             text,
  steuernummer       text,
  geschaeftsfuehrer  text,
  bank_name          text,
  iban               text,
  bic                text,

  -- Dokumente
  unterschrift       text,                          -- Base64, für PDF-Signatur
  logo               text,                          -- Base64
  anerkennung_name   text,                          -- §45a-Anerkennung
  anerkennung_data   text,
  anerkennung_datum  date,
  rechnung_params    jsonb  not null default '{}'::jsonb,

  -- Erscheinungsbild (Menüpunkt "Design und Farben")
  design             jsonb  not null default '{}'::jsonb,

  -- Modul-Schalter. Steuert, welche Menüpunkte die Firma sieht.
  -- z. B. {"routenplanung": true}
  module             jsonb  not null default '{}'::jsonb,

  aktiv              boolean not null default true,
  sortierung         int     not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger firmen_touch before update on public.firmen
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  profile · die Person hinter dem Login
--  Firmenübergreifend – ein Mensch, ein Login.
-- ------------------------------------------------------------
create table public.profile (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text,
  telefon     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profile_touch before update on public.profile
  for each row execute function public.touch_updated_at();

-- Beim Anlegen eines Auth-Users automatisch ein Profil erzeugen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profile (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ------------------------------------------------------------
--  firmen_mitglieder · wer darf in welche Firma
--  Hier entstehen die zwei Kacheln nach dem Login.
--  Zwei Zeilen = zwei Kacheln. Eine Zeile = direkt rein.
-- ------------------------------------------------------------
create table public.firmen_mitglieder (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references public.firmen(id) on delete cascade,
  user_id     uuid not null references auth.users(id)  on delete cascade,
  rolle       text not null default 'mitarbeiter'
              check (rolle in ('admin','leitung','mitarbeiter')),
  aktiv       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (firma_id, user_id)
);

create index firmen_mitglieder_user_idx  on public.firmen_mitglieder(user_id);
create index firmen_mitglieder_firma_idx on public.firmen_mitglieder(firma_id);


-- ============================================================
--  STAMMDATEN
-- ============================================================

-- ------------------------------------------------------------
--  mitarbeiter · Personalakte, pro Firma eine eigene
--  user_id verbindet sie mit dem gemeinsamen Login.
--  Wer in beiden UGs arbeitet, hat zwei Akten und einen Login.
-- ------------------------------------------------------------
create table public.mitarbeiter (
  id              uuid primary key default gen_random_uuid(),
  firma_id        uuid not null references public.firmen(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,

  vorname         text not null,
  nachname        text not null,
  email           text,
  telefon         text,
  mobil           text,
  strasse         text,
  plz             text,
  ort             text,
  geburtsdatum    date,

  -- Beschäftigung
  eintritt        date,
  austritt        date,
  stundenlohn     numeric(10,2),
  wochenstunden   numeric(5,2),
  vertragsart     text,                         -- Minijob | Midijob | Vollzeit …
  personalnummer  text,

  -- Kalender: Farbe für die Mehrfachauswahl-Ansicht
  farbe           text not null default '#2f7c88',

  skills          jsonb   not null default '[]'::jsonb,
  notfallkontakt  jsonb   not null default '{}'::jsonb,
  status          text    not null default 'aktiv'
                  check (status in ('aktiv','inaktiv','ausgeschieden')),

  -- Karte
  lat             double precision,
  lng             double precision,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index mitarbeiter_firma_idx on public.mitarbeiter(firma_id);
create index mitarbeiter_user_idx  on public.mitarbeiter(user_id);

create trigger mitarbeiter_touch before update on public.mitarbeiter
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  kostentraeger
--  Alltagshilfe: Pflegekassen (§45b SGB XI)
--  Fensterputz:  Privatkunden / Rechnungsempfänger
-- ------------------------------------------------------------
create table public.kostentraeger (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references public.firmen(id) on delete cascade,
  name        text not null,
  strasse     text,
  plz         text,
  ort         text,
  email       text,
  telefon     text,
  ik_nummer   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index kostentraeger_firma_idx on public.kostentraeger(firma_id);

create trigger kostentraeger_touch before update on public.kostentraeger
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  leistungen · Leistungskatalog je Firma
-- ------------------------------------------------------------
create table public.leistungen (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references public.firmen(id) on delete cascade,
  name        text not null,
  preis       numeric(10,2),
  einheit     text,                              -- Stunde | Pauschale | qm …
  ust_satz    numeric(5,2) not null default 0,   -- Fensterputz: 19, Alltagshilfe: 0
  aktiv       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index leistungen_firma_idx on public.leistungen(firma_id);

create trigger leistungen_touch before update on public.leistungen
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  kunden · pro Firma getrennt (bewusste Entscheidung)
-- ------------------------------------------------------------
create table public.kunden (
  id                 uuid primary key default gen_random_uuid(),
  firma_id           uuid not null references public.firmen(id) on delete cascade,

  anrede             text,
  vorname            text,
  nachname           text,
  firma_name         text,                        -- bei gewerblichen Kunden
  strasse            text,
  plz                text,
  ort                text,
  telefon            text,
  mobil              text,
  email              text,
  geburtsdatum       date,

  -- Pflege (nur Alltagshilfe relevant)
  pflegegrad         int check (pflegegrad between 1 and 5),
  versichertennummer text,
  kostentraeger_id   uuid references public.kostentraeger(id) on delete set null,

  leistungen         jsonb  not null default '[]'::jsonb,
  ansprechpartner    jsonb  not null default '{}'::jsonb,

  status             text not null default 'aktiv'
                     check (status in ('aktiv','pausiert','beendet','interessent')),
  notiz              text,

  -- Karte + Routenplanung
  lat                double precision,
  lng                double precision,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index kunden_firma_idx  on public.kunden(firma_id);
create index kunden_status_idx on public.kunden(firma_id, status);

create trigger kunden_touch before update on public.kunden
  for each row execute function public.touch_updated_at();


-- ============================================================
--  BEWEGUNGSDATEN
-- ============================================================

-- ------------------------------------------------------------
--  kommunikation · trägt auch die Notizen
--  Der Menüpunkt "Notizen" ist eine Ansicht mit typ = 'notiz'.
-- ------------------------------------------------------------
create table public.kommunikation (
  id              uuid primary key default gen_random_uuid(),
  firma_id        uuid not null references public.firmen(id) on delete cascade,
  typ             text not null default 'notiz'
                  check (typ in ('notiz','telefon','email','brief','sonstiges')),
  kunde_id        uuid references public.kunden(id)      on delete cascade,
  mitarbeiter_id  uuid references public.mitarbeiter(id) on delete set null,
  betreff         text,
  text            text,
  status          text not null default 'offen'
                  check (status in ('offen','erledigt')),
  tasks           jsonb not null default '[]'::jsonb,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index kommunikation_firma_idx on public.kommunikation(firma_id);
create index kommunikation_typ_idx   on public.kommunikation(firma_id, typ);
create index kommunikation_kunde_idx on public.kommunikation(kunde_id);

create trigger kommunikation_touch before update on public.kommunikation
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  aufgaben
-- ------------------------------------------------------------
create table public.aufgaben (
  id                uuid primary key default gen_random_uuid(),
  firma_id          uuid not null references public.firmen(id) on delete cascade,
  titel             text not null,
  beschreibung      text,
  status            text not null default 'offen'
                    check (status in ('offen','in_arbeit','erledigt')),
  prioritaet        text not null default 'normal'
                    check (prioritaet in ('niedrig','normal','hoch')),
  faellig_am        date,
  zugewiesen_an     uuid references public.mitarbeiter(id) on delete set null,
  kunde_id          uuid references public.kunden(id)      on delete cascade,
  kommunikation_id  uuid references public.kommunikation(id) on delete cascade,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index aufgaben_firma_idx  on public.aufgaben(firma_id);
create index aufgaben_status_idx on public.aufgaben(firma_id, status);

create trigger aufgaben_touch before update on public.aufgaben
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  termine · Grundlage des Kalenders
--  Die Mehrfachauswahl filtert über mitarbeiter_id.
-- ------------------------------------------------------------
create table public.termine (
  id              uuid primary key default gen_random_uuid(),
  firma_id        uuid not null references public.firmen(id) on delete cascade,
  mitarbeiter_id  uuid references public.mitarbeiter(id) on delete cascade,
  kunde_id        uuid references public.kunden(id)      on delete cascade,
  leistung_id     uuid references public.leistungen(id)  on delete set null,
  titel           text,
  start_at        timestamptz not null,
  ende_at         timestamptz not null,
  status          text not null default 'geplant'
                  check (status in ('geplant','bestaetigt','erledigt','abgesagt')),
  notiz           text,
  wiederholung    jsonb not null default '{}'::jsonb,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint termine_zeitraum check (ende_at > start_at)
);

create index termine_firma_zeit_idx  on public.termine(firma_id, start_at);
create index termine_mitarbeiter_idx on public.termine(mitarbeiter_id, start_at);

create trigger termine_touch before update on public.termine
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  stundenzettel
-- ------------------------------------------------------------
create table public.stundenzettel (
  id                uuid primary key default gen_random_uuid(),
  firma_id          uuid not null references public.firmen(id) on delete cascade,
  mitarbeiter_id    uuid references public.mitarbeiter(id) on delete set null,
  kunde_id          uuid references public.kunden(id)      on delete set null,
  termin_id         uuid references public.termine(id)     on delete set null,

  datum             date not null,
  beginn            time,
  ende              time,
  stunden           numeric(6,2) not null default 0,
  preis_pro_stunde  numeric(10,2),
  betrag            numeric(10,2),

  leistungen        jsonb not null default '[]'::jsonb,
  notiz             text,
  unterschrift      text,                        -- Base64

  status            text not null default 'offen'
                    check (status in ('offen','freigegeben','abgerechnet')),
  freigegeben_von   uuid references auth.users(id) on delete set null,
  freigegeben_am    timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index stundenzettel_firma_idx  on public.stundenzettel(firma_id, datum);
create index stundenzettel_ma_idx     on public.stundenzettel(mitarbeiter_id, datum);
create index stundenzettel_status_idx on public.stundenzettel(firma_id, status);

create trigger stundenzettel_touch before update on public.stundenzettel
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  abtretungen · Abtretungserklärung
-- ------------------------------------------------------------
create table public.abtretungen (
  id                uuid primary key default gen_random_uuid(),
  firma_id          uuid not null references public.firmen(id) on delete cascade,
  kunde_id          uuid references public.kunden(id) on delete cascade,
  kostentraeger_id  uuid references public.kostentraeger(id) on delete set null,
  monat             text,                        -- 'YYYY-MM'
  betrag            numeric(10,2),
  unterschrift      text,                        -- Base64
  unterschrift_am   date,
  pdf               text,
  status            text not null default 'offen'
                    check (status in ('offen','unterschrieben','eingereicht')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index abtretungen_firma_idx on public.abtretungen(firma_id);
create index abtretungen_kunde_idx on public.abtretungen(kunde_id);

create trigger abtretungen_touch before update on public.abtretungen
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  lohnabrechnungen
-- ------------------------------------------------------------
create table public.lohnabrechnungen (
  id              uuid primary key default gen_random_uuid(),
  firma_id        uuid not null references public.firmen(id) on delete cascade,
  mitarbeiter_id  uuid references public.mitarbeiter(id) on delete cascade,
  monat           text not null,                 -- 'YYYY-MM'
  stunden         numeric(8,2),
  brutto          numeric(10,2),
  netto           numeric(10,2),
  daten           jsonb not null default '{}'::jsonb,
  pdf             text,
  status          text not null default 'entwurf'
                  check (status in ('entwurf','final','ausgezahlt')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (firma_id, mitarbeiter_id, monat)
);

create index lohn_firma_monat_idx on public.lohnabrechnungen(firma_id, monat);

create trigger lohn_touch before update on public.lohnabrechnungen
  for each row execute function public.touch_updated_at();


-- ============================================================
--  EINSTELLUNGEN
-- ============================================================

-- ------------------------------------------------------------
--  vorlagen · E-Mail-Vorlage UND Beratungsvorlage
--  Beide sind Vorlagen, nur mit anderem Typ.
-- ------------------------------------------------------------
create table public.vorlagen (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references public.firmen(id) on delete cascade,
  typ         text not null default 'email'
              check (typ in ('email','beratung')),
  schluessel  text,                              -- technischer Name
  name        text not null,
  betreff     text,
  text        text,
  aktiv       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (firma_id, typ, schluessel)
);

create index vorlagen_firma_typ_idx on public.vorlagen(firma_id, typ);

create trigger vorlagen_touch before update on public.vorlagen
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  email_log · Versandprotokoll
-- ------------------------------------------------------------
create table public.email_log (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references public.firmen(id) on delete cascade,
  empfaenger  text not null,
  betreff     text,
  vorlage_id  uuid references public.vorlagen(id) on delete set null,
  status      text not null default 'gesendet'
              check (status in ('gesendet','fehler')),
  fehler      text,
  gesendet_von uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index email_log_firma_idx on public.email_log(firma_id, created_at desc);


-- ------------------------------------------------------------
--  marketing_material
-- ------------------------------------------------------------
create table public.marketing_material (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null references public.firmen(id) on delete cascade,
  name          text not null,
  typ           text,                            -- Flyer | Visitenkarte | Plakat …
  beschreibung  text,
  datei_url     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index marketing_firma_idx on public.marketing_material(firma_id);

create trigger marketing_touch before update on public.marketing_material
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
--  aktivitaeten · Aktivitätsprotokoll
--  Nur schreiben und lesen, kein Ändern/Löschen (siehe RLS).
-- ------------------------------------------------------------
create table public.aktivitaeten (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references public.firmen(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  user_label  text,
  rolle       text,
  aktion      text not null,
  created_at  timestamptz not null default now()
);

create index aktivitaeten_firma_idx on public.aktivitaeten(firma_id, created_at desc);


-- ------------------------------------------------------------
--  schulungen + schulungen_status
-- ------------------------------------------------------------
create table public.schulungen (
  id             uuid primary key default gen_random_uuid(),
  firma_id       uuid not null references public.firmen(id) on delete cascade,
  titel          text not null,
  beschreibung   text,
  inhalt         text,
  pflicht        boolean not null default false,
  gueltig_monate int,                            -- Auffrischung nach X Monaten
  aktiv          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index schulungen_firma_idx on public.schulungen(firma_id);

create trigger schulungen_touch before update on public.schulungen
  for each row execute function public.touch_updated_at();

create table public.schulungen_status (
  id              uuid primary key default gen_random_uuid(),
  firma_id        uuid not null references public.firmen(id) on delete cascade,
  schulung_id     uuid not null references public.schulungen(id)  on delete cascade,
  mitarbeiter_id  uuid not null references public.mitarbeiter(id) on delete cascade,
  erledigt_am     date,
  gueltig_bis     date,
  created_at      timestamptz not null default now(),
  unique (schulung_id, mitarbeiter_id)
);

create index schulungen_status_firma_idx on public.schulungen_status(firma_id);
