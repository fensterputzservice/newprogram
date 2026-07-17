/* ============================================================
   Zugangsdaten zur Datenbank
   ============================================================

   Beide Werte stehen in Supabase unter
   Project Settings → API.

   Zum "anon key": Der gehört in den Browser und ist dafür gemacht,
   öffentlich zu sein – er ist kein Passwort. Was er darf, entscheiden
   allein die Regeln aus sql/02_rls.sql. Genau deshalb war es wichtig,
   die Mandantentrennung dort hinzulegen und nicht in den Client.

   Solange beide Felder leer sind, läuft die Anwendung im Testbetrieb
   mit Beispieldaten im Browser.
   ============================================================ */

export const SUPABASE_URL      = 'https://wmwgojeilbedvcnpnnrg.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtd2dvamVpbGJlZHZjbnBubnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNzQyNDIsImV4cCI6MjA5OTg1MDI0Mn0.q58Gfw2_qlK6PZjNYNFN-qCIViVV2HuhlMcBrisZP_M';

/** Testbetrieb, solange keine Datenbank hinterlegt ist. */
export const testbetrieb = () => !SUPABASE_URL || !SUPABASE_ANON_KEY;

/** Anmeldungen, die den Testbetrieb starten (Passwort beliebig). */
export const TEST_LOGINS = {
  'admin@test.de':       { rolle: 'admin',       name: 'Daniel Dmytrov' },
  'mitarbeiter@test.de': { rolle: 'mitarbeiter', name: 'Laura Duske' },
};
