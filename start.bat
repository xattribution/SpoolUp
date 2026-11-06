@echo off
title SpoolUp
cd /d "%~dp0"
node server.js %*
pause
