import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';

function SkeletonPulse({ style }: { style?: object }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: colors.muted, borderRadius: 6 }, style, { opacity }]}
    />
  );
}

export function SkeletonCard() {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonPulse style={styles.image} />
      <View style={styles.info}>
        <SkeletonPulse style={styles.price} />
        <SkeletonPulse style={styles.specs} />
        <SkeletonPulse style={styles.address} />
      </View>
    </View>
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
  image: {
    height: 240,
    borderRadius: 0,
  },
  info: {
    padding: 16,
    paddingTop: 12,
    gap: 10,
  },
  price: {
    height: 28,
    width: 160,
  },
  specs: {
    height: 18,
    width: 220,
  },
  address: {
    height: 16,
    width: '90%',
  },
});