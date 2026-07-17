/* ============================================================
   Anmeldung aller Module

   Jede Datei registriert sich beim Laden selbst. Die Reihenfolge
   dieser Zeilen ist die Reihenfolge in der Seitenleiste.

   Die Fachlogik wird Modul für Modul aus dem Altsystem übernommen
   (Final/Fensterputzservice/index.html, 665 Funktionen). Bis dahin
   zeigt jeder Bereich, woher er kommt.
   ============================================================ */

import './dashboard.js';
import './karte.js';
import './kunden.js';
import './mitarbeiter.js';
import './kommunikation.js';
import './stundenzettel.js';
import './lohn.js';
import './notizen.js';
import './kalender.js';
import './einstellungen.js';
