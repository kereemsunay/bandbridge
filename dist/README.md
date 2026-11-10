# dist

Yerel APK burada durur, git'e girmez (`*.apk` .gitignore'da).

```bash
cd ../app/android && ./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../../dist/bandbridge.apk
```

`bandbridge.apk` debug anahtarıyla imzalıdır; kişisel kurulum içindir.
