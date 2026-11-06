@echo off
title StarPit
cd /d "%~dp0"
node server.js %*
pause
