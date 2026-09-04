/**
 * Mobile workflow builder matched to LAD Frontend 2's WorkflowPreviewPanel.
 * The ordered `steps` array remains the only source of truth used by the
 * checkpoint wizard, visual canvas, settings sheet, and campaign payload.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Eye,
  Flag,
  GitBranch,
  Image as ImageIcon,
  Link2,
  Mail,
  Maximize2,
  MessageCircle,
  Minus,
  Phone,
  Play,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Trash2,
  UserPlus,
  Wand2,
  Workflow,
  X,
  Zap,
} from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { apiGet, apiPost } from '@/src/api';
import { useAppTheme } from '@/src/theme/appTheme';
import {
  WORKFLOW_PLATFORMS,
  WORKFLOW_PLATFORM_ACTIONS,
  WorkflowStepDef,
} from '@/src/services/mobileAIAssistantService';
import { validateWorkflowStep } from '@/src/services/workflowValidation';

const NODE_SIZE = 68;
const SMALL_NODE_SIZE = 54;
const LABEL_WIDTH = 116;
const ROW_STRIDE = 150;
const EDGE_COLOR = '#CBD1DC';
const NODE_ACTION_SIZE = 24;
const NODE_INSERT_ACTION_SIZE = 22;
const INSERT_MENU_WIDTH = 268;
const INSERT_MENU_MAX_HEIGHT = 340;
const AnimatedLine = Animated.createAnimatedComponent(Line as any);

interface SequenceNode extends WorkflowStepDef {
  synthetic?: boolean;
}

const brandConfig = (type: string) => {
  if (type === 'start') return { bg: '#22C55E', glow: 'rgba(34,197,94,0.28)' };
  if (type === 'end') return { bg: '#EF4444', glow: 'rgba(239,68,68,0.28)' };
  if (type === 'lead_generation') return { bg: '#F59E0B', glow: 'rgba(245,158,11,0.28)' };
  if (type === 'media_generation') return { bg: '#D946EF', glow: 'rgba(217,70,239,0.28)' };
  if (type === 'linkedin_connect') return { bg: '#3B82F6', glow: 'rgba(59,130,246,0.28)' };
  if (type === 'linkedin_message') return { bg: '#8B5CF6', glow: 'rgba(139,92,246,0.28)' };
  if (type === 'linkedin_inmail') return { bg: '#7C3AED', glow: 'rgba(124,58,237,0.28)' };
  if (type === 'linkedin_visit') return { bg: '#0EA5E9', glow: 'rgba(14,165,233,0.28)' };
  if (type.includes('linkedin')) return { bg: '#0A66C2', glow: 'rgba(10,102,194,0.28)' };
  if (type.includes('email')) return { bg: '#EA4335', glow: 'rgba(234,67,53,0.28)' };
  if (type.includes('whatsapp')) return { bg: '#25D366', glow: 'rgba(37,211,102,0.28)' };
  if (type.includes('voice')) return { bg: '#8B5CF6', glow: 'rgba(139,92,246,0.28)' };
  if (type === 'delay') return { bg: '#6B7280', glow: 'rgba(107,114,128,0.28)' };
  if (type === 'condition' || type === 'wait_for_condition') return { bg: '#6366F1', glow: 'rgba(99,102,241,0.28)' };
  return { bg: '#6366F1', glow: 'rgba(99,102,241,0.28)' };
};

const pillColor = (type: string) => {
  if (type === 'media_generation') return '#D946EF';
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

const NodeIcon = ({ type, size = 24, color = '#FFFFFF' }: { type: string; size?: number; color?: string }) => {
  const props = { color, size, strokeWidth: 2.1 };
  if (type === 'start') return <Play {...props} />;
  if (type === 'end') return <Flag {...props} />;
  if (type === 'lead_generation') return <Search {...props} />;
  if (type === 'linkedin_visit') return <Eye {...props} />;
  if (type === 'linkedin_connect') return <UserPlus {...props} />;
  if (type === 'linkedin_message') return <Send {...props} />;
  if (type.includes('email')) return <Mail {...props} />;
  if (type.includes('whatsapp')) return <MessageCircle {...props} />;
  if (type.includes('voice')) return <Phone {...props} />;
  if (type === 'media_generation') return <Wand2 {...props} />;
  if (type === 'delay') return <Clock {...props} />;
  return <Zap {...props} />;
};

const PlatformBadge = ({ type }: { type: string }) => {
  let icon: React.ReactNode = null;
  if (type.includes('linkedin') || type === 'lead_generation') icon = <LinkedInGlyph size={11} />;
  else if (type.includes('email')) icon = <Mail color="#EA4335" size={11} />;
  else if (type.includes('whatsapp')) icon = <MessageCircle color="#25D366" size={11} />;
  else if (type.includes('voice')) icon = <Phone color="#8B5CF6" size={11} />;
  else if (type === 'media_generation') icon = <Wand2 color="#D946EF" size={11} />;
  if (!icon) return null;
  return <View style={styles.platformBadge}>{icon}</View>;
};

const nodeSubtext = (node: SequenceNode) => {
  if (node.type === 'start') return 'Campaign begins';
  if (node.type === 'end') return '';
  if (node.type === 'lead_generation' && node.leadLimit) return `${node.leadLimit} leads/day`;
  if (node.description && node.description !== node.title) return node.description;
  if (node.message) return `${node.message.slice(0, 35)}${node.message.length > 35 ? '…' : ''}`;
  return '';
};

interface WorkflowCanvasProps {
  steps: WorkflowStepDef[];
  mode?: 'inbound' | 'outbound';
  campaignStatus?: string;
  style?: StyleProp<ViewStyle>;
  onAddStep: (
    platformId: string,
    action: { type: string; title: string; desc: string },
    insertion?: { relativeToId: string; position: 'before' | 'after' },
  ) => void;
  onRemoveStep: (id: string) => void;
  onEditStep: (id: string, patch: Partial<WorkflowStepDef>) => void;
}

export function WorkflowCanvas({
  steps,
  mode = 'outbound',
  campaignStatus = 'configuring',
  style,
  onAddStep,
  onRemoveStep,
  onEditStep,
}: WorkflowCanvasProps) {
  const appTheme = useAppTheme();
  const { width } = useWindowDimensions();
  const canvasRef = useRef<View>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [insertMenu, setInsertMenu] = useState<{
    relativeToId: string;
    position: 'before' | 'after';
    x: number;
    y: number;
  } | null>(null);
  const selectionProgress = useRef(new Animated.Value(0)).current;
  const zoomValue = useRef(new Animated.Value(1)).current;
  const pendingPulse = useRef(new Animated.Value(0.45)).current;
  const panValue = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOrigin = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dashOffset = useRef(new Animated.Value(0)).current;
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const dragOrigin = useRef<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    const animation = Animated.loop(Animated.timing(dashOffset, {
      toValue: -24,
      duration: 900,
      easing: Easing.linear,
      useNativeDriver: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [dashOffset]);

  useEffect(() => {
    if (campaignStatus !== 'launching') {
      pendingPulse.setValue(0.45);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pendingPulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pendingPulse, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [campaignStatus, pendingPulse]);

  useEffect(() => {
    Animated.spring(zoomValue, {
      toValue: zoom,
      damping: 18,
      stiffness: 190,
      mass: 0.65,
      useNativeDriver: true,
    }).start();
  }, [zoom, zoomValue]);

  useEffect(() => {
    selectionProgress.stopAnimation();
    selectionProgress.setValue(0);
    if (!selectedStepId) return;
    Animated.spring(selectionProgress, {
      toValue: 1,
      damping: 16,
      stiffness: 240,
      mass: 0.55,
      useNativeDriver: true,
    }).start();
  }, [selectedStepId, selectionProgress]);

  useEffect(() => {
    if (selectedStepId && !steps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(null);
    }
  }, [selectedStepId, steps]);

  const sequence: SequenceNode[] = useMemo(() => [
    { id: 'start', type: 'start', title: 'Start', description: 'Campaign begins', channel: 'system', synthetic: true },
    ...steps,
    { id: 'end', type: 'end', title: 'End', description: '', channel: 'system', synthetic: true },
  ], [steps]);
  const hasWorkflow = steps.length > 0;
  const branchCount = hasWorkflow
    ? (steps.some((step) => step.type === 'linkedin_connect') ? 3 : 0)
      + (steps.some((step) => step.type === 'lead_generation') ? 2 : 0)
    : 0;

  const canvasWidth = Math.max(canvasSize.width || width - 34, 286);
  const canvasHeight = Math.max(canvasSize.height || 430, 260);
  const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(sequence.length))));
  const rows = Math.ceil(sequence.length / cols);
  const cellWidth = canvasWidth / cols;
  const requiredHeight = rows * ROW_STRIDE + 16;
  const contentHeight = Math.max(canvasHeight, requiredHeight);
  const rowStride = rows > 1
    ? Math.min(ROW_STRIDE, Math.max(132, (contentHeight - 112) / (rows - 1)))
    : ROW_STRIDE;

  const cellFor = (index: number) => {
    const row = Math.floor(index / cols);
    const position = index % cols;
    return { row, col: row % 2 === 0 ? position : cols - 1 - position };
  };
  const centerFor = (index: number) => {
    const { row, col } = cellFor(index);
    return { x: cellWidth * (col + 0.5), y: 42 + row * rowStride, row, col };
  };
  const resolvedCenterFor = (index: number, id: string) => {
    const base = centerFor(index);
    const dragged = dragPositions[id];
    return dragged ? { ...base, ...dragged } : base;
  };

  const nodePanResponder = (id: string, index: number) => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
    onPanResponderGrant: () => { dragOrigin.current[id] = dragPositions[id] || centerFor(index); },
    onPanResponderMove: (_event, gesture) => {
      const origin = dragOrigin.current[id];
      if (!origin) return;
      setDragPositions((current) => ({
        ...current,
        [id]: {
          x: Math.max(36, Math.min(canvasWidth - 36, origin.x + gesture.dx / zoom)),
          y: Math.max(36, Math.min(contentHeight - 70, origin.y + gesture.dy / zoom)),
        },
      }));
    },
  });

  const canvasPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => {
      panValue.stopAnimation((value) => { panOrigin.current = value; });
    },
    onPanResponderMove: (_event, gesture) => {
      panValue.setValue({ x: panOrigin.current.x + gesture.dx, y: panOrigin.current.y + gesture.dy });
    },
  }), [panValue]);

  const resetView = () => {
    setZoom(1);
    setDragPositions({});
    Animated.spring(panValue, {
      toValue: { x: 0, y: 0 },
      damping: 18,
      stiffness: 170,
      useNativeDriver: true,
    }).start();
  };

  const openInsertMenu = (event: GestureResponderEvent, insertion: {
    relativeToId: string;
    position: 'before' | 'after';
  }) => {
    const { pageX, pageY } = event.nativeEvent;
    const showMenu = (originX: number, originY: number) => {
      setInsertMenu({
        ...insertion,
        x: pageX - originX,
        y: pageY - originY,
      });
    };

    if (canvasRef.current) {
      canvasRef.current.measureInWindow(showMenu);
    } else {
      setInsertMenu({ ...insertion, x: canvasSize.width / 2, y: canvasSize.height / 2 });
    }
  };

  const gridDots = useMemo(() => {
    const dots: { x: number; y: number }[] = [];
    for (let x = 14; x < canvasWidth; x += 28) {
      for (let y = 14; y < contentHeight; y += 28) dots.push({ x, y });
    }
    return dots;
  }, [canvasWidth, contentHeight]);

  const renderEdges = () => sequence.slice(0, -1).flatMap((node, index) => {
    const next = sequence[index + 1];
    const from = resolvedCenterFor(index, node.id);
    const to = resolvedCenterFor(index + 1, next.id);
    const fromRadius = (node.synthetic ? SMALL_NODE_SIZE : NODE_SIZE) / 2;
    const toRadius = (next.synthetic ? SMALL_NODE_SIZE : NODE_SIZE) / 2;
    let x1: number; let y1: number; let x2: number; let y2: number;
    if (from.row !== to.row) {
      x1 = from.x; y1 = from.y + fromRadius + 31;
      x2 = to.x; y2 = to.y - toRadius - 5;
    } else if (from.x < to.x) {
      x1 = from.x + fromRadius + 4; y1 = from.y;
      x2 = to.x - toRadius - 7; y2 = to.y;
    } else {
      x1 = from.x - fromRadius - 4; y1 = from.y;
      x2 = to.x + toRadius + 7; y2 = to.y;
    }
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrow = 6;
    const points = [
      `${x2 - arrow * Math.cos(angle - 0.45)},${y2 - arrow * Math.sin(angle - 0.45)}`,
      `${x2},${y2}`,
      `${x2 - arrow * Math.cos(angle + 0.45)},${y2 - arrow * Math.sin(angle + 0.45)}`,
    ].join(' ');
    return [
      <AnimatedLine
        key={`line-${node.id}-${next.id}`}
        x1={x1}
        y1={y1}
        x2={x2 - 4 * Math.cos(angle)}
        y2={y2 - 4 * Math.sin(angle)}
        stroke={EDGE_COLOR}
        strokeWidth={1.8}
        strokeDasharray="5,6"
        strokeDashoffset={dashOffset as any}
      />,
      <Polygon key={`arrow-${node.id}-${next.id}`} points={points} fill={EDGE_COLOR} />,
    ];
  });

  const controlColor = appTheme.darkMode ? '#E2E8F0' : '#111827';
  const editorStep = steps.find((step) => step.id === editingStepId) || null;
  const insertMenuWidth = Math.min(INSERT_MENU_WIDTH, Math.max(220, canvasSize.width - 16));
  const insertMenuMaxHeight = Math.min(INSERT_MENU_MAX_HEIGHT, Math.max(220, canvasSize.height - 16));
  const insertMenuLeft = insertMenu
    ? Math.max(8, Math.min(canvasSize.width - insertMenuWidth - 8, insertMenu.x - insertMenuWidth / 2))
    : 8;
  const insertMenuTop = insertMenu
    ? insertMenu.y + 12 + insertMenuMaxHeight <= canvasSize.height - 8
      ? insertMenu.y + 12
      : Math.max(8, insertMenu.y - 12 - insertMenuMaxHeight)
    : 8;
  const statusLabel = campaignStatus === 'launching' ? 'Starting' : campaignStatus === 'launched' ? 'Active' : 'Event-Driven';

  return (
    <View style={[styles.container, { backgroundColor: appTheme.surface, borderColor: appTheme.border }, style]}>
      <Pressable
        onPress={() => {
          setSelectedStepId(null);
          setInsertMenu(null);
        }}
        style={[styles.header, { borderBottomColor: appTheme.borderSoft }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <View style={styles.headerIcon}><Workflow color="#FFFFFF" size={18} /></View>
            <View style={styles.headerCopy}>
              <Typography variant="body" color={appTheme.text} style={styles.headerTitle}>Workflow Builder</Typography>
              <Typography variant="overline" color={appTheme.muted} style={styles.headerMeta}>
                {hasWorkflow ? `${steps.length} steps · ${branchCount} branches` : `${mode === 'inbound' ? 'Inbound' : 'Outbound'} automation flow`}
              </Typography>
            </View>
          </View>
          {hasWorkflow ? (
            <View style={[
              styles.eventBadge,
              campaignStatus === 'launching' && styles.pendingBadge,
              appTheme.darkMode && {
                backgroundColor: appTheme.labelBackground,
                borderColor: campaignStatus === 'launching' ? 'rgba(245,158,11,0.45)' : 'rgba(16,185,129,0.45)',
              },
            ]}>
              {campaignStatus === 'launching'
                ? <ActivityIndicator color="#F59E0B" size={11} />
                : <Zap color="#10B981" size={11} />}
              <Typography
                variant="overline"
                color={campaignStatus === 'launching' ? '#D97706' : '#10B981'}
                style={styles.eventBadgeText}
              >
                {statusLabel}
              </Typography>
            </View>
          ) : null}
        </View>

        {hasWorkflow ? (
          <View style={styles.pillRow}>
            {steps.map((step) => {
              const color = pillColor(step.type);
              return (
                <View key={step.id} style={[styles.stepPill, {
                  backgroundColor: appTheme.darkMode ? appTheme.labelBackground : '#F3F5F8',
                  borderColor: appTheme.darkMode ? appTheme.labelBorder : `${color}24`,
                }]}>
                  <View style={[styles.stepPillDot, { backgroundColor: color }]} />
                  <Typography variant="overline" color={color} style={styles.stepPillText} numberOfLines={1}>{step.title}</Typography>
                </View>
              );
            })}
            {branchCount > 0 ? (
              <View style={[styles.conditionPill, appTheme.darkMode && { backgroundColor: appTheme.labelBackground, borderColor: appTheme.labelBorder }]}>
                <GitBranch color="#8B5CF6" size={11} />
                <Typography variant="overline" color="#8B5CF6" style={styles.stepPillText}>{branchCount} conditions</Typography>
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      <View
        ref={canvasRef}
        style={[styles.canvasWrap, { backgroundColor: appTheme.darkMode ? '#0B1229' : '#FAFBFD' }]}
        onLayout={(event: LayoutChangeEvent) => {
          const { width: measuredWidth, height } = event.nativeEvent.layout;
          if (measuredWidth && height) setCanvasSize({ width: measuredWidth, height });
        }}
      >
        {hasWorkflow ? (
          <>
            <Animated.View
              style={[
                styles.canvasContent,
                {
                  width: canvasWidth,
                  height: contentHeight,
                  transform: [
                    { translateX: panValue.x },
                    { translateY: panValue.y },
                    { scale: zoomValue },
                  ],
                },
              ]}
              {...canvasPanResponder.panHandlers}
            >
              <Pressable
                accessibilityElementsHidden
                importantForAccessibility="no"
                onPress={() => {
                  setSelectedStepId(null);
                  setInsertMenu(null);
                }}
                style={StyleSheet.absoluteFill}
              />
              <Svg pointerEvents="none" width={canvasWidth} height={contentHeight} style={StyleSheet.absoluteFill}>
                {gridDots.map((dot, index) => (
                  <Circle key={index} cx={dot.x} cy={dot.y} r={1.1} fill={appTheme.darkMode ? '#334155' : '#DDE2EA'} opacity={0.62} />
                ))}
                {renderEdges()}
              </Svg>
              {sequence.map((node, index) => {
                const { x, y } = resolvedCenterFor(index, node.id);
                const small = Boolean(node.synthetic);
                const size = small ? SMALL_NODE_SIZE : NODE_SIZE;
                const brand = brandConfig(node.type);
                const selected = !small && selectedStepId === node.id;
                const circleLeft = (LABEL_WIDTH - size) / 2;
                const canInsertBefore = !small && node.type !== 'start' && node.type !== 'lead_generation';
                const canInsertAfter = !small && node.type !== 'start' && node.type !== 'end';
                return (
                  <View
                    key={node.id}
                    style={[
                      styles.nodeWrap,
                      {
                        left: x - LABEL_WIDTH / 2,
                        top: y - size / 2,
                        width: LABEL_WIDTH,
                        zIndex: selected ? 20 : 1,
                      },
                    ]}
                    {...(!small ? nodePanResponder(node.id, index).panHandlers : {})}
                  >
                    {selected ? (
                      <>
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.selectedNodeRing,
                            {
                              width: size + 16,
                              height: size + 16,
                              borderRadius: (size + 16) / 2,
                              borderColor: brand.bg,
                              left: circleLeft - 8,
                              top: -8,
                              opacity: selectionProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
                              transform: [{ scale: selectionProgress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
                            },
                          ]}
                        />
                        <Animated.View
                          style={[
                            styles.nodeTopActions,
                            {
                              opacity: selectionProgress,
                              transform: [{ translateY: selectionProgress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
                            },
                          ]}
                        >
                          <TouchableOpacity
                            accessibilityLabel={`Edit ${node.title}`}
                            activeOpacity={0.7}
                            hitSlop={6}
                             onPress={(event) => {
                               event.stopPropagation();
                               setInsertMenu(null);
                               setEditingStepId(node.id);
                             }}
                            style={styles.nodeActionButton}
                          >
                            <Settings color="#6366F1" size={12} strokeWidth={2.2} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityLabel={`Delete ${node.title}`}
                            activeOpacity={0.7}
                            hitSlop={6}
                             onPress={(event) => {
                               event.stopPropagation();
                               setInsertMenu(null);
                               onRemoveStep(node.id);
                               setSelectedStepId(null);
                            }}
                            style={styles.nodeActionButton}
                          >
                            <Trash2 color="#EF4444" size={12} strokeWidth={2.2} />
                          </TouchableOpacity>
                        </Animated.View>
                        {canInsertBefore ? (
                          <Animated.View
                            style={[
                              styles.nodeSideAction,
                              {
                                left: LABEL_WIDTH / 2 - (size / 2 + 28),
                                top: size / 2 - NODE_INSERT_ACTION_SIZE / 2,
                                opacity: selectionProgress,
                                transform: [{ scale: selectionProgress }],
                              },
                            ]}
                          >
                            <TouchableOpacity
                              accessibilityLabel={`Add step before ${node.title}`}
                              activeOpacity={0.7}
                              hitSlop={5}
                              onPress={(event) => {
                                event.stopPropagation();
                                openInsertMenu(event, { relativeToId: node.id, position: 'before' });
                              }}
                              style={styles.nodeInsertActionButton}
                            >
                              <Plus color="#6B7280" size={13} strokeWidth={2.2} />
                            </TouchableOpacity>
                          </Animated.View>
                        ) : null}
                        {canInsertAfter ? (
                          <Animated.View
                            style={[
                              styles.nodeSideAction,
                              {
                                left: LABEL_WIDTH / 2 + size / 2 + 6,
                                top: size / 2 - NODE_INSERT_ACTION_SIZE / 2,
                                opacity: selectionProgress,
                                transform: [{ scale: selectionProgress }],
                              },
                            ]}
                          >
                            <TouchableOpacity
                              accessibilityLabel={`Add step after ${node.title}`}
                              activeOpacity={0.7}
                              hitSlop={5}
                              onPress={(event) => {
                                event.stopPropagation();
                                openInsertMenu(event, { relativeToId: node.id, position: 'after' });
                              }}
                              style={styles.nodeInsertActionButton}
                            >
                              <Plus color="#6B7280" size={13} strokeWidth={2.2} />
                            </TouchableOpacity>
                          </Animated.View>
                        ) : null}
                      </>
                    ) : null}
                    <TouchableOpacity
                      activeOpacity={small ? 1 : 0.82}
                      onPress={(event) => {
                        event.stopPropagation();
                        if (!small) {
                          setInsertMenu(null);
                          setSelectedStepId(node.id);
                        }
                      }}
                      style={[
                        styles.nodeCircle,
                        {
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          backgroundColor: brand.bg,
                          shadowColor: brand.bg,
                        },
                      ]}
                    >
                      <View style={[styles.nodeGloss, { borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2 }]} />
                      <NodeIcon type={node.type} size={small ? 20 : 25} />
                      {!small ? <PlatformBadge type={node.type} /> : null}
                      {campaignStatus === 'launching' && node.type === 'start' ? <Animated.View style={[styles.pendingDot, { opacity: pendingPulse }]} /> : null}
                    </TouchableOpacity>
                    <Typography variant="caption" color={appTheme.text} style={styles.nodeTitle} numberOfLines={1}>{node.title}</Typography>
                    {nodeSubtext(node) ? (
                      <Typography variant="overline" color={appTheme.muted} style={styles.nodeSub} numberOfLines={2}>{nodeSubtext(node)}</Typography>
                    ) : null}
                  </View>
                );
              })}
            </Animated.View>
            <View style={[styles.canvasControls, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
              <TouchableOpacity
                accessibilityLabel="Zoom in"
                activeOpacity={0.72}
                 onPress={() => {
                   setSelectedStepId(null);
                   setInsertMenu(null);
                   setZoom((value) => Math.min(2, Number((value + 0.16).toFixed(2))));
                }}
                style={[styles.canvasControl, { borderBottomColor: appTheme.borderSoft }]}
              >
                <Plus color={controlColor} size={19} strokeWidth={2.2} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Zoom out"
                activeOpacity={0.72}
                 onPress={() => {
                   setSelectedStepId(null);
                   setInsertMenu(null);
                   setZoom((value) => Math.max(0.4, Number((value - 0.16).toFixed(2))));
                }}
                style={[styles.canvasControl, { borderBottomColor: appTheme.borderSoft }]}
              >
                <Minus color={controlColor} size={19} strokeWidth={2.2} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Fit workflow to view"
                activeOpacity={0.72}
                 onPress={() => {
                   setSelectedStepId(null);
                   setInsertMenu(null);
                   resetView();
                }}
                style={styles.canvasControl}
              >
                <Maximize2 color={controlColor} size={16} strokeWidth={2.1} />
              </TouchableOpacity>
            </View>
          </>
         ) : (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { borderColor: appTheme.border, backgroundColor: appTheme.surface }]}>
              <Workflow color={appTheme.disabled} size={24} />
            </View>
            <Typography variant="caption" color={appTheme.muted} style={styles.emptyText}>
              Add a step to build your{`\n`}{mode} workflow
             </Typography>
           </View>
         )}
        {insertMenu ? (
          <>
            <Pressable
              accessibilityLabel="Close add step menu"
              onPress={() => {
                setInsertMenu(null);
                setSelectedStepId(null);
              }}
              style={styles.insertMenuBackdrop}
            />
            <View
              style={[
                styles.insertMenu,
                {
                  left: insertMenuLeft,
                  top: insertMenuTop,
                  width: insertMenuWidth,
                  maxHeight: insertMenuMaxHeight,
                  backgroundColor: appTheme.surface,
                  borderColor: appTheme.border,
                },
              ]}
            >
              <View style={[styles.insertMenuHeader, { backgroundColor: appTheme.softSurface, borderBottomColor: appTheme.borderSoft }]}>
                {insertMenu.position === 'before'
                  ? <ArrowUpFromLine color={appTheme.text} size={14} strokeWidth={1.8} />
                  : <ArrowDownToLine color={appTheme.text} size={14} strokeWidth={1.8} />}
                <Typography variant="caption" color={appTheme.text} style={styles.insertMenuHeaderTitle}>
                  {insertMenu.position === 'before' ? 'Add input step' : 'Add output step'}
                </Typography>
                <Typography variant="overline" color={appTheme.muted} style={styles.insertMenuHeaderMeta}>
                  {insertMenu.position === 'before' ? 'runs before' : 'runs after'}
                </Typography>
              </View>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.insertMenuScroller}
              >
                {WORKFLOW_PLATFORMS.map((platform) => {
                  const actions = WORKFLOW_PLATFORM_ACTIONS[platform.id] || [];
                  if (!actions.length) return null;
                  return (
                    <View key={platform.id}>
                      <Typography variant="overline" color={appTheme.muted} style={styles.insertMenuGroupLabel}>
                        {platform.label}
                      </Typography>
                      {actions.map((action) => (
                        <TouchableOpacity
                          key={action.type}
                          accessibilityLabel={`${action.title}: ${action.desc}`}
                          activeOpacity={0.72}
                          onPress={() => {
                            const insertion = {
                              relativeToId: insertMenu.relativeToId,
                              position: insertMenu.position,
                            };
                            setInsertMenu(null);
                            onAddStep(platform.id, action, insertion);
                          }}
                          style={styles.insertMenuItem}
                        >
                          <View style={[styles.insertMenuIcon, { backgroundColor: `${platform.color}12` }]}>
                            <NodeIcon type={action.type} color={platform.color} size={16} />
                          </View>
                          <View style={styles.insertMenuCopy}>
                            <Typography variant="caption" color={appTheme.text} style={styles.insertMenuItemTitle}>
                              {action.title}
                            </Typography>
                            <Typography variant="overline" color={appTheme.muted} style={styles.insertMenuItemDescription}>
                              {action.desc}
                            </Typography>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </>
        ) : null}
      </View>

      <StepEditorModal
        step={editorStep}
        onClose={() => setEditingStepId(null)}
        onDelete={(id) => {
          onRemoveStep(id);
          setEditingStepId(null);
        }}
        onSave={(patch) => {
          if (editingStepId) onEditStep(editingStepId, patch);
          setEditingStepId(null);
        }}
      />
    </View>
  );
}

type EditorForm = {
  title: string;
  description: string;
  message: string;
  subject: string;
  template: string;
  script: string;
  delayDays: string;
  delayHours: string;
  leadLimit: string;
  mediaPrompt: string;
  mediaUrl: string;
  mediaType: string;
  mediaFilename: string;
  mimeType: string;
};

const emptyForm: EditorForm = {
  title: '', description: '', message: '', subject: '', template: '', script: '',
  delayDays: '0', delayHours: '0', leadLimit: '10', mediaPrompt: '', mediaUrl: '',
  mediaType: '', mediaFilename: '', mimeType: '',
};

const mediaTypeFromName = (name: string) => {
  const extension = (name.split('?')[0].split('.').pop() || '').toLowerCase();
  if (['mp4', 'webm', 'mov', '3gp'].includes(extension)) return 'video';
  if (['pdf', 'doc', 'docx'].includes(extension)) return 'document';
  return 'image';
};

function StepEditorModal({
  step,
  onClose,
  onDelete,
  onSave,
}: {
  step: WorkflowStepDef | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onSave: (patch: Partial<WorkflowStepDef>) => void;
}) {
  const appTheme = useAppTheme();
  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [pasteUrl, setPasteUrl] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!step) return;
    const title = step.title?.toLowerCase() || '';
    const delayNumber = Number(title.match(/(\d+)/)?.[1] || 0);
    const parsedDays = title.includes('day') ? delayNumber : step.delayDays ?? 0;
    const parsedHours = title.includes('hour') ? delayNumber : step.delayHours ?? 0;
    setForm({
      title: step.title || '',
      description: step.description || '',
      message: step.message || '',
      subject: step.subject || '',
      template: step.template || '',
      script: step.script || '',
      delayDays: String(parsedDays),
      delayHours: String(parsedHours),
      leadLimit: String(step.leadLimit || 10),
      mediaPrompt: step.mediaPrompt || '',
      mediaUrl: step.mediaUrl || '',
      mediaType: step.mediaType || '',
      mediaFilename: step.mediaFilename || '',
      mimeType: step.mimeType || '',
    });
    setPasteUrl('');
    setError('');
  }, [step]);

  useEffect(() => {
    if (!step || step.type !== 'lead_generation') return;
    let active = true;
    apiGet<Record<string, any>>('/api/campaigns/linkedin/limits')
      .then((response) => {
        if (!active) return;
        const payload = response.data?.data || response.data;
        if (payload?.success === false) return;
        const limit = Number(payload?.remainingDailyLimit ?? payload?.totalDailyLimit);
        if (Number.isFinite(limit) && limit > 0) {
          setDailyLimit(limit);
          setForm((current) => ({ ...current, leadLimit: String(Math.min(Number(current.leadLimit) || 1, limit)) }));
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [step]);

  if (!step) return null;
  const brand = brandConfig(step.type);
  const update = (patch: Partial<EditorForm>) => setForm((current) => ({ ...current, ...patch }));

  const attachGeneratedUrl = async () => {
    const sourceUrl = pasteUrl.trim();
    if (!/^https?:\/\//i.test(sourceUrl)) {
      setError('Enter a valid generated asset URL.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      const filename = decodeURIComponent(sourceUrl.split('?')[0].split('/').pop() || 'generated-media');
      const response = await apiPost<Record<string, any>>('/api/campaigns/media/import-generated', {
        source_url: sourceUrl,
        media_type: mediaTypeFromName(filename),
        filename,
      });
      const payload = response.data?.data || response.data;
      if (!payload?.url) throw new Error(payload?.error || 'The media could not be attached.');
      update({
        mediaUrl: String(payload.url),
        mediaType: String(payload.media_type || mediaTypeFromName(payload.filename || filename)),
        mediaFilename: String(payload.filename || filename),
        mimeType: String(payload.mime_type || ''),
        description: form.description || `Attach ${payload.media_type || 'media'} to outreach`,
      });
      setPasteUrl('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The media could not be attached.');
    } finally {
      setImporting(false);
    }
  };

  const save = () => {
    const days = Math.max(0, Number.parseInt(form.delayDays, 10) || 0);
    const hours = Math.max(0, Math.min(23, Number.parseInt(form.delayHours, 10) || 0));
    const leadLimit = Math.max(1, Math.min(dailyLimit ?? Number.MAX_SAFE_INTEGER, Number.parseInt(form.leadLimit, 10) || 1));
    let title = form.title;
    let description = form.description;
    if (step.type === 'delay') {
      const parts: string[] = [];
      if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
      if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
      if (!parts.length) parts.push('0 hours');
      title = `Wait ${parts.join(' ')}`;
      description = description || `Delay: ${parts.join(' ')}`;
    }
    const candidate: WorkflowStepDef = {
      ...step,
      title,
      description,
      message: form.message,
      subject: form.subject,
      template: form.template,
      script: form.script,
      delayDays: days,
      delayHours: hours,
      leadLimit,
      mediaPrompt: form.mediaPrompt,
      mediaUrl: form.mediaUrl,
      mediaType: form.mediaType,
      mediaFilename: form.mediaFilename,
      mimeType: form.mimeType,
    };
    const issue = validateWorkflowStep(candidate);
    if (issue) {
      setError(issue.message);
      return;
    }
    onSave(candidate);
  };

  const inputStyle = [editorStyles.input, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }];
  const textAreaStyle = [editorStyles.textArea, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }];
  const label = (text: string, suffix?: string) => (
    <View style={editorStyles.labelRow}>
      <Typography variant="caption" color={appTheme.text} style={editorStyles.label}>{text}</Typography>
      {suffix ? <Typography variant="overline" color={appTheme.muted}>{suffix}</Typography> : null}
    </View>
  );
  const variables = (value: string) => <Typography variant="overline" color={appTheme.muted} style={editorStyles.hint}>Use variables: {value}</Typography>;

  const fields = (() => {
    switch (step.type) {
      case 'lead_generation':
        return (
          <>
            <View>{label('Target Description')}<TextInput value={form.description} onChangeText={(description) => update({ description })} multiline placeholder="e.g., Roles: CEO | Industries: Healthcare | Location: USA" placeholderTextColor={appTheme.disabled} style={textAreaStyle} /></View>
            <View>
              {label('Leads per Day', dailyLimit ? `LinkedIn daily limit: ${dailyLimit}` : undefined)}
              <TextInput
                value={form.leadLimit}
                onChangeText={(value) => {
                  const numeric = Math.max(1, Math.min(dailyLimit ?? Number.MAX_SAFE_INTEGER, Number.parseInt(value, 10) || 1));
                  update({ leadLimit: String(numeric) });
                }}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor={appTheme.disabled}
                style={inputStyle}
              />
              <Typography variant="overline" color={appTheme.muted} style={editorStyles.hint}>Number of leads to generate per day {dailyLimit ? `(1–${dailyLimit})` : '(minimum 1)'}</Typography>
            </View>
          </>
        );
      case 'linkedin_visit':
      case 'linkedin_follow':
        return <View>{label('Action Description')}<TextInput value={form.description} onChangeText={(description) => update({ description })} placeholder="View target profile" placeholderTextColor={appTheme.disabled} style={inputStyle} /></View>;
      case 'linkedin_connect':
        return <View>{label('Connection Message')}<TextInput value={form.message} onChangeText={(message) => update({ message })} multiline placeholder="Hi {{first_name}}, I'd like to connect..." placeholderTextColor={appTheme.disabled} style={textAreaStyle} />{variables('{{first_name}}, {{company_name}}, {{job_title}}')}</View>;
      case 'linkedin_message':
        return <View>{label('Message Template')}<TextInput value={form.message || form.description} onChangeText={(message) => update({ message, description: message })} multiline placeholder="Hi {{first_name}}, I noticed your work at {{company_name}}..." placeholderTextColor={appTheme.disabled} style={[...textAreaStyle, editorStyles.largeTextArea]} />{variables('{{first_name}}, {{company_name}}, {{job_title}}')}</View>;
      case 'whatsapp_send':
      case 'whatsapp_broadcast':
      case 'whatsapp_message':
      case 'whatsapp_followup':
        return <View>{label('WhatsApp Message')}<TextInput value={form.message || form.description} onChangeText={(message) => update({ message, description: message })} multiline placeholder="Hello {{first_name}}! I wanted to reach out about..." placeholderTextColor={appTheme.disabled} style={[...textAreaStyle, editorStyles.largeTextArea]} />{variables('{{first_name}}, {{company_name}}, {{phone}}')}</View>;
      case 'whatsapp_template':
        return <><View>{label('Template Name')}<TextInput value={form.template} onChangeText={(template) => update({ template })} placeholder="welcome_message" placeholderTextColor={appTheme.disabled} style={inputStyle} /></View><View>{label('Template Content Preview')}<TextInput value={form.message || form.description} onChangeText={(message) => update({ message, description: message })} multiline placeholder="Template message content..." placeholderTextColor={appTheme.disabled} style={textAreaStyle} /></View></>;
      case 'email_send':
      case 'email_followup':
        return <><View>{label('Email Subject')}<TextInput value={form.subject} onChangeText={(subject) => update({ subject })} placeholder="Quick question about {{company_name}}" placeholderTextColor={appTheme.disabled} style={inputStyle} /></View><View>{label('Email Body')}<TextInput value={form.message || form.description} onChangeText={(message) => update({ message, description: message })} multiline placeholder={'Hi {{first_name}},\n\nI hope this email finds you well...'} placeholderTextColor={appTheme.disabled} style={[...textAreaStyle, editorStyles.emailTextArea]} />{variables('{{first_name}}, {{company_name}}, {{job_title}}')}</View></>;
      case 'voice_call':
      case 'voice_agent_call':
        return <><View>{label('Call Purpose')}<TextInput value={form.description} onChangeText={(description) => update({ description })} placeholder="Initial outreach call" placeholderTextColor={appTheme.disabled} style={inputStyle} /></View><View>{label('Call Script')}<TextInput value={form.script} onChangeText={(script) => update({ script })} multiline placeholder="Hello, am I speaking with {{first_name}}?" placeholderTextColor={appTheme.disabled} style={[...textAreaStyle, editorStyles.largeTextArea]} />{variables('{{first_name}}, {{company_name}}, {{phone}}')}</View></>;
      case 'voice_script':
        return <View>{label('Call Script')}<TextInput value={form.script || form.description} onChangeText={(script) => update({ script, description: script })} multiline placeholder="Hello, this is [Your Name] from [Company]..." placeholderTextColor={appTheme.disabled} style={[...textAreaStyle, editorStyles.emailTextArea]} />{variables('{{first_name}}, {{company_name}}, {{phone}}')}</View>;
      case 'media_generation':
        return (
          <>
            {form.mediaUrl ? (
              <View style={[editorStyles.mediaPreview, { borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}>
                {form.mediaType === 'image' || !form.mediaType ? <Image source={{ uri: form.mediaUrl }} style={editorStyles.mediaImage} resizeMode="cover" /> : <ImageIcon color="#D946EF" size={28} />}
                <View style={editorStyles.mediaCopy}><Typography variant="caption" color={appTheme.text} style={editorStyles.mediaName} numberOfLines={1}>{form.mediaFilename || 'Attached media'}</Typography><Typography variant="overline" color={appTheme.muted}>{form.mediaType || 'media'}</Typography></View>
                <TouchableOpacity onPress={() => update({ mediaUrl: '', mediaType: '', mediaFilename: '', mimeType: '' })} style={editorStyles.removeMedia}><Trash2 color="#EF4444" size={15} /></TouchableOpacity>
              </View>
            ) : null}
            <View>{label('Generated asset URL')}<View style={editorStyles.attachRow}><TextInput value={pasteUrl} onChangeText={setPasteUrl} autoCapitalize="none" keyboardType="url" placeholder="…or paste a generated asset URL" placeholderTextColor={appTheme.disabled} style={[...inputStyle, editorStyles.attachInput]} /><TouchableOpacity disabled={importing || !pasteUrl.trim()} onPress={() => void attachGeneratedUrl()} style={[editorStyles.attachButton, { opacity: importing || !pasteUrl.trim() ? 0.48 : 1 }]}>{importing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <><Link2 color="#FFFFFF" size={14} /><Typography variant="caption" color="#FFFFFF" style={editorStyles.attachText}>Attach</Typography></>}</TouchableOpacity></View></View>
            <View>{label('Notes / creative brief', 'optional')}<TextInput value={form.mediaPrompt} onChangeText={(mediaPrompt) => update({ mediaPrompt })} multiline placeholder="e.g. Product hero image with brand colors, no text overlay" placeholderTextColor={appTheme.disabled} style={textAreaStyle} /></View>
          </>
        );
      case 'delay':
        return <View style={editorStyles.delayRow}><View style={editorStyles.delayField}>{label('Days')}<TextInput value={form.delayDays} onChangeText={(delayDays) => update({ delayDays })} keyboardType="number-pad" style={inputStyle} /></View><View style={editorStyles.delayField}>{label('Hours')}<TextInput value={form.delayHours} onChangeText={(delayHours) => update({ delayHours })} keyboardType="number-pad" style={inputStyle} /></View></View>;
      default:
        return <View>{label('Description')}<TextInput value={form.description} onChangeText={(description) => update({ description })} multiline placeholderTextColor={appTheme.disabled} style={textAreaStyle} /></View>;
    }
  })();

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={editorStyles.overlay}>
        <View style={[editorStyles.sheet, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
          <View style={[editorStyles.header, { backgroundColor: brand.bg }]}>
            <View style={editorStyles.editorIcon}><NodeIcon type={step.type} size={21} /></View>
            <View style={editorStyles.headerCopy}><Typography variant="body" color="#FFFFFF" style={editorStyles.title}>{step.title}</Typography><Typography variant="caption" color="rgba(255,255,255,0.78)">Edit step configuration</Typography></View>
            <TouchableOpacity onPress={onClose} style={editorStyles.closeButton}><X color="#FFFFFF" size={19} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={editorStyles.body}>{fields}{error ? <View style={editorStyles.errorRow}><AlertCircle color="#EF4444" size={14} /><Typography variant="overline" color="#EF4444" style={editorStyles.errorText}>{error}</Typography></View> : null}</ScrollView>
          <View style={[editorStyles.footer, { backgroundColor: appTheme.softSurface, borderTopColor: appTheme.borderSoft }]}>
            <TouchableOpacity onPress={() => onDelete(step.id)} style={[editorStyles.deleteButton, { borderColor: '#FECACA' }]}><Trash2 color="#EF4444" size={16} /><Typography variant="caption" color="#EF4444" style={editorStyles.footerText}>Delete</Typography></TouchableOpacity>
            <TouchableOpacity onPress={save} style={[editorStyles.saveButton, { backgroundColor: brand.bg }]}><Save color="#FFFFFF" size={16} /><Typography variant="caption" color="#FFFFFF" style={editorStyles.footerText}>Save Changes</Typography></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 420, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  header: { flexShrink: 0, paddingHorizontal: 13, paddingTop: 13, paddingBottom: 11, borderBottomWidth: 1, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerTitleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#6D4AFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#6D4AFF', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 4 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontWeight: '800', letterSpacing: -0.2 },
  headerMeta: { marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  eventBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 18, backgroundColor: 'rgba(16,185,129,0.09)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.22)' },
  pendingBadge: { backgroundColor: 'rgba(245,158,11,0.09)', borderColor: 'rgba(245,158,11,0.24)' },
  eventBadgeText: { fontWeight: '800', letterSpacing: 0.25 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingRight: 13 },
  stepPill: { maxWidth: 142, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, borderWidth: 1, backgroundColor: '#F3F5F8' },
  stepPillDot: { width: 5, height: 5, borderRadius: 3 },
  stepPillText: { fontWeight: '800' },
  conditionPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(139,92,246,0.22)', backgroundColor: 'rgba(139,92,246,0.08)' },
  canvasWrap: { flex: 1, minHeight: 280, overflow: 'hidden', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  canvasContent: { position: 'relative' },
  nodeWrap: { position: 'absolute', alignItems: 'center' },
  selectedNodeRing: { position: 'absolute', borderWidth: 3 },
  nodeTopActions: { position: 'absolute', top: -10, left: 0, right: 0, zIndex: 30, elevation: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  nodeSideAction: { position: 'absolute', width: NODE_INSERT_ACTION_SIZE, height: NODE_INSERT_ACTION_SIZE, zIndex: 30, elevation: 14 },
  nodeActionButton: { width: NODE_ACTION_SIZE, height: NODE_ACTION_SIZE, borderRadius: NODE_ACTION_SIZE / 2, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  nodeInsertActionButton: { width: NODE_INSERT_ACTION_SIZE, height: NODE_INSERT_ACTION_SIZE, borderRadius: NODE_INSERT_ACTION_SIZE / 2, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  nodeCircle: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.28)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  nodeGloss: { position: 'absolute', top: 3, left: '18%', right: '18%', height: '30%', backgroundColor: 'rgba(255,255,255,0.25)' },
  platformBadge: { position: 'absolute', top: -5, right: -5, width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  pendingDot: { position: 'absolute', right: -3, bottom: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#F59E0B', borderWidth: 2, borderColor: '#FFFFFF' },
  nodeTitle: { marginTop: 7, fontWeight: '800', fontSize: 11.5, lineHeight: 14, textAlign: 'center' },
  nodeSub: { marginTop: 2, fontSize: 8.5, lineHeight: 11, letterSpacing: 0.25, textAlign: 'center', textTransform: 'uppercase' },
  canvasControls: { position: 'absolute', left: 12, bottom: 12, width: 34, borderWidth: 1, borderRadius: 9, overflow: 'hidden', shadowColor: '#111827', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5 },
  canvasControl: { width: 33, height: 33, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: 11 },
  emptyIcon: { width: 54, height: 54, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  emptyText: { lineHeight: 17, textAlign: 'center', textTransform: 'capitalize' },
  insertMenuBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 40 },
  insertMenu: { position: 'absolute', overflow: 'hidden', borderWidth: 1, borderRadius: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 18, zIndex: 50 },
  insertMenuHeader: { minHeight: 38, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  insertMenuHeaderTitle: { flex: 1, fontSize: 13, lineHeight: 16, fontWeight: '700' },
  insertMenuHeaderMeta: { fontSize: 10, lineHeight: 13 },
  insertMenuScroller: { maxHeight: INSERT_MENU_MAX_HEIGHT - 38 },
  insertMenuGroupLabel: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, fontSize: 10, lineHeight: 12, fontWeight: '800', letterSpacing: 0.25, textTransform: 'uppercase' },
  insertMenuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  insertMenuIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  insertMenuCopy: { flex: 1, minWidth: 0 },
  insertMenuItemTitle: { fontSize: 13, lineHeight: 16, fontWeight: '600' },
  insertMenuItemDescription: { marginTop: 1, fontSize: 11, lineHeight: 13 },
});

const editorStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.52)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  sheet: { width: '100%', maxWidth: 500, maxHeight: '88%', borderRadius: 20, borderWidth: 1, overflow: 'hidden', shadowColor: '#000000', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.28, shadowRadius: 30, elevation: 22 },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 13 },
  editorIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontWeight: '800', fontSize: 17 },
  closeButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, gap: 16 },
  labelRow: { minHeight: 20, marginBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontWeight: '700' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { minHeight: 92, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  largeTextArea: { minHeight: 116 },
  emailTextArea: { minHeight: 142 },
  hint: { marginTop: 5, lineHeight: 15 },
  delayRow: { flexDirection: 'row', gap: 12 },
  delayField: { flex: 1 },
  mediaPreview: { minHeight: 76, padding: 8, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mediaImage: { width: 64, height: 58, borderRadius: 8, backgroundColor: '#E5E7EB' },
  mediaCopy: { flex: 1, minWidth: 0 },
  mediaName: { fontWeight: '700' },
  removeMedia: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  attachRow: { flexDirection: 'row', gap: 8 },
  attachInput: { flex: 1, minWidth: 0 },
  attachButton: { minWidth: 82, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  attachText: { fontWeight: '800' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: 10, borderRadius: 10, backgroundColor: '#FEF2F2' },
  errorText: { flex: 1, lineHeight: 15 },
  footer: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 9 },
  deleteButton: { height: 42, paddingHorizontal: 14, borderWidth: 1, borderRadius: 11, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveButton: { flex: 1, maxWidth: 210, height: 42, paddingHorizontal: 18, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  footerText: { fontWeight: '800' },
});
