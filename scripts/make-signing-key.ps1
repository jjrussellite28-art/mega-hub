#requires -Version 7
# Makes Mega Hub's own signing key ON THIS PC. The private key never leaves it: it is protected for your Windows account (DPAPI)
# and stored at %USERPROFILE%\.megahub\catalog-signing.key. Only the PUBLIC key is printed; send that to Claude (it is safe to share).
# Stops if a key is already there, so it can never overwrite one.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData -ErrorAction SilentlyContinue
$dir = Join-Path $env:USERPROFILE '.megahub'
$file = Join-Path $dir 'catalog-signing.key'
if (Test-Path $file) { throw "A key is already at $file. Not overwriting it." }
New-Item -ItemType Directory -Force $dir | Out-Null
$ecdsa = [System.Security.Cryptography.ECDsa]::Create([System.Security.Cryptography.ECCurve]::CreateFromValue('1.2.840.10045.3.1.7'))
try {
    $plain = $ecdsa.ExportPkcs8PrivateKey()
    $protected = [System.Security.Cryptography.ProtectedData]::Protect($plain, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Array]::Clear($plain, 0, $plain.Length)
    [IO.File]::WriteAllText($file, [Convert]::ToBase64String($protected))
    $pem = $ecdsa.ExportSubjectPublicKeyInfoPem()
}
finally { $ecdsa.Dispose() }
Write-Host "Key saved at $file (only this Windows account can read it). Back it up somewhere safe: without it nothing new can be signed."
Write-Host ''
Write-Host 'Send this PUBLIC key to Claude:'
Write-Host $pem
$pem | Set-Clipboard
Write-Host '(It is also copied to your clipboard.)'
