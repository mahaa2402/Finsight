@echo off
REM FinSight IQ — Quick Start Script
REM Run this from the finsight\ root directory

echo.
echo  FinSight IQ - Starting Application
echo  ====================================
echo.

REM Start Backend
echo  [1/2] Starting FastAPI Backend...
start "FinSight Backend" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start Frontend
echo  [2/2] Starting Vite Frontend...
start "FinSight Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo  Backend:  http://127.0.0.1:8000
echo  Frontend: http://localhost:5173
echo  API Docs: http://127.0.0.1:8000/docs
echo.
echo  Press any key to exit...
pause >nul
