@echo off
chcp 65001 >nul
cd /d %~dp0
echo ========================================
echo   🥋 Git 练功房 启动中...
echo   启动后请打开 http://localhost:3000
echo ========================================
npm run dev
pause
