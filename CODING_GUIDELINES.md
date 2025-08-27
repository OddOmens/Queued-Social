# Coding Guidelines - Variable Hoisting Prevention

## Overview
This document outlines coding practices to prevent JavaScript variable hoisting issues that can occur during minification.

## 🚫 Avoid These Patterns

### ❌ Array Destructuring in Callbacks
```javascript
// BAD - Can cause hoisting issues
posts.map(([date, posts]) => ({ date, posts }))
entries.sort(([a], [b]) => a.localeCompare(b))

// BAD - Variable destructuring in callback body
posts.map((entry) => {
  const [date, posts] = entry
  return { date, posts }
})
```

### ❌ Object Destructuring in Array Methods
```javascript
// BAD
Object.entries(data).map(([key, value]) => ({ key, value }))
```

## ✅ Use These Patterns Instead

### ✅ Explicit Array Access
```javascript
// GOOD - Explicit array access
posts.map((entry) => {
  const date = entry[0]
  const posts = entry[1]
  return { date, posts }
})

entries.sort((entryA, entryB) => {
  const a = entryA[0]
  const b = entryB[0]
  return a.localeCompare(b)
})
```

### ✅ Object Property Access
```javascript
// GOOD
Object.entries(data).map((entry) => {
  const key = entry[0]
  const value = entry[1]
  return { key, value }
})
```

### ✅ Named Parameters
```javascript
// GOOD - When you don't need destructuring
posts.map((post) => post.title)
posts.filter((post) => post.published)
```

## 🔧 Safe Destructuring Contexts

Destructuring is safe in these contexts:

### ✅ Function Parameters (React Components)
```javascript
// SAFE
function Component({ title, children }) {
  return <div>{title}{children}</div>
}
```

### ✅ Top-level Variable Declarations
```javascript
// SAFE
const [state, setState] = useState()
const { data, loading } = useQuery()
```

### ✅ Outside of Array/Object Method Chains
```javascript
// SAFE
const entries = Object.entries(data)
const [firstEntry] = entries
const processedEntries = entries.map(entry => processEntry(entry))
```

## 🛠 Tools and Enforcement

1. **ESLint**: Custom rules prevent problematic patterns
2. **TypeScript**: Strict mode catches potential issues
3. **Pre-commit hooks**: Automatic checking before commits
4. **Code review**: Manual verification of array method usage

## 📋 Checklist for Code Reviews

- [ ] No destructuring in `.map()`, `.forEach()`, `.filter()`, `.reduce()` callbacks
- [ ] No destructuring in `.sort()` comparison functions  
- [ ] No array/object destructuring inside `useMemo()` or `useCallback()` array methods
- [ ] Explicit array access used instead: `item[0]`, `item[1]`, etc.
- [ ] Object property access used: `entry.key`, `entry.value`, etc.

## 🚨 Error Patterns to Watch For

If you see these errors, check for destructuring patterns:
- "Cannot access 'x' before initialization"
- "ReferenceError" in minified code
- Variables with single-letter names ('y', 'p', 'a', etc.) in error messages

## 📚 Related Documentation

- [MDN: Destructuring Assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)
- [JavaScript Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)
- [ESLint Configuration](./eslint-rules/no-destructuring-in-callbacks.js)
