/**
 * Edit-lead modal for the AI Assistant's imported-leads panel — mirrors the
 * web's inbound-lead edit form (name/company/email/phone/LinkedIn URL),
 * scoped to the fields MobileAssistantLead actually carries.
 */
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';
import type { MobileAssistantLead } from '@/src/services/mobileAIAssistantService';

interface EditLeadModalProps {
  visible: boolean;
  lead: MobileAssistantLead | null;
  onClose: () => void;
  onSave: (leadId: string, patch: Partial<MobileAssistantLead>) => void;
}

const FIELDS: { key: 'name' | 'company' | 'email' | 'phone' | 'profileUrl'; label: string; placeholder: string; keyboardType?: 'email-address' | 'phone-pad' }[] = [
  { key: 'name', label: 'Name', placeholder: 'Full name' },
  { key: 'company', label: 'Company', placeholder: 'Company name' },
  { key: 'email', label: 'Email', placeholder: 'name@company.com', keyboardType: 'email-address' },
  { key: 'phone', label: 'Phone', placeholder: '+1 555 000 0000', keyboardType: 'phone-pad' },
  { key: 'profileUrl', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
];

export function EditLeadModal({ visible, lead, onClose, onSave }: EditLeadModalProps) {
  const appTheme = useAppTheme();
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!lead) return;
    setForm({
      name: lead.name || '',
      company: lead.company || '',
      email: lead.email || '',
      phone: lead.phone || '',
      profileUrl: lead.profileUrl || '',
    });
  }, [lead]);

  if (!lead) return null;

  const handleSave = () => {
    onSave(lead.id, {
      name: form.name.trim() || lead.name,
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      profileUrl: form.profileUrl.trim(),
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
          <View style={[styles.header, { borderBottomColor: appTheme.borderSoft }]}>
            <Typography variant="body" color={appTheme.text} style={styles.title}>Edit lead</Typography>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X color={appTheme.muted} size={18} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {FIELDS.map((field) => (
              <View key={field.key} style={styles.fieldRow}>
                <Typography variant="caption" color={appTheme.muted} style={styles.fieldLabel}>{field.label}</Typography>
                <TextInput
                  value={form[field.key] || ''}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, [field.key]: text }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={appTheme.disabled}
                  keyboardType={field.keyboardType}
                  autoCapitalize="none"
                  style={[styles.input, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}
                />
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.footerBtn, { borderColor: appTheme.border }]} onPress={onClose}>
              <Typography variant="caption" color={appTheme.muted} style={styles.footerBtnText}>Cancel</Typography>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerBtn, styles.footerPrimary, { backgroundColor: appTheme.primaryAccent }]} onPress={handleSave}>
              <Typography variant="caption" color="#FFFFFF" style={styles.footerBtnText}>Save</Typography>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
  },
  title: {
    fontWeight: '700',
  },
  body: {
    padding: Theme.spacing.md,
    gap: 12,
  },
  fieldRow: {
    gap: 5,
  },
  fieldLabel: {
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: Theme.spacing.md,
    paddingTop: 0,
  },
  footerBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  footerPrimary: {
    borderWidth: 0,
  },
  footerBtnText: {
    fontWeight: '700',
  },
});
