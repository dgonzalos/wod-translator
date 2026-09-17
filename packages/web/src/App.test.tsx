import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EXAMPLE_WODS } from '@wod-translator/shared';
import { App } from './App';

describe('App', () => {
  it('renders the example count loaded from @wod-translator/shared', () => {
    render(<App />);
    expect(
      screen.getByText(new RegExp(String(EXAMPLE_WODS.length))),
    ).toBeInTheDocument();
  });

  it('renders every example label', () => {
    render(<App />);
    for (const example of EXAMPLE_WODS) {
      expect(screen.getByText(example.label)).toBeInTheDocument();
    }
  });
});
