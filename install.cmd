@echo off
:: SCRIPT REVIEW
:: What it does:        Single Windows entry point for installing the plugin. Detects an
::                      available runtime in order (real Git Bash -> Node.js -> PowerShell)
::                      and delegates to the matching installer (install.sh / install.cjs /
::                      install.ps1), forwarding the user's arguments.
:: What it touches:     Nothing itself — it only launches one of the sibling installers in
::                      this same folder (%~dp0). Those installers perform the actual writes.
:: What it does NOT do: No file writes, no registry edits, no network calls, no git ops of
::                      its own. Does not modify PATH or environment permanently.
:: APIs / commands:     where.exe, Windows batch IF/EXIST, and one of:
::                      bash install.sh | node install.cjs | powershell -File install.ps1
:: How to verify:       Run "install.cmd" in CMD; confirm it prints which runtime it chose
::                      and that the chosen installer's banner appears. "echo %errorlevel%"
::                      after it exits should equal the delegated installer's exit code.
::
:: Order rationale (see docs/plans/2026-07-30-install-setup-ease-permissions-graph-decoupling.md):
::   - Git Bash first, probed by explicit path (NOT `where bash`) so we never pick up WSL's
::     System32\bash.exe, which would break Windows path assumptions (S12/R2).
::   - Node.js second: install.cjs uses the SAME --flags as install.sh, so argument
::     forwarding is safe with no translation (R1).
::   - PowerShell last: install.ps1 uses -Update/-Uninstall/-Yes switches, so bash-style
::     flags must be TRANSLATED (R1). Reached rarely since Node is almost always present.

setlocal enabledelayedexpansion

:: ── 1. Real Git Bash (probe known install locations; avoid WSL bash) ─────────────────
set "_GITBASH="
if exist "%ProgramFiles%\Git\bin\bash.exe"        set "_GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if exist "%ProgramFiles(x86)%\Git\bin\bash.exe"   set "_GITBASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "_GITBASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if defined _GITBASH (
  echo Using Git Bash: "!_GITBASH!"
  "!_GITBASH!" "%~dp0install.sh" %*
  exit /b !errorlevel!
)

:: ── 2. Node.js (flag-compatible with install.sh) ─────────────────────────────────────
where node >nul 2>&1
if !errorlevel! == 0 (
  echo Using Node.js installer.
  node "%~dp0install.cjs" %*
  exit /b !errorlevel!
)

:: ── 3. PowerShell (last resort — translate bash flags to switches) ───────────────────
where powershell >nul 2>&1
if !errorlevel! == 0 (
  set "_PS="
  if /I "%~1" == "--update"    set "_PS=-Update"
  if /I "%~1" == "--uninstall" set "_PS=-Uninstall"
  if /I "%~2" == "--yes"       set "_PS=!_PS! -Yes"
  echo Using PowerShell installer. !_PS!
  powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1" !_PS!
  exit /b !errorlevel!
)

echo ERROR: No supported runtime found. Install Git for Windows, Node.js, or PowerShell.
exit /b 1
