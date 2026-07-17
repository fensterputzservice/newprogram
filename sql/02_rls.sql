-- ============================================================
--  Daily Do – Mandanten-System
--  02_rls.sql · Zugriffsregeln (Row Level Security)
--
--  Ausführen NACH 01_schema.sql.
--
--  Das ist der Teil, der im Altsystem gefehlt hat.
--  Dort stand die Trennung im Browser:  .eq('standort_id', currentStandortId)
--  Der Client hat also selbst entschieden, welche Firma er sieht.
--  Ab hier entscheidet das der Server, und der Browser kommt nicht daran vorbei.
--
--  Regelwerk:
--    A  Stammdaten & Einstellungen  → lesen: Mitglied     schreiben: Leitung
--    B  Bewegungsdaten              → lesen: Mitglied     schreiben: Mitglied
--    C  Sensibel (Personal, Lohn)   → lesen: Leitung ODER eigene Zeile
--    D  Aktivitätsprotokoll         → lesen: Leitung, schreiben: nur anhängen
--    E  Firma selbst                → lesen: Mitglied     schreiben: Admin
-- ============================================================


-- ------------------------------------------------------------
--  Hilfsfunktionen
--
--  SECURITY DEFINER ist hier kein Schönheitsfehler, sondern nötig:
--  Die Funktionen lesen firmen_mitglieder, und die Policies auf
--  firmen_mitglieder rufen wieder diese Funktionen auf. Als DEFINER
--  laufen sie mit den Rechten des Eigentümers und umgehen RLS –
--  damit ist die Rekursion gebrochen.
-- ------------------------------------------------------------

create or replace function public.ist_mitglied(p_firma uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.firmen_mitglieder m
    where m.firma_id = p_firma
      and m.user_id  = auth.uid()
      and m.aktiv
  );
$$;

create or replace function public.ist_leitung(p_firma uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.firmen_mitglieder m
    where m.firma_id = p_firma
      and m.user_id  = auth.uid()
      and m.aktiv
      and m.rolle in ('admin','leitung')
  );
$$;

create or replace function public.ist_admin(p_firma uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.firmen_mitglieder m
    where m.firma_id = p_firma
      and m.user_id  = auth.uid()
      and m.aktiv
      and m.rolle = 'admin'
  );
$$;

-- Die Personalakte des angemeldeten Nutzers in dieser Firma.
create or replace function public.meine_mitarbeiter_id(p_firma uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.mitarbeiter
  where firma_id = p_firma and user_id = auth.uid()
  limit 1;
$$;

-- Teilen zwei Nutzer mindestens eine Firma?
create or replace function public.teilt_firma(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.firmen_mitglieder a
    join public.firmen_mitglieder b on a.firma_id = b.firma_id
    where a.user_id = auth.uid() and a.aktiv
      and b.user_id = p_user      and b.aktiv
  );
$$;


-- ------------------------------------------------------------
--  RLS auf allen Tabellen einschalten
-- ------------------------------------------------------------
alter table public.firmen             enable row level security;
alter table public.profile            enable row level security;
alter table public.firmen_mitglieder  enable row level security;
alter table public.mitarbeiter        enable row level security;
alter table public.kunden             enable row level security;
alter table public.kostentraeger      enable row level security;
alter table public.leistungen         enable row level security;
alter table public.kommunikation      enable row level security;
alter table public.aufgaben           enable row level security;
alter table public.termine            enable row level security;
alter table public.stundenzettel      enable row level security;
alter table public.abtretungen        enable row level security;
alter table public.lohnabrechnungen   enable row level security;
alter table public.vorlagen           enable row level security;
alter table public.email_log          enable row level security;
alter table public.marketing_material enable row level security;
alter table public.aktivitaeten       enable row level security;
alter table public.schulungen         enable row level security;
alter table public.schulungen_status  enable row level security;


-- ============================================================
--  E · firmen
--  Hier entstehen die Kacheln: Man sieht genau die Firmen,
--  in denen man Mitglied ist. Eine Firma = direkt rein.
-- ============================================================
create policy firmen_select on public.firmen
  for select using (public.ist_mitglied(id));

create policy firmen_update on public.firmen
  for update using (public.ist_admin(id))
  with check (public.ist_admin(id));

-- Anlegen und Löschen von Firmen bleibt bewusst dem Seed /
-- Service-Key vorbehalten – nicht über die App.


-- ============================================================
--  profile
-- ============================================================
create policy profile_select on public.profile
  for select using (id = auth.uid() or public.teilt_firma(id));

create policy profile_update on public.profile
  for update using (id = auth.uid())
  with check (id = auth.uid());


-- ============================================================
--  firmen_mitglieder · "Zugänge & Rollen"
-- ============================================================
-- Eigene Mitgliedschaften immer sichtbar – sonst gäbe es keine Kacheln.
create policy fm_select_self on public.firmen_mitglieder
  for select using (user_id = auth.uid());

-- Die Leitung sieht das ganze Team.
create policy fm_select_leitung on public.firmen_mitglieder
  for select using (public.ist_leitung(firma_id));

create policy fm_insert on public.firmen_mitglieder
  for insert with check (public.ist_admin(firma_id));

create policy fm_update on public.firmen_mitglieder
  for update using (public.ist_admin(firma_id))
  with check (public.ist_admin(firma_id));

create policy fm_delete on public.firmen_mitglieder
  for delete using (public.ist_admin(firma_id));


-- ============================================================
--  C · mitarbeiter
--  Enthält Stundenlohn – deshalb sieht eine Mitarbeiterin
--  nur ihre eigene Akte, nicht die der Kolleginnen.
-- ============================================================
create policy ma_select on public.mitarbeiter
  for select using (
    public.ist_leitung(firma_id) or user_id = auth.uid()
  );

create policy ma_insert on public.mitarbeiter
  for insert with check (public.ist_leitung(firma_id));

create policy ma_update on public.mitarbeiter
  for update using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));

