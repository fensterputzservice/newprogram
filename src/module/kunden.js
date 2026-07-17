/* ============================================================
   Kunden – pro Firma getrennt.

   Ein Kunde ist entweder eine Privatperson (Anrede/Vorname/
   Nachname) oder eine Firma (firma_name). Das Schema erlaubt
   beides in derselben Tabelle, deshalb kennt dieses Modul nur
   einen Anzeigenamen und keine zwei Kundenarten.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste, anlegen, aendern, loeschen } from '../kern/crud.js';
import {
  tabelle, werkzeugleiste, formularDialog, bestaetige,
  hinweis, sicher, sucheVerdrahten, etikett, kennzahl,
} from '../kern/ui.js';

/* Reihenfolge = Reihenfolge im Auswahlfeld. Der erste Eintrag
   ist zugleich die Vorgabe für neue Kunden. */
const STATUS = [
  { wert: 'aktiv', text: 'Aktiv', art: 'gut' },
  { wert: 'interessent', text: 'Interessent', art: 'warnung' },
  { wert: 'pausiert', text: 'Pausiert', art: 'ruhig' },
  { wert: 'beendet', text: 'Beendet', art: 'schlecht' },
];

/** Firmenkunden tragen firma_name, Privatkunden Vor- und Nachnamen. */
function anzeigename(kunde) {
  const firma = (kunde.firma_name ?? '').trim();
  if (firma) return firma;
  const person = [kunde.vorname, kunde.nachname].filter(Boolean).join(' ').trim();
  return person || 'Ohne Namen';
}

function statusEtikett(wert) {
  const s = STATUS.find((x) => x.wert === wert);
  return s ? etikett(s.text, s.art) : etikett(wert ?? '—', 'ruhig');
}

/** Formularfelder – nach Themen sortiert, nicht nach Spaltenreihenfolge. */
const felder = (kostentraeger) => [
  { name: 'anrede', label: 'Anrede' },
  { name: 'vorname', label: 'Vorname' },
  { name: 'nachname', label: 'Nachname' },
  { name: 'firma_name', label: 'Firma',
    hinweis: 'Bei gewerblichen Kunden – steht dann in der Liste statt des Namens.' },

  { name: 'strasse', label: 'Straße und Hausnummer', breit: true },
  { name: 'plz', label: 'PLZ' },
  { name: 'ort', label: 'Ort' },

  { name: 'telefon', label: 'Telefon', art: 'tel' },
  { name: 'mobil', label: 'Mobil', art: 'tel' },
  { name: 'email', label: 'E-Mail', art: 'email' },
  { name: 'geburtsdatum', label: 'Geburtsdatum', art: 'date' },

  { name: 'pflegegrad', label: 'Pflegegrad', art: 'select',
    optionen: [1, 2, 3, 4, 5].map((n) => ({ wert: n, text: 'Pflegegrad ' + n })) },
  { name: 'versichertennummer', label: 'Versichertennummer' },
  { name: 'kostentraeger_id', label: 'Kostenträger', art: 'select',
    optionen: kostentraeger.map((k) => ({ wert: k.id, text: k.name })) },
  { name: 'status', label: 'Status', art: 'select', pflicht: true,
    optionen: STATUS.map(({ wert, text }) => ({ wert, text })) },

  { name: 'notiz', label: 'Notiz', art: 'textarea', zeilen: 3, breit: true },

  // schritt:'any' ist Pflicht – ohne ihn hält der Browser 52.3759 für ungültig.
  { name: 'lat', label: 'Breitengrad', art: 'number', schritt: 'any',
    hinweis: 'Für die Karte, z. B. 52.3759' },
  { name: 'lng', label: 'Längengrad', art: 'number', schritt: 'any' },
];

/** Auswahlfelder liefern immer Text – pflegegrad ist aber eine Zahl. */
const aufbereiten = (werte) => ({
  ...werte,
  pflegegrad: werte.pflegegrad ? Number(werte.pflegegrad) : null,
});

