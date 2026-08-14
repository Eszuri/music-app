; Custom NSIS Uninstaller Hook for Symvonia
; Prompts the user whether they want to keep or delete heavy AI models and configuration

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Apakah Anda ingin menghapus seluruh data konfigurasi dan model AI yang telah diunduh (~beberapa GB)?$\r$\n$\r$\n• Pilih [YA] untuk menghapus semua data termasuk model AI.$\r$\n• Pilih [TIDAK] untuk tetap menyimpan data (Disarankan jika Anda ingin menginstall ulang agar tidak perlu mengunduh ulang model AI yang besar)." IDNO keep_data
  RMDir /r "$APPDATA\com.symvonia.player"
  RMDir /r "$LOCALAPPDATA\com.symvonia.player"
  Goto end_custom_uninstall
keep_data:
  ; Preserve AppData folder containing AI models and config.json
end_custom_uninstall:
!macroend
