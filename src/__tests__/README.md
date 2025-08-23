# Testing Suite Documentation

This document provides an overview of the comprehensive testing suite implemented for the Social Media Scheduler application.

## Test Structure

The testing suite is organized into several categories:

### 1. Unit Tests (`src/__tests__/`)
- **Component Tests**: Test individual React components in isolation
- **Hook Tests**: Test custom React hooks
- **Service Tests**: Test business logic and service functions
- **Utility Tests**: Test utility functions and helpers

### 2. Integration Tests (`src/__tests__/integration/`)
- **Workflow Tests**: Test complete user workflows end-to-end
- **API Integration**: Test API endpoints with realistic data flows
- **Component Integration**: Test how components work together

### 3. Performance Tests (`src/__tests__/performance/`)
- **Database Performance**: Test database operation performance
- **Memory Usage**: Test memory efficiency and leak detection
- **Concurrent Operations**: Test system behavior under load

### 4. End-to-End Tests (`e2e/`)
- **User Workflows**: Test complete user journeys in a real browser
- **Cross-browser Testing**: Ensure compatibility across different browsers
- **Visual Regression**: Test UI consistency (when configured)

## Test Configuration

### Vitest Configuration (`vitest.config.mjs`)
- **Environment**: jsdom for DOM testing
- **Setup Files**: Global test setup and mocks
- **Coverage**: Code coverage reporting
- **Aliases**: Path aliases for imports

### Playwright Configuration (`playwright.config.ts`)
- **Browsers**: Chrome, Firefox, Safari, Mobile browsers
- **Reporters**: HTML reports for test results
- **Parallel Execution**: Tests run in parallel for speed

## Test Utilities

### Factories (`src/__tests__/factories/`)
Test data factories for creating consistent mock data:
- `userFactory.ts`: Create mock user data
- `postFactory.ts`: Create mock post and content data
- `timeSlotFactory.ts`: Create mock time slot configurations
- `platformFactory.ts`: Create mock platform and credential data

### Test Helpers (`src/__tests__/utils/testHelpers.ts`)
Utility functions for testing:
- `renderWithProviders()`: Render components with necessary providers
- `mockApiResponse()`: Mock API responses
- `mockSupabaseClient()`: Mock Supabase client
- `createMockFile()`: Create mock files for upload testing

### Test Configuration (`src/__tests__/config/testConfig.ts`)
Centralized test configuration:
- Performance thresholds
- Test data limits
- Mock API endpoints
- Environment setup utilities

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Integration Tests
```bash
npm run test:integration
```

### Performance Tests
```bash
npm run test:performance
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Categories by Feature

### Authentication
- Sign in/sign up workflows
- Session management
- Protected route access
- OAuth integration

### Post Management
- Post creation and editing
- Thread composition
- Media upload and processing
- Scheduling workflows

### Calendar Integration
- Calendar view rendering
- Post visualization
- Date navigation
- Event interactions

### Time Slots
- Time slot configuration
- Validation and conflict detection
- Timezone handling
- CRUD operations

### Platform Integration
- Platform plugin architecture
- Content validation
- Publishing workflows
- Error handling

## Performance Testing

### Thresholds
- Database queries: < 100ms
- API responses: < 200ms
- Component rendering: < 50ms
- Memory usage: < 50MB increase

### Metrics Tracked
- Execution time
- Memory consumption
- Concurrent operation handling
- Data processing efficiency

## Best Practices

### Test Organization
1. Group related tests in describe blocks
2. Use descriptive test names
3. Follow AAA pattern (Arrange, Act, Assert)
4. Keep tests focused and isolated

### Mocking Strategy
1. Mock external dependencies
2. Use factories for consistent test data
3. Mock at the appropriate level
4. Avoid over-mocking

### Performance Testing
1. Set realistic thresholds
2. Test with representative data sizes
3. Monitor memory usage
4. Test concurrent scenarios

### E2E Testing
1. Test critical user paths
2. Use page object patterns
3. Handle async operations properly
4. Test across different browsers

## Continuous Integration

The test suite is designed to run in CI/CD environments:

### GitHub Actions (Example)
```yaml
- name: Run Tests
  run: |
    npm run test:coverage
    npm run test:e2e
```

### Test Reports
- Unit test coverage reports
- Performance benchmark results
- E2E test screenshots and videos
- HTML test reports

## Troubleshooting

### Common Issues

1. **Mock not working**: Check mock setup in `setup.ts`
2. **Async test failures**: Ensure proper `await` usage
3. **Memory test failures**: Adjust thresholds for environment
4. **E2E test timeouts**: Increase timeout or optimize selectors

### Debug Mode
```bash
# Run tests with debug output
npm run test:watch -- --reporter=verbose

# Run E2E tests in headed mode
npm run test:e2e -- --headed
```

## Coverage Goals

- **Unit Tests**: > 80% code coverage
- **Integration Tests**: Cover all major workflows
- **E2E Tests**: Cover critical user journeys
- **Performance Tests**: Cover all database operations

## Future Enhancements

1. **Visual Regression Testing**: Add screenshot comparison
2. **Load Testing**: Add stress testing capabilities
3. **Accessibility Testing**: Add a11y test automation
4. **API Contract Testing**: Add schema validation tests
5. **Cross-platform Testing**: Add mobile device testing