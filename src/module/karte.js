/* ============================================================
   Karte und Routenplanung

   Zwei Bereiche auf einer Grundlage: dieselbe Leaflet-Karte,
   einmal als Übersicht aller Standorte, einmal als Tagesroute.
   Die Routenplanung sieht nur Fensterputz – der Schalter dafür
   steht in firmen.module (flag: 'routenplanung').

   Leaflet wird erst beim Öffnen nachgeladen. So bleibt die
   index.html frei von Skript-Einbindungen, und wer die Karte nie
   aufruft, lädt sie auch nie.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { liste } from '../kern/crud.js';
import {
  sicher, hinweis, datum, uhrzeit, fehlerkarte, kennzahl, etikett, alsFelddatum,
} from '../kern/ui.js';

/* ============================================================
   Leaflet nachladen
   ============================================================ */

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_BILDER = 'https://unpkg.com/leaflet@1.9.4/dist/images/';

/** Läuft der Ladevorgang schon? Dann anhängen statt neu starten. */
let leafletVersprechen = null;

function ladeLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletVersprechen) return leafletVersprechen;

  if (!document.getElementById('leaflet-css')) {
    const stil = document.createElement('link');
    stil.id = 'leaflet-css';
    stil.rel = 'stylesheet';
    stil.href = LEAFLET_CSS;
    document.head.appendChild(stil);
  }

  leafletVersprechen = new Promise((fertig, misslungen) => {
    const skript = document.createElement('script');
    skript.id = 'leaflet-js';
    skript.src = LEAFLET_JS;
    skript.async = true;

    skript.onload = () => {
      if (!window.L) return misslungen(new Error('Leaflet ist nicht verfügbar.'));
      // Ohne diesen Pfad sucht Leaflet die Marker-Bilder neben der index.html.
      window.L.Icon.Default.imagePath = LEAFLET_BILDER;
      fertig(window.L);
    };
    skript.onerror = () => {
      // Aufräumen, damit der nächste Aufruf es erneut versuchen darf.
      skript.remove();
      leafletVersprechen = null;
      misslungen(new Error('Leaflet konnte nicht geladen werden.'));
    };

    document.head.appendChild(skript);
  });

  return leafletVersprechen;
}

const LADEFEHLER =
  'Die Kartenbibliothek konnte nicht geladen werden. '
  + 'Ohne Internetverbindung ist die Karte nicht verfügbar.';

/* ============================================================
   Karten verwalten

   Leaflet hängt sich an das DOM-Element. Wird ein Bereich neu
   gezeichnet, ist das alte Element weg, die Karte aber noch da –
   deshalb vor jedem Aufbau die alte schließen.
   ============================================================ */

const karten = new Map();

function schliesseKarten() {
  for (const karte of karten.values()) karte.remove();
  karten.clear();
}

const HANNOVER = [52.3759, 9.7320];
const HANNOVER_ZOOM = 11;

/** Grundkarte mit OpenStreetMap-Kacheln. */
function baueKarte(L, behaelter, id) {
  const karte = L.map(behaelter);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap-Mitwirkende',
  }).addTo(karte);
  karten.set(id, karte);
  return karte;
}

/** Auf alle Punkte zoomen – oder, wenn es keine gibt, auf die Region. */
function zeigeAlles(L, karte, punkte) {
  if (punkte.length) karte.fitBounds(L.latLngBounds(punkte), { padding: [40, 40], maxZoom: 15 });
  else karte.setView(HANNOVER, HANNOVER_ZOOM);
}

/* ============================================================
   Kleine Helfer
   ============================================================ */

/** null wird zu 0, wenn man Number() blind vertraut – hier nicht. */
function zahl(wert) {
  if (wert === null || wert === undefined || wert === '') return null;
  const z = Number(wert);
  return Number.isFinite(z) ? z : null;
}

