import re

with open(r'c:\Users\patta\LAD-App\app\(tabs)\crm.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ProspectBoard
# match {filtersOpen && ( ... )} up to the next {
pattern_board = re.compile(r'\{\s*filtersOpen\s*&&\s*\(\s*<View[^>]*>\s*<FilterSections[^>]*view="board"[^>]*/>.*?</View>\s*\)\s*\}\s*\{\s*!filtersOpen\s*&&\s*activeCount\s*>\s*0\s*&&\s*\(', re.DOTALL)

replacement_board = """<FiltersModal
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          stageOpts={stageOpts}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          channelFilter={channelFilter}
          setChannelFilter={setChannelFilter}
          ownerFilter={ownerFilter}
          setOwnerFilter={setOwnerFilter}
          ownerOptions={ownerOptions}
          palette={palette}
          showType
          showStage
          showChannel
        />

        {activeCount > 0 && ("""

content, count_board = pattern_board.subn(replacement_board, content)
print(f"Replaced {count_board} ProspectBoard filters")

# ContactList
pattern_list = re.compile(r'\{\s*filtersOpen\s*&&\s*\(\s*<View[^>]*>\s*<FilterSections[^>]*view=\{view\}[^>]*/>.*?</View>\s*\)\s*\}\s*\{\s*!filtersOpen\s*&&\s*activeCount\s*>\s*0\s*&&\s*\(', re.DOTALL)

replacement_list = """<FiltersModal
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          stageOpts={stageOpts}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          channelFilter={channelFilter}
          setChannelFilter={setChannelFilter}
          ownerFilter={ownerFilter}
          setOwnerFilter={setOwnerFilter}
          ownerOptions={ownerOptions}
          palette={palette}
          showType={showType}
          showStage={showStage}
          showChannel={showChannel}
        />

        {activeCount > 0 && ("""

content, count_list = pattern_list.subn(replacement_list, content)
print(f"Replaced {count_list} ContactList filters")

with open(r'c:\Users\patta\LAD-App\app\(tabs)\crm.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
