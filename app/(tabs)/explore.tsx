import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CUENTA_DESTINO_ID, SUPABASE_FUNCTION_URL, USER_ID_SOLICITANTE } from '@/config';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CobrarScreen() {
  const colorScheme = useColorScheme();
  const [monto, setMonto] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const pulseAnim = useState(new Animated.Value(1))[0];
  const [nfcEnabled, setNfcEnabled] = useState(false);

  // State for success card
  const [successData, setSuccessData] = useState<{ amount: string, newBalance: string, tagInfo: string } | null>(null);

  // Inicializar NFC al montar el componente
  useEffect(() => {
    let mounted = true;
    const initNfc = async () => {
      try {
        if (Platform.OS === 'web') {
          console.log('NFC no soportado en web');
          return;
        }

        try {
          await NfcManager.start();
          if (mounted) setNfcEnabled(true);
          console.log('NFC Manager inicializado correctamente');
        } catch (e) {
          console.warn('Error al iniciar NfcManager (posiblemente falta native module):', e);
        }
      } catch (error) {
        console.warn('Fallo general en inicialización NFC:', error);
      }
    };

    initNfc();

    return () => {
      mounted = false;
      if (Platform.OS !== 'web') {
        NfcManager.cancelTechnologyRequest().catch(() => { });
      }
    };
  }, []);

  // Animación de pulso
  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();

      leerNFC();

      return () => {
        pulseAnim.setValue(1);
        if (Platform.OS !== 'web') {
          NfcManager.cancelTechnologyRequest().catch(() => { });
        }
      };
    }
  }, [isScanning, pulseAnim]);

  const procesarCobro = async (uid: string, montoCobrar: string, ndefData?: string) => {
    setIsScanning(false);
    setIsProcessing(true);

    try {
      console.log('Iniciando transacción...', { uid, monto: montoCobrar, ndefData });

      const queryParams = new URLSearchParams({
        usuario_id: USER_ID_SOLICITANTE,
        origen: ndefData || '',
        destino: CUENTA_DESTINO_ID,
        monto: montoCobrar
      }).toString();

      const url = `${SUPABASE_FUNCTION_URL}?${queryParams}`;
      console.log('Enviando petición a:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {}
      });

      const data = await response.json();
      console.log('Respuesta del servidor:', data);

      if (response.ok) {
        // Success: Show card instead of Alert
        setSuccessData({
          amount: montoCobrar,
          newBalance: data.saldo_destino || 'N/A',
          tagInfo: ndefData || 'Sin datos NDEF'
        });
        setMonto('');

        // FEEDBACK: Haptics
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      } else {
        throw new Error(data.error || 'Error desconocido del servidor');
      }

    } catch (error) {
      console.error('Error en transacción:', error);
      Alert.alert('❌ Error en la transacción', String(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const leerNFC = async () => {
    if (!nfcEnabled && Platform.OS !== 'web') {
      try {
        await NfcManager.start();
        setNfcEnabled(true);
      } catch (e) {
        Alert.alert('Error de Entorno', 'Error al iniciar NFC start(): ' + String(e));
        setIsScanning(false);
        return;
      }
    }

    try {
      console.log('Solicitando detección...');
      await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA, NfcTech.IsoDep]);

      const tag = await NfcManager.getTag();
      console.log('Tag encontrado:', tag);

      await NfcManager.cancelTechnologyRequest();

      if (!tag) {
        return;
      }

      let ndefText = '';
      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        const ndefRecord = tag.ndefMessage[0];
        // @ts-ignore
        const text = Ndef.text.decodePayload(ndefRecord.payload);
        ndefText = text;
        console.log('NDEF Text decodificado:', text);
      }

      if (tag.id) {
        await procesarCobro(tag.id, monto, ndefText);
      } else {
        Alert.alert('Error', 'No se pudo obtener el UID del tag.');
        setIsScanning(false);
      }

    } catch (error: any) {
      console.warn('Excepción en lectura NFC:', error);
      setIsScanning(false);

      const errMsg = String(error);
      if (!errMsg.includes('cancelled') && !errMsg.includes('canceled')) {
        Alert.alert('Error NFC', `Error al leer: ${errMsg}`);
      }
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => { });
    }
  };

  const iniciarCobro = () => {
    if (!monto || parseFloat(monto) <= 0) {
      Alert.alert('Error', 'Por favor ingrese un monto válido');
      return;
    }
    setSuccessData(null); // Reset success state
    setIsScanning(true);
  };

  const cancelarCobro = () => {
    setIsScanning(false);
    pulseAnim.setValue(1);
    NfcManager.cancelTechnologyRequest().catch(() => { });
  };

  const closeSuccessCard = () => {
    setSuccessData(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>Cobrar 💵</ThemedText>
        <Text style={styles.headerId}>ID: {USER_ID_SOLICITANTE.substring(0, 8)}...</Text>
      </View>

      <View style={styles.content}>
        {/* SUCCESS CARD OVERLAY */}
        {successData && (
          <View style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <IconSymbol size={60} name="checkmark" color="#FFF" />
            </View>
            <Text style={styles.successTitle}>¡Cobro Exitoso!</Text>
            <Text style={styles.successAmount}>S/ {successData.amount}</Text>

            <View style={styles.successDetails}>
              <Text style={styles.successLabel}>Nuevo Saldo:</Text>
              <Text style={styles.successValue}>S/ {successData.newBalance}</Text>
            </View>

            <Pressable style={styles.successButton} onPress={closeSuccessCard}>
              <Text style={styles.successButtonText}>Nuevo Cobro</Text>
            </Pressable>
          </View>
        )}

        {/* MAIN FORM */}
        {!isScanning && !successData && (
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>S/</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#333"
                value={monto}
                onChangeText={setMonto}
                keyboardType="decimal-pad"
                maxLength={8}
                autoFocus
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={iniciarCobro}>
              <Text style={styles.primaryButtonText}>Iniciar Cobro</Text>
              <IconSymbol size={24} name="arrow.right" color="#000" />
            </Pressable>

            <View style={styles.configInfo}>
              <Text style={styles.configText}>Cuenta Destino: {CUENTA_DESTINO_ID.substring(0, 12)}...</Text>
            </View>
          </View>
        )}

        {/* SCANNING UI */}
        {isScanning && (
          <View style={styles.scanningContainer}>
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={Colors.fintech.success} />
                <Text style={styles.processingText}>Procesando...</Text>
              </View>
            ) : (
              <>
                <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
                  <View style={styles.innerCircle}>
                    <IconSymbol size={64} name="wave.3.right" color={Colors.fintech.success} />
                  </View>
                </Animated.View>

                <Text style={styles.scanningTitle}>Acerque la pulsera NFC ahora...</Text>
                <Text style={styles.scanningSubtitle}>Monto a cobrar: S/ {monto}</Text>

                <Pressable style={styles.cancelButton} onPress={cancelarCobro}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.fintech.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: 28,
    color: Colors.fintech.textPrimary,
  },
  headerId: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center', // Center content vertically
  },
  // FORM
  formContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 32,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.fintech.success,
  },
  input: {
    fontSize: 64,
    fontWeight: 'bold',
    color: Colors.fintech.success,
    minWidth: 120,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fintech.success,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    gap: 12,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  configInfo: {
    marginTop: 20,
  },
  configText: {
    color: '#333',
    fontSize: 12,
  },
  // SCANNING
  scanningContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  pulseCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: Colors.fintech.success,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
  },
  innerCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningTitle: {
    fontSize: 20,
    color: Colors.fintech.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  scanningSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  cancelButton: {
    padding: 16,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  processingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  processingText: {
    color: Colors.fintech.success,
    fontSize: 18,
  },
  // SUCCESS CARD
  successCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.fintech.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.fintech.textPrimary,
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.fintech.success,
    marginBottom: 32,
  },
  successDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 24,
  },
  successLabel: {
    color: '#888',
    fontSize: 16,
  },
  successValue: {
    color: Colors.fintech.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  successButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.fintech.success,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    color: Colors.fintech.success,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
