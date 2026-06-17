import React, { useEffect, useRef, useState } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const ITEM_H = 44;
const VISIBLE = 5;
const PICKER_H = ITEM_H * VISIBLE;
const PADDING = ITEM_H * 2;

interface Props {
  values: number[];
  selectedValue: number;
  onChange: (val: number) => void;
  label: string;
  unit: string;
  width?: number;
}

export default function DrumPicker({ values, selectedValue, onChange, label, unit, width = 90 }: Props) {
  const listRef = useRef<FlatList>(null);
  const [activeIdx, setActiveIdx] = useState(() => {
    const idx = values.indexOf(selectedValue);
    return idx >= 0 ? idx : 0;
  });

  useEffect(() => {
    const idx = values.indexOf(selectedValue);
    const target = idx >= 0 ? idx : 0;
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: target * ITEM_H, animated: false });
    }, 50);
  }, []);

  const onMomentumScrollEnd = (e: any) => {
    const offset = e.nativeEvent.contentOffset.y;
    const idx = Math.round(offset / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    setActiveIdx(clamped);
    onChange(values[clamped]);
  };

  const onScrollEndDrag = (e: any) => {
    const offset = e.nativeEvent.contentOffset.y;
    const idx = Math.round(offset / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    setActiveIdx(clamped);
  };

  return (
    <View style={[s.wrapper, { width }]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <View style={[s.container, { width }]}>
        {/* 上フェード */}
        <View style={s.fadeTop} pointerEvents="none" />
        {/* センターハイライト */}
        <View style={s.highlight} pointerEvents="none" />
        {/* 下フェード */}
        <View style={s.fadeBottom} pointerEvents="none" />
        <FlatList
          ref={listRef}
          data={values}
          keyExtractor={(_, i) => String(i)}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollEndDrag={onScrollEndDrag}
          ListHeaderComponent={<View style={{ height: PADDING }} />}
          ListFooterComponent={<View style={{ height: PADDING }} />}
          getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
          renderItem={({ item, index }) => {
            const dist = Math.abs(index - activeIdx);
            return (
              <View style={s.item}>
                <Text style={[
                  s.text,
                  dist === 0 && s.textActive,
                  dist === 1 && s.textNear,
                  dist === 2 && s.textFar,
                  dist >= 3 && s.textHidden,
                ]}>
                  {item}
                </Text>
              </View>
            );
          }}
        />
      </View>
      {!!unit && <Text style={s.unit}>{unit}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:    { alignItems: 'center', gap: 6 },
  label:      { fontSize: 11, color: colors.text.muted, letterSpacing: 0.5, fontWeight: '600' },
  container:  { height: PICKER_H, overflow: 'hidden' },
  highlight:  {
    position: 'absolute',
    top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(47,200,255,0.4)',
    backgroundColor: 'rgba(47,200,255,0.06)',
    zIndex: 1,
  },
  fadeTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: ITEM_H * 2,
    backgroundColor: 'transparent',
    zIndex: 2,
    // shadow effect via borderless overlay
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0, height: ITEM_H * 2,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  item:       { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  text:       { fontSize: 12, color: colors.text.muted, fontWeight: '400' },
  textActive: { fontSize: 26, color: colors.neon.blue, fontWeight: '700' },
  textNear:   { fontSize: 17, color: colors.text.secondary, fontWeight: '400', opacity: 0.8 },
  textFar:    { fontSize: 13, color: colors.text.muted, opacity: 0.35 },
  textHidden: { opacity: 0.08 },
  unit:       { fontSize: 11, color: colors.text.secondary, letterSpacing: 0.3 },
});
