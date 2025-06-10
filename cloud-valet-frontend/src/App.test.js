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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import '@testing-library/jest-dom/extend-expect';

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
