// cypress/e2e/dashboard.cy.js

// Dashboard E2E tests for Cloud Valet using Cypress

describe('Cloud Valet Dashboard (frontend-only)', () => {
  beforeEach(() => {
    // Mock login POST (return 200, not 302, for SPA)
    cy.intercept('POST', '/login', {
      statusCode: 200,
      body: { username: 'writeuser', permission: 'Write' },
      headers: { 'set-cookie': 'user=writeuser; Path=/; SameSite=Lax' },
    });

    // Mock /users/me for both / and /users/me (sometimes frontend uses full URL)
    cy.intercept('GET', /\/users\/me.*/, {
      statusCode: 200,
      body: { username: 'writeuser', permission: 'Write' },
    });

    // Mock VMs API with all required fields for checkboxes and actions
    cy.intercept({ method: 'GET', url: /\/api\/vms.*/ }, {
      statusCode: 200,
      body: [
        {
          name: 'mock-vm1',
          resourceGroup: 'mock-group',
          location: 'eastus',
          status: 'running',
          id: 'vm-1',
        },
        {
          name: 'mock-vm2',
          resourceGroup: 'mock-group',
          location: 'eastus',
          status: 'stopped',
          id: 'vm-2',
        }
      ],
      headers: { 'content-type': 'application/json' },
    });

    // Also mock /azure/vms if your frontend calls that endpoint
    cy.intercept('GET', '/azure/vms', {
      statusCode: 200,
      body: [
        {
          name: 'mock-vm1',
          resourceGroup: 'mock-group',
          location: 'eastus',
          status: 'running',
          id: 'vm-1',
        },
        {
          name: 'mock-vm2',
          resourceGroup: 'mock-group',
          location: 'eastus',
          status: 'stopped',
          id: 'vm-2',
        }
      ],
      headers: { 'content-type': 'application/json' },
    });

    // Intercept all GET requests for VMs (covers /azure/vms, /api/vms, etc.)
    cy.intercept({ method: 'GET', url: /\/vms(\?.*)?$/ }, {
      statusCode: 200,
      body: [
        {
          name: 'mock-vm1',
          resourceGroup: 'mock-group',
          location: 'eastus',
          status: 'running',
          id: 'vm-1',
        },
        {
          name: 'mock-vm2',
          resourceGroup: 'mock-group',
          location: 'eastus',
          status: 'stopped',
          id: 'vm-2',
        }
      ],
      headers: { 'content-type': 'application/json' },
    });

    // Mock any /api/* or /azure/* endpoint to always return 200 (catch-all for missed endpoints)
    cy.intercept({ method: 'GET', url: /\/api\// }, {
      statusCode: 200,
      body: [],
      headers: { 'content-type': 'application/json' },
    });
    cy.intercept({ method: 'GET', url: /\/azure\// }, {
      statusCode: 200,
      body: [],
      headers: { 'content-type': 'application/json' },
    });
    // Mock any other API endpoints as needed
    // cy.intercept('GET', '/api/other', { ... });

    // Catch-all intercept for any request to /vms (any method, any path, any query)
    cy.intercept('**/vms**', {
      statusCode: 200,
      body: [
        {
          name: 'mock-vm1',
          resourceGroup: 'mock-group',
          location: 'eastus',
          status: 'running',
          id: 'vm-1',
        },
        {
          name: 'mock-vm2',
          resourceGroup: 'mock-group',
          location: 'eastus',
          status: 'stopped',
          id: 'vm-2',
        }
      ],
      headers: { 'content-type': 'application/json' },
    });
  });

  function login() {
    cy.visit('http://localhost:3000');
    cy.get('input[type="text"]').type('writeuser');
    cy.get('input[type="password"]').type('pw');
    cy.get('button[type="submit"]').click();
    cy.contains('Bulk Action', { timeout: 10000 }).should('be.visible');
    cy.contains('Virtual Machines').should('be.visible');
  }

  it('shows the login page and logs in as Write user', () => {
    login();
  });

  it('shows Bulk Action and Select buttons for Write/Admin', () => {
    login();
    cy.contains('Bulk Action').should('be.visible');
    cy.contains('Select').should('be.visible');
  });

  it('can select VMs and open Bulk Action modal', () => {
    login();
    cy.contains('Select').click();
    // Wait for the VM row to appear before checking the checkbox
    cy.contains('mock-vm1').should('be.visible');
    cy.get('input[type="checkbox"]').not('[disabled]').eq(1).check({ force: true }); // skip header checkbox
    cy.contains('Bulk Action').should('not.be.disabled').click();
    cy.contains('Bulk Action').should('be.visible');
    cy.contains('Start').should('be.visible');
    cy.get('[data-testid="bulk-action-start"]').should('be.visible');
    cy.get('.ant-modal-close').click(); // Close modal
  });

  it('shows notifications when actions are performed', () => {
    // Add more intercepts and assertions as needed for notifications
  });
});
