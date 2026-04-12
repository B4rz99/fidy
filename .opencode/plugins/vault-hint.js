module.exports = {
  name: 'vault-hint',
  version: '1.0.0',
  executeBefore: ['tool.execute.before'],
  handler: async (context) => {
    const fs = require('fs');
    const path = require('path');
    const vaultIndex = path.join(context.cwd, 'vault/wiki/index.md');
    if (fs.existsSync(vaultIndex)) {
      return {
        hint: 'vault: Decisions and context for this project live in ./vault/wiki/. Read vault/wiki/index.md for relevant decisions before making changes.'
      };
    }
    return null;
  }
};
