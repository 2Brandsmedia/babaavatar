; ----------------------------------------------------------------------------
; BabaAvatar — Custom-NSIS-Script
; - Killt laufende BabaAvatar-Prozesse vor Install / Uninstall
; - Räumt App-Reste auf (Cache, alte Logs) bevor neuer Build kopiert wird
; ----------------------------------------------------------------------------

!macro customInit
  ; Falls App noch läuft — sauber beenden, Wartezeit, dann notfalls hart killen
  DetailPrint "Prüfe ob BabaAvatar läuft..."
  nsExec::ExecToLog 'taskkill /IM "BabaAvatar.exe" /T'
  Sleep 1500
  nsExec::ExecToLog 'taskkill /F /IM "BabaAvatar.exe" /T'
  Sleep 500
!macroend

!macro customInstall
  ; Vor neuer Installation: Cache und Crash-Reports aus AppData entfernen.
  ; Settings + Avatar-Bibliothek bleiben unangetastet (liegen unter babaavatar/config/).
  DetailPrint "Räume App-Reste auf..."
  RMDir /r "$LOCALAPPDATA\babaavatar\Cache"
  RMDir /r "$LOCALAPPDATA\babaavatar\Code Cache"
  RMDir /r "$LOCALAPPDATA\babaavatar\GPUCache"
  RMDir /r "$LOCALAPPDATA\babaavatar\Crashpad"
  Delete "$LOCALAPPDATA\babaavatar\logs\*.log"
!macroend

!macro customUnInit
  ; Beim Uninstall: laufende Instanzen ebenfalls killen
  DetailPrint "Beende laufende BabaAvatar-Prozesse..."
  nsExec::ExecToLog 'taskkill /F /IM "BabaAvatar.exe" /T'
  Sleep 500
!macroend
