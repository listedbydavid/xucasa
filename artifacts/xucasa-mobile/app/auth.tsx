import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

type Tab = 'login' | 'register';

export default function AuthScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 10) return 'Password must be at least 10 characters.';
    if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter.';
    if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter.';
    if (!/[0-9]/.test(pw)) return 'Password must contain a number.';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain a special character (e.g. !@#$).';
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (tab === 'register') {
      if (!firstName.trim()) { setError('Please enter your first name.'); return; }
      const pwErr = validatePassword(password);
      if (pwErr) { setError(pwErr); return; }
    }
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, firstName.trim(), lastName.trim());
      }
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Close button */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: topPadding + 10 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <KeyboardAwareScrollViewCompat
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 60 }]}
      >
        {/* Logo */}
        <Text style={[styles.logo, { color: colors.primary, fontFamily: 'Outfit_700Bold' }]}>
          xucasa
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
          {tab === 'login' ? 'Welcome back' : 'Create your account'}
        </Text>

        {/* Tab switcher */}
        <View style={[styles.tabs, { backgroundColor: colors.muted }]}>
          {(['login', 'register'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.tabBtn,
                tab === t && { backgroundColor: colors.background, ...shadowStyle },
              ]}
              onPress={() => { setTab(t); setError(null); }}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: tab === t ? colors.foreground : colors.mutedForeground,
                    fontFamily: tab === t ? 'DM_Sans_500Medium' : 'DM_Sans_400Regular',
                  },
                ]}
              >
                {t === 'login' ? 'Sign in' : 'Register'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Error */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={[styles.errorText, { color: '#DC2626', fontFamily: 'DM_Sans_400Regular' }]}>
              {error}
            </Text>
          </View>
        )}

        {/* Name fields (register only) */}
        {tab === 'register' && (
          <View style={styles.nameRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
                First name
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground, fontFamily: 'DM_Sans_400Regular' }]}
                placeholder="Jane"
                placeholderTextColor={colors.mutedForeground}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                textContentType="givenName"
                returnKeyType="next"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
                Last name
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground, fontFamily: 'DM_Sans_400Regular' }]}
                placeholder="Smith"
                placeholderTextColor={colors.mutedForeground}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                textContentType="familyName"
                returnKeyType="next"
              />
            </View>
          </View>
        )}

        {/* Email */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
            Email
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground, fontFamily: 'DM_Sans_400Regular' }]}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            returnKeyType="next"
          />
        </View>

        {/* Password */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
            Password
          </Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground, fontFamily: 'DM_Sans_400Regular' }]}
              placeholder={tab === 'register' ? 'Min 10 chars, uppercase, number, symbol' : '••••••••'}
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType={tab === 'login' ? 'password' : 'newPassword'}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.submitText, { color: colors.primaryForeground, fontFamily: 'DM_Sans_500Medium' }]}>
              {tab === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const shadowStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  android: { elevation: 2 },
  default: {},
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 24,
    gap: 16,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  logo: {
    fontSize: 36,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 17,
    marginBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: { fontSize: 14 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 14, flex: 1 },
  field: { gap: 6 },
  label: { fontSize: 14 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  passwordContainer: { position: 'relative' },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingRight: 48,
    fontSize: 15,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: { fontSize: 16 },
});
