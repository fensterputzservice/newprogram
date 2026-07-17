/* ============================================================
   Lohnabrechnung

   Dieser Bereich erfasst und dokumentiert Werte – er rechnet
   nicht. Die eigentliche Abrechnung macht die AS Abrechnungs-
   stelle Bremen. Deshalb gibt es hier bewusst keine Lohnsteuer-
   und keine Sozialversicherungsberechnung: Brutto und Netto
   werden eingetragen, nicht hergeleitet.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste, anlegen, aendern, loeschen } from '../kern/crud.js';
import {
  sicher, hinweis, euro, stunden, tabelle, werkzeugleiste,
  formularDialog, bestaetige, inhaltsDialog, sucheVerdrahten, etikett, kennzahl,
} from '../kern/ui.js';

/* Der gewählte Monat überlebt ctx.neuLaden() – sonst springt die
   Ansicht nach jedem Speichern zurück auf den aktuellen Monat. */
const jetztMonat = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
let gewaehlterMonat = jetztMonat();

/* Status: Text für die Anzeige, Art für die Farbe des Etiketts. */
const STATUS = {
  entwurf:    { text: 'Entwurf',    art: 'warnung' },
  final:      { text: 'Final',      art: '' },
  ausgezahlt: { text: 'Ausgezahlt', art: 'gut' },
};

const mitarbeiterName = (m) =>
  m ? `${m.vorname ?? ''} ${m.nachname ?? ''}`.trim() : '— unbekannt —';

/** Nur diese Stunden sind belastbar – offene Zettel sind noch in Prüfung. */
const ZAEHLT = ['freigegeben', 'abgerechnet'];

/* ============================================================
   Stunden übernehmen

   Reine Anzeige. Die Summen sind eine Lesehilfe für die Eingabe,
   keine Abrechnung – deshalb wird hier nichts geschrieben.
   ============================================================ */
async function zeigeStunden(firma, monat, mitarbeiter) {
  const zettel = await liste('stundenzettel', { firma });

  const imMonat = zettel.filter(
    (z) => (z.datum ?? '').slice(0, 7) === monat && ZAEHLT.includes(z.status)
  );

  const summen = new Map();
  for (const z of imMonat) {
    const bisher = summen.get(z.mitarbeiter_id) ?? { stunden: 0, zettel: 0 };
    bisher.stunden += Number(z.stunden) || 0;
    bisher.zettel += 1;
    summen.set(z.mitarbeiter_id, bisher);
  }

  const zeilen = mitarbeiter
    .map((m) => ({ m, ...(summen.get(m.id) ?? { stunden: 0, zettel: 0 }) }))
    .filter((r) => r.zettel > 0)
    .sort((a, b) => b.stunden - a.stunden);

  const gesamt = zeilen.reduce((s, r) => s + r.stunden, 0);

  const inhalt = zeilen.length
    ? `<p style="color:var(--muted);font-size:13.5px;margin-bottom:14px">
         Freigegebene und abgerechnete Stundenzettel im Monat ${sicher(monat)}.
         Die Werte sind eine Hilfe für die Eingabe – sie werden nicht übernommen.
       </p>
       <table class="liste">
         <thead><tr><th>Mitarbeiter</th><th>Zettel</th><th>Stunden</th></tr></thead>
         <tbody>
           ${zeilen.map((r) => `
             <tr>
               <td>${sicher(mitarbeiterName(r.m))}</td>
               <td>${sicher(String(r.zettel))}</td>
               <td><strong>${sicher(stunden(r.stunden))}</strong></td>
             </tr>`).join('')}
           <tr>
             <td><strong>Gesamt</strong></td>
             <td></td>
             <td><strong>${sicher(stunden(gesamt))}</strong></td>
           </tr>
         </tbody>
       </table>`
    : `<div style="color:var(--muted);padding:14px 0">
         Für ${sicher(monat)} gibt es keine freigegebenen oder abgerechneten Stundenzettel.
       </div>`;

  inhaltsDialog({ titel: `Stunden aus Stundenzetteln · ${monat}`, inhalt });
}

