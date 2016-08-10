const expect = require('chai').expect;

const Server = require('../src/index');

describe('Server', function () {
    it('should create _SYSTEM channel', function () {
        var srv = Server();
        expect(srv.channels).be.of.length(1);
    });
});
