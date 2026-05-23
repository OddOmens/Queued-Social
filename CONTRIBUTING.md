# Contributing to Social Media Scheduler

Thank you for your interest in contributing to the Social Media Scheduler! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues

Before creating an issue, please:

1. **Search existing issues** to avoid duplicates
2. **Use the issue templates** when available
3. **Provide detailed information**:
   - Environment details (OS, Node.js version, browser)
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages and logs
   - Screenshots if applicable

### Suggesting Features

We welcome feature suggestions! Please:

1. **Check existing feature requests** first
2. **Describe the problem** your feature would solve
3. **Explain your proposed solution** in detail
4. **Consider the impact** on existing users
5. **Provide mockups or examples** if helpful

### Code Contributions

#### Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/OddOmens/queued-social.git
   cd queued-social
   ```
3. **Set up the development environment** (see [SETUP.md](SETUP.md))
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Development Guidelines

##### Code Style

- **TypeScript**: Use TypeScript for all new code
- **ESLint**: Follow the existing ESLint configuration
- **Prettier**: Code is automatically formatted on commit
- **Naming**: Use descriptive, camelCase variable names
- **Comments**: Add JSDoc comments for functions and complex logic

##### Component Guidelines

- **Functional Components**: Use React functional components with hooks
- **Props Interface**: Define TypeScript interfaces for all props
- **Error Boundaries**: Wrap components that might fail
- **Accessibility**: Follow WCAG guidelines, use semantic HTML
- **Responsive**: Ensure components work on all screen sizes

##### State Management

- **Zustand**: Use Zustand for global state
- **React Query**: Use for server state and caching
- **Local State**: Use `useState` for component-local state
- **Form State**: Use custom form validation hooks

##### Testing

- **Unit Tests**: Write tests for utilities and hooks
- **Component Tests**: Test component behavior and rendering
- **Integration Tests**: Test user workflows
- **E2E Tests**: Use Playwright for critical user journeys

Run tests before submitting:
```bash
npm run test
npm run test:e2e
```

##### Performance

- **Code Splitting**: Use dynamic imports for large components
- **Memoization**: Use `useMemo` and `useCallback` appropriately
- **Bundle Size**: Monitor bundle size impact
- **Images**: Optimize images and use appropriate formats

#### Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(auth): add LinkedIn OAuth integration
fix(calendar): resolve drag-and-drop positioning issue
docs(setup): update environment variable documentation
test(posts): add unit tests for post validation
```

#### Pull Request Process

1. **Update documentation** if needed
2. **Add or update tests** for your changes
3. **Ensure all tests pass**:
   ```bash
   npm run test
   npm run lint
   npm run type-check
   ```
4. **Update the changelog** if applicable
5. **Create a pull request** with:
   - Clear title and description
   - Link to related issues
   - Screenshots for UI changes
   - Testing instructions

#### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots
(If applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── calendar/       # Calendar-related components
│   ├── posts/          # Post management components
│   └── ui/             # Basic UI components
├── hooks/              # Custom React hooks
├── services/           # API and external service integrations
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── __tests__/          # Test files

supabase/
├── functions/          # Edge Functions
├── migrations/         # Database migrations
└── seed.sql           # Initial data
```

## 🧪 Testing Strategy

### Unit Tests
- **Location**: `src/__tests__/`
- **Framework**: Vitest
- **Coverage**: Aim for >80% coverage on utilities and hooks

### Component Tests
- **Framework**: React Testing Library
- **Focus**: User interactions and accessibility
- **Mock**: External dependencies and API calls

### Integration Tests
- **Framework**: Vitest + React Testing Library
- **Focus**: Component integration and data flow
- **Database**: Use test database with clean state

### E2E Tests
- **Framework**: Playwright
- **Focus**: Critical user journeys
- **Environment**: Isolated test environment

## 🔧 Development Tools

### Recommended VS Code Extensions

- **TypeScript**: Enhanced TypeScript support
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Tailwind CSS IntelliSense**: CSS class suggestions
- **Auto Rename Tag**: HTML tag renaming
- **GitLens**: Git integration

### Debugging

#### Browser DevTools
- Use React Developer Tools
- Enable Redux DevTools for Zustand
- Monitor network requests and performance

#### VS Code Debugging
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run"],
  "console": "integratedTerminal"
}
```

## 📋 Code Review Guidelines

### For Authors
- **Self-review** your code before requesting review
- **Provide context** in the PR description
- **Respond promptly** to feedback
- **Keep PRs focused** and reasonably sized

### For Reviewers
- **Be constructive** and respectful
- **Focus on code quality**, not personal preferences
- **Suggest improvements** with examples
- **Approve when ready**, don't nitpick minor issues

### Review Checklist
- [ ] Code follows project conventions
- [ ] Tests are adequate and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance impact considered
- [ ] Accessibility requirements met

## 🚀 Release Process

### Versioning
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps
1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release tag
4. Deploy to production
5. Create GitHub release with notes

## 🌟 Recognition

Contributors are recognized in:
- **README.md**: Contributors section
- **GitHub**: Contributor graphs and statistics
- **Releases**: Release notes mention contributors
- **Special Recognition**: Outstanding contributions highlighted

## 📞 Getting Help

- **Discord**: Join our community server
- **GitHub Discussions**: Ask questions and share ideas
- **Email**: Contact maintainers directly for sensitive issues
- **Office Hours**: Weekly community calls (schedule TBD)

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to Social Media Scheduler! 🎉