/* ============================================================
   Schulungen

   Verwaltet wird der Katalog (schulungen). Wer welche Schulung
   erledigt hat, steht in schulungen_status – das wird hier nur
   gezählt und nicht bearbeitet.
   ============================================================ */

import { liste, anlegen, aendern, loeschen } from '../../kern/crud.js';
import {
  tabelle, werkzeugleiste, formularDialog, bestaetige,
  hinweis, sicher, sucheVerdrahten, etikett,
} from '../../kern/ui.js';

const felder = [
  { name: 'titel', label: 'Titel', pflicht: true, breit: true },
  { name: 'beschreibung', label: 'Beschreibung', art: 'textarea', zeilen: 3, breit: true },
  { name: 'inhalt', label: 'Inhalt', art: 'textarea', zeilen: 6, breit: true },
  { name: 'pflicht', label: 'Pflicht', art: 'checkbox',
    hinweis: 'Pflichtschulung – von allen Mitarbeitern zu absolvieren.' },
  { name: 'gueltig_monate', label: 'Gültigkeit in Monaten', art: 'number',
    hinweis: 'Auffrischung nach X Monaten, leer = unbegrenzt.' },
  { name: 'aktiv', label: 'Aktiv', art: 'checkbox',
    hinweis: 'Aktiv – wird den Mitarbeitern angeboten.' },
];

export async function mountSchulungen(el, ctx) {
  const [schulungen, status] = await Promise.all([
    liste('schulungen', { firma: ctx.firma.id, sortieren: 'titel' }),
    liste('schulungen_status', { firma: ctx.firma.id }),
  ]);

  // Erledigt-Stände je Schulung zählen.
  const erledigt = new Map();
  for (const s of status) {
    erledigt.set(s.schulung_id, (erledigt.get(s.schulung_id) ?? 0) + 1);
  }

  const anzahlText = (schulung) => {
    const n = erledigt.get(schulung.id) ?? 0;
    if (!n) return 'von niemandem';
    return n === 1 ? 'von 1 Mitarbeiter' : `von ${n} Mitarbeitern`;
  };

  el.innerHTML = `
    ${werkzeugleiste({
      platzhalter: 'Titel oder Beschreibung …',
      knopf: { id: 'neu', text: '+ Neue Schulung' },
    })}
    ${tabelle({
      spalten: [
        { kopf: 'Titel', zelle: (s) => sicher(s.titel) },
        { kopf: 'Pflicht', breite: '1%',
          zelle: (s) => (s.pflicht ? etikett('Pflicht', 'warnung') : etikett('Freiwillig', 'ruhig')) },
        { kopf: 'Gültigkeit',
          zelle: (s) => sicher(s.gueltig_monate ? `${s.gueltig_monate} Monate` : 'unbegrenzt') },
        { kopf: 'Erledigt', zelle: (s) => sicher(anzahlText(s)) },
        { kopf: 'Status', breite: '1%',
          zelle: (s) => (s.aktiv ? etikett('Aktiv', 'gut') : etikett('Inaktiv', 'ruhig')) },
      ],
      zeilen: schulungen,
      leer: 'Noch keine Schulungen angelegt.',
      aktionen: (s) => `
        <button data-bearbeiten="${sicher(s.id)}">Bearbeiten</button>
        <button class="loeschen" data-loeschen="${sicher(s.id)}">Löschen</button>`,
    })}`;

  sucheVerdrahten(el);

  async function bearbeiten(schulung) {
    const gespeichert = await formularDialog({
      titel: schulung ? 'Schulung bearbeiten' : 'Neue Schulung',
      felder,
      werte: schulung ?? { aktiv: true, pflicht: false },
      aufSpeichern: async (werte) => {
        if (schulung) await aendern('schulungen', schulung.id, werte);
        else await anlegen('schulungen', werte, ctx.firma.id);
      },
    });
    if (!gespeichert) return;
    hinweis(schulung ? 'Schulung gespeichert.' : 'Schulung angelegt.');
    ctx.neuLaden();
  }

  el.querySelector('#neu').onclick = () => bearbeiten(null);

  el.querySelectorAll('[data-bearbeiten]').forEach((knopf) => {
    knopf.onclick = () =>
      bearbeiten(schulungen.find((s) => s.id === knopf.dataset.bearbeiten));
  });

  el.querySelectorAll('[data-loeschen]').forEach((knopf) => {
    knopf.onclick = async () => {
      const schulung = schulungen.find((s) => s.id === knopf.dataset.loeschen);
      if (!schulung) return;
      const n = erledigt.get(schulung.id) ?? 0;
      const ja = await bestaetige(
        `„${schulung.titel}“ wirklich löschen?`
        + (n ? ` Der erledigte Stand von ${n} Mitarbeiter${n === 1 ? '' : 'n'} geht mit verloren.` : ''),
        { titel: 'Schulung löschen', knopfText: 'Löschen', gefahr: true },
      );
      if (!ja) return;
      try {
        await loeschen('schulungen', schulung.id);
        hinweis('Schulung gelöscht.');
        ctx.neuLaden();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    };
  });
}
