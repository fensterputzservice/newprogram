/* ============================================================
   Kommunikation & Aufgaben

   Ein Menüpunkt, zwei Bereiche: der Schriftverkehr in der Tabelle
   "kommunikation" und die Aufgabenliste in "aufgaben". Oben wird
   umgeschaltet; neu gezeichnet wird nur der Listenbereich.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste, anlegen, aendern, loeschen } from '../kern/crud.js';
import {
  sicher, hinweis, datum, uhrzeit, tabelle, werkzeugleiste, formularDialog,
  bestaetige, inhaltsDialog, sucheVerdrahten, etikett, kennzahl,
} from '../kern/ui.js';

/* Kunden sind Privatpersonen (vorname/nachname) oder Firmen (firma_name). */
function kundenName(k) {
  if (!k) return '—';
  if (k.firma_name) return k.firma_name;
  return [k.vorname, k.nachname].filter(Boolean).join(' ') || '—';
}

const TYPEN = [
  { wert: 'notiz', text: 'Notiz' },
  { wert: 'telefon', text: 'Telefon' },
  { wert: 'email', text: 'E-Mail' },
  { wert: 'brief', text: 'Brief' },
  { wert: 'sonstiges', text: 'Sonstiges' },
];
const STATUS_KOMM = [
  { wert: 'offen', text: 'Offen' },
  { wert: 'erledigt', text: 'Erledigt' },
];
const STATUS_AUFGABE = [
  { wert: 'offen', text: 'Offen' },
  { wert: 'in_arbeit', text: 'In Arbeit' },
  { wert: 'erledigt', text: 'Erledigt' },
];
const PRIORITAETEN = [
  { wert: 'niedrig', text: 'Niedrig' },
  { wert: 'normal', text: 'Normal' },
  { wert: 'hoch', text: 'Hoch' },
];

const text = (liste_, wert) => liste_.find((o) => o.wert === wert)?.text ?? (wert ?? '—');

/* Status/Priorität als Etikett – gleiche Farblogik in beiden Listen. */
const kommStatusEtikett = (s) => etikett(text(STATUS_KOMM, s), s === 'erledigt' ? 'gut' : 'warnung');
const aufgabeStatusEtikett = (s) =>
  etikett(text(STATUS_AUFGABE, s), s === 'erledigt' ? 'gut' : s === 'offen' ? 'warnung' : '');
const prioEtikett = (p) =>
  etikett(text(PRIORITAETEN, p), p === 'hoch' ? 'schlecht' : p === 'niedrig' ? 'ruhig' : '');

/* Ein Datum ohne Uhrzeit – zum Vergleich mit faellig_am (YYYY-MM-DD). */
const heute = () => new Date().toISOString().slice(0, 10);
const istUeberfaellig = (a) => Boolean(a.faellig_am) && a.faellig_am < heute() && a.status !== 'erledigt';

