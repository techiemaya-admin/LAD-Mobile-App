import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { X, CheckCircle, Circle, Clock } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';

export default function TaskManagementModal() {
  const router = useRouter();

  const tasks = [
    { id: 1, title: 'Follow up with TechCorp', due: 'Today, 2:00 PM', completed: false },
    { id: 2, title: 'Review Q3 Campaign Metrics', due: 'Tomorrow', completed: false },
    { id: 3, title: 'Call Sarah Jenkins', due: 'Yesterday', completed: true },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h3">Tasks</Typography>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X color={Theme.colors.textSecondary} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tasks.map((task) => (
          <GlassCard key={task.id} style={[styles.taskCard, task.completed && styles.taskCompleted]}>
            <TouchableOpacity style={styles.checkbox}>
              {task.completed ? <CheckCircle color={Theme.colors.success} size={24} /> : <Circle color={Theme.colors.textDisabled} size={24} />}
            </TouchableOpacity>
            <View style={styles.taskInfo}>
              <Typography variant="bodyLarge" style={{ textDecorationLine: task.completed ? 'line-through' : 'none', color: task.completed ? Theme.colors.textSecondary : Theme.colors.text }}>
                {task.title}
              </Typography>
              <View style={styles.dueRow}>
                <Clock color={Theme.colors.textDisabled} size={14} />
                <Typography variant="caption" color={Theme.colors.textSecondary} style={{ marginLeft: 4 }}>{task.due}</Typography>
              </View>
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    marginTop: 40,
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
  closeBtn: {
    padding: Theme.spacing.xs,
  },
  content: {
    padding: Theme.spacing.xl,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  taskCompleted: {
    opacity: 0.7,
  },
  checkbox: {
    marginRight: Theme.spacing.md,
  },
  taskInfo: {
    flex: 1,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
});
