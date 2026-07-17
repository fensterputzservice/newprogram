/* Kalender. Übersicht über alle Mitarbeiter mit Mehrfachauswahl. */
import { registriere } from '../kern/registry.js';
import { nochNichtPortiert } from '../kern/ui.js';

registriere({
  id: 'kalender',
  titel: 'Kalender',
  zeichen: '▤',
  render: () => nochNichtPortiert('Kalender', 'src/module/kalender.js'),
});
