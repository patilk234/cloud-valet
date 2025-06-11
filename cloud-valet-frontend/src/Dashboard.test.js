import { act } from 'react';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import '@testing-library/jest-dom/extend-expect';

// Patch window.matchMedia, window.ResizeObserver, and window.getComputedStyle for Ant Design in all test runs
function patchDomMocks() {
  if (!globalThis.matchMedia) {
    globalThis.matchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!globalThis.getComputedStyle) {
    globalThis.getComputedStyle = () => ({
      getPropertyValue: () => '',
    });
  }
}

// Patch to silence Ant Design warnings in test output and avoid infinite recursion
let origWarn;
beforeAll(() => {
  patchDomMocks();
  // Silence Ant Design warnings
  origWarn = console.warn;
  jest.spyOn(console, 'warn').mockImplementation((msg, ...args) => {
    if (
      typeof msg === 'string' &&
      (msg.includes('Warning: [antd:') || msg.includes('findDOMNode is deprecated'))
    ) {
      return;
    }
    if (origWarn && console.warn !== origWarn) {
      return origWarn(msg, ...args);
    }
    return;
  });
});

beforeEach(() => {
  patchDomMocks();
  // Silence Ant Design warnings
  if (!origWarn) origWarn = console.warn;
  jest.spyOn(console, 'warn').mockImplementation((msg, ...args) => {
    if (
      typeof msg === 'string' &&
      (msg.includes('Warning: [antd:') || msg.includes('findDOMNode is deprecated'))
    ) {
      return;
    }
    if (origWarn && console.warn !== origWarn) {
      return origWarn(msg, ...args);
    }
    return;
  });
});

// Mock fetch for /azure/vms and /azure/vm/action
beforeEach(() => {
  global.fetch = jest.fn((url, opts) => {
    if (url.includes('/azure/vms')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          vms: [
            { name: 'mock-vm1', resourceGroup: 'mock-group', location: 'eastus', status: 'VM deallocated' },
            { name: 'mock-vm2', resourceGroup: 'mock-group', location: 'westus', status: 'VM running' },
            { name: 'mock-vm3', resourceGroup: 'mock-group', location: 'centralus', status: 'VM stopped' },
          ],
        }),
      });
    }
    if (url.includes('/azure/vm/action')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    }
    return Promise.reject(new Error('Unknown endpoint'));
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

afterAll(() => {
  // Restore original warn
  if (origWarn) {
    console.warn = origWarn;
    origWarn = undefined;
  }
});

describe('Dashboard VM Actions', () => {
  it('renders VMs and disables/enables action buttons correctly', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <Dashboard username="admin" permission="Admin" darkMode={false} setDarkMode={() => {}} />
        </MemoryRouter>
      );
    });
    await waitFor(() => expect(screen.getByText('mock-vm1')).toBeInTheDocument());
    // VM1 (deallocated): Start enabled, others disabled
    const vm1Row = screen.getByText('mock-vm1').closest('tr');
    expect(vm1Row.querySelector('[title="Start VM"] .anticon')).not.toHaveStyle('color: #aaa');
    expect(vm1Row.querySelector('[title="Deallocate VM"] .anticon')).toHaveStyle('color: #aaa');
    expect(vm1Row.querySelector('[title="PowerOff"] .anticon')).toHaveStyle('color: #aaa');
    expect(vm1Row.querySelector('[title="Restart VM"] .anticon')).toHaveStyle('color: #aaa');
    // VM2 (running): Start disabled, others enabled
    const vm2Row = screen.getByText('mock-vm2').closest('tr');
    expect(vm2Row.querySelector('[title="Start VM"] .anticon')).toHaveStyle('color: #aaa');
    expect(vm2Row.querySelector('[title="Deallocate VM"] .anticon')).not.toHaveStyle('color: #aaa');
    expect(vm2Row.querySelector('[title="PowerOff"] .anticon')).not.toHaveStyle('color: #aaa');
    expect(vm2Row.querySelector('[title="Restart VM"] .anticon')).not.toHaveStyle('color: #aaa');
    // VM3 (stopped): PowerOff and Restart disabled
    const vm3Row = screen.getByText('mock-vm3').closest('tr');
    expect(vm3Row.querySelector('[title="PowerOff"] .anticon')).toHaveStyle('color: #aaa');
    expect(vm3Row.querySelector('[title="Restart VM"] .anticon')).toHaveStyle('color: #aaa');
  });

  it('shows confirmation modal and calls action API', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <Dashboard username="admin" permission="Admin" darkMode={false} setDarkMode={() => {}} />
        </MemoryRouter>
      );
    });
    await waitFor(() => expect(screen.getByText('mock-vm1')).toBeInTheDocument());
    // Click Start for mock-vm1
    const vm1Row = screen.getByText('mock-vm1').closest('tr');
    fireEvent.click(vm1Row.querySelector('[title="Start VM"] .anticon'));
    // Modal should appear
    expect(await screen.findByText(/Confirm Start VM/i)).toBeInTheDocument();
    // Confirm action
    fireEvent.click(screen.getByText('Start'));
    // Wait for fetch to be called
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/azure/vm/action'),
      expect.objectContaining({ method: 'POST' })
    ));
  });
});
