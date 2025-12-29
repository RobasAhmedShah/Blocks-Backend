# Test P2M Merchant APIs - Test Mode
# Run: .\test-merchant-test-mode.ps1

$baseUrl = "http://localhost:3000"
$testEmail = "testmerchant@example.com"
$testPassword = "TestPassword123!"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  P2M Merchant API Test (Test Mode)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Login/Register to get JWT token
Write-Host "[1/5] Authenticating..." -ForegroundColor Yellow
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

# Test merchant data
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
        }
        contactDetails = @{
            phoneNo = "+922112345678"
            mobileNo = "+923001234567"
            email = "test@example.com"
            dept = "Sales"
            website = "https://example.com"
        }
        paymentDetails = @{
            feeType = "F"
            feeValue = 15
        }
    }
}

# Test 2: Create Test Merchant Profile (Test Mode)
Write-Host "[2/5] Testing Create Test Merchant Profile (Test Mode)..." -ForegroundColor Yellow
try {
    $createBody = $testMerchant | ConvertTo-Json -Depth 10
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/1link/merchant/profile/test" -Method Post -Body $createBody -Headers $headers -ContentType "application/json"
    Write-Host "  [OK] Create Test Merchant Profile: SUCCESS" -ForegroundColor Green
    Write-Host "  Response Code: $($createResponse.responseCode)" -ForegroundColor Gray
    Write-Host "  Response Description: $($createResponse.responseDescription)" -ForegroundColor Gray
    Write-Host "  Merchant ID: $($createResponse.merchantProfile.merchantID)" -ForegroundColor Gray
} catch {
    Write-Host "  [ERROR] Create Test Merchant Profile: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}
Write-Host ""

Start-Sleep -Seconds 1

# Test 3: Get Test Merchant Profile
Write-Host "[3/5] Testing Get Merchant Profile..." -ForegroundColor Yellow
try {
    $getResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/1link/merchant/profile?merchantID=$merchantID" -Method Get -Headers $headers
    Write-Host "  [OK] Get Merchant Profile: SUCCESS" -ForegroundColor Green
    Write-Host "  Response Code: $($getResponse.responseCode)" -ForegroundColor Gray
    if ($getResponse.merchantProfile) {
        Write-Host "  Merchant ID: $($getResponse.merchantProfile.merchantID)" -ForegroundColor Gray
        Write-Host "  DBA Name: $($getResponse.merchantProfile.dbaName)" -ForegroundColor Gray
        Write-Host "  Status: $($getResponse.merchantProfile.merchantStatus)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [ERROR] Get Merchant Profile: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Start-Sleep -Seconds 1

# Test 4: List All Merchant Profiles
Write-Host "[4/5] Testing List All Merchant Profiles..." -ForegroundColor Yellow
try {
    $listResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/1link/merchant/profiles" -Method Get -Headers $headers
    Write-Host "  [OK] List Merchant Profiles: SUCCESS" -ForegroundColor Green
    Write-Host "  Total Profiles: $($listResponse.count)" -ForegroundColor Gray
    if ($listResponse.profiles -and $listResponse.profiles.Count -gt 0) {
        Write-Host "  First Profile: $($listResponse.profiles[0].merchantID)" -ForegroundColor Gray
        Write-Host "  Found our test merchant: $($listResponse.profiles | Where-Object { $_.merchantID -eq $merchantID } | Measure-Object | Select-Object -ExpandProperty Count) time(s)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [ERROR] List Merchant Profiles: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Start-Sleep -Seconds 1

# Test 5: Test Webhook Endpoints (No Auth)
Write-Host "[5/5] Testing Webhook Endpoints..." -ForegroundColor Yellow

# Test Notify Merchant
$notifyBody = @{
    info = @{
        rrn = "123456789012"
        stan = "123456"
        dateTime = (Get-Date -Format "o")
    }
    messageInfo = @{
        merchantID = $merchantID
        subDept = "Sales"
        status = "ACCP"
    }
} | ConvertTo-Json -Depth 10

try {
    $notifyResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/1link/merchant/notify" -Method Post -Body $notifyBody -ContentType "application/json"
    Write-Host "  [OK] Notify Merchant: SUCCESS" -ForegroundColor Green
    Write-Host "  Message: $($notifyResponse.message)" -ForegroundColor Gray
} catch {
    Write-Host "  [ERROR] Notify Merchant: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Payment Notification
$paymentNotifyBody = @{
    info = @{
        rrn = "123456789012"
        stan = "123456"
        dateTime = (Get-Date -Format "o")
    }
    messageInfo = @{
        merchantID = $merchantID
        subDept = "Sales"
        status = "ACCP"
        orginalInstructedAmount = "1000.00"
        netAmount = "985.00"
    }
} | ConvertTo-Json -Depth 10

try {
    $paymentNotifyResponse = Invoke-RestMethod -Uri "$baseUrl/api/payments/1link/merchant/payment-notification" -Method Post -Body $paymentNotifyBody -ContentType "application/json"
    Write-Host "  [OK] Payment Notification: SUCCESS" -ForegroundColor Green
    Write-Host "  Message: $($paymentNotifyResponse.message)" -ForegroundColor Gray
} catch {
    Write-Host "  [ERROR] Payment Notification: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "Test Merchant ID: $merchantID" -ForegroundColor Yellow
Write-Host "You can now use this merchant for P2M QR code testing!" -ForegroundColor Green
Write-Host ""


