/* ============================================================
   Stundenzettel & Abtretungserklärung

   Ein Menüpunkt, zwei Bereiche: die erfassten Arbeitszeiten und
   die Abtretungserklärungen der Kunden. Umgeschaltet wird oben.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste, anlegen, aendern, loeschen } from '../kern/crud.js';
import {
  sicher, hinweis, datum, euro, stunden,
  tabelle, werkzeugleiste, formularDialog, bestaetige,
  sucheVerdrahten, etikett, kennzahl,
} from '../kern/ui.js';

/* ---------- Kleine Helfer ---------- */

/** Kunden sind Privatpersonen oder Firmen. */
const kundenName = (k) =>
  !k ? '—'
    : (k.firma_name?.trim() || [k.vorname, k.nachname].filter(Boolean).join(' ') || '—');

const mitarbeiterName = (m) =>
  !m ? '—' : ([m.vorname, m.nachname].filter(Boolean).join(' ') || '—');

/** Postgres liefert '09:00:00', das Zeitfeld will '09:00'. */
const kurzzeit = (t) => (t ? String(t).slice(0, 5) : '');

const zeitspanne = (beginn, ende) =>
  beginn || ende ? `${kurzzeit(beginn) || '—'}–${kurzzeit(ende) || '—'}` : '—';

/** Ortszeit, nicht UTC – sonst springt der Tag am Abend. */
const heute = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dieserMonat = () => heute().slice(0, 7);

const monatLabel = (m) => {
  const d = new Date(`${m}-01T12:00:00`);
  return Number.isNaN(d.getTime())
    ? m
    : d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
};

const zahl = (w) => (Number.isFinite(Number(w)) ? Number(w) : 0);
const geld = (w) => (w === null || w === undefined || w === '' ? '—' : euro(w));
const stundenzahl = (w) => (w === null || w === undefined || w === '' ? '—' : stunden(w));
const runde = (w) => Math.round(w * 100) / 100;

