const testVersion = process.env.TEST_VERSION;
var Server;
if (testVersion === 'compat') {
    console.log('testing compat version');
    Server = require('../dist');
} else {
    Server = require('../src');
}
const expect = require('chai').expect;
const connectClient = require('syncsocket-client');

describe('Server', function () {
    it('should be the same version as client', function () {
        var version = require('../package.json').version;
        expect(version).to.be.eql(require('syncsocket-client/package').version);
    });
});
