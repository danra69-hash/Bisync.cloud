Bisync POS — Desktop fullscreen launcher
========================================

These launchers open Bisync POS in Google Chrome (preferred) as an app
window that fills the device screen and stays on top of the desktop.

1) Edit the POS_URL in your launcher if needed (company/location deep link).
   Default: https://bisync-cloud-389272498937.asia-southeast1.run.app/POS?fs=1
   Example with org: .../POS?c=12&l=your-location-id&fs=1

2) Windows (Chrome recommended)
   - Double-click windows\Bisync-POS.bat
   - Uses Google Chrome first, then Microsoft Edge
   - Flags: --app + --start-fullscreen (true full screen)

3) Mac
   - Right-click mac/Bisync-POS.command → Open (first run)
   - Or: chmod +x Bisync-POS.command && ./Bisync-POS.command

4) Linux
   - chmod +x linux/Bisync-POS.sh
   - ./linux/Bisync-POS.sh
   - Or copy Bisync-POS.desktop to ~/.local/share/applications/

5) Android / iOS (mostly Chrome)
   - Open /POS?fs=1 in Chrome
   - Tap "Full screen" (or the on-screen prompt)
   - Or: Install app / Add to Home Screen for a display-mode:fullscreen POS

The POS UI scales to the live device viewport (visualViewport + screen size)
so phone, tablet, and desktop Chrome all fill the available display.
