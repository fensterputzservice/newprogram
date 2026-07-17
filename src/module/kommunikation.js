/* Kommunikation & Aufgaben. */
import { registriere } from '../kern/registry.js';
import { nochNichtPortiert } from '../kern/ui.js';

registriere({
  id: 'kommunikation',
  titel: 'Kommunikation & Aufgaben',
  zeichen: '✉',
  render: () => nochNichtPortiert('Kommunikation & Aufgaben', 'src/module/kommunikation.js'),
});
