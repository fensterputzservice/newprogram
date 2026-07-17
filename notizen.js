/* Notizen. Keine eigene Tabelle – Ansicht auf kommunikation mit typ='notiz'. */
import { registriere } from '../kern/registry.js';
import { nochNichtPortiert } from '../kern/ui.js';

registriere({
  id: 'notizen',
  titel: 'Notizen',
  zeichen: '✎',
  render: () => nochNichtPortiert('Notizen', 'src/module/notizen.js'),
});
