; ----------------------------------------------------------------------------
; BabaAvatar - Custom-NSIS-Script
; - Killt laufende BabaAvatar-Prozesse vor Install / Uninstall
; - Räumt volatile Caches auf (Cache, GPU, Crashpad, Logs)
; - Löscht alte Setup-EXE-Reste aus dem Temp-Ordner
; - Lässt Settings, Profile und Avatar-Bibliothek beim Update unangetastet
; ----------------------------------------------------------------------------

!macro customInit
  ; Falls App noch läuft - sauber beenden, Wartezeit, dann notfalls hart killen
  DetailPrint "Pruefe ob BabaAvatar laeuft..."
  nsExec::ExecToLog 'taskkill /IM "BabaAvatar.exe" /T'
  Sleep 1500
  nsExec::ExecToLog 'taskkill /F /IM "BabaAvatar.exe" /T'
  Sleep 500
!macroend

!macro customInstall
  ; Vor neuer Installation: nur volatile Caches loeschen.
  ; Settings, Avatar-Bibliothek und Profile bleiben unter babaavatar/config/ erhalten.
  DetailPrint "Raeume volatile Caches auf..."
  RMDir /r "$LOCALAPPDATA\babaavatar\Cache"
  RMDir /r "$LOCALAPPDATA\babaavatar\Code Cache"
  RMDir /r "$LOCALAPPDATA\babaavatar\GPUCache"
  RMDir /r "$LOCALAPPDATA\babaavatar\Crashpad"
  Delete "$LOCALAPPDATA\babaavatar\logs\*.log"

  ; Alte Setup-Installer aus dem Temp-Ordner loeschen
  DetailPrint "Loesche alte Installer-Reste..."
  Delete "$TEMP\BabaAvatar-Setup-*.exe"
  Delete "$TEMP\BabaAvatar-Setup-*.exe.blockmap"
  RMDir /r "$TEMP\babaavatar-updater"
!macroend

!macro customUnInit
  ; Beim Uninstall: laufende Instanzen ebenfalls killen
  DetailPrint "Beende laufende BabaAvatar-Prozesse..."
  nsExec::ExecToLog 'taskkill /F /IM "BabaAvatar.exe" /T'
  Sleep 500
!macroend

!macro customUnInstall
  ; Beim Uninstall: Setup-Reste im Temp aufraeumen,
  ; aber Settings (deleteAppDataOnUninstall=false) bleiben.
  DetailPrint "Loesche temporaere Installer-Dateien..."
  Delete "$TEMP\BabaAvatar-Setup-*.exe"
  Delete "$TEMP\BabaAvatar-Setup-*.exe.blockmap"
!macroend
