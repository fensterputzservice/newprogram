/* ============================================================
   Vorlagen – E-Mail-Vorlage und Beratungsvorlage

   Beides sind Vorlagen und liegen in derselben Tabelle; sie
   unterscheiden sich nur im typ. Deshalb steht die Mechanik hier
   einmal, und die zwei Menüpunkte reichen ihren typ herein.

   Der Betreff ist nur bei E-Mails ein Feld – eine Beratungsvorlage
   hat keinen.
   ============================================================ */

import { liste, anlegen, aendern, loeschen } from '../../kern/crud.js';
import {
  tabelle, werkzeugleiste, formularDialog, bestaetige,
  hinweis, sicher, sucheVerdrahten, etikett,
} from '../../kern/ui.js';

/* Alles, was die beiden Ansichten voneinander trennt. */
const ART = {
  email: {
    titel: 'E-Mail-Vorlage',
    einzahl: 'E-Mail-Vorlage',
    neu: '+ Neue E-Mail-Vorlage',
    leer: 'Noch keine E-Mail-Vorlagen angelegt.',
    mitBetreff: true,
  },
  beratung: {
    titel: 'Beratungsvorlage',
    einzahl: 'Beratungsvorlage',
    neu: '+ Neue Beratungsvorlage',
    leer: 'Noch keine Beratungsvorlagen angelegt.',
    mitBetreff: false,
  },
};

function felder(typ) {
  const felderliste = [
    { name: 'name', label: 'Name', pflicht: true, breit: true },
    { name: 'schluessel', label: 'Schlüssel',
      hinweis: 'Technischer Name, z. B. willkommen.' },
  ];
  if (ART[typ].mitBetreff) felderliste.push({ name: 'betreff', label: 'Betreff', breit: true });
  felderliste.push(
    { name: 'text', label: 'Text', art: 'textarea', zeilen: 8, breit: true },
    { name: 'aktiv', label: 'Aktiv', art: 'checkbox',
      hinweis: 'Aktiv – wird zur Auswahl angeboten.' },
  );
  return felderliste;
}

async function mountVorlagen(el, ctx, typ) {
  const art = ART[typ];
  const vorlagen = await liste('vorlagen', {
    firma: ctx.firma.id,
    sortieren: 'name',
    wo: { typ },
  });

  const spalten = [
    { kopf: 'Name', zelle: (v) => sicher(v.name) },
    { kopf: 'Schlüssel', zelle: (v) => sicher(v.schluessel ?? '—') },
  ];
  if (art.mitBetreff) {
    spalten.push({ kopf: 'Betreff', zelle: (v) => sicher(v.betreff ?? '—') });
  }
  spalten.push({
    kopf: 'Status', breite: '1%',
    zelle: (v) => (v.aktiv ? etikett('Aktiv', 'gut') : etikett('Inaktiv', 'ruhig')),
  });

  el.innerHTML = `
    ${werkzeugleiste({
      platzhalter: 'Name oder Schlüssel …',
      knopf: { id: 'neu', text: art.neu },
    })}
    ${tabelle({
      spalten,
      zeilen: vorlagen,
      leer: art.leer,
      aktionen: (v) => `
        <button data-bearbeiten="${sicher(v.id)}">Bearbeiten</button>
        <button class="loeschen" data-loeschen="${sicher(v.id)}">Löschen</button>`,
    })}`;

  sucheVerdrahten(el);

  async function bearbeiten(vorlage) {
    const gespeichert = await formularDialog({
      titel: vorlage ? `${art.einzahl} bearbeiten` : `Neue ${art.einzahl}`,
      felder: felder(typ),
      werte: vorlage ?? { aktiv: true },
      aufSpeichern: async (werte) => {
        if (vorlage) await aendern('vorlagen', vorlage.id, werte);
        // Der typ kommt vom Menüpunkt, nicht aus dem Formular –
        // sonst landete eine E-Mail-Vorlage in der Beratungsliste.
        else await anlegen('vorlagen', { ...werte, typ }, ctx.firma.id);
      },
    });
    if (!gespeichert) return;
    hinweis(vorlage ? 'Vorlage gespeichert.' : 'Vorlage angelegt.');
    ctx.neuLaden();
  }

  el.querySelector('#neu').onclick = () => bearbeiten(null);

  el.querySelectorAll('[data-bearbeiten]').forEach((knopf) => {
    knopf.onclick = () =>
      bearbeiten(vorlagen.find((v) => v.id === knopf.dataset.bearbeiten));
  });

  el.querySelectorAll('[data-loeschen]').forEach((knopf) => {
    knopf.onclick = async () => {
      const vorlage = vorlagen.find((v) => v.id === knopf.dataset.loeschen);
      if (!vorlage) return;
      const ja = await bestaetige(
        `„${vorlage.name}“ wirklich löschen?`,
        { titel: `${art.einzahl} löschen`, knopfText: 'Löschen', gefahr: true },
      );
      if (!ja) return;
      try {
        await loeschen('vorlagen', vorlage.id);
        hinweis('Vorlage gelöscht.');
        ctx.neuLaden();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    };
  });
}

export async function mountEmailVorlagen(el, ctx) {
  return mountVorlagen(el, ctx, 'email');
}

export async function mountBeratungsVorlagen(el, ctx) {
  return mountVorlagen(el, ctx, 'beratung');
}
