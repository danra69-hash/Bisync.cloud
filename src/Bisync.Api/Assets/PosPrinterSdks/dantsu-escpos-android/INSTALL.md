# DantSu ESCPOS-ThermalPrinter-Android (v3.4.0)

Official Android library for ESC/POS thermal printers over **Bluetooth**, **TCP/IP**, and **USB**.

- Upstream: https://github.com/DantSu/ESCPOS-ThermalPrinter-Android
- License: MIT
- Packaged for Bisync POS Android stations

## Install on this Android device

1. Download the Bisync package (`bisync-dantsu-escpos-android-android.zip`) from POS Setup → Drivers.
2. Open **Files** (or Downloads) on the tablet/phone and unzip the package.
3. Use one of the options below to load the SDK into your Android POS print stack.

### Option A — Gradle / JitPack (online build)

In the project `settings.gradle` / root repositories:

```gradle
maven { url 'https://jitpack.io' }
```

In `app/build.gradle`:

```gradle
dependencies {
    implementation 'com.github.DantSu:ESCPOS-ThermalPrinter-Android:3.4.0'
}
```

### Option B — Offline AAR (included in this package)

Copy `ESCPOS-ThermalPrinter-Android-3.4.0.aar` into your Android module `libs/` folder:

```gradle
dependencies {
    implementation files('libs/ESCPOS-ThermalPrinter-Android-3.4.0.aar')
}
```

### Option C — Full source (included)

Unzip `ESCPOS-ThermalPrinter-Android-3.4.0-source.zip` and open it in Android Studio, or copy the `escposprinter` module into your app.

## Bisync POS binding

After the library is on the device, register the printer in Bisync POS Setup with SDK code **`dantsu-escpos-android`**.  
Default TCP port is **9100**. Supported paper widths: 58 / 80 / 112 mm.

Supports the same ESC/POS receipts Bisync already generates (kitchen, bar, guest check), including Bluetooth and USB printers common on Android POS tablets.
