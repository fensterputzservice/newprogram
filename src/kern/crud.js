/* ============================================================
   Datenzugriff

   Ein Weg für beide Betriebsarten: Im Testbetrieb liegen die
   Daten im Arbeitsspeicher, sonst in Supabase. Die Module merken
   davon nichts – sie rufen immer dieselben vier Funktionen.

   Die firma_id wird hier gesetzt, nicht in den Modulen. So kann
   kein Modul vergessen, sie mitzugeben.
   ============================================================ */

import { db } from './db.js';
import { zustand } from './auth.js';
import { TEST_DATEN } from './testdaten.js';

/* ---------- Testspeicher ---------- */
const speicher = new Map();

function tisch(tabelle) {
  if (!speicher.has(tabelle)) {
    speicher.set(tabelle, structuredClone(TEST_DATEN[tabelle] ?? []));
  }
  return speicher.get(tabelle);
}

const neueId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));

/**
 * Zeilen einer Firma lesen.
 * @param {string} tabelle
 * @param {object} opt  { firma, sortieren:'spalte', absteigend:bool, wo:{spalte:wert} }
 */
export async function liste(tabelle, opt = {}) {
  const { firma, sortieren, absteigend = false, wo = {} } = opt;

  if (zustand.test) {
    let zeilen = tisch(tabelle).filter((z) => !firma || z.firma_id === firma);
    for (const [spalte, wert] of Object.entries(wo)) {
      if (wert !== undefined && wert !== null) {
        zeilen = zeilen.filter((z) => z[spalte] === wert);
      }
    }
    if (sortieren) {
      zeilen = [...zeilen].sort((a, b) => {
        const x = a[sortieren] ?? '', y = b[sortieren] ?? '';
        return (x > y ? 1 : x < y ? -1 : 0) * (absteigend ? -1 : 1);
      });
    }
    return structuredClone(zeilen);
  }

  const sb = await db();
  let q = sb.from(tabelle).select('*');
  if (firma) q = q.eq('firma_id', firma);
  for (const [spalte, wert] of Object.entries(wo)) {
    if (wert !== undefined && wert !== null) q = q.eq(spalte, wert);
  }
  if (sortieren) q = q.order(sortieren, { ascending: !absteigend });

  const { data, error } = await q;
  if (error) throw new Error(lesbar(tabelle, error));
  return data ?? [];
}

/** Eine Zeile anlegen. Die firma_id kommt von hier. */
export async function anlegen(tabelle, daten, firmaId) {
  const zeile = { ...daten };
  if (firmaId) zeile.firma_id = firmaId;

  if (zustand.test) {
    const neu = { ...zeile, id: neueId(), created_at: new Date().toISOString() };
    tisch(tabelle).push(neu);
    return structuredClone(neu);
  }

  const sb = await db();
  const { data, error } = await sb.from(tabelle).insert(zeile).select().single();
  if (error) throw new Error(lesbar(tabelle, error));
  return data;
}

/** Eine Zeile ändern. */
export async function aendern(tabelle, id, daten) {
  if (zustand.test) {
    const zeilen = tisch(tabelle);
    const i = zeilen.findIndex((z) => z.id === id);
    if (i < 0) throw new Error('Eintrag nicht gefunden.');
    zeilen[i] = { ...zeilen[i], ...daten };
    return structuredClone(zeilen[i]);
  }

  const sb = await db();
  const { data, error } = await sb.from(tabelle).update(daten).eq('id', id).select().single();
  if (error) throw new Error(lesbar(tabelle, error));
  return data;
}

/** Eine Zeile löschen. */
export async function loeschen(tabelle, id) {
  if (zustand.test) {
    const zeilen = tisch(tabelle);
    const i = zeilen.findIndex((z) => z.id === id);
    if (i >= 0) zeilen.splice(i, 1);
    return true;
  }

  const sb = await db();
  const { error } = await sb.from(tabelle).delete().eq('id', id);
  if (error) throw new Error(lesbar(tabelle, error));
  return true;
}

/**
 * Postgres-Fehler in Klartext.
 * Wichtig ist vor allem 42501: Das ist keine Panne, sondern die
 * Zugriffsregel, die greift – die Meldung soll das auch sagen.
 */
function lesbar(tabelle, error) {
  const code = error?.code;
  if (code === '42501') {
    return `Keine Berechtigung für ${tabelle}. Deine Rolle darf das nicht.`;
  }
  if (code === '42P01') {
    return `Die Tabelle ${tabelle} gibt es nicht. Wurde 01_schema.sql ausgeführt?`;
  }
  if (code === '23505') return 'Diesen Eintrag gibt es bereits.';
  if (code === '23503') return 'Der Eintrag hängt an einem anderen Datensatz und kann nicht gelöscht werden.';
  if (code === '23514') return 'Eine Eingabe ist ungültig.';
  return error?.message ?? 'Unbekannter Fehler';
}
