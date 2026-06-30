; Custom NSIS hooks for electron-builder.
;
; Self-deletes the installer executable once setup has finished.
;
; A running .exe cannot delete itself, so we drop a tiny batch file into %TEMP%
; that waits for the installer process to exit (the lock on the file releases),
; deletes the installer, then deletes itself.

!macro customInstall
  ; $EXEPATH is the full path to the installer that is currently running.
  ClearErrors
  FileOpen $0 "$TEMP\kumite_cleanup.bat" w
  IfErrors done

  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 ":retry$\r$\n"
  FileWrite $0 "del /f /q $\"$EXEPATH$\" >nul 2>&1$\r$\n"
  ; If the installer is still running the file is locked; wait ~1s and retry.
  FileWrite $0 "if exist $\"$EXEPATH$\" (ping 127.0.0.1 -n 2 >nul & goto retry)$\r$\n"
  ; Delete this helper batch file too.
  FileWrite $0 "del /f /q $\"%~f0$\" >nul 2>&1$\r$\n"
  FileClose $0

  ; Launch the cleanup batch detached and minimized so it survives installer exit.
  Exec '"$SYSDIR\cmd.exe" /c start "" /min "$TEMP\kumite_cleanup.bat"'
  done:
!macroend
