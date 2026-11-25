@echo off
rem Parchi working slice: set up what is missing, then run.
rem
rem   run.bat                 start with the mode in .env, and open the browser
rem   run.bat offline         offline test mode: stand-in models, no key, no cost
rem   run.bat live            real models (an API key in .env, e.g. OPENAI_API_KEY)
rem   run.bat build           rebuild the UI first, then start
rem   run.bat test            every offline check: Python tests, lint, browser tests
rem   run.bat help            show this
rem
rem Add --no-browser after any start command to skip opening the browser.

setlocal EnableExtensions
cd /d "%~dp0"

set "MODE=%~1"
set "OPEN_BROWSER=1"
if /i "%~2"=="--no-browser" set "OPEN_BROWSER="
if /i "%~1"=="--no-browser" (set "MODE=" & set "OPEN_BROWSER=")
if /i "%MODE%"=="help" goto :help
if /i "%MODE%"=="-h" goto :help
if /i "%MODE%"=="/?" goto :help

rem ---- Python 3.12 and Node -------------------------------------------------------------
where python >nul 2>nul || (echo Python is not on PATH. Install Python 3.12 or later. & exit /b 1)
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)" || (echo Python 3.12 or later is needed. & exit /b 1)
where npm >nul 2>nul || (echo Node.js is not on PATH. Install Node 20 or later. & exit /b 1)

rem ---- settings: a new .env starts in offline test mode, so it runs with no key ----------
if not exist ".env" (
  echo Creating .env from .env.example, in offline test mode.
  echo For live models, put your OpenAI key in working-slice\.env and run: run.bat live
  copy /y ".env.example" ".env" >nul
  python -c "import pathlib, re; p = pathlib.Path('.env'); p.write_text(re.sub(r'(?m)^PARCHI_FAKE_MODELS=0', 'PARCHI_FAKE_MODELS=1', p.read_text(encoding='utf-8')), encoding='utf-8')"
)

rem ---- packages, only when missing ----------------------------------------------------------
python -c "import fastapi, uvicorn, langgraph, pydantic_settings" 2>nul || (
  echo Installing the Python packages...
  python -m pip install -r requirements.txt || exit /b 1
)
if not exist "web\node_modules" (
  echo Installing the UI's packages...
  pushd web
  call npm install || (popd & exit /b 1)
  popd
)

if /i "%MODE%"=="test" goto :test

rem ---- the UI: built once, or again on request ---------------------------------------------
if /i "%MODE%"=="build" set "REBUILD=1"
if not exist "web\out\index.html" set "REBUILD=1"
if defined REBUILD (
  echo Building the UI...
  pushd web
  call npm run build || (popd & exit /b 1)
  popd
)

rem ---- mode for this run only (real environment variables override .env) -------------------
if /i "%MODE%"=="offline" set "PARCHI_FAKE_MODELS=1"
if /i "%MODE%"=="live" set "PARCHI_FAKE_MODELS=0"
rem Without a real staff password in .env, the dashboard uses the test sign-ins for this run.
findstr /r /c:"^PARCHI_DOCTOR_PASSWORD_HASH=pbkdf2" .env >nul || set "PARCHI_DEMO_LOGINS=1"

set "PORT=8765"
for /f "tokens=2 delims==" %%p in ('findstr /r /c:"^PARCHI_PORT=[0-9]" .env') do set "PORT=%%p"
set "URL=http://127.0.0.1:%PORT%"

echo.
echo   Intro page    %URL%
echo   Simulator     %URL%/demo/
echo   Staff app     %URL%/app/
if defined PARCHI_DEMO_LOGINS echo   Sign in as    doctor / doctor-test, or reception / reception-test
echo   Stop with     Ctrl+C
echo.

rem Open the browser once the server answers, not before.
if defined OPEN_BROWSER start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 90; $i++) { try { Invoke-WebRequest ('%URL%' + '/api/system') -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process '%URL%'; break } catch { Start-Sleep -Seconds 1 } }"

python -m parchi.server
exit /b %errorlevel%

:test
echo Python tests...
python -m unittest || exit /b 1
pushd web
echo Lint...
call npm run lint || (popd & exit /b 1)
echo Browser tests (offline; builds the UI first; several minutes)...
call npm run test:e2e || (popd & exit /b 1)
popd
echo.
echo All offline checks passed.
exit /b 0

:help
echo Parchi working slice
echo.
echo   run.bat                 start with the mode in .env, and open the browser
echo   run.bat offline         offline test mode: stand-in models, no key, no cost
echo   run.bat live            real models (an API key in .env, e.g. OPENAI_API_KEY)
echo   run.bat build           rebuild the UI first, then start
echo   run.bat test            every offline check: Python tests, lint, browser tests
echo   run.bat help            show this
echo.
echo   Add --no-browser after any start command to skip opening the browser.
exit /b 0