/** Ein Datensatz zählt nur mit brauchbaren Koordinaten. */
function hatOrt(z) {
  const lat = zahl(z?.lat);
  const lng = zahl(z?.lng);
  return lat !== null && lng !== null
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

const ortVon = (z) => [Number(z.lat), Number(z.lng)];

/**
 * Die Mitarbeiterfarbe landet in style-Attributen und SVG.
 * Nur echte Hex-Farben durchlassen – alles andere ist Fremdtext.
 */
const farbeVon = (m, ersatz = '#0e7490') =>
  /^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$/.test(String(m?.farbe ?? '')) ? m.farbe : ersatz;

/** Kunden sind Privatpersonen oder Firmen. */
const kundenName = (k) =>
  !k ? '—'
    : (k.firma_name?.trim() || [k.vorname, k.nachname].filter(Boolean).join(' ') || 'Ohne Namen');

const mitarbeiterName = (m) =>
  !m ? '—' : ([m.vorname, m.nachname].filter(Boolean).join(' ') || 'Ohne Namen');

const ortszeile = (z) => [z?.plz, z?.ort].filter(Boolean).join(' ') || '—';

/** Der Tag eines Zeitstempels in Ortszeit – nicht in UTC. */
function tagVon(zeitpunkt) {
  const d = new Date(zeitpunkt);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS = {
  aktiv: { text: 'Aktiv', art: 'gut' },
  interessent: { text: 'Interessent', art: 'warnung' },
  pausiert: { text: 'Pausiert', art: 'ruhig' },
  beendet: { text: 'Beendet', art: 'schlecht' },
};

const statusEtikett = (wert) => {
  const s = STATUS[wert];
  return s ? etikett(s.text, s.art) : etikett(wert ?? '—', 'ruhig');
};

/* ---------- Sprechblasen. Das ist HTML – alles durch sicher(). ---------- */

const kundenBlase = (k) => `
  <div style="min-width:170px;line-height:1.45">
    <div style="font-weight:700;font-size:14px">${sicher(kundenName(k))}</div>
    <div style="margin-top:5px;color:#5b7683">
      ${sicher(k.strasse ?? '—')}<br>${sicher(ortszeile(k))}
    </div>
    <div style="margin-top:5px">${sicher(k.telefon ?? k.mobil ?? 'Keine Telefonnummer')}</div>
    <div style="margin-top:8px">${statusEtikett(k.status)}</div>
  </div>`;

const mitarbeiterBlase = (m) => `
  <div style="min-width:150px;line-height:1.45">
    <div style="font-weight:700;font-size:14px">${sicher(mitarbeiterName(m))}</div>
    <div style="margin-top:5px;color:#5b7683">${sicher(m.vertragsart ?? 'Ohne Vertragsart')}</div>
  </div>`;

/** Runder Punkt in der Farbe der Mitarbeiterin. */
const mitarbeiterPunkt = (L, m) =>
  L.circleMarker(ortVon(m), {
    radius: 9,
    color: '#ffffff',
    weight: 2,
    fillColor: farbeVon(m),
    fillOpacity: 0.95,
  }).bindPopup(mitarbeiterBlase(m));

/** Dezente Zeile unter der Karte. */
const fussnote = (zeilen) =>
  zeilen.length
    ? `<div style="margin-top:10px;font-size:13px;color:var(--muted)">${zeilen.map(sicher).join('<br>')}</div>`
    : '';

/** „1 Kunde“ / „3 Kunden“ – Zahlwort und Endung passen zusammen. */
const fehlenText = (anzahl, eins, viele) =>
  anzahl === 1
    ? `${anzahl} ${eins} ohne Koordinaten wird nicht angezeigt`
    : `${anzahl} ${viele} ohne Koordinaten werden nicht angezeigt`;

/* ============================================================
   Modul 1 · Karte
   ============================================================ */

registriere({
  id: 'karte',
  titel: 'Karte',
  zeichen: '⌖',
  rollen: ['admin', 'leitung'],

  async mount(el, ctx) {
    schliesseKarten();

    const [kunden, mitarbeiter] = await Promise.all([
      liste('kunden', { firma: ctx.firma.id }),
      liste('mitarbeiter', { firma: ctx.firma.id, sortieren: 'nachname' }),
    ]);

    let L;
    try {
      L = await ladeLeaflet();
    } catch {
      el.innerHTML = fehlerkarte(LADEFEHLER);
      return;
    }

    const kundenOrte = kunden.filter(hatOrt);
    const mitarbeiterOrte = mitarbeiter.filter(hatOrt);

    // Wer keine Koordinaten hat, verschwindet sonst lautlos.
    const fehlt = [];
    if (kunden.length - kundenOrte.length > 0) {
      fehlt.push(fehlenText(kunden.length - kundenOrte.length, 'Kunde', 'Kunden'));
    }
    if (mitarbeiter.length - mitarbeiterOrte.length > 0) {
      fehlt.push(fehlenText(mitarbeiter.length - mitarbeiterOrte.length, 'Mitarbeiter', 'Mitarbeiter'));
    }

    el.innerHTML = `
      <div class="werkzeuge">
        <label class="schalter">
          <input type="checkbox" id="zeige-kunden" checked>
          <span>Kunden anzeigen (${sicher(String(kundenOrte.length))})</span>
        </label>
        <label class="schalter">
          <input type="checkbox" id="zeige-mitarbeiter" checked>
          <span>Mitarbeiter anzeigen (${sicher(String(mitarbeiterOrte.length))})</span>
        </label>
      </div>
      <div class="karte" style="padding:0;overflow:hidden">
        <div id="karten-feld" style="height:560px"></div>
      </div>
      ${fussnote(fehlt)}`;

    const karte = baueKarte(L, el.querySelector('#karten-feld'), 'karte');

    const kundenSchicht = L.layerGroup(
      kundenOrte.map((k) => L.marker(ortVon(k)).bindPopup(kundenBlase(k))),
    ).addTo(karte);

    const mitarbeiterSchicht = L.layerGroup(
      mitarbeiterOrte.map((m) => mitarbeiterPunkt(L, m)),
    ).addTo(karte);

    zeigeAlles(L, karte, [...kundenOrte, ...mitarbeiterOrte].map(ortVon));

    // Der Behälter bekommt seine Größe erst jetzt – Leaflet muss nachmessen.
    karte.invalidateSize();

    // Umschalten heißt Schicht an oder aus. Kein Neuzeichnen, keine Ladezeit.
    const umschalten = (schalterId, schicht) => {
      const schalter = el.querySelector(schalterId);
      schalter.onchange = () => {
        if (schalter.checked) schicht.addTo(karte);
        else karte.removeLayer(schicht);
      };
    };
    umschalten('#zeige-kunden', kundenSchicht);
    umschalten('#zeige-mitarbeiter', mitarbeiterSchicht);
  },
});

/* ============================================================
   Modul 2 · Routenplanung  (nur Fensterputz)
   ============================================================ */

const ERDRADIUS = 6371; // km
const bogen = (grad) => (grad * Math.PI) / 180;

/**
 * Luftlinie zwischen zwei Punkten (Haversine), in Kilometern.
 * Das ist die Strecke über die Kugel – nicht über die Straße.
 */
function luftlinie(a, b) {
  const dLat = bogen(b[0] - a[0]);
  const dLng = bogen(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(bogen(a[0])) * Math.cos(bogen(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * ERDRADIUS * Math.asin(Math.min(1, Math.sqrt(x)));
}

const km = (wert) =>
  `${wert.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

/** Nummerierter Marker in der Farbe der Mitarbeiterin. */
const nummerZeichen = (L, nummer, farbe) =>
  L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${sicher(farbe)};
             color:#fff;border:2px solid #fff;text-align:center;font-weight:700;
             font-size:13px;line-height:22px;box-shadow:0 1px 5px rgba(0,0,0,.4)"
           >${sicher(String(nummer))}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -15],
  });

registriere({
  id: 'routenplanung',
  titel: 'Routenplanung',
  zeichen: '⤳',
  flag: 'routenplanung',           // in firmen.module – bei Alltagshilfe false
  rollen: ['admin', 'leitung'],

  async mount(el, ctx) {
    schliesseKarten();

    let mitarbeiter, kunden, termine;
    try {
      [mitarbeiter, kunden, termine] = await Promise.all([
        liste('mitarbeiter', { firma: ctx.firma.id, sortieren: 'nachname' }),
        liste('kunden', { firma: ctx.firma.id }),
        liste('termine', { firma: ctx.firma.id, sortieren: 'start_at' }),
      ]);
    } catch (fehler) {
      hinweis(fehler.message, true);
      throw fehler;
    }

    if (!mitarbeiter.length) {
      el.innerHTML = `
        <div class="karte"><div class="platzhalter">
          <span class="zeichen">⤳</span>
          <h2>Noch keine Mitarbeiter</h2>
          <p style="max-width:420px;margin:0 auto">
            Eine Route braucht jemanden, der sie fährt. Lege zuerst unter
            „Mitarbeiter“ jemanden an.
          </p>
        </div></div>`;
      return;
    }

    let L;
    try {
      L = await ladeLeaflet();
    } catch {
      el.innerHTML = fehlerkarte(LADEFEHLER);
      return;
    }

    const kundeNach = new Map(kunden.map((k) => [k.id, k]));

    // Auswahl lebt hier, nicht im DOM: ctx.neuLaden() würde die Karte
    // wegwerfen und neu aufbauen. Es ändern sich nur die Marker.
    let tag = alsFelddatum(new Date());
    let mitarbeiterId = mitarbeiter[0].id;

    el.innerHTML = `
      <div class="werkzeuge">
        <input class="feld" type="date" id="tag" value="${sicher(tag)}" style="max-width:180px">
        <select class="feld" id="wer" style="max-width:260px">
          ${mitarbeiter.map((m) =>
            `<option value="${sicher(m.id)}">${sicher(mitarbeiterName(m))}</option>`).join('')}
        </select>
      </div>
      <div class="kennzahlen" id="zahlen"></div>
      <div class="karte" style="padding:0;overflow:hidden">
        <div id="karten-feld" style="height:560px"></div>
      </div>
      <div id="fuss"></div>
      <div id="stationen" style="margin-top:18px"></div>`;

    const karte = baueKarte(L, el.querySelector('#karten-feld'), 'routenplanung');
    const routenSchicht = L.layerGroup().addTo(karte);
    karte.setView(HANNOVER, HANNOVER_ZOOM);
    karte.invalidateSize();

    const zahlenFeld = el.querySelector('#zahlen');
    const fussFeld = el.querySelector('#fuss');
    const stationenFeld = el.querySelector('#stationen');
    const tagFeld = el.querySelector('#tag');
    const werFeld = el.querySelector('#wer');

    tagFeld.onchange = () => { tag = tagFeld.value; zeichne(); };
    werFeld.onchange = () => { mitarbeiterId = werFeld.value; zeichne(); };

    function zeichne() {
      const wer = mitarbeiter.find((m) => m.id === mitarbeiterId);
      const farbe = farbeVon(wer);

      // Chronologisch: die Reihenfolge der Termine ist die Route.
      const tagestermine = termine
        .filter((t) => t.mitarbeiter_id === mitarbeiterId && tagVon(t.start_at) === tag)
        .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

      routenSchicht.clearLayers();

      if (!tagestermine.length) {
        zahlenFeld.innerHTML = '';
        fussFeld.innerHTML = '';
        stationenFeld.innerHTML = `
          <div class="karte"><div class="platzhalter">
            <span class="zeichen">☕</span>
            <h2>Keine Termine an diesem Tag</h2>
            <p style="max-width:440px;margin:0 auto">
              Für ${sicher(mitarbeiterName(wer))} ist am ${sicher(datum(tag))}
              nichts eingetragen. Wähle einen anderen Tag oder eine andere Person.
            </p>
          </div></div>`;
        karte.setView(HANNOVER, HANNOVER_ZOOM);
        return;
      }

      // Stationen sind Termine mit Kunde und Koordinaten – die anderen
      // stehen in der Liste, aber können nicht auf die Karte.
      const stationen = tagestermine.map((t) => ({ termin: t, kunde: kundeNach.get(t.kunde_id) }));
      const aufKarte = stationen.filter((s) => hatOrt(s.kunde));
      const punkte = aufKarte.map((s) => ortVon(s.kunde));

      aufKarte.forEach((s, i) => {
        L.marker(ortVon(s.kunde), { icon: nummerZeichen(L, i + 1, farbe) })
          .bindPopup(`
            <div style="min-width:170px;line-height:1.45">
              <div style="font-weight:700;font-size:14px">
                ${sicher(String(i + 1))}. ${sicher(kundenName(s.kunde))}
              </div>
              <div style="margin-top:5px">
                ${sicher(uhrzeit(s.termin.start_at))} – ${sicher(uhrzeit(s.termin.ende_at))}
              </div>
              <div style="margin-top:5px;color:#5b7683">
                ${sicher(s.kunde.strasse ?? '—')}<br>${sicher(ortszeile(s.kunde))}
              </div>
            </div>`)
          .addTo(routenSchicht);
      });

      if (punkte.length > 1) {
        L.polyline(punkte, { color: farbe, weight: 4, opacity: 0.75 }).addTo(routenSchicht);
      }

      zeigeAlles(L, karte, punkte);

      // Summe der Luftlinien zwischen aufeinanderfolgenden Stationen.
      let strecke = 0;
      for (let i = 1; i < punkte.length; i++) strecke += luftlinie(punkte[i - 1], punkte[i]);

      const erster = tagestermine[0];
      const letzter = tagestermine[tagestermine.length - 1];

      zahlenFeld.innerHTML = `
        ${kennzahl('Stationen', stationen.length, `${mitarbeiterName(wer)} · ${datum(tag)}`)}
        ${kennzahl('Arbeitszeit', `${uhrzeit(erster.start_at)} – ${uhrzeit(letzter.ende_at)}`,
          'erster Termin bis letzter Termin')}
        ${kennzahl(
          'Strecke (Luftlinie)',
          punkte.length > 1 ? km(strecke) : '—',
          'Luftlinie zwischen den Stationen – keine Fahrstrecke',
        )}`;

      const ohneOrt = stationen.length - aufKarte.length;
      fussFeld.innerHTML = fussnote([
        'Die Strecke ist die Luftlinie zwischen den Stationen, keine Fahrstrecke. '
        + 'Die tatsächliche Fahrstrecke ist länger und bräuchte einen Routing-Dienst.',
        ...(ohneOrt
          ? [ohneOrt === 1
            ? '1 Station ohne Koordinaten des Kunden wird nicht auf der Karte angezeigt'
            : `${ohneOrt} Stationen ohne Koordinaten des Kunden werden nicht auf der Karte angezeigt`]
          : []),
      ]);

      // Die Nummer der Liste ist die Nummer auf der Karte. Stationen ohne
      // Koordinaten bekommen deshalb keine, sondern einen Strich.
      const nummern = new Map(aufKarte.map((s, i) => [s.termin.id, i + 1]));

      stationenFeld.innerHTML = `
        <div class="karte">
          <div style="font-weight:700;margin-bottom:4px">Stationen des Tages</div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:14px">
            ${sicher(mitarbeiterName(wer))} · ${sicher(datum(tag))}
          </div>
          ${stationen.map((s) => {
            const nr = nummern.get(s.termin.id);
            return `
              <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;
                          border-top:1px solid var(--line)">
                <span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;
                             background:${sicher(nr ? farbe : 'var(--line)')};
                             color:${sicher(nr ? '#fff' : 'var(--muted)')};
                             text-align:center;line-height:26px;font-weight:700;font-size:13px"
                >${sicher(nr ? String(nr) : '–')}</span>
                <div style="min-width:0">
                  <div style="font-weight:600">
                    ${sicher(uhrzeit(s.termin.start_at))} – ${sicher(uhrzeit(s.termin.ende_at))}
                    · ${sicher(kundenName(s.kunde))}
                  </div>
                  <div style="font-size:13px;color:var(--muted)">
                    ${sicher(s.kunde
                      ? [s.kunde.strasse, ortszeile(s.kunde)].filter(Boolean).join(', ')
                      : 'Kein Kunde am Termin hinterlegt')}
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>`;
    }

    zeichne();
  },
});