/* ============================================================
   Formular
   ============================================================ */
function felder(mitarbeiter) {
  return [
    {
      name: 'mitarbeiter_id', label: 'Mitarbeiter', art: 'select', pflicht: true,
      optionen: mitarbeiter.map((m) => ({ wert: m.id, text: mitarbeiterName(m) })),
    },
    {
      name: 'monat', label: 'Monat', art: 'text', pflicht: true,
      hinweis: 'Format JJJJ-MM, z. B. 2026-07',
    },
    { name: 'stunden', label: 'Stunden', art: 'number', schritt: '0.01' },
    { name: 'brutto', label: 'Brutto', art: 'number', schritt: '0.01' },
    { name: 'netto', label: 'Netto', art: 'number', schritt: '0.01' },
    {
      name: 'status', label: 'Status', art: 'select', pflicht: true,
      optionen: [
        { wert: 'entwurf', text: 'Entwurf' },
        { wert: 'final', text: 'Final' },
        { wert: 'ausgezahlt', text: 'Ausgezahlt' },
      ],
    },
  ];
}

async function bearbeite(ctx, mitarbeiter, zeile = null) {
  const gespeichert = await formularDialog({
    titel: zeile ? 'Abrechnung bearbeiten' : 'Neue Abrechnung',
    felder: felder(mitarbeiter),
    werte: zeile ?? { monat: gewaehlterMonat, status: 'entwurf' },
    aufSpeichern: async (werte) => {
      // Die Datenbank hat unique(firma_id, mitarbeiter_id, monat):
      // ein Mitarbeiter, ein Monat, eine Abrechnung. Verstößt die
      // Eingabe dagegen, meldet Postgres 23505. crud.js macht daraus
      // "Diesen Eintrag gibt es bereits." – hier wird der Satz für
      // diesen Bereich noch deutlicher gefasst.
      try {
        if (zeile) await aendern('lohnabrechnungen', zeile.id, werte);
        else await anlegen('lohnabrechnungen', werte, ctx.firma.id);
      } catch (fehler) {
        if (/gibt es bereits/i.test(fehler.message)) {
          throw new Error(
            'Für diesen Mitarbeiter gibt es in diesem Monat schon eine Abrechnung.'
          );
        }
        throw fehler;
      }
    },
  });

  if (gespeichert) {
    hinweis('Gespeichert.');
    ctx.neuLaden();
  }
}

/* ============================================================
   Modul
   ============================================================ */
