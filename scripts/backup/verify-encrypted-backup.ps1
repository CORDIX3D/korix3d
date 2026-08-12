param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$EncryptedBackup
)

$ErrorActionPreference = 'Stop'

function Find-Executable([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $registeredPath = @(
    [Environment]::GetEnvironmentVariable('Path', 'User'),
    [Environment]::GetEnvironmentVariable('Path', 'Machine')
  ) -join [System.IO.Path]::PathSeparator
  foreach ($directory in $registeredPath.Split([System.IO.Path]::PathSeparator, [System.StringSplitOptions]::RemoveEmptyEntries)) {
    $expanded = [Environment]::ExpandEnvironmentVariables($directory.Trim())
    $candidate = Join-Path $expanded "$Name.exe"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  return $null
}

if (-not $env:KORIX3D_BACKUP_AGE_IDENTITY) {
  throw 'Ustaw KORIX3D_BACKUP_AGE_IDENTITY na sciezke do prywatnego klucza age.'
}

$encryptedPath = [System.IO.Path]::GetFullPath($EncryptedBackup)
$identityPath = [System.IO.Path]::GetFullPath($env:KORIX3D_BACKUP_AGE_IDENTITY)
$checksumPath = "$encryptedPath.sha256"
foreach ($required in @($encryptedPath, $identityPath, $checksumPath)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "Brak wymaganego pliku: $required"
  }
}

$age = Find-Executable 'age'
if (-not $age) { throw 'Brak programu age.' }
$tar = Find-Executable 'tar'
if (-not $tar) { throw 'Brak programu tar.' }

$expectedHash = ((Get-Content -LiteralPath $checksumPath -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
$actualHash = (Get-FileHash -LiteralPath $encryptedPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($expectedHash -notmatch '^[a-f0-9]{64}$' -or $actualHash -ne $expectedHash) {
  throw 'Suma kontrolna zaszyfrowanej kopii jest niezgodna.'
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "korix3d-restore-test-$([guid]::NewGuid().ToString('N'))"
$archivePath = Join-Path $testRoot 'backup.tar'
$extractRoot = Join-Path $testRoot 'contents'
try {
  New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
  & $age --decrypt --identity $identityPath --output $archivePath $encryptedPath
  if ($LASTEXITCODE -ne 0) { throw 'Odszyfrowanie kopii nie powiodlo sie.' }

  $archiveEntries = @(& $tar -tf $archivePath)
  if ($LASTEXITCODE -ne 0) { throw 'Odczyt listy plikow archiwum nie powiodl sie.' }
  foreach ($entry in $archiveEntries) {
    $normalized = $entry.Replace('\', '/').Trim()
    if (-not $normalized -or
        $normalized.StartsWith('/') -or
        $normalized -match '^[A-Za-z]:' -or
        @($normalized.Split('/')).Contains('..')) {
      throw "Archiwum zawiera niebezpieczna sciezke: $entry"
    }
  }

  & $tar -xf $archivePath -C $extractRoot
  if ($LASTEXITCODE -ne 0) { throw 'Rozpakowanie kopii nie powiodlo sie.' }

  & node (Join-Path $PSScriptRoot 'verify-backup.mjs') $extractRoot
  if ($LASTEXITCODE -ne 0) { throw 'Weryfikacja zawartosci kopii nie powiodla sie.' }

  Write-Host 'Test odszyfrowania, rozpakowania i sum obiektow zakonczony powodzeniem.'
} finally {
  if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
