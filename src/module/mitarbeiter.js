/* ============================================================
   Mitarbeiter · Personalakte je Firma

   Die Tabelle trägt den Stundenlohn. Laut sql/02_rls.sql sieht eine
   Mitarbeiterin deshalb nur ihre EIGENE Akte – die Löhne der
   Kolleginnen sperrt der Server, nicht dieses Modul. Die Liste hier
   ergibt also nur für die Leitung ein vollständiges Bild; darum ist
   das Modul auch nur für rollen ['admin','leitung'] registriert.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste, anlegen, aendern, loeschen } from '../kern/crud.js';
import {
  sicher, hinweis, datum, euro, stunden,
  tabelle, werkzeugleiste, formularDialog, bestaetige,
  sucheVerdrahten, etikett, kennzahl,
} from '../kern/ui.js';

const TABELLE = 'mitarbeiter';

/* Wie in 01_schema.sql: farbe ist NOT NULL DEFAULT '#2f7c88'. */
const STANDARDFARBE = '#2f7c88';

const VERTRAGSARTEN = ['Minijob', 'Midijob', 'Teilzeit', 'Vollzeit'];

const STATUS = [
  { wert: 'aktiv', text: 'aktiv', art: 'gut' },
  { wert: 'inaktiv', text: 'inaktiv', art: 'ruhig' },
  { wert: 'ausgeschieden', text: 'ausgeschieden', art: 'schlecht' },
];

const FELDER = [
  { name: 'vorname', label: 'Vorname', pflicht: true },
  { name: 'nachname', label: 'Nachname', pflicht: true },
  { name: 'email', label: 'E-Mail', art: 'email' },
  { name: 'telefon', label: 'Telefon', art: 'tel' },
  { name: 'mobil', label: 'Mobil', art: 'tel' },
  { name: 'strasse', label: 'Straße und Hausnummer', breit: true },
  { name: 'plz', label: 'PLZ' },
  { name: 'ort', label: 'Ort' },
  { name: 'geburtsdatum', label: 'Geburtsdatum', art: 'date' },
  { name: 'eintritt', label: 'Eintritt', art: 'date' },
  { name: 'austritt', label: 'Austritt', art: 'date' },
  {
    name: 'vertragsart', label: 'Vertragsart', art: 'select',
    optionen: VERTRAGSARTEN.map((v) => ({ wert: v, text: v })),
  },
  { name: 'stundenlohn', label: 'Stundenlohn (€)', art: 'number', schritt: '0.01' },
  { name: 'wochenstunden', label: 'Wochenstunden', art: 'number', schritt: '0.5' },
  { name: 'personalnummer', label: 'Personalnummer' },
  {
    name: 'farbe', label: 'Farbe', art: 'text',
    hinweis: 'Farbe im Kalender, z. B. #6d28d9',
  },
  {
    name: 'status', label: 'Status', art: 'select', pflicht: true,
    optionen: STATUS.map((s) => ({ wert: s.wert, text: s.text })),
  },
  { name: 'lat', label: 'Breitengrad', art: 'number', schritt: 'any' },
  { name: 'lng', label: 'Längengrad', art: 'number', schritt: 'any' },
];

/* ============================================================
   Helfer
   ============================================================ */

const name = (m) => `${m.vorname ?? ''} ${m.nachname ?? ''}`.trim() || 'Ohne Namen';

/**
 * Die Farbe landet in einem style-Attribut. sicher() schützt dort
 * nicht vor Anführungszeichen – deshalb nur echte Farbwerte
 * durchlassen, alles andere bekommt die Standardfarbe.
 */
function farbwert(wert) {
  const f = String(wert ?? '').trim();
  return /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/.test(f) ? f : STANDARDFARBE;
}

const statusEtikett = (wert) => {
  const s = STATUS.find((x) => x.wert === wert);
  return s ? etikett(s.text, s.art) : etikett(wert ?? '—');
};

/** Leere Farbe würde die NOT-NULL-Regel der Spalte verletzen. */
const bereinigt = (werte) => ({ ...werte, farbe: farbwert(werte.farbe) });

/* ============================================================
   Kennzahlen
   ============================================================ */

function kennzahlen(zeilen) {
  const aktive = zeilen.filter((m) => m.status === 'aktiv');

  const wochenstunden = aktive.reduce((summe, m) => summe + (Number(m.wochenstunden) || 0), 0);

  const loehne = aktive.map((m) => Number(m.stundenlohn)).filter((z) => Number.isFinite(z) && z > 0);
  const schnitt = loehne.length ? loehne.reduce((a, b) => a + b, 0) / loehne.length : null;

  return `<div class="kennzahlen">
      ${kennzahl('Aktive Mitarbeiter', aktive.length, `von ${zeilen.length} in der Akte`)}
      ${kennzahl('Wochenstunden', stunden(wochenstunden), 'Summe der aktiven Verträge')}
      ${kennzahl('Ø Stundenlohn', schnitt === null ? '—' : euro(schnitt),
        loehne.length ? `aus ${loehne.length} Verträgen` : 'keine Löhne hinterlegt')}
    </div>`;
}

