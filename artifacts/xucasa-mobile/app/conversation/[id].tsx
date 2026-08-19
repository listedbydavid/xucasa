import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiGet, apiPost, adaptMessage, type Message } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const { data: messages = [] } = useQuery({
    queryKey: ['conversation-messages', id],
    queryFn: async () => {
      const raw = await apiGet<any[]>(`/api/conversations/${id}/messages`);
      return (raw ?? []).map(adaptMessage) as Message[];
    },
    enabled: !!id,
    refetchInterval: 10_000,
  });

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await apiPost(`/api/conversations/${id}/messages`, { content: text });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', id] });
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderUserId === user?.id;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View
          style={[
            styles.bubble,
            isMe
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <Text style={[
            styles.bubbleText,
            { color: isMe ? colors.primaryForeground : colors.foreground, fontFamily: 'DM_Sans_400Regular' }
          ]}>
            {item.content}
          </Text>
        </View>
        <Text style={[styles.msgTime, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding + 10,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
          Conversation
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={[...messages].reverse()}
          keyExtractor={(m: Message) => String(m.id)}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 8,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
                fontFamily: 'DM_Sans_400Regular',
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: !draft.trim() ? 0.5 : 1 }]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
          >
            <Ionicons name="send" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18 },
  list: { padding: 16, paddingBottom: 8, gap: 8 },
  msgRow: { alignItems: 'flex-start', maxWidth: '80%' },
  msgRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: '100%',
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  msgTime: { fontSize: 11, marginTop: 3 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
