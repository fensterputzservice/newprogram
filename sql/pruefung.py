#!/usr/bin/env python3
"""Strukturprüfung der Daily-Do-SQL-Dateien ohne laufende Datenbank."""
import re, sys, pathlib

base = pathlib.Path(sys.argv[1])
schema = (base / "01_schema.sql").read_text()
rls    = (base / "02_rls.sql").read_text()
seed   = (base / "03_seed.sql").read_text()
alle   = schema + rls + seed

fehler, warnung = [], []

def strip_comments(s):
    return re.sub(r"--[^\n]*", "", s)

s_schema, s_rls, s_seed = map(strip_comments, (schema, rls, seed))

# ---- 1. Klammern balanciert? -------------------------------------------
for name, txt in (("01_schema", s_schema), ("02_rls", s_rls), ("03_seed", s_seed)):
    if txt.count("(") != txt.count(")"):
        fehler.append(f"{name}: Klammern unbalanciert ({txt.count('(')} auf / {txt.count(')')} zu)")

# ---- 2. Tabellen einsammeln --------------------------------------------
tabellen = set(re.findall(r"create table public\.(\w+)", s_schema))
print(f"Tabellen: {len(tabellen)}")

# Spalten je Tabelle
spalten = {}
for m in re.finditer(r"create table public\.(\w+)\s*\((.*?)\n\);", s_schema, re.S):
    t, body = m.group(1), m.group(2)
    cols = set()
    for line in body.split("\n"):
        line = line.strip()
        cm = re.match(r"^(\w+)\s+(uuid|text|int|boolean|numeric|date|time|timestamptz|jsonb|double)", line)
        if cm:
            cols.add(cm.group(1))
    spalten[t] = cols

# ---- 3. Fremdschlüssel zeigen auf existierende Tabellen ----------------
for m in re.finditer(r"references public\.(\w+)\((\w+)\)", s_schema):
    ziel, spalte = m.group(1), m.group(2)
    if ziel not in tabellen:
        fehler.append(f"FK zeigt auf unbekannte Tabelle: {ziel}")
    elif spalte not in spalten.get(ziel, set()) and spalte != "id":
        fehler.append(f"FK zeigt auf unbekannte Spalte: {ziel}.{spalte}")

# ---- 4. RLS auf jeder Tabelle aktiviert? -------------------------------
rls_an = set(re.findall(r"alter table public\.(\w+)\s+enable row level security", s_rls))
for t in sorted(tabellen - rls_an):
    fehler.append(f"KEINE RLS aktiviert auf: {t}")
for t in sorted(rls_an - tabellen):
    fehler.append(f"RLS aktiviert auf nicht existierender Tabelle: {t}")

# ---- 5. Policies: Tabelle bekannt, Tabelle hat Policy ------------------
policies = re.findall(r"create policy (\w+) on public\.(\w+)\s*\n?\s*for (\w+)", s_rls)
pol_tabellen = {p[1] for p in policies}
for _, t, _ in policies:
    if t not in tabellen:
        fehler.append(f"Policy auf unbekannter Tabelle: {t}")
for t in sorted(tabellen - pol_tabellen):
    fehler.append(f"RLS an, aber KEINE Policy -> Tabelle ist komplett gesperrt: {t}")

pol_namen = [p[0] for p in policies]
for n in set(pol_namen):
    if pol_namen.count(n) > 1:
        fehler.append(f"Policy-Name doppelt: {n}")

# ---- 6. Mandantentrennung: jede Fachtabelle braucht firma_id -----------
kern = {"firmen", "profile"}
for t in sorted(tabellen - kern):
    if "firma_id" not in spalten.get(t, set()):
        fehler.append(f"Fachtabelle ohne firma_id -> keine Mandantentrennung: {t}")

# ---- 7. Jede firma_id-Policy prüft auch wirklich die Firma -------------
for m in re.finditer(r"create policy (\w+) on public\.(\w+)(.*?);", s_rls, re.S):
    name, t, body = m.group(1), m.group(2), m.group(3)
    if t in kern:
        continue
    # Gueltige Eingrenzungen: ueber die Firma ODER strikt auf die eigene Zeile.
    firma_geprueft = re.search(r"ist_(mitglied|leitung|admin)\(firma_id\)|meine_mitarbeiter_id\(firma_id\)", body)
    nur_eigene     = re.search(r"user_id\s*=\s*auth\.uid\(\)", body)
    if not (firma_geprueft or nur_eigene):
        fehler.append(f"Policy {name} auf {t} prueft weder Firma noch Nutzer -> Mandantenleck")

# ---- 8. Benutzte Hilfsfunktionen sind definiert ------------------------
definiert = set(re.findall(r"create or replace function public\.(\w+)", s_rls + s_schema))
benutzt   = set(re.findall(r"public\.(ist_\w+|meine_\w+|teilt_\w+|touch_\w+|handle_\w+)\s*\(", s_rls + s_schema))
for f in sorted(benutzt - definiert):
    fehler.append(f"Funktion benutzt, aber nicht definiert: {f}")

# ---- 9. Trigger zeigen auf existierende Funktionen ---------------------
for m in re.finditer(r"execute function public\.(\w+)\(\)", s_schema):
    if m.group(1) not in definiert:
        fehler.append(f"Trigger ruft undefinierte Funktion: {m.group(1)}")

# ---- 10. SECURITY DEFINER braucht search_path --------------------------
for m in re.finditer(r"create or replace function public\.(\w+).*?\$\$", s_rls + s_schema, re.S):
    block = m.group(0)
    if "security definer" in block.lower() and "search_path" not in block.lower():
        fehler.append(f"SECURITY DEFINER ohne search_path (Sicherheitsrisiko): {m.group(1)}")

# ---- 11. Seed: benutzte Spalten existieren ----------------------------
for m in re.finditer(r"insert into public\.(\w+)\s*\(([^)]*)\)\s*values", s_seed, re.S):
    t, cols = m.group(1), m.group(2)
    if t not in tabellen:
        fehler.append(f"Seed schreibt in unbekannte Tabelle: {t}")
        continue
    for c in [c.strip() for c in cols.split(",") if c.strip()]:
        if c not in spalten.get(t, set()):
            fehler.append(f"Seed schreibt unbekannte Spalte: {t}.{c}")

# ---- 12. anon ausgesperrt? --------------------------------------------
if "revoke all on all tables in schema public from anon" not in s_rls:
    warnung.append("anon wird nicht explizit ausgesperrt")

# ---- Ergebnis ---------------------------------------------------------
print(f"Policies: {len(policies)} auf {len(pol_tabellen)} Tabellen")
print(f"Funktionen: {len(definiert)}")
print()
for w in warnung:
    print(f"WARNUNG  {w}")
for f in fehler:
    print(f"FEHLER   {f}")
print()
print("BESTANDEN" if not fehler else f"DURCHGEFALLEN: {len(fehler)} Fehler")
sys.exit(1 if fehler else 0)
