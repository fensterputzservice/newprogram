/* ============================================================
   Aktivitätsprotokoll – nur lesen

   Laut sql/02_rls.sql hat die Tabelle bewusst keine UPDATE- und
   keine DELETE-Regel: Anhängen darf jedes Mitglied, ändern und
   löschen niemand. Ein Protokoll, das man aufräumen kann, ist
   keins. Deshalb gibt es hier weder Anlegen noch Bearbeiten noch
   Löschen – das wäre kein fehlender Knopf, sondern einer, den der
   Server ohnehin abweisen würde.
   ============================================================ */

import { liste } from '../../kern/crud.js';
import {
  tabelle, werkzeugleiste, datum, uhrzeit,
  sicher, sucheVerdrahten, etikett,
} from '../../kern/ui.js';

/* Rollen wie in firmen_mitglieder – ein unbekannter Wert wird
   trotzdem angezeigt, statt zu verschwinden. */
const ROLLEN = {
  admin: { text: 'Admin', art: 'gut' },
  leitung: { text: 'Leitung', art: 'warnung' },
  mitarbeiter: { text: 'Mitarbeiter', art: 'ruhig' },
};

function rollenEtikett(wert) {
  const r = ROLLEN[wert];
  return r ? etikett(r.text, r.art) : etikett(wert ?? '—', 'ruhig');
}

export async function mountProtokoll(el, ctx) {
  const eintraege = await liste('aktivitaeten', {
    firma: ctx.firma.id,
    sortieren: 'created_at',
    absteigend: true,
  });

  el.innerHTML = `
    <div class="karte" style="margin-bottom:16px">
      <p style="margin:0">
        Das Protokoll lässt sich nicht bearbeiten und nicht löschen – auch nicht
        vom Admin. Ein Protokoll, das man aufräumen kann, wäre keines.
      </p>
    </div>
    ${werkzeugleiste({
      platzhalter: 'Benutzer oder Aktion …',
      knopf: null,
    })}
    ${tabelle({
      spalten: [
        { kopf: 'Zeitpunkt', breite: '1%',
          zelle: (a) => sicher(`${datum(a.created_at)}, ${uhrzeit(a.created_at)}`) },
        { kopf: 'Benutzer', zelle: (a) => sicher(a.user_label ?? '—') },
        { kopf: 'Rolle', breite: '1%', zelle: (a) => rollenEtikett(a.rolle) },
        { kopf: 'Aktion', zelle: (a) => sicher(a.aktion) },
      ],
      zeilen: eintraege,
      leer: 'Noch keine Einträge im Protokoll.',
    })}`;

  sucheVerdrahten(el);
}
