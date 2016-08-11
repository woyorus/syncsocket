const http = require('http').Server;
const testVersion = process.env.TEST_VERSION;
var Server;
if (testVersion === 'compat') {
    console.log('testing compat version');
    Server = require('../dist');
} else {
    Server = require('../src');
}
const expect = require('chai').expect;
// const connectClient = require('syncsocket-client');
const request = require('supertest');

describe('Server', function () {
    describe('server attachment', function () {
        describe('http.Server', function () {
            var clientVersion = require('syncsocket-client/package').version;

            it('should serve client', function (done) {
                var srv = http();
                Server(srv);
                request(srv)
                    .get('/syncsocket/syncsocket.js')
                    .buffer(true)
                    .end(function (err, res) {
                        if (err) return done(err);
                        var ctype = res.headers['content-type'];
                        expect(ctype).to.be.eql('application/javascript');
                        expect(res.headers.etag).to.be.eql(clientVersion);
                        expect(res.text).to.match(/syncsocket/);
                        expect(res.status).to.be.eql(200);
                        done();
                    });
            });

            it('should handle 304', function (done) {
                var srv = http();
                Server(srv);
                request(srv)
                    .get('/syncsocket/syncsocket.js')
                    .set('If-None-Match', clientVersion)
                    .end(function (err, res) {
                        if (err) return done(err);
                        expect(res.statusCode).to.be.equal(304);
                        done();
                    });
            });

            it('should not serve static files', function (done) {
                var srv = http();
                Server(srv, { serveClient: false });
                request(srv)
                    .get('/syncsocket/syncsocket.js')
                    .expect(400, done);
            });

            it('should work with #attach', function (done) {
                var srv = http(function (req, res) {
                    res.writeHead(404);
                    res.end();
                });
                var syncServer = Server();
                syncServer.attach(srv);
                request(srv)
                    .get('/syncsocket/syncsocket.js')
                    .end(function (err, res) {
                        if (err) return done(err);
                        expect(res.status).to.be.equal(200);
                        done();
                    });
            });
        });

        describe('port', function () {
            it('should be bound', function (done) {
                var srv = Server(55677);
                request('http://localhost:55677')
                    .get('/syncsocket/syncsocket.js')
                    .expect(200, done);
            });

            it('should be bound as a stirng', function (done) {
                var srv = Server('55687');
                request('http://localhost:55687')
                    .get('/syncsocket/syncsocket.js')
                    .expect(200, done);
            });

            it('with listen', function(done) {
                var srv = Server().listen(54011);
                request('http://localhost:54011')
                    .get('/syncsocket/syncsocket.js')
                    .expect(200, done);
            });

            it('as a string', function(done) {
                var srv = Server().listen('54012');
                request('http://localhost:54012')
                    .get('/syncsocket/syncsocket.js')
                    .expect(200, done);
            });
        });
    });
});
