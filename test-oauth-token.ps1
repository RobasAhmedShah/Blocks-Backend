# Test 1LINK OAuth Token Fetch
# Run: .\test-oauth-token.ps1

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  1LINK OAuth Token Fetch Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Read environment variables from .env file
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    exit 1
}

Write-Host "[1/4] Reading environment variables..." -ForegroundColor Yellow
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        # Remove quotes if present
        if ($value -match '^["''](.*)["'']$') {
            $value = $matches[1]
        }
        $envVars[$key] = $value
    }
}

$clientId = $envVars['ONELINK_CLIENT_ID']
$clientSecret = $envVars['ONELINK_CLIENT_SECRET']
$oauthUrl = $envVars['ONELINK_OAUTH_URL']
$rtpApiUrl = $envVars['ONELINK_RTP_API_URL']

Write-Host "  ONELINK_CLIENT_ID: $($clientId -replace '.', '*')" -ForegroundColor Gray
Write-Host "  ONELINK_CLIENT_SECRET: $($clientSecret -replace '.', '*')" -ForegroundColor Gray
Write-Host "  ONELINK_OAUTH_URL: $oauthUrl" -ForegroundColor Gray
Write-Host "  ONELINK_RTP_API_URL: $rtpApiUrl" -ForegroundColor Gray
Write-Host ""

if (-not $clientId -or -not $clientSecret -or -not $oauthUrl) {
    Write-Host "[ERROR] Missing required environment variables!" -ForegroundColor Red
    Write-Host "  Required: ONELINK_CLIENT_ID, ONELINK_CLIENT_SECRET, ONELINK_OAUTH_URL" -ForegroundColor Red
    exit 1
}

# Step 2: Create Basic Auth credentials
Write-Host "[2/4] Creating Basic Auth credentials..." -ForegroundColor Yellow
$credentials = "$clientId`:$clientSecret"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($credentials)
$base64Credentials = [System.Convert]::ToBase64String($bytes)
Write-Host "  [OK] Basic Auth header created" -ForegroundColor Green
Write-Host ""

# Step 3: Fetch OAuth Token
Write-Host "[3/4] Fetching OAuth token from 1LINK..." -ForegroundColor Yellow
Write-Host "  URL: $oauthUrl" -ForegroundColor Gray
Write-Host "  Method: POST" -ForegroundColor Gray
Write-Host "  Body: grant_type=client_credentials&scope=1LinkApi" -ForegroundColor Gray
Write-Host ""

try {
    $headers = @{
        'Content-Type' = 'application/x-www-form-urlencoded'
        'Authorization' = "Basic $base64Credentials"
    }
    
    $body = 'grant_type=client_credentials&scope=1LinkApi'
    
    $response = Invoke-RestMethod -Uri $oauthUrl -Method Post -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host "  [OK] OAuth token fetched successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Token Details:" -ForegroundColor Cyan
    Write-Host "    Access Token: $($response.access_token.Substring(0, 50))..." -ForegroundColor Gray
    Write-Host "    Token Type: $($response.token_type)" -ForegroundColor Gray
    Write-Host "    Expires In: $($response.expires_in) seconds" -ForegroundColor Gray
    Write-Host "    Scope: $($response.scope)" -ForegroundColor Gray
    Write-Host ""
    
    $accessToken = $response.access_token
    $expiresIn = $response.expires_in
    
} catch {
    Write-Host "  [ERROR] Failed to fetch OAuth token!" -ForegroundColor Red
    Write-Host "  Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response Body: $responseBody" -ForegroundColor Red
    }
    
    exit 1
}

# Step 4: Test API call with token
Write-Host "[4/4] Testing API call with OAuth token..." -ForegroundColor Yellow

if (-not $rtpApiUrl) {
    Write-Host "  [SKIP] ONELINK_RTP_API_URL not set, skipping API test" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  OAuth Token Test Complete!" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    exit 0
}

Write-Host "  Testing GET /getMerchantProfile endpoint..." -ForegroundColor Gray
Write-Host "  Base URL: $rtpApiUrl" -ForegroundColor Gray
Write-Host ""

try {
    $testHeaders = @{
        'Content-Type' = 'application/json'
        'X-IBM-Client-Id' = $clientId
        'Authorization' = "Bearer $accessToken"
    }
    
    # Test with a dummy merchant ID
    $testUrl = "$rtpApiUrl/getMerchantProfile?merchantID=TEST001"
    
    Write-Host "  Calling: $testUrl" -ForegroundColor Gray
    
    $apiResponse = Invoke-RestMethod -Uri $testUrl -Method Get -Headers $testHeaders -ErrorAction Stop
    
    Write-Host "  [OK] API call successful!" -ForegroundColor Green
    Write-Host "  Response: $($apiResponse | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "  [INFO] API call returned status: $statusCode" -ForegroundColor Yellow
    
    if ($statusCode -eq 404 -or $statusCode -eq 400) {
        Write-Host "  This is expected - merchant profile doesn't exist" -ForegroundColor Gray
        Write-Host "  The important thing is that authentication worked!" -ForegroundColor Green
    } else {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "  Response: $responseBody" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OAuth Token Test Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan


