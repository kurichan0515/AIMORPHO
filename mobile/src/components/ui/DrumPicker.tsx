import React, { useRef, useState, useCallback } from 'react';
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

type SC = 'active' | 'near' | 'far' | 'hidden';

// activeIdxが変わっても±3個しか再描画されない
const DrumItem = React.memo(({ item, sc }: { item: number; sc: SC }) => (
  <View style={s.item}>
    <Text style={[s.text, sc === 'active' && s.textActive, sc === 'near' && s.textNear, sc === 'far' && s.textFar, sc === 'hidden' && s.textHidden]}>
      {item}
    </Text>
  </View>
));

function getSC(dist: number): SC {
  if (dist === 0) return 'active';
  if (dist === 1) return 'near';
  if (dist === 2) return 'far';
  return 'hidden';
}

export default function DrumPicker({ values, selectedValue, onChange, label, unit, width = 90 }: Props) {
  const listRef = useRef<FlatList>(null);
  const initialIdx = Math.max(0, values.indexOf(selectedValue));
  const [activeIdx, setActiveIdx] = useState(initialIdx);

  const snap = useCallback((offset: number, emit: boolean) => {
    const idx = Math.max(0, Math.min(Math.round(offset / ITEM_H), values.length - 1));
    setActiveIdx(idx);
    if (emit) onChange(values[idx]);
  }, [values, onChange]);

  const renderItem = useCallback(({ item, index }: { item: number; index: number }) => (
    <DrumItem item={item} sc={getSC(Math.abs(index - activeIdx))} />
  ), [activeIdx]);

  return (
    <View style={[s.wrapper, { width }]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <View style={[s.container, { width }]}>
        <View style={s.highlight} pointerEvents="none" />
        <FlatList
          ref={listRef}
          data={values}
          keyExtractor={(_, i) => String(i)}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          nestedScrollEnabled
          initialScrollIndex={initialIdx}
          windowSize={3}
          maxToRenderPerBatch={9}
          initialNumToRender={9}
          removeClippedSubviews
          onMomentumScrollEnd={e => snap(e.nativeEvent.contentOffset.y, true)}
          onScrollEndDrag={e => snap(e.nativeEvent.contentOffset.y, true)}
          ListHeaderComponent={<View style={{ height: PADDING }} />}
          ListFooterComponent={<View style={{ height: PADDING }} />}
          getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
          renderItem={renderItem}
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
  item:       { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  text:       { fontSize: 18, color: colors.text.primary, fontWeight: '400' },
  textActive: {},
  textNear:   {},
  textFar:    {},
  textHidden: {},
  unit:       { fontSize: 11, color: colors.text.secondary, letterSpacing: 0.3 },
});
