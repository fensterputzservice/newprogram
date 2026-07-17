/* ============================================================
   Beispieldaten für den Testbetrieb

   Spiegeln, was sql/03_seed.sql in die echte Datenbank schreibt,
   plus etwas Bewegung, damit die Bereiche nicht leer aussehen.
   Erfundene Personen – keine echten Kundendaten.
   ============================================================ */

export const TEST_FIRMEN = [
  {
    id: 'test-fensterputz',
    slug: 'fensterputz',
    name: 'Fensterputz-Service',
    firma: 'Fensterputz-Service UG (haftungsbeschränkt)',
    strasse: 'Bahnhofstraße 85', plz: '31515', ort: 'Wunstorf',
    telefon: '', email: 'info@fensterputz-service.de',
    webseite: 'https://fensterputz-service.de',
    geschaeftsfuehrer: 'Daniel Dmytrov',
    sortierung: 1,
    design: {
      petrol: '#0e7490', 'petrol-dark': '#0b5566', 'petrol-soft': '#e0f2fe',
      amber: '#f59e0b', 'amber-soft': '#fef3c7',
      ink: '#10262e', muted: '#5b7683', line: '#d9e8ef',
      bg: '#f5f9fc', card: '#ffffff',
    },
    module: {
      dashboard: true, karte: true, routenplanung: true, kunden: true,
      mitarbeiter: true, kommunikation: true, stundenzettel: true,
      lohn: true, notizen: true, kalender: true, einstellungen: true,
    },
  },
  {
    id: 'test-alltagshilfe',
    slug: 'alltagshilfe',
    name: 'Alltagshilfe Hannover',
    firma: 'Alltagshilfe Hannover UG (haftungsbeschränkt)',
    strasse: 'Bahnhofstraße 85', plz: '31515', ort: 'Wunstorf',
    telefon: '', email: '',
    geschaeftsfuehrer: 'Daniel Dmytrov',
    sortierung: 2,
    design: {
      petrol: '#6d28d9', 'petrol-dark': '#4c1d95', 'petrol-soft': '#f0e9ff',
      amber: '#ff6b9d', 'amber-soft': '#ffe4ee',
      ink: '#1f1633', muted: '#6b6480', line: '#e8e2f5',
      bg: '#f7f5fc', card: '#ffffff',
    },
    module: {
      dashboard: true, karte: true, routenplanung: false, kunden: true,
      mitarbeiter: true, kommunikation: true, stundenzettel: true,
      lohn: true, notizen: true, kalender: true, einstellungen: true,
    },
  },
];

const FP = 'test-fensterputz';
const AH = 'test-alltagshilfe';

/** Tage relativ zu heute – damit der Kalender immer etwas zeigt. */
const tag = (versatz, stunde = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + versatz);
  d.setHours(stunde, minute, 0, 0);
  return d.toISOString();
};
const datumNur = (versatz) => {
  const d = new Date();
  d.setDate(d.getDate() + versatz);
  return d.toISOString().slice(0, 10);
};
const monat = () => new Date().toISOString().slice(0, 7);

