/**
 * Import Leads modal — mobile port of LAD-Frontend-2's ImportLeadsDialog.
 *
 * Three tabs, same workflow and endpoints as the web app:
 *  • Add Leads       — manual multi-lead form with per-field validation,
 *                      auto-fix phone country codes, optional chat-group assignment
 *  • Excel Upload    — parse .xlsx/.csv locally (same header names as web),
 *                      prefill the Add Leads list for review; template download
 *  • Scrape from URL — POST /api/leads/scrape (Jina + Claude extraction on the
 *                      backend), prefill the Add Leads list for review
 *
 * Import posts to /api/leads/import with { leads, chat_group_ids } and renders
 * the same result summary (imported / conversations / skipped / duplicates / errors).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {
  AlertCircle,
  AtSign,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Globe,
  Link2,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import * as XLSX from 'xlsx';

import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';
import {
  getBroadcastGroups,
  importLeads,
  scrapeLeadsFromUrl,
  type BroadcastGroup,
  type ImportLeadsResult,
} from '@/src/services/chat.service';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadEntry {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  linkedin_url: string;
  instagram_url: string;
  source: string;
}

type TabId = 'single' | 'excel' | 'url';

interface ImportLeadsModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful import so the parent can refresh conversations/groups */
  onImportComplete: () => void;
  initialTab?: TabId;
  autoOpenSpreadsheet?: boolean;
}

const EMERALD = '#00A884';
const ORANGE = '#F97316';

let leadSeq = 0;
const newLead = (): LeadEntry => ({
  id: `lead-${Date.now()}-${leadSeq++}`,
  name: '',
  phone: '',
  email: '',
  company: '',
  linkedin_url: '',
  instagram_url: '',
  source: '',
});

// ── Validation (same rules as the web dialog) ────────────────────────────────

function validateLead(lead: LeadEntry): Record<string, string> {
  const errors: Record<string, string> = {};

  if (lead.phone.trim()) {
    const digits = lead.phone.trim().replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      errors.phone = 'Must be 7–15 digits (e.g. +971501234567)';
    }
  }
  if (lead.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim())) {
    errors.email = 'Invalid email (e.g. name@domain.com)';
  }
  if (lead.linkedin_url.trim() && !/^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company|pub|profile)\/.+/i.test(lead.linkedin_url.trim())) {
    errors.linkedin_url = 'Must be a LinkedIn URL (linkedin.com/in/…)';
  }
  if (lead.instagram_url.trim()) {
    const ig = lead.instagram_url.trim();
    if (!/^@[\w.]{1,30}$/.test(ig) && !/^(https?:\/\/)?(www\.)?instagram\.com\/.+/i.test(ig)) {
      errors.instagram_url = 'Must be @handle or instagram.com URL';
    }
  }
  return errors;
}

function detectCommonCountryCode(leads: LeadEntry[]): string | null {
  const validPhones = leads
    .map((l) => l.phone.trim().replace(/[\s\-().]/g, ''))
    .filter((p) => /^\+[1-9]\d{6,}$/.test(p));
  if (validPhones.length === 0) return null;

  const freq: Record<string, number> = {};
  for (const p of validPhones) {
    for (const len of [2, 3, 4]) {
      const prefix = p.slice(0, len);
      if (p.length > len) freq[prefix] = (freq[prefix] || 0) + 1;
    }
  }
  const threshold = Math.max(1, Math.floor(validPhones.length * 0.4));
  for (const len of [4, 3, 2]) {
    const best = Object.entries(freq)
      .filter(([k]) => k.length === len)
      .sort(([, a], [, b]) => b - a)[0];
    if (best && best[1] >= threshold) return best[0];
  }
  const fallback = Object.entries(freq).sort(([, a], [, b]) => b - a)[0];
  return fallback ? fallback[0] : null;
}

