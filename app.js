/* ============================================================
   Daily Do – Start und Ablaufsteuerung

   Anmeldung  →  Firmenauswahl  →  Anwendung
   ============================================================ */

import { $, zeige, hinweis, sicher } from './kern/ui.js';
import { zustand, anmelden, abmelden, sitzung } from './kern/auth.js';
import {
  mandant, ladeFirmen, betrete, verlasse, gemerkteFirma, firmenfarbe,
} from './kern/mandant.js';
import { moduleFuer, modulNach, startModul } from './kern/registry.js';
import './module/alle.js';

let offenesModul = null;
const ausgeklappt = new Set();

const ROLLENNAME = { admin: 'Administrator', leitung: 'Leitung', mitarbeiter: 'Mitarbeiter' };

/* ============================================================
   Start
   ============================================================ */
async function start() {
  verdrahte();

  try {
    const benutzer = await sitzung();
    if (benutzer) return nachAnmeldung();
  } catch (e) {
    console.warn('Sitzung konnte nicht geprüft werden:', e);
  }
  zeige('anmeldung');
}

function verdrahte() {
  $('anmelde-form').addEventListener('submit', beiAnmeldung);
  $('abmelden').addEventListener('click', beiAbmeldung);
  $('wahl-abmelden').addEventListener('click', beiAbmeldung);
  $('wechsler').addEventListener('click', zurueckZurWahl);
  $('leiste-schalter').addEventListener('click', () =>
    $('seitenleiste').classList.toggle('offen')
  );
}

/* ============================================================
   Anmeldung
   ============================================================ */
async function beiAnmeldung(e) {
  e.preventDefault();
  const knopf = $('an-knopf');
  knopf.disabled = true;
  knopf.textContent = 'Einen Moment …';

  try {
    await anmelden($('an-email').value, $('an-pass').value);
    $('an-pass').value = '';
    await nachAnmeldung();
  } catch (fehler) {
    hinweis(fehler.message, true);
  } finally {
    knopf.disabled = false;
    knopf.textContent = 'Anmelden';
  }
}

async function beiAbmeldung() {
  await abmelden();
  verlasse();
  offenesModul = null;
  ausgeklappt.clear();
  zeige('anmeldung');
}

/**
 * Nach der Anmeldung entscheidet die Zahl der Firmen:
 * mehrere → Kacheln, genau eine → direkt hinein.
 */
async function nachAnmeldung() {
  try {
    const firmen = await ladeFirmen();

    if (firmen.length === 0) {
      hinweis('Dieser Zugang ist keiner Firma zugeordnet. Bitte beim Administrator melden.', true);
      await abmelden();
      return zeige('anmeldung');
    }

    if (firmen.length === 1) {
      betrete(firmen[0].id);
      return zeigeAnwendung();
    }

    const gemerkt = gemerkteFirma();
    if (gemerkt) {
      betrete(gemerkt);
      return zeigeAnwendung();
    }

    zeigeFirmenwahl();
  } catch (fehler) {
    hinweis(fehler.message, true);
    zeige('anmeldung');
  }
}

/* ============================================================
   Firmenauswahl – die zwei Kacheln
   ============================================================ */
function zeigeFirmenwahl() {
  verlasse();
  offenesModul = null;

  $('wahl-untertitel').textContent =
    `Angemeldet als ${zustand.benutzer.name}. ` +
    `Du hast Zugriff auf ${mandant.firmen.length} Firmen.`;

  $('wahl-kacheln').innerHTML = mandant.firmen.map((f) => {
    const farbe = firmenfarbe(f);
    const weich = f.design?.['petrol-soft'] ?? '#f0e9ff';
    const dunkel = f.design?.['petrol-dark'] ?? farbe;
    return `
      <button class="kachel" data-firma="${sicher(f.id)}">
        <span class="kachel-streifen" style="background:${sicher(farbe)}"></span>
        <div class="kachel-name" style="color:${sicher(dunkel)}">${sicher(f.name)}</div>
        <div class="kachel-firma">${sicher(f.firma)}</div>
        <div class="kachel-firma" style="margin-top:8px">
          ${sicher(f.strasse ?? '')} · ${sicher(f.plz ?? '')} ${sicher(f.ort ?? '')}
        </div>
        <span class="kachel-rolle" style="background:${sicher(weich)};color:${sicher(dunkel)}">
          ${sicher(ROLLENNAME[f.rolle] ?? f.rolle)}
        </span>
      </button>`;
  }).join('');

  $('wahl-kacheln').querySelectorAll('[data-firma]').forEach((k) => {
    k.addEventListener('click', () => {
      betrete(k.dataset.firma);
      zeigeAnwendung();
    });
  });

  zeige('firmenwahl');
}

