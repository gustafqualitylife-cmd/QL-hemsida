# Cursor Execution Playbook – QualityLife

Detta dokument styr exakt hur Cursor (AI) ska arbeta i detta repo.

Ingen tolkning.  
Ingen gissning.  
Följ stegen i ordning.

---

## Förutsättningar
- Repo är redan klonat lokalt
- Cursor är öppet i detta repo
- Alla dokument i `docs/` är aktuella
- Deployment sker automatiskt via GitHub → Render

---

## Absolut grundregel
Cursor får ALDRIG:
- ändra techstack
- byta auth-lösning
- köra destruktiva SQL-kommandon (DROP, TRUNCATE)
- pusha kod som inte kan deployas direkt

Vid osäkerhet → stoppa och fråga.

---

## Standardstart för varje arbetsuppgift
När en ny uppgift påbörjas ska Cursor:

1. Läsa:
   - docs/BOOKING_SYSTEM_MASTERPROMPT.md
   - docs/PROJECT_TECH_CONTEXT.md
   - docs/DECISIONS.md
   - docs/WORKFLOW_WITH_AI.md
2. Sammanfatta kort vad som ska göras
3. Lista vilka filer som påverkas
4. Lista om Supabase kräver ändringar

Ingen kod skrivs innan detta är gjort.

---

## När databasen ska ändras (Supabase)
Om en uppgift kräver DB-ändringar:

1. Cursor ska först:
   - skriva exakt SQL (endast ALTER TABLE, CREATE INDEX, etc)
   - förklara vad varje ändring gör
2. Cursor ska INTE:
   - köra SQL själv
   - anta att SQL redan är körd
3. Användaren kör SQL manuellt i Supabase SQL Editor
4. Efteråt ska Cursor:
   - anta att SQL är körd
   - uppdatera backend så att den matchar schemat

---

## När backend ändras
Vid backend-ändringar ska Cursor:

1. Identifiera vilka filer som ändras
2. Göra minimala, säkra ändringar
3. Säkerställa att:
   - server startar
   - inga miljövariabler saknas
4. Aldrig bryta befintliga endpoints utan att säga till

---

## Git & deploy
Efter kodändringar:

1. Cursor ska:
   - sammanfatta ändringen
   - föreslå commit message
2. Användaren pushar till `main`
3. Render deployar automatiskt
4. Cursor väntar på eventuell feedback/loggar

---

## Verifiering (obligatoriskt)
Efter varje steg ska Cursor lista:

- Vad som ändrats i DB
- Vad som ändrats i kod
- Vad som ska testas manuellt
- Vad som är nästa naturliga steg

---

## Dokumentationskrav
När ett steg är klart ska Cursor:

1. Hjälpa till att uppdatera:
   - DECISIONS.md (om nya beslut togs)
2. Aldrig lämna beslut endast i chatten

---

## Slutmål
Systemet ska kunna:
- vidareutvecklas utan dig
- förstås utan konversationer
- byggas vidare av annan AI
- byggas vidare av annan utvecklare

