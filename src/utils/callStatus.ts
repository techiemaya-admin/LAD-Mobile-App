import type { CallStatus } from '@/types/calls';

export type CallStatusBucket =
  | 'queue'
  | 'calling'
  | 'ongoing'
  | 'completed'
  | 'failed'
  | 'unknown';

export interface CallStatusDisplayMeta {
  bucket: CallStatusBucket;
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  isLive: boolean;
  normalizedStatus: CallStatus;
}

const normalizeStatusText = (value: unknown) =>
  String(value ?? '').trim().toLowerCase();

const includesAny = (value: string, needles: string[]) =>
  needles.some((needle) => value.includes(needle));

const isNoAnswerStatus = (value: string) =>
  includesAny(value, ['no_answer', 'no-answer', 'no answer']);

const humanizeStatus = (value: string) => {
  const label = value.replace(/[_-]+/g, ' ').trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Unknown';
};

export const normalizeBackendCallStatus = (value?: unknown): CallStatus => {
  const status = normalizeStatusText(value);

  if (!status) {
    return 'queued';
  }

  if (includesAny(status, ['queue', 'pending'])) {
    return 'queued';
  }

  if (includesAny(status, ['calling', 'ringing', 'running', 'dialing', 'started'])) {
    return 'ringing';
  }

  if (includesAny(status, ['ongoing', 'active', 'in_progress', 'in-progress', 'connected', 'answered', 'processing', 'initiated'])) {
    return 'in_progress';
  }

  if (includesAny(status, ['ended', 'completed']) || ['complete', 'success', 'done', 'finished'].includes(status)) {
    return 'completed';
  }

  if (isNoAnswerStatus(status)) {
    return 'no-answer';
  }

  if (includesAny(status, ['failed', 'error', 'unreachable', 'busy', 'cancelled', 'canceled', 'stopped', 'dropped'])) {
    return status.includes('dropped') ? 'dropped' : 'failed';
  }

  return 'queued';
};

export const getCallStatusDisplayMeta = (value?: unknown): CallStatusDisplayMeta => {
  const status = normalizeStatusText(value);
  const normalizedStatus = normalizeBackendCallStatus(status);

  if (includesAny(status, ['queue', 'pending']) || normalizedStatus === 'queued') {
    return {
      bucket: 'queue',
      label: 'queued',
      color: '#7C3AED',
      backgroundColor: '#EFE9FF',
      borderColor: '#D8B4FE',
      isLive: true,
      normalizedStatus,
    };
  }

  if (includesAny(status, ['calling', 'ringing', 'running', 'dialing', 'started']) || normalizedStatus === 'ringing') {
    return {
      bucket: 'calling',
      label: 'ringing',
      color: '#D97706',
      backgroundColor: '#FEF3C7',
      borderColor: '#FCD34D',
      isLive: true,
      normalizedStatus,
    };
  }

  if (
    includesAny(status, ['ongoing', 'active', 'in_progress', 'in-progress', 'connected', 'answered', 'processing', 'initiated']) ||
    normalizedStatus === 'in_progress'
  ) {
    return {
      bucket: 'ongoing',
      label: 'ongoing',
      color: '#059669',
      backgroundColor: '#E1EEE2',
      borderColor: '#86EFAC',
      isLive: true,
      normalizedStatus,
    };
  }

  if (includesAny(status, ['ended', 'completed']) || ['complete', 'success', 'done', 'finished'].includes(status) || normalizedStatus === 'completed' || normalizedStatus === 'ended') {
    return {
      bucket: 'completed',
      label: 'completed',
      color: '#15803D',
      backgroundColor: '#DCFCE7',
      borderColor: '#86EFAC',
      isLive: false,
      normalizedStatus,
    };
  }

  if (isNoAnswerStatus(status)) {
    return {
      bucket: 'failed',
      label: 'no answer',
      color: '#BE123C',
      backgroundColor: '#FFE4E6',
      borderColor: '#FDA4AF',
      isLive: false,
      normalizedStatus,
    };
  }

  if (includesAny(status, ['failed', 'error', 'unreachable', 'busy', 'cancelled', 'canceled', 'stopped', 'dropped']) || normalizedStatus === 'failed' || normalizedStatus === 'dropped') {
    return {
      bucket: 'failed',
      label: normalizedStatus === 'dropped' ? 'dropped' : 'failed',
      color: '#BE123C',
      backgroundColor: '#FFE4E6',
      borderColor: '#FDA4AF',
      isLive: false,
      normalizedStatus,
    };
  }

  return {
    bucket: 'unknown',
    label: humanizeStatus(status),
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    isLive: false,
    normalizedStatus,
  };
};

export const formatCallStatusLabel = (value?: unknown) =>
  getCallStatusDisplayMeta(value).label;