/* ============================================================
   Ansicht
   ============================================================ */

function zeichne(el, zeilen) {
  const spalten = [
    {
      kopf: 'Name',
      zelle: (m) => `
        <div style="display:flex;align-items:center;gap:9px">
          <span class="punkt" style="background:${farbwert(m.farbe)}"></span>
          <div>
            <div style="font-weight:600">${sicher(name(m))}</div>
            ${m.personalnummer
              ? `<div style="font-size:12.5px;color:var(--muted)">Nr. ${sicher(m.personalnummer)}</div>`
              : ''}
          </div>
        </div>`,
    },
    {
      kopf: 'Kontakt',
      zelle: (m) => {
        const ruf = m.telefon || m.mobil;
        return `
          <div>${ruf ? sicher(ruf) : '—'}</div>
          ${m.email ? `<div style="font-size:12.5px;color:var(--muted)">${sicher(m.email)}</div>` : ''}`;
      },
    },
    { kopf: 'Vertragsart', zelle: (m) => sicher(m.vertragsart ?? '—') },
    { kopf: 'Wochenstunden', zelle: (m) => stunden(m.wochenstunden) },
    { kopf: 'Status', zelle: (m) => statusEtikett(m.status) },
  ];

  const aktionen = (m) => `
    <button data-bearbeiten="${sicher(m.id)}">Bearbeiten</button>
    <button class="loeschen" data-loeschen="${sicher(m.id)}">Löschen</button>`;

  el.innerHTML = `
    ${kennzahlen(zeilen)}
    ${werkzeugleiste({
      platzhalter: 'Name, Ort, Vertragsart …',
      knopf: { id: 'ma-neu', text: '+ Mitarbeiter' },
    })}
    ${tabelle({ spalten, zeilen, leer: 'Noch keine Mitarbeiter angelegt.', aktionen })}`;
}

/* ============================================================
   Modul
   ============================================================ */

registriere({
  id: 'mitarbeiter',
  titel: 'Mitarbeiter',
  zeichen: '⚇',
  rollen: ['admin', 'leitung'],

  mount: async (el, ctx) => {
    const zeilen = await liste(TABELLE, { firma: ctx.firma.id, sortieren: 'nachname' });
    zeichne(el, zeilen);
    sucheVerdrahten(el);

    const finde = (id) => zeilen.find((m) => m.id === id);

    el.querySelector('#ma-neu').onclick = async () => {
      const ok = await formularDialog({
        titel: 'Neuer Mitarbeiter',
        felder: FELDER,
        werte: { farbe: STANDARDFARBE, status: 'aktiv' },
        // firma_id setzt crud.js – deshalb hier nur die Fachdaten.
        aufSpeichern: (werte) => anlegen(TABELLE, bereinigt(werte), ctx.firma.id),
      });
      if (ok) { hinweis('Mitarbeiter angelegt.'); ctx.neuLaden(); }
    };

    el.querySelectorAll('[data-bearbeiten]').forEach((knopf) => {
      knopf.onclick = async () => {
        const m = finde(knopf.dataset.bearbeiten);
        if (!m) return;
        const ok = await formularDialog({
          titel: name(m),
          felder: FELDER,
          werte: m,
          aufSpeichern: (werte) => aendern(TABELLE, m.id, bereinigt(werte)),
        });
        if (ok) { hinweis('Änderungen gespeichert.'); ctx.neuLaden(); }
      };
    });

    // Löschen bleibt laut 02_rls.sql dem Admin vorbehalten; die
    // Leitung bekommt hier eine klare Meldung vom Server.
    el.querySelectorAll('[data-loeschen]').forEach((knopf) => {
      knopf.onclick = async () => {
        const m = finde(knopf.dataset.loeschen);
        if (!m) return;
        const seit = m.eintritt ? ` (im Betrieb seit ${datum(m.eintritt)})` : '';
        const ja = await bestaetige(
          `Personalakte von ${name(m)}${seit} endgültig löschen?`,
          { titel: 'Mitarbeiter löschen', knopfText: 'Löschen', gefahr: true },
        );
        if (!ja) return;
        try {
          await loeschen(TABELLE, m.id);
          hinweis(`${name(m)} gelöscht.`);
          ctx.neuLaden();
        } catch (fehler) {
          hinweis(fehler.message, true);
        }
      };
    });
  },
});
