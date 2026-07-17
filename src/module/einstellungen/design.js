/* ============================================================
   Design und Farben

   Warum jede Firma eigene Farben hat: Beide Altversionen sahen
   identisch aus. Bei zwei Firmen in einer Oberfläche ist das
   gefährlich – man sieht sonst nicht, in welcher Firma man gerade
   tippt. Ein Stundenzettel im falschen Mandanten fällt erst auf,
   wenn er abgerechnet ist. Die Farbe ist hier also kein Schmuck,
   sondern die Anzeige, wo man sich befindet.

   Kein formularDialog: Farben will man sehen, während man sie
   wählt, und nicht durch ein Fenster hindurch, das die halbe
   Oberfläche verdeckt. Deshalb steht das Formular in der Bühne.
   ============================================================ */

import { aendern } from '../../kern/crud.js';
import { zustand } from '../../kern/auth.js';
import { wendeDesignAn } from '../../kern/mandant.js';
import { hinweis, sicher } from '../../kern/ui.js';

/* Spiegelt STANDARD aus kern/mandant.js – dieselben Werte, die
   ohne eigenes Design greifen. */
const STANDARD = {
  petrol: '#6d28d9', 'petrol-dark': '#4c1d95', 'petrol-soft': '#f0e9ff',
  amber: '#ff6b9d', 'amber-soft': '#ffe4ee',
  ink: '#1f1633', muted: '#6b6480', line: '#e8e2f5',
  bg: '#f7f5fc', card: '#ffffff',
};

const FARBEN = [
  { name: 'petrol', label: 'Hauptfarbe', hinweis: 'Menü, Knöpfe, Kennfarbe der Firma' },
  { name: 'petrol-dark', label: 'Hauptfarbe dunkel', hinweis: 'Verläufe und gedrückte Knöpfe' },
  { name: 'petrol-soft', label: 'Hauptfarbe hell', hinweis: 'Hinterlegte Flächen' },
  { name: 'amber', label: 'Akzentfarbe', hinweis: 'Hervorhebungen' },
  { name: 'amber-soft', label: 'Akzentfarbe hell', hinweis: 'Hinterlegte Hervorhebungen' },
  { name: 'ink', label: 'Schrift', hinweis: 'Haupttext' },
  { name: 'muted', label: 'Schrift gedämpft', hinweis: 'Nebentext und Beschriftungen' },
  { name: 'line', label: 'Linien', hinweis: 'Rahmen und Trenner' },
  { name: 'bg', label: 'Hintergrund', hinweis: 'Fläche hinter den Karten' },
  { name: 'card', label: 'Karten', hinweis: 'Fläche der Karten selbst' },
];

/**
 * <input type="color"> versteht ausschließlich #rrggbb.
 * Kurzschreibweisen werden ausgeschrieben, alles andere fällt auf
 * den Standard zurück – sonst zeigte das Feld stumm Schwarz an.
 */
function alsHexfarbe(wert, ersatz) {
  const s = String(wert ?? '').trim();
  const kurz = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (kurz) return `#${kurz[1]}${kurz[1]}${kurz[2]}${kurz[2]}${kurz[3]}${kurz[3]}`.toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : ersatz;
}

export async function mountDesign(el, ctx) {
  const aktuell = { ...STANDARD, ...(ctx.firma.design ?? {}) };

  const feldHtml = (f) => `
    <div class="formfeld">
      <label for="farbe-${sicher(f.name)}">${sicher(f.label)}</label>
      <input type="color" id="farbe-${sicher(f.name)}" data-farbe="${sicher(f.name)}"
             value="${sicher(alsHexfarbe(aktuell[f.name], STANDARD[f.name]))}"
             style="width:100%;height:40px;padding:2px;border:1px solid var(--line);
                    border-radius:8px;background:var(--card);cursor:pointer">
      <div class="feldhinweis">${sicher(f.hinweis)}</div>
    </div>`;

  el.innerHTML = `
    <div class="karte" style="margin-bottom:16px">
      <p style="margin:0">
        Diese Farben gelten nur für <strong>${sicher(ctx.firma.name)}</strong>.
        Zwei Firmen in einer Oberfläche sollen sich auf den ersten Blick
        unterscheiden – sonst tippt man im falschen Mandanten.
      </p>
    </div>

    <div class="karte">
      <div class="formgitter">${FARBEN.map(feldHtml).join('')}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
        <button class="knopf stumm" id="zuruecksetzen">Zurücksetzen</button>
        <button class="knopf" id="speichern">Speichern</button>
      </div>
    </div>`;

  const felder = () => [...el.querySelectorAll('[data-farbe]')];

  /** Was gerade in den Feldern steht. */
  const gewaehlt = () =>
    Object.fromEntries(felder().map((f) => [f.dataset.farbe, f.value.toLowerCase()]));

  /* Vorschau beim Drehen am Regler: Man sieht die Farbe sofort,
     gespeichert ist sie damit noch nicht. */
  const vorschau = () => wendeDesignAn({ ...ctx.firma, design: gewaehlt() });
  felder().forEach((f) => { f.oninput = vorschau; });

  el.querySelector('#zuruecksetzen').onclick = () => {
    felder().forEach((f) => { f.value = STANDARD[f.dataset.farbe]; });
    vorschau();
    hinweis('Standardfarben eingesetzt. Zum Übernehmen auf Speichern klicken.');
  };

  el.querySelector('#speichern').onclick = async () => {
    const knopf = el.querySelector('#speichern');
    const neu = gewaehlt();
    knopf.disabled = true;
    knopf.textContent = 'Speichert …';
    try {
      // Im Testbetrieb wird bewusst nicht geschrieben: crud.js arbeitet dort
      // auf einer Kopie der Testdaten, mandant.js liest aber das Original.
      // Ein aendern() käme also durch und wäre nach dem Neuladen trotzdem weg –
      // "gespeichert" zu melden wäre gelogen. Die Farben greifen sofort, der
      // Hinweis unten sagt, wie lange.
      if (!zustand.test) {
        await aendern('firmen', ctx.firma.id, { design: neu });
      }

      // Damit die Farben beim Wechseln zwischen den Firmen erhalten
      // bleiben, ohne dass die Firmenliste neu geladen werden muss.
      ctx.firma.design = neu;
      wendeDesignAn({ ...ctx.firma, design: neu });

      hinweis(zustand.test
        ? 'Farben übernommen – im Testbetrieb nur bis zum Neuladen.'
        : 'Farben gespeichert.');
      ctx.neuLaden();
    } catch (fehler) {
      hinweis(fehler.message, true);
      knopf.disabled = false;
      knopf.textContent = 'Speichern';
    }
  };
}
