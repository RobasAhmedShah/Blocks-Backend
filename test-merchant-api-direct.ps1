# Test 1LINK Merchant API Directly
# This tests the actual 1LINK API endpoints

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  1LINK Merchant API Direct Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Read environment variables
$envFile = ".env"
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        if ($value -match '^["''](.*)["'']$') {
            $value = $matches[1]
        }
        $envVars[$key] = $value
    }
}

$clientId = $envVars['ONELINK_CLIENT_ID']
$clientSecret = $envVars['ONELINK_CLIENT_SECRET']
$oauthUrl = $envVars['ONELINK_OAUTH_URL']
$apiBaseUrl = $envVars['ONELINK_RTP_API_URL']

if (-not $apiBaseUrl) {
    $apiBaseUrl = "https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link"
}

Write-Host "[1/3] Getting OAuth Token..." -ForegroundColor Yellow
$credentials = "$clientId`:$clientSecret"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($credentials)
$base64Credentials = [System.Convert]::ToBase64String($bytes)

$oauthHeaders = @{
    'Content-Type' = 'application/x-www-form-urlencoded'
    'Authorization' = "Basic $base64Credentials"
}

try {
    $tokenResponse = Invoke-RestMethod -Uri $oauthUrl -Method Post -Headers $oauthHeaders -Body 'grant_type=client_credentials&scope=1LinkApi'
    $accessToken = $tokenResponse.access_token
    Write-Host "  [OK] Token obtained" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Failed to get token: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test Create Merchant Profile
Write-Host "[2/3] Testing Create Merchant Profile..." -ForegroundColor Yellow

$merchantID = "TEST_$(Get-Date -Format 'yyyyMMddHHmmss')"
$createPayload = @{
    merchantDetails = @{
        dbaName = "Test Business Name"
        merchantName = "Test Merchant"
        iban = "PK36SCBL0000001123456702"
        bankBic = "SCBLPK"
        merchantCategoryCode = "0010"
        merchantID = $merchantID
        accountTitle = "Test Account Title"
        postalAddress = @{
            townName = "Karachi"
            addressLine = "123 Test Street"
        }
        contactDetails = @{
            phoneNo = "+922112345678"
            mobileNo = "+923001234567"
            email = "test@example.com"
        }
        paymentDetails = @{
            feeType = "F"
            feeValue = 15
        }
    }
} | ConvertTo-Json -Depth 10

$apiHeaders = @{
    'Content-Type' = 'application/json'
    'X-IBM-Client-Id' = $clientId
    'Authorization' = "Bearer $accessToken"
}

$createUrl = "$apiBaseUrl/createMerchantProfile"
Write-Host "  URL: $createUrl" -ForegroundColor Gray
Write-Host "  Method: POST" -ForegroundColor Gray
Write-Host "  Merchant ID: $merchantID" -ForegroundColor Gray
Write-Host ""

try {
    $createResponse = Invoke-RestMethod -Uri $createUrl -Method Post -Headers $apiHeaders -Body $createPayload -ErrorAction Stop
    Write-Host "  [OK] Create Merchant Profile: SUCCESS" -ForegroundColor Green
    Write-Host "  Response: $($createResponse | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "  [ERROR] Create Merchant Profile: FAILED" -ForegroundColor Red
    Write-Host "  Status Code: $statusCode" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response Body: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test Get Merchant Profile
Write-Host "[3/3] Testing Get Merchant Profile..." -ForegroundColor Yellow
$getUrl = "$apiBaseUrl/getMerchantProfile?merchantID=$merchantID"
Write-Host "  URL: $getUrl" -ForegroundColor Gray
Write-Host ""

try {
    $getResponse = Invoke-RestMethod -Uri $getUrl -Method Get -Headers $apiHeaders -ErrorAction Stop
    Write-Host "  [OK] Get Merchant Profile: SUCCESS" -ForegroundColor Green
    Write-Host "  Response: $($getResponse | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "  [INFO] Get Merchant Profile returned: $statusCode" -ForegroundColor Yellow
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Direct API Test Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

