import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getPhotoUrl, formatPrice, isNewListing, type Property } from '@/lib/api';

interface PropertyCardProps {
  property: Property;
  isSaved?: boolean;
  embedded?: boolean;
  compact?: boolean;
  onPress: () => void;
  onSaveToggle?: () => void;
}

export function PropertyCard({
  property,
  isSaved = false,
  embedded = false,
  compact = false,
  onPress,
  onSaveToggle,
}: PropertyCardProps) {
  const colors = useColors();
  const photoUrls = useMemo(
    () => (property.photos ?? [])
      .map(getPhotoUrl)
      .filter((photo): photo is string => Boolean(photo))
      .slice(0, 3),
    [property.photos],
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const currentPhoto = photoUrls[photoIndex];
  const isNew = isNewListing(property.listingDate);

  useEffect(() => {
    setPhotoIndex(0);
  }, [property.id]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        embedded && styles.embeddedCard,
        compact && styles.compactCard,
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Photo */}
      <View style={[styles.imageContainer, compact && styles.compactImageContainer]}>
        {currentPhoto ? (
          <Image
            source={{ uri: currentPhoto }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            onError={() => setPhotoIndex((index) => index + 1)}
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Ionicons name="image-outline" size={48} color={colors.mutedForeground} />
          </View>
        )}

        {/* Top Badges */}
        <View style={styles.badgeRow}>
          {isNew && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>NEW</Text>
            </View>
          )}
          {property.isBuyItNow && (
            <View style={[styles.badge, { backgroundColor: '#1a6b3a' }]}>
              <Text style={[styles.badgeText, { color: '#fff' }]}>BUY IT NOW</Text>
            </View>
          )}
        </View>

        {/* Save button */}
        {onSaveToggle && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={onSaveToggle}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View style={styles.saveBtnCircle}>
              <Ionicons
                name={isSaved ? 'heart' : 'heart-outline'}
                size={22}
                color={isSaved ? colors.primary : '#fff'}
              />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Info */}
      <View style={[styles.info, compact && styles.compactInfo]}>
        <Text style={[styles.price, compact && styles.compactPrice, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
          {formatPrice(property.price)}
        </Text>

        <View style={styles.specsRow}>
          {property.beds != null && (
            <Text style={[styles.spec, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
              {property.beds} bd
            </Text>
          )}
          {property.baths != null && (
            <Text style={[styles.specSep, { color: colors.mutedForeground }]}>|</Text>
          )}
          {property.baths != null && (
            <Text style={[styles.spec, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
              {property.baths} ba
            </Text>
          )}
          {property.sqft != null && (
            <>
              <Text style={[styles.specSep, { color: colors.mutedForeground }]}>|</Text>
              <Text style={[styles.spec, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
                {property.sqft.toLocaleString()} sqft
              </Text>
            </>
          )}
        </View>

        <Text style={[styles.address, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]} numberOfLines={1}>
          {property.address}{property.city ? `, ${property.city}` : ''}{property.state ? ` ${property.state}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }
      : { elevation: 4 }),
  },
  embeddedCard: {
    borderRadius: 0,
    marginBottom: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  compactCard: {
    height: 136,
    flexDirection: 'row',
    marginBottom: 0,
    borderRadius: 14,
  },
  imageContainer: {
    position: 'relative',
    height: 240,
  },
  compactImageContainer: {
    width: 128,
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInfo: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  compactPrice: {
    fontSize: 21,
  },
  badgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  saveBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  saveBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 16,
    paddingTop: 12,
  },
  price: {
    fontSize: 24,
    marginBottom: 6,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  spec: {
    fontSize: 15,
  },
  specSep: {
    fontSize: 14,
  },
  address: {
    fontSize: 14,
  },
});