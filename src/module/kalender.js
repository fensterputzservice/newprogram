/* ============================================================
   Kalender – Wochenübersicht mit Mehrfachauswahl

   Der Kern des Bereichs: Mitarbeiter werden einzeln an- und
   abgeschaltet, und alle angeschalteten liegen in derselben
   Woche übereinander – jeder in seiner Farbe. Kein Umschalten
   zwischen Personen, sondern ein Nebeneinander.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste, anlegen, aendern, loeschen } from '../kern/crud.js';
import {
  sicher, hinweis, datum, uhrzeit, formularDialog, bestaetige, etikett,
} from '../kern/ui.js';

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STATUS = [
  { wert: 'geplant', text: 'Geplant' },
  { wert: 'bestaetigt', text: 'Bestätigt' },
  { wert: 'erledigt', text: 'Erledigt' },
  { wert: 'abgesagt', text: 'Abgesagt' },
];
const STATUS_TEXT = Object.fromEntries(STATUS.map((s) => [s.wert, s.text]));
const STATUS_ART = { geplant: '', bestaetigt: 'gut', erledigt: 'ruhig', abgesagt: 'schlecht' };

/* Termine ohne (bekannten) Mitarbeiter bekommen einen eigenen Chip.
   Sonst wären sie im Kalender unsichtbar und damit unerreichbar. */
const OHNE = '__ohne__';
const STANDARDFARBE = '#2f7c88';   // wie in sql/01_schema.sql

/* ============================================================
   Kleine Helfer
   ============================================================ */

const zwei = (n) => String(n).padStart(2, '0');

/** Montag der Woche, in der d liegt. */
function montagVon(d) {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));   // So=0 → 6, Mo=1 → 0
  return m;
}

const plusTage = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const gleicherTag = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "14.–20. Juli 2026" · "29. Juni – 5. Juli 2026" · über den Jahreswechsel beide Jahre. */
function zeitraumText(von, bis) {
  const lang = { day: 'numeric', month: 'long', year: 'numeric' };
  if (von.getFullYear() !== bis.getFullYear()) {
    return `${von.toLocaleDateString('de-DE', lang)} – ${bis.toLocaleDateString('de-DE', lang)}`;
  }
  if (von.getMonth() !== bis.getMonth()) {
    return `${von.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} – ${bis.toLocaleDateString('de-DE', lang)}`;
  }
  return `${von.getDate()}.–${bis.toLocaleDateString('de-DE', lang)}`;
}

