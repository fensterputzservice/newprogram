/* Karte, und nur bei Fensterputz zusätzlich die Routenplanung. */
import { registriere } from '../kern/registry.js';
import { nochNichtPortiert } from '../kern/ui.js';

registriere({
  id: 'karte',
  titel: 'Karte',
  zeichen: '⌖',
  rollen: ['admin', 'leitung'],
  render: () => nochNichtPortiert('Karte', 'src/module/karte.js'),
});

registriere({
  id: 'routenplanung',
  titel: 'Routenplanung',
  zeichen: '⤳',
  flag: 'routenplanung',           // in firmen.module – bei Alltagshilfe false
  rollen: ['admin', 'leitung'],
  render: () => nochNichtPortiert('Routenplanung', 'src/module/karte.js'),
});
