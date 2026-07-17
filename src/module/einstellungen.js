/* ============================================================
   Einstellungen – für beide Firmen gleich aufgebaut

   Ein Modul mit Untermenü. Die Untereinträge registrieren sich
   nicht selbst – sie liefern nur ihre mount-Funktion und wissen
   nichts vom Menü. So steht die Reihenfolge der Punkte an einer
   Stelle und nicht verteilt über acht Dateien.
   ============================================================ */

import { registriere } from '../kern/registry.js';
import { mountLeistungen } from './einstellungen/leistungen.js';
import { mountKostentraeger } from './einstellungen/kostentraeger.js';
import { mountEmailVorlagen, mountBeratungsVorlagen } from './einstellungen/vorlagen.js';
import { mountMarketing } from './einstellungen/marketing.js';
import { mountProtokoll } from './einstellungen/protokoll.js';
import { mountZugaenge } from './einstellungen/zugaenge.js';
import { mountSchulungen } from './einstellungen/schulungen.js';
import { mountDesign } from './einstellungen/design.js';

registriere({
  id: 'einstellungen',
  titel: 'Einstellungen',
  zeichen: '⚙',
  rollen: ['admin', 'leitung'],

  unter: [
    {
      id: 'leistungen',
      titel: 'Leistungen',
      mount: mountLeistungen,
    },
    {
      id: 'kostentraeger',
      titel: 'Kostenträger',
      mount: mountKostentraeger,
    },
    {
      id: 'vorlage-email',
      titel: 'E-Mail-Vorlage',
      mount: mountEmailVorlagen,
    },
    {
      // Liegt in derselben Tabelle wie die E-Mail-Vorlage, nur mit typ='beratung'.
      id: 'vorlage-beratung',
      titel: 'Beratungsvorlage',
      mount: mountBeratungsVorlagen,
    },
    {
      id: 'marketing',
      titel: 'Marketingmaterial',
      mount: mountMarketing,
    },
    {
      // Nur lesen – siehe protokoll.js.
      id: 'protokoll',
      titel: 'Aktivitätsprotokoll',
      mount: mountProtokoll,
    },
    {
      // Wer welche Firma betreten darf – deshalb nur Admin.
      id: 'zugaenge',
      titel: 'Zugänge & Rollen',
      rollen: ['admin'],
      mount: mountZugaenge,
    },
    {
      id: 'schulungen',
      titel: 'Schulungen',
      mount: mountSchulungen,
    },
    {
      id: 'design',
      titel: 'Design und Farben',
      rollen: ['admin'],
      mount: mountDesign,
    },
  ],
});
