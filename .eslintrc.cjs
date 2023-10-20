module.exports = {
  env: {
    es2021: true
  },
  extends: ['standard', '@scriptable-ios'],
  overrides: [
    {
      env: {
        node: true
      },
      files: [
        '.eslintrc.{js,cjs}'
      ],
      parserOptions: {
        sourceType: 'script'
      }
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'space-before-function-paren': 0
  }
}
