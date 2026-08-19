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
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }
      : { elevation: 2 }),
  },
  image: {
    height: 200,
    borderRadius: 0,
  },
  info: {
    padding: 14,
    gap: 8,
  },
  price: {
    height: 22,
    width: 140,
  },
  specs: {
    height: 16,
    width: 200,
  },
  address: {
    height: 14,
    width: '80%',
  },
});