registriere({
  id: 'kunden',
  titel: 'Kunden',
  zeichen: '☺',

  async mount(el, ctx) {
    const [kunden, kostentraeger] = await Promise.all([
      liste('kunden', { firma: ctx.firma.id }),
      liste('kostentraeger', { firma: ctx.firma.id, sortieren: 'name' }),
    ]);

    // Nicht in der Datenbank sortiert: Firmenkunden haben keinen
    // Nachnamen und stünden sonst alle am Anfang.
    kunden.sort((a, b) => anzeigename(a).localeCompare(anzeigename(b), 'de'));

    const kostentraegerName = new Map(kostentraeger.map((k) => [k.id, k.name]));

    const anzahl = (wert) => kunden.filter((k) => k.status === wert).length;

    // Spalten, die nur eine der beiden Firmen füllt, bleiben weg,
    // solange nichts drinsteht.
    const spalten = [
      { kopf: 'Name', zelle: (k) => sicher(anzeigename(k)) },
      { kopf: 'Ort', zelle: (k) => sicher(k.ort ?? '—') },
      { kopf: 'Telefon', zelle: (k) => sicher(k.telefon ?? k.mobil ?? '—') },
      { kopf: 'Status', zelle: (k) => statusEtikett(k.status), breite: '1%' },
    ];
    if (kunden.some((k) => k.pflegegrad)) {
      spalten.push({
        kopf: 'Pflegegrad',
        zelle: (k) => (k.pflegegrad ? sicher('Pflegegrad ' + k.pflegegrad) : '—'),
      });
    }
    if (kostentraeger.length) {
      spalten.push({
        kopf: 'Kostenträger',
        zelle: (k) => sicher(kostentraegerName.get(k.kostentraeger_id) ?? '—'),
      });
    }

    el.innerHTML = `
      <div class="kennzahlen">
        ${kennzahl('Aktive Kunden', anzahl('aktiv'))}
        ${kennzahl('Interessenten', anzahl('interessent'), 'noch nicht in Betreuung')}
        ${kennzahl('Kunden gesamt', kunden.length, ctx.firma.name)}
      </div>
      ${werkzeugleiste({
        platzhalter: 'Name, Ort oder Telefon …',
        knopf: { id: 'neu', text: '+ Neuer Kunde' },
      })}
      ${tabelle({
        spalten,
        zeilen: kunden,
        leer: 'Noch keine Kunden angelegt.',
        aktionen: (k) => `
          <button data-bearbeiten="${sicher(k.id)}">Bearbeiten</button>
          <button class="loeschen" data-loeschen="${sicher(k.id)}">Löschen</button>`,
      })}`;

    sucheVerdrahten(el);

    /** Anlegen und Bearbeiten laufen durch dasselbe Formular. */
    async function bearbeiten(kunde) {
      const gespeichert = await formularDialog({
        titel: kunde ? 'Kunde bearbeiten' : 'Neuer Kunde',
        felder: felder(kostentraeger),
        werte: kunde ?? { status: 'aktiv' },
        aufSpeichern: async (werte) => {
          // Keines der beiden Felder kann für sich allein Pflicht sein.
          if (!werte.nachname && !werte.firma_name) {
            throw new Error('Bitte einen Nachnamen oder eine Firma angeben.');
          }
          const daten = aufbereiten(werte);
          if (kunde) await aendern('kunden', kunde.id, daten);
          else await anlegen('kunden', daten, ctx.firma.id);
        },
      });
      if (!gespeichert) return;
      hinweis(kunde ? 'Kunde gespeichert.' : 'Kunde angelegt.');
      ctx.neuLaden();
    }

    el.querySelector('#neu').onclick = () => bearbeiten(null);

    el.querySelectorAll('[data-bearbeiten]').forEach((knopf) => {
      knopf.onclick = () =>
        bearbeiten(kunden.find((k) => k.id === knopf.dataset.bearbeiten));
    });

    el.querySelectorAll('[data-loeschen]').forEach((knopf) => {
      knopf.onclick = async () => {
        const kunde = kunden.find((k) => k.id === knopf.dataset.loeschen);
        if (!kunde) return;
        const ja = await bestaetige(
          `„${anzeigename(kunde)}“ wirklich löschen? Termine, Notizen und Aufgaben `
          + 'zu diesem Kunden werden mit gelöscht.',
          { titel: 'Kunde löschen', knopfText: 'Löschen', gefahr: true },
        );
        if (!ja) return;
        try {
          await loeschen('kunden', kunde.id);
          hinweis('Kunde gelöscht.');
          ctx.neuLaden();
        } catch (fehler) {
          hinweis(fehler.message, true);
        }
      };
    });
  },
});
