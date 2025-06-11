// Mock window.matchMedia for Ant Design (must be before any imports)
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import Settings from './Settings';
import '@testing-library/jest-dom/extend-expect';
import { MemoryRouter } from 'react-router-dom';

// Mock fetch for /users/me and other endpoints
beforeEach(() => {
  global.fetch = jest.fn((url, opts = {}) => {
    // /users/me (GET)
    if (url.includes('/users/me') && (!opts.method || opts.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ username: 'admin', email: 'admin@x.com', permission: 'Admin' })
      });
    }
    // /users/ (GET)
    if (url.endsWith('/users/') && (!opts.method || opts.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { username: 'admin', email: 'admin@x.com', permission: 'Admin' },
          { username: 'testuser', email: 'test@x.com', permission: 'Write' }
        ])
      });
    }
    // /provider/azure (GET)
    if (url.includes('/provider/azure') && (!opts.method || opts.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ clientId: 'abc', tenantId: 'def', last_updated: '2025-06-11T12:00:00Z' })
      });
    }
    // /logout (GET)
    if (url.includes('/logout')) {
      return Promise.resolve({ ok: true });
    }
    // Default
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

test('renders dashboard and shows username in navbar', async () => {
  window.history.pushState({}, '', '/dashboard');
  render(<App />);
  await waitFor(() => {
    const matches = screen.getAllByText((content) =>
      content.replace(/\s+/g, ' ').includes('Welcome to Cloud Valet Dashboard')
    );
    expect(matches.length).toBeGreaterThan(0);
  });
  await waitFor(() => expect(screen.getByText(/Hello, admin/i)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
});

test('renders settings and shows Users/Permissions for admin', async () => {
  window.history.pushState({}, '', '/settings');
  render(<App />);
  // Wait for Add User button (robust indicator of admin access)
  await waitFor(() => expect(screen.getByText(/Add User/i)).toBeInTheDocument());
  expect(screen.getByText(/Permissions/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/Hello, admin/i)).toBeInTheDocument());
});

test('redirects to login if not authenticated', async () => {
  global.fetch.mockImplementationOnce(() => Promise.resolve({ ok: false }));
  window.history.pushState({}, '', '/dashboard');
  render(<App />);
  await waitFor(() => expect(screen.queryByText(/Cloud Valet Dashboard/i)).not.toBeInTheDocument());
});

describe('Provider credentials form', () => {
  it('fetches provider info and does not display clientSecret', async () => {
    render(
      <MemoryRouter>
        <Settings username="admin" />
      </MemoryRouter>
    );
    // Wait for Provider menu to appear, then click
    await waitFor(() => expect(screen.getByText('Provider')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Provider'));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/provider/azure'),
      expect.objectContaining({ credentials: 'include' })
    ));
    expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
    expect(screen.getByDisplayValue('def')).toBeInTheDocument();
    // clientSecret field should be empty
    expect(screen.getByLabelText(/Client Secret/i).value).toBe('');
  });

  it('shows Save and Edit button logic', async () => {
    render(
      <MemoryRouter>
        <Settings username="admin" />
      </MemoryRouter>
    );
    // Wait for Provider menu to appear, then click
    await waitFor(() => expect(screen.getByText('Provider')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Provider'));
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});
