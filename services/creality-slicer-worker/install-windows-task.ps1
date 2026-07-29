$ErrorActionPreference = 'Stop'

if (-not $env:CREALITY_WORKER_HOME) {
  throw 'Ustaw CREALITY_WORKER_HOME na katalog wdrozonego workera.'
}

$workerHome = [System.IO.Path]::GetFullPath($env:CREALITY_WORKER_HOME)
$workerFile = Join-Path $workerHome 'worker.mjs'
$envFile = Join-Path $workerHome 'worker.env'
$node = (Get-Command node.exe -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $workerFile -PathType Leaf)) {
  throw "Brak pliku $workerFile"
}
if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
  throw "Brak pliku $envFile"
}

$acl = Get-Acl -LiteralPath $envFile
if (-not $acl.AreAccessRulesProtected) {
  throw 'Plik worker.env musi miec wylaczone dziedziczenie uprawnien NTFS.'
}

$action = New-ScheduledTaskAction `
  -Execute $node `
  -Argument "--env-file=$envFile $workerFile" `
  -WorkingDirectory $workerHome
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName 'KORIX3D Creality Worker' `
  -Description 'Zdalny worker automatycznej wyceny Creality Print' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -RunLevel Highest `
  -Force

Start-ScheduledTask -TaskName 'KORIX3D Creality Worker'
Write-Host 'Worker zostal zainstalowany. Sprawdz heartbeat w /admin/slicer.'
