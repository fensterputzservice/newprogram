/* ============================================================
   Dashboard

   Alle Zahlen stammen ausschließlich aus der gerade betretenen
   Firma. Jeder liste()-Aufruf bekommt ctx.firma.id mit – es gibt
   hier bewusst keine firmenübergreifende Auswertung.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste } from '../kern/crud.js';
import { sicher, uhrzeit, datum, euro, kennzahl, etikett } from '../kern/ui.js';

/* ---------- kleine Helfer ---------- */

/** 'YYYY-MM' des laufenden Monats, nach Ortszeit gerechnet. */
function monatsSchluessel(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Tagesgrenzen von heute – für den Vergleich mit start_at. */
function heuteGrenzen() {
  const von = new Date();
  von.setHours(0, 0, 0, 0);
  const bis = new Date(von);
  bis.setDate(bis.getDate() + 1);
  return { von, bis };
}

/** 'YYYY-MM-DD' nach Ortszeit – passt zu den date-Spalten. */
const alsTag = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const mitarbeiterName = (m) =>
  m ? `${m.vorname ?? ''} ${m.nachname ?? ''}`.trim() : '';

const kundenName = (k) =>
  !k ? '' : (k.firma_name?.trim() || `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim());

/** Karte mit Überschrift und Inhalt. */
const listenKarte = (titel, inhalt) => `
  <div class="karte">
    <div style="font-size:16px;font-weight:800;margin-bottom:12px">${sicher(titel)}</div>
    ${inhalt}
  </div>`;

const leerZeile = (text) =>
  `<div style="color:var(--muted);font-size:14px;padding:18px 0">${sicher(text)}</div>`;

/* ---------- Zeilen ---------- */

function terminZeile(t, maNach) {
  const ma = maNach.get(t.mitarbeiter_id);
  const zeit = `${uhrzeit(t.start_at)}–${uhrzeit(t.ende_at)}`;

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)">
      <div style="font-weight:700;font-size:13.5px;white-space:nowrap">${sicher(zeit)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600">${sicher(t.titel || t.kundenName || 'Termin')}</div>
        ${t.titel && t.kundenName
          ? `<div style="font-size:13px;color:var(--muted)">${sicher(t.kundenName)}</div>`
          : ''}
      </div>
      ${ma
        ? `<div style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--muted);white-space:nowrap">
             <span class="punkt" style="background:${sicher(ma.farbe ?? '#6b6480')}"></span>
             ${sicher(mitarbeiterName(ma))}
           </div>`
        : ''}
    </div>`;
}

function aufgabenZeile(a, maNach, heuteIso) {
  const ueberfaellig = a.faellig_am && a.faellig_am < heuteIso;
  const ma = maNach.get(a.zugewiesen_an);

  const unten = [
    a.faellig_am ? `fällig ${datum(a.faellig_am)}` : 'ohne Frist',
    ma ? mitarbeiterName(ma) : null,
  ].filter(Boolean).join(' · ');

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600">${sicher(a.titel)}</div>
        <div style="font-size:13px;color:var(--muted)">${sicher(unten)}</div>
      </div>
      ${ueberfaellig ? etikett('überfällig', 'schlecht') : ''}
    </div>`;
}

/* ---------- Modul ---------- */

registriere({
  id: 'dashboard',
  titel: 'Dashboard',
  zeichen: '▦',
  rollen: ['admin', 'leitung'],

  mount: async (el, ctx) => {
    const firma = ctx.firma.id;

    // Ein Ladevorgang für alles – nicht fünf nacheinander.
    const [termine, kunden, mitarbeiter, zettel, aufgaben] = await Promise.all([
      liste('termine', { firma, sortieren: 'start_at' }),
      liste('kunden', { firma }),
      liste('mitarbeiter', { firma }),
      liste('stundenzettel', { firma }),
      liste('aufgaben', { firma }),
    ]);

    const maNach = new Map(mitarbeiter.map((m) => [m.id, m]));
    const kuNach = new Map(kunden.map((k) => [k.id, k]));

    /* --- Kennzahlen --- */
    const { von, bis } = heuteGrenzen();
    const heute = termine
      .filter((t) => {
        const d = new Date(t.start_at);
        return d >= von && d < bis;
      })
      .map((t) => ({ ...t, kundenName: kundenName(kuNach.get(t.kunde_id)) }));

    const aktiveKunden = kunden.filter((k) => k.status === 'aktiv').length;
    const aktiveMitarbeiter = mitarbeiter.filter((m) => m.status === 'aktiv').length;
    const offeneZettel = zettel.filter((z) => z.status === 'offen').length;

    // "Offen" heißt hier: noch nicht erledigt – also auch 'in_arbeit'.
    const heuteIso = alsTag(von);
    const offeneAufgaben = aufgaben.filter((a) => a.status !== 'erledigt');
    const ueberfaellig = offeneAufgaben.filter(
      (a) => a.faellig_am && a.faellig_am < heuteIso
    ).length;

    const monat = monatsSchluessel();
    const umsatz = zettel
      .filter((z) => (z.datum ?? '').slice(0, 7) === monat)
      .reduce((s, z) => s + (Number(z.betrag) || 0), 0);

    /* --- Listen --- */
    const naechste = [...offeneAufgaben]
      .sort((a, b) => (a.faellig_am ?? '9999-99-99').localeCompare(b.faellig_am ?? '9999-99-99'))
      .slice(0, 6);

    el.innerHTML = `
      <div class="karte" style="margin-bottom:20px">
        <div style="font-size:13px;color:var(--muted);font-weight:600">Angemeldet in</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px">${sicher(ctx.firma.firma)}</div>
        <div style="font-size:14px;color:var(--muted);margin-top:6px">
          ${sicher(ctx.firma.strasse ?? '')} · ${sicher(ctx.firma.plz ?? '')} ${sicher(ctx.firma.ort ?? '')}
        </div>
      </div>

      <div class="kennzahlen">
        ${kennzahl('Termine heute', heute.length)}
        ${kennzahl('Aktive Kunden', aktiveKunden)}
        ${kennzahl('Aktive Mitarbeiter', aktiveMitarbeiter)}
        ${kennzahl('Offene Stundenzettel', offeneZettel)}
        ${kennzahl('Offene Aufgaben', offeneAufgaben.length,
          ueberfaellig ? `${ueberfaellig} überfällig` : '')}
        ${kennzahl('Umsatz laufender Monat', euro(umsatz))}
      </div>

      <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
        ${listenKarte('Heute',
          heute.length
            ? heute.map((t) => terminZeile(t, maNach)).join('')
            : leerZeile('Für heute steht nichts im Kalender.'))}
        ${listenKarte('Zu erledigen',
          naechste.length
            ? naechste.map((a) => aufgabenZeile(a, maNach, heuteIso)).join('')
            : leerZeile('Alles abgearbeitet – keine offenen Aufgaben.'))}
      </div>`;
  },
});
