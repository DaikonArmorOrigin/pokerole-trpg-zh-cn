@echo off
rem ============================================================
rem  Pokemon TRPG rulebook -- local preview launcher
rem
rem  Double-click this file:
rem    - starts a tiny local web server (serve.py)
rem    - opens the rulebook in your default browser
rem  Close the black window (or press Ctrl+C) to stop it.
rem
rem  Why a server is needed: browsers forbid a file:// page from
rem  reading other local files, and the site reads .md files at
rem  runtime. Opening index.html directly will always be blank.
rem ============================================================
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if not errorlevel 1 (
    python "%~dp0serve.py" %*
    goto :done
)

where py >nul 2>nul
if not errorlevel 1 (
    py -3 "%~dp0serve.py" %*
    goto :done
)

echo.
echo   [X] Python 3 not found on this computer.
echo.
echo   Install it from  https://www.python.org/downloads/
echo   During setup, tick  "Add python.exe to PATH",
echo   then double-click this file again.
echo.
pause
exit /b 1

:done
echo.
pause
