Backend Walkthrough – QualityLife Booking System
1. Kodstruktur
routes/
  public.js
  admin.js
  seller.js

middleware/
  requireAuth.js
  requireRole.js
  upload.js

config/
  supabase.js
  openai.js

app.js
server.js

2. Autentisering & roller

Supabase Auth.

Tabell: profiles
1–1 kopplad till auth.users

Roller:

admin

seller

user

Middleware:

requireAuth → JWT

requireRole → profiles

3. API-endpoints
Publik (/api)

GET /times

POST /book

Bokning använder Postgres-funktionen book_time_slot (FOR UPDATE, race-safe).
Webhook till Google Apps Script.

Admin (/api/admin)

GET /bookings

PATCH /bookings/:id/assign

PATCH /bookings/:id/status

POST /bookings/:id/files

GET /sellers

POST /times

DELETE /times/:id

Seller (/api/seller)

GET /my-bookings

GET /bookings/:id

PATCH /bookings/:id/status

POST /bookings/:id/files

4. Databas & säkerhet

Row Level Security:

Admin: full access

Seller: seller_user_id = auth.uid()

Filer:

Metadata: booking_files

Storage: booking-files (private)

Race-condition:

Löses i book_time_slot via FOR UPDATE

5. Filhantering

multipart/form-data

file_type krävs:

offer

before

after

other

RLS + Storage policies styr access.