export const TEST_DATEN = {
  // Damit „Design und Farben" auch im Testbetrieb speichern kann.
  firmen: TEST_FIRMEN,

  mitarbeiter: [
    { id: 'ma-1', firma_id: AH, vorname: 'Bianca', nachname: 'Campe', email: 'bianca@example.de',
      telefon: '0511 1234501', strasse: 'Lange Laube 12', plz: '30159', ort: 'Hannover',
      eintritt: '2021-03-01', stundenlohn: 16.5, wochenstunden: 38, vertragsart: 'Vollzeit',
      farbe: '#6d28d9', status: 'aktiv', skills: ['Betreuung', 'Einsatzleitung'],
      lat: 52.3759, lng: 9.7320 },
    { id: 'ma-2', firma_id: AH, vorname: 'Laura', nachname: 'Duske', email: 'laura@example.de',
      telefon: '0511 1234502', strasse: 'Podbielskistraße 4', plz: '30163', ort: 'Hannover',
      eintritt: '2023-06-15', stundenlohn: 14.0, wochenstunden: 20, vertragsart: 'Midijob',
      farbe: '#ff6b9d', status: 'aktiv', skills: ['Hauswirtschaft'],
      lat: 52.3900, lng: 9.7580 },
    { id: 'ma-3', firma_id: AH, vorname: 'Maria', nachname: 'Riena', email: 'maria@example.de',
      telefon: '0511 1234503', strasse: 'Vahrenwalder Str. 90', plz: '30165', ort: 'Hannover',
      eintritt: '2024-01-08', stundenlohn: 13.5, wochenstunden: 10, vertragsart: 'Minijob',
      farbe: '#16a34a', status: 'aktiv', skills: ['Betreuung'],
      lat: 52.4020, lng: 9.7350 },
    { id: 'ma-4', firma_id: FP, vorname: 'Nadine', nachname: 'Pickert', email: 'nadine@example.de',
      telefon: '05031 123401', strasse: 'Bahnhofstraße 85', plz: '31515', ort: 'Wunstorf',
      eintritt: '2022-09-01', stundenlohn: 15.2, wochenstunden: 30, vertragsart: 'Teilzeit',
      farbe: '#0e7490', status: 'aktiv', skills: ['Glasreinigung', 'Rahmen'],
      lat: 52.4230, lng: 9.4340 },
    { id: 'ma-5', firma_id: FP, vorname: 'Tobias', nachname: 'Kern', email: 'tobias@example.de',
      telefon: '05031 123402', strasse: 'Hagenburger Str. 7', plz: '31515', ort: 'Wunstorf',
      eintritt: '2025-04-01', stundenlohn: 14.8, wochenstunden: 38, vertragsart: 'Vollzeit',
      farbe: '#f59e0b', status: 'aktiv', skills: ['Glasreinigung', 'Hebebühne'],
      lat: 52.4180, lng: 9.4420 },
  ],

  kostentraeger: [
    { id: 'kt-1', firma_id: AH, name: 'AOK Niedersachsen', strasse: 'Hildesheimer Str. 273',
      plz: '30519', ort: 'Hannover', email: 'pflege@aok-nds.example', ik_nummer: '101317013' },
    { id: 'kt-2', firma_id: AH, name: 'Techniker Krankenkasse', strasse: 'Bramfelder Str. 140',
      plz: '22305', ort: 'Hamburg', email: 'pflege@tk.example', ik_nummer: '101575519' },
    { id: 'kt-3', firma_id: FP, name: 'Privatkunde (Direktrechnung)', strasse: null,
      plz: null, ort: null, email: null, ik_nummer: null },
  ],

  leistungen: [
    { id: 'ls-1', firma_id: AH, name: 'Entlastungsleistung §45b', preis: 32.0, einheit: 'Stunde', ust_satz: 0, aktiv: true },
    { id: 'ls-2', firma_id: AH, name: 'Betreuung / Begleitung', preis: 32.0, einheit: 'Stunde', ust_satz: 0, aktiv: true },
    { id: 'ls-3', firma_id: AH, name: 'Hauswirtschaftliche Hilfe', preis: 30.0, einheit: 'Stunde', ust_satz: 0, aktiv: true },
    { id: 'ls-4', firma_id: FP, name: 'Fensterreinigung innen + außen', preis: 4.5, einheit: 'qm', ust_satz: 19, aktiv: true },
    { id: 'ls-5', firma_id: FP, name: 'Rahmenreinigung', preis: 2.0, einheit: 'qm', ust_satz: 19, aktiv: true },
    { id: 'ls-6', firma_id: FP, name: 'Anfahrt', preis: 25.0, einheit: 'Pauschale', ust_satz: 19, aktiv: true },
  ],

  kunden: [
    { id: 'ku-1', firma_id: AH, anrede: 'Frau', vorname: 'Ingrid', nachname: 'Bauer',
      strasse: 'Podbielskistraße 128', plz: '30177', ort: 'Hannover', telefon: '0511 990011',
      geburtsdatum: '1941-02-11', pflegegrad: 3, versichertennummer: 'A123456789',
      kostentraeger_id: 'kt-1', status: 'aktiv', leistungen: ['ls-1'],
      lat: 52.3980, lng: 9.7690, notiz: 'Schlüssel im Schlüsselkasten, Code bei Bianca.' },
    { id: 'ku-2', firma_id: AH, anrede: 'Herr', vorname: 'Werner', nachname: 'Klose',
      strasse: 'Am Lindener Berge 32', plz: '30449', ort: 'Hannover', telefon: '0511 990022',
      geburtsdatum: '1938-09-30', pflegegrad: 4, versichertennummer: 'B987654321',
      kostentraeger_id: 'kt-2', status: 'aktiv', leistungen: ['ls-2', 'ls-3'],
      lat: 52.3660, lng: 9.7060, notiz: null },
    { id: 'ku-3', firma_id: AH, anrede: 'Frau', vorname: 'Hannelore', nachname: 'Simon',
      strasse: 'Wiehbergstraße 9', plz: '30519', ort: 'Hannover', telefon: '0511 990033',
      geburtsdatum: '1946-05-24', pflegegrad: 2, versichertennummer: 'C456789123',
      kostentraeger_id: 'kt-1', status: 'pausiert', leistungen: ['ls-1'],
      lat: 52.3400, lng: 9.7720, notiz: 'Bis Ende des Monats im Krankenhaus.' },
    { id: 'ku-4', firma_id: AH, anrede: 'Herr', vorname: 'Dieter', nachname: 'Ahrends',
      strasse: 'Sallstraße 55', plz: '30171', ort: 'Hannover', telefon: '0511 990044',
      geburtsdatum: '1950-12-02', pflegegrad: 1, versichertennummer: null,
      kostentraeger_id: null, status: 'interessent', leistungen: [],
      lat: 52.3610, lng: 9.7620, notiz: 'Erstgespräch geführt, wartet auf Einstufung.' },

    { id: 'ku-5', firma_id: FP, anrede: null, vorname: null, nachname: null,
      firma_name: 'Praxis Dr. Lehmann', strasse: 'Marktstraße 3', plz: '31515', ort: 'Wunstorf',
      telefon: '05031 88110', email: 'kontakt@praxis-lehmann.example',
      kostentraeger_id: 'kt-3', status: 'aktiv', leistungen: ['ls-4', 'ls-6'],
      lat: 52.4245, lng: 9.4355, notiz: 'Turnus: alle 8 Wochen, montags vormittags.' },
    { id: 'ku-6', firma_id: FP, anrede: 'Frau', vorname: 'Petra', nachname: 'Wilke',
      strasse: 'Nordstraße 21', plz: '31515', ort: 'Wunstorf', telefon: '05031 88220',
      kostentraeger_id: 'kt-3', status: 'aktiv', leistungen: ['ls-4', 'ls-5'],
      lat: 52.4290, lng: 9.4290, notiz: null },
    { id: 'ku-7', firma_id: FP, anrede: null, vorname: null, nachname: null,
      firma_name: 'Autohaus Meiners GmbH', strasse: 'Industriestraße 14', plz: '31515', ort: 'Wunstorf',
      telefon: '05031 88330', email: 'verwaltung@meiners.example',
      kostentraeger_id: 'kt-3', status: 'aktiv', leistungen: ['ls-4', 'ls-5', 'ls-6'],
      lat: 52.4120, lng: 9.4480, notiz: 'Große Schaufensterfront, Hebebühne nötig.' },
  ],

  termine: [
    { id: 'te-1', firma_id: AH, mitarbeiter_id: 'ma-1', kunde_id: 'ku-1', leistung_id: 'ls-1',
      titel: 'Entlastung', start_at: tag(0, 9), ende_at: tag(0, 11), status: 'bestaetigt' },
    { id: 'te-2', firma_id: AH, mitarbeiter_id: 'ma-2', kunde_id: 'ku-2', leistung_id: 'ls-3',
      titel: 'Hauswirtschaft', start_at: tag(0, 10), ende_at: tag(0, 12), status: 'geplant' },
    { id: 'te-3', firma_id: AH, mitarbeiter_id: 'ma-3', kunde_id: 'ku-1', leistung_id: 'ls-2',
      titel: 'Begleitung Arzt', start_at: tag(0, 14), ende_at: tag(0, 16), status: 'geplant' },
    { id: 'te-4', firma_id: AH, mitarbeiter_id: 'ma-1', kunde_id: 'ku-2', leistung_id: 'ls-2',
      titel: 'Betreuung', start_at: tag(1, 9, 30), ende_at: tag(1, 11, 30), status: 'geplant' },
    { id: 'te-5', firma_id: AH, mitarbeiter_id: 'ma-2', kunde_id: 'ku-1', leistung_id: 'ls-1',
      titel: 'Entlastung', start_at: tag(2, 8), ende_at: tag(2, 10), status: 'geplant' },
    { id: 'te-6', firma_id: AH, mitarbeiter_id: 'ma-1', kunde_id: 'ku-3', leistung_id: 'ls-1',
      titel: 'Entlastung', start_at: tag(-1, 9), ende_at: tag(-1, 11), status: 'erledigt' },

    { id: 'te-7', firma_id: FP, mitarbeiter_id: 'ma-4', kunde_id: 'ku-5', leistung_id: 'ls-4',
      titel: 'Praxis Lehmann – Fenster', start_at: tag(0, 8), ende_at: tag(0, 11), status: 'bestaetigt' },
    { id: 'te-8', firma_id: FP, mitarbeiter_id: 'ma-5', kunde_id: 'ku-7', leistung_id: 'ls-4',
      titel: 'Autohaus Meiners – Front', start_at: tag(0, 9), ende_at: tag(0, 15), status: 'geplant' },
    { id: 'te-9', firma_id: FP, mitarbeiter_id: 'ma-4', kunde_id: 'ku-6', leistung_id: 'ls-4',
      titel: 'Wilke – Fenster', start_at: tag(1, 13), ende_at: tag(1, 15), status: 'geplant' },
    { id: 'te-10', firma_id: FP, mitarbeiter_id: 'ma-5', kunde_id: 'ku-5', leistung_id: 'ls-5',
      titel: 'Praxis Lehmann – Rahmen', start_at: tag(3, 8), ende_at: tag(3, 10), status: 'geplant' },

    // Nadine hat heute eine echte Tour über drei Stationen. Ohne mehrere
    // Termine desselben Mitarbeiters am selben Tag hätte die Routenplanung
    // nie eine Linie zu zeichnen – und sähe fälschlich kaputt aus.
    { id: 'te-11', firma_id: FP, mitarbeiter_id: 'ma-4', kunde_id: 'ku-6', leistung_id: 'ls-4',
      titel: 'Wilke – Fenster', start_at: tag(0, 12), ende_at: tag(0, 14), status: 'geplant' },
    { id: 'te-12', firma_id: FP, mitarbeiter_id: 'ma-4', kunde_id: 'ku-7', leistung_id: 'ls-5',
      titel: 'Autohaus Meiners – Rahmen', start_at: tag(0, 15), ende_at: tag(0, 17), status: 'geplant' },

    // Dasselbe bei der Alltagshilfe: Bianca fährt heute zwei Kunden an.
    { id: 'te-13', firma_id: AH, mitarbeiter_id: 'ma-1', kunde_id: 'ku-4', leistung_id: 'ls-2',
      titel: 'Erstbesuch Ahrends', start_at: tag(0, 16), ende_at: tag(0, 17), status: 'geplant' },
  ],

  stundenzettel: [
    { id: 'sz-1', firma_id: AH, mitarbeiter_id: 'ma-1', kunde_id: 'ku-1', datum: datumNur(-1),
      beginn: '09:00', ende: '11:00', stunden: 2, preis_pro_stunde: 32, betrag: 64,
      status: 'freigegeben', leistungen: ['ls-1'] },
    { id: 'sz-2', firma_id: AH, mitarbeiter_id: 'ma-2', kunde_id: 'ku-2', datum: datumNur(-1),
      beginn: '10:00', ende: '12:30', stunden: 2.5, preis_pro_stunde: 30, betrag: 75,
      status: 'offen', leistungen: ['ls-3'] },
    { id: 'sz-3', firma_id: AH, mitarbeiter_id: 'ma-3', kunde_id: 'ku-1', datum: datumNur(-2),
      beginn: '14:00', ende: '16:00', stunden: 2, preis_pro_stunde: 32, betrag: 64,
      status: 'abgerechnet', leistungen: ['ls-2'] },
    { id: 'sz-4', firma_id: FP, mitarbeiter_id: 'ma-4', kunde_id: 'ku-5', datum: datumNur(-1),
      beginn: '08:00', ende: '11:00', stunden: 3, preis_pro_stunde: 45, betrag: 135,
      status: 'offen', leistungen: ['ls-4'] },
    { id: 'sz-5', firma_id: FP, mitarbeiter_id: 'ma-5', kunde_id: 'ku-7', datum: datumNur(-3),
      beginn: '09:00', ende: '15:00', stunden: 6, preis_pro_stunde: 45, betrag: 270,
      status: 'freigegeben', leistungen: ['ls-4', 'ls-5'] },
  ],

  kommunikation: [
    { id: 'ko-1', firma_id: AH, typ: 'telefon', kunde_id: 'ku-1', betreff: 'Termin verschoben',
      text: 'Tochter ruft an: Dienstag passt nicht, bitte auf Mittwoch legen.',
      status: 'erledigt', created_at: tag(-2, 11), tasks: [] },
    { id: 'ko-2', firma_id: AH, typ: 'notiz', kunde_id: 'ku-2', betreff: 'Schlüsselübergabe',
      text: 'Zweitschlüssel liegt jetzt im Büro, Fach 3.',
      status: 'offen', created_at: tag(-1, 15), tasks: [] },
    { id: 'ko-3', firma_id: AH, typ: 'email', kunde_id: 'ku-4', betreff: 'Unterlagen Pflegekasse',
      text: 'Antrag auf Einstufung an die Angehörigen geschickt.',
      status: 'offen', created_at: tag(-4, 9), tasks: [] },
    { id: 'ko-4', firma_id: AH, typ: 'notiz', kunde_id: null, betreff: 'Dienstplan August',
      text: 'Urlaubswünsche bis Ende des Monats einsammeln.',
      status: 'offen', created_at: tag(-1, 8), tasks: [] },
    { id: 'ko-5', firma_id: FP, typ: 'telefon', kunde_id: 'ku-7', betreff: 'Zusatzauftrag',
      text: 'Meiners fragt nach Reinigung der Ausstellungsfläche im Herbst.',
      status: 'offen', created_at: tag(-1, 13), tasks: [] },
    { id: 'ko-6', firma_id: FP, typ: 'notiz', kunde_id: 'ku-5', betreff: 'Zugang',
      text: 'Praxis erst ab 8 Uhr offen, vorher niemand da.',
      status: 'offen', created_at: tag(-6, 16), tasks: [] },
  ],

  aufgaben: [
    { id: 'au-1', firma_id: AH, titel: 'Abtretungserklärung Bauer einholen',
      beschreibung: 'Unterschrift bei Frau Bauer beim nächsten Einsatz.',
      status: 'offen', prioritaet: 'hoch', faellig_am: datumNur(2),
      zugewiesen_an: 'ma-1', kunde_id: 'ku-1' },
    { id: 'au-2', firma_id: AH, titel: 'Pflegekasse Klose nachfassen',
      beschreibung: 'Seit drei Wochen keine Rückmeldung zur Abrechnung.',
      status: 'in_arbeit', prioritaet: 'normal', faellig_am: datumNur(5),
      zugewiesen_an: 'ma-1', kunde_id: 'ku-2' },
    { id: 'au-3', firma_id: AH, titel: 'Erstgespräch Ahrends nachbereiten',
      beschreibung: null, status: 'offen', prioritaet: 'niedrig', faellig_am: datumNur(9),
      zugewiesen_an: null, kunde_id: 'ku-4' },
    { id: 'au-4', firma_id: FP, titel: 'Angebot Ausstellungsfläche Meiners',
      beschreibung: 'Aufmaß nehmen, dann Angebot rechnen.',
      status: 'offen', prioritaet: 'hoch', faellig_am: datumNur(3),
      zugewiesen_an: 'ma-5', kunde_id: 'ku-7' },
    { id: 'au-5', firma_id: FP, titel: 'Hebebühne Termin buchen',
      beschreibung: null, status: 'offen', prioritaet: 'normal', faellig_am: datumNur(6),
      zugewiesen_an: 'ma-5', kunde_id: null },
  ],

  abtretungen: [
    { id: 'ab-1', firma_id: AH, kunde_id: 'ku-1', kostentraeger_id: 'kt-1', monat: monat(),
      betrag: 131.0, status: 'unterschrieben', unterschrift_am: datumNur(-10) },
    { id: 'ab-2', firma_id: AH, kunde_id: 'ku-2', kostentraeger_id: 'kt-2', monat: monat(),
      betrag: 125.0, status: 'offen', unterschrift_am: null },
  ],

  lohnabrechnungen: [
    { id: 'lo-1', firma_id: AH, mitarbeiter_id: 'ma-1', monat: monat(),
      stunden: 152, brutto: 2508.0, netto: 1789.4, status: 'entwurf', daten: {} },
    { id: 'lo-2', firma_id: AH, mitarbeiter_id: 'ma-2', monat: monat(),
      stunden: 80, brutto: 1120.0, netto: 902.1, status: 'entwurf', daten: {} },
    { id: 'lo-3', firma_id: FP, mitarbeiter_id: 'ma-4', monat: monat(),
      stunden: 120, brutto: 1824.0, netto: 1362.7, status: 'final', daten: {} },
  ],

  vorlagen: [
    { id: 'vo-1', firma_id: AH, typ: 'email', schluessel: 'willkommen', name: 'Willkommen',
      betreff: 'Willkommen bei Alltagshilfe Hannover',
      text: 'Sehr geehrte/r {{anrede}} {{nachname}},\n\nschön, dass Sie sich für uns entschieden haben.', aktiv: true },
    { id: 'vo-2', firma_id: AH, typ: 'beratung', schluessel: 'standard', name: 'Beratungsvorlage',
      betreff: null, text: 'Beratung nach §37 Abs. 3 SGB XI', aktiv: true },
    { id: 'vo-3', firma_id: FP, typ: 'email', schluessel: 'willkommen', name: 'Willkommen',
      betreff: 'Willkommen bei Fensterputz-Service',
      text: 'Sehr geehrte/r {{anrede}} {{nachname}},\n\nvielen Dank für Ihren Auftrag.', aktiv: true },
    { id: 'vo-4', firma_id: FP, typ: 'email', schluessel: 'angebot', name: 'Angebot',
      betreff: 'Ihr Angebot der Fensterputz-Service UG',
      text: 'Sehr geehrte Damen und Herren,\n\nanbei unser Angebot.', aktiv: true },
  ],

  marketing_material: [
    { id: 'mk-1', firma_id: AH, name: 'Flyer Alltagshilfe A5', typ: 'Flyer',
      beschreibung: 'Aktuelle Fassung, Stand Juli', datei_url: null },
    { id: 'mk-2', firma_id: FP, name: 'Visitenkarte', typ: 'Visitenkarte',
      beschreibung: null, datei_url: null },
  ],

  schulungen: [
    { id: 'sc-1', firma_id: AH, titel: 'Erste Hilfe', beschreibung: 'Grundkurs',
      pflicht: true, gueltig_monate: 24, aktiv: true },
    { id: 'sc-2', firma_id: AH, titel: 'Datenschutz (DSGVO)', beschreibung: 'Jährliche Unterweisung',
      pflicht: true, gueltig_monate: 12, aktiv: true },
    { id: 'sc-3', firma_id: FP, titel: 'Arbeitssicherheit Hebebühne', beschreibung: null,
      pflicht: true, gueltig_monate: 12, aktiv: true },
  ],

  schulungen_status: [
    { id: 'ss-1', firma_id: AH, schulung_id: 'sc-1', mitarbeiter_id: 'ma-1',
      erledigt_am: '2025-11-04', gueltig_bis: '2027-11-04' },
    { id: 'ss-2', firma_id: AH, schulung_id: 'sc-2', mitarbeiter_id: 'ma-1',
      erledigt_am: '2026-01-20', gueltig_bis: '2027-01-20' },
    { id: 'ss-3', firma_id: FP, schulung_id: 'sc-3', mitarbeiter_id: 'ma-5',
      erledigt_am: '2026-03-11', gueltig_bis: '2027-03-11' },
  ],

  aktivitaeten: [
    { id: 'ak-1', firma_id: AH, user_label: 'Daniel Dmytrov', rolle: 'admin',
      aktion: 'Kunde „Ingrid Bauer" bearbeitet', created_at: tag(0, 8, 12) },
    { id: 'ak-2', firma_id: AH, user_label: 'Bianca Campe', rolle: 'leitung',
      aktion: 'Stundenzettel freigegeben (Laura Duske)', created_at: tag(-1, 17, 3) },
    { id: 'ak-3', firma_id: AH, user_label: 'Daniel Dmytrov', rolle: 'admin',
      aktion: 'Leistung „Betreuung / Begleitung" angelegt', created_at: tag(-3, 10, 45) },
    { id: 'ak-4', firma_id: FP, user_label: 'Daniel Dmytrov', rolle: 'admin',
      aktion: 'Kunde „Autohaus Meiners GmbH" angelegt', created_at: tag(-2, 14, 20) },
  ],

  email_log: [
    { id: 'el-1', firma_id: AH, empfaenger: 'angehoerige@example.de',
      betreff: 'Unterlagen Pflegekasse', status: 'gesendet', created_at: tag(-4, 9, 5) },
    { id: 'el-2', firma_id: FP, empfaenger: 'verwaltung@meiners.example',
      betreff: 'Ihr Angebot der Fensterputz-Service UG', status: 'gesendet', created_at: tag(-2, 16, 30) },
  ],

  firmen_mitglieder: [
    { id: 'fm-1', firma_id: AH, user_id: 'test-admin', rolle: 'admin', aktiv: true },
    { id: 'fm-2', firma_id: FP, user_id: 'test-admin', rolle: 'admin', aktiv: true },
  ],
};
