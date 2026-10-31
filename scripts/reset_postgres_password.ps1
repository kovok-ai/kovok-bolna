# ==============================================================================
# Kovok Platform — Secure Local Superuser Password Recovery
# ==============================================================================
# This script resets the local 'postgres' superuser password on Windows.
#
# Security invariants:
# 1. Runs completely locally on this Windows host.
# 2. Uses Read-Host with -AsSecureString so input is masked on screen.
# 3. Never writes the password to disk, logs, or Git-tracked files.
# 4. Strictly limits temporary trust authentication to user 'postgres' on 127.0.0.1/32.
# 5. Restores original scram-sha-256 configuration immediately upon completion.
# ==============================================================================

# 1. Require Administrator elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "This recovery script requires Administrator privileges to control the 'postgresql-x64-16' Windows service. Please re-run from an elevated PowerShell window."
    exit 1
}

# 2. Paths
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$pgData = "C:\Program Files\PostgreSQL\16\data"
$hbaFile = Join-Path $pgData "pg_hba.conf"
$hbaBak = Join-Path $pgData "pg_hba.conf.recovery.bak"
$serviceName = "postgresql-x64-16"

if (-not (Test-Path $hbaFile)) {
    Write-Error "pg_hba.conf not found at $hbaFile"
    exit 1
}

# 3. Interactive, masked password prompt
Write-Host "--- PostgreSQL 16 Superuser Password Reset ---" -ForegroundColor Cyan
$securePass1 = Read-Host -Prompt "Enter local test-only superuser password for 'postgres'" -AsSecureString
$securePass2 = Read-Host -Prompt "Confirm password" -AsSecureString

$bstr1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass1)
$bstr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass2)
$plainPass1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr1)
$plainPass2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr2)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)

if ($plainPass1 -ne $plainPass2) {
    Write-Error "Passwords do not match. Aborting."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($plainPass1)) {
    Write-Error "Password cannot be empty. Aborting."
    exit 1
}

try {
    # 4. Backup pg_hba.conf
    Write-Host "[1/5] Backing up pg_hba.conf..." -ForegroundColor Yellow
    Copy-Item $hbaFile $hbaBak -Force

    # 5. Insert strictly scoped temporary trust rule for postgres role on 127.0.0.1
    Write-Host "[2/5] Enabling temporary local recovery access..." -ForegroundColor Yellow
    $hbaContent = Get-Content $hbaFile -Raw
    $recoveryRule = "host    all             postgres        127.0.0.1/32            trust`r`n"
    Set-Content -Path $hbaFile -Value ($recoveryRule + $hbaContent) -Force

    # 6. Restart service to apply temporary rule
    Write-Host "[3/5] Restarting PostgreSQL service..." -ForegroundColor Yellow
    Restart-Service -Name $serviceName -Force

    # 7. Apply ALTER USER
    Write-Host "[4/5] Updating superuser password in PostgreSQL..." -ForegroundColor Yellow
    $psqlExe = Join-Path $pgBin "psql.exe"
    
    # Pass SQL command via standard input to avoid exposing password in process arguments
    $escapedPass = $plainPass1.Replace("'", "''")
    $sqlCmd = "ALTER USER postgres WITH PASSWORD '$escapedPass';"
    
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $psqlExe
    $psi.Arguments = "-h 127.0.0.1 -U postgres -d postgres -q"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.WriteLine($sqlCmd)
    $proc.StandardInput.Close()
    $errOutput = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    if ($proc.ExitCode -ne 0) {
        throw "Failed to update password: $errOutput"
    }

} finally {
    # 8. Always restore original pg_hba.conf
    Write-Host "[5/5] Restoring original secure pg_hba.conf and restarting service..." -ForegroundColor Yellow
    if (Test-Path $hbaBak) {
        Copy-Item $hbaBak $hbaFile -Force
        Remove-Item $hbaBak -Force
    }
    Restart-Service -Name $serviceName -Force
}

# 9. Verify SCRAM authentication with the new password
Write-Host "`nVerifying SCRAM authentication on 127.0.0.1:5432..." -ForegroundColor Cyan
$env:PGPASSWORD = $plainPass1
$verifyOutput = & "$pgBin\psql.exe" -h 127.0.0.1 -U postgres -d postgres -c "SELECT 'SCRAM Authentication Verified: ' || current_user || ' on ' || version();" 2>&1
$env:PGPASSWORD = $null

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSUCCESS: PostgreSQL 16 superuser password reset and verified!" -ForegroundColor Green
    Write-Host $verifyOutput
} else {
    Write-Error "Verification failed: $verifyOutput"
}
