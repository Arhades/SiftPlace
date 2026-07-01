@echo off
cd %~dp0

IF NOT EXIST ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Installing dependencies...
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

echo Starting server...
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
