param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'KORIX3D'),
  [string]$DesktopPath = [Environment]::GetFolderPath('Desktop'),
  [string]$StartMenuPath = (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
  [switch]$SkipLaunch
)

$ErrorActionPreference = 'Stop'
$appUrl = 'https://korix3d.pl/admin/produkcja'
$shortcutName = 'KORIX3D Produkcja.lnk'

$browserCandidates = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)

$browser = $browserCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $browser) {
  throw 'Nie znaleziono Microsoft Edge ani Google Chrome.'
}

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path $DesktopPath -Force | Out-Null
New-Item -ItemType Directory -Path $StartMenuPath -Force | Out-Null

$shell = New-Object -ComObject WScript.Shell
foreach ($targetDirectory in @($DesktopPath, $StartMenuPath)) {
  $shortcutPath = Join-Path $targetDirectory $shortcutName
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $browser
  $shortcut.Arguments = "--app=$appUrl --start-maximized"
  $shortcut.WorkingDirectory = Split-Path -Parent $browser
  $shortcut.IconLocation = "$browser,0"
  $shortcut.Description = 'Centrum produkcji KORIX3D'
  $shortcut.Save()
}

$installationInfo = @"
KORIX3D Produkcja
Adres: $appUrl
Przeglądarka systemowa: $browser
Zainstalowano: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@
Set-Content -LiteralPath (Join-Path $InstallRoot 'instalacja.txt') -Value $installationInfo -Encoding UTF8

if (-not $SkipLaunch) {
  Start-Process -FilePath $browser -ArgumentList "--app=$appUrl", '--start-maximized'
}

Write-Host 'Utworzono aplikację KORIX3D na pulpicie i w menu Start.'
