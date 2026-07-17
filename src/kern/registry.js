/* ============================================================
   Modul-Registry

   Jedes Modul meldet sich hier an. Die Seitenleiste entsteht
   daraus von selbst – ein neuer Bereich heißt also: eine Datei
   anlegen, einmal registriere() aufrufen, fertig.

   Ein Modul erscheint nur, wenn beides stimmt:
     · der Schalter in firmen.module ist an   (welche Firma)
     · die Rolle passt                        (wer)

   Aufbau eines Moduls:
     {
       id:      'kunden',
       titel:   'Kunden',
       zeichen: '👥',
       flag:    'kunden',                    Schlüssel in firmen.module
       rollen:  ['admin','leitung'],         weglassen = alle
       unter:   [ …Untermenü… ],
       render:  (ctx) => 'HTML'              ctx = { firma, rolle, benutzer }
     }
   ============================================================ */

const register = [];

export function registriere(modul) {
  if (!modul?.id) throw new Error('Modul ohne id');
  if (register.some((m) => m.id === modul.id)) {
    throw new Error(`Modul doppelt registriert: ${modul.id}`);
  }
  register.push(modul);
}

/** Ist das Modul für diese Firma eingeschaltet und diese Rolle erlaubt? */
function erlaubt(modul, firma, rolle) {
  const flag = modul.flag ?? modul.id;
  const an = firma?.module?.[flag];
  // Ohne Eintrag in firmen.module gilt: sichtbar. Nur ein
  // ausdrückliches false blendet aus (siehe routenplanung).
  if (an === false) return false;
  if (modul.rollen && !modul.rollen.includes(rolle)) return false;
  return true;
}

/** Alle Module, die diese Firma und diese Rolle sehen dürfen. */
export function moduleFuer(firma, rolle) {
  return register
    .filter((m) => erlaubt(m, firma, rolle))
    .map((m) => ({
      ...m,
      unter: (m.unter ?? []).filter((u) => erlaubt(u, firma, rolle)),
    }));
}

/** Ein Modul über seine id finden – auch in den Untermenüs. */
export function modulNach(id, firma, rolle) {
  for (const m of moduleFuer(firma, rolle)) {
    if (m.id === id) return m;
    const u = (m.unter ?? []).find((x) => x.id === id);
    if (u) return u;
  }
  return null;
}

/** Womit startet diese Rolle? Der erste Bereich, der eigenen Inhalt hat. */
export function startModul(firma, rolle) {
  const alle = moduleFuer(firma, rolle);
  return alle.find((m) => m.render || m.mount)?.id ?? null;
}
