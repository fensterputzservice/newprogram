/* ============================================================
   Mandant – welche Firma ist gerade offen
   ============================================================ */

import { db } from './db.js';
import { zustand } from './auth.js';
import { TEST_FIRMEN } from './testdaten.js';
import { TEST_LOGINS } from './config.js';

export const mandant = {
  firmen: [],   // alle Firmen, in denen der Benutzer Mitglied ist
  aktiv: null,  // die gewählte Firma
  rolle: null,  // Rolle in genau dieser Firma
};

const GEMERKT = 'dailydo.firma';

/**
 * Lädt die Firmen des angemeldeten Benutzers.
 *
 * Es gibt hier keinen Filter auf den Benutzer – der Server gibt
 * über RLS ohnehin nur die eigenen Mitgliedschaften heraus. Wer
 * nirgends Mitglied ist, bekommt eine leere Liste.
 */
export async function ladeFirmen() {
  if (zustand.test) {
    const rolle = TEST_LOGINS[zustand.benutzer.email]?.rolle ?? 'mitarbeiter';
    mandant.firmen = TEST_FIRMEN.map((f) => ({ ...f, rolle }));
    return mandant.firmen;
  }

  const sb = await db();
  const { data, error } = await sb
    .from('firmen_mitglieder')
    .select('rolle, firmen(*)')
    .eq('aktiv', true);

  if (error) throw new Error(`Firmen konnten nicht geladen werden: ${error.message}`);

  mandant.firmen = (data ?? [])
    .filter((z) => z.firmen)
    .map((z) => ({ ...z.firmen, rolle: z.rolle }))
    .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));

  return mandant.firmen;
}

/** Firma betreten. */
export function betrete(firmaId) {
  const f = mandant.firmen.find((x) => x.id === firmaId);
  if (!f) throw new Error('Diese Firma steht nicht zur Verfügung.');

  mandant.aktiv = f;
  mandant.rolle = f.rolle;
  wendeDesignAn(f);

  try { localStorage.setItem(GEMERKT, firmaId); } catch { /* Privatmodus */ }
  return f;
}

export function verlasse() {
  mandant.aktiv = null;
  mandant.rolle = null;
  wendeDesignAn(null);
  try { localStorage.removeItem(GEMERKT); } catch { /* Privatmodus */ }
}

/** Zuletzt genutzte Firma – nur, wenn es sie noch gibt. */
export function gemerkteFirma() {
  try {
    const id = localStorage.getItem(GEMERKT);
    return mandant.firmen.some((f) => f.id === id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Farben der Firma setzen.
 *
 * Beide Altversionen sahen identisch aus. Mit zwei Firmen in einer
 * Oberfläche ist das gefährlich – man sieht sonst nicht, wo man
 * gerade tippt. Deshalb färbt jede Firma die Oberfläche selbst ein.
 */
export function wendeDesignAn(firma) {
  const wurzel = document.documentElement;
  const STANDARD = {
    petrol: '#6d28d9', 'petrol-dark': '#4c1d95', 'petrol-soft': '#f0e9ff',
    amber: '#ff6b9d', 'amber-soft': '#ffe4ee',
    ink: '#1f1633', muted: '#6b6480', line: '#e8e2f5',
    bg: '#f7f5fc', card: '#ffffff',
  };

  const farben = { ...STANDARD, ...(firma?.design ?? {}) };
  for (const [name, wert] of Object.entries(farben)) {
    if (/^#[0-9a-f]{3,8}$/i.test(String(wert))) {
      wurzel.style.setProperty(`--${name}`, wert);
    }
  }
}

/** Kennfarbe der Firma, z. B. für Punkt und Streifen. */
export const firmenfarbe = (firma) => firma?.design?.petrol ?? '#6d28d9';
