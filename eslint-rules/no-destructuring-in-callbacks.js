/**
 * Custom ESLint rule to prevent destructuring in array callback functions
 * that can cause variable hoisting issues during minification
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow destructuring assignment in array callback functions to prevent hoisting issues',
      category: 'Possible Errors',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noDestructuringInCallback: 'Avoid destructuring in array callback functions. Use explicit array/object access instead to prevent variable hoisting issues during minification.',
    },
  },
  
  create(context) {
    function checkForDestructuring(node) {
      // Check if we're in an array method callback
      if (node.parent && 
          node.parent.type === 'CallExpression' && 
          node.parent.callee && 
          node.parent.callee.property &&
          ['map', 'forEach', 'filter', 'reduce', 'sort', 'find', 'some', 'every'].includes(node.parent.callee.property.name)) {
        
        // Check for array destructuring in parameters
        if (node.params && node.params.length > 0) {
          node.params.forEach(param => {
            if (param.type === 'ArrayPattern' || param.type === 'ObjectPattern') {
              context.report({
                node: param,
                messageId: 'noDestructuringInCallback',
                fix(fixer) {
                  // Auto-fix suggestion (simplified)
                  if (param.type === 'ArrayPattern' && param.elements.length <= 2) {
                    const paramName = 'item';
                    return fixer.replaceText(param, paramName);
                  }
                  return null;
                }
              });
            }
          });
        }
        
        // Check for destructuring assignments in the function body
        if (node.body && node.body.type === 'BlockStatement') {
          node.body.body.forEach(statement => {
            if (statement.type === 'VariableDeclaration') {
              statement.declarations.forEach(declaration => {
                if (declaration.id && 
                    (declaration.id.type === 'ArrayPattern' || declaration.id.type === 'ObjectPattern')) {
                  context.report({
                    node: declaration.id,
                    messageId: 'noDestructuringInCallback',
                  });
                }
              });
            }
          });
        }
      }
    }
    
    return {
      ArrowFunctionExpression: checkForDestructuring,
      FunctionExpression: checkForDestructuring,
    };
  },
};
