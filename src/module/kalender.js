/* ============================================================
   Kalender – Apple-Optik

   Links die Mitarbeiter zum An- und Abhaken (Mehrfachauswahl),
   rechts ein Stundenraster. Umschaltbar zwischen Monat, Woche
   und Tag. Alle ausgewählten Mitarbeiter liegen übereinander,
   jeder in seiner Farbe.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste, anlegen, aendern, loeschen } from '../kern/crud.js';
import {
  sicher, hinweis, datum, uhrzeit, formularDialog, bestaetige, etikett,
} from '../kern/ui.js';

const WTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STATUS = [
  { wert: 'geplant', text: 'Geplant' },
  { wert: 'bestaetigt', text: 'Bestätigt' },
  { wert: 'erledigt', text: 'Erledigt' },
  { wert: 'abgesagt', text: 'Abgesagt' },
];
const STATUS_TEXT = Object.fromEntries(STATUS.map((s) => [s.wert, s.text]));
const STATUS_ART = { geplant: '', bestaetigt: 'gut', erledigt: 'ruhig', abgesagt: 'schlecht' };

/* Termine ohne bekannten Mitarbeiter bekommen einen eigenen Eintrag,
   sonst wären sie unsichtbar und unerreichbar. */
const OHNE = '__ohne__';
const STANDARDFARBE = '#2f7c88';   // wie in sql/01_schema.sql

/* Höhe einer Stunde im Raster. Bestimmt, wie hoch Termine wirken. */
const STD = 48;
const RASTER_VON_STD = 7;   // Standard-Startstunde des sichtbaren Rasters
const RASTER_BIS_STD = 21;  // Standard-Endstunde

/* ============================================================
   Datum & Zeit
   ============================================================ */

const zwei = (n) => String(n).padStart(2, '0');

function mitternacht(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const plusTage = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const plusMonate = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

/** Montag der Woche, in der d liegt. */
function montagVon(d) {
  const m = mitternacht(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));   // So=0 → 6, Mo=1 → 0
  return m;
}

const gleicherTag = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Minuten seit Tagesbeginn, geklemmt auf 0…1440. */
function minutenImTag(iso, bezug) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Termine, die vor dem Bezugstag beginnen, ab 0 zeigen.
  if (d < mitternacht(bezug)) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

/** "14.–20. Juli 2026" · "29. Juni – 5. Juli 2026" · Jahreswechsel beide Jahre. */
function wochenText(von, bis) {
  const lang = { day: 'numeric', month: 'long', year: 'numeric' };
  if (von.getFullYear() !== bis.getFullYear()) {
    return `${von.toLocaleDateString('de-DE', lang)} – ${bis.toLocaleDateString('de-DE', lang)}`;
  }
  if (von.getMonth() !== bis.getMonth()) {
    return `${von.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} – ${bis.toLocaleDateString('de-DE', lang)}`;
  }
  return `${von.getDate()}.–${bis.toLocaleDateString('de-DE', lang)}`;
}

