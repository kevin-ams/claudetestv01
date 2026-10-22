# Configura crm/.env.local con las credenciales de Google y un AUTH_SECRET nuevo.
#
# Uso (desde la carpeta del CRM):
#   powershell -ExecutionPolicy Bypass -File .\scripts\configurar-entorno.ps1
#
# El secreto se escribe solo en .env.local, que Git ignora: nunca se sube al repositorio.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"
$example = Join-Path $root ".env.example"

if (-not (Test-Path $envFile)) {
    Copy-Item $example $envFile
    Write-Host "Se creó .env.local a partir de .env.example" -ForegroundColor Cyan
}

$lines = [System.Collections.Generic.List[string]](Get-Content $envFile -Encoding UTF8)

function Get-Value([string]$key) {
    foreach ($line in $lines) {
        if ($line -match "^$key=(.*)$") { return $Matches[1] }
    }
    return ""
}

function Set-Value([string]$key, [string]$value) {
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^$key=") {
            $lines[$i] = "$key=$value"
            return
        }
    }
    $lines.Add("$key=$value")
}

function Read-Secret([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host ""
Write-Host "Configuración de Ams CRM" -ForegroundColor Blue
Write-Host "Deja en blanco cualquier valor para conservar el actual."
Write-Host ""

$clientId = (Read-Host "GOOGLE_CLIENT_ID (termina en .apps.googleusercontent.com)").Trim()
if ($clientId) {
    if ($clientId -notlike "*.apps.googleusercontent.com") {
        Write-Warning "El ID no termina en .apps.googleusercontent.com; revisa que sea el ID de cliente correcto."
    }
    Set-Value "GOOGLE_CLIENT_ID" $clientId
}

$clientSecret = (Read-Secret "GOOGLE_CLIENT_SECRET (no se mostrará al escribir)").Trim()
if ($clientSecret) { Set-Value "GOOGLE_CLIENT_SECRET" $clientSecret }

if (-not (Get-Value "AUTH_SECRET")) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    Set-Value "AUTH_SECRET" ([Convert]::ToBase64String($bytes))
    Write-Host "AUTH_SECRET generado." -ForegroundColor Cyan
}

# UTF-8 sin BOM, para que Next.js lea bien la primera línea.
[IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Listo: $envFile" -ForegroundColor Green
Write-Host "GOOGLE_CLIENT_ID     = $(if (Get-Value 'GOOGLE_CLIENT_ID') { 'configurado' } else { 'vacío' })"
Write-Host "GOOGLE_CLIENT_SECRET = $(if (Get-Value 'GOOGLE_CLIENT_SECRET') { 'configurado' } else { 'vacío' })"
Write-Host "AUTH_SECRET          = configurado"
Write-Host ""
Write-Host "Reinicia 'npm run dev' para que tome los cambios."
