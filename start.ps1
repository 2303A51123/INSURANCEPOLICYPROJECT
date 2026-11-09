# PowerShell Launcher for Insurance Policy and Claims Management System
# Student: PUVATI VAMSHI VARDHAN RAO | Enrolment No: 2303A51123

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  INSURANCE POLICY AND CLAIMS MANAGEMENT SYSTEM (DevOps & Full Stack)" -ForegroundColor Green
Write-Host "  Student: PUVATI VAMSHI VARDHAN RAO | Enrolment No: 2303A51123" -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/2] Opening application in default browser..." -ForegroundColor Gray
Start-Process "http://localhost:3000"
Write-Host "[2/2] Starting server on http://localhost:3000 ..." -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop the server anytime." -ForegroundColor Magenta
Write-Host ""

node run.js
