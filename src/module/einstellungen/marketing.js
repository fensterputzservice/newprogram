/* ============================================================
   Marketingmaterial

   Eine Merkliste, keine Dateiablage: Die Datei selbst liegt
   anderswo, hier steht nur der Verweis darauf.
   ============================================================ */

import { liste, anlegen, aendern, loeschen } from '../../kern/crud.js';
import {
  tabelle, werkzeugleiste, formularDialog, bestaetige,
  hinweis, sicher, sucheVerdrahten,
} from '../../kern/ui.js';

const TYPEN = ['Flyer', 'Visitenkarte', 'Plakat', 'Anzeige', 'Sonstiges'];

const felder = [
  { name: 'name', label: 'Name', pflicht: true, breit: true },
  { name: 'typ', label: 'Typ', art: 'select',
    optionen: TYPEN.map((t) => ({ wert: t, text: t })) },
  { name: 'beschreibung', label: 'Beschreibung', art: 'textarea', zeilen: 3, breit: true },
  { name: 'datei_url', label: 'Datei', hinweis: 'Link zur Datei.', breit: true },
];

export async function mountMarketing(el, ctx) {
  const material = await liste('marketing_material', { firma: ctx.firma.id, sortieren: 'name' });

  el.innerHTML = `
    ${werkzeugleiste({
      platzhalter: 'Name, Typ oder Beschreibung …',
      knopf: { id: 'neu', text: '+ Neues Material' },
    })}
    ${tabelle({
      spalten: [
        { kopf: 'Name', zelle: (m) => sicher(m.name) },
        { kopf: 'Typ', zelle: (m) => sicher(m.typ ?? '—') },
        { kopf: 'Beschreibung', zelle: (m) => sicher(m.beschreibung ?? '—') },
      ],
      zeilen: material,
      leer: 'Noch kein Marketingmaterial hinterlegt.',
      aktionen: (m) => `
        <button data-bearbeiten="${sicher(m.id)}">Bearbeiten</button>
        <button class="loeschen" data-loeschen="${sicher(m.id)}">Löschen</button>`,
    })}`;

  sucheVerdrahten(el);

  async function bearbeiten(eintrag) {
    const gespeichert = await formularDialog({
      titel: eintrag ? 'Material bearbeiten' : 'Neues Material',
      felder,
      werte: eintrag ?? {},
      aufSpeichern: async (werte) => {
        if (eintrag) await aendern('marketing_material', eintrag.id, werte);
        else await anlegen('marketing_material', werte, ctx.firma.id);
      },
    });
    if (!gespeichert) return;
    hinweis(eintrag ? 'Material gespeichert.' : 'Material angelegt.');
    ctx.neuLaden();
  }

  el.querySelector('#neu').onclick = () => bearbeiten(null);

  el.querySelectorAll('[data-bearbeiten]').forEach((knopf) => {
    knopf.onclick = () =>
      bearbeiten(material.find((m) => m.id === knopf.dataset.bearbeiten));
  });

  el.querySelectorAll('[data-loeschen]').forEach((knopf) => {
    knopf.onclick = async () => {
      const eintrag = material.find((m) => m.id === knopf.dataset.loeschen);
      if (!eintrag) return;
      const ja = await bestaetige(
        `„${eintrag.name}“ wirklich löschen? Die verlinkte Datei selbst bleibt bestehen.`,
        { titel: 'Material löschen', knopfText: 'Löschen', gefahr: true },
      );
      if (!ja) return;
      try {
        await loeschen('marketing_material', eintrag.id);
        hinweis('Material gelöscht.');
        ctx.neuLaden();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    };
  });
}
