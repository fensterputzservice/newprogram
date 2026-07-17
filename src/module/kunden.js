/* Kunden – pro Firma getrennt. */
import { registriere } from '../kern/registry.js';
import { nochNichtPortiert } from '../kern/ui.js';

registriere({
  id: 'kunden',
  titel: 'Kunden',
  zeichen: '☺',
  render: () => nochNichtPortiert('Kunden', 'src/module/kunden.js'),
});
