package com.company.mrlad

import android.content.ContentValues
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class LadDownloadsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "LadDownloads"

  @ReactMethod
  fun saveBase64File(fileName: String, mimeType: String, base64Data: String, promise: Promise) {
    try {
      val safeName = fileName
        .replace(Regex("[<>:\"/\\\\|?*\\u0000-\\u001F]"), "-")
        .ifBlank { "lad-export-${System.currentTimeMillis()}.xlsx" }
      val bytes = Base64.decode(base64Data, Base64.DEFAULT)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val resolver = reactContext.contentResolver
        val values = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, safeName)
          put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
          put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
          put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          ?: throw IllegalStateException("Could not create Downloads file")

        resolver.openOutputStream(uri)?.use { output ->
          output.write(bytes)
          output.flush()
        } ?: throw IllegalStateException("Could not open Downloads file")

        values.clear()
        values.put(MediaStore.MediaColumns.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        promise.resolve(uri.toString())
        return
      }

      @Suppress("DEPRECATION")
      val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
      if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
        throw IllegalStateException("Could not open Downloads folder")
      }

      val outputFile = File(downloadsDir, safeName)
      FileOutputStream(outputFile).use { output ->
        output.write(bytes)
        output.flush()
      }
      MediaScannerConnection.scanFile(
        reactContext,
        arrayOf(outputFile.absolutePath),
        arrayOf(mimeType),
        null,
      )
      promise.resolve(Uri.fromFile(outputFile).toString())
    } catch (error: Exception) {
      promise.reject("ERR_LAD_DOWNLOAD", error.message, error)
    }
  }
}
