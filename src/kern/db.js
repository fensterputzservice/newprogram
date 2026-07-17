/* ============================================================
   Verbindung zur Datenbank
   ============================================================ */

import { SUPABASE_URL, SUPABASE_ANON_KEY, testbetrieb } from './config.js';

let client = null;

/**
 * Liefert den Supabase-Client, oder null im Testbetrieb.
 * Die Bibliothek wird erst geladen, wenn sie gebraucht wird.
 */
export async function db() {
  if (testbetrieb()) return null;
  if (client) return client;

  const { createClient } = await import(
    'https://esm.sh/@supabase/supabase-js@2.110.0'
  );
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/**
 * Zeilen einer Firma lesen.
 *
 * Das .eq('firma_id', …) ist hier reine Bequemlichkeit, kein Schutz:
 * Die eigentliche Trennung erzwingt die Datenbank über RLS. Fiele diese
 * Zeile weg, käme trotzdem nichts Fremdes zurück – anders als im
 * Altsystem, wo genau dieser Filter die einzige Absicherung war.
 */
export async function ladeFuerFirma(tabelle, firmaId, aufbau = (q) => q) {
  const sb = await db();
  if (!sb) return [];

  const { data, error } = await aufbau(
    sb.from(tabelle).select('*').eq('firma_id', firmaId)
  );
  if (error) throw new Error(`${tabelle}: ${error.message}`);
  return data ?? [];
}
