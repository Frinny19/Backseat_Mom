import { fireEvent, render, screen } from '@testing-library/react-native';

import { Ribbon } from '../Ribbon';

describe('Ribbon', () => {
  it('labels each chip with its category, time and detail for screen readers', async () => {
    const onPress = jest.fn();
    await render(
      <Ribbon
        items={[
          { activity: 'sleep', label: 'Napping', time: '0:42:18', detail: 'Started 9:00', active: true, onPress },
          { activity: 'feed', label: 'Feed', time: '2 h 15 m ago', detail: 'Left side' },
          { activity: 'pump', label: 'Pump', time: 'Never', never: true },
        ]}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByLabelText('Napping, running 0:42:18, Started 9:00')).toBeTruthy();
    expect(screen.getByLabelText('Feed, 2 h 15 m ago, Left side')).toBeTruthy();
    expect(screen.getByText('Never')).toBeTruthy();
    expect(screen.getByLabelText('Choose categories')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ribbon-chip-sleep'));
    expect(onPress).toHaveBeenCalled();
  });

  it('can hide the Edit chip', async () => {
    await render(<Ribbon items={[]} onEdit={false} />);
    expect(screen.queryByLabelText('Choose categories')).toBeNull();
  });
});