create policy ma_delete on public.mitarbeiter
  for delete using (public.ist_admin(firma_id));


-- ============================================================
--  A · Stammdaten & Einstellungen
--  lesen: jedes Mitglied · schreiben: Leitung
-- ============================================================

-- kunden
create policy kunden_select on public.kunden
  for select using (public.ist_mitglied(firma_id));
create policy kunden_insert on public.kunden
  for insert with check (public.ist_leitung(firma_id));
create policy kunden_update on public.kunden
  for update using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));
create policy kunden_delete on public.kunden
  for delete using (public.ist_leitung(firma_id));

-- kostentraeger
create policy kt_select on public.kostentraeger
  for select using (public.ist_mitglied(firma_id));
create policy kt_write on public.kostentraeger
  for all using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));

-- leistungen
create policy lst_select on public.leistungen
  for select using (public.ist_mitglied(firma_id));
create policy lst_write on public.leistungen
  for all using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));

-- vorlagen (E-Mail-Vorlage + Beratungsvorlage)
create policy vorl_select on public.vorlagen
  for select using (public.ist_mitglied(firma_id));
create policy vorl_write on public.vorlagen
  for all using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));

-- marketing_material
create policy mkt_select on public.marketing_material
  for select using (public.ist_mitglied(firma_id));
create policy mkt_write on public.marketing_material
  for all using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));

-- schulungen
create policy schul_select on public.schulungen
  for select using (public.ist_mitglied(firma_id));
create policy schul_write on public.schulungen
  for all using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));

-- schulungen_status: eigenen Stand sehen, Leitung sieht alle
create policy schulst_select on public.schulungen_status
  for select using (
    public.ist_leitung(firma_id)
    or mitarbeiter_id = public.meine_mitarbeiter_id(firma_id)
  );
create policy schulst_write on public.schulungen_status
  for all using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));


-- ============================================================
--  B · Bewegungsdaten
--  lesen und schreiben: jedes Mitglied
-- ============================================================

-- kommunikation (trägt auch die Notizen)
create policy komm_select on public.kommunikation
  for select using (public.ist_mitglied(firma_id));
create policy komm_insert on public.kommunikation
  for insert with check (public.ist_mitglied(firma_id));
create policy komm_update on public.kommunikation
  for update using (public.ist_mitglied(firma_id))
  with check (public.ist_mitglied(firma_id));
create policy komm_delete on public.kommunikation
  for delete using (public.ist_leitung(firma_id));

-- aufgaben
create policy auf_select on public.aufgaben
  for select using (public.ist_mitglied(firma_id));
