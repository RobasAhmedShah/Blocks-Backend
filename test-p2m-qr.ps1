# Test P2M QR Code Generation
# Run: .\test-p2m-qr.ps1

$baseUrl = "http://localhost:3000"
$testEmail = "testmerchant@example.com"
$testPassword = "TestPassword123!"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  P2M QR Code Generation Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Login/Register to get JWT token
Write-Host "[1/4] Authenticating..." -ForegroundColor Yellow
$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

$token = $null
$userId = $null

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/mobile/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    $userId = $loginResponse.user.id
    Write-Host "  [OK] Login successful" -ForegroundColor Green
    Write-Host "  User ID: $userId" -ForegroundColor Gray
} catch {
    Write-Host "  [WARN] Login failed, attempting registration..." -ForegroundColor Yellow
    try {
        $registerBody = @{
            email = $testEmail
            password = $testPassword
            fullName = "Test Merchant User"
        } | ConvertTo-Json
        
        $registerResponse = Invoke-RestMethod -Uri "$baseUrl/api/mobile/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
        $token = $registerResponse.token
        $userId = $registerResponse.user.id
        Write-Host "  [OK] Registration successful" -ForegroundColor Green
        Write-Host "  User ID: $userId" -ForegroundColor Gray
    } catch {
        Write-Host "  [ERROR] Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# Step 2: Create Test Merchant Profile (if needed)
Write-Host "[2/4] Checking/Creating Test Merchant Profile..." -ForegroundColor Yellow

# Try to get existing merchant profiles
try {
    $profilesResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/1link/merchant/profiles" -Method Get -Headers $headers
    $existingMerchant = $profilesResponse.profiles | Where-Object { $_.merchantID -like "TEST_*" } | Select-Object -First 1
    
    if ($existingMerchant) {
        $merchantID = $existingMerchant.merchantID
        Write-Host "  [OK] Using existing test merchant: $merchantID" -ForegroundColor Green
    } else {
        # Create new test merchant
        $merchantID = "TEST_$(Get-Date -Format 'yyyyMMddHHmmss')"
        $testMerchant = @{
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
                    subDept = "0001"
                }
                contactDetails = @{
                    phoneNo = "+922112345678"
                    mobileNo = "+923001234567"
                    email = "test@example.com"
                }
            }
        }
        
        $createBody = $testMerchant | ConvertTo-Json -Depth 10
        $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/1link/merchant/profile/test" -Method Post -Body $createBody -Headers $headers -ContentType "application/json"
        Write-Host "  [OK] Created test merchant: $merchantID" -ForegroundColor Green
    }
} catch {
    Write-Host "  [ERROR] Failed to get/create merchant: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

Start-Sleep -Seconds 1

# Step 3: Generate P2M QR Code - Merchant Mode
Write-Host "[3/4] Testing Generate P2M QR Code (Merchant Mode)..." -ForegroundColor Yellow

$qrRequest = @{
    merchantID = $merchantID
    amountPkr = 2500
    referenceId = "ORDER-$(Get-Date -Format 'yyyyMMddHHmmss')"
    purpose = "Test Payment"
    transactionType = "PURCHASE"
    expiryMinutes = 30
    subDept = "0001"
} | ConvertTo-Json

try {
    $qrResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/1link/p2m/qr" -Method Post -Body $qrRequest -Headers $headers -ContentType "application/json"
    Write-Host "  [OK] P2M QR Code Generated: SUCCESS" -ForegroundColor Green
    Write-Host "  QR Code ID: $($qrResponse.qrCodeId)" -ForegroundColor Gray
    Write-Host "  Merchant ID: $($qrResponse.merchantID)" -ForegroundColor Gray
    Write-Host "  Reference ID: $($qrResponse.referenceId)" -ForegroundColor Gray
    Write-Host "  Amount: $($qrResponse.amountPkr) PKR" -ForegroundColor Gray
    Write-Host "  Expiry: $($qrResponse.expiryDateTime)" -ForegroundColor Gray
    Write-Host "  STAN: $($qrResponse.stan)" -ForegroundColor Gray
    Write-Host "  RRN: $($qrResponse.rrn)" -ForegroundColor Gray
    if ($qrResponse.qrCodeBase64) {
        Write-Host "  QR Code: Generated (Base64 length: $($qrResponse.qrCodeBase64.Length))" -ForegroundColor Gray
    } else {
        Write-Host "  QR Code: Not in response (may be in qrData field)" -ForegroundColor Yellow
    }
    if ($qrResponse.qrData) {
        Write-Host "  QR Data: Present (length: $($qrResponse.qrData.Length))" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [ERROR] Generate P2M QR Code: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

Start-Sleep -Seconds 1

# Step 4: Generate P2M QR Code - Aggregator Mode
Write-Host "[4/4] Testing Generate P2M QR Code (Aggregator Mode)..." -ForegroundColor Yellow

$qrRequestAgg = @{
    merchantID = $merchantID
    amountPkr = 1500
    referenceId = "ORDER-AGG-$(Get-Date -Format 'yyyyMMddHHmmss')"
    transactionType = "PURCHASE"
    expiryMinutes = 30
    subDept = "0001"
} | ConvertTo-Json

try {
    $qrResponseAgg = Invoke-RestMethod -Uri "$baseUrl/api/payments/1link/p2m/qr/aggregator" -Method Post -Body $qrRequestAgg -Headers $headers -ContentType "application/json"
    Write-Host "  [OK] P2M QR Code (Aggregator) Generated: SUCCESS" -ForegroundColor Green
    Write-Host "  QR Code ID: $($qrResponseAgg.qrCodeId)" -ForegroundColor Gray
    Write-Host "  Merchant ID: $($qrResponseAgg.merchantID)" -ForegroundColor Gray
    Write-Host "  Reference ID: $($qrResponseAgg.referenceId)" -ForegroundColor Gray
    Write-Host "  Amount: $($qrResponseAgg.amountPkr) PKR" -ForegroundColor Gray
    Write-Host "  Expiry: $($qrResponseAgg.expiryDateTime)" -ForegroundColor Gray
    Write-Host "  STAN: $($qrResponseAgg.stan)" -ForegroundColor Gray
    Write-Host "  RRN: $($qrResponseAgg.rrn)" -ForegroundColor Gray
    if ($qrResponseAgg.qrCodeBase64) {
        Write-Host "  QR Code: Generated (Base64 length: $($qrResponseAgg.qrCodeBase64.Length))" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [ERROR] Generate P2M QR Code (Aggregator): FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "Test Merchant ID: $merchantID" -ForegroundColor Yellow
Write-Host ""