/** Date/ISO → 'YYYY-MM-DDTHH:mm' für <input type="datetime-local"> – bewusst Ortszeit. */
function alsFeldZeit(wert) {
  const d = wert instanceof Date ? wert : new Date(wert);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

/** Feldwert → Date, mit verständlicher Meldung statt stiller Panne. */
function zeitAus(wert, name) {
  const d = wert ? new Date(wert) : null;
  if (!d || Number.isNaN(d.getTime())) throw new Error(`Bitte ${name} mit Datum und Uhrzeit angeben.`);
  return d;
}

/**
 * Farben landen in style-Attributen. Dort hilft Escapen wenig –
 * deshalb wird streng geprüft und sonst die Standardfarbe genommen.
 */
const farbeVon = (ma) => (/^#[0-9a-fA-F]{6}$/.test(ma?.farbe ?? '') ? ma.farbe : STANDARDFARBE);
const farbeWeich = (hex) => hex + '22';

/** Firmen zeigen firma_name, Privatpersonen "Vorname Nachname". */
const kundenname = (k) =>
  !k ? '' : (k.firma_name?.trim() || [k.vorname, k.nachname].filter(Boolean).join(' ').trim());

const mitarbeitername = (m) => (m ? [m.vorname, m.nachname].filter(Boolean).join(' ').trim() : 'Ohne Zuordnung');

/* ============================================================
   Modul
   ============================================================ */

registriere({
  id: 'kalender',
  titel: 'Kalender',
  zeichen: '▤',

  mount: async (el, ctx) => {
    const [mitarbeiter, kunden, leistungen, termine] = await Promise.all([
      liste('mitarbeiter', { firma: ctx.firma.id, sortieren: 'nachname' }),
      liste('kunden', { firma: ctx.firma.id, sortieren: 'nachname' }),
      liste('leistungen', { firma: ctx.firma.id, sortieren: 'name' }),
      liste('termine', { firma: ctx.firma.id, sortieren: 'start_at' }),
    ]);

    const maNach = new Map(mitarbeiter.map((m) => [m.id, m]));
    const kundeNach = new Map(kunden.map((k) => [k.id, k]));

    /* Zu welchem Chip gehört ein Termin? */
    const chipVon = (t) => (maNach.has(t.mitarbeiter_id) ? t.mitarbeiter_id : OHNE);

    const chips = mitarbeiter.map((m) => ({ id: m.id, name: mitarbeitername(m), farbe: farbeVon(m) }));
    if (termine.some((t) => !maNach.has(t.mitarbeiter_id))) {
      chips.push({ id: OHNE, name: 'Ohne Zuordnung', farbe: STANDARDFARBE });
    }

    /* ---------- Zustand. Lebt nur hier, damit ein Klick auf einen
       Chip oder auf die Wochennavigation nichts neu lädt. ---------- */
    let anker = montagVon(new Date());
    // Mehrfachauswahl: ein Set, kein einzelner Wert. Jeder Klick schaltet
    // genau einen Mitarbeiter um, alle anderen bleiben unberührt.
    // Beim Öffnen sind alle ausgewählt.
    const ausgewaehlt = new Set(chips.map((c) => c.id));

    /* ---------- Gerüst. Wird genau einmal gebaut. ---------- */
    el.innerHTML = `
      <div class="werkzeuge" style="flex-wrap:wrap">
        <button class="knopf stumm" id="kal-zurueck" style="padding:8px 13px" title="Woche zurück">◀</button>
        <button class="knopf stumm" id="kal-heute" style="padding:8px 14px">Heute</button>
        <button class="knopf stumm" id="kal-vor" style="padding:8px 13px" title="Woche vor">▶</button>
        <h2 id="kal-zeitraum" style="font-size:17px;font-weight:700;letter-spacing:-.2px"></h2>
        <button class="knopf" id="kal-neu" style="margin-left:auto">+ Termin</button>
      </div>

      <div class="karte" style="padding:14px 16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <span style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Mitarbeiter</span>
          <span id="kal-zaehler" style="font-size:12.5px;color:var(--muted)"></span>
          <span style="margin-left:auto;display:flex;gap:8px">
            <button class="knopf stumm" id="kal-alle" style="padding:5px 13px;font-size:12.5px;border-radius:99px">Alle</button>
            <button class="knopf stumm" id="kal-keine" style="padding:5px 13px;font-size:12.5px;border-radius:99px">Keine</button>
          </span>
        </div>
        <div id="kal-chips" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      </div>

      <div id="kal-gitter"></div>`;

    const chipsEl = el.querySelector('#kal-chips');
    const gitterEl = el.querySelector('#kal-gitter');
    const zeitraumEl = el.querySelector('#kal-zeitraum');
    const zaehlerEl = el.querySelector('#kal-zaehler');

    /* ============================================================
       Zeichnen – rührt immer nur die beiden Bereiche an,
       nie das ganze Modul.
       ============================================================ */

    function zeichneChips() {
      if (!chips.length) {
        chipsEl.innerHTML = '<span style="font-size:13px;color:var(--muted)">Für diese Firma sind noch keine Mitarbeiter angelegt.</span>';
        zaehlerEl.textContent = '';
        return;
      }

      chipsEl.innerHTML = chips.map((c) => {
        const an = ausgewaehlt.has(c.id);
        return `
          <button type="button" data-chip="${sicher(c.id)}" aria-pressed="${an}"
            style="display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border-radius:99px;
                   font-size:13.5px;font-weight:600;
                   border:1px solid ${an ? c.farbe : 'var(--line)'};
                   background:${an ? c.farbe : 'var(--card)'};
                   color:${an ? '#fff' : 'var(--muted)'}">
            <span class="punkt" style="background:${an ? '#fff' : c.farbe}"></span>
            <span>${sicher(c.name)}</span>
          </button>`;
      }).join('');

      zaehlerEl.textContent = `${ausgewaehlt.size} von ${chips.length} ausgewählt`;
    }

    function terminKarte(t) {
      const ma = maNach.get(t.mitarbeiter_id);
      const farbe = farbeVon(ma);
      const kName = kundenname(kundeNach.get(t.kunde_id));
      const titel = t.titel?.trim() ?? '';
      const haupt = titel || kName || 'Termin';
      const zusatz = titel && kName && kName !== titel ? kName : '';
      const abgesagt = t.status === 'abgesagt';

      return `
        <button type="button" data-termin="${sicher(t.id)}" title="${sicher(t.notiz ?? '')}"
          style="display:block;width:100%;text-align:left;padding:7px 9px;border-radius:9px;
                 border-left:4px solid ${farbe};background:${farbeWeich(farbe)};
                 ${abgesagt ? 'opacity:.55;' : ''}">
          <div style="font-size:11.5px;font-weight:700">${sicher(uhrzeit(t.start_at))}–${sicher(uhrzeit(t.ende_at))}</div>
          <div style="font-size:13px;font-weight:700;line-height:1.3;margin-top:1px;${abgesagt ? 'text-decoration:line-through' : ''}">${sicher(haupt)}</div>
          ${zusatz ? `<div style="font-size:11.5px;color:var(--muted);line-height:1.3">${sicher(zusatz)}</div>` : ''}
          <div style="font-size:11.5px;font-weight:600;color:${farbe};margin-top:2px">${sicher(mitarbeitername(ma))}</div>
          ${t.status !== 'geplant' ? `<div style="margin-top:5px">${etikett(STATUS_TEXT[t.status] ?? t.status, STATUS_ART[t.status] ?? '')}</div>` : ''}
        </button>`;
    }

    function zeichneWoche() {
      const bis = plusTage(anker, 6);
      zeitraumEl.textContent = zeitraumText(anker, bis);

      if (!ausgewaehlt.size) {
        gitterEl.innerHTML = `<div class="karte"><div class="platzhalter" style="padding:44px 20px">
            Kein Mitarbeiter ausgewählt. Oben einen oder mehrere anklicken.
          </div></div>`;
        return;
      }

      const ende = plusTage(anker, 7);
      // termine kommen bereits nach start_at sortiert – die Reihenfolge
      // in der Tagesspalte stimmt damit von selbst.
      const sichtbar = termine.filter((t) => {
        const s = new Date(t.start_at);
        return !Number.isNaN(s.getTime()) && s >= anker && s < ende && ausgewaehlt.has(chipVon(t));
      });

      const heute = new Date();

      const spalten = TAGE.map((kuerzel, i) => {
        const tag = plusTage(anker, i);
        const desTages = sichtbar.filter((t) => gleicherTag(new Date(t.start_at), tag));
        const istHeute = gleicherTag(tag, heute);
        const istWochenende = i >= 5;

        const flaeche = istHeute
          ? 'background:var(--petrol-soft);box-shadow:inset 0 0 0 2px var(--petrol)'
          : istWochenende ? 'background:var(--bg)' : '';

        return `
          <div class="karte" style="padding:10px;min-height:172px;display:flex;flex-direction:column;gap:7px;${flaeche}">
            <div style="display:flex;align-items:baseline;gap:6px;padding-bottom:7px;border-bottom:1px solid var(--line)">
              <span style="font-size:11.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:${istHeute ? 'var(--petrol-dark)' : 'var(--muted)'}">${kuerzel}</span>
              <span style="font-size:15px;font-weight:800;${istHeute ? 'color:var(--petrol-dark)' : ''}">${tag.getDate()}.</span>
              <span style="font-size:11.5px;color:var(--muted)">${zwei(tag.getMonth() + 1)}.</span>
              ${desTages.length ? `<span style="margin-left:auto;font-size:11.5px;font-weight:700;color:var(--muted)">${desTages.length}</span>` : ''}
            </div>
            ${desTages.length
              ? desTages.map(terminKarte).join('')
              : '<div style="font-size:12.5px;color:var(--muted);padding:4px 2px">—</div>'}
          </div>`;
      }).join('');

      // Sieben Spalten bleiben sieben Spalten – auf schmalen Geräten
      // wird geschoben, statt Tage zu verstecken.
      gitterEl.innerHTML = `
        <div style="overflow-x:auto;padding-bottom:4px">
          <div style="display:grid;grid-template-columns:repeat(7,minmax(150px,1fr));gap:10px;align-items:start">${spalten}</div>
        </div>`;
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
        optionen: kunden
          .map((k) => ({ wert: k.id, text: kundenname(k) || '(ohne Namen)' }))
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

      // Die Datenbank prüft dasselbe (constraint termine_zeitraum).
      // Hier kommt die Prüfung nur in verständlichen Worten zurück.
      if (schluss <= start) throw new Error('Das Ende muss nach dem Beginn liegen.');

      const daten = {
        mitarbeiter_id: w.mitarbeiter_id,
        kunde_id: w.kunde_id,
        leistung_id: w.leistung_id,
        titel: w.titel,
        start_at: start.toISOString(),
        ende_at: schluss.toISOString(),
        status: w.status ?? 'geplant',
        notiz: w.notiz,
      };

      if (termin) await aendern('termine', termin.id, daten);
      else await anlegen('termine', daten, ctx.firma.id);   // firma_id setzt crud.js
    }

    /** Beim Anlegen: heute, sonst der Montag der gezeigten Woche, 9 Uhr. */
    function vorschlag() {
      const heute = new Date();
      const d = heute >= anker && heute < plusTage(anker, 7) ? new Date(heute) : new Date(anker);
      d.setHours(9, 0, 0, 0);
      return d;
    }

    async function terminDialog(termin) {
      let werte;
      if (termin) {
        werte = { ...termin, start_at: alsFeldZeit(termin.start_at), ende_at: alsFeldZeit(termin.ende_at) };
      } else {
        const start = vorschlag();
        // Ist genau ein Mitarbeiter angeklickt, ist der neue Termin
        // mit hoher Wahrscheinlichkeit für ihn.
        const einzeln = ausgewaehlt.size === 1 ? [...ausgewaehlt][0] : null;
        werte = {
          status: 'geplant',
          start_at: alsFeldZeit(start),
          ende_at: alsFeldZeit(new Date(start.getTime() + 60 * 60 * 1000)),
          mitarbeiter_id: maNach.has(einzeln) ? einzeln : undefined,
        };
      }

      // Der Dialog steht sofort im Dokument – deshalb lässt sich der
      // Löschknopf hier nachträglich in die Fußzeile hängen.
      const laeuft = formularDialog({
        titel: termin ? 'Termin bearbeiten' : 'Neuer Termin',
        felder: felder(),
        werte,
        aufSpeichern: (w) => speichern(w, termin),
      });
      if (termin) loeschknopf(termin);

      if (await laeuft) {
        hinweis(termin ? 'Termin geändert.' : 'Termin angelegt.');
        ctx.neuLaden();
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
          { titel: 'Termin löschen', knopfText: 'Löschen', gefahr: true },
        );
        if (!ja) return;
        try {
          await loeschen('termine', termin.id);
          hg.querySelector('#dlg-abbruch').click();   // schließt den Formulardialog
          hinweis('Termin gelöscht.');
          ctx.neuLaden();
        } catch (fehler) {
          hinweis(fehler.message, true);
        }
      };
    }

    /* ============================================================
       Verdrahtung. Die Behälter bleiben stehen, deshalb reicht
       je ein Zuhörer – auch nach dem Neuzeichnen.
       ============================================================ */

    chipsEl.addEventListener('click', (e) => {
      const k = e.target.closest('[data-chip]');
      if (!k) return;
      const id = k.dataset.chip;
      // Umschalten statt Ersetzen: das ist der ganze Unterschied
      // zwischen Mehrfachauswahl und Umschalter.
      if (ausgewaehlt.has(id)) ausgewaehlt.delete(id);
      else ausgewaehlt.add(id);
      zeichneChips();
      zeichneWoche();
    });

    gitterEl.addEventListener('click', (e) => {
      const k = e.target.closest('[data-termin]');
      if (!k) return;
      const t = termine.find((x) => x.id === k.dataset.termin);
      if (t) terminDialog(t);
    });

    el.querySelector('#kal-alle').onclick = () => {
      chips.forEach((c) => ausgewaehlt.add(c.id));
      zeichneChips();
      zeichneWoche();
    };
    el.querySelector('#kal-keine').onclick = () => {
      ausgewaehlt.clear();
      zeichneChips();
      zeichneWoche();
    };

    el.querySelector('#kal-zurueck').onclick = () => { anker = plusTage(anker, -7); zeichneWoche(); };
    el.querySelector('#kal-vor').onclick = () => { anker = plusTage(anker, 7); zeichneWoche(); };
    el.querySelector('#kal-heute').onclick = () => { anker = montagVon(new Date()); zeichneWoche(); };
    el.querySelector('#kal-neu').onclick = () => terminDialog(null);

    zeichneChips();
    zeichneWoche();
  },
});
