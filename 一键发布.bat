@echo off
rem ============================================================
rem  Pokemon TRPG rulebook -- one-click publish
rem
rem  Double-click this file to:
rem    1. list every file you changed
rem    2. ask for a one-line note (press Enter to use the default)
rem    3. commit and push to GitHub
rem  GitHub Pages rebuilds the site about 30 seconds later.
rem
rem  Nothing is ever deleted or force-pushed: it only runs
rem  "git add -A" + "git commit" + "git push".
rem ============================================================
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if not errorlevel 1 (
    python "%~dp0_dev\publish.py" %*
    goto :done
)

where py >nul 2>nul
if not errorlevel 1 (
    py -3 "%~dp0_dev\publish.py" %*
    goto :done
)

echo.
echo   [X] Python 3 not found on this computer.
echo       See 启动预览.bat for install instructions.
echo.
pause
exit /b 1

:done
echo.
pause
