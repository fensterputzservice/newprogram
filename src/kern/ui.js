/* ============================================================
   Baukasten für die Oberfläche

   Alle Module benutzen diese Bausteine. Deshalb sehen sie gleich
   aus und verhalten sich gleich – und ein Fehler wird an einer
   Stelle behoben, nicht an zwölf.
   ============================================================ */

export const $ = (id) => document.getElementById(id);

/** Text so einsetzen, dass er niemals als HTML gelesen wird. */
export function sicher(text) {
  const d = document.createElement('div');
  d.textContent = text ?? '';
  return d.innerHTML;
}

/** Nur den genannten Bildschirm zeigen. */
export function zeige(id) {
  ['anmeldung', 'firmenwahl', 'anwendung'].forEach((s) => {
    $(s).classList.toggle('verborgen', s !== id);
  });
}

/** Kurzer Hinweis unten am Rand. */
export function hinweis(text, schlecht = false) {
  const el = document.createElement('div');
  el.className = 'hinweis' + (schlecht ? ' schlecht' : '');
  el.textContent = text;
  $('hinweise').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, schlecht ? 4600 : 2600);
}

/* ============================================================
   Formate
   ============================================================ */

/** 2026-07-17 → 17.07.2026 */
export function datum(wert) {
  if (!wert) return '—';
  const d = wert instanceof Date ? wert : new Date(wert);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 2026-07-17T09:30 → 09:30 */
export function uhrzeit(wert) {
  if (!wert) return '—';
  const d = wert instanceof Date ? wert : new Date(wert);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** 1234.5 → 1.234,50 € */
export function euro(wert) {
  const z = Number(wert);
  return Number.isFinite(z)
    ? z.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
    : '—';
}

/** 7.5 → 7,50 h */
export function stunden(wert) {
  const z = Number(wert);
  return Number.isFinite(z) ? z.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' h' : '—';
}

/** Für <input type="date"> */
export const alsFelddatum = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);

/* ============================================================
   Bausteine
   ============================================================ */

/** Ladeanzeige, solange Daten kommen. */
export const laedt = (was = 'Daten') =>
  `<div class="karte"><div class="platzhalter">
     <span class="zeichen">⏳</span>${sicher(was)} werden geladen …
   </div></div>`;

/** Fehleranzeige – nennt den Grund, statt ihn zu verschlucken. */
export const fehlerkarte = (meldung) =>
  `<div class="karte"><div class="platzhalter">
     <span class="zeichen">⚠</span>
     <h2>Das hat nicht geklappt</h2>
     <p style="max-width:460px;margin:0 auto">${sicher(meldung)}</p>
   </div></div>`;

/** Platzhalter für Module, die noch aus dem Altsystem kommen. */
export const nochNichtPortiert = (titel, datei) =>
  `<div class="karte"><div class="platzhalter">
     <span class="zeichen">🚧</span>
     <h2>${sicher(titel)}</h2>
     <p style="max-width:440px;margin:0 auto">
       Dieser Bereich wird noch aus dem Altsystem übernommen.
     </p>
     <p style="margin-top:16px"><code>${sicher(datei)}</code></p>
   </div></div>`;

/** Kopfzeile eines Bereichs mit Suchfeld und Knopf. */
export function werkzeugleiste({ suche = true, platzhalter = 'Suchen …', knopf = null } = {}) {
  return `
    <div class="werkzeuge">
      ${suche ? `<input class="feld suchfeld" id="suche" placeholder="${sicher(platzhalter)}" autocomplete="off">` : '<div></div>'}
      ${knopf ? `<button class="knopf" id="${sicher(knopf.id)}">${sicher(knopf.text)}</button>` : ''}
    </div>`;
}

/** Kennzahl-Kachel fürs Dashboard. */
export const kennzahl = (titel, wert, zusatz = '') => `
  <div class="karte kennzahl">
    <div class="kennzahl-titel">${sicher(titel)}</div>
    <div class="kennzahl-wert">${sicher(String(wert))}</div>
    ${zusatz ? `<div class="kennzahl-zusatz">${sicher(zusatz)}</div>` : ''}
  </div>`;

/** Farbiges Etikett. */
export const etikett = (text, art = '') =>
  `<span class="etikett ${sicher(art)}">${sicher(text)}</span>`;

/**
 * Tabelle.
 * spalten: [{ kopf, zelle:(zeile)=>html, breite? }]
 * aktionen: (zeile) => html   – rechte Spalte
 */
export function tabelle({ spalten, zeilen, leer = 'Noch keine Einträge.', aktionen = null }) {
  if (!zeilen.length) {
    return `<div class="karte"><div class="platzhalter" style="padding:40px 20px">${sicher(leer)}</div></div>`;
  }
  const kopf = spalten.map((s) => `<th${s.breite ? ` style="width:${s.breite}"` : ''}>${sicher(s.kopf)}</th>`).join('')
    + (aktionen ? '<th style="width:1%"></th>' : '');

  const koerper = zeilen.map((z) => {
    const zellen = spalten.map((s) => `<td>${s.zelle(z)}</td>`).join('');
    return `<tr data-id="${sicher(z.id)}">${zellen}${aktionen ? `<td class="zeilen-aktionen">${aktionen(z)}</td>` : ''}</tr>`;
  }).join('');

  return `<div class="karte tabellen-karte"><table class="liste">
      <thead><tr>${kopf}</tr></thead><tbody>${koerper}</tbody>
    </table></div>`;
}

/* ============================================================
   Formulare
   ============================================================ */

/**
 * Ein Feld beschreiben:
 *  { name, label, art?, pflicht?, optionen?, zeilen?, hinweis?, breit? }
 *  art: text | email | tel | date | time | number | select | textarea | checkbox
 *  optionen (bei select): [{wert, text}]
 */
function feldHtml(f, wert) {
  const id = 'f_' + f.name;
  const w = wert ?? '';
  const pflicht = f.pflicht ? ' required' : '';

  let eingabe;
  switch (f.art) {
    case 'select':
      eingabe = `<select class="feld" id="${id}"${pflicht}>
          ${f.pflicht ? '' : '<option value="">— keine Angabe —</option>'}
          ${(f.optionen ?? []).map((o) =>
            `<option value="${sicher(o.wert)}"${String(o.wert) === String(w) ? ' selected' : ''}>${sicher(o.text)}</option>`
          ).join('')}
        </select>`;
      break;
    case 'textarea':
      eingabe = `<textarea class="feld" id="${id}" rows="${f.zeilen ?? 3}"${pflicht}>${sicher(w)}</textarea>`;
      break;
    case 'checkbox':
      eingabe = `<label class="schalter"><input type="checkbox" id="${id}"${w ? ' checked' : ''}>
                   <span>${sicher(f.hinweis ?? '')}</span></label>`;
      break;
    default:
      eingabe = `<input class="feld" type="${f.art ?? 'text'}" id="${id}" value="${sicher(w)}"${pflicht}
                   ${f.schritt ? ` step="${f.schritt}"` : ''} autocomplete="off">`;
  }

  return `<div class="formfeld${f.breit ? ' breit' : ''}">
      ${f.art === 'checkbox' ? '' : `<label for="${id}">${sicher(f.label)}${f.pflicht ? ' *' : ''}</label>`}
      ${eingabe}
      ${f.hinweis && f.art !== 'checkbox' ? `<div class="feldhinweis">${sicher(f.hinweis)}</div>` : ''}
    </div>`;
}

/** Werte aus einem Formular auslesen. */
function werteLesen(felder) {
  const werte = {};
  for (const f of felder) {
    const el = $('f_' + f.name);
    if (!el) continue;
    if (f.art === 'checkbox') werte[f.name] = el.checked;
    else if (f.art === 'number') werte[f.name] = el.value === '' ? null : Number(el.value);
    else werte[f.name] = el.value.trim() === '' ? null : el.value.trim();
  }
  return werte;
}

/* ============================================================
   Dialoge
   ============================================================ */

function dialogRahmen(inhalt, breite = '540px') {
  const hg = document.createElement('div');
  hg.className = 'dialog-hintergrund';
  hg.innerHTML = `<div class="dialog" style="max-width:${breite}">${inhalt}</div>`;
  document.body.appendChild(hg);
  return hg;
}

/**
 * Formular-Dialog.
 * Gibt true zurück, wenn gespeichert wurde, sonst false.
 */
export function formularDialog({ titel, felder, werte = {}, aufSpeichern, knopfText = 'Speichern' }) {
  return new Promise((fertig) => {
    const hg = dialogRahmen(`
      <div class="dialog-kopf">
        <h2>${sicher(titel)}</h2>
        <button class="dialog-zu" id="dlg-zu" aria-label="Schließen">✕</button>
      </div>
      <form id="dlg-form">
        <div class="dialog-koerper">
          <div class="formgitter">${felder.map((f) => feldHtml(f, werte[f.name])).join('')}</div>
        </div>
        <div class="dialog-fuss">
          <button type="button" class="knopf stumm" id="dlg-abbruch">Abbrechen</button>
          <button type="submit" class="knopf" id="dlg-ok">${sicher(knopfText)}</button>
        </div>
      </form>`);

    const zu = (ergebnis) => { hg.remove(); document.removeEventListener('keydown', beiTaste); fertig(ergebnis); };
    const beiTaste = (e) => { if (e.key === 'Escape') zu(false); };
    document.addEventListener('keydown', beiTaste);

    hg.querySelector('#dlg-zu').onclick = () => zu(false);
    hg.querySelector('#dlg-abbruch').onclick = () => zu(false);
    hg.onclick = (e) => { if (e.target === hg) zu(false); };

    hg.querySelector('#dlg-form').onsubmit = async (e) => {
      e.preventDefault();
      const ok = hg.querySelector('#dlg-ok');
      ok.disabled = true; ok.textContent = 'Speichert …';
      try {
        await aufSpeichern(werteLesen(felder));
        zu(true);
      } catch (fehler) {
        hinweis(fehler.message, true);
        ok.disabled = false; ok.textContent = knopfText;
      }
    };

    setTimeout(() => hg.querySelector('.feld')?.focus(), 40);
  });
}

/** Rückfrage. Bei gefahr=true wird der Knopf rot. */
export function bestaetige(frage, { titel = 'Bitte bestätigen', knopfText = 'Ja', gefahr = false } = {}) {
  return new Promise((fertig) => {
    const hg = dialogRahmen(`
      <div class="dialog-kopf"><h2>${sicher(titel)}</h2></div>
      <div class="dialog-koerper"><p>${sicher(frage)}</p></div>
      <div class="dialog-fuss">
        <button class="knopf stumm" id="dlg-nein">Abbrechen</button>
        <button class="knopf${gefahr ? ' gefahr' : ''}" id="dlg-ja">${sicher(knopfText)}</button>
      </div>`, '420px');

    const zu = (e) => { hg.remove(); fertig(e); };
    hg.querySelector('#dlg-nein').onclick = () => zu(false);
    hg.querySelector('#dlg-ja').onclick = () => zu(true);
    hg.onclick = (e) => { if (e.target === hg) zu(false); };
    setTimeout(() => hg.querySelector('#dlg-ja')?.focus(), 40);
  });
}

/** Freier Dialog für alles, was kein Formular ist. */
export function inhaltsDialog({ titel, inhalt, breite = '640px' }) {
  const hg = dialogRahmen(`
    <div class="dialog-kopf">
      <h2>${sicher(titel)}</h2>
      <button class="dialog-zu" id="dlg-zu" aria-label="Schließen">✕</button>
    </div>
    <div class="dialog-koerper">${inhalt}</div>`, breite);

  const zu = () => hg.remove();
  hg.querySelector('#dlg-zu').onclick = zu;
  hg.onclick = (e) => { if (e.target === hg) zu(); };
  return { el: hg, schliessen: zu };
}

/** Suchfeld verdrahten: filtert Tabellenzeilen nach sichtbarem Text. */
export function sucheVerdrahten(behaelter) {
  const feld = behaelter.querySelector('#suche');
  if (!feld) return;
  feld.oninput = () => {
    const s = feld.value.toLowerCase().trim();
    behaelter.querySelectorAll('table.liste tbody tr').forEach((tr) => {
      tr.style.display = !s || tr.textContent.toLowerCase().includes(s) ? '' : 'none';
    });
  };
}
