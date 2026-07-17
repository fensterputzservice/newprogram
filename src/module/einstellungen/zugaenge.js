/* ============================================================
   Zugänge & Rollen

   Diese Tabelle entscheidet, wer welche Firma betreten darf und
   mit welchen Rechten – sie ist die Grundlage der Kacheln nach
   dem Login und jeder RLS-Prüfung. Deshalb ist der Untereintrag
   in einstellungen.js nur für rollen:['admin'].

   Anlegen fehlt hier bewusst: Ein Zugang braucht zuerst einen
   Auth-User, und den kann der Browser nicht erzeugen – dafür wäre
   der Service-Key nötig, der nie in den Client gehört. Solange
   uns die passende Server-Funktion fehlt, ist Anlegen an dieser
   Stelle nicht möglich, statt es halb zu tun.
   ============================================================ */

import { liste, aendern, loeschen } from '../../kern/crud.js';
import {
  tabelle, werkzeugleiste, formularDialog, bestaetige,
  hinweis, sicher, sucheVerdrahten, etikett,
} from '../../kern/ui.js';

const ROLLEN = [
  { wert: 'admin', text: 'Admin', art: 'gut' },
  { wert: 'leitung', text: 'Leitung', art: 'warnung' },
  { wert: 'mitarbeiter', text: 'Mitarbeiter', art: 'ruhig' },
];

const felder = [
  { name: 'rolle', label: 'Rolle', art: 'select', pflicht: true,
    optionen: ROLLEN.map(({ wert, text }) => ({ wert, text })) },
  { name: 'aktiv', label: 'Aktiv', art: 'checkbox',
    hinweis: 'Aktiv – darf die Firma betreten.' },
];

function rollenEtikett(wert) {
  const r = ROLLEN.find((x) => x.wert === wert);
  return r ? etikett(r.text, r.art) : etikett(wert ?? '—', 'ruhig');
}

export async function mountZugaenge(el, ctx) {
  const mitglieder = await liste('firmen_mitglieder', { firma: ctx.firma.id });

  el.innerHTML = `
    <div class="karte" style="margin-bottom:16px">
      <p style="margin:0 0 8px">
        Neue Zugänge entstehen nicht hier, sondern in Supabase unter
        <strong>Authentication → Users</strong>. Erst die Person dort anlegen,
        danach erscheint sie in dieser Liste und bekommt ihre Rolle.
      </p>
      <p style="margin:0">
        Grund: Ein Auth-User lässt sich nur mit dem Service-Key erzeugen, und der
        gehört nicht in den Browser. Solange dafür eine Server-Funktion fehlt,
        bleibt der Weg bewusst der über Supabase.
      </p>
    </div>
    ${werkzeugleiste({
      platzhalter: 'Benutzer oder Rolle …',
      knopf: null,
    })}
    ${tabelle({
      spalten: [
        { kopf: 'Benutzer', zelle: (m) => sicher(m.user_id) },
        { kopf: 'Rolle', breite: '1%', zelle: (m) => rollenEtikett(m.rolle) },
        { kopf: 'Status', breite: '1%',
          zelle: (m) => (m.aktiv ? etikett('Aktiv', 'gut') : etikett('Gesperrt', 'schlecht')) },
      ],
      zeilen: mitglieder,
      leer: 'Noch keine Zugänge für diese Firma.',
      aktionen: (m) => `
        <button data-bearbeiten="${sicher(m.id)}">Bearbeiten</button>
        <button class="loeschen" data-loeschen="${sicher(m.id)}">Zugang entziehen</button>`,
    })}`;

  sucheVerdrahten(el);

  async function bearbeiten(mitglied) {
    const gespeichert = await formularDialog({
      titel: 'Zugang bearbeiten',
      felder,
      werte: mitglied,
      aufSpeichern: async (werte) => {
        await aendern('firmen_mitglieder', mitglied.id, werte);
      },
    });
    if (!gespeichert) return;
    hinweis('Zugang gespeichert.');
    ctx.neuLaden();
  }

  el.querySelectorAll('[data-bearbeiten]').forEach((knopf) => {
    knopf.onclick = () =>
      bearbeiten(mitglieder.find((m) => m.id === knopf.dataset.bearbeiten));
  });

  el.querySelectorAll('[data-loeschen]').forEach((knopf) => {
    knopf.onclick = async () => {
      const mitglied = mitglieder.find((m) => m.id === knopf.dataset.loeschen);
      if (!mitglied) return;
      const ja = await bestaetige(
        `Zugang zu „${ctx.firma.name}“ wirklich entziehen? Die Person kann diese `
        + 'Firma dann nicht mehr betreten. Der Login selbst bleibt bestehen.',
        { titel: 'Zugang entziehen', knopfText: 'Entziehen', gefahr: true },
      );
      if (!ja) return;
      try {
        await loeschen('firmen_mitglieder', mitglied.id);
        hinweis('Zugang entzogen.');
        ctx.neuLaden();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    };
  });
}
