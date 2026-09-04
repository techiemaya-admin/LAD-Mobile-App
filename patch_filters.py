import re

with open(r'c:\Users\patta\LAD-App\app\(tabs)\crm.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_filter_sections_start = content.find('function FilterSections(')
old_filter_section_end = content.find('function ActiveFilterBar(')

if old_filter_sections_start != -1 and old_filter_section_end != -1:
    new_filters_modal = """function FiltersModal({
  visible,
  onClose,
  stageOpts,
  stageFilter,
  setStageFilter,
  typeFilter,
  setTypeFilter,
  channelFilter,
  setChannelFilter,
  ownerFilter,
  setOwnerFilter,
  ownerOptions,
  palette,
  showType,
  showStage = true,
  showChannel = true,
}: {
  visible: boolean;
  onClose: () => void;
  stageOpts: FilterOption[];
  stageFilter: string;
  setStageFilter: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  channelFilter: string;
  setChannelFilter: (value: string) => void;
  ownerFilter: string;
  setOwnerFilter: (value: string) => void;
  ownerOptions: FilterOption[];
  palette: ReturnType<typeof useCrmPalette>;
  showType: boolean;
  showStage?: boolean;
  showChannel?: boolean;
}) {
  const activeCount = (showStage && stageFilter !== 'all' ? 1 : 0) + (showType && typeFilter !== 'all' ? 1 : 0) + (showChannel && channelFilter !== 'all' ? 1 : 0) + (ownerFilter !== 'all' ? 1 : 0);

  const clearAll = () => {
    setStageFilter('all');
    setTypeFilter('all');
    setChannelFilter('all');
    setOwnerFilter('all');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.detailSheet, { backgroundColor: palette.surface, borderColor: palette.border, maxHeight: '85%' }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.borderSoft, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <Typography variant="h3" color={palette.primaryText} style={{ fontWeight: '700' }}>Filters</Typography>
            <TouchableOpacity onPress={onClose} activeOpacity={0.76} style={[styles.closeButton, { backgroundColor: palette.softSurface }]}>
              <X color={palette.primaryText} size={20} />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100, gap: 28 }} showsVerticalScrollIndicator={false}>
            {showStage ? (
              <FilterSection label="STAGE" options={stageOpts} activeKey={stageFilter} onChange={setStageFilter} palette={palette} />
            ) : null}
            {showType ? (
              <FilterSection label="TYPE" options={TYPE_FILTER_OPTS} activeKey={typeFilter} onChange={setTypeFilter} palette={palette} />
            ) : null}
            {showChannel ? (
              <FilterSection label="CHANNEL" options={CHANNEL_FILTER_OPTS} activeKey={channelFilter} onChange={setChannelFilter} palette={palette} />
            ) : null}
            <FilterSection label="OWNER" options={ownerOptions} activeKey={ownerFilter} onChange={setOwnerFilter} palette={palette} />
          </ScrollView>
          
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: 36, borderTopWidth: 1, borderTopColor: palette.borderSoft, backgroundColor: palette.surface, flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={clearAll} activeOpacity={0.8} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body" color={palette.primaryText} style={{ fontWeight: '600' }}>Clear ({activeCount})</Typography>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body" color="#fff" style={{ fontWeight: '600' }}>Apply</Typography>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterSection({
  label,
  options,
  activeKey,
  onChange,
  palette,
}: {
  label: string;
  options: FilterOption[];
  activeKey: string;
  onChange: (value: string) => void;
  palette: ReturnType<typeof useCrmPalette>;
}) {
  return (
    <View style={{ gap: 14 }}>
      <Typography variant="caption" color={palette.muted} style={{ fontWeight: '700', letterSpacing: 0.5 }}>{label}</Typography>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {options.map((opt) => (
          <FilterChip key={opt.key} label={opt.label} active={activeKey === opt.key} onPress={() => onChange(opt.key)} />
        ))}
      </View>
    </View>
  );
}

"""
    content = content[:old_filter_sections_start] + new_filters_modal + content[old_filter_section_end:]
    
    with open(r'c:\Users\patta\LAD-App\app\(tabs)\crm.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Component injected")
else:
    print("Could not find bounds")
