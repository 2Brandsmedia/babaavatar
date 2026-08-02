# Windows-Setup — BabaAvatar auf Toplevel-Qualität

Stand 2026-08-02. BabaAvatar ist **Windows-only** (Entwicklung läuft auf dem Mac, Release nur
`.exe`). Drei Bausteine heben die Qualität vom MediaPipe-Standard auf das Maximum, das 2026 mit
einer normalen Webcam geht. Alles optional — ohne diese Schritte läuft die App mit MediaPipe.

## 1. NVIDIA Maxine ExpressionApp (Gesicht auf iPhone-Niveau)

Was es bringt: 53 ARKit-Blendshapes direkt von der RTX-GPU (Tensor Cores), deutlich stabiler als
MediaPipe bei schrägen Winkeln und schlechtem Licht. Gleiche Technik wie der „NVIDIA Broadcast
Tracker" von VTube Studio.

⚠️ Zwei Teile nötig — beides ist kostenlos, kommt aber NICHT mit dem BabaAvatar-Update mit
(NVIDIA erlaubt kein Mitbundeln):

1. **AR SDK Redistributable** (Laufzeit-DLLs + KI-Modelle) für RTX 40xx/Ada direkt laden und
   installieren:
   <https://international.download.nvidia.com/Windows/broadcast/sdk/AR/nvidia_ar_sdk_installer_v0.8.7_ada.exe>
   (Übersicht aller GPU-Generationen: <https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-sdk/resources/>)
2. **ExpressionApp.exe** besorgen — NVIDIA liefert sie nicht als fertiges Binary (GitHub-Repo
   ist Quellcode zum Selberbauen). Der einfache Weg ist das kostenlose Steam-DLC:
   Steam → **VTube Studio** (kostenlos) installieren → Bibliothek → Rechtsklick auf VTube
   Studio → **Eigenschaften → Reiter „DLC"** → Häkchen bei **„NVIDIA Broadcast Tracker"**
   setzen (~2 GB Download; taucht das DLC dort nicht auf, vorher auf der Shop-Seite
   <https://store.steampowered.com/app/2178540/> zum Konto hinzufügen). Danach liegt die App
   unter `…\Steam\steamapps\common\VTube Studio\VTube Studio_Data\StreamingAssets\MXTracker\ExpressionApp.exe`.
   Fehlt der MXTracker-Ordner trotz „installiert": Eigenschaften → Installierte Dateien →
   „Integrität der Spieldateien überprüfen" lädt die ~2 GB nach.
   Alternativ selbst bauen: <https://github.com/NVIDIA-Maxine/Maxine-AR-SDK>
   (Visual Studio + CMake).
3. In BabaAvatar: **Einstellungen → Tracking → Tracking-Engine: „NVIDIA Broadcast (RTX-GPU)"**
   → „ExpressionApp.exe wählen…" → Pfad setzen → „Kameras suchen" → Kamera + Modus wählen.
   Die App startet den Sidecar automatisch und empfängt die Daten per UDP (Port 9140, nur
   localhost).
4. **10 Sekunden neutral in die Kamera schauen**, dann „Neutral-Pose kalibrieren" klicken.
   Die Kalibrierung wird gecacht und bei jedem Start wiederverwendet.

⚠️ Die ExpressionApp öffnet die Kamera **exklusiv**. Soll MediaPipe parallel Körper und Hände
tracken, braucht es eine **zweite Webcam** (eine für Maxine-Gesicht, eine für MediaPipe-Körper),
Quelle „Beides" in der Statusleiste. Mit nur einer Kamera: entweder Maxine-Gesicht ODER
MediaPipe-Vollkörper.

⚠️ Das Kopf-Rotations-Vorzeichen (Quaternion) ist auf dem Mac nicht testbar. Wenn der Kopf
seitenverkehrt dreht: in `src/main/maxine-tracker.ts` beim `headQuat` die Vorzeichen von `x`/`y`
spiegeln (bekanntes Thema aller ExpressionApp-Bridges).

## 2. Videos direkt in der App aufnehmen

Kein OBS mehr nötig für reine Aufnahmen: **Statusleiste → „● Aufnahme"** startet die Aufnahme des
Output-Fensters (60 FPS, WebM/VP9, ~25 Mbit/s). „■ Stopp" speichert nach
`%APPDATA%\babaavatar\recordings\`, Button „Aufnahmen" öffnet den Ordner. Für
Ganzkörper-Videos vorher im Output-Fenster per Mausrad/Ziehen den Bildausschnitt setzen.

Für Streaming/Compositing bleibt der bewährte Weg: OBS Window Capture + Chroma-Key auf die
eingestellte Hintergrundfarbe.

## 3. Hände: Ultraleap Leap Motion Controller 2 (~140 €)

Webcam-Hand-Tracking bleibt 2026 der Schwachpunkt jeder Lösung. Wer saubere Finger in den Videos
will, nimmt einen **Leap Motion Controller 2** mit Brust- oder Schreibtischhalterung
(<https://leap2.ultraleap.com/products/leap-motion-controller-2/>). Anbindung an BabaAvatar ist
V2-Backlog (LeapC-Sidecar, gleiche VmcSnapshot-Schiene wie Maxine); bis dahin funktioniert er
bereits heute über Warudo/VSeeFace als Zwischenstation (VMC-Protokoll → BabaAvatar-Tracker-Port).

## 4. FasterLivePortrait — fotorealistische Videos (separates Werkzeug)

Für „wirkt wie echt gefilmt" (Kopf/Mimik eines Fotos wird live von deiner Webcam angetrieben,
inkl. **Animal Mode** für Tiergesichter) ist FasterLivePortrait das reifste lokale Werkzeug —
eigenständige Anwendung neben BabaAvatar:

1. Repo: <https://github.com/warmshao/FasterLivePortrait> → Windows-All-in-One-Paket aus den
   Releases laden (integriert CUDA/cuDNN, kein Python-Setup nötig).
2. Einmalig die ONNX→TensorRT-Konvertierung per beiliegender `.bat` laufen lassen
   (⚠️ braucht **TensorRT 8.x** — 10.x ist inkompatibel; im All-in-One-Paket schon richtig).
3. `camera.bat` = Live-Webcam-Modus (30+ FPS auf RTX 3090, auf der 4090 mehr Luft),
   `webui.bat` = Browser-Oberfläche. Quellbild: beliebiges Foto einer **fiktiven** Figur oder
   ein eigenes.
4. Aufnahme: Fenster per OBS Window Capture aufnehmen, oder Webcam-Performance als
   Driving-Video aufzeichnen und offline in voller Qualität rendern (beste Qualität).

⚠️ Lizenz: Der Code ist MIT, aber die InsightFace-Modelle darin sind **non-commercial** —
für private Videos in Ordnung, nicht für verkaufte Inhalte.

## Referenz: Tracking-Datenfluss mit Maxine

```
ExpressionApp.exe (NVIDIA, eigener Prozess, exklusive Kamera)
   └─ UDP-JSON an 127.0.0.1:9140  {exp: 53 Koeffizienten, rot: Kopf-Quaternion, pts, cnf, cal}
        └─ src/main/maxine-tracker.ts  → VmcSnapshot (ARKit-Namen, 0..1)
             └─ IPC VMC_FRAME an Control- + Output-Window (max. 60 Hz)
                  └─ vmc-merge.ts überschreibt Face-Blendshapes + Kopf im PoseFrame
                       └─ bestehende VRM-Pipeline (Smoother → AvatarStage)
Kalibrierung: UDP {"cmd":" calibrate"} an 127.0.0.1:9160+KameraIndex
```
