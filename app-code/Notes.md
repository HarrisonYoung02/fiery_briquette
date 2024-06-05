# Dev commands/notes

Install dependencies

```
npm install
```

Ensure expo folder exists

```
npx expo start
```

Add Android SDK location to `android/local.properties`

```
sdk.dir=C:\\Users\\User\\AppData\\Local\\Android\\Sdk
```

Create dev build on connected android device

```
npx expo run:android
```

To rename Android package, replace instances of `com.anonymous.fierybriquette` with new name
