/* Mitarbeiter. Enthält Stundenlöhne – deshalb nur für die Leitung. */
import { registriere } from '../kern/registry.js';
import { nochNichtPortiert } from '../kern/ui.js';

registriere({
  id: 'mitarbeiter',
  titel: 'Mitarbeiter',
  zeichen: '⚇',
  rollen: ['admin', 'leitung'],
  render: () => nochNichtPortiert('Mitarbeiter', 'src/module/mitarbeiter.js'),
});
