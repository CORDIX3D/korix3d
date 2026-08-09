@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Zainstaluj KORIX3D.ps1"
if errorlevel 1 (
  echo.
  echo Instalacja KORIX3D nie powiodla sie.
  pause
  exit /b 1
)
echo.
echo KORIX3D zostal zainstalowany.
pause
