/**
 * RexWideWidget — 4×1 home screen widget
 */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget/lib/typescript/widgets/utils/style.props';
import type { WidgetData } from './RexSmallWidget';

export interface WideWidgetData extends WidgetData {
  weekVolumeKg: number;
  waterPct: number;
}

const CATEGORY_COLOR: Record<string, ColorProp> = {
  workout: '#C8FF00',
  weight: '#FF9500',
  water: '#4FC3F7',
  recovery: '#FF6B6B',
  milestone: '#A78BFA',
};

const DEFAULT_ACCENT: ColorProp = '#C8FF00';

function StatCol({ value, label, period, accent }: {
  value: string; label: string; period: string; accent?: ColorProp;
}) {
  return (
    <FlexWidget style={{ flexDirection: 'column', alignItems: 'center', flexGap: 2 }}>
      <TextWidget
        text={value}
        style={{ color: accent ?? '#CCCCCC', fontSize: 15, fontWeight: 'bold' }}
      />
      <TextWidget text={label} style={{ color: '#888888', fontSize: 8 }} />
      <TextWidget text={period} style={{ color: '#555555', fontSize: 8 }} />
    </FlexWidget>
  );
}

export function RexWideWidget({
  insightIcon,
  insightTitle,
  insightCategory,
  weekCount,
  weekVolumeKg,
  waterPct,
}: WideWidgetData) {
  const accent = CATEGORY_COLOR[insightCategory] ?? DEFAULT_ACCENT;
  const vol = weekVolumeKg >= 1000
    ? `${(weekVolumeKg / 1000).toFixed(1)}t`
    : `${Math.round(weekVolumeKg)}kg`;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        overflow: 'hidden',
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      {/* REX label */}
      <TextWidget
        text="REX"
        style={{ color: '#C8FF00', fontSize: 13, fontWeight: 'bold' }}
      />

      {/* Divider */}
      <FlexWidget style={{ width: 1, height: 36, backgroundColor: '#2A2A2A', marginHorizontal: 14 }} />

      {/* Insight */}
      <FlexWidget
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexGap: 6, overflow: 'hidden' }}
      >
        <TextWidget text={insightIcon} style={{ fontSize: 15 }} />
        <TextWidget
          text={insightTitle}
          style={{ color: accent, fontSize: 12, fontWeight: 'bold' }}
          maxLines={2}
        />
      </FlexWidget>

      {/* Divider */}
      <FlexWidget style={{ width: 1, height: 36, backgroundColor: '#2A2A2A', marginHorizontal: 14 }} />

      {/* Stats */}
      <FlexWidget style={{ flexDirection: 'row', flexGap: 14 }}>
        <StatCol value={String(weekCount)} label="workouts" period="this week" />
        <StatCol value={vol} label="volume" period="this week" />
        <StatCol value={`${waterPct}%`} label="hydration" period="today" accent="#4FC3F7" />
      </FlexWidget>
    </FlexWidget>
  );
}
