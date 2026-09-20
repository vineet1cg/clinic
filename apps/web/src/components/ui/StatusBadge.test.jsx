import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge.jsx';

describe('StatusBadge', () => {
  it('renders a readable queue status', () => {
    render(<StatusBadge status="WAITING" />);

    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toHaveAttribute('data-status', 'WAITING');
  });
});
