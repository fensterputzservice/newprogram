/* ============================================================
   Anmeldung
   ============================================================ */

import { db } from './db.js';
import { testbetrieb, TEST_LOGINS } from './config.js';

export const zustand = {
  benutzer: null,   // { id, email, name }
  test: false,      // Testbetrieb ohne Datenbank?
};

/**
 * Anmelden.
 * Die Test-Logins greifen immer und gehen nie an die Datenbank.
 */
export async function anmelden(email, passwort) {
  const adresse = (email || '').trim().toLowerCase();

  const test = TEST_LOGINS[adresse];
  if (test) {
    zustand.test = true;
    zustand.benutzer = { id: `test-${test.rolle}`, email: adresse, name: test.name };
    return zustand.benutzer;
  }

  if (testbetrieb()) {
    throw new Error(
      'Es ist keine Datenbank hinterlegt. Bitte src/kern/config.js ausfüllen ' +
      'oder mit admin@test.de anmelden.'
    );
  }

  const sb = await db();
  const { data, error } = await sb.auth.signInWithPassword({
    email: adresse,
    password: passwort,
  });
  if (error) throw new Error(uebersetze(error.message));

  zustand.test = false;
  zustand.benutzer = {
    id: data.user.id,
    email: data.user.email,
    name: data.user.user_metadata?.name || data.user.email,
  };
  return zustand.benutzer;
}

export async function abmelden() {
  if (!zustand.test) {
    const sb = await db();
    if (sb) await sb.auth.signOut();
  }
  zustand.benutzer = null;
  zustand.test = false;
}

/** Läuft noch eine Sitzung? Wird beim Start geprüft. */
export async function sitzung() {
  if (testbetrieb()) return null;

  const sb = await db();
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;

  zustand.test = false;
  zustand.benutzer = {
    id: data.session.user.id,
    email: data.session.user.email,
    name: data.session.user.user_metadata?.name || data.session.user.email,
  };
  return zustand.benutzer;
}

/** Supabase antwortet englisch – hier die Fälle, die wirklich vorkommen. */
function uebersetze(meldung) {
  const m = (meldung || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmt nicht.';
  if (m.includes('email not confirmed'))       return 'Die E-Mail-Adresse ist noch nicht bestätigt.';
  if (m.includes('failed to fetch'))           return 'Keine Verbindung zur Datenbank.';
  return meldung;
}