function autoFixPhone(phone: string, countryCode: string): string {
  const cleaned = phone.trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return phone;
  if (cleaned.startsWith('+')) return cleaned;
  const codeDigits = countryCode.slice(1);
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);
  if (cleaned.startsWith(codeDigits)) return '+' + cleaned;
  if (cleaned.startsWith('0')) return countryCode + cleaned.slice(1);
  return countryCode + cleaned;
}

// ── CSV / Excel parsing (same header names as web) ───────────────────────────

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols.map((c) => c.trim());
}

const HEADER_ALIASES: Record<keyof Omit<LeadEntry, 'id'>, string[]> = {
  name: ['name', 'full name', 'fullname', 'contact name'],
  phone: ['phone', 'whatsapp', 'mobile', 'phone number'],
  email: ['email', 'email address', 'e-mail'],
  company: ['company', 'organization', 'org'],
  linkedin_url: ['linkedin', 'linkedin_url', 'linkedin url'],
  instagram_url: ['instagram', 'instagram_url', 'instagram url'],
  source: ['source'],
};

function rowsToLeads(rows: string[][], defaultSource: string): { leads: LeadEntry[]; error?: string } {
  if (rows.length < 2) {
    return { leads: [], error: 'That file has no data rows. Add contacts below the header row and re-upload.' };
  }
  const headers = rows[0].map((h) => String(h ?? '').trim().toLowerCase().replace(/['"]/g, ''));
  const idx = (field: keyof typeof HEADER_ALIASES) =>
    headers.findIndex((h) => HEADER_ALIASES[field].includes(h));

  const nameIdx = idx('name');
  if (nameIdx < 0) {
    return { leads: [], error: 'No "name" column found in the header row. Use Download Template to see the expected columns.' };
  }
  const phoneIdx = idx('phone');
  const emailIdx = idx('email');
  const companyIdx = idx('company');
  const linkedinIdx = idx('linkedin_url');
  const instagramIdx = idx('instagram_url');
  const sourceIdx = idx('source');

  const cell = (row: string[], i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '');
  const leads: LeadEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const name = cell(row, nameIdx);
    if (!name) continue;
    leads.push({
      ...newLead(),
      name,
      phone: cell(row, phoneIdx),
      email: cell(row, emailIdx),
      company: cell(row, companyIdx),
      linkedin_url: cell(row, linkedinIdx),
      instagram_url: cell(row, instagramIdx),
      source: cell(row, sourceIdx) || defaultSource,
    });
  }
  if (leads.length === 0) {
    return { leads: [], error: 'No rows with a name were found.' };
  }
  return { leads };
}

const TEMPLATE_CSV =
  'Name,Phone,Email,Company,LinkedIn,Instagram,Source\n' +
  'John Doe,+971501234567,john@example.com,Acme Inc,linkedin.com/in/john,@johndoe,manual\n' +
  'Jane Smith,+971507654321,jane@corp.com,Corp Ltd,,@janesmith,manual\n';

// ── Component ────────────────────────────────────────────────────────────────

export function ImportLeadsModal({
  visible,
  onClose,
  onImportComplete,
  initialTab = 'single',
  autoOpenSpreadsheet = false,
}: ImportLeadsModalProps) {
  const appTheme = useAppTheme();
  const dark = appTheme.darkMode;

  const [activeTab, setActiveTab] = useState<TabId>('single');
  const [leads, setLeads] = useState<LeadEntry[]>([newLead()]);
  const [groups, setGroups] = useState<BroadcastGroup[]>([]);
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportLeadsResult | { failedMessage: string } | null>(null);
  const [excelError, setExcelError] = useState('');
  const [excelParsing, setExcelParsing] = useState(false);
  const [excelAutoPickPending, setExcelAutoPickPending] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [scrapeStats, setScrapeStats] = useState<{ extracted: number } | null>(null);

  // ── Derived validation state ──
  const validationErrors = useMemo(() => {
    const result: Record<string, Record<string, string>> = {};
    for (const lead of leads) {
      const errs = validateLead(lead);
      if (Object.keys(errs).length > 0) result[lead.id] = errs;
    }
    return result;
  }, [leads]);
  const invalidCount = Object.keys(validationErrors).length;
  const validCount = leads.filter((l) => l.name.trim()).length;
  const detectedCountryCode = useMemo(() => detectCommonCountryCode(leads), [leads]);
  const phoneErrorCount = useMemo(
    () => Object.values(validationErrors).filter((e) => e.phone).length,
    [validationErrors],
  );

  // ── Load groups + reset when opened ──
  useEffect(() => {
    if (!visible) return;
    setLeads([newLead()]);
    setSelectedGroupIds(new Set());
    setGroupsExpanded(false);
    setImportResult(null);
    setActiveTab(initialTab);
    setExcelError('');
    setExcelAutoPickPending(autoOpenSpreadsheet);
    setScrapeUrl('');
    setScrapeError('');
    setScrapeStats(null);
    getBroadcastGroups()
      .then((list) => setGroups(list.filter((g) => !g.isBroadcastList)))
      .catch(() => setGroups([]));
  }, [autoOpenSpreadsheet, initialTab, visible]);

  const updateLead = useCallback((id: string, field: keyof LeadEntry, value: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }, []);

  const removeLead = useCallback((id: string) => {
    setLeads((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }, []);

  const handleAutoFixPhones = useCallback(() => {
    if (!detectedCountryCode) return;
    setLeads((prev) =>
      prev.map((l) => {
        if (!l.phone.trim()) return l;
        const fixed = autoFixPhone(l.phone, detectedCountryCode);
        return fixed !== l.phone ? { ...l, phone: fixed } : l;
      }),
    );
  }, [detectedCountryCode]);

  // ── Excel / CSV upload ──
  const handlePickSpreadsheet = useCallback(async () => {
    setExcelError('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const isCsv = /\.csv$/i.test(asset.name || '') || (asset.mimeType || '').includes('csv');

      setExcelParsing(true);
      let rows: string[][];
      if (isCsv) {
        const text = Platform.OS === 'web'
          ? await (await fetch(asset.uri)).text()
          : await (await import('expo-file-system/legacy')).readAsStringAsync(asset.uri);
        rows = text.split('\n').filter((l) => l.trim()).map(parseCSVLine);
      } else {
        let workbook: XLSX.WorkBook;
        if (Platform.OS === 'web') {
          const buffer = await (await fetch(asset.uri)).arrayBuffer();
          workbook = XLSX.read(buffer, { type: 'array' });
        } else {
          const FileSystem = await import('expo-file-system/legacy');
          const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as never });
          workbook = XLSX.read(b64, { type: 'base64' });
        }
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) {
          setExcelError('Could not read that file. Make sure it is a valid .xlsx export.');
          return;
        }
        rows = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][])
          .map((row) => row.map((v) => String(v ?? '')));
      }

      const parsed = rowsToLeads(rows, isCsv ? 'csv_import' : 'excel_import');
      if (parsed.error) {
        setExcelError(parsed.error);
        return;
      }
      setLeads(parsed.leads);
      setImportResult(null);
      setActiveTab('single'); // jump to review list, same as web
    } catch {
      setExcelError('Could not read that file. Make sure it is a valid .xlsx or .csv export.');
    } finally {
      setExcelParsing(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || !autoOpenSpreadsheet || !excelAutoPickPending || activeTab !== 'excel') {
      return undefined;
    }

    const timer = setTimeout(() => {
      setExcelAutoPickPending(false);
      void handlePickSpreadsheet();
    }, 180);

    return () => clearTimeout(timer);
  }, [activeTab, autoOpenSpreadsheet, excelAutoPickPending, handlePickSpreadsheet, visible]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leads_template.csv';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const FileSystem = await import('expo-file-system/legacy');
        const path = `${FileSystem.cacheDirectory}leads_template.csv`;
        await FileSystem.writeAsStringAsync(path, TEMPLATE_CSV);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Leads template' });
        }
      }
    } catch {
      // non-critical
    }
  }, []);

  // ── URL scrape ──
  const handleScrape = useCallback(async () => {
    const url = scrapeUrl.trim();
    if (!url) {
      setScrapeError('Please enter a URL');
      return;
    }
    if (!/^https?:\/\/.+/i.test(url)) {
      setScrapeError('URL must start with http:// or https://');
      return;
    }
    setScraping(true);
    setScrapeError('');
    setScrapeStats(null);
    try {
      const { leads: extracted } = await scrapeLeadsFromUrl(url);
      if (extracted.length === 0) {
        setScrapeError('No contacts found on that page. Try a URL with a member or team list.');
        return;
      }
      setLeads(extracted.map((c) => ({ ...newLead(), ...c })));
      setScrapeStats({ extracted: extracted.length });
      setImportResult(null);
      setActiveTab('single'); // review before importing, same as web
    } catch (err) {
      setScrapeError(err instanceof Error && err.message ? err.message : 'Network error');
    } finally {
      setScraping(false);
    }
  }, [scrapeUrl]);

  // ── Import ──
  const handleImport = useCallback(async () => {
    const validLeads = leads.filter((l) => l.name.trim());
    if (validLeads.length === 0 || invalidCount > 0 || importing) return;

    setImporting(true);
    setImportResult(null);
    try {
      const result = await importLeads(
        validLeads.map((l) => ({
          name: l.name.trim(),
          phone: l.phone.trim() || null,
          email: l.email.trim() || null,
          company: l.company.trim() || null,
          linkedin_url: l.linkedin_url.trim() || null,
          instagram_url: l.instagram_url.trim() || null,
          source: l.source.trim() || null,
        })),
        Array.from(selectedGroupIds),
      );
      setImportResult(result);
      onImportComplete();
    } catch (err) {
      setImportResult({ failedMessage: err instanceof Error && err.message ? err.message : 'Import failed. Please try again.' });
    } finally {
      setImporting(false);
    }
  }, [importing, invalidCount, leads, onImportComplete, selectedGroupIds]);

  const resetForAnotherImport = useCallback(() => {
    setLeads([newLead()]);
    setSelectedGroupIds(new Set());
    setImportResult(null);
    setActiveTab('single');
  }, []);

  // ── Shared styles ──
  const inputStyle = {
    backgroundColor: appTheme.input,
    borderWidth: 1,
    borderColor: appTheme.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: appTheme.text,
    fontSize: 13,
    flex: 1,
  } as const;
  const webInputReset = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null;

  const renderField = (
    lead: LeadEntry,
    field: keyof LeadEntry,
    placeholder: string,
    icon: React.ReactNode,
    options?: { keyboardType?: 'phone-pad' | 'email-address'; autoCapitalize?: 'none' | 'words' },
  ) => {
    const error = validationErrors[lead.id]?.[field];
    return (
      <View style={{ width: '48.5%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon}
          <TextInput
            placeholder={placeholder}
            placeholderTextColor={appTheme.disabled}
            value={lead[field]}
            onChangeText={(value) => updateLead(lead.id, field, value)}
            keyboardType={options?.keyboardType}
            autoCapitalize={options?.autoCapitalize ?? 'none'}
            style={[inputStyle, webInputReset, error ? { borderColor: Theme.colors.error } : null]}
          />
        </View>
        {error ? (
          <Typography variant="caption" color={Theme.colors.error} style={{ marginTop: 3, fontSize: 10 }}>
            {error}
          </Typography>
        ) : null}
      </View>
    );
  };

  // ── Result screen ──
  const renderResult = () => {
    if (!importResult) return null;
    if ('failedMessage' in importResult) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 12 }}>
          <View style={[styles.resultBadge, { backgroundColor: appTheme.errorSoft }]}>
            <AlertCircle color={Theme.colors.error} size={30} />
          </View>
          <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '700' }}>Import failed</Typography>
          <Typography variant="bodySmall" color={appTheme.muted} style={{ textAlign: 'center' }}>
            {importResult.failedMessage}
          </Typography>
          <TouchableOpacity style={[styles.primaryButton, { marginTop: 8 }]} onPress={() => setImportResult(null)} activeOpacity={0.85}>
            <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>Back to leads</Typography>
          </TouchableOpacity>
        </View>
      );
    }

    const issues = [
      ...importResult.duplicates.map((d) => ({ label: d.name, detail: d.reason, kind: 'Duplicate' })),
      ...importResult.skipped.map((s) => ({ label: s.name, detail: s.reason, kind: 'Skipped' })),
      ...importResult.errors.map((e) => ({ label: e.name, detail: e.error, kind: 'Error' })),
    ];

    return (
      <ScrollView contentContainerStyle={{ paddingVertical: 28, paddingHorizontal: 24, gap: 14, alignItems: 'center' }}>
        <View style={[styles.resultBadge, { backgroundColor: appTheme.successSoft }]}>
          <Check color={EMERALD} size={32} strokeWidth={3} />
        </View>
        <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '800' }}>
          Imported {importResult.imported} of {importResult.total}
        </Typography>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.statCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}>
            <Typography variant="h3" color={EMERALD} style={{ fontWeight: '800' }}>{importResult.imported}</Typography>
            <Typography variant="caption" color={appTheme.muted}>Leads saved</Typography>
          </View>
          <View style={[styles.statCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '800' }}>{importResult.conversationsCreated}</Typography>
            <Typography variant="caption" color={appTheme.muted}>Chats created</Typography>
          </View>
        </View>

        {issues.length > 0 && (
          <View style={{ width: '100%', gap: 6, marginTop: 6 }}>
            <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '700', letterSpacing: 0.4 }}>
              NOT IMPORTED ({issues.length})
            </Typography>
            {issues.slice(0, 8).map((issue, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <AlertCircle color={issue.kind === 'Error' ? Theme.colors.error : '#F59E0B'} size={14} style={{ marginTop: 2 }} />
                <Typography variant="caption" color={appTheme.muted} style={{ flex: 1 }}>
                  <Typography variant="caption" color={appTheme.text} style={{ fontWeight: '600' }}>{issue.label}</Typography>
                  {`  ·  ${issue.detail}`}
                </Typography>
              </View>
            ))}
            {issues.length > 8 && (
              <Typography variant="caption" color={appTheme.disabled}>+{issues.length - 8} more</Typography>
            )}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: appTheme.border }]}
            onPress={resetForAnotherImport}
            activeOpacity={0.8}
          >
            <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '600' }}>Import more</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={onClose} activeOpacity={0.85}>
            <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>Done</Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ color: string; size: number }> }[] = [
    { id: 'single', label: 'Add Leads', icon: UserPlus },
    { id: 'excel', label: 'Import File', icon: FileSpreadsheet },
    { id: 'url', label: 'Scrape from URL', icon: Globe },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
      >
        <View style={[styles.sheet, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}>
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: appTheme.borderSoft }]}>
            <View style={[styles.headerBadge, { backgroundColor: dark ? 'rgba(249,115,22,0.16)' : '#FFF7ED', borderColor: dark ? 'rgba(249,115,22,0.35)' : '#FFEDD5' }]}>
              <UserPlus color={ORANGE} size={20} strokeWidth={2.5} />
            </View>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '800', flex: 1 }}>Import Leads</Typography>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
              <X color={appTheme.muted} size={22} />
            </TouchableOpacity>
          </View>

          {importResult ? (
            renderResult()
          ) : (
            <>
              {/* Tabs */}
              <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
                <View style={[styles.tabsTrack, { backgroundColor: dark ? 'rgba(59,130,246,0.14)' : '#EFF6FF', borderColor: dark ? 'rgba(59,130,246,0.35)' : '#BFDBFE' }]}>
                  {tabs.map(({ id, label, icon: Icon }) => {
                    const active = activeTab === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={() => setActiveTab(id)}
                        style={[styles.tabPill, active && { backgroundColor: dark ? '#0B1220' : '#FFFFFF', borderColor: '#3B82F6', borderWidth: 1, ...Theme.shadows.small }]}
                        activeOpacity={0.8}
                      >
                        <Icon color={active ? '#3B82F6' : dark ? '#93C5FD' : '#60A5FA'} size={13} />
                        <Typography
                          variant="caption"
                          color={active ? '#3B82F6' : dark ? '#93C5FD' : '#60A5FA'}
                          style={{ fontWeight: active ? '800' : '600', fontSize: 11 }}
                          numberOfLines={1}
                        >
                          {label}
                        </Typography>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Add Leads tab ── */}
              {activeTab === 'single' && (
                <>
                  <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
                    {/* Auto-fix phones banner */}
                    {detectedCountryCode && phoneErrorCount > 0 && (
                      <TouchableOpacity
                        onPress={handleAutoFixPhones}
                        activeOpacity={0.8}
                        style={[styles.fixBanner, { backgroundColor: dark ? 'rgba(245,158,11,0.14)' : '#FFFBEB', borderColor: dark ? 'rgba(245,158,11,0.4)' : '#FDE68A' }]}
                      >
                        <Sparkles color="#F59E0B" size={15} />
                        <Typography variant="caption" color={dark ? '#FCD34D' : '#B45309'} style={{ flex: 1, fontWeight: '600' }}>
                          Fix {phoneErrorCount} phone number{phoneErrorCount === 1 ? '' : 's'} using {detectedCountryCode}
                        </Typography>
                        <ChevronRight color="#F59E0B" size={14} />
                      </TouchableOpacity>
                    )}

                    {scrapeStats && (
                      <View style={[styles.fixBanner, { backgroundColor: appTheme.successSoft, borderColor: 'rgba(16,185,129,0.35)' }]}>
                        <Check color={EMERALD} size={15} />
                        <Typography variant="caption" color={dark ? '#6EE7B7' : '#047857'} style={{ flex: 1, fontWeight: '600' }}>
                          {scrapeStats.extracted} contact{scrapeStats.extracted === 1 ? '' : 's'} extracted — review and import below
                        </Typography>
                      </View>
                    )}

                    {leads.map((lead, index) => {
                      const hasErrors = !!validationErrors[lead.id];
                      return (
                        <View
                          key={lead.id}
                          style={[
                            styles.leadCard,
                            {
                              backgroundColor: dark ? 'rgba(30,41,59,0.55)' : '#F8FAFC',
                              borderColor: hasErrors ? Theme.colors.error : dark ? 'rgba(59,130,246,0.35)' : '#DBEAFE',
                            },
                          ]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                            <Typography variant="overline" color={dark ? '#93C5FD' : '#2563EB'} style={{ flex: 1, fontWeight: '800' }}>
                              Lead #{index + 1}
                            </Typography>
                            {leads.length > 1 && (
                              <TouchableOpacity onPress={() => removeLead(lead.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Trash2 color={Theme.colors.error} size={15} />
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
                            {renderField(lead, 'name', 'Full name *', <UserPlus color={appTheme.muted} size={14} />, { autoCapitalize: 'words' })}
                            {renderField(lead, 'company', 'Company', <Building2 color={appTheme.muted} size={14} />, { autoCapitalize: 'words' })}
                            {renderField(lead, 'phone', '+971501234567', <Phone color={EMERALD} size={14} />, { keyboardType: 'phone-pad' })}
                            {renderField(lead, 'email', 'Email', <Mail color={ORANGE} size={14} />, { keyboardType: 'email-address' })}
                            {renderField(lead, 'linkedin_url', 'linkedin.com/in/…', <Link2 color="#0A66C2" size={14} />)}
                            {renderField(lead, 'instagram_url', '@handle or instagram…', <AtSign color="#E1306C" size={14} />)}
                          </View>
                        </View>
                      );
                    })}

                    <TouchableOpacity
                      onPress={() => setLeads((prev) => [...prev, newLead()])}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 }}
                      activeOpacity={0.7}
                    >
                      <Plus color="#3B82F6" size={15} />
                      <Typography variant="bodySmall" color="#3B82F6" style={{ fontWeight: '700' }}>Add Another Lead</Typography>
                    </TouchableOpacity>

                    {/* Optional group assignment */}
                    {groups.length > 0 && (
                      <View style={[styles.groupsBox, { borderColor: appTheme.borderSoft }]}>
                        <TouchableOpacity
                          onPress={() => setGroupsExpanded((v) => !v)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                          activeOpacity={0.7}
                        >
                          {groupsExpanded ? <ChevronDown color={appTheme.muted} size={15} /> : <ChevronRight color={appTheme.muted} size={15} />}
                          <Users color={appTheme.muted} size={15} />
                          <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '600', flex: 1 }}>
                            Add to broadcast groups (optional)
                          </Typography>
                          {selectedGroupIds.size > 0 && (
                            <View style={{ backgroundColor: appTheme.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Typography variant="caption" color={EMERALD} style={{ fontWeight: '700' }}>{selectedGroupIds.size}</Typography>
                            </View>
                          )}
                        </TouchableOpacity>
                        {groupsExpanded && groups.map((group) => {
                          const checked = selectedGroupIds.has(group.id);
                          return (
                            <TouchableOpacity
                              key={group.id}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 }}
                              activeOpacity={0.7}
                              onPress={() => {
                                setSelectedGroupIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(group.id)) next.delete(group.id);
                                  else next.add(group.id);
                                  return next;
                                });
                              }}
                            >
                              {checked ? <CheckSquare color={EMERALD} size={18} /> : <Square color={appTheme.muted} size={18} />}
                              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: group.color || EMERALD, alignItems: 'center', justifyContent: 'center' }}>
                                <Users color="#FFF" size={12} />
                              </View>
                              <Typography variant="bodySmall" color={appTheme.text} style={{ flex: 1 }} numberOfLines={1}>{group.name}</Typography>
                              <Typography variant="caption" color={appTheme.muted}>{group.memberCount}</Typography>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </ScrollView>

                  {/* Footer */}
                  <View style={[styles.footer, { borderTopColor: appTheme.borderSoft }]}>
                    <View style={{ flex: 1 }}>
                      <Typography variant="bodySmall" color={appTheme.muted}>
                        {validCount} lead{validCount === 1 ? '' : 's'} ready to import
                      </Typography>
                      {invalidCount > 0 && (
                        <Typography variant="caption" color={Theme.colors.error} style={{ marginTop: 1 }}>
                          {invalidCount} lead{invalidCount === 1 ? ' has' : 's have'} errors — fix the highlighted fields
                        </Typography>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.primaryButton, (validCount === 0 || invalidCount > 0 || importing) && { opacity: 0.45 }]}
                      disabled={validCount === 0 || invalidCount > 0 || importing}
                      onPress={() => void handleImport()}
                      activeOpacity={0.85}
                    >
                      {importing ? <ActivityIndicator color="#FFF" size="small" /> : <UserPlus color="#FFF" size={15} />}
                      <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>
                        {importing ? 'Importing…' : `Import ${validCount} Lead${validCount === 1 ? '' : 's'}`}
                      </Typography>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── Excel Upload tab ── */}
              {activeTab === 'excel' && (
                <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
                  <View
                    style={[styles.dropzone, { borderColor: dark ? 'rgba(148,163,184,0.4)' : '#CBD5E1', backgroundColor: dark ? 'rgba(30,41,59,0.4)' : '#F8FAFC' }]}
                  >
                    {excelParsing
                      ? <ActivityIndicator color={EMERALD} size="large" />
                      : <Upload color={appTheme.muted} size={34} strokeWidth={1.6} />}
                    <Typography variant="body" color={appTheme.text} style={{ fontWeight: '700', marginTop: 10 }}>
                      Upload Excel or CSV file
                    </Typography>
                    <Typography variant="caption" color={appTheme.muted} style={{ textAlign: 'center', marginTop: 4, lineHeight: 17 }}>
                      Required column: <Typography variant="caption" color={appTheme.text} style={{ fontWeight: '700' }}>name</Typography>
                      {'\n'}Optional: phone, email, company, linkedin, instagram, source
                    </Typography>
                    <TouchableOpacity
                      onPress={() => void handlePickSpreadsheet()}
                      activeOpacity={0.85}
                      disabled={excelParsing}
                      style={[styles.chooseFileButton, { backgroundColor: EMERALD }, excelParsing && { opacity: 0.6 }]}
                    >
                      <FileSpreadsheet color="#FFF" size={15} />
                      <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>Choose File</Typography>
                    </TouchableOpacity>
                  </View>

                  {excelError ? (
                    <View style={[styles.fixBanner, { backgroundColor: appTheme.errorSoft, borderColor: 'rgba(239,68,68,0.4)' }]}>
                      <AlertCircle color={Theme.colors.error} size={15} />
                      <Typography variant="caption" color={dark ? '#FCA5A5' : '#B91C1C'} style={{ flex: 1 }}>{excelError}</Typography>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => void handleDownloadTemplate()}
                    style={[styles.secondaryButton, { borderColor: appTheme.border, alignSelf: 'center', flexDirection: 'row', gap: 6 }]}
                    activeOpacity={0.8}
                  >
                    <Download color={appTheme.text} size={14} />
                    <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '600' }}>Download Template</Typography>
                  </TouchableOpacity>

                  <Typography variant="caption" color={appTheme.disabled} style={{ textAlign: 'center' }}>
                    Parsed contacts appear in the Add Leads tab for review before importing.
                  </Typography>
                </ScrollView>
              )}

              {/* ── Scrape from URL tab ── */}
              {activeTab === 'url' && (
                <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
                  <View style={[styles.dropzone, { borderColor: dark ? 'rgba(148,163,184,0.4)' : '#CBD5E1', backgroundColor: dark ? 'rgba(30,41,59,0.4)' : '#F8FAFC', paddingVertical: 22 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Globe color="#3B82F6" size={18} />
                      <Typography variant="body" color={appTheme.text} style={{ fontWeight: '700' }}>Scrape contacts from a webpage</Typography>
                    </View>
                    <Typography variant="caption" color={appTheme.muted} style={{ textAlign: 'center', marginTop: 6, lineHeight: 17 }}>
                      Paste a page with a team, member or contact list. AI extracts names,
                      phones, emails and socials for review before anything is saved.
                    </Typography>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, width: '100%' }}>
                      <TextInput
                        placeholder="https://example.com/our-team"
                        placeholderTextColor={appTheme.disabled}
                        value={scrapeUrl}
                        onChangeText={setScrapeUrl}
                        autoCapitalize="none"
                        keyboardType="url"
                        editable={!scraping}
                        style={[inputStyle, webInputReset]}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() => void handleScrape()}
                      disabled={scraping}
                      activeOpacity={0.85}
                      style={[styles.primaryButton, { marginTop: 12, backgroundColor: '#3B82F6' }, scraping && { opacity: 0.6 }]}
                    >
                      {scraping ? <ActivityIndicator color="#FFF" size="small" /> : <Sparkles color="#FFF" size={15} />}
                      <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>
                        {scraping ? 'Scraping… this can take a minute' : 'Scrape Contacts'}
                      </Typography>
                    </TouchableOpacity>
                  </View>

                  {scrapeError ? (
                    <View style={[styles.fixBanner, { backgroundColor: appTheme.errorSoft, borderColor: 'rgba(239,68,68,0.4)' }]}>
                      <AlertCircle color={Theme.colors.error} size={15} />
                      <Typography variant="caption" color={dark ? '#FCA5A5' : '#B91C1C'} style={{ flex: 1 }}>{scrapeError}</Typography>
                    </View>
                  ) : null}

                  <Typography variant="caption" color={appTheme.disabled} style={{ textAlign: 'center' }}>
                    Works best on public pages with visible contact details.
                  </Typography>
                </ScrollView>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsTrack: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  leadCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  fixBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  groupsBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  primaryButton: {
    backgroundColor: EMERALD,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  chooseFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 14,
  },
  resultBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    minWidth: 110,
  },
});
