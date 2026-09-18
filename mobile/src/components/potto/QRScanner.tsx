import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/potto/Button';
import { Radius, usePottoColors } from '@/constants/potto-theme';

/**
 * Free/local QR scanning via expo-camera (already the Expo-maintained
 * replacement for the deprecated expo-barcode-scanner) — no paid SDK. Reads
 * whatever text payload the QR encodes; the caller decides whether it's a
 * recognized Potto Join Code payload.
 */
export function QRScanner({ onScanned }: { onScanned: (data: string) => void }) {
  const colors = usePottoColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | undefined>();
  const scannedOnceRef = useRef(false);

  if (!permission) {
    return <View style={styles.box} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.box, styles.centered, { borderColor: colors.line, backgroundColor: colors.surfaceSunk }]}>
        <Text style={[styles.permissionText, { color: colors.inkSoft }]}>
          {permission.canAskAgain
            ? 'Potto needs camera access to scan a Join Code QR.'
            : 'Camera access was denied. Enable it in your device settings, or enter the Join Code manually below.'}
        </Text>
        {permission.canAskAgain && <PrimaryButton label="Allow Camera Access" onPress={requestPermission} />}
      </View>
    );
  }

  return (
    <View style={[styles.box, { borderColor: colors.line }]}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (scannedOnceRef.current) return;
          scannedOnceRef.current = true;
          setError(undefined);
          onScanned(data);
          // Give the caller a moment to navigate away before re-arming, in
          // case the payload wasn't a valid Potto code and scanning should resume.
          setTimeout(() => {
            scannedOnceRef.current = false;
          }, 1500);
        }}
      />
      {!!error && <Text style={[styles.errorOverlay, { color: colors.neg }]}>{error}</Text>}
      {Platform.OS === 'web' && (
        <Text style={[styles.webHint, { color: colors.inkSoft }]}>
          Point your webcam at a Potto Join Code QR.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 260, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 },
  permissionText: { fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
  camera: { flex: 1 },
  errorOverlay: { textAlign: 'center', fontSize: 12.5, fontWeight: '600', paddingVertical: 6 },
  webHint: { textAlign: 'center', fontSize: 11.5, paddingVertical: 6 },
});
