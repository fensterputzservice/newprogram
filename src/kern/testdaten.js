/* ============================================================
   Beispieldaten für den Testbetrieb

   Spiegeln bewusst das, was sql/03_seed.sql in die echte
   Datenbank schreibt. Damit lässt sich die Oberfläche prüfen,
   bevor Supabase überhaupt eingerichtet ist.
   ============================================================ */

export const TEST_FIRMEN = [
  {
    id: 'test-fensterputz',
    slug: 'fensterputz',
    name: 'Fensterputz-Service',
    firma: 'Fensterputz-Service UG (haftungsbeschränkt)',
    strasse: 'Bahnhofstraße 85',
    plz: '31515',
    ort: 'Wunstorf',
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
    strasse: 'Bahnhofstraße 85',
    plz: '31515',
    ort: 'Wunstorf',
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