/** Minuten seit Mitternacht, oder null bei unbrauchbarer Eingabe. */
function minuten(zeit) {
  const teile = String(zeit ?? '').split(':');
  if (teile.length < 2) return null;
  const h = Number(teile[0]);
  const m = Number(teile[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

const SZ_ETIKETT = { offen: 'warnung', freigegeben: 'gut', abgerechnet: 'ruhig' };
const AB_ETIKETT = { offen: 'warnung', unterschrieben: 'gut', eingereicht: 'ruhig' };

registriere({
  id: 'stundenzettel',
  titel: 'Stundenzettel & Abtretung',
  zeichen: '⏱',

  mount: async (el, ctx) => {
    const firma = ctx.firma.id;
    // Freigeben ist Leitungssache – siehe sql/02_rls.sql (sz_update_leitung).
    const darfFreigeben = ctx.rolle === 'admin' || ctx.rolle === 'leitung';

    const [mitarbeiter, kunden, kostentraeger, zettel, abtretungen] = await Promise.all([
      liste('mitarbeiter', { firma, sortieren: 'nachname' }),
      liste('kunden', { firma, sortieren: 'nachname' }),
      liste('kostentraeger', { firma, sortieren: 'name' }),
      liste('stundenzettel', { firma, sortieren: 'datum', absteigend: true }),
      liste('abtretungen', { firma, sortieren: 'monat', absteigend: true }),
    ]);

    const maNach = new Map(mitarbeiter.map((m) => [m.id, m]));
    const kuNach = new Map(kunden.map((k) => [k.id, k]));
    const ktNach = new Map(kostentraeger.map((k) => [k.id, k]));

    const maWahl = mitarbeiter.map((m) => ({ wert: m.id, text: mitarbeiterName(m) }));
    const kuWahl = kunden.map((k) => ({ wert: k.id, text: kundenName(k) }));
    const ktWahl = kostentraeger.map((k) => ({ wert: k.id, text: k.name }));

    // Die gewählte Ansicht lebt hier, nicht im DOM: Umschalten zeichnet
    // nur den Listenbereich neu und lädt keine Daten nach.
    let ansicht = 'stundenzettel';

    el.innerHTML = `
      <div class="werkzeuge">
        <button class="knopf" id="tab-zettel">Stundenzettel</button>
        <button class="knopf stumm" id="tab-abtretung">Abtretungserklärungen</button>
      </div>
      <div id="bereich"></div>`;

    const bereich = el.querySelector('#bereich');
    const tabZettel = el.querySelector('#tab-zettel');
    const tabAbtretung = el.querySelector('#tab-abtretung');

    tabZettel.onclick = () => umschalten('stundenzettel');
    tabAbtretung.onclick = () => umschalten('abtretungen');

    function umschalten(neu) {
      if (ansicht === neu) return;
      ansicht = neu;
      zeichne();
    }

    function zeichne() {
      const zettelAktiv = ansicht === 'stundenzettel';
      tabZettel.className = zettelAktiv ? 'knopf' : 'knopf stumm';
      tabAbtretung.className = zettelAktiv ? 'knopf stumm' : 'knopf';
      bereich.innerHTML = zettelAktiv ? zettelAnsicht() : abtretungAnsicht();
      sucheVerdrahten(bereich);
      if (zettelAktiv) zettelVerdrahten();
      else abtretungVerdrahten();
    }

    /* ========================================================
       Teil 1 · Stundenzettel
       ======================================================== */

    function zettelAnsicht() {
      const monat = dieserMonat();
      const imMonat = zettel.filter((z) => String(z.datum ?? '').startsWith(monat));
      const offen = zettel.filter((z) => z.status === 'offen').length;
      const summeStunden = imMonat.reduce((s, z) => s + zahl(z.stunden), 0);
      const summeBetrag = imMonat.reduce((s, z) => s + zahl(z.betrag), 0);

      return `
        <div class="kennzahlen">
          ${kennzahl('Offene Stundenzettel', offen, 'noch nicht freigegeben')}
          ${kennzahl('Stunden diesen Monat', stunden(summeStunden), monatLabel(monat))}
          ${kennzahl('Betrag diesen Monat', euro(summeBetrag), monatLabel(monat))}
        </div>
        ${werkzeugleiste({
          platzhalter: 'Stundenzettel durchsuchen …',
          knopf: { id: 'neu', text: '+ Neuer Stundenzettel' },
        })}
        ${tabelle({
          zeilen: zettel,
          leer: 'Noch keine Stundenzettel erfasst.',
          spalten: [
            { kopf: 'Datum', breite: '110px', zelle: (z) => sicher(datum(z.datum)) },
            { kopf: 'Mitarbeiter', zelle: (z) => sicher(mitarbeiterName(maNach.get(z.mitarbeiter_id))) },
            { kopf: 'Kunde', zelle: (z) => sicher(kundenName(kuNach.get(z.kunde_id))) },
            { kopf: 'Zeit', breite: '120px', zelle: (z) => sicher(zeitspanne(z.beginn, z.ende)) },
            { kopf: 'Stunden', breite: '90px', zelle: (z) => sicher(stundenzahl(z.stunden)) },
            { kopf: 'Betrag', breite: '110px', zelle: (z) => sicher(geld(z.betrag)) },
            { kopf: 'Status', breite: '120px', zelle: (z) => etikett(z.status ?? 'offen', SZ_ETIKETT[z.status] ?? '') },
          ],
          aktionen: (z) => [
            z.status === 'offen' && darfFreigeben
              ? `<button data-tun="freigeben" data-id="${sicher(z.id)}">Freigeben</button>` : '',
            `<button data-tun="bearbeiten" data-id="${sicher(z.id)}">Bearbeiten</button>`,
            `<button class="loeschen" data-tun="loeschen" data-id="${sicher(z.id)}">Löschen</button>`,
          ].join(''),
        })}`;
    }

    function zettelVerdrahten() {
      bereich.querySelector('#neu').onclick = () => zettelDialog(null);
      bereich.querySelectorAll('[data-tun]').forEach((knopf) => {
        knopf.onclick = () => {
          const zeile = zettel.find((z) => z.id === knopf.dataset.id);
          if (!zeile) return;
          if (knopf.dataset.tun === 'freigeben') zettelFreigeben(zeile);
          if (knopf.dataset.tun === 'bearbeiten') zettelDialog(zeile);
          if (knopf.dataset.tun === 'loeschen') zettelLoeschen(zeile);
        };
      });
    }

    const zettelFelder = () => [
      { name: 'mitarbeiter_id', label: 'Mitarbeiter', art: 'select', pflicht: true, optionen: maWahl },
      { name: 'kunde_id', label: 'Kunde', art: 'select', optionen: kuWahl },
      { name: 'datum', label: 'Datum', art: 'date', pflicht: true },
      { name: 'beginn', label: 'Beginn', art: 'time' },
      { name: 'ende', label: 'Ende', art: 'time' },
      { name: 'stunden', label: 'Stunden', art: 'number', schritt: '0.25',
        hinweis: 'Leer lassen: wird aus Beginn und Ende gerechnet.' },
      { name: 'preis_pro_stunde', label: 'Preis pro Stunde', art: 'number', schritt: '0.01' },
      { name: 'betrag', label: 'Betrag', art: 'number', schritt: '0.01',
        hinweis: 'Leer lassen: Stunden × Preis pro Stunde.' },
      { name: 'notiz', label: 'Notiz', art: 'textarea', breit: true },
    ];

    /** Was der Nutzer weglässt, rechnen wir aus – und prüfen die Zeiten. */
    function zettelWerte(werte) {
      const daten = { ...werte };

      if (daten.beginn && daten.ende) {
        const von = minuten(daten.beginn);
        const bis = minuten(daten.ende);
        if (von === null || bis === null) {
          throw new Error('Beginn und Ende bitte als Uhrzeit angeben, zum Beispiel 09:00.');
        }
        if (bis <= von) {
          throw new Error('Das Ende liegt vor dem Beginn. Einsätze über Mitternacht gibt es hier nicht – bitte die Uhrzeiten prüfen.');
        }
        if (daten.stunden === null || daten.stunden === undefined) {
          daten.stunden = runde((bis - von) / 60);
        }
      }

      if ((daten.betrag === null || daten.betrag === undefined)
        && daten.stunden !== null && daten.stunden !== undefined
        && daten.preis_pro_stunde !== null && daten.preis_pro_stunde !== undefined) {
        daten.betrag = runde(daten.stunden * daten.preis_pro_stunde);
      }

      // stunden ist in der Datenbank pflicht (not null default 0).
      if (daten.stunden === null || daten.stunden === undefined) daten.stunden = 0;

      return daten;
    }

    async function zettelDialog(zeile) {
      const gespeichert = await formularDialog({
        titel: zeile ? 'Stundenzettel bearbeiten' : 'Neuer Stundenzettel',
        felder: zettelFelder(),
        werte: zeile
          ? { ...zeile, beginn: kurzzeit(zeile.beginn), ende: kurzzeit(zeile.ende) }
          : { datum: heute() },
        aufSpeichern: async (werte) => {
          const daten = zettelWerte(werte);
          if (zeile) await aendern('stundenzettel', zeile.id, daten);
          else await anlegen('stundenzettel', daten, firma);
        },
      });
      if (gespeichert) {
        hinweis(zeile ? 'Stundenzettel geändert.' : 'Stundenzettel angelegt.');
        ctx.neuLaden();
      }
    }

    /**
     * Freigeben.
     * Laut sql/02_rls.sql kann eine Mitarbeiterin ihren Stundenzettel nur
     * ändern, solange er 'offen' ist – die Freigabe sperrt ihn serverseitig.
     * Deshalb ist die Rückfrage wichtig: Danach kommt nur noch die Leitung
     * an den Eintrag.
     */
    async function zettelFreigeben(zeile) {
      const wer = mitarbeiterName(maNach.get(zeile.mitarbeiter_id));
      const ja = await bestaetige(
        `Stundenzettel vom ${datum(zeile.datum)} (${wer}) freigeben? Danach kann nur noch die Leitung ihn ändern.`,
        { titel: 'Stundenzettel freigeben', knopfText: 'Freigeben' },
      );
      if (!ja) return;
      try {
        await aendern('stundenzettel', zeile.id, {
          status: 'freigegeben',
          freigegeben_am: new Date().toISOString(),
        });
        hinweis('Stundenzettel freigegeben.');
        ctx.neuLaden();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    }

    async function zettelLoeschen(zeile) {
      const ja = await bestaetige(
        `Stundenzettel vom ${datum(zeile.datum)} wirklich löschen?`,
        { titel: 'Löschen', knopfText: 'Löschen', gefahr: true },
      );
      if (!ja) return;
      try {
        await loeschen('stundenzettel', zeile.id);
        hinweis('Stundenzettel gelöscht.');
        ctx.neuLaden();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    }

    /* ========================================================
       Teil 2 · Abtretungserklärungen
       ======================================================== */

    function abtretungAnsicht() {
      return `
        ${werkzeugleiste({
          platzhalter: 'Abtretungen durchsuchen …',
          knopf: { id: 'neu', text: '+ Neue Abtretung' },
        })}
        ${tabelle({
          zeilen: abtretungen,
          leer: 'Noch keine Abtretungserklärungen erfasst.',
          spalten: [
            { kopf: 'Kunde', zelle: (a) => sicher(kundenName(kuNach.get(a.kunde_id))) },
            { kopf: 'Monat', breite: '150px', zelle: (a) => sicher(a.monat ? monatLabel(a.monat) : '—') },
            { kopf: 'Kostenträger', zelle: (a) => sicher(ktNach.get(a.kostentraeger_id)?.name ?? '—') },
            { kopf: 'Betrag', breite: '110px', zelle: (a) => sicher(geld(a.betrag)) },
            { kopf: 'Status', breite: '130px', zelle: (a) => etikett(a.status ?? 'offen', AB_ETIKETT[a.status] ?? '') },
            { kopf: 'Unterschrieben am', breite: '150px', zelle: (a) => sicher(a.unterschrift_am ? datum(a.unterschrift_am) : '—') },
          ],
          aktionen: (a) => `
            <button data-tun="bearbeiten" data-id="${sicher(a.id)}">Bearbeiten</button>
            <button class="loeschen" data-tun="loeschen" data-id="${sicher(a.id)}">Löschen</button>`,
        })}`;
    }

    function abtretungVerdrahten() {
      bereich.querySelector('#neu').onclick = () => abtretungDialog(null);
      bereich.querySelectorAll('[data-tun]').forEach((knopf) => {
        knopf.onclick = () => {
          const zeile = abtretungen.find((a) => a.id === knopf.dataset.id);
          if (!zeile) return;
          if (knopf.dataset.tun === 'bearbeiten') abtretungDialog(zeile);
          if (knopf.dataset.tun === 'loeschen') abtretungLoeschen(zeile);
        };
      });
    }

    const abtretungFelder = () => [
      { name: 'kunde_id', label: 'Kunde', art: 'select', pflicht: true, optionen: kuWahl },
      { name: 'kostentraeger_id', label: 'Kostenträger', art: 'select', optionen: ktWahl },
      { name: 'monat', label: 'Monat', art: 'text', hinweis: 'Format JJJJ-MM, z. B. 2026-07' },
      { name: 'betrag', label: 'Betrag', art: 'number', schritt: '0.01' },
      { name: 'unterschrift_am', label: 'Unterschrieben am', art: 'date' },
      { name: 'status', label: 'Status', art: 'select', pflicht: true, optionen: [
        { wert: 'offen', text: 'Offen' },
        { wert: 'unterschrieben', text: 'Unterschrieben' },
        { wert: 'eingereicht', text: 'Eingereicht' },
      ] },
    ];

    async function abtretungDialog(zeile) {
      const gespeichert = await formularDialog({
        titel: zeile ? 'Abtretung bearbeiten' : 'Neue Abtretungserklärung',
        felder: abtretungFelder(),
        werte: zeile ?? { monat: dieserMonat(), status: 'offen' },
        aufSpeichern: async (werte) => {
          if (werte.monat && !/^\d{4}-(0[1-9]|1[0-2])$/.test(werte.monat)) {
            throw new Error('Der Monat muss im Format JJJJ-MM stehen, zum Beispiel 2026-07.');
          }
          if (zeile) await aendern('abtretungen', zeile.id, werte);
          else await anlegen('abtretungen', werte, firma);
        },
      });
      if (gespeichert) {
        hinweis(zeile ? 'Abtretung geändert.' : 'Abtretung angelegt.');
        ctx.neuLaden();
      }
    }

    async function abtretungLoeschen(zeile) {
      const wer = kundenName(kuNach.get(zeile.kunde_id));
      const ja = await bestaetige(
        `Abtretungserklärung von ${wer} wirklich löschen?`,
        { titel: 'Löschen', knopfText: 'Löschen', gefahr: true },
      );
      if (!ja) return;
      try {
        await loeschen('abtretungen', zeile.id);
        hinweis('Abtretung gelöscht.');
        ctx.neuLaden();
      } catch (fehler) {
        hinweis(fehler.message, true);
      }
    }

    zeichne();
  },
});
