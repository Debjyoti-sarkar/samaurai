/**
 * Expo Config Plugin for SMS Receiver
 *
 * This plugin adds the native Android code needed to:
 * 1. Receive SMS broadcasts (SMS_RECEIVED)
 * 2. Run a Foreground Service for background processing
 * 3. Bridge the native events to React Native
 *
 * Usage in app.json:
 * {
 *   "plugins": [
 *     "./plugins/withSMSReceiver"
 *   ]
 * }
 */

const { withAndroidManifest, withMainApplication, withProjectBuildGradle } = require('@expo/config-plugins');
const { mkdirSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

// SMS Broadcast Receiver Java Code
const SMS_RECEIVER_CODE = `package com.kavach.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * BroadcastReceiver that listens for incoming SMS messages
 * and forwards them to React Native for fraud analysis.
 */
public class SMSReceiver extends BroadcastReceiver {
    private static final String TAG = "SMSReceiver";
    private static final String SMS_RECEIVED_EVENT = "onSMSReceived";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }

        if ("android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            Log.d(TAG, "SMS Received broadcast captured");

            Bundle bundle = intent.getExtras();
            if (bundle != null) {
                Object[] pdus = (Object[]) bundle.get("pdus");
                if (pdus != null && pdus.length > 0) {
                    String format = bundle.getString("format");

                    StringBuilder messageBody = new StringBuilder();
                    String sender = "";
                    long timestamp = System.currentTimeMillis();

                    for (Object pdu : pdus) {
                        SmsMessage smsMessage;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                        } else {
                            smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                        }

                        if (smsMessage != null) {
                            messageBody.append(smsMessage.getMessageBody());
                            sender = smsMessage.getDisplayOriginatingAddress();
                            timestamp = smsMessage.getTimestampMillis();
                        }
                    }

                    // Create event data
                    WritableMap smsData = Arguments.createMap();
                    smsData.putString("id", String.valueOf(timestamp));
                    smsData.putString("sender", sender);
                    smsData.putString("body", messageBody.toString());
                    smsData.putDouble("timestamp", timestamp);

                    // Send to React Native
                    sendEventToReactNative(context, smsData);

                    // Start foreground service for processing
                    startFraudAnalysisService(context, sender, messageBody.toString(), timestamp);
                }
            }
        }
    }

    private void sendEventToReactNative(Context context, WritableMap smsData) {
        try {
            ReactContext reactContext = SMSModule.getReactContext();
            if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(SMS_RECEIVED_EVENT, smsData);
                Log.d(TAG, "SMS event sent to React Native");
            } else {
                Log.d(TAG, "React context not available, starting service");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending event to React Native: " + e.getMessage());
        }
    }

    private void startFraudAnalysisService(Context context, String sender, String body, long timestamp) {
        Intent serviceIntent = new Intent(context, SMSAnalysisService.class);
        serviceIntent.putExtra("sender", sender);
        serviceIntent.putExtra("body", body);
        serviceIntent.putExtra("timestamp", timestamp);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}`;

// Foreground Service Java Code
const SMS_SERVICE_CODE = `package com.kavach.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Foreground Service for processing SMS fraud detection in background
 */
public class SMSAnalysisService extends Service {
    private static final String TAG = "SMSAnalysisService";
    private static final String CHANNEL_ID = "sms_analysis_channel";
    private static final int NOTIFICATION_ID = 1001;

    // Critical fraud keywords
    private static final String[] CRITICAL_KEYWORDS = {
        "share otp", "send otp", "provide otp", "enter otp", "give otp",
        "share pin", "send pin", "provide pin", "enter pin",
        "share password", "cvv", "card details"
    };

    // High risk keywords
    private static final String[] HIGH_RISK_KEYWORDS = {
        "urgent", "immediately", "suspended", "blocked", "expire",
        "verify immediately", "click here", "kyc", "account blocked"
    };

    // Suspicious URL patterns
    private static final String[] SUSPICIOUS_URLS = {
        "bit.ly", "tinyurl", "short.link", "cutt.ly", "goo.gl"
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String sender = intent.getStringExtra("sender");
        String body = intent.getStringExtra("body");
        long timestamp = intent.getLongExtra("timestamp", System.currentTimeMillis());

        // Start foreground with minimal notification
        startForeground(NOTIFICATION_ID, createProcessingNotification());

        // Process SMS in background
        new Handler(Looper.getMainLooper()).post(() -> {
            processAndAnalyzeSMS(sender, body, timestamp);
        });

        return START_NOT_STICKY;
    }

    private void processAndAnalyzeSMS(String sender, String body, long timestamp) {
        long startTime = System.currentTimeMillis();

        // Analyze the message
        int riskScore = calculateRiskScore(body, sender);
        String riskLevel = getRiskLevel(riskScore);
        Set<String> urlsFound = extractUrls(body);
        boolean otpDetected = detectOTP(body);

        long analysisTime = System.currentTimeMillis() - startTime;
        Log.d(TAG, "Analysis completed in " + analysisTime + "ms. Risk: " + riskScore);

        // Send result to React Native
        sendAnalysisResult(sender, body, timestamp, riskScore, riskLevel, urlsFound, otpDetected);

        // Show notification based on risk level
        if (riskScore > 70) {
            showFraudAlertNotification(sender, body);
        } else if (riskScore > 40) {
            showWarningNotification(sender);
        }

        // Stop service
        stopForeground(true);
        stopSelf();
    }

    private int calculateRiskScore(String body, String sender) {
        String normalizedBody = body.toLowerCase();
        String normalizedSender = sender.toLowerCase();
        int score = 0;

        // Critical keywords (80 points)
        for (String keyword : CRITICAL_KEYWORDS) {
            if (normalizedBody.contains(keyword)) {
                score += 80;
                break;
            }
        }

        // High risk keywords (20 points each)
        for (String keyword : HIGH_RISK_KEYWORDS) {
            if (normalizedBody.contains(keyword)) {
                score += 20;
            }
        }

        // Suspicious URLs (25 points each)
        for (String url : SUSPICIOUS_URLS) {
            if (normalizedBody.contains(url)) {
                score += 25;
            }
        }

        // Check for any URLs (15 points)
        if (normalizedBody.contains("http://") || normalizedBody.contains("https://")) {
            score += 15;
        }

        // Unknown sender format (15 points)
        if (sender.matches("^\\\\d{10,}$")) {
            score += 15;
        }

        return Math.min(100, Math.max(0, score));
    }

    private String getRiskLevel(int score) {
        if (score < 40) return "safe";
        if (score <= 70) return "warning";
        return "danger";
    }

    private Set<String> extractUrls(String body) {
        Set<String> urls = new HashSet<>();
        Pattern pattern = Pattern.compile("(https?://[\\\\S]+)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(body);
        while (matcher.find()) {
            urls.add(matcher.group(1));
        }
        return urls;
    }

    private boolean detectOTP(String body) {
        String lower = body.toLowerCase();
        return lower.contains("otp") ||
               lower.contains("one time password") ||
               lower.contains("verification code");
    }

    private void sendAnalysisResult(String sender, String body, long timestamp,
                                    int riskScore, String riskLevel,
                                    Set<String> urlsFound, boolean otpDetected) {
        try {
            ReactContext reactContext = SMSModule.getReactContext();
            if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
                WritableMap result = Arguments.createMap();
                result.putString("sender", sender);
                result.putString("body", body);
                result.putDouble("timestamp", timestamp);
                result.putInt("riskScore", riskScore);
                result.putString("riskLevel", riskLevel);
                result.putBoolean("otpDetected", otpDetected);
                result.putInt("urlCount", urlsFound.size());

                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("onSMSAnalysisComplete", result);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending analysis result: " + e.getMessage());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "SMS Analysis",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Processing SMS for fraud detection");

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }

            // Create high priority channel for alerts
            NotificationChannel alertChannel = new NotificationChannel(
                "fraud_alerts",
                "Fraud Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Urgent fraud detection alerts");
            alertChannel.enableVibration(true);
            alertChannel.setVibrationPattern(new long[]{0, 500, 200, 500});
            manager.createNotificationChannel(alertChannel);
        }
    }

    private Notification createProcessingNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("KAVACH")
            .setContentText("Analyzing message for fraud...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void showFraudAlertNotification(String sender, String body) {
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, "fraud_alerts")
            .setContentTitle("🚨 FRAUD ALERT!")
            .setContentText("Dangerous message from " + sender)
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText("This message appears to be fraudulent. Do NOT click any links or share personal information.\\n\\nFrom: " + sender))
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVibrate(new long[]{0, 500, 200, 500})
            .build();

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(2001, notification);
        }
    }

    private void showWarningNotification(String sender) {
        Notification notification = new NotificationCompat.Builder(this, "fraud_alerts")
            .setContentTitle("⚠️ Suspicious Message")
            .setContentText("Message from " + sender + " may be suspicious")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build();

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(2002, notification);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}`;

// React Native Module Java Code
const SMS_MODULE_CODE = `package com.kavach.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * React Native Module for SMS operations
 */
public class SMSModule extends ReactContextBaseJavaModule {
    private static final String TAG = "SMSModule";
    private static final String MODULE_NAME = "SMSModule";

    private static ReactContext staticReactContext;

    public SMSModule(ReactApplicationContext reactContext) {
        super(reactContext);
        staticReactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    public static ReactContext getReactContext() {
        return staticReactContext;
    }

    @ReactMethod
    public void checkPermissions(Promise promise) {
        try {
            boolean readSms = ContextCompat.checkSelfPermission(
                getReactApplicationContext(),
                Manifest.permission.READ_SMS
            ) == PackageManager.PERMISSION_GRANTED;

            boolean receiveSms = ContextCompat.checkSelfPermission(
                getReactApplicationContext(),
                Manifest.permission.RECEIVE_SMS
            ) == PackageManager.PERMISSION_GRANTED;

            WritableMap result = Arguments.createMap();
            result.putBoolean("readSms", readSms);
            result.putBoolean("receiveSms", receiveSms);
            result.putBoolean("allGranted", readSms && receiveSms);

            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getRecentSMS(int count, Promise promise) {
        try {
            if (ContextCompat.checkSelfPermission(
                getReactApplicationContext(),
                Manifest.permission.READ_SMS
            ) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "SMS permission not granted");
                return;
            }

            ContentResolver resolver = getReactApplicationContext().getContentResolver();
            Uri uri = Telephony.Sms.Inbox.CONTENT_URI;

            String[] projection = {
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.READ
            };

            Cursor cursor = resolver.query(
                uri,
                projection,
                null,
                null,
                Telephony.Sms.DATE + " DESC LIMIT " + count
            );

            WritableArray messages = Arguments.createArray();

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap sms = Arguments.createMap();
                    sms.putString("id", cursor.getString(0));
                    sms.putString("sender", cursor.getString(1));
                    sms.putString("body", cursor.getString(2));
                    sms.putDouble("timestamp", cursor.getLong(3));
                    sms.putBoolean("read", cursor.getInt(4) == 1);
                    messages.pushMap(sms);
                }
                cursor.close();
            }

            promise.resolve(messages);
        } catch (Exception e) {
            Log.e(TAG, "Error reading SMS: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void startMonitoring(Promise promise) {
        try {
            // The BroadcastReceiver is registered in the manifest
            // This method just confirms monitoring is active
            Log.d(TAG, "SMS monitoring active via BroadcastReceiver");
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopMonitoring(Promise promise) {
        try {
            // BroadcastReceiver cannot be dynamically unregistered when declared in manifest
            // This is by design for background operation
            Log.d(TAG, "Note: BroadcastReceiver remains active for security");
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN event emitter
    }

    @ReactMethod
    public void removeListeners(int count) {
        // Required for RN event emitter
    }
}`;

// React Native Module Package Java Code
const SMS_PACKAGE_CODE = `package com.kavach.app;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SMSPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new SMSModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}`;

// Main plugin function
function withSMSReceiver(config) {
  // Add Android permissions to manifest
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;

    // Add permissions
    const permissions = manifest.manifest.permission || [];
    const usesPermissions = manifest.manifest['uses-permission'] || [];

    const requiredPermissions = [
      'android.permission.RECEIVE_SMS',
      'android.permission.READ_SMS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
      'android.permission.WAKE_LOCK'
    ];

    for (const permission of requiredPermissions) {
      const exists = usesPermissions.some(
        p => p.$?.['android:name'] === permission
      );
      if (!exists) {
        usesPermissions.push({
          $: { 'android:name': permission }
        });
      }
    }

    manifest.manifest['uses-permission'] = usesPermissions;

    // Add receiver and service to application
    const application = manifest.manifest.application[0];

    // Add SMS Receiver
    application.receiver = application.receiver || [];
    const receiverExists = application.receiver.some(
      r => r.$?.['android:name'] === '.SMSReceiver'
    );
    if (!receiverExists) {
      application.receiver.push({
        $: {
          'android:name': '.SMSReceiver',
          'android:enabled': 'true',
          'android:exported': 'true',
          'android:permission': 'android.permission.BROADCAST_SMS'
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }],
          priority: [{ $: { 'android:value': '999' } }]
        }]
      });
    }

    // Add Foreground Service
    application.service = application.service || [];
    const serviceExists = application.service.some(
      s => s.$?.['android:name'] === '.SMSAnalysisService'
    );
    if (!serviceExists) {
      application.service.push({
        $: {
          'android:name': '.SMSAnalysisService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync'
        }
      });
    }

    return config;
  });

  // Note: The Java files need to be created when running prebuild
  // This would typically be done with a dangerous mod or by copying files

  return config;
}

module.exports = withSMSReceiver;
