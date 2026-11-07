import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function IncidentPhotoViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={url !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        style={styles.viewer}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer la photo"
      >
        <View style={[styles.closeIcon, { top: insets.top + SPACING.md }]}>
          <Ionicons name="close" size={26} color={COLORS.surface} />
        </View>
        {url ? <Image source={{ uri: url }} style={styles.viewerImage} contentFit="contain" /> : null}
      </Pressable>
    </Modal>
  );
}

export function IncidentPhotoStrip({ urls }: { urls: string[] }) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  if (urls.length === 0) return null;

  return (
    <View style={styles.strip}>
      <Text style={styles.label}>Photos jointes ({urls.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {urls.map((url, index) => (
          <TouchableOpacity
            key={`${url}-${index}`}
            onPress={() => setSelectedUrl(url)}
            activeOpacity={0.8}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Agrandir la photo ${index + 1}`}
          >
            <Image source={{ uri: url }} style={styles.thumbnail} contentFit="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <IncidentPhotoViewer url={selectedUrl} onClose={() => setSelectedUrl(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    position: 'absolute',
    right: SPACING.xl,
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  viewerImage: {
    width: '100%',
    height: '82%',
  },
  strip: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.border,
  },
});
