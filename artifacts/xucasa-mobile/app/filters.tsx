import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const BEDS_OPTIONS = ['Any', '1+', '2+', '3+', '4+'];
const BATHS_OPTIONS = ['Any', '1+', '2+', '3+', '4+'];
const TYPE_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'House', value: 'SFH,Single Family,House' },
  { label: 'Condo', value: 'Condo' },
  { label: 'Townhouse', value: 'Townhome,Townhouse' },
  { label: 'Multi-Family', value: '2-4 Unit,Multi-Family' },
  { label: 'Land', value: 'Land' },
];

export default function FiltersSheet() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [activeBeds, setActiveBeds] = useState(Number(params.minBeds) || 0);
  const [activeBaths, setActiveBaths] = useState(Number(params.minBaths) || 0);
  
  const typeIndex = TYPE_OPTIONS.findIndex((option) => option.value === (params.type as string));
  const [activeType, setActiveType] = useState(typeIndex > 0 ? typeIndex : 0);

  const [minPrice, setMinPrice] = useState((params.minPrice as string) || '');
  const [maxPrice, setMaxPrice] = useState((params.maxPrice as string) || '');

  const applyFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.dismissTo({
      pathname: '/',
      params: {
      ...(params.location ? { location: params.location } : {}),
      ...(activeBeds > 0 ? { minBeds: activeBeds } : { minBeds: '' }),
      ...(activeBaths > 0 ? { minBaths: activeBaths } : { minBaths: '' }),
      ...(activeType > 0 ? { type: TYPE_OPTIONS[activeType].value } : { type: '' }),
      ...(minPrice ? { minPrice } : { minPrice: '' }),
      ...(maxPrice ? { maxPrice } : { maxPrice: '' }),
      ...(params.sort ? { sort: params.sort } : {}),
      },
    });
  };

  const clearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveBeds(0);
    setActiveBaths(0);
    setActiveType(0);
    setMinPrice('');
    setMaxPrice('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>Filters</Text>
        <TouchableOpacity onPress={clearFilters}>
          <Text style={[styles.clearText, { color: colors.primary, fontFamily: 'DMSans_500Medium' }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.body} behavior="padding">
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Outfit_600SemiBold' }]}>Price Range</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.priceInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: 'DMSans_400Regular' }]}
                placeholder="Min Price"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={minPrice}
                onChangeText={setMinPrice}
              />
              <Text style={{ color: colors.mutedForeground, marginHorizontal: 8 }}>-</Text>
              <TextInput
                style={[styles.priceInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: 'DMSans_400Regular' }]}
                placeholder="Max Price"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Outfit_600SemiBold' }]}>Bedrooms</Text>
            <View style={styles.chipsWrap}>
              {BEDS_OPTIONS.map((label, i) => (
                <TouchableOpacity
                  key={`bed-${i}`}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: activeBeds === i ? colors.primary : colors.card,
                      borderColor: activeBeds === i ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveBeds(i);
                  }}
                >
                  <Text style={[
                    styles.chipText,
                    {
                      color: activeBeds === i ? colors.primaryForeground : colors.foreground,
                      fontFamily: activeBeds === i ? 'DMSans_700Bold' : 'DMSans_500Medium',
                    },
                  ]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Outfit_600SemiBold' }]}>Bathrooms</Text>
            <View style={styles.chipsWrap}>
              {BATHS_OPTIONS.map((label, i) => (
                <TouchableOpacity
                  key={`bath-${i}`}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: activeBaths === i ? colors.primary : colors.card,
                      borderColor: activeBaths === i ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveBaths(i);
                  }}
                >
                  <Text style={[
                    styles.chipText,
                    {
                      color: activeBaths === i ? colors.primaryForeground : colors.foreground,
                      fontFamily: activeBaths === i ? 'DMSans_700Bold' : 'DMSans_500Medium',
                    },
                  ]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Outfit_600SemiBold' }]}>Property Type</Text>
            <View style={styles.chipsWrap}>
              {TYPE_OPTIONS.map((option, i) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: activeType === i ? colors.primary : colors.card,
                      borderColor: activeType === i ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveType(i);
                  }}
                >
                  <Text style={[
                    styles.chipText,
                    {
                      color: activeType === i ? colors.primaryForeground : colors.foreground,
                      fontFamily: activeType === i ? 'DMSans_700Bold' : 'DMSans_500Medium',
                    },
                  ]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={applyFilters}>
            <Text style={[styles.applyBtnText, { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold' }]}>Show Results</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  closeBtn: { padding: 4 },
  title: { fontSize: 18 },
  clearText: { fontSize: 16, padding: 4 },
  body: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 20 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  priceInput: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  chipText: { fontSize: 15 },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  applyBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 16 },
});