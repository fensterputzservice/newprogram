/* Lohnabrechnung. Fremde Abrechnungen sieht nur die Leitung. */
import { registriere } from '../kern/registry.js';
import { nochNichtPortiert } from '../kern/ui.js';

registriere({
  id: 'lohn',
  titel: 'Lohnabrechnung',
  zeichen: '€',
  render: () => nochNichtPortiert('Lohnabrechnung', 'src/module/lohn.js'),
});
