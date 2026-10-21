@echo off
setlocal
cd /d "%~dp0"

set FRONT=frontend

set DJANGO_DEBUG=0
set DJANGO_SECRET_KEY=qa-cle-secrete-changez-moi-9f3a7c1e5b2d4f6a8c0e
set DJANGO_DB_NAME=qa.sqlite3
set DJANGO_MEDIA_DIR=qa_media

echo.
echo [1/4] Construction du front-end...
pushd "%FRONT%" || (echo Dossier front introuvable & pause & exit /b 1)
if not exist node_modules call npm install
call npm run build
if errorlevel 1 (echo Echec du build front & popd & pause & exit /b 1)
popd
if exist frontend_dist rmdir /s /q frontend_dist
xcopy "%FRONT%\dist" frontend_dist\ /E /I /Y >nul

echo.
echo [2/4] Base de donnees QA...
set NEWDB=0
if not exist "%DJANGO_DB_NAME%" set NEWDB=1
python manage.py migrate
if errorlevel 1 (pause & exit /b 1)
if "%NEWDB%"=="1" python manage.py seed_demo

echo.
echo [3/4] Fichiers statiques...
python manage.py collectstatic --noinput >nul

echo.
echo [4/4] Serveur QA sur http://localhost:8000   (Ctrl+C pour arreter)
python -m waitress --port=8000 --threads=8 config.wsgi:application