registriere({
  id: 'lohn',
  titel: 'Lohnabrechnung',
  zeichen: '€',

  mount: async (el, ctx) => {
    const firma = ctx.firma.id;

    const [roh, mitarbeiter] = await Promise.all([
      liste('lohnabrechnungen', { firma, wo: { monat: gewaehlterMonat } }),
      liste('mitarbeiter', { firma, sortieren: 'nachname' }),
    ]);

    const maNach = new Map(mitarbeiter.map((m) => [m.id, m]));

    // Innerhalb eines Monats ist die Sortierung nach Namen die einzige,
    // die man lesen kann – nach mitarbeiter_id wäre sie zufällig.
    const zeilen = [...roh].sort((a, b) =>
      mitarbeiterName(maNach.get(a.mitarbeiter_id))
        .localeCompare(mitarbeiterName(maNach.get(b.mitarbeiter_id)), 'de')
    );

    const summe = (spalte) =>
      zeilen.reduce((s, z) => s + (Number(z[spalte]) || 0), 0);

    el.innerHTML = `
      <div class="werkzeuge">
        <input class="feld" type="month" id="monat-wahl" style="max-width:190px"
               value="${sicher(gewaehlterMonat)}">
        <button class="knopf stumm" id="monat-zeigen">Monat anzeigen</button>
        <button class="knopf stumm" id="stunden-hilfe">Stunden übernehmen</button>
      </div>

      <div class="kennzahlen">
        ${kennzahl('Abrechnungen im Monat', zeilen.length)}
        ${kennzahl('Summe Brutto', euro(summe('brutto')))}
        ${kennzahl('Summe Netto', euro(summe('netto')))}
      </div>

      ${werkzeugleiste({
        suche: true,
        platzhalter: 'Mitarbeiter suchen …',
        knopf: { id: 'neu', text: '+ Neue Abrechnung' },
      })}

      <div style="font-size:13px;color:var(--muted);margin:-6px 0 14px;line-height:1.5">
        Die Lohnabrechnung selbst läuft über die AS Abrechnungsstelle Bremen.
        Dieser Bereich erfasst und dokumentiert die Werte – er berechnet keine
        Lohnsteuer und keine Sozialabgaben.
      </div>

      ${tabelle({
        spalten: [
          { kopf: 'Mitarbeiter', zelle: (z) => sicher(mitarbeiterName(maNach.get(z.mitarbeiter_id))) },
          { kopf: 'Monat', breite: '110px', zelle: (z) => sicher(z.monat ?? '—') },
          { kopf: 'Stunden', breite: '110px', zelle: (z) => sicher(stunden(z.stunden)) },
          { kopf: 'Brutto', breite: '130px', zelle: (z) => sicher(euro(z.brutto)) },
          { kopf: 'Netto', breite: '130px', zelle: (z) => sicher(euro(z.netto)) },
          { kopf: 'Status', breite: '120px', zelle: (z) => {
              const s = STATUS[z.status];
              return etikett(s?.text ?? z.status ?? '—', s?.art ?? '');
            } },
        ],
        zeilen,
        leer: `Für ${gewaehlterMonat} ist noch keine Abrechnung erfasst.`,
        aktionen: (z) => `
          <button data-bearbeiten="${sicher(z.id)}">Bearbeiten</button>
          <button class="loeschen" data-loeschen="${sicher(z.id)}">Löschen</button>`,
      })}`;

    sucheVerdrahten(el);

    /* --- Monatswahl --- */
    const feld = el.querySelector('#monat-wahl');
    const uebernehmen = () => {
      if (!feld.value) return hinweis('Bitte einen Monat wählen.', true);
      gewaehlterMonat = feld.value;
      ctx.neuLaden();
    };
    el.querySelector('#monat-zeigen').onclick = uebernehmen;
    feld.onkeydown = (e) => { if (e.key === 'Enter') uebernehmen(); };

    /* --- Stunden als Lesehilfe --- */
    el.querySelector('#stunden-hilfe').onclick = () =>
      zeigeStunden(firma, feld.value || gewaehlterMonat, mitarbeiter);

    /* --- Anlegen / Bearbeiten / Löschen --- */
    el.querySelector('#neu').onclick = () => {
      if (!mitarbeiter.length) {
        return hinweis('Erst Mitarbeiter anlegen, dann abrechnen.', true);
      }
      bearbeite(ctx, mitarbeiter);
    };

    el.querySelectorAll('[data-bearbeiten]').forEach((k) => {
      k.onclick = () =>
        bearbeite(ctx, mitarbeiter, zeilen.find((z) => z.id === k.dataset.bearbeiten));
    });

    el.querySelectorAll('[data-loeschen]').forEach((k) => {
      k.onclick = async () => {
        const z = zeilen.find((x) => x.id === k.dataset.loeschen);
        const ok = await bestaetige(
          `Abrechnung von ${mitarbeiterName(maNach.get(z.mitarbeiter_id))} für ${z.monat} löschen?`,
          { knopfText: 'Löschen', gefahr: true }
        );
        if (!ok) return;
        try {
          await loeschen('lohnabrechnungen', z.id);
          hinweis('Gelöscht.');
          ctx.neuLaden();
        } catch (fehler) {
          hinweis(fehler.message, true);
        }
      };
    });
  },
});
