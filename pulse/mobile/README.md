# mobile.pulse

Expo (React Native) companion app for Pulse — **Subscriber** and **Fitness coach** modes.

## Features

| | Subscriber | Fitness coach |
|---|---|---|
| Login | email / password + PIN + biometrics | same |
| Training | start/end own session; strength & cardio sets | start/end after attendance confirm; strength & cardio sets |
| Calendar | book available coach | request appointment (subscriber accepts) |
| Packages | subscription + coaching stamp card | view subscriber packages |
| Attendance QR | tap stamp → QR; coach scans | scan subscriber QR; after session end, show QR for subscriber |

QR payload format: `PULSE|{locationId}|{YYYY-MM-DD}|{HH:mm}|{4digit}|{stampOrSessionId}`

## Demo accounts

Password / PIN: `pulse123` / `1234`

- Subscriber: `sam.nguyen@email.com`
- Coach: `coach@pulse.club`

## Run

```bash
cd pulse/mobile
npm install
EXPO_PUBLIC_PULSE_API_URL=https://pulse-cloud-etx3n2bf5q-as.a.run.app npm start
```

Then open in Expo Go (iOS/Android) or press `w` for web.
