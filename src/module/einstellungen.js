/* ============================================================
   Einstellungen – für beide Firmen gleich aufgebaut
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { nochNichtPortiert } from '../kern/ui.js';

const platz = (titel, datei) => () => nochNichtPortiert(titel, `src/module/einstellungen/${datei}`);

registriere({
  id: 'einstellungen',
  titel: 'Einstellungen',
  zeichen: '⚙',
  rollen: ['admin', 'leitung'],

  unter: [
    {
      id: 'leistungen',
      titel: 'Leistungen',
      render: platz('Leistungen', 'leistungen.js'),
    },
    {
      id: 'kostentraeger',
      titel: 'Kostenträger',
      render: platz('Kostenträger', 'kostentraeger.js'),
    },
    {
      id: 'vorlage-email',
      titel: 'E-Mail-Vorlage',
      render: platz('E-Mail-Vorlage', 'vorlagen.js'),
    },
    {
      // Liegt in derselben Tabelle wie die E-Mail-Vorlage, nur mit typ='beratung'.
      id: 'vorlage-beratung',
      titel: 'Beratungsvorlage',
      render: platz('Beratungsvorlage', 'vorlagen.js'),
    },
    {
      id: 'marketing',
      titel: 'Marketingmaterial',
      render: platz('Marketingmaterial', 'marketing.js'),
    },
    {
      id: 'protokoll',
      titel: 'Aktivitätsprotokoll',
      render: platz('Aktivitätsprotokoll', 'protokoll.js'),
    },
    {
      // Wer welche Firma betreten darf – deshalb nur Admin.
      id: 'zugaenge',
      titel: 'Zugänge & Rollen',
      rollen: ['admin'],
      render: platz('Zugänge & Rollen', 'zugaenge.js'),
    },
    {
      id: 'schulungen',
      titel: 'Schulungen',
      render: platz('Schulungen', 'schulungen.js'),
    },
    {
      id: 'design',
      titel: 'Design und Farben',
      rollen: ['admin'],
      render: platz('Design und Farben', 'design.js'),
    },
  ],
});
