// Local ESLint rules for what 05-METRICS asks of the SPA and no published plugin checks.

const MAX_USE_STATE = 6;
const QUERY_KEY_ROOTS = new Set(['api-keys', 'audit', 'content', 'dashboard', 'media', 'users']);

const isUseState = (node) =>
  node.callee.type === 'Identifier'
    ? node.callee.name === 'useState'
    : node.callee.type === 'MemberExpression' && node.callee.property.name === 'useState';

// M-RX-08
const maxUseState = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: { tooMany: 'M-RX-08: {{count}} useState calls, and the limit is 6.' },
  },
  create(context) {
    const counts = [];
    const enter = () => counts.push(0);
    const leave = (node) => {
      const count = counts.pop();
      if (count > MAX_USE_STATE) {
        context.report({ node, messageId: 'tooMany', data: { count: String(count) } });
      }
    };
    return {
      FunctionDeclaration: enter,
      'FunctionDeclaration:exit': leave,
      FunctionExpression: enter,
      'FunctionExpression:exit': leave,
      ArrowFunctionExpression: enter,
      'ArrowFunctionExpression:exit': leave,
      CallExpression(node) {
        if (isUseState(node) && counts.length > 0) counts[counts.length - 1] += 1;
      },
    };
  },
};

// M-STATE-02: an inline key starts with its feature, so invalidating ['content'] reaches it.
const queryKeyConvention = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { badRoot: 'M-STATE-02: a query key starts with its feature, not {{root}}.' },
  },
  create(context) {
    return {
      'Property[key.name="queryKey"] > ArrayExpression'(node) {
        const [first] = node.elements;
        if (first?.type === 'Literal' && QUERY_KEY_ROOTS.has(first.value)) return;
        context.report({
          node,
          messageId: 'badRoot',
          data: { root: first?.type === 'Literal' ? String(first.value) : 'a non-literal' },
        });
      },
    };
  },
};

export const cmsRules = {
  rules: { 'max-use-state': maxUseState, 'query-key-convention': queryKeyConvention },
};