create policy auf_insert on public.aufgaben
  for insert with check (public.ist_mitglied(firma_id));
create policy auf_update on public.aufgaben
  for update using (public.ist_mitglied(firma_id))
  with check (public.ist_mitglied(firma_id));
create policy auf_delete on public.aufgaben
  for delete using (public.ist_leitung(firma_id));

-- abtretungen
create policy abt_select on public.abtretungen
  for select using (public.ist_mitglied(firma_id));
create policy abt_insert on public.abtretungen
  for insert with check (public.ist_mitglied(firma_id));
create policy abt_update on public.abtretungen
  for update using (public.ist_mitglied(firma_id))
  with check (public.ist_mitglied(firma_id));
create policy abt_delete on public.abtretungen
  for delete using (public.ist_leitung(firma_id));


-- ============================================================
--  termine · Kalender
--  Die Übersicht über ALLE Mitarbeiter ist Leitungssache.
--  Eine Mitarbeiterin sieht ihre eigenen Termine.
-- ============================================================
create policy term_select on public.termine
  for select using (
    public.ist_leitung(firma_id)
    or mitarbeiter_id = public.meine_mitarbeiter_id(firma_id)
  );

create policy term_write_leitung on public.termine
  for all using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));

-- Eigenen Termin bearbeiten (z. B. auf "erledigt" setzen)
create policy term_update_self on public.termine
  for update using (mitarbeiter_id = public.meine_mitarbeiter_id(firma_id))
  with check (mitarbeiter_id = public.meine_mitarbeiter_id(firma_id));


-- ============================================================
--  stundenzettel
--  Eigene erfassen und ändern, solange sie offen sind.
--  Nach der Freigabe durch die Leitung sind sie für die
--  Mitarbeiterin gesperrt – sonst wäre die Freigabe wertlos.
-- ============================================================
create policy sz_select on public.stundenzettel
  for select using (
    public.ist_leitung(firma_id)
    or mitarbeiter_id = public.meine_mitarbeiter_id(firma_id)
  );

create policy sz_insert on public.stundenzettel
  for insert with check (
    public.ist_leitung(firma_id)
    or (public.ist_mitglied(firma_id)
        and mitarbeiter_id = public.meine_mitarbeiter_id(firma_id))
  );

create policy sz_update_leitung on public.stundenzettel
  for update using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));

create policy sz_update_self on public.stundenzettel
  for update using (
    mitarbeiter_id = public.meine_mitarbeiter_id(firma_id)
    and status = 'offen'
  )
  with check (
    mitarbeiter_id = public.meine_mitarbeiter_id(firma_id)
    and status = 'offen'
  );

create policy sz_delete on public.stundenzettel
  for delete using (public.ist_leitung(firma_id));


-- ============================================================
--  C · lohnabrechnungen
--  Die eigene Abrechnung sehen – fremde nie.
--  Geschrieben wird ausschließlich von der Leitung.
-- ============================================================
create policy lohn_select on public.lohnabrechnungen
  for select using (
    public.ist_leitung(firma_id)
    or mitarbeiter_id = public.meine_mitarbeiter_id(firma_id)
  );

create policy lohn_write on public.lohnabrechnungen
  for all using (public.ist_leitung(firma_id))
  with check (public.ist_leitung(firma_id));


-- ============================================================
--  email_log
-- ============================================================
create policy maillog_select on public.email_log
  for select using (public.ist_leitung(firma_id));
create policy maillog_insert on public.email_log
  for insert with check (public.ist_mitglied(firma_id));


-- ============================================================
--  D · aktivitaeten · Aktivitätsprotokoll
--  Anhängen darf jeder, ändern und löschen niemand.
--  Ein Protokoll, das man aufräumen kann, ist kein Protokoll.
-- ============================================================
create policy akt_select on public.aktivitaeten
  for select using (public.ist_leitung(firma_id));

create policy akt_insert on public.aktivitaeten
  for insert with check (public.ist_mitglied(firma_id));

-- Bewusst keine UPDATE- und DELETE-Policy.


-- ============================================================
--  Rechtevergabe
--  anon (nicht angemeldet) bekommt nichts.
-- ============================================================
revoke all on all tables in schema public from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter default privileges in schema public
  revoke all on tables from anon;
