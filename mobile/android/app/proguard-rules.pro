# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ---------------------------------------------------------------------------
# Performance Audit finding F4 — R8/minification enabled for the first time
# this pass. Most well-published RN native module AARs (React Native core,
# Firebase, react-native-maps) ship their own consumer ProGuard rules that
# AGP merges in automatically, but the rules below are added explicitly as a
# documented, deliberate safety margin for the specific reflection-heavy
# areas most commonly reported to break under R8 for this exact dependency
# stack — not a sign the automatic rules are known to be insufficient, just
# not something to leave to chance on a first shrinking pass. Verified via a
# real physical-device pass after enabling (see PROGRESS.md/completion
# report), not assumed safe from a successful build alone.
# ---------------------------------------------------------------------------

# React Native core / JSI / TurboModules / Hermes bridge surface.
-keep,includedescriptorclasses class com.facebook.react.bridge.** { *; }
-keep,includedescriptorclasses class com.facebook.react.turbomodule.core.** { *; }
-keep,includedescriptorclasses class com.facebook.jni.** { *; }
-keep,includedescriptorclasses class com.facebook.hermes.unicode.** { *; }
-keep,includedescriptorclasses class com.facebook.jni.annotations.** { *; }
-dontwarn com.facebook.react.**

# @ReactProp/@ReactPropGroup-annotated view-manager methods are invoked via
# reflection from the bridge — a common silent-breakage point if stripped.
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Firebase Cloud Messaging (push notifications) — background message
# handling and Firebase's own model classes are commonly reflection-accessed.
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# react-native-maps / Google Maps SDK — API model classes (Marker, LatLng,
# Polyline, CameraPosition, ...) are parceled/reflected into by the SDK
# itself; stripping them is a known cause of a blank map or a marker/
# polyline render crash.
-keep class com.google.android.gms.maps.** { *; }
-keep class com.google.android.gms.internal.maps.** { *; }
-keep class com.google.android.gms.common.** { *; }
-dontwarn com.google.android.gms.**

# Kotlin reflection metadata, used internally by some Firebase/AndroidX
# components.
-keepattributes Signature,InnerClasses,EnclosingMethod
-keep class kotlin.Metadata { *; }

# Transitive HTTP stack (used by Firebase and other native modules) —
# standard, well-known safe suppressions, not app-specific.
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# This app's own native/Kotlin surface is tiny (the stock RN template's
# MainActivity/MainApplication — no custom native modules were written) —
# keeping it whole costs effectively nothing (the JS bundle, not this thin
# native shim, is what's large) and removes an entire class of "which one
# specific class did R8 strip" debugging on this first shrinking pass.
-keep class com.admillmobile.** { *; }
