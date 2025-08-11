# Contributing to NewRelic MCP Server

Thank you for your interest in contributing to the NewRelic MCP Server! This document provides guidelines and information for contributors.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm 8.x or higher
- Git
- A NewRelic account for testing

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/newrelic-mcp-server.git
   cd newrelic-mcp-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your NewRelic credentials
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 📝 Development Guidelines

### Code Style

- We use ESLint and Prettier for code formatting
- Run `npm run lint` to check for linting errors
- Run `npm run format` to auto-format code
- Follow TypeScript best practices

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

Examples:
```
feat(api): add support for custom NRQL queries
fix(client): handle connection timeout errors
docs: update installation guide
```

### Branch Naming

- `feature/description` - for new features
- `fix/description` - for bug fixes
- `docs/description` - for documentation updates
- `refactor/description` - for code refactoring

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

### Writing Tests

- Write unit tests for all new functions and classes
- Use descriptive test names
- Follow the AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Aim for high test coverage

Example:
```typescript
describe('QueryService', () => {
  it('should execute NRQL query successfully', async () => {
    // Arrange
    const mockClient = createMockClient();
    const service = new QueryService(mockClient);
    const query = 'SELECT count(*) FROM Transaction';

    // Act
    const result = await service.executeQuery(query);

    // Assert
    expect(result).toBeDefined();
    expect(result.data).toHaveLength(1);
  });
});
```

## 📚 Documentation

- Update documentation for any new features or changes
- Use clear, concise language
- Include code examples where appropriate
- Update the API documentation in `docs/api.md`

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment details** (OS, Node.js version, package version)
2. **Steps to reproduce** the issue
3. **Expected behavior**
4. **Actual behavior**
5. **Error messages** or logs
6. **Configuration** (sanitized)

## 💡 Feature Requests

When requesting features:

1. **Describe the problem** you're trying to solve
2. **Explain the proposed solution**
3. **Provide use cases** and examples
4. **Consider alternatives** you've thought of

## 🔄 Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following the guidelines above
3. **Add or update tests** as needed
4. **Update documentation** if required
5. **Ensure all tests pass** and code is properly formatted
6. **Create a pull request** with a clear description

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No new warnings introduced
- [ ] Commit messages follow conventional format

## 🏗️ Architecture Guidelines

### Project Structure

```
src/
├── client/          # NewRelic API clients
├── config/          # Configuration management
├── interfaces/      # TypeScript interfaces
├── middleware/      # Express middleware
├── protocol/        # MCP protocol handlers
├── services/        # Business logic services
├── tools/           # MCP tools implementation
└── types/           # Type definitions
```

### Design Principles

- **Single Responsibility**: Each class/function should have one reason to change
- **Dependency Injection**: Use constructor injection for dependencies
- **Error Handling**: Always handle errors gracefully
- **Logging**: Use structured logging with appropriate levels
- **Configuration**: Make components configurable
- **Testing**: Write testable code with clear interfaces

### Adding New Features

1. **Define interfaces** first
2. **Implement core logic** with proper error handling
3. **Add comprehensive tests**
4. **Update documentation**
5. **Consider backward compatibility**

## 🚀 Release Process

Releases are automated through GitHub Actions:

1. **Merge to main** triggers the release workflow
2. **Version is determined** from package.json
3. **Docker images** are built and pushed
4. **GitHub release** is created automatically
5. **Documentation** is deployed to GitHub Pages

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check the docs/ directory

## 🙏 Recognition

Contributors will be recognized in:
- The project README
- Release notes
- GitHub contributors page

Thank you for contributing to NewRelic MCP Server! 🎉