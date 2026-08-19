import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
];

export default function SortSheet() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams();
  const activeSort = (params.sort as string) || 'newest';

  const applySort = (sortId: string) => {
    Haptics.selectionAsync();
    router.dismissTo({
      pathname: '/',
      params: {
        ...params,
        sort: sortId,
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>Sort</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => applySort(option.id)}
          >
            <Text
              style={[
                styles.rowLabel,
                { 
                  color: activeSort === option.id ? colors.primary : colors.foreground,
                  fontFamily: activeSort === option.id ? 'DMSans_700Bold' : 'DMSans_500Medium'
                }
              ]}
            >
              {option.label}
            </Text>
            {activeSort === option.id && (
              <Ionicons name="checkmark" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { width: 40 },
  closeBtn: { padding: 4, width: 40, alignItems: 'flex-end' },
  title: { fontSize: 18 },
  content: { paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16 },
});