registriere({
  id: 'kommunikation',
  titel: 'Kommunikation & Aufgaben',
  zeichen: '✉',

  mount: async (el, ctx) => {
    let ansicht = 'kommunikation';

    // Stammdaten einmal laden – für Auswahlfelder und Namen in der Liste.
    const [kunden, mitarbeiter] = await Promise.all([
      liste('kunden', { firma: ctx.firma.id }),
      liste('mitarbeiter', { firma: ctx.firma.id }),
    ]);

    const kundeVon = (id) => kundenName(kunden.find((k) => k.id === id));
    const mitarbeiterVon = (id) => {
      const m = mitarbeiter.find((x) => x.id === id);
      return m ? [m.vorname, m.nachname].filter(Boolean).join(' ') : '—';
    };

    const kundenOptionen = kunden
      .map((k) => ({ wert: k.id, text: kundenName(k) }))
      .sort((a, b) => a.text.localeCompare(b.text, 'de'));
    const mitarbeiterOptionen = mitarbeiter
      .map((m) => ({ wert: m.id, text: [m.vorname, m.nachname].filter(Boolean).join(' ') }))
      .sort((a, b) => a.text.localeCompare(b.text, 'de'));

    /* ---------- Rahmen: Umschaltung + Listenbereich ---------- */

    el.innerHTML = `
      <div class="werkzeuge">
        <button class="knopf" id="tab-kommunikation">Kommunikation</button>
        <button class="knopf stumm" id="tab-aufgaben">Aufgaben</button>
      </div>
      <div id="bereich"></div>`;

    const bereich = el.querySelector('#bereich');
    const tabKomm = el.querySelector('#tab-kommunikation');
    const tabAufg = el.querySelector('#tab-aufgaben');

    const wechsle = (neu) => {
      if (neu === ansicht) return;
      ansicht = neu;
      tabKomm.className = 'knopf' + (neu === 'kommunikation' ? '' : ' stumm');
      tabAufg.className = 'knopf' + (neu === 'aufgaben' ? '' : ' stumm');
      zeichne();
    };
    tabKomm.onclick = () => wechsle('kommunikation');
    tabAufg.onclick = () => wechsle('aufgaben');

    const zeichne = () =>
      ansicht === 'kommunikation' ? zeichneKommunikation() : zeichneAufgaben();

    /* ---------- Teil A: Kommunikation ---------- */

    const felderKommunikation = () => [
      // status/typ sind in der Datenbank not null – deshalb Pflichtfelder.
      { name: 'typ', label: 'Typ', art: 'select', pflicht: true, optionen: TYPEN },
      { name: 'kunde_id', label: 'Kunde', art: 'select', optionen: kundenOptionen },
      { name: 'mitarbeiter_id', label: 'Mitarbeiter', art: 'select', optionen: mitarbeiterOptionen },
      { name: 'betreff', label: 'Betreff' },
      { name: 'text', label: 'Text', art: 'textarea', zeilen: 5, breit: true },
      { name: 'status', label: 'Status', art: 'select', pflicht: true, optionen: STATUS_KOMM },
    ];

    function zeigeEintrag(z) {
      inhaltsDialog({
        titel: z.betreff || 'Eintrag',
        inhalt: `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            ${etikett(text(TYPEN, z.typ))}
            ${kommStatusEtikett(z.status)}
            ${etikett(`${datum(z.created_at)}, ${uhrzeit(z.created_at)} Uhr`, 'ruhig')}
          </div>
          <p style="margin:0 0 14px;color:var(--muted)">
            Kunde: ${sicher(kundeVon(z.kunde_id))} · Mitarbeiter: ${sicher(mitarbeiterVon(z.mitarbeiter_id))}
          </p>
          <div style="white-space:pre-wrap;line-height:1.6">${sicher(z.text ?? '—')}</div>`,
      });
    }

    async function dialogKommunikation(vorhanden) {
      const gespeichert = await formularDialog({
        titel: vorhanden ? 'Eintrag bearbeiten' : 'Neuer Eintrag',
        felder: felderKommunikation(),
        werte: vorhanden ?? { typ: 'notiz', status: 'offen' },
        aufSpeichern: async (w) => {
          if (vorhanden) await aendern('kommunikation', vorhanden.id, w);
          else await anlegen('kommunikation', w, ctx.firma.id);
        },
      });
      if (gespeichert) {
        hinweis(vorhanden ? 'Eintrag geändert.' : 'Eintrag angelegt.');
        zeichne();
      }
    }

    async function loescheKommunikation(z) {
      const ja = await bestaetige(`„${z.betreff || 'Eintrag'}“ wirklich löschen?`, {
        knopfText: 'Löschen', gefahr: true,
      });
      if (!ja) return;
      try {
        await loeschen('kommunikation', z.id);
        hinweis('Eintrag gelöscht.');
        zeichne();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    }

    async function zeichneKommunikation() {
      const eintraege = await liste('kommunikation', {
        firma: ctx.firma.id, sortieren: 'created_at', absteigend: true,
      });

      bereich.innerHTML =
        werkzeugleiste({
          platzhalter: 'Betreff, Text, Kunde …',
          knopf: { id: 'neu', text: '+ Neuer Eintrag' },
        }) +
        tabelle({
          spalten: [
            { kopf: 'Datum', breite: '110px', zelle: (z) => sicher(datum(z.created_at)) },
            { kopf: 'Typ', breite: '110px', zelle: (z) => etikett(text(TYPEN, z.typ)) },
            { kopf: 'Kunde', zelle: (z) => sicher(kundeVon(z.kunde_id)) },
            { kopf: 'Betreff', zelle: (z) => sicher(z.betreff ?? '—') },
            { kopf: 'Status', breite: '110px', zelle: (z) => kommStatusEtikett(z.status) },
          ],
          zeilen: eintraege,
          leer: 'Noch keine Einträge.',
          aktionen: (z) => `
            <button data-tun="ansehen" data-id="${sicher(z.id)}">Ansehen</button>
            <button data-tun="bearbeiten" data-id="${sicher(z.id)}">Bearbeiten</button>
            <button class="loeschen" data-tun="loeschen" data-id="${sicher(z.id)}">Löschen</button>`,
        });

      bereich.querySelector('#neu').onclick = () => dialogKommunikation(null);
      sucheVerdrahten(bereich);

      // Der volle Text steht im Dialog – die Tabelle muss ihn nicht zeigen.
      bereich.querySelectorAll('table.liste tbody tr').forEach((tr) => {
        tr.style.cursor = 'pointer';
      });
      bereich.querySelector('table.liste tbody')?.addEventListener('click', (e) => {
        const zeile = e.target.closest('tr[data-id]');
        if (!zeile) return;
        const eintrag = eintraege.find((x) => x.id === zeile.dataset.id);
        if (!eintrag) return;
        // Klick irgendwo in die Zeile zählt wie „Ansehen“.
        const tun = e.target.closest('button[data-tun]')?.dataset.tun ?? 'ansehen';
        if (tun === 'ansehen') zeigeEintrag(eintrag);
        else if (tun === 'bearbeiten') dialogKommunikation(eintrag);
        else if (tun === 'loeschen') loescheKommunikation(eintrag);
      });
    }

    /* ---------- Teil B: Aufgaben ---------- */

    const felderAufgabe = () => [
      { name: 'titel', label: 'Titel', pflicht: true, breit: true },
      { name: 'beschreibung', label: 'Beschreibung', art: 'textarea', zeilen: 4, breit: true },
      { name: 'status', label: 'Status', art: 'select', pflicht: true, optionen: STATUS_AUFGABE },
      { name: 'prioritaet', label: 'Priorität', art: 'select', pflicht: true, optionen: PRIORITAETEN },
      { name: 'faellig_am', label: 'Fällig am', art: 'date' },
      { name: 'zugewiesen_an', label: 'Zugewiesen an', art: 'select', optionen: mitarbeiterOptionen },
      { name: 'kunde_id', label: 'Kunde', art: 'select', optionen: kundenOptionen },
    ];

    async function dialogAufgabe(vorhanden) {
      const gespeichert = await formularDialog({
        titel: vorhanden ? 'Aufgabe bearbeiten' : 'Neue Aufgabe',
        felder: felderAufgabe(),
        werte: vorhanden ?? { status: 'offen', prioritaet: 'normal' },
        aufSpeichern: async (w) => {
          if (vorhanden) await aendern('aufgaben', vorhanden.id, w);
          else await anlegen('aufgaben', w, ctx.firma.id);
        },
      });
      if (gespeichert) {
        hinweis(vorhanden ? 'Aufgabe geändert.' : 'Aufgabe angelegt.');
        zeichne();
      }
    }

    async function erledige(a) {
      try {
        await aendern('aufgaben', a.id, { status: 'erledigt' });
        hinweis('Aufgabe erledigt.');
        zeichne();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    }

    async function loescheAufgabe(a) {
      const ja = await bestaetige(`„${a.titel}“ wirklich löschen?`, {
        knopfText: 'Löschen', gefahr: true,
      });
      if (!ja) return;
      try {
        await loeschen('aufgaben', a.id);
        hinweis('Aufgabe gelöscht.');
        zeichne();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    }

    async function zeichneAufgaben() {
      const aufgaben = await liste('aufgaben', { firma: ctx.firma.id, sortieren: 'faellig_am' });

      const offen = aufgaben.filter((a) => a.status !== 'erledigt');
      const ueberfaellig = offen.filter(istUeberfaellig);
      const erledigt = aufgaben.filter((a) => a.status === 'erledigt');

      bereich.innerHTML = `
        <div class="kennzahlen">
          ${kennzahl('Offene Aufgaben', offen.length, 'inkl. „In Arbeit“')}
          ${kennzahl('Davon überfällig', ueberfaellig.length, ueberfaellig.length ? 'Bitte zuerst ansehen' : 'Alles im Plan')}
          ${kennzahl('Erledigt', erledigt.length)}
        </div>` +
        werkzeugleiste({
          platzhalter: 'Titel, Kunde, Mitarbeiter …',
          knopf: { id: 'neu', text: '+ Neue Aufgabe' },
        }) +
        tabelle({
          spalten: [
            { kopf: 'Titel', zelle: (a) => sicher(a.titel ?? '—') },
            { kopf: 'Kunde', zelle: (a) => sicher(kundeVon(a.kunde_id)) },
            { kopf: 'Zugewiesen an', zelle: (a) => sicher(mitarbeiterVon(a.zugewiesen_an)) },
            {
              kopf: 'Fällig am', breite: '120px',
              // Überfällig hervorheben – das ist der Nutzen der Liste.
              zelle: (a) => (istUeberfaellig(a)
                ? etikett(datum(a.faellig_am), 'schlecht')
                : sicher(datum(a.faellig_am))),
            },
            { kopf: 'Priorität', breite: '110px', zelle: (a) => prioEtikett(a.prioritaet) },
            { kopf: 'Status', breite: '110px', zelle: (a) => aufgabeStatusEtikett(a.status) },
          ],
          zeilen: aufgaben,
          leer: 'Noch keine Aufgaben.',
          aktionen: (a) => `
            ${a.status !== 'erledigt'
              ? `<button data-tun="erledigt" data-id="${sicher(a.id)}">Erledigt</button>` : ''}
            <button data-tun="bearbeiten" data-id="${sicher(a.id)}">Bearbeiten</button>
            <button class="loeschen" data-tun="loeschen" data-id="${sicher(a.id)}">Löschen</button>`,
        });

      bereich.querySelector('#neu').onclick = () => dialogAufgabe(null);
      sucheVerdrahten(bereich);

      bereich.querySelector('table.liste tbody')?.addEventListener('click', (e) => {
        const knopf = e.target.closest('button[data-tun]');
        if (!knopf) return;
        const aufgabe = aufgaben.find((x) => x.id === knopf.dataset.id);
        if (!aufgabe) return;
        if (knopf.dataset.tun === 'erledigt') erledige(aufgabe);
        else if (knopf.dataset.tun === 'bearbeiten') dialogAufgabe(aufgabe);
        else if (knopf.dataset.tun === 'loeschen') loescheAufgabe(aufgabe);
      });
    }

    await zeichne();
  },
});
