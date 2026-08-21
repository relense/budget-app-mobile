import { fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, Text } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { act, create } from 'react-test-renderer';

import { SwipeableRow } from '../../../src/components/SwipeableRow';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';

// Spacer (12) + edit button (72) -- mirrors the private ACTION_WIDTH in SwipeableRow itself.
const ACTION_WIDTH = 84;

describe('SwipeableRow', () => {
  it('renders its children', async () => {
    await render(
      <ThemeProvider>
        <SwipeableRow onEdit={jest.fn()} testID="swipe-edit-action-1">
          <Text>Shopping</Text>
        </SwipeableRow>
      </ThemeProvider>,
    );

    expect(screen.getByText('Shopping')).toBeTruthy();
  });

  it('calls onEdit when the reveal action is pressed', async () => {
    const onEdit = jest.fn();
    await render(
      <ThemeProvider>
        <SwipeableRow onEdit={onEdit} testID="swipe-edit-action-1">
          <Text>Shopping</Text>
        </SwipeableRow>
      </ThemeProvider>,
    );

    await fireEvent.press(screen.getByTestId('swipe-edit-action-1'));

    expect(onEdit).toHaveBeenCalled();
  });

  it('ignores a second rapid press so onEdit is not called twice', async () => {
    const onEdit = jest.fn();
    await render(
      <ThemeProvider>
        <SwipeableRow onEdit={onEdit} testID="swipe-edit-action-1">
          <Text>Shopping</Text>
        </SwipeableRow>
      </ThemeProvider>,
    );

    const editAction = screen.getByTestId('swipe-edit-action-1');
    await fireEvent.press(editAction);
    await fireEvent.press(editAction);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('translates the action pane in step with the drag instead of leaving it static', () => {
    let testRenderer: ReturnType<typeof create>;
    act(() => {
      testRenderer = create(
        <ThemeProvider>
          <SwipeableRow onEdit={jest.fn()} testID="swipe-edit-action-1">
            <Text>Shopping</Text>
          </SwipeableRow>
        </ThemeProvider>,
      );
    });

    const { renderRightActions } = testRenderer!.root.findByType(Swipeable).props;

    const translateXAt = (dragXValue: number) => {
      const progress = new Animated.Value(1);
      const dragX = new Animated.Value(dragXValue);
      const element = renderRightActions(progress, dragX);
      const [, { transform }] = element.props.style;
      return transform[0].translateX.__getValue();
    };

    // At rest (no drag yet) the pane sits fully offset, out of view.
    expect(translateXAt(0)).toBe(ACTION_WIDTH);
    // Fully swiped open, it's at its natural resting position.
    expect(translateXAt(-ACTION_WIDTH)).toBe(0);
    // Halfway through the drag, it's proportionally in between -- not static.
    expect(translateXAt(-ACTION_WIDTH / 2)).toBeCloseTo(ACTION_WIDTH / 2);
  });
});
