# LAD App

This is the standalone LAD mobile app project. Open this folder in Android Studio:

```text
C:\Users\patta\LAD-App\android
```

The APK is built from the Expo/React Native Android project in `android/`.

## Build Debug APK

```powershell
cd "C:\Users\patta\LAD-App"
$env:NODE_ENV="production"
cd android
.\gradlew.bat assembleDebug
```

APK output:

```text
C:\Users\patta\LAD-App\android\app\build\outputs\apk\debug\app-debug.apk
```

## Backend Data

The app must connect to backend servers over the network. Do not put secret backend keys inside the APK. Public Expo variables such as `EXPO_PUBLIC_BACKEND_URL`, `EXPO_PUBLIC_AUTH_BACKEND_URL`, `EXPO_PUBLIC_SOCKET_URL`, and `EXPO_PUBLIC_WHATSAPP_API_URL` can be used by the app, while private keys must stay on the backend server.

The current app already has production backend fallbacks in `src/api/apiClient.ts` and `src/api/client.ts`. If you want the APK to point to another backend, update `.env.local` before building.
