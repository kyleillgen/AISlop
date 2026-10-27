@echo off
rem Starts Flow Pocket: the Neutralino runtime serving the resources folder in one small window.
rem The exe must sit beside neutralino.config.json (setup.mjs puts it there).
rem WebView2 options keep it light: one renderer, GPU work in the main process, no background
rem networking. Measured 163 MB working set / 55 MB private / 3 processes, down from 393 / 170 / 7.
set "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--renderer-process-limit=1 --in-process-gpu --disable-features=msSmartScreenProtection,msEdgeSidebarV2 --disable-background-networking"
start "" "%~dp0flow-pocket.exe" --res-mode=directory
