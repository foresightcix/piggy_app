import { Image, StyleSheet } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function HomeScreen() {
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
        <ThemedText type="title">Piggy App BCP ga</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.descriptionContainer}>
        <ThemedText style={styles.description}>
          Esta aplicación te permite realizar cobros rápidos mediante tecnología NFC.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.instructionsContainer}>
        <IconSymbol size={32} name="creditcard.fill" color="#0a7ea4" />
        <ThemedText style={styles.instructions}>
          Dirígete a la pestaña <ThemedText type="defaultSemiBold">"Cobrar"</ThemedText> para empezar a realizar cobros con pulseras NFC.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.featuresContainer}>
        <ThemedText type="subtitle" style={styles.featuresTitle}>Características</ThemedText>

        <ThemedView style={styles.featureItem}>
          <IconSymbol size={24} name="checkmark.circle.fill" color="#34C759" />
          <ThemedText style={styles.featureText}>Cobros instantáneos con NFC</ThemedText>
        </ThemedView>

        <ThemedView style={styles.featureItem}>
          <IconSymbol size={24} name="checkmark.circle.fill" color="#34C759" />
          <ThemedText style={styles.featureText}>Interfaz simple y rápida</ThemedText>
        </ThemedView>

        <ThemedView style={styles.featureItem}>
          <IconSymbol size={24} name="checkmark.circle.fill" color="#34C759" />
          <ThemedText style={styles.featureText}>Confirmación inmediata de transacción</ThemedText>
        </ThemedView>
      </ThemedView>
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
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
    marginBottom: 24,
  },
  instructions: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  featuresContainer: {
    gap: 12,
  },
  featuresTitle: {
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
  },
});
