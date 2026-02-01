import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- CONSTANTS & HELPERS ---
const USER_ID = '6f4ad337-c8ba-460e-a7e2-f73782edea4a';
const API_URL = `https://mntnwbnpnsgyvmybfuqn.supabase.co/functions/v1/last-transaction?solicitante_id=${USER_ID}&limit=5`;
const BALANCE_API_URL = `https://mntnwbnpnsgyvmybfuqn.supabase.co/functions/v1/account-resume?usuario_id=${USER_ID}`;

interface Movimiento {
  id: string;
  monto: number;
  created_at: string;
  descripcion?: string;
  usuario_id?: string;
  origen?: string;
  destino?: string;
}

const formatTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Hace un momento';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Hace ${diffInHours} h`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `Hace ${diffInDays} días`;
};

export default function HomeScreen() {
  const router = useRouter();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [balance, setBalance] = useState('S/ ...');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchMovimientos();
      fetchBalance();
    }, [])
  );

  const fetchBalance = async () => {
    try {
      // POST request per user instructions
      const response = await fetch(BALANCE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json' // Likely needed even if headers weren't specified in python example requests usually sets some
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.saldo_total_general === 'number') {
          // Format: S/ 5,590.00
          setBalance(`S/ ${data.saldo_total_general.toFixed(2)}`);
        }
      } else {
        console.error('Error fetching balance:', response.status);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const fetchMovimientos = async () => {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();

        // Handle both Array (limit=5) and Single Object (limit=1/default)
        let movementsArray: Movimiento[] = [];

        if (Array.isArray(data)) {
          movementsArray = data;
        } else if (data && typeof data === 'object') {
          // Wrap single object in array if valid
          if (data.id) {
            movementsArray = [data];
          }
        }

        setMovimientos(movementsArray);
      } else {
        console.error('Error fetching movements:', response.status);
      }
    } catch (error) {
      console.error('Error fetching movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToCharge = () => {
    router.push('/explore');
  };

  const renderActivityItem = ({ item }: { item: Movimiento }) => (
    <View style={styles.activityItem}>
      <View style={styles.activityIconContainer}>
        <IconSymbol size={20} name="checkmark.circle.fill" color={Colors.fintech.success} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{item.descripcion || 'Cobro NFC'}</Text>
        <Text style={styles.activityDate}>{formatTimeAgo(item.created_at)}</Text>
      </View>
      <Text style={styles.activityAmount}>+ S/ {typeof item.monto === 'number' ? item.monto.toFixed(2) : item.monto}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.fintech.background} />

      <View style={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerGreeting}>¡Hola de nuevo! 👋</Text>
          <Text style={styles.headerId}>ID: {USER_ID}</Text>
        </View>

        {/* BALANCE CARD */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Disponible</Text>
          <Text style={styles.balanceAmount}>{balance}</Text>
          <View style={styles.balanceFooter}>
            <Text style={styles.balanceFooterText}> • Actualizado ahora</Text>
          </View>
        </View>

        {/* QUICK ACTION */}
        <TouchableOpacity style={styles.actionButton} onPress={handleNavigateToCharge} activeOpacity={0.8}>
          <View style={styles.actionButtonContainer}>
            <IconSymbol size={24} name="creditcard.fill" color="#000" />
            <Text style={styles.actionButtonText}>Iniciar Nuevo Cobro</Text>
          </View>
        </TouchableOpacity>

        {/* RECENT HISTORY */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actividad Reciente</Text>
          {loading && <ActivityIndicator size="small" color={Colors.fintech.success} style={{ marginLeft: 10 }} />}
        </View>

        <FlatList
          data={movimientos}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={renderActivityItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No hay movimientos recientes.</Text>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.fintech.background,
  },
  content: {
    padding: 24,
    flex: 1,
  },
  // HEADER
  header: {
    marginTop: 20,
    marginBottom: 32,
  },
  headerGreeting: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.fintech.textPrimary,
    marginBottom: 4,
  },
  headerId: {
    fontSize: 14,
    color: Colors.fintech.textSecondary,
    fontFamily: 'System',
    opacity: 0.7,
  },
  // BALANCE CARD
  balanceCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.fintech.textPrimary,
    marginBottom: 8,
  },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceFooterText: {
    color: Colors.fintech.success,
    fontSize: 12,
    fontWeight: '600',
  },
  // ACTION BUTTON
  actionButton: {
    marginBottom: 40,
    borderRadius: 16,
    shadowColor: Colors.fintech.success,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  actionButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: Colors.fintech.success,
    gap: 12,
  },
  actionButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // RECENT HISTORY
  sectionHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.fintech.textPrimary,
  },
  listContent: {
    paddingBottom: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.fintech.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.fintech.textPrimary,
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: Colors.fintech.textSecondary,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.fintech.success,
  },
});
