import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '../theme/colors';
import { pageAtOffset, pagerLayout } from './pagerLayout';

type Props<T> = {
  /** At least one page: a screen with nothing to show offers its own way on instead. */
  pages: readonly T[];
  keyOf: (page: T) => string;
  /** The page on screen; the pager scrolls to it when it changes. */
  index: number;
  /** Called when the learner swipes or presses Next/Previous to another page. */
  onIndexChange: (index: number) => void;
  /** Keep it stable (useCallback): the pages on screen redraw whenever it changes. */
  renderPage: (page: T, index: number) => ReactNode;
  /** Changes when pages need to redraw without the pages themselves changing (as for FlatList). */
  extraData?: unknown;
};

const layout = pagerLayout(I18nManager.isRTL);

/**
 * Pages like a mushaf, one screen each: page 1 on the right, so swiping right (revealing the page
 * to the left) goes to the next one. Next/Previous buttons below do the same; Next sits on the
 * left, the side the next page comes from. The same in every system locale (see pagerLayout).
 */
export function StudyPager<T>({
  pages,
  keyOf,
  index,
  onIndexChange,
  renderPage,
  extraData,
}: Props<T>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<T>>(null);
  const [width, setWidth] = useState(0);
  // The page the list is on, so a change of `index` from outside scrolls and a swipe does not.
  const shown = useRef(index);
  // The width the list was last placed for. After a rotation or a split-screen resize the page
  // on screen sits at another offset, so the list scrolls back to it.
  const placedFor = useRef(0);
  const count = pages.length;

  useEffect(() => {
    if (width <= 0 || count === 0) return;
    const before = placedFor.current;
    placedFor.current = width;
    if (before === 0) {
      // initialScrollIndex placed the list on this page.
      shown.current = index;
      return;
    }
    const resized = before !== width;
    if (resized || index !== shown.current) {
      shown.current = index;
      list.current?.scrollToIndex({ index, animated: !resized });
    }
  }, [index, width, count]);

  const go = (next: number) => {
    if (next >= 0 && next < count) onIndexChange(next);
  };

  const renderItem: ListRenderItem<T> = ({ item, index: i }) => (
    <View style={{ width }}>{renderPage(item, i)}</View>
  );

  return (
    <View
      style={[
        styles.container,
        { direction: layout.direction, backgroundColor: colors.background },
      ]}
    >
      <View style={styles.pages} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && count > 0 ? (
          <FlatList
            ref={list}
            data={pages}
            extraData={extraData}
            keyExtractor={keyOf}
            horizontal
            // Reversed, so the first page is on the right and later pages lie to its left.
            inverted={layout.inverted}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(index, count - 1)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={3}
            onMomentumScrollEnd={(e) => {
              const i = pageAtOffset(e.nativeEvent.contentOffset.x, width, count);
              if (i !== shown.current) {
                shown.current = i;
                onIndexChange(i);
              }
            }}
            renderItem={renderItem}
          />
        ) : null}
      </View>
      <View
        style={[
          styles.buttons,
          { borderColor: colors.border, paddingBottom: Math.max(10, insets.bottom) },
        ]}
      >
        <NavButton label="← Next" disabled={index >= count - 1} onPress={() => go(index + 1)} />
        <NavButton label="Previous →" disabled={index <= 0} onPress={() => go(index - 1)} />
      </View>
    </View>
  );
}

type NavButtonProps = { label: string; disabled: boolean; onPress: () => void };

function NavButton({ label, disabled, onPress }: NavButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.replace(/[←→]/g, '').trim()}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={styles.button}
    >
      <Text style={[styles.buttonLabel, { color: disabled ? colors.muted : colors.accent }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pages: { flex: 1 },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: { paddingVertical: 6, paddingHorizontal: 8 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
