' Bisync.cloud — create Desktop + Start Menu shortcuts with the Bisync logo.
' Double-click after extracting the zip, or run Bisync.cloud.bat (calls this automatically).

Option Explicit
Dim sh, fso, here, iconSrc, batSrc, installDir, profileDir, launcherPath, iconPath, browserPath
Dim desktop, startMenu, appUrl, desktopLnk, startLnk, s, msg

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

here = fso.GetParentFolderName(WScript.ScriptFullName)
iconSrc = fso.BuildPath(here, "Bisync.cloud.ico")
batSrc = fso.BuildPath(here, "Bisync.cloud.bat")
installDir = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Bisync.cloud-Desktop")
profileDir = fso.BuildPath(installDir, "profile")
launcherPath = fso.BuildPath(installDir, "Bisync.cloud.bat")
iconPath = fso.BuildPath(installDir, "Bisync.cloud.ico")
appUrl = "https://bisync-cloud-389272498937.asia-southeast1.run.app/"

If Not fso.FileExists(iconSrc) Then
  MsgBox "Bisync.cloud.ico is missing. Keep it in the same folder as this script.", vbCritical, "Bisync.cloud"
  WScript.Quit 1
End If
If Not fso.FileExists(batSrc) Then
  MsgBox "Bisync.cloud.bat is missing. Keep it in the same folder as this script.", vbCritical, "Bisync.cloud"
  WScript.Quit 1
End If

If Not fso.FolderExists(installDir) Then fso.CreateFolder installDir
fso.CopyFile batSrc, launcherPath, True
fso.CopyFile iconSrc, iconPath, True

' Also keep a copy of this installer next to the installed files.
On Error Resume Next
fso.CopyFile WScript.ScriptFullName, fso.BuildPath(installDir, "Install-Desktop-Shortcut.vbs"), True
On Error GoTo 0

browserPath = FirstExistingBrowser()
desktop = sh.SpecialFolders("Desktop")
startMenu = sh.SpecialFolders("Programs")
desktopLnk = fso.BuildPath(desktop, "Bisync.cloud.lnk")
startLnk = fso.BuildPath(startMenu, "Bisync.cloud.lnk")

WriteShortcut desktopLnk
WriteShortcut startLnk

msg = "Desktop shortcut created:" & vbCrLf & desktopLnk & vbCrLf & vbCrLf & _
      "Start Menu shortcut created:" & vbCrLf & startLnk & vbCrLf & vbCrLf & _
      "The shortcut uses the Bisync logo. Double-click it to open Bisync.cloud."
If WScript.Arguments.Named.Exists("silent") Then
  WScript.Echo "OK:" & desktopLnk
Else
  MsgBox msg, vbInformation, "Bisync.cloud"
End If
WScript.Quit 0

Sub WriteShortcut(path)
  Set s = sh.CreateShortcut(path)
  If browserPath <> "" Then
    s.TargetPath = browserPath
    s.Arguments = "--app=""" & appUrl & """ --user-data-dir=""" & profileDir & """ --no-first-run --new-window --disable-session-crashed-bubble --no-default-browser-check"
  Else
    s.TargetPath = launcherPath
    s.Arguments = ""
  End If
  s.WorkingDirectory = installDir
  s.WindowStyle = 1
  s.Description = "Bisync.cloud Desktop"
  s.IconLocation = iconPath & ",0"
  s.Save
End Sub

Function FirstExistingBrowser()
  Dim candidates, i, p
  candidates = Array( _
    "%ProgramFiles%\Google\Chrome\Application\chrome.exe", _
    "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe", _
    "%LocalAPPDATA%\Google\Chrome\Application\chrome.exe", _
    "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe", _
    "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" _
  )
  For i = 0 To UBound(candidates)
    p = sh.ExpandEnvironmentStrings(candidates(i))
    If fso.FileExists(p) Then
      FirstExistingBrowser = p
      Exit Function
    End If
  Next
  FirstExistingBrowser = ""
End Function
