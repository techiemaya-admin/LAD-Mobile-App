/**
 * WorkflowCanvas — n8n-style campaign workflow builder, mobile port of
 * LAD-Frontend-2's WorkflowPreviewPanel (ReactFlow canvas).
 *
 * Faithful to the web version:
 *  • Start → one node per step → End, laid out as a horizontal "snake"
 *    (boustrophedon) so long pipelines stay compact on a portrait screen.
 *  • Circular brand-colored nodes with a glossy highlight, platform mini-badge,
 *    title + subtext, and dashed animated-style connector edges with arrowheads
 *    over a dotted grid background.
 *  • Header with step pills, branch count, and the Event-Driven badge.
 *  • "Add Step" toolbox: pick a platform (LinkedIn / Email / WhatsApp / Voice)
 *    then an action, appended to the sequence. Tap a node to delete it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  GitBranch,
  Mail,
  Maximize2,
  MessageCircle,
  Minus,
  Pencil,
  Phone,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  Workflow,
  X,
  Zap,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';
import {
  WORKFLOW_PLATFORMS,
  WORKFLOW_PLATFORM_ACTIONS,
  WorkflowStepDef,
} from '@/src/services/mobileAIAssistantService';

const NODE_SIZE = 66;
const NODE_SIZE_SMALL = 50;
const CELL_HEIGHT = 148;
const LABEL_WIDTH = 108;
const EDGE_COLOR = '#C4C9D4';
const AnimatedLine = Animated.createAnimatedComponent(Line as any);

interface SeqNode {
  id: string;
  type: string;
  title: string;
  description?: string;
}

const brandConfig = (type: string) => {
  if (type === 'start') return { bg: '#22C55E', glow: 'rgba(34,197,94,0.35)' };
  if (type === 'end') return { bg: '#EF4444', glow: 'rgba(239,68,68,0.35)' };
  if (type === 'lead_generation') return { bg: '#F59E0B', glow: 'rgba(245,158,11,0.35)' };
  if (type === 'linkedin_connect') return { bg: '#3B82F6', glow: 'rgba(59,130,246,0.35)' };
  if (type === 'linkedin_message') return { bg: '#8B5CF6', glow: 'rgba(139,92,246,0.35)' };
  if (type === 'linkedin_visit') return { bg: '#0EA5E9', glow: 'rgba(14,165,233,0.35)' };
  if (type.includes('linkedin')) return { bg: '#0A66C2', glow: 'rgba(10,102,194,0.35)' };
  if (type.includes('email')) return { bg: '#EA4335', glow: 'rgba(234,67,53,0.35)' };
  if (type.includes('whatsapp')) return { bg: '#25D366', glow: 'rgba(37,211,102,0.35)' };
  if (type.includes('voice')) return { bg: '#8B5CF6', glow: 'rgba(139,92,246,0.35)' };
  if (type === 'delay') return { bg: '#6B7280', glow: 'rgba(107,114,128,0.35)' };
  return { bg: '#6366F1', glow: 'rgba(99,102,241,0.35)' };
};

const pillColor = (type: string) => {
  if (type.includes('linkedin') || type === 'lead_generation') return '#0A66C2';
  if (type.includes('email')) return '#EA4335';
  if (type.includes('whatsapp')) return '#25D366';
  if (type.includes('voice')) return '#8B5CF6';
  if (type === 'delay') return '#6B7280';
  return '#6366F1';
};

const LinkedInGlyph = ({ size = 11, color = '#0A66C2' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill={color}
      d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
    />
  </Svg>
);

const NodeIcon = ({ type, size }: { type: string; size: number }) => {
  const props = { color: '#FFFFFF', size };
  if (type === 'start') return <Play {...props} />;
  if (type === 'end') return <Flag {...props} />;
  if (type === 'lead_generation') return <Search {...props} />;
  if (type === 'linkedin_visit') return <Eye {...props} />;
  if (type === 'linkedin_connect') return <UserPlus {...props} />;
  if (type === 'linkedin_message') return <Send {...props} />;
  if (type.includes('email')) return <Mail {...props} />;
  if (type.includes('whatsapp')) return <MessageCircle {...props} />;
  if (type.includes('voice')) return <Phone {...props} />;
  if (type === 'delay') return <Clock {...props} />;
  return <Zap {...props} />;
};

const PlatformBadge = ({ type }: { type: string }) => {
  let icon: React.ReactNode = null;
  if (type.includes('linkedin') || type === 'lead_generation') icon = <LinkedInGlyph size={11} />;
  else if (type.includes('email')) icon = <Mail color="#EA4335" size={11} />;
  else if (type.includes('whatsapp')) icon = <MessageCircle color="#25D366" size={11} />;
  else if (type.includes('voice')) icon = <Phone color="#8B5CF6" size={11} />;
  if (!icon) return null;
  return <View style={styles.platformBadge}>{icon}</View>;
};

const PlatformPickerIcon = ({ id, color }: { id: string; color: string }) => {
  if (id === 'linkedin') return <LinkedInGlyph size={16} color={color} />;
  if (id === 'email') return <Mail color={color} size={16} />;
  if (id === 'whatsapp') return <MessageCircle color={color} size={16} />;
  return <Phone color={color} size={16} />;
};

interface WorkflowCanvasProps {
  steps: WorkflowStepDef[];
  onAddStep: (platformId: string, action: { type: string; title: string; desc: string }) => void;
  onRemoveStep: (id: string) => void;
  onEditStep: (id: string, patch: Partial<WorkflowStepDef>) => void;
}

export function WorkflowCanvas({ steps, onAddStep, onRemoveStep, onEditStep }: WorkflowCanvasProps) {
  const appTheme = useAppTheme();
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerState, setPickerState] = useState<'closed' | 'platform' | 'action'>('closed');
  const [pickedPlatform, setPickedPlatform] = useState<(typeof WORKFLOW_PLATFORMS)[number] | null>(null);
  // Live drag positions, keyed by node id — Start/End stay fixed. Kept in
  // plain React state (not reanimated) so the SVG edges, which read these
  // same values every render, always stay in sync with the dragged node.
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const dragOrigin = useRef<Record<string, { x: number; y: number }>>({});
  const [zoom, setZoom] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const canvasOffsetRef = useRef(canvasOffset);
  const canvasPanOrigin = useRef(canvasOffset);
  const dashOffset = useRef(new Animated.Value(0)).current;
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  useEffect(() => {
    canvasOffsetRef.current = canvasOffset;
  }, [canvasOffset]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(dashOffset, {
        toValue: -24,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [dashOffset]);

  const hasWorkflow = steps.length > 0;
  const branchCount = hasWorkflow
    ? (steps.some((step) => step.type === 'linkedin_connect') ? 3 : 0)
      + (steps.some((step) => step.type === 'lead_generation') ? 2 : 0)
    : 0;

  // Snake layout — same math as the web's workflowFlowBuilder (adaptive columns
  // so the flow stays roughly square, even rows run L→R, odd rows R→L).
  const sequence: SeqNode[] = useMemo(() => ([
    { id: 'start', type: 'start', title: 'Start', description: 'Campaign begins' },
    ...steps.map((step) => ({ id: step.id, type: step.type, title: step.title, description: step.description })),
    { id: 'end', type: 'end', title: 'End', description: '' },
  ]), [steps]);

  const canvasWidth = Math.max(measuredWidth || width - Theme.spacing.md * 2 - 2, 280);
  const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(sequence.length))));
  const cellWidth = canvasWidth / cols;
  const rows = Math.ceil(sequence.length / cols);
  const canvasHeight = rows * CELL_HEIGHT + 24;

  const cellFor = (index: number) => {
    const row = Math.floor(index / cols);
    const posInRow = index % cols;
    const col = row % 2 === 0 ? posInRow : cols - 1 - posInRow;
    return { row, col };
  };

  const centerFor = (index: number) => {
    const { row, col } = cellFor(index);
    return {
      x: cellWidth * (col + 0.5),
      y: row * CELL_HEIGHT + NODE_SIZE / 2 + 20,
      row,
      col,
    };
  };

  /** A node's live (possibly dragged) position, falling back to its snake-grid slot. */
  const resolvedCenterFor = (index: number, id: string) => {
    const base = centerFor(index);
    const dragged = dragPositions[id];
    return dragged ? { ...base, x: dragged.x, y: dragged.y } : base;
  };

  const panResponderFor = (id: string, index: number) => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => {
      dragOrigin.current[id] = dragPositions[id] || centerFor(index);
    },
    onPanResponderMove: (_event, gesture) => {
      const origin = dragOrigin.current[id];
      if (!origin) return;
      setDragPositions((prev) => ({ ...prev, [id]: { x: origin.x + gesture.dx, y: origin.y + gesture.dy } }));
    },
  });

  const canvasPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => {
      canvasPanOrigin.current = canvasOffsetRef.current;
    },
    onPanResponderMove: (_event, gesture) => {
      const origin = canvasPanOrigin.current;
      setCanvasOffset({ x: origin.x + gesture.dx, y: origin.y + gesture.dy });
    },
  })).current;

  const resetCanvasView = () => {
    setZoom(1);
    setCanvasOffset({ x: 0, y: 0 });
  };
  const canvasControlColor = appTheme.darkMode ? '#E2E8F0' : '#0F172A';

  const gridDots = useMemo(() => {
    const dots: { x: number; y: number }[] = [];
    for (let x = 14; x < canvasWidth; x += 28) {
      for (let y = 14; y < canvasHeight; y += 28) {
        dots.push({ x, y });
      }
    }
    return dots;
  }, [canvasWidth, canvasHeight]);

  const renderEdges = () => {
    const shapes: React.ReactNode[] = [];
    for (let index = 0; index < sequence.length - 1; index++) {
      const from = resolvedCenterFor(index, sequence[index].id);
      const to = resolvedCenterFor(index + 1, sequence[index + 1].id);
      const fromRadius = (sequence[index].type === 'start' || sequence[index].type === 'end' ? NODE_SIZE_SMALL : NODE_SIZE) / 2;
      const toRadius = (sequence[index + 1].type === 'start' || sequence[index + 1].type === 'end' ? NODE_SIZE_SMALL : NODE_SIZE) / 2;

      let x1: number; let y1: number; let x2: number; let y2: number;
      if (from.row !== to.row) {
        // Row turn — drop straight down.
        x1 = from.x; y1 = from.y + fromRadius + 26; // clear the label under the node
        x2 = to.x; y2 = to.y - toRadius - 4;
      } else if (from.x < to.x) {
        x1 = from.x + fromRadius + 3; y1 = from.y;
        x2 = to.x - toRadius - 6; y2 = to.y;
      } else {
        x1 = from.x - fromRadius - 3; y1 = from.y;
        x2 = to.x + toRadius + 6; y2 = to.y;
      }

      const angle = Math.atan2(y2 - y1, x2 - x1);
      const arrow = 6;
      const ax = x2; const ay = y2;
      const p1 = `${ax - arrow * Math.cos(angle - 0.45)},${ay - arrow * Math.sin(angle - 0.45)}`;
      const p2 = `${ax},${ay}`;
      const p3 = `${ax - arrow * Math.cos(angle + 0.45)},${ay - arrow * Math.sin(angle + 0.45)}`;

      shapes.push(
        <AnimatedLine
          key={`edge-${index}`}
          x1={x1}
          y1={y1}
          x2={x2 - 4 * Math.cos(angle)}
          y2={y2 - 4 * Math.sin(angle)}
          stroke={EDGE_COLOR}
          strokeWidth={2}
          strokeDasharray="6,6"
          strokeDashoffset={dashOffset as any}
        />,
        <Polygon key={`arrow-${index}`} points={`${p1} ${p2} ${p3}`} fill={EDGE_COLOR} />,
      );
    }
    return shapes;
  };

  return (
    <View style={[styles.container, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: appTheme.borderSoft }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <View style={styles.headerIcon}>
              <Workflow color="#FFFFFF" size={17} />
            </View>
            <View style={styles.headerCopy}>
              <Typography variant="body" color={appTheme.text} style={styles.headerTitle}>Workflow Builder</Typography>
              <Typography variant="overline" color={appTheme.muted}>
                {hasWorkflow ? `${steps.length} steps · ${branchCount} branches` : 'Build your automation flow'}
              </Typography>
            </View>
          </View>
          {hasWorkflow ? (
            <View style={styles.eventBadge}>
              <Zap color="#10B981" size={11} />
              <Typography variant="overline" color="#10B981" style={styles.eventBadgeText}>Event-Driven</Typography>
            </View>
          ) : null}
        </View>

        {hasWorkflow ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {steps.map((step) => {
              const color = pillColor(step.type);
              return (
                <View key={step.id} style={[styles.stepPill, { borderColor: `${color}44`, backgroundColor: `${color}12` }]}>
                  <View style={[styles.stepPillDot, { backgroundColor: color }]} />
                  <Typography variant="overline" color={color} style={styles.stepPillText}>{step.title}</Typography>
                </View>
              );
            })}
            {branchCount > 0 ? (
              <View style={[styles.stepPill, { borderColor: 'rgba(139,92,246,0.3)', backgroundColor: 'rgba(139,92,246,0.08)' }]}>
                <GitBranch color="#8B5CF6" size={11} />
                <Typography variant="overline" color="#8B5CF6" style={styles.stepPillText}>{branchCount} conditions</Typography>
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </View>

      {/* Canvas */}
      <View
        style={[styles.canvasWrap, { backgroundColor: appTheme.darkMode ? appTheme.softSurface : '#FAFAFA' }]}
        onLayout={(event: LayoutChangeEvent) => setMeasuredWidth(event.nativeEvent.layout.width)}
      >
        {hasWorkflow ? (
          <>
          <View
            style={[
              styles.canvasContent,
              {
                width: canvasWidth,
                height: canvasHeight,
                transform: [
                  { translateX: canvasOffset.x },
                  { translateY: canvasOffset.y },
                  { scale: zoom },
                ],
              },
            ]}
            {...canvasPanResponder.panHandlers}
          >
            <Svg width={canvasWidth} height={canvasHeight} style={StyleSheet.absoluteFill}>
              {gridDots.map((dot, index) => (
                <Circle key={index} cx={dot.x} cy={dot.y} r={1.1} fill={appTheme.darkMode ? '#334155' : '#E5E7EB'} />
              ))}
              {renderEdges()}
            </Svg>

            {sequence.map((node, index) => {
              const { x, y } = resolvedCenterFor(index, node.id);
              const isSmall = node.type === 'start' || node.type === 'end';
              const size = isSmall ? NODE_SIZE_SMALL : NODE_SIZE;
              const brand = brandConfig(node.type);
              const deletable = !isSmall;
              const editable = !isSmall;
              const selected = selectedId === node.id;
              const panHandlers = !isSmall ? panResponderFor(node.id, index).panHandlers : undefined;

              return (
                <View
                  key={node.id}
                  style={[styles.nodeWrap, { left: x - LABEL_WIDTH / 2, top: y - size / 2, width: LABEL_WIDTH }]}
                  {...panHandlers}
                >
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={() => deletable && setSelectedId(selected ? null : node.id)}
                    style={[
                      styles.nodeCircle,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: brand.bg,
                        shadowColor: brand.bg,
                        borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.28)',
                      },
                    ]}
                  >
                    <View style={[styles.nodeGloss, { borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2 }]} />
                    <NodeIcon type={node.type} size={isSmall ? 20 : 24} />
                    {!isSmall ? <PlatformBadge type={node.type} /> : null}
                    {selected && editable ? (
                      <TouchableOpacity
                        style={styles.editBubble}
                        onPress={() => {
                          setSelectedId(null);
                          setEditingStepId(node.id);
                        }}
                      >
                        <Pencil color="#2563EB" size={12} />
                      </TouchableOpacity>
                    ) : null}
                    {selected && deletable ? (
                      <TouchableOpacity
                        style={styles.deleteBubble}
                        onPress={() => {
                          setSelectedId(null);
                          onRemoveStep(node.id);
                        }}
                      >
                        <Trash2 color="#EF4444" size={12} />
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                  <Typography variant="caption" color={appTheme.text} style={styles.nodeTitle} numberOfLines={1}>
                    {node.title}
                  </Typography>
                  {node.description ? (
                    <Typography variant="overline" color={appTheme.muted} style={styles.nodeSub} numberOfLines={2}>
                      {node.description}
                    </Typography>
                  ) : null}
                </View>
              );
            })}
          </View>
          <View style={styles.canvasControls}>
            <TouchableOpacity
              accessibilityLabel="Zoom in"
              activeOpacity={0.78}
              onPress={() => setZoom((value) => Math.min(1.6, Number((value + 0.12).toFixed(2))))}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              style={styles.canvasControlBtn}
            >
              <Plus color={canvasControlColor} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Zoom out"
              activeOpacity={0.78}
              onPress={() => setZoom((value) => Math.max(0.65, Number((value - 0.12).toFixed(2))))}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              style={styles.canvasControlBtn}
            >
              <Minus color={canvasControlColor} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Reset flow view"
              activeOpacity={0.78}
              onPress={resetCanvasView}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              style={styles.canvasControlBtn}
            >
              <Maximize2 color={canvasControlColor} size={18} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { borderColor: appTheme.border, backgroundColor: appTheme.surface }]}>
              <Workflow color={appTheme.disabled} size={24} />
            </View>
            <Typography variant="caption" color={appTheme.muted} style={styles.emptyText}>
              Search for leads or add a step to{'\n'}generate your workflow
            </Typography>
          </View>
        )}
      </View>

      {/* Action toolbox */}
      <View style={[styles.toolbox, { borderTopColor: appTheme.borderSoft }]}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => {
            setPickerState(pickerState === 'closed' ? 'platform' : 'closed');
            setPickedPlatform(null);
          }}
          style={[
            styles.addBtn,
            pickerState !== 'closed'
              ? { backgroundColor: appTheme.darkMode ? '#0F172A' : '#111827' }
              : { backgroundColor: appTheme.softSurface, borderWidth: 1, borderColor: appTheme.border },
          ]}
        >
          {pickerState === 'closed' ? <Plus color={appTheme.text} size={15} /> : <X color="#FFFFFF" size={15} />}
          <Typography variant="caption" color={pickerState === 'closed' ? appTheme.text : '#FFFFFF'} style={styles.addBtnText}>
            {pickerState === 'closed' ? 'Add Step' : 'Close'}
          </Typography>
        </TouchableOpacity>

        {pickerState !== 'closed' ? (
          <View style={[styles.picker, { borderColor: appTheme.border, backgroundColor: appTheme.surface }]}>
            <Typography variant="overline" color={appTheme.disabled} style={styles.pickerHeading}>
              {pickedPlatform ? `${pickedPlatform.label} actions` : 'Select platform'}
            </Typography>
            {!pickedPlatform ? (
              WORKFLOW_PLATFORMS.map((platform) => (
                <TouchableOpacity
                  key={platform.id}
                  activeOpacity={0.78}
                  onPress={() => setPickedPlatform(platform)}
                  style={styles.pickerItem}
                >
                  <View style={[styles.pickerIcon, { backgroundColor: `${platform.color}18` }]}>
                    <PlatformPickerIcon id={platform.id} color={platform.color} />
                  </View>
                  <View style={styles.pickerCopy}>
                    <Typography variant="caption" color={appTheme.text} style={styles.pickerTitle}>{platform.label}</Typography>
                    <Typography variant="overline" color={appTheme.muted}>{platform.desc}</Typography>
                  </View>
                  <ChevronRight color={appTheme.disabled} size={15} />
                </TouchableOpacity>
              ))
            ) : (
              <>
                {WORKFLOW_PLATFORM_ACTIONS[pickedPlatform.id].map((action) => (
                  <TouchableOpacity
                    key={action.type}
                    activeOpacity={0.78}
                    onPress={() => {
                      onAddStep(pickedPlatform.id, action);
                      setPickerState('closed');
                      setPickedPlatform(null);
                    }}
                    style={styles.pickerItem}
                  >
                    <View style={[styles.pickerIcon, { backgroundColor: `${pickedPlatform.color}18` }]}>
                      <NodeIconColored type={action.type} color={pickedPlatform.color} />
                    </View>
                    <View style={styles.pickerCopy}>
                      <Typography variant="caption" color={appTheme.text} style={styles.pickerTitle}>{action.title}</Typography>
                      <Typography variant="overline" color={appTheme.muted}>{action.desc}</Typography>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={() => setPickedPlatform(null)}
                  style={[styles.pickerBack, { backgroundColor: appTheme.softSurface }]}
                >
                  <ChevronLeft color={appTheme.muted} size={13} />
                  <Typography variant="overline" color={appTheme.muted} style={styles.pickerBackText}>Back to platforms</Typography>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}
      </View>

      <StepEditorModal
        step={steps.find((step) => step.id === editingStepId) || null}
        onClose={() => setEditingStepId(null)}
        onSave={(patch) => {
          if (editingStepId) onEditStep(editingStepId, patch);
          setEditingStepId(null);
        }}
        appTheme={appTheme}
      />
    </View>
  );
}

/** Per-step message/subject/delay editor — mobile port of the web's StepEditor, opened from a node's pencil action. */
function StepEditorModal({
  step,
  onClose,
  onSave,
  appTheme,
}: {
  step: WorkflowStepDef | null;
  onClose: () => void;
  onSave: (patch: Partial<WorkflowStepDef>) => void;
  appTheme: ReturnType<typeof useAppTheme>;
}) {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [delayDays, setDelayDays] = useState('0');

  React.useEffect(() => {
    if (!step) return;
    setMessage(step.message || '');
    setSubject(step.subject || '');
    setDelayDays(String(step.delayDays ?? 0));
  }, [step]);

  if (!step) return null;
  const hasSubject = step.type === 'email_send';
  const hasMessage = ['linkedin_connect', 'linkedin_message', 'email_send', 'whatsapp_send', 'voice_agent_call'].includes(step.type);

  return (
    <Modal visible={Boolean(step)} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={editorStyles.overlay}>
        <View style={[editorStyles.sheet, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
          <View style={[editorStyles.header, { borderBottomColor: appTheme.borderSoft }]}>
            <Typography variant="body" color={appTheme.text} style={editorStyles.title}>{step.title}</Typography>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X color={appTheme.muted} size={18} />
            </TouchableOpacity>
          </View>
          <View style={editorStyles.body}>
            {hasSubject ? (
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject line"
                placeholderTextColor={appTheme.disabled}
                style={[editorStyles.input, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}
              />
            ) : null}
            {hasMessage ? (
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Message"
                placeholderTextColor={appTheme.disabled}
                multiline
                style={[editorStyles.textArea, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}
              />
            ) : null}
            <View style={editorStyles.delayRow}>
              <Typography variant="caption" color={appTheme.muted}>Delay (days)</Typography>
              <TextInput
                value={delayDays}
                onChangeText={setDelayDays}
                keyboardType="number-pad"
                style={[editorStyles.delayInput, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}
              />
            </View>
          </View>
          <View style={editorStyles.footer}>
            <TouchableOpacity style={[editorStyles.footerBtn, { borderColor: appTheme.border }]} onPress={onClose}>
              <Typography variant="caption" color={appTheme.muted} style={editorStyles.footerBtnText}>Cancel</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[editorStyles.footerBtn, editorStyles.footerPrimary, { backgroundColor: appTheme.primaryAccent }]}
              onPress={() => onSave({ message, subject, delayDays: Number(delayDays) || 0 })}
            >
              <Typography variant="caption" color="#FFFFFF" style={editorStyles.footerBtnText}>Save</Typography>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const editorStyles = StyleSheet.create({
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
  title: { fontWeight: '700' },
  body: {
    padding: Theme.spacing.md,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  delayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  delayInput: {
    width: 70,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
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
  footerPrimary: { borderWidth: 0 },
  footerBtnText: { fontWeight: '700' },
});

/** Action icon in the picker rows, tinted with the platform color. */
const NodeIconColored = ({ type, color }: { type: string; color: string }) => {
  const props = { color, size: 15 };
  if (type === 'linkedin_visit') return <Eye {...props} />;
  if (type === 'linkedin_connect') return <UserPlus {...props} />;
  if (type === 'linkedin_message') return <Send {...props} />;
  if (type.includes('email')) return <Mail {...props} />;
  if (type.includes('whatsapp')) return <MessageCircle {...props} />;
  if (type.includes('voice')) return <Phone {...props} />;
  return <Zap {...props} />;
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
  },
  header: {
    padding: Theme.spacing.md,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#6D5AE6',
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.small,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontWeight: '800' },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  eventBadgeText: { fontWeight: '800' },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: Theme.spacing.md,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  stepPillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  stepPillText: { fontWeight: '700' },
  canvasWrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  canvasContent: {
    position: 'relative',
  },
  canvasControls: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    gap: 10,
    backgroundColor: 'transparent',
  },
  canvasControlBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  nodeWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  nodeCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 9,
    elevation: 6,
  },
  nodeGloss: {
    position: 'absolute',
    top: 3,
    left: '18%',
    right: '18%',
    height: '30%',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  platformBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.small,
  },
  deleteBubble: {
    position: 'absolute',
    top: -10,
    left: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.small,
  },
  editBubble: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.small,
  },
  nodeTitle: {
    marginTop: 7,
    fontWeight: '800',
    textAlign: 'center',
  },
  nodeSub: {
    marginTop: 1,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    gap: 12,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 17,
  },
  toolbox: {
    padding: Theme.spacing.md,
    borderTopWidth: 1,
    gap: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addBtnText: { fontWeight: '800' },
  picker: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 10,
    gap: 2,
    ...Theme.shadows.medium,
  },
  pickerHeading: {
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  pickerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCopy: { flex: 1, minWidth: 0 },
  pickerTitle: { fontWeight: '700' },
  pickerBack: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickerBackText: { fontWeight: '800' },
});
