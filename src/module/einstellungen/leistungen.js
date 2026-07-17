/* ============================================================
   Leistungen – der Leistungskatalog einer Firma

   Der Katalog ist der Preisträger: Termine und Stundenzettel
   hängen an leistung_id. Der Umsatzsteuersatz gehört deshalb an
   die Leistung und nicht an die Rechnung.
   ============================================================ */

import { liste, anlegen, aendern, loeschen } from '../../kern/crud.js';
import {
  tabelle, werkzeugleiste, formularDialog, bestaetige,
  hinweis, sicher, sucheVerdrahten, etikett, euro,
} from '../../kern/ui.js';

const EINHEITEN = ['Stunde', 'Pauschale', 'qm', 'Stück'];

const felder = [
  { name: 'name', label: 'Bezeichnung', pflicht: true, breit: true },
  { name: 'preis', label: 'Preis', art: 'number', schritt: '0.01' },
  { name: 'einheit', label: 'Einheit', art: 'select',
    optionen: EINHEITEN.map((e) => ({ wert: e, text: e })) },
  { name: 'ust_satz', label: 'USt-Satz in %', art: 'number', schritt: '0.01',
    hinweis: 'Fensterputz 19, Alltagshilfe 0 – §45b SGB XI ist umsatzsteuerfrei.' },
  { name: 'aktiv', label: 'Aktiv', art: 'checkbox',
    hinweis: 'Aktiv – wird bei Terminen und Stundenzetteln angeboten.' },
];

export async function mountLeistungen(el, ctx) {
  const leistungen = await liste('leistungen', { firma: ctx.firma.id, sortieren: 'name' });

  el.innerHTML = `
    ${werkzeugleiste({
      platzhalter: 'Bezeichnung oder Einheit …',
      knopf: { id: 'neu', text: '+ Neue Leistung' },
    })}
    ${tabelle({
      spalten: [
        { kopf: 'Bezeichnung', zelle: (l) => sicher(l.name) },
        { kopf: 'Preis', zelle: (l) => (l.preis === null || l.preis === undefined ? '—' : euro(l.preis)) },
        { kopf: 'Einheit', zelle: (l) => sicher(l.einheit ?? '—') },
        { kopf: 'USt-Satz', zelle: (l) => sicher(Number(l.ust_satz ?? 0).toLocaleString('de-DE') + ' %') },
        { kopf: 'Status', breite: '1%',
          zelle: (l) => (l.aktiv ? etikett('Aktiv', 'gut') : etikett('Inaktiv', 'ruhig')) },
      ],
      zeilen: leistungen,
      leer: 'Noch keine Leistungen angelegt.',
      aktionen: (l) => `
        <button data-bearbeiten="${sicher(l.id)}">Bearbeiten</button>
        <button class="loeschen" data-loeschen="${sicher(l.id)}">Löschen</button>`,
    })}`;

  sucheVerdrahten(el);

  async function bearbeiten(leistung) {
    const gespeichert = await formularDialog({
      titel: leistung ? 'Leistung bearbeiten' : 'Neue Leistung',
      felder,
      werte: leistung ?? { aktiv: true, ust_satz: 0 },
      aufSpeichern: async (werte) => {
        const daten = { ...werte, ust_satz: werte.ust_satz ?? 0 };
        if (leistung) await aendern('leistungen', leistung.id, daten);
        else await anlegen('leistungen', daten, ctx.firma.id);
      },
    });
    if (!gespeichert) return;
    hinweis(leistung ? 'Leistung gespeichert.' : 'Leistung angelegt.');
    ctx.neuLaden();
  }

  el.querySelector('#neu').onclick = () => bearbeiten(null);

  el.querySelectorAll('[data-bearbeiten]').forEach((knopf) => {
    knopf.onclick = () =>
      bearbeiten(leistungen.find((l) => l.id === knopf.dataset.bearbeiten));
  });

  el.querySelectorAll('[data-loeschen]').forEach((knopf) => {
    knopf.onclick = async () => {
      const leistung = leistungen.find((l) => l.id === knopf.dataset.loeschen);
      if (!leistung) return;
      const ja = await bestaetige(
        `„${leistung.name}“ wirklich löschen? Wer die Leistung nur aus der Auswahl `
        + 'nehmen will, setzt sie besser auf inaktiv.',
        { titel: 'Leistung löschen', knopfText: 'Löschen', gefahr: true },
      );
      if (!ja) return;
      try {
        await loeschen('leistungen', leistung.id);
        hinweis('Leistung gelöscht.');
        ctx.neuLaden();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    };
  });
}
