// cypress/e2e/settings.cy.js

describe('Cloud Valet Settings (frontend-only)', () => {
  beforeEach(() => {
    // Mock /users/me
    cy.intercept('GET', '/users/me', {
      statusCode: 200,
      body: { username: 'admin', permission: 'Admin', email: 'admin@x.com' },
    });

    // Mock /users/ for user lists
    cy.intercept('GET', '/users/', {
      statusCode: 200,
      body: [
        { username: 'admin', email: 'admin@x.com', permission: 'Admin' },
        { username: 'writeuser', email: 'write@x.com', permission: 'Write' },
        { username: 'readuser', email: 'read@x.com', permission: 'Read' },
      ],
    });

    // Mock PUT for bulk modify
    cy.intercept('PUT', /\/users\/.*/, {
      statusCode: 200,
      body: {},
    });

    // Mock provider info
    cy.intercept('GET', '/provider/azure', {
      statusCode: 200,
      body: { clientId: 'mock-client', tenantId: 'mock-tenant', clientSecret: 'mock-secret' },
    });

    // Mock logout
    cy.intercept('GET', '/logout', {
      statusCode: 200,
      body: {},
    });
  });

  it('shows user list and permissions', () => {
    cy.visit('http://localhost:3000/settings');
    cy.contains('Users').should('be.visible');
    cy.contains('admin').should('be.visible');
    cy.contains('writeuser').should('be.visible');
    cy.contains('readuser').should('be.visible');
  });

  it('can open and close Add User modal', () => {
    cy.visit('http://localhost:3000/settings');
    cy.contains('Add User').click();
    cy.get('.ant-modal').should('be.visible');
    cy.get('.ant-modal-close').click();
    cy.get('.ant-modal').should('not.exist');
  });

  it('can bulk modify user permissions', () => {
    cy.visit('http://localhost:3000/settings');
    cy.contains('Permissions').click();
    cy.contains('Modify').click();
    cy.contains('Bulk Modify Permissions').should('be.visible');
    // Select users in the Select component
    cy.get('.ant-modal .ant-select').first().click();
    cy.get('.ant-select-item-option').contains('writeuser').click();
    cy.get('.ant-select-item-option').contains('readuser').click();
    cy.get('body').type('{esc}'); // close dropdown
    // Select permission
    cy.get('.ant-modal .ant-select').eq(1).click();
    cy.get('.ant-select-item-option').contains('Write').click();
    cy.get('body').type('{esc}'); // close dropdown
    cy.contains('Update').click({ force: true });
    cy.contains('Bulk Modify Permissions').should('not.exist');
    cy.contains('Permissions updated successfully').should('be.visible');
  });

  it('shows provider info', () => {
    cy.visit('http://localhost:3000/settings');
    cy.contains('Provider').click();
    cy.get('input[name="clientId"]').should('have.value', 'mock-client');
    cy.get('input[name="tenantId"]').should('have.value', 'mock-tenant');
    cy.get('input[name="clientSecret"]').should('have.value', 'mock-secret');
  });
});
