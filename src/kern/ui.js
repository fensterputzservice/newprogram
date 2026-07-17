/* ============================================================
   Kleine Werkzeuge für die Oberfläche
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
  }, schlecht ? 4200 : 2600);
}

/** Platzhalter für ein Modul, das noch aus dem Altsystem kommt. */
export function nochNichtPortiert(titel, datei) {
  return `
    <div class="karte">
      <div class="platzhalter">
        <span class="zeichen">🚧</span>
        <h2>${sicher(titel)}</h2>
        <p style="max-width:440px;margin:0 auto">
          Dieser Bereich wird als Nächstes aus dem Altsystem übernommen.
          Das Gerüst steht, die Fachlogik folgt.
        </p>
        <p style="margin-top:16px"><code>${sicher(datei)}</code></p>
      </div>
    </div>`;
}

/** Datum als 17.07.2026. */
export function datum(wert) {
  if (!wert) return '—';
  const d = wert instanceof Date ? wert : new Date(wert);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Betrag als 1.234,50 €. */
export function euro(wert) {
  const z = Number(wert);
  return Number.isFinite(z)
    ? z.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
    : '—';
}