/** Date/ISO → 'YYYY-MM-DDTHH:mm' für <input type="datetime-local">, Ortszeit. */
function alsFeldZeit(wert) {
  const d = wert instanceof Date ? wert : new Date(wert);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

function zeitAus(wert, name) {
  const d = wert ? new Date(wert) : null;
  if (!d || Number.isNaN(d.getTime())) throw new Error(`Bitte ${name} mit Datum und Uhrzeit angeben.`);
  return d;
}

/** Farben landen in style-Attributen – deshalb streng prüfen. */
const farbeVon = (ma) => (/^#[0-9a-fA-F]{6}$/.test(ma?.farbe ?? '') ? ma.farbe : STANDARDFARBE);
const farbeWeich = (hex) => hex + '26';

const kundenname = (k) =>
  !k ? '' : (k.firma_name?.trim() || [k.vorname, k.nachname].filter(Boolean).join(' ').trim());
const mitarbeitername = (m) => (m ? [m.vorname, m.nachname].filter(Boolean).join(' ').trim() : 'Ohne Zuordnung');

/* ============================================================
   Überlappung: nebeneinanderliegende Termine aufteilen
   ============================================================ */

/**
 * Weist Terminen desselben Tages Spalten zu, damit sie sich nicht
 * verdecken. Gibt je Termin { spur, spalten } – daraus folgen
 * Breite und Position im Tag.
 */
function verteile(items) {
  const sortiert = [...items].sort((a, b) => a.von - b.von || a.bis - b.bis);
  const ergebnis = [];
  let gruppe = [], gruppeEnde = -1;

  const abschluss = (g) => {
    const spuren = [];   // je Spur das bisher letzte Ende
    for (const it of g) {
      let s = spuren.findIndex((ende) => ende <= it.von);
      if (s < 0) { s = spuren.length; spuren.push(it.bis); } else spuren[s] = it.bis;
      it.spur = s;
    }
    for (const it of g) { it.spalten = spuren.length; ergebnis.push(it); }
  };

  for (const it of sortiert) {
    if (gruppe.length && it.von >= gruppeEnde) { abschluss(gruppe); gruppe = []; gruppeEnde = -1; }
    gruppe.push(it);
    gruppeEnde = Math.max(gruppeEnde, it.bis);
  }
  if (gruppe.length) abschluss(gruppe);
  return ergebnis;
}

/* ============================================================
   Modul
   ============================================================ */

registriere({
  id: 'kalender',
  titel: 'Kalender',
  zeichen: '▤',

  mount: async (el, ctx) => {
    const [mitarbeiter, kunden, leistungen, termineGeladen] = await Promise.all([
      liste('mitarbeiter', { firma: ctx.firma.id, sortieren: 'nachname' }),
      liste('kunden', { firma: ctx.firma.id, sortieren: 'nachname' }),
      liste('leistungen', { firma: ctx.firma.id, sortieren: 'name' }),
      liste('termine', { firma: ctx.firma.id, sortieren: 'start_at' }),
    ]);
    // Termine sind veränderlich – nach Anlegen/Löschen nur sie neu laden,
    // damit Ansicht und Datum erhalten bleiben (kein ctx.neuLaden()).
    let termine = termineGeladen;
    async function aktualisiere() {
      termine = await liste('termine', { firma: ctx.firma.id, sortieren: 'start_at' });
      zeichne();
    }

    const maNach = new Map(mitarbeiter.map((m) => [m.id, m]));
    const kundeNach = new Map(kunden.map((k) => [k.id, k]));
    const chipVon = (t) => (maNach.has(t.mitarbeiter_id) ? t.mitarbeiter_id : OHNE);
    const farbeTermin = (t) => farbeVon(maNach.get(t.mitarbeiter_id));

    const eintraege = mitarbeiter.map((m) => ({ id: m.id, name: mitarbeitername(m), farbe: farbeVon(m) }));
    if (termine.some((t) => !maNach.has(t.mitarbeiter_id))) {
      eintraege.push({ id: OHNE, name: 'Ohne Zuordnung', farbe: STANDARDFARBE });
    }

    /* ---------- Zustand. Lebt nur hier, damit Klicks nichts neu laden. ---------- */
    let ansicht = 'woche';                 // 'monat' | 'woche' | 'tag'
    let anker = mitternacht(new Date());   // Bezugstag
    const ausgewaehlt = new Set(eintraege.map((c) => c.id));

    /* ---------- Gerüst ---------- */
    el.innerHTML = `
      <div class="kal-layout">
        <aside class="kal-seite">
          <div class="kal-seite-kopf">
            <span class="kal-seite-titel">Mitarbeiter</span>
            <span style="display:flex;gap:2px">
              <button class="kal-seite-aktion" id="kal-alle">Alle</button>
              <button class="kal-seite-aktion" id="kal-keine">Keine</button>
            </span>
          </div>
          <div class="kal-ma-liste" id="kal-liste"></div>
        </aside>

        <div class="kal-main">
          <div class="kal-kopf">
            <h2 class="kal-titel" id="kal-titel"></h2>
            <div class="kal-nav">
              <button id="kal-zurueck" title="Zurück">‹</button>
              <button id="kal-heute">Heute</button>
              <button id="kal-vor" title="Vor">›</button>
            </div>
            <div class="kal-umschalter" id="kal-umschalter">
              <button data-ansicht="monat">Monat</button>
              <button data-ansicht="woche">Woche</button>
              <button data-ansicht="tag">Tag</button>
            </div>
            <button class="knopf" id="kal-neu">+ Termin</button>
          </div>
          <div id="kal-flaeche"></div>
        </div>
      </div>`;

    const listeEl = el.querySelector('#kal-liste');
    const titelEl = el.querySelector('#kal-titel');
    const flaecheEl = el.querySelector('#kal-flaeche');

    /* ============================================================
       Welche Termine sind gerade im Blick?
       ============================================================ */
    function zeitfenster() {
      if (ansicht === 'tag') return [mitternacht(anker), plusTage(anker, 1)];
      if (ansicht === 'woche') { const mo = montagVon(anker); return [mo, plusTage(mo, 7)]; }
      const ersterGitter = montagVon(new Date(anker.getFullYear(), anker.getMonth(), 1));
      return [ersterGitter, plusTage(ersterGitter, 42)];
    }

    /** Termine im Fenster, gefiltert nach ausgewählten Mitarbeitern. */
    function sichtbareTermine() {
      const [von, bis] = zeitfenster();
      return termine.filter((t) => {
        const s = new Date(t.start_at);
        return !Number.isNaN(s.getTime()) && s >= von && s < bis && ausgewaehlt.has(chipVon(t));
      });
    }

    /* ============================================================
       Seitenleiste
       ============================================================ */
    function zeichneListe() {
      if (!eintraege.length) {
        listeEl.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:4px 8px">Noch keine Mitarbeiter angelegt.</div>';
        return;
      }
      const [von, bis] = zeitfenster();
      const zaehler = new Map();
      for (const t of termine) {
        const s = new Date(t.start_at);
        if (s >= von && s < bis) zaehler.set(chipVon(t), (zaehler.get(chipVon(t)) ?? 0) + 1);
      }

      listeEl.innerHTML = eintraege.map((c) => {
        const an = ausgewaehlt.has(c.id);
        const n = zaehler.get(c.id) ?? 0;
        return `
          <button type="button" class="kal-ma${an ? '' : ' aus'}" data-ma="${sicher(c.id)}" aria-pressed="${an}">
            <span class="kbox" style="${an ? `background:${c.farbe};border-color:${c.farbe}` : ''}">${an ? '✓' : ''}</span>
            <span class="kname">${sicher(c.name)}</span>
            ${n ? `<span class="kzahl">${n}</span>` : ''}
          </button>`;
      }).join('');
    }

    /* ============================================================
       Kopf: Titel und aktive Ansicht
       ============================================================ */
    function zeichneKopf() {
      el.querySelectorAll('#kal-umschalter button').forEach((b) =>
        b.classList.toggle('aktiv', b.dataset.ansicht === ansicht));

      if (ansicht === 'monat') {
        titelEl.textContent = anker.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      } else if (ansicht === 'woche') {
        const mo = montagVon(anker);
        titelEl.textContent = wochenText(mo, plusTage(mo, 6));
      } else {
        titelEl.textContent = anker.toLocaleDateString('de-DE',
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
    }

    /* ============================================================
       Ein Termin als Block im Stundenraster
       ============================================================ */
    function blockHtml(t, bezugstag, rasterVon) {
      const farbe = farbeTermin(t);
      const vonMin = minutenImTag(t.start_at, bezugstag);
      let bisMin = minutenImTag(t.ende_at, bezugstag);
      if (bisMin === null || bisMin <= vonMin) bisMin = vonMin + 30;

      const top = ((vonMin - rasterVon * 60) / 60) * STD;
      const hoehe = Math.max(20, ((bisMin - vonMin) / 60) * STD);
      const breite = 100 / (t._spalten || 1);
      const links = (t._spur || 0) * breite;

      const kName = kundenname(kundeNach.get(t.kunde_id));
      const titel = t.titel?.trim() || kName || 'Termin';
      const zusatz = titel !== kName ? kName : mitarbeitername(maNach.get(t.mitarbeiter_id));
      const eng = hoehe < 42;

      return `
        <button type="button" class="kal-block${t.status === 'abgesagt' ? ' abgesagt' : ''}"
          data-termin="${sicher(t.id)}" title="${sicher(mitarbeitername(maNach.get(t.mitarbeiter_id)))}"
          style="top:${top}px;height:${hoehe}px;left:calc(${links}% + 2px);width:calc(${breite}% - 4px);
                 background:${farbeWeich(farbe)};border-left-color:${farbe}">
          <div class="bz">${sicher(uhrzeit(t.start_at))}</div>
          ${eng ? '' : `<div class="bt">${sicher(titel)}</div>
          <div class="bk">${sicher(zusatz)}</div>`}
        </button>`;
    }

    /* ============================================================
       Woche / Tag – gemeinsames Stundenraster
       ============================================================ */
    function zeichneRaster(tage) {
      const sichtbar = sichtbareTermine();

      // Rasterhöhe an tatsächliche Termine anpassen, aber mind. 7–21 Uhr.
      let von = RASTER_VON_STD, bis = RASTER_BIS_STD;
      for (const t of sichtbar) {
        const s = new Date(t.start_at), e = new Date(t.ende_at);
        if (!Number.isNaN(s.getTime())) von = Math.min(von, s.getHours());
        if (!Number.isNaN(e.getTime())) bis = Math.max(bis, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
      }
      const stunden = Math.max(1, bis - von);
      const heute = new Date();

      const spaltenBreite = `56px repeat(${tage.length}, minmax(0, 1fr))`;

      // Kopfzeile
      const kopf = tage.map((tag) => {
        const ist = gleicherTag(tag, heute);
        return `<div class="kal-tagkopf${ist ? ' heute' : ''}">
            <div class="wtag">${WTAGE[(tag.getDay() + 6) % 7]}</div>
            <div class="znum">${tag.getDate()}.</div>
          </div>`;
      }).join('');

      // Zeitspalte
      const marken = [];
      for (let h = von; h <= bis; h++) {
        marken.push(`<div class="kal-zeitmarke" style="top:${(h - von) * STD}px">${zwei(h)}:00</div>`);
      }

      // Tagspalten mit Linien und Terminen
      const linien = `repeating-linear-gradient(var(--card), var(--card) ${STD - 1}px, var(--line) ${STD - 1}px, var(--line) ${STD}px)`;
      const spalten = tage.map((tag) => {
        const desTages = sichtbar
          .filter((t) => gleicherTag(new Date(t.start_at), tag))
          .map((t) => ({ t, von: minutenImTag(t.start_at, tag), bis: Math.max(minutenImTag(t.start_at, tag) + 30, minutenImTag(t.ende_at, tag) ?? 0) }));
        verteile(desTages).forEach((it) => { it.t._spur = it.spur; it.t._spalten = it.spalten; });

        return `<div class="kal-tagspalte" style="background:${linien}">
            ${desTages.map((it) => blockHtml(it.t, tag, von)).join('')}
          </div>`;
      }).join('');

      flaecheEl.innerHTML = `
        <div class="kal-raster">
          <div class="kal-kopfzeile" style="grid-template-columns:${spaltenBreite}">
            <div class="kal-eck"></div>${kopf}
          </div>
          <div class="kal-koerper">
            <div class="kal-flaeche" style="grid-template-columns:${spaltenBreite};height:${stunden * STD}px">
              <div class="kal-zeitspalte">${marken.join('')}</div>
              ${spalten}
            </div>
          </div>
        </div>`;
    }

    /* ============================================================
       Monat
       ============================================================ */
    function zeichneMonat() {
      const sichtbar = sichtbareTermine();
      const proTag = new Map();
      for (const t of sichtbar) {
        const key = mitternacht(new Date(t.start_at)).getTime();
        (proTag.get(key) ?? proTag.set(key, []).get(key)).push(t);
      }

      const start = montagVon(new Date(anker.getFullYear(), anker.getMonth(), 1));
      const heute = new Date();
      const MAX = 3;   // wie viele Termine je Zelle, bevor "+N" erscheint

      const kopf = WTAGE.map((w) => `<div class="kal-monat-wtag">${w}</div>`).join('');

      const zellen = [];
      for (let i = 0; i < 42; i++) {
        const tag = plusTage(start, i);
        const fremd = tag.getMonth() !== anker.getMonth();
        const ist = gleicherTag(tag, heute);
        const wend = (tag.getDay() + 6) % 7 >= 5;
        const liste = (proTag.get(mitternacht(tag).getTime()) ?? [])
          .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

        const pillen = liste.slice(0, MAX).map((t) => {
          const farbe = farbeTermin(t);
          const kName = kundenname(kundeNach.get(t.kunde_id));
          const txt = t.titel?.trim() || kName || 'Termin';
          return `<button type="button" class="kal-pille" data-termin="${sicher(t.id)}" style="background:${farbeWeich(farbe)}">
              <span class="pp" style="background:${farbe}"></span>
              <span class="pz">${sicher(uhrzeit(t.start_at))}</span>
              <span class="pt">${sicher(txt)}</span>
            </button>`;
        }).join('');

        const mehr = liste.length > MAX
          ? `<button type="button" class="kal-mehr" data-tag="${tag.toISOString()}">+${liste.length - MAX} mehr</button>` : '';

        zellen.push(`
          <div class="kal-zelle${fremd ? ' fremd' : ''}${ist ? ' heute' : ''}${wend && !fremd ? ' wend' : ''}">
            <button type="button" class="kal-znum" data-tag="${tag.toISOString()}">${tag.getDate()}</button>
            ${pillen}${mehr}
          </div>`);
      }

      flaecheEl.innerHTML = `<div class="kal-monat">${kopf}${zellen.join('')}</div>`;
    }

    /* ============================================================
       Neu zeichnen
       ============================================================ */
    function zeichne() {
      zeichneKopf();
      zeichneListe();
      if (ansicht === 'monat') zeichneMonat();
      else if (ansicht === 'tag') zeichneRaster([mitternacht(anker)]);
      else {
        const mo = montagVon(anker);
        zeichneRaster(Array.from({ length: 7 }, (_, i) => plusTage(mo, i)));
      }
    }

    /* ============================================================
       Dialog
       ============================================================ */
    const felder = () => [
      {
        name: 'mitarbeiter_id', label: 'Mitarbeiter', art: 'select', pflicht: true,
        optionen: mitarbeiter.map((m) => ({ wert: m.id, text: mitarbeitername(m) })),
      },
      {
        name: 'kunde_id', label: 'Kunde', art: 'select',
        optionen: kunden.map((k) => ({ wert: k.id, text: kundenname(k) || '(ohne Namen)' }))
          .sort((a, b) => a.text.localeCompare(b.text, 'de')),
      },
      {
        name: 'leistung_id', label: 'Leistung', art: 'select',
        optionen: leistungen.map((l) => ({ wert: l.id, text: l.name })),
      },
      { name: 'status', label: 'Status', art: 'select', pflicht: true, optionen: STATUS },
      { name: 'titel', label: 'Titel', art: 'text', breit: true, hinweis: 'Ohne Titel steht der Kundenname im Kalender.' },
      { name: 'start_at', label: 'Beginn', art: 'datetime-local', pflicht: true },
      { name: 'ende_at', label: 'Ende', art: 'datetime-local', pflicht: true },
      { name: 'notiz', label: 'Notiz', art: 'textarea', zeilen: 3, breit: true },
    ];

    async function speichern(w, termin) {
      const start = zeitAus(w.start_at, 'den Beginn');
      const schluss = zeitAus(w.ende_at, 'das Ende');
      if (schluss <= start) throw new Error('Das Ende muss nach dem Beginn liegen.');
      const daten = {
        mitarbeiter_id: w.mitarbeiter_id, kunde_id: w.kunde_id, leistung_id: w.leistung_id,
        titel: w.titel, start_at: start.toISOString(), ende_at: schluss.toISOString(),
        status: w.status ?? 'geplant', notiz: w.notiz,
      };
      if (termin) await aendern('termine', termin.id, daten);
      else await anlegen('termine', daten, ctx.firma.id);   // firma_id setzt crud.js
    }

    /** Startvorschlag beim Anlegen. */
    function vorschlag(startTag) {
      const basis = startTag ? new Date(startTag) : new Date();
      const heute = new Date();
      const d = startTag ? mitternacht(basis) : (gleicherTag(basis, heute) ? new Date() : mitternacht(basis));
      d.setHours(startTag && !gleicherTag(basis, heute) ? 9 : Math.max(9, d.getHours()), 0, 0, 0);
      if (!startTag) d.setHours(9, 0, 0, 0);
      return d;
    }

    async function terminDialog(termin, startTag) {
      let werte;
      if (termin) {
        werte = { ...termin, start_at: alsFeldZeit(termin.start_at), ende_at: alsFeldZeit(termin.ende_at) };
      } else {
        const start = vorschlag(startTag);
        const einzeln = ausgewaehlt.size === 1 ? [...ausgewaehlt][0] : null;
        werte = {
          status: 'geplant',
          start_at: alsFeldZeit(start),
          ende_at: alsFeldZeit(new Date(start.getTime() + 60 * 60 * 1000)),
          mitarbeiter_id: maNach.has(einzeln) ? einzeln : undefined,
        };
      }

      const laeuft = formularDialog({
        titel: termin ? 'Termin bearbeiten' : 'Neuer Termin',
        felder: felder(), werte,
        aufSpeichern: (w) => speichern(w, termin),
      });
      if (termin) loeschknopf(termin);

      if (await laeuft) {
        hinweis(termin ? 'Termin geändert.' : 'Termin angelegt.');
        await aktualisiere();
      }
    }

    function loeschknopf(termin) {
      const hg = [...document.querySelectorAll('.dialog-hintergrund')].pop();
      const fuss = hg?.querySelector('.dialog-fuss');
      if (!fuss) return;
      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.className = 'knopf gefahr';
      knopf.textContent = 'Löschen';
      knopf.style.marginRight = 'auto';
      fuss.prepend(knopf);
      knopf.onclick = async () => {
        const ja = await bestaetige(
          `Termin am ${datum(termin.start_at)} um ${uhrzeit(termin.start_at)} wirklich löschen?`,
          { titel: 'Termin löschen', knopfText: 'Löschen', gefahr: true });
        if (!ja) return;
        try {
          await loeschen('termine', termin.id);
          hg.querySelector('#dlg-abbruch').click();
          hinweis('Termin gelöscht.');
          await aktualisiere();
        } catch (fehler) { hinweis(fehler.message, true); }
      };
    }

    /* ============================================================
       Verdrahtung
       ============================================================ */
    listeEl.addEventListener('click', (e) => {
      const k = e.target.closest('[data-ma]');
      if (!k) return;
      const id = k.dataset.ma;
      // Umschalten statt Ersetzen – das ist der Unterschied zur Einzelauswahl.
      if (ausgewaehlt.has(id)) ausgewaehlt.delete(id); else ausgewaehlt.add(id);
      zeichne();
    });

    // Ein Klick auf Termine (Blöcke wie Pillen) öffnet den Dialog;
    // Klick auf einen Tag legt dort einen neuen Termin an.
    flaecheEl.addEventListener('click', (e) => {
      const block = e.target.closest('[data-termin]');
      if (block) {
        const t = termine.find((x) => x.id === block.dataset.termin);
        if (t) terminDialog(t);
        return;
      }
      const tag = e.target.closest('[data-tag]');
      if (tag) {
        // Im Monat: auf Tageszahl zur Tagesansicht, sonst neuer Termin.
        if (tag.classList.contains('kal-znum') || tag.classList.contains('kal-mehr')) {
          ansicht = 'tag'; anker = mitternacht(new Date(tag.dataset.tag)); zeichne();
        } else {
          terminDialog(null, tag.dataset.tag);
        }
      }
    });

    el.querySelector('#kal-umschalter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ansicht]');
      if (!b) return;
      ansicht = b.dataset.ansicht;
      zeichne();
    });

    el.querySelector('#kal-alle').onclick = () => { eintraege.forEach((c) => ausgewaehlt.add(c.id)); zeichne(); };
    el.querySelector('#kal-keine').onclick = () => { ausgewaehlt.clear(); zeichne(); };

    const schritt = (richtung) => {
      if (ansicht === 'monat') anker = plusMonate(anker, richtung);
      else if (ansicht === 'woche') anker = plusTage(anker, richtung * 7);
      else anker = plusTage(anker, richtung);
      zeichne();
    };
    el.querySelector('#kal-zurueck').onclick = () => schritt(-1);
    el.querySelector('#kal-vor').onclick = () => schritt(1);
    el.querySelector('#kal-heute').onclick = () => { anker = mitternacht(new Date()); zeichne(); };
    el.querySelector('#kal-neu').onclick = () => terminDialog(null);

    zeichne();

    // Beim Öffnen die Woche/Tag mittig zur Kernarbeitszeit scrollen.
    const koerper = el.querySelector('.kal-koerper');
    if (koerper) koerper.scrollTop = 1 * STD;   // etwas oberhalb 8 Uhr
  },
});
