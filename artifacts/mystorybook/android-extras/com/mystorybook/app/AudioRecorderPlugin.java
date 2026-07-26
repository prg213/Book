package com.mystorybook.app;

import android.Manifest;
import android.media.MediaRecorder;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;

/**
 * Minimal native audio recorder plugin for Capacitor.
 * Bypasses the WebView getUserMedia path (which is blocked in Capacitor WebViews
 * pointing at remote URLs) by using Android MediaRecorder directly.
 *
 * JS API (via window.Capacitor.Plugins.AudioRecorder):
 *   checkPermission()  → { granted: boolean }
 *   requestPermission()→ { granted: boolean }
 *   startRecording()   → {}  (rejects on error)
 *   stopRecording()    → { base64: string, mimeType: "audio/aac" }
 */
@CapacitorPlugin(
    name = "AudioRecorder",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class AudioRecorderPlugin extends Plugin {

    private MediaRecorder recorder = null;
    private String outputPath = null;

    // ── Permission helpers ────────────────────────────────────────────────────

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("microphone") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("microphone", call, "micPermissionResult");
    }

    @PermissionCallback
    private void micPermissionResult(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("microphone") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    // ── Recording ─────────────────────────────────────────────────────────────

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("PERMISSION_DENIED");
            return;
        }
        if (recorder != null) {
            call.reject("ALREADY_RECORDING");
            return;
        }
        try {
            outputPath = getContext().getCacheDir().getAbsolutePath() + "/msb_rec.aac";
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(44100);
            recorder.setAudioChannels(1);
            recorder.setAudioEncodingBitRate(96000);
            recorder.setOutputFile(outputPath);
            recorder.prepare();
            recorder.start();
            call.resolve(new JSObject());
        } catch (Exception e) {
            recorder = null;
            call.reject("START_FAILED: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (recorder == null) {
            call.reject("NOT_RECORDING");
            return;
        }
        try {
            recorder.stop();
            recorder.release();
            recorder = null;

            File file = new File(outputPath);
            byte[] bytes = new byte[(int) file.length()];
            try (FileInputStream fis = new FileInputStream(file)) {
                fis.read(bytes);
            }
            file.delete();

            String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            JSObject ret = new JSObject();
            ret.put("base64", b64);
            ret.put("mimeType", "audio/aac");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("STOP_FAILED: " + e.getMessage());
        }
    }
}
