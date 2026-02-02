# Steg 4 & 5: Sälj- och Adminvy Backend

## Mål
Full funktionalitet för Admin att hantera bokningar (tilldela säljare, ändra status) och för Säljare att se detaljer och jobba med sina bokningar.

## Databas (Inget nytt SQL behövs om Steg 2 kördes korrekt)
Men vi kan behöva verifiera att vi har säljare i `profiles`.

## Backend Changes

### 1. Admin (`routes/admin.js`)
Vi ska uppdatera och utöka admin-rutterna. Vi byter auth-middleware till den nya `requireAuth` + `requireRole('admin')` för att använda riktig inloggning, men behåller _även_ `requireAdmin` som en fallback för legacy-token (om frontend inte är redo för auth än).
*   _Beslut:_ Vi kör på **både och** ett tag eller migrerar helt. Enligt prioriteringslistan ska vi bygga klart vyerna. Jag kommer att implementera admin-rutterna så de använder Supabase Auth (`requireRole('admin')`) primärt, men vi kan ha en switch eller dubbla middlewares om det behövs för dev.
*   **Endpoints att fixa:**
    *   `GET /bookings` (med filtrering)
    *   `PATCH /bookings/:id/assign` (tilldela säljare)
    *   `PATCH /bookings/:id/status` (ändra status)
    *   `PATCH /bookings/:id/payment` (ändra betalningsstatus)
    *   `GET /sellers` (lista alla med rollen 'seller')

### 2. Säljare (`routes/seller.js`)
Vi har redan grunden (`my-bookings`, `status`, `upload`). Vi lägger till:
*   `GET /bookings/:id` (detaljvy)

### Auth-strategi
Jag kommer att uppdatera `admin.js` för att **kräva** inloggning via Supabase Auth och rollen 'admin'. Det är säkrare och mer korrekt än den "hardcodade" token vi hade innan.
Om du vill behålla den gamla token för testning, säg till. Annars byter jag nu.

## Plan
1.  Uppdatera `routes/admin.js`:
    *   Byt `requireAdmin` mot `requireAuth` + `requireRole('admin')`.
    *   Lägg till `PATCH /bookings/:id/assign`.
    *   Lägg till `PATCH /bookings/:id` (generell update).
    *   Lägg till `GET /users` (för att hitta säljare).
2.  Uppdatera `routes/seller.js`:
    *   Lägg till `GET /bookings/:id`.
