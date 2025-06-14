# Cypress Setup for Cloud Valet Frontend

## 1. Install Cypress

From your project root, run:

```
npm install --save-dev cypress
```

## 2. Add Cypress scripts to package.json

Add to your `package.json` scripts section:

```
"cypress:open": "cypress open",
"cypress:run": "cypress run"
```

## 3. Directory Structure

Cypress tests are in:
```
cloud-valet-frontend/cypress/e2e/
```

## 4. Running Cypress

- To open the interactive test runner:
  ```
  npm run cypress:open
  ```
- To run all tests headlessly:
  ```
  npm run cypress:run
  ```

## 5. Test File

Your main E2E test files are:
```
cypress/e2e/dashboard.cy.js
cypress/e2e/settings.cy.js
```

## 6. Notes
- **No backend or database is required for Cypress tests.** All API calls are fully mocked using `cy.intercept()`.
- You can add more tests in the same folder.
- These tests do not require you to modify your React code or add test IDs (but using them can make selectors more robust).
- **In CI:** Cypress runs as a separate job, building and serving only the frontend.
- See the main `README.md` for more details on CI and test structure.
