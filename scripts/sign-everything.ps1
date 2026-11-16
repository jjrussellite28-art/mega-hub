#requires -Version 7
# One run on the owner's PC (the one with the key): builds the Achievements plugin, signs it with Mega Hub's own key,
# uploads the package to the release the catalog points to, signs the catalog index and commits it.
#
#   .\scripts\sign-everything.ps1
#   .\scripts\sign-everything.ps1 -ReleaseTag v0.8.0   # additionally signs that release's checksum file (sign-release.ps1)
#
# Needs: PowerShell 7, the .NET SDK, the GitHub CLI (gh, signed in with write access), git. The key stays at
# %USERPROFILE%\.megahub\catalog-signing.key; this script never creates one.
param(
    [string] $ReleaseTag = '',
    [string] $Plugin = 'MegaHub.Plugin.Achievements',
    [string] $Id = 'achievements',
    [string] $Repo = 'jjrussellite28-art/mega-hub'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Test-Path (Join-Path $env:USERPROFILE '.megahub\catalog-signing.key'))) { throw 'No signing key at %USERPROFILE%\.megahub\catalog-signing.key. Run this on the PC that holds it.' }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) not found.' }

$statementFile = Join-Path $root "catalog\statements\$Id.json"
$version = (Get-Content $statementFile -Raw | ConvertFrom-Json).version
$out = Join-Path $root 'publish-plugins'

Write-Host "1/5 Building $Plugin $version"
dotnet publish "plugins/$Plugin/$Plugin.csproj" -c Release -o "$out/$Plugin"
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed.' }

# The catalog entry is added once (from catalog/statements/<id>.entry.json); the signing step fills in hash, statement and signature.
$indexFile = Join-Path $root 'catalog\index.json'
$index = Get-Content $indexFile -Raw | ConvertFrom-Json -AsHashtable
$entry = Get-Content (Join-Path $root "catalog\statements\$Id.entry.json") -Raw | ConvertFrom-Json -AsHashtable
$current = $index.entries | Where-Object { $_.id -eq $Id }
if (-not $current -or $current.version -ne $entry.version -or $current.category -ne $entry.category) {
    # New, or a new version / category: the entry is replaced by the template; the signing step below fills in hash, statement and signature again.
    $index.entries = @($index.entries | Where-Object { $_.id -ne $Id }) + $entry
    $index.serial = [int]$index.serial + 1
    ($index | ConvertTo-Json -Depth 20) + "`n" | Set-Content $indexFile -Encoding utf8NoBOM
}

Write-Host '2/5 Signing the package statement'
& (Join-Path $PSScriptRoot 'sign-plugin-statement.ps1') -Statement $statementFile -Folder "$out/$Plugin" -OutDir $out

Write-Host '3/5 Uploading the package to the release'
$tag = "$Id-$version"
$zip = Join-Path $out "$Plugin-$version.zip"
gh release view $tag -R $Repo *> $null
if ($LASTEXITCODE -ne 0) { gh release create $tag $zip -R $Repo --title "$Id $version" --notes "Signed plugin package for the Mega Hub catalog." }
else { gh release upload $tag $zip -R $Repo --clobber }
if ($LASTEXITCODE -ne 0) { throw 'Upload failed.' }

Write-Host '4/5 Signing the catalog index'
& (Join-Path $PSScriptRoot 'catalog-sign.ps1') -Index (Join-Path $root 'catalog\index.json')

Remove-Item (Join-Path $root 'catalog\index.json.unsigned') -ErrorAction SilentlyContinue
Write-Host '5/5 Committing the signed catalog'
git add catalog
git commit -m "Catalog: signed $Id $version with Mega Hub's own key"
if ($LASTEXITCODE -ne 0) { throw 'git commit failed (is your name and e-mail set? git config --global user.name / user.email).' }
git push
if ($LASTEXITCODE -ne 0) { throw 'git push failed: the catalog is signed but not saved to GitHub.' }

if ($ReleaseTag) {
    Write-Host "Signing the release $ReleaseTag"
    & (Join-Path $PSScriptRoot 'sign-release.ps1') -Tag $ReleaseTag -Repo $Repo
}
Write-Host 'Done. Tell Claude: signed.'
