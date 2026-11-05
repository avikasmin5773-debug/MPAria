@echo off
REM Cross-platform launcher for MPAria (Windows)
cd /d "%~dp0"
echo MPAria running at http://127.0.0.1:8000
python -m http.server 8000
