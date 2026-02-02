# Workflow with AI – QualityLife

Detta dokument beskriver exakt hur AI ska användas i detta projekt.
Syftet är att:
- slippa upprepa kontext
- undvika felaktiga antaganden
- bygga snabbt utan att systemet spårar ur

---

## Grundprincip
AI ska aldrig gissa.

Allt arbete ska utgå från:
- BOOKING_SYSTEM_MASTERPROMPT.md
- PROJECT_TECH_CONTEXT.md
- DECISIONS.md

Om något är oklart:
→ AI ska ställa frågor innan kod skrivs.

---

## Standardstart för varje AI-session
När du börjar en ny session ska du alltid säga:

“Utgå från:
- docs/BOOKING_SYSTEM_MASTERPROMPT.md
- docs/PROJECT_TECH_CONTEXT.md
- docs/DECISIONS.md”

Det räcker.

---

## Hur ett arbetssteg definieras
Varje arbetssteg ska ha:

1. Mål (1 mening)
2. Vad som får ändras
3. Vad som INTE får ändras
4. Klar när (acceptance criteria)

Exempel:
- Mål: lägga till booking_status i databasen
- Får ändras: schema via ALTER TABLE
- Får inte ändras: befintlig data
- Klart när: status kan sättas och läsas i backend

---

## Hur kod levereras
AI ska alltid leverera i denna ordning:

1. Kort plan i punktform
2. SQL eller kod (säker att köra)
3. Vad som påverkas
4. Vad som ska testas manuellt

Ingen “wall of code” utan förklaring.

---

## Hur förändringar dokumenteras
När ett steg är klart ska AI hjälpa till att:

1. Sammanfatta vad som gjorts
2. Uppdatera DECISIONS.md om nya beslut tagits
3. Säga vad nästa naturliga steg är

---

## Hur man pausar och fortsätter senare
Om arbetet pausas:
- all kontext ska redan finnas i docs
- inga beslut ska bara finnas i chatten

När du fortsätter:
- peka på docs
- ange nästa steg

---

## Förbjudet beteende för AI
- Anta annan techstack
- Byta auth-lösning
- Föreslå betalningsintegration utan beslut
- Lägga frontend bakom inloggning
- Hoppa över RLS
- Skriva kod utan att förstå kontexten

Om något av ovan händer → stoppa och fråga.

---

## Slutmål
Systemet ska:
- vara begripligt utan dig
- kunna vidareutvecklas av annan utvecklare
- tåla att AI byts ut
- tåla paus i projektet

