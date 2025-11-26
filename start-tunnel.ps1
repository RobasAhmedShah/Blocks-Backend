# Start localtunnel for port 3000 with subdomain (no password required)
Write-Host "Starting localtunnel on port 3000..." -ForegroundColor Green
Write-Host "Your tunnel URL will appear below. Copy the HTTPS URL." -ForegroundColor Yellow
Write-Host ""
lt --port 3000 --subdomain blocks-backend

