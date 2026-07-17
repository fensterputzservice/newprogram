/* ============================================================
   Notizen

   Es gibt keine Tabelle "notizen". Eine Notiz ist eine Zeile in
   "kommunikation" mit typ='notiz' – dieser Bereich ist also nur
   eine gefilterte Sicht auf dieselben Daten, die unter
   „Kommunikation & Aufgaben“ vollständig zu sehen sind.
   Deshalb wird typ hier fest gesetzt und nicht zur Auswahl gestellt.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste, anlegen, aendern, loeschen } from '../kern/crud.js';
import {
  sicher, hinweis, datum, uhrzeit, tabelle, werkzeugleiste, formularDialog,
  bestaetige, inhaltsDialog, sucheVerdrahten, etikett,
} from '../kern/ui.js';

/* Kunden sind Privatpersonen (vorname/nachname) oder Firmen (firma_name). */
function kundenName(k) {
  if (!k) return '—';
  if (k.firma_name) return k.firma_name;
  return [k.vorname, k.nachname].filter(Boolean).join(' ') || '—';
}

const STATUS = [
  { wert: 'offen', text: 'Offen' },
  { wert: 'erledigt', text: 'Erledigt' },
];
const statusText = (s) => STATUS.find((o) => o.wert === s)?.text ?? (s ?? '—');
const statusEtikett = (s) => etikett(statusText(s), s === 'erledigt' ? 'gut' : 'warnung');

/* Erste Zeile des Textes für die Tabelle – der Rest steht im Dialog. */
function auszug(t, laenge = 80) {
  const s = (t ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '—';
  return s.length > laenge ? s.slice(0, laenge).trimEnd() + ' …' : s;
}

registriere({
  id: 'notizen',
  titel: 'Notizen',
  zeichen: '✎',

  mount: async (el, ctx) => {
    const kunden = await liste('kunden', { firma: ctx.firma.id });

    const kundeVon = (id) => kundenName(kunden.find((k) => k.id === id));
    const kundenOptionen = kunden
      .map((k) => ({ wert: k.id, text: kundenName(k) }))
      .sort((a, b) => a.text.localeCompare(b.text, 'de'));

    const felder = () => [
      { name: 'betreff', label: 'Betreff' },
      { name: 'text', label: 'Notiz', art: 'textarea', zeilen: 6, breit: true },
      { name: 'kunde_id', label: 'Kunde', art: 'select', optionen: kundenOptionen },
      // status ist in der Datenbank not null – deshalb Pflichtfeld.
      { name: 'status', label: 'Status', art: 'select', pflicht: true, optionen: STATUS },
    ];

    function zeigeNotiz(n) {
      inhaltsDialog({
        titel: n.betreff || 'Notiz',
        inhalt: `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            ${statusEtikett(n.status)}
            ${etikett(`${datum(n.created_at)}, ${uhrzeit(n.created_at)} Uhr`, 'ruhig')}
          </div>
          <p style="margin:0 0 14px;color:var(--muted)">Kunde: ${sicher(kundeVon(n.kunde_id))}</p>
          <div style="white-space:pre-wrap;line-height:1.6">${sicher(n.text ?? '—')}</div>`,
      });
    }

    async function dialogNotiz(vorhanden) {
      const gespeichert = await formularDialog({
        titel: vorhanden ? 'Notiz bearbeiten' : 'Neue Notiz',
        felder: felder(),
        werte: vorhanden ?? { status: 'offen' },
        aufSpeichern: async (w) => {
          if (vorhanden) await aendern('kommunikation', vorhanden.id, w);
          // typ fest: sonst taucht der Eintrag hier nicht wieder auf.
          else await anlegen('kommunikation', { ...w, typ: 'notiz' }, ctx.firma.id);
        },
      });
      if (gespeichert) {
        hinweis(vorhanden ? 'Notiz geändert.' : 'Notiz angelegt.');
        zeichne();
      }
    }

    async function loescheNotiz(n) {
      const ja = await bestaetige(`„${n.betreff || 'Notiz'}“ wirklich löschen?`, {
        knopfText: 'Löschen', gefahr: true,
      });
      if (!ja) return;
      try {
        await loeschen('kommunikation', n.id);
        hinweis('Notiz gelöscht.');
        zeichne();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    }

    async function zeichne() {
      const notizen = await liste('kommunikation', {
        firma: ctx.firma.id, wo: { typ: 'notiz' }, sortieren: 'created_at', absteigend: true,
      });

      el.innerHTML =
        werkzeugleiste({
          platzhalter: 'Betreff, Text, Kunde …',
          knopf: { id: 'neu', text: '+ Neue Notiz' },
        }) +
        tabelle({
          spalten: [
            { kopf: 'Datum', breite: '110px', zelle: (n) => sicher(datum(n.created_at)) },
            { kopf: 'Kunde', zelle: (n) => sicher(kundeVon(n.kunde_id)) },
            { kopf: 'Betreff', zelle: (n) => sicher(n.betreff ?? '—') },
            { kopf: 'Notiz', zelle: (n) => sicher(auszug(n.text)) },
            { kopf: 'Status', breite: '110px', zelle: (n) => statusEtikett(n.status) },
          ],
          zeilen: notizen,
          leer: 'Noch keine Notizen.',
          aktionen: (n) => `
            <button data-tun="ansehen" data-id="${sicher(n.id)}">Ansehen</button>
            <button data-tun="bearbeiten" data-id="${sicher(n.id)}">Bearbeiten</button>
            <button class="loeschen" data-tun="loeschen" data-id="${sicher(n.id)}">Löschen</button>`,
        });

      el.querySelector('#neu').onclick = () => dialogNotiz(null);
      sucheVerdrahten(el);

      el.querySelectorAll('table.liste tbody tr').forEach((tr) => {
        tr.style.cursor = 'pointer';
      });
      el.querySelector('table.liste tbody')?.addEventListener('click', (e) => {
        const zeile = e.target.closest('tr[data-id]');
        if (!zeile) return;
        const notiz = notizen.find((x) => x.id === zeile.dataset.id);
        if (!notiz) return;
        // Klick irgendwo in die Zeile zählt wie „Ansehen“.
        const tun = e.target.closest('button[data-tun]')?.dataset.tun ?? 'ansehen';
        if (tun === 'ansehen') zeigeNotiz(notiz);
        else if (tun === 'bearbeiten') dialogNotiz(notiz);
        else if (tun === 'loeschen') loescheNotiz(notiz);
      });
    }

    await zeichne();
  },
});
