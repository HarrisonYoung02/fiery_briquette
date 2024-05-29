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

To fix background service crashing:

`\node_modules\react-native-background-actions\android\src\main\AndroidManifest.xml`

```
Add
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />

Replace
<service android:name=".RNBackgroundActionsTask"/>
with
<service android:name="com.asterinet.react.bgactions.RNBackgroundActionsTask" android:foregroundServiceType="dataSync" />
```

`\node_modules\react-native-background-actions\android\build.gradle`

```
On lines 8 and 12, replace 31 with 34
```

`\node_modules\react-native-background-actions\android\src\main\java\com\asterinet\react\bgactions\RNBackgroundActionsTask.java`

```
Replace (line 44)
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
with
if (android.os.Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            contentIntent = PendingIntent.getActivity(context,0, notificationIntent, PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_ALLOW_UNSAFE_IMPLICIT_INTENT);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
```

To rename Android package, replace instances of `com.anonymous.fierybriquette` with new name
