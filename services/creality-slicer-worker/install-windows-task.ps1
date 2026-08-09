$ErrorActionPreference = 'Stop'

if (-not $env:CREALITY_WORKER_HOME) {
  throw 'Ustaw CREALITY_WORKER_HOME na katalog wdrozonego workera.'
}

$workerHome = [System.IO.Path]::GetFullPath($env:CREALITY_WORKER_HOME)
$workerFile = Join-Path $workerHome 'worker.mjs'
$envFile = Join-Path $workerHome 'worker.env'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$taskName = 'KORIX3D Creality Worker'

foreach ($requiredFile in @($workerFile, $envFile)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "Brak pliku $requiredFile"
  }
}

$privateKeyLine = Get-Content -LiteralPath $envFile |
  Where-Object { $_ -like 'CREALITY_SLICER_WORKER_PRIVATE_KEY_PATH=*' } |
  Select-Object -First 1
$privateKeyPath = ($privateKeyLine -split '=', 2)[1]
if (-not $privateKeyPath -or -not (Test-Path -LiteralPath $privateKeyPath -PathType Leaf)) {
  throw 'Brak prywatnego klucza podpisu workera.'
}

$keyAcl = Get-Acl -LiteralPath $privateKeyPath
$keyAcl.SetAccessRuleProtection($true, $false)
$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$currentUserRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
  $currentIdentity.Name,
  'FullControl',
  'Allow'
)
$keyAcl.SetAccessRule($currentUserRule)
Set-Acl -LiteralPath $privateKeyPath -AclObject $keyAcl

$arguments = "--env-file=`"$envFile`" `"$workerFile`""
$action = New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $workerHome
$settings = New-ScheduledTaskSettingsSet `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable

$identity = $currentIdentity
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdministrator) {
  $trigger = New-ScheduledTaskTrigger -AtStartup
  Register-ScheduledTask `
    -TaskName $taskName `
    -Description 'Zdalny worker automatycznej wyceny Creality Print' `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force | Out-Null
} else {
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
  Register-ScheduledTask `
    -TaskName $taskName `
    -Description 'Zdalny worker automatycznej wyceny Creality Print' `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -User $identity.Name `
    -RunLevel Limited `
    -Force | Out-Null
}

Start-ScheduledTask -TaskName $taskName
Write-Host 'Worker zostal zainstalowany i uruchomiony.'
