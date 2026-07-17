/* ============================================================
   Kostenträger

   Für die Alltagshilfe sind das die Pflegekassen (§45b SGB XI),
   für den Fensterputz-Service die Rechnungsempfänger. Dieselbe
   Tabelle, zwei Bedeutungen – deshalb ist nur der Name Pflicht.
   ============================================================ */

import { liste, anlegen, aendern, loeschen } from '../../kern/crud.js';
import {
  tabelle, werkzeugleiste, formularDialog, bestaetige,
  hinweis, sicher, sucheVerdrahten,
} from '../../kern/ui.js';

const felder = [
  { name: 'name', label: 'Name', pflicht: true, breit: true },
  { name: 'strasse', label: 'Straße und Hausnummer', breit: true },
  { name: 'plz', label: 'PLZ' },
  { name: 'ort', label: 'Ort' },
  { name: 'email', label: 'E-Mail', art: 'email' },
  { name: 'telefon', label: 'Telefon', art: 'tel' },
  { name: 'ik_nummer', label: 'IK-Nummer', hinweis: 'Nur bei Pflegekassen.' },
];

export async function mountKostentraeger(el, ctx) {
  const kostentraeger = await liste('kostentraeger', { firma: ctx.firma.id, sortieren: 'name' });

  el.innerHTML = `
    ${werkzeugleiste({
      platzhalter: 'Name, Ort oder IK-Nummer …',
      knopf: { id: 'neu', text: '+ Neuer Kostenträger' },
    })}
    ${tabelle({
      spalten: [
        { kopf: 'Name', zelle: (k) => sicher(k.name) },
        { kopf: 'Ort', zelle: (k) => sicher(k.ort ?? '—') },
        { kopf: 'E-Mail', zelle: (k) => sicher(k.email ?? '—') },
        { kopf: 'IK-Nummer', zelle: (k) => sicher(k.ik_nummer ?? '—') },
      ],
      zeilen: kostentraeger,
      leer: 'Noch keine Kostenträger angelegt.',
      aktionen: (k) => `
        <button data-bearbeiten="${sicher(k.id)}">Bearbeiten</button>
        <button class="loeschen" data-loeschen="${sicher(k.id)}">Löschen</button>`,
    })}`;

  sucheVerdrahten(el);

  async function bearbeiten(eintrag) {
    const gespeichert = await formularDialog({
      titel: eintrag ? 'Kostenträger bearbeiten' : 'Neuer Kostenträger',
      felder,
      werte: eintrag ?? {},
      aufSpeichern: async (werte) => {
        if (eintrag) await aendern('kostentraeger', eintrag.id, werte);
        else await anlegen('kostentraeger', werte, ctx.firma.id);
      },
    });
    if (!gespeichert) return;
    hinweis(eintrag ? 'Kostenträger gespeichert.' : 'Kostenträger angelegt.');
    ctx.neuLaden();
  }

  el.querySelector('#neu').onclick = () => bearbeiten(null);

  el.querySelectorAll('[data-bearbeiten]').forEach((knopf) => {
    knopf.onclick = () =>
      bearbeiten(kostentraeger.find((k) => k.id === knopf.dataset.bearbeiten));
  });

  el.querySelectorAll('[data-loeschen]').forEach((knopf) => {
    knopf.onclick = async () => {
      const eintrag = kostentraeger.find((k) => k.id === knopf.dataset.loeschen);
      if (!eintrag) return;
      const ja = await bestaetige(
        `„${eintrag.name}“ wirklich löschen? Bei zugeordneten Kunden bleibt das `
        + 'Feld Kostenträger danach leer.',
        { titel: 'Kostenträger löschen', knopfText: 'Löschen', gefahr: true },
      );
      if (!ja) return;
      try {
        await loeschen('kostentraeger', eintrag.id);
        hinweis('Kostenträger gelöscht.');
        ctx.neuLaden();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    };
  });
}
