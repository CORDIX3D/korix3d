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

if (-not $env:KORIX3D_BACKUP_DIR) {
  throw 'Ustaw KORIX3D_BACKUP_DIR na katalog poza repozytorium.'
}
if (-not $env:KORIX3D_BACKUP_AGE_RECIPIENT) {
  throw 'Ustaw KORIX3D_BACKUP_AGE_RECIPIENT na publiczny klucz age (age1...).'
}
if (-not $env:SUPABASE_DB_URL) {
  throw 'Ustaw SUPABASE_DB_URL w biezacej sesji terminala.'
}
if (-not $env:NEXT_PUBLIC_SUPABASE_URL -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
  throw 'Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY w biezacej sesji terminala.'
}

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$destinationRoot = [System.IO.Path]::GetFullPath($env:KORIX3D_BACKUP_DIR)
$backupRoot = Join-Path $destinationRoot ".korix3d-backup-$stamp.incomplete"
$archivePath = Join-Path $destinationRoot "korix3d-backup-$stamp.tar"
$encryptedPath = "$archivePath.age"
$checksumPath = "$encryptedPath.sha256"
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$repoPrefix = $repoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if ($destinationRoot.Equals($repoRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $destinationRoot.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Katalog kopii musi znajdowac sie poza repozytorium.'
}

$age = Find-Executable 'age'
if (-not $age) { throw 'Brak programu age. Zainstaluj bezplatny pakiet FiloSottile.age.' }
$tar = Find-Executable 'tar'
if (-not $tar) { throw 'Brak programu tar wymaganego do utworzenia archiwum.' }

$supabase = Find-Executable 'supabase'
$npx = Find-Executable 'npx'
if (-not $supabase -and -not $npx) {
  throw 'Brak Supabase CLI oraz npx. Zainstaluj jedno z tych narzedzi.'
}

function Invoke-SupabaseDump([string[]]$Arguments) {
  if ($supabase) {
    & $supabase @Arguments
  } else {
    & $npx --yes 'supabase@2.113.0' @Arguments
  }
  if ($LASTEXITCODE -ne 0) { throw "Supabase CLI zakonczyl sie kodem $LASTEXITCODE." }
}

$completed = $false
try {
  New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $backupRoot | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $backupRoot 'config') | Out-Null

  Invoke-SupabaseDump @('db', 'dump', '--db-url', $env:SUPABASE_DB_URL, '--file', (Join-Path $backupRoot 'roles.sql'), '--role-only')
  Invoke-SupabaseDump @('db', 'dump', '--db-url', $env:SUPABASE_DB_URL, '--file', (Join-Path $backupRoot 'schema.sql'))
  Invoke-SupabaseDump @('db', 'dump', '--db-url', $env:SUPABASE_DB_URL, '--file', (Join-Path $backupRoot 'data.sql'), '--use-copy', '--data-only', '--exclude', 'storage.buckets_vectors', '--exclude', 'storage.vector_indexes')
  Invoke-SupabaseDump @('db', 'dump', '--db-url', $env:SUPABASE_DB_URL, '--file', (Join-Path $backupRoot 'history_schema.sql'), '--schema', 'supabase_migrations')
  Invoke-SupabaseDump @('db', 'dump', '--db-url', $env:SUPABASE_DB_URL, '--file', (Join-Path $backupRoot 'history_data.sql'), '--use-copy', '--data-only', '--schema', 'supabase_migrations')

  & node (Join-Path $PSScriptRoot 'backup-storage.mjs') $backupRoot
  if ($LASTEXITCODE -ne 0) { throw 'Kopia Storage nie powiodla sie.' }

  Copy-Item (Join-Path $repoRoot 'supabase\config.toml') (Join-Path $backupRoot 'config\supabase-config.toml')
  Copy-Item (Join-Path $repoRoot 'vercel.json') (Join-Path $backupRoot 'config\vercel.json')
  Copy-Item (Join-Path $repoRoot '.env.example') (Join-Path $backupRoot 'config\env-contract.example')

  & node (Join-Path $PSScriptRoot 'verify-backup.mjs') $backupRoot
  if ($LASTEXITCODE -ne 0) { throw 'Weryfikacja kopii nie powiodla sie.' }

  Get-ChildItem -Path $backupRoot -Recurse -File | ForEach-Object {
    [PSCustomObject]@{
      Path = $_.FullName.Substring($backupRoot.Length + 1)
      Bytes = $_.Length
      Sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $backupRoot 'backup-checksums.json') -Encoding utf8

  & $tar -cf $archivePath -C $backupRoot .
  if ($LASTEXITCODE -ne 0) { throw 'Utworzenie archiwum kopii nie powiodlo sie.' }

  & $age --recipient $env:KORIX3D_BACKUP_AGE_RECIPIENT --output $encryptedPath $archivePath
  if ($LASTEXITCODE -ne 0) { throw 'Szyfrowanie kopii nie powiodlo sie.' }

  $digest = (Get-FileHash -LiteralPath $encryptedPath -Algorithm SHA256).Hash.ToLowerInvariant()
  "$digest  $([System.IO.Path]::GetFileName($encryptedPath))" | Set-Content -LiteralPath $checksumPath -Encoding ascii
  $completed = $true
} finally {
  if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
  if (Test-Path -LiteralPath $backupRoot) { Remove-Item -LiteralPath $backupRoot -Recurse -Force }
  if (-not $completed) {
    if (Test-Path -LiteralPath $encryptedPath) { Remove-Item -LiteralPath $encryptedPath -Force }
    if (Test-Path -LiteralPath $checksumPath) { Remove-Item -LiteralPath $checksumPath -Force }
  }
}

Write-Host "Zaszyfrowana i zweryfikowana kopia: $encryptedPath"
Write-Host "Suma kontrolna SHA-256: $checksumPath"
