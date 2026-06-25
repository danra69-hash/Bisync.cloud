@echo off
REM Create Bisync.cloud GitHub repo and push (run after: gh auth login)
setlocal
cd /d "%~dp0.."

where gh >nul 2>&1 || (echo Install GitHub CLI: winget install GitHub.cli & exit /b 1)

gh auth status >nul 2>&1 || (
  echo Please authenticate first:
  echo   gh auth login
  exit /b 1
)

git init
git add .
git commit -m "Initial commit: Bisync.cloud from Figma Make + C# API"

gh repo create Bisync.cloud --public --source=. --remote=origin --push --description "Hospitality operations platform - restaurant dashboard, revenue management, inventory"

echo.
echo Repository created and pushed!
gh repo view --web
