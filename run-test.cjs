// Disable SSL verification before loading any modules
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require('ts-node').register();
require('./src/test/checker.test.ts');
