import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Send, Bot, Sparkles, FileText, Reply, CheckSquare } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { MessageBubble } from '@/components/features/MessageBubble';

const ASSISTANT_ACTIONS = [
  { id: 'reply', title: 'Generate Reply', icon: Reply },
  { id: 'summarize', title: 'Summarize', icon: FileText },
  { id: 'task', title: 'Create Task', icon: CheckSquare },
];

export default function AIChatModal() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', sender: 'bot', text: 'Hello! I am your LAD AI assistant. How can I help today?', time: '10:30 AM' },
    { id: '2', sender: 'user', text: 'Summarize the performance of the Q3 Enterprise campaign.', time: '10:31 AM' },
    { id: '3', sender: 'bot', text: 'The Q3 Enterprise campaign has sent 1,204 emails with a 45% open rate. There are 3 hot leads.', time: '10:31 AM' },
  ]);

  const handleSend = (text: string = input) => {
    if (!text.trim()) return;
    
    const newMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, newMsg]);
    setInput('');

    // Mock AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: `I'll help you with "${text}". Processing your request...`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 1000);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Sparkles color={Theme.colors.primary} size={24} />
          <Typography variant="h3" style={{ marginLeft: Theme.spacing.sm }}>AI Assistant</Typography>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X color={Theme.colors.textSecondary} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.chatArea} showsVerticalScrollIndicator={false}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            text={msg.text}
            time={msg.time}
            isMe={msg.sender === 'user'}
            isAI={msg.sender === 'bot'}
          />
        ))}
      </ScrollView>

      <View style={styles.inputArea}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.actionsRow}
        >
          {ASSISTANT_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <TouchableOpacity 
                key={action.id} 
                style={styles.actionChip}
                onPress={() => handleSend(action.title)}
              >
                <Icon color={Theme.colors.primary} size={16} />
                <Typography variant="bodySmall" color={Theme.colors.primary} style={{ marginLeft: 6 }}>
                  {action.title}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <GlassCard style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Type a message or use an action..."
            placeholderTextColor={Theme.colors.textDisabled}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !input && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
          >
            <Send color={Theme.colors.surface} size={20} />
          </TouchableOpacity>
        </GlassCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    marginTop: Platform.OS === 'ios' ? 40 : 0,
    borderTopLeftRadius: Theme.radius.xl,
    borderTopRightRadius: Theme.radius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    padding: Theme.spacing.xs,
  },
  chatArea: {
    padding: Theme.spacing.lg,
    flexGrow: 1,
  },
  inputArea: {
    padding: Theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderLight,
    backgroundColor: Theme.colors.surface,
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.infoLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.info,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    color: Theme.colors.text,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
