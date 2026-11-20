import { render, screen } from '@testing-library/react-native';

import App from '../App';

describe('App', () => {
  it('shows the Lisan placeholder screen', async () => {
    await render(<App />);

    expect(screen.getByText('Lisan')).toBeTruthy();
    expect(screen.getByText("Understand the Quran's Arabic")).toBeTruthy();
  });
});
