# Project Tech Context – QualityLife Booking System

## Syfte
Detta dokument beskriver den exakta tekniska setupen, arbetsmetoden
och begränsningar för QualityLife-projektet.

Detta dokument är **source of truth** för hur systemet är uppsatt.
Inga antaganden får göras som strider mot detta.

---

## Repo & Deployment

### GitHub
- All kod ligger i ett GitHub-repo
- `main` är alltid deploy-branch
- Inga manuella deployer tillåts

### Render
- Projektet deployas automatiskt från GitHub → Render
- Varje push till `main` triggar deploy
- Backend körs som Node.js service på Render

### Viktigt
- Ingen lokal-only logik
- Ingen miljöspecifik kod som inte fungerar i Render
- All config ska gå via environment variables

---

## Backend

### Runtime
- Node.js (Render default / LTS)
- Express används för API

### Strukturprincip
- Backend ska vara modulärt uppdelad
- Ingen “monolitisk” fil i slutversionen

Exempel på önskad uppdelning:
- routes/
  - public/
  - admin/
  - seller/
- services/
  - booking.service.js
  - file.service.js
- middleware/
  - requireAdmin.js
  - requireSeller.js

Det är okej att börja enklare,
men slutmål är tydlig separation.

---

## Supabase

### Projekt
- Ett Supabase-projekt används
- Postgres är primär databas
- Supabase Storage används för filer
- Supabase Auth används för inloggning

### Auth
- Inloggning sker via email + lösenord
- Roller:
  - admin
  - seller
- Roll lagras via:
  - user metadata
  - eller separat profile-tabell (best practice)

### Viktigt
- Kundvy får ALDRIG prata direkt med Supabase
- Endast backend får använda service role key
- Säljare och admin använder Supabase Auth + RLS

---

## Environment Variables
Alla hemligheter ligger i Render env vars, t.ex.:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ANON_KEY (om behövs för frontend)
- ADMIN_SECRET (om admin-token används temporärt)
- APPS_SCRIPT_WEBHOOK_URL

Inga secrets i repo.

---

## Filuppladdning
- Alla filer lagras i Supabase Storage
- Bucket: booking-files
- Mappstruktur:
  - /{booking_id}/timestamp-filename.jpg
- Metadata lagras i `booking_files`

---

## Arbetsmetod

### Viktiga principer
- Bygg i små steg
- Ingen “big bang”
- Allt ska gå att deploya direkt efter varje ändring

### Kommunikation med AI / utvecklare
När du jobbar vidare ska alltid följande anges:
- “Utgå från BOOKING_SYSTEM_MASTERPROMPT.md”
- “Utgå från PROJECT_TECH_CONTEXT.md”

Om något saknas:
- Ställ frågor
- Anta aldrig

---

## Förbjudna antaganden
- Byt inte databas
- Byt inte auth-lösning
- Byt inte hosting
- Lägg inte frontend i backend-repot
- Lägg inte kundvy bakom inloggning

Om något av ovan föreslås → stoppa och fråga först.

