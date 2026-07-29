$ErrorActionPreference = 'Stop'

if (-not $env:KORIX3D_BACKUP_DIR) {
  throw 'Ustaw KORIX3D_BACKUP_DIR na zaszyfrowany katalog poza repozytorium.'
}
if (-not $env:SUPABASE_DB_URL) {
  throw 'Ustaw SUPABASE_DB_URL w biezacej sesji terminala.'
}
if (-not $env:NEXT_PUBLIC_SUPABASE_URL -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
  throw 'Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY w biezacej sesji terminala.'
}

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$backupRoot = Join-Path ([System.IO.Path]::GetFullPath($env:KORIX3D_BACKUP_DIR)) $stamp
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ($backupRoot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Katalog kopii musi znajdowac sie poza repozytorium.'
}

New-Item -ItemType Directory -Path $backupRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $backupRoot 'config') | Out-Null

function Invoke-SupabaseDump([string[]]$Arguments) {
  & supabase @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Supabase CLI zakonczyl sie kodem $LASTEXITCODE." }
}

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

Write-Host "Zweryfikowana kopia zostala utworzona w: $backupRoot"
Write-Host 'Zaszyfruj ja i przenies do oddzielnej lokalizacji zgodnie z procedura.'