function zurueckZurWahl() {
  if (mandant.firmen.length < 2) return hinweis('Es gibt nur eine Firma.');
  zeigeFirmenwahl();
}

/* ============================================================
   Anwendung
   ============================================================ */
function zeigeAnwendung() {
  const f = mandant.aktiv;

  $('leiste-firma').textContent = f.name;
  $('leiste-rolle').textContent = ROLLENNAME[mandant.rolle] ?? mandant.rolle;
  $('wechsler-name').textContent = f.name;
  $('wechsler-punkt').style.background = firmenfarbe(f);
  $('demo-streifen').classList.toggle('verborgen', !zustand.test);
  $('wechsler').classList.toggle('verborgen', mandant.firmen.length < 2);

  baueNav();

  const start = startModul(f, mandant.rolle);
  if (!start) {
    $('buehne').innerHTML =
      '<div class="karte"><div class="platzhalter">Für diese Rolle ist kein Bereich freigeschaltet.</div></div>';
    $('kopf-titel').textContent = '';
  } else {
    oeffne(start);
  }

  zeige('anwendung');
}

function baueNav() {
  const module = moduleFuer(mandant.aktiv, mandant.rolle);

  $('nav').innerHTML = module.map((m) => {
    const hatUnter = (m.unter ?? []).length > 0;
    const auf = ausgeklappt.has(m.id);

    const kopf = `
      <button class="navpunkt ${offenesModul === m.id ? 'aktiv' : ''}" data-modul="${sicher(m.id)}">
        <span class="zeichen">${m.zeichen ?? '•'}</span>
        <span>${sicher(m.titel)}</span>
        ${hatUnter ? `<span class="nav-pfeil ${auf ? 'auf' : ''}">▶</span>` : ''}
      </button>`;

    const unter = hatUnter && auf
      ? m.unter.map((u) => `
          <button class="navpunkt unter ${offenesModul === u.id ? 'aktiv' : ''}" data-modul="${sicher(u.id)}">
            <span>${sicher(u.titel)}</span>
          </button>`).join('')
      : '';

    return kopf + unter;
  }).join('');

  $('nav').querySelectorAll('[data-modul]').forEach((k) => {
    k.addEventListener('click', () => oeffne(k.dataset.modul));
  });
}

/** Einen Bereich öffnen. */
function oeffne(id) {
  const modul = modulNach(id, mandant.aktiv, mandant.rolle);
  if (!modul) return hinweis('Dieser Bereich steht nicht zur Verfügung.', true);

  // Menüpunkte mit Untermenü klappen auf, statt selbst zu öffnen.
  if ((modul.unter ?? []).length > 0 && !modul.render) {
    ausgeklappt.has(id) ? ausgeklappt.delete(id) : ausgeklappt.add(id);
    return baueNav();
  }
  if ((modul.unter ?? []).length > 0) ausgeklappt.add(id);

  offenesModul = id;
  $('kopf-titel').textContent = modul.titel;
  $('seitenleiste').classList.remove('offen');

  try {
    $('buehne').innerHTML = modul.render({
      firma: mandant.aktiv,
      rolle: mandant.rolle,
      benutzer: zustand.benutzer,
    });
  } catch (fehler) {
    console.error(fehler);
    $('buehne').innerHTML =
      `<div class="karte"><div class="platzhalter">
        <span class="zeichen">⚠</span>
        <h2>${sicher(modul.titel)} konnte nicht geladen werden</h2>
        <p>${sicher(fehler.message)}</p>
      </div></div>`;
  }

  baueNav();
}

start();
