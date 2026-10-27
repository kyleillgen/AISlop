@echo off
rem Starts Flow Pocket: the Neutralino runtime serving pocket\resources in one small window.
start "" "%~dp0bin\neutralino-win_x64.exe" --load-dir-res --path="%~dp0." --window-title="Flow Pocket"
