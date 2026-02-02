$SUPABASE_URL = "https://joynmufuivwwyhfnbeae.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpveW5tdWZ1aXZ3d3loZm5iZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMDI1MDMsImV4cCI6MjA3ODg3ODUwM30.vzivy9ZxEuHGsl38QwTxC6EhZSXb7dQ0rt7gtOBoTlI"
$EMAIL = "gustaf.muda@gmail.com"
$PASSWORD = "qualitylife"

$body = @{ email = $EMAIL; password = $PASSWORD } | ConvertTo-Json

$res = Invoke-RestMethod `
  -Method Post `
  -Uri "$SUPABASE_URL/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $ANON_KEY; Authorization = "Bearer $ANON_KEY"; "Content-Type"="application/json" } `
  -Body $body

$ADMIN_JWT = $res.access_token
"ADMIN JWT OK"





$SUPABASE_URL = "https://joynmufuivwwyhfnbeae.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpveW5tdWZ1aXZ3d3loZm5iZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMDI1MDMsImV4cCI6MjA3ODg3ODUwM30.vzivy9ZxEuHGsl38QwTxC6EhZSXb7dQ0rt7gtOBoTlI"
$EMAIL = "seller@qualitylife.test"
$PASSWORD = "SELLER_LÖSENORD"

$body = @{ email = $EMAIL; password = $PASSWORD } | ConvertTo-Json

$res = Invoke-RestMethod `
  -Method Post `
  -Uri "$SUPABASE_URL/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $ANON_KEY; Authorization = "Bearer $ANON_KEY"; "Content-Type"="application/json" } `
  -Body $body

$SELLER_JWT = $res.access_token
"SELLER JWT OK"

