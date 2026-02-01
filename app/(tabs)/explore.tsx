import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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

  // Inicializar NFC al montar el componente
  useEffect(() => {
    let mounted = true;
    const initNfc = async () => {
      try {
        if (Platform.OS === 'web') {
          console.log('NFC no soportado en web');
          return;
        }

        // Verificar si el módulo native está disponible antes de llamar a start
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
      // Limpiar recursos
      if (Platform.OS !== 'web') {
        NfcManager.cancelTechnologyRequest().catch(() => { });
        // Event listener cleanup not strictly required if cancelled technology request, 
        // and setEventListener(IsoDep) is invalid in some versions.
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

      // Iniciar proceso de lectura
      leerNFC();

      return () => {
        pulseAnim.setValue(1);
        if (Platform.OS !== 'web') {
          NfcManager.cancelTechnologyRequest().catch(() => { });
        }
      };
    }
  }, [isScanning]);

  const procesarCobro = async (uid: string, montoCobrar: string, ndefData?: string) => {
    setIsScanning(false); // Detener UI de escaneo
    setIsProcessing(true); // Mostrar UI de carga

    try {
      console.log('Iniciando transacción...', { uid, monto: montoCobrar, ndefData });


      // Construir URL con parámetros (Query String) como solicita el backend
      const queryParams = new URLSearchParams({
        usuario_id: USER_ID_SOLICITANTE,
        origen: ndefData || '', // ID de la pulsera (NDEF)
        destino: CUENTA_DESTINO_ID,
        monto: montoCobrar
      }).toString();

      const url = `${SUPABASE_FUNCTION_URL}?${queryParams}`;
      console.log('Enviando petición a:', url);

      const response = await fetch(url, {
        method: 'POST',
        // No body, ya que los parámetros van en la URL
        headers: {
          // Opcional, pero buena práctica si el server espera algo específico, 
          // aunque para query params no afecta mucho.
        }
      });

      const data = await response.json();
      console.log('Respuesta del servidor:', data);

      if (response.ok) {
        Alert.alert(
          '✅ ¡Cobro Exitoso!',
          `Nuevo Saldo: $${data.saldo_destino || 'N/A'}\n\nInfo Tag: ${ndefData || 'Sin datos NDEF'}`,
          [{ text: 'OK', onPress: () => setMonto('') }]
        );
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
      // Solicitamos Ndef para asegurar lectura de mensajes, o NfcA/IsoDep como fallback
      await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA, NfcTech.IsoDep]);

      const tag = await NfcManager.getTag();
      console.log('Tag encontrado:', tag);

      // DETENER SCANNER INMEDIATAMENTE AL DETECTAR
      await NfcManager.cancelTechnologyRequest();

      if (!tag) {
        return; // O manejar error
      }

      let ndefText = '';
      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        // Decodificar el primer record NDEF si es texto
        const ndefRecord = tag.ndefMessage[0];
        // @ts-ignore
        const text = Ndef.text.decodePayload(ndefRecord.payload);
        ndefText = text;
        console.log('NDEF Text decodificado:', text);
      }

      // Procesar el cobro con el ID del tag
      // Usamos tag.id (UID) como 'origen'
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
      // Asegurar limpieza
      NfcManager.cancelTechnologyRequest().catch(() => { });
    }
  };

  const iniciarCobro = () => {
    if (!monto || parseFloat(monto) <= 0) {
      Alert.alert('Error', 'Por favor ingrese un monto válido');
      return;
    }
    setIsScanning(true);
  };

  const cancelarCobro = () => {
    setIsScanning(false);
    pulseAnim.setValue(1);
    NfcManager.cancelTechnologyRequest().catch(() => { });
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Cobrar 💵</ThemedText>
      </ThemedView>

      {!isScanning ? (
        <ThemedView style={styles.formContainer}>
          <ThemedText type="subtitle" style={styles.subtitle}>
            Ingrese el monto a cobrar
          </ThemedText>

          <ThemedView style={styles.inputContainer}>
            <ThemedText style={styles.currencySymbol}>$</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  borderColor: Colors[colorScheme ?? 'light'].tabIconDefault,
                },
              ]}
              placeholder="0.00"
              placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              value={monto}
              onChangeText={setMonto}
              keyboardType="decimal-pad"
              maxLength={10}
            />
          </ThemedView>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={iniciarCobro}>
            <IconSymbol size={24} name="arrow.right.circle.fill" color="#fff" />
            <Text style={styles.buttonText}>Iniciar Cobro</Text>
          </Pressable>

          <ThemedView style={styles.infoContainer}>
            <IconSymbol size={20} name="info.circle" color={Colors[colorScheme ?? 'light'].icon} />
            <ThemedText style={styles.infoText}>
              Ingrese el monto y presione "Iniciar Cobro", luego acerque la tarjeta Visa.
            </ThemedText>
          </ThemedView>

          <ThemedView style={{ marginTop: 10, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
            <Text style={{ fontSize: 10, color: '#666' }}>
              Configuración: {USER_ID_SOLICITANTE.substring(0, 8)}... → {CUENTA_DESTINO_ID.substring(0, 8)}...
            </Text>
          </ThemedView>

        </ThemedView>
      ) : (
        <ThemedView style={styles.scanningContainer}>
          {isProcessing ? (
            <ThemedView style={styles.scanningContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.scanningTitle}>Procesando Transacción...</ThemedText>
            </ThemedView>
          ) : (
            <>
              <Animated.View style={[styles.nfcIconContainer, { transform: [{ scale: pulseAnim }] }]}>
                <IconSymbol
                  size={120}
                  name="wave.3.right"
                  color={Colors[colorScheme ?? 'light'].tint}
                />
              </Animated.View>

              <ThemedText type="subtitle" style={styles.scanningTitle}>
                Acerca la Pulsera/Tag
              </ThemedText>

              <ThemedText style={styles.scanningText}>
                Mantén la pulsera cerca del dispositivo.
              </ThemedText>

              <ThemedView style={styles.montoDisplay}>
                <ThemedText style={styles.montoLabel}>Monto a cobrar:</ThemedText>
                <ThemedText type="title" style={styles.montoValue}>
                  ${monto}
                </ThemedText>
              </ThemedView>

              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  { borderColor: Colors[colorScheme ?? 'light'].tabIconDefault },
                  pressed && styles.buttonPressed,
                ]}
                onPress={cancelarCobro}>
                <IconSymbol
                  size={24}
                  name="xmark.circle.fill"
                  color={Colors[colorScheme ?? 'light'].tabIconDefault}
                />
                <ThemedText
                  style={[
                    styles.cancelButtonText,
                    { color: Colors[colorScheme ?? 'light'].tabIconDefault },
                  ]}>
                  Cancelar
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  formContainer: {
    gap: 24,
  },
  subtitle: {
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: 'bold',
    borderBottomWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: '#0a7ea4',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  scanningContainer: {
    alignItems: 'center',
    gap: 24,
    paddingVertical: 32,
  },
  nfcIconContainer: {
    marginVertical: 32,
  },
  scanningTitle: {
    textAlign: 'center',
  },
  scanningText: {
    textAlign: 'center',
    fontSize: 16,
  },
  montoDisplay: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
    minWidth: 200,
  },
  montoLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  montoValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 16,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
