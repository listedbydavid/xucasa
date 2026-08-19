import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getPhotoUrl, formatPrice, isNewListing, type Property } from '@/lib/api';

interface PropertyCardProps {
  property: Property;
  isSaved?: boolean;
  onPress: () => void;
  onSaveToggle?: () => void;
}

export function PropertyCard({ property, isSaved = false, onPress, onSaveToggle }: PropertyCardProps) {
  const colors = useColors();
  const firstPhoto = getPhotoUrl(property.photos?.[0]);
  const isNew = isNewListing(property.listingDate);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      {/* Photo */}
      <View style={styles.imageContainer}>
        {firstPhoto ? (
          <Image
            source={{ uri: firstPhoto }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            placeholder={{ thumbhash: undefined }}
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Ionicons name="home-outline" size={40} color={colors.mutedForeground} />
          </View>
        )}

        {/* Badges row */}
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={isSaved ? colors.primary : '#fff'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.price, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
          {formatPrice(property.price)}
        </Text>

        <View style={styles.specsRow}>
          {property.beds != null && (
            <Text style={[styles.spec, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
              {property.beds} bd
            </Text>
          )}
          {property.baths != null && (
            <Text style={[styles.specSep, { color: colors.mutedForeground }]}>·</Text>
          )}
          {property.baths != null && (
            <Text style={[styles.spec, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
              {property.baths} ba
            </Text>
          )}
          {property.sqft != null && (
            <>
              <Text style={[styles.specSep, { color: colors.mutedForeground }]}>·</Text>
              <Text style={[styles.spec, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
                {property.sqft.toLocaleString()} sqft
              </Text>
            </>
          )}
        </View>

        <Text style={[styles.address, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]} numberOfLines={1}>
          {property.address}{property.city ? `, ${property.city}` : ''}{property.state ? `, ${property.state}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }
      : { elevation: 2 }),
  },
  imageContainer: {
    position: 'relative',
    height: 200,
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
  badgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  saveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 14,
    gap: 3,
  },
  price: {
    fontSize: 20,
    marginBottom: 2,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spec: {
    fontSize: 14,
  },
  specSep: {
    fontSize: 14,
  },
  address: {
    fontSize: 13,
    marginTop: 2,
  },
});
