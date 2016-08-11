const testVersion = process.env.TEST_VERSION;
const connect = require('syncsocket-client');
var Server;
if (testVersion === 'compat') {
    console.log('testing compat version');
    Server = require('../dist');
} else {
    Server = require('../src');
}
const expect = require('chai').expect;

function client() {
    return connect('http://localhost:6024');
}

describe('Server', function () {
    describe('listen', function () {
        it('should begin listening on default port 6024', function (done) {
            var srv = Server();
            srv.listen();
            var cli = client();
            cli.on('connected', function () {
                srv.close();
                done();
            });
        });

        it('should create _SYSTEM channel', function () {
            var srv = Server();
            srv.listen();
            expect(srv.channels).be.of.length(1);
            srv.close();
        });
    });
});
