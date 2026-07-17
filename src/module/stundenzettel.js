/* Stundenzettel & Abtretungserklärung. */
import { registriere } from '../kern/registry.js';
import { nochNichtPortiert } from '../kern/ui.js';

registriere({
  id: 'stundenzettel',
  titel: 'Stundenzettel & Abtretung',
  zeichen: '⏱',
  render: () => nochNichtPortiert('Stundenzettel & Abtretung', 'src/module/stundenzettel.js'),
});
