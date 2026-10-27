@echo off
rem radical.cmd runs the radical command line (https://radical.tools) with a
rem Node.js it finds on the PATH or, where there is none, downloads.
rem
rem   radical.cmd setup          connects your coding agents to a model folder
rem   radical.cmd <command> ...  any radical command (radical.cmd --help)
rem   radical.cmd mcp ...        the MCP server, as the agents start it
rem
rem Node.js 20.11 or later with npx beside it is taken from the PATH, else from
rem %USERPROFILE%\.radical\node (RADICAL_HOME). With neither, it asks (or takes
rem --yes) and downloads the latest Node.js 24 for this machine from nodejs.org
rem (RADICAL_NODE_MIRROR), checked against its SHA-256 sum, with the curl, tar
rem and certutil of Windows 10 and later. It never asks for mcp: an agent has no
rem terminal to answer in.
rem
rem radical setup pins the version below to its own. RADICAL_VERSION picks
rem another for one run: set RADICAL_VERSION=latest, then radical.cmd setup.
setlocal EnableExtensions

set "DEFAULT_VERSION=latest"
if not defined RADICAL_VERSION set "RADICAL_VERSION=%DEFAULT_VERSION%"
if not defined RADICAL_HOME set "RADICAL_HOME=%USERPROFILE%\.radical"
if not defined RADICAL_NODE_MIRROR set "RADICAL_NODE_MIRROR=https://nodejs.org/dist"
set "NODE_LINE=24"
set "ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"
if /i "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "ARCH=arm64"
set "BIN="

for /f "delims=" %%i in ('where node 2^>nul') do if not defined BIN if exist "%%~dpinpx.cmd" (
  "%%i" -e "const [a, b] = process.versions.node.split('.').map(Number); process.exit(a > 20 || (a === 20 && b >= 11) ? 0 : 1)" >nul 2>nul && set "BIN=%%~dpi"
)
rem One downloaded before: any of them will do.
if not defined BIN for /d %%d in ("%RADICAL_HOME%\node\node-v*-win-%ARCH%") do if exist "%%d\node.exe" if exist "%%d\npx.cmd" set "BIN=%%d\"
if defined BIN goto run

if /i "%~1"=="mcp" (
  echo radical.cmd: no Node.js 20.11 or later is installed: run radical.cmd setup in a terminal first, which downloads one. 1>&2
  exit /b 1
)
set "YES=%RADICAL_YES%"
for %%a in (%*) do (
  if /i "%%~a"=="--yes" set "YES=1"
  if /i "%%~a"=="-y" set "YES=1"
)
if defined YES goto download
set "ANSWER="
set /p "ANSWER=Node.js 20.11 or later is not installed. Download Node.js %NODE_LINE% (about 35 MB) from %RADICAL_NODE_MIRROR% into %RADICAL_HOME%\node? [yes] "
if not defined ANSWER goto download
if /i "%ANSWER:~0,1%"=="y" goto download
echo radical.cmd: no Node.js 20.11 or later is installed: install one (https://nodejs.org), or run it again to download Node.js %NODE_LINE% into %RADICAL_HOME%\node. 1>&2
exit /b 1

:download
set "DIST=%RADICAL_NODE_MIRROR%/latest-v%NODE_LINE%.x"
rem Unpacked beside where it goes: move cannot take a folder to another drive.
set "WORK=%RADICAL_HOME%\node\.download-%RANDOM%%RANDOM%"
mkdir "%WORK%" || exit /b 1
curl.exe -fsSL "%DIST%/SHASUMS256.txt" -o "%WORK%\sums"
if errorlevel 1 (
  echo radical.cmd: could not download %DIST%/SHASUMS256.txt. 1>&2
  goto failed
)
set "SUM="
set "NAME="
for /f "tokens=1,2" %%a in ('findstr /l /c:"-win-%ARCH%.zip" "%WORK%\sums"') do if not defined NAME (
  set "SUM=%%a"
  set "NAME=%%~nb"
)
if not defined NAME (
  echo radical.cmd: %DIST% has no Node.js build for win-%ARCH%. 1>&2
  goto failed
)
echo Downloading %NAME% from %DIST% ... 1>&2
curl.exe -fsSL "%DIST%/%NAME%.zip" -o "%WORK%\node.zip"
if errorlevel 1 (
  echo radical.cmd: could not download %DIST%/%NAME%.zip. 1>&2
  goto failed
)
set "GOT="
for /f "skip=1 delims=" %%h in ('certutil -hashfile "%WORK%\node.zip" SHA256') do if not defined GOT set "GOT=%%h"
set "GOT=%GOT: =%"
if /i not "%GOT%"=="%SUM%" (
  echo radical.cmd: %NAME%.zip does not match its SHA-256 sum in SHASUMS256.txt, so it was not installed. 1>&2
  goto failed
)
tar -xf "%WORK%\node.zip" -C "%WORK%"
if errorlevel 1 (
  echo radical.cmd: could not unpack %NAME%.zip. 1>&2
  goto failed
)
if exist "%RADICAL_HOME%\node\%NAME%" rmdir /s /q "%RADICAL_HOME%\node\%NAME%"
rem A virus scanner may still hold the files just unpacked: try again.
set "TRIES=0"
:move
move "%WORK%\%NAME%" "%RADICAL_HOME%\node\%NAME%" >nul 2>nul
if not errorlevel 1 goto moved
set /a TRIES+=1
if %TRIES% lss 5 (
  ping -n 3 127.0.0.1 >nul
  goto move
)
echo radical.cmd: could not move Node.js into %RADICAL_HOME%\node. 1>&2
goto failed
:moved
rmdir /s /q "%WORK%"
set "BIN=%RADICAL_HOME%\node\%NAME%\"
echo Node.js is in %RADICAL_HOME%\node\%NAME%. 1>&2

:run
set "PATH=%BIN%;%PATH%"
set "RADICAL_LAUNCHER=%~f0"
rem The MCP server takes few arguments (--folder <path>, --metamodel <name>):
rem %2 to %9 pass them on without mcp.
if /i "%~1"=="mcp" (
  call "%BIN%npx.cmd" -y "@radicaltools/mcp@%RADICAL_VERSION%" %2 %3 %4 %5 %6 %7 %8 %9
) else (
  call "%BIN%npx.cmd" -y "@radicaltools/cli@%RADICAL_VERSION%" %*
)
exit /b %ERRORLEVEL%

:failed
rmdir /s /q "%WORK%" 2>nul
exit /b 1
