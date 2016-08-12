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
const ioc = require('socket.io-client');

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

    describe('embedded timeserver', function () {
        it('should point to localhost:5579 by default', function () {
            var srv = Server(32323, { embeddedTimeserver: true });
            expect(srv.timeserverHost()).to.be.equal('localhost');
            expect(srv.timeserverPort()).to.be.equal(5579);
            expect(srv.timeserverUrl()).to.be.equal('http://localhost:5579');
            srv.close();
        });

        it('should allow setting custom host and port', function () {
            var srv = Server(32322, { embeddedTimeserver: true });
            srv.timeserverHost('google.com');
            srv.timeserverPort(80);
            expect(srv.timeserverHost()).to.be.equal('google.com');
            expect(srv.timeserverPort()).to.be.equal(80);
            expect(srv.timeserverUrl()).to.be.equal('http://google.com:80');
            srv.close();
        });

        it('should accept connections', function (done) {
            var srv = Server(32442, { embeddedTimeserver: true });
            request(srv.timeserverUrl())
                .get('/')
                .expect(400, () => { srv.close(); done(); });
        });

        it('should accept connections on different port', function (done) {
            var srv = Server(32333, { embeddedTimeserver: true });
            srv.timeserverPort(5888);
            expect(srv.timeserverUrl()).to.be.equal('http://localhost:5888');
            request(srv.timeserverUrl())
                .get('/')
                .expect(400, () => { srv.close(); done(); });
        });

        it('should not accept connections when disabled', function (done) {
            var srv = Server(32332, { embeddedTimeserver: false });
            expect(srv.timeserverUrl()).to.be.eql('http://localhost:5579');
            request(srv.timeserverUrl())
                .get('/')
                .end(function (err, res) {
                    expect(err).not.to.be.null;
                    expect(res).to.be.undefined;
                    done();
                });
        });
    });

    describe('handshake validator', function () {
        it('should not allow connection without instanceId query', function (done) {
            var srv = Server(32223, { embeddedTimeserver: false });
            var io = ioc('http://localhost:32223', { path: '/syncsocket' });
            io.on('connect', () => done(new Error()));
            io.on('disconnect', (err) => {
                expect(err).not.to.be.null;
                srv.close();
                done();
            });
        });

        it('should allow connection with instanceId query', function (done) {
            var srv = Server(32223, { embeddedTimeserver: false });
            var socket = ioc('http://localhost:32223', { path: '/syncsocket', reconnection: false, query: { instanceId: 'some-instance' } });
            socket.once('connect', () => { srv.close(); done(); });
        });
    });

    describe('#createChannel', function () {
        let srv;

        before(function (done) {
            srv = Server(32223, { embeddedTimeserver: true });
            done();
        });

        after(function (done) {
            srv.close();
            done();
        });

        it('should create a channel', function () {
            var testId = 'test-id';
            expect(srv.getChannel(testId)).to.be.not.ok;
            let ch = srv.createChannel(testId);
            expect(ch).to.be.an('object');
            expect(ch.channelId).to.be.equal(testId);
            expect(ch).to.be.equal(srv.getChannel(testId));
        });

        it('should not create two channels with same id', function () {
            var testId = 'test-id-2';
            expect(srv.createChannel(testId)).to.be.an('object');
            expect(srv.createChannel(testId)).to.be.not.ok;
        });
    });

    describe('#handleRequest', function () {
        let srv;

        before(function (done) {
            srv = Server(32223, { embeddedTimeserver: true });
            done();
        });

        after(function (done) {
            srv.close();
            done();
        });

        it('should reject invalid requests', function (done) {
            let socket = ioc('http://localhost:32223', { path: '/syncsocket', reconnection: false, query: { instanceId: 'some-instance' } });
            socket.on('connect', () => {
                let req = { what: 'invalid-request' };
                socket.emit('request', req, (err, response) => {
                    expect(err).not.to.be.null;
                    expect(response).to.be.undefined;
                    done();
                });
            });
        });

        it('should reject invalid request join_channel', function (done) {
            let socket = ioc('http://localhost:32223', { path: '/syncsocket', reconnection: false, query: { instanceId: 'some-instance' } });
            socket.on('connect', () => {
                let req = { what: 'join_channel', body: undefined };
                socket.emit('request', req, (err, response) => {
                    expect(err).not.to.be.null;
                    expect(response).to.be.undefined;
                    done();
                });
            });
        });

        it('should reject join_channel request with invalid channel id', function (done) {
            let socket = ioc('http://localhost:32223', { path: '/syncsocket', reconnection: false, query: { instanceId: 'some-instance' } });
            socket.on('connect', () => {
                let req = { what: 'join_channel', body: { channelId: 'invalid-fake', canPublish: true } };
                socket.emit('request', req, (err, response) => {
                    expect(err).not.to.be.null;
                    expect(response).to.be.undefined;
                    done();
                });
            });
        });
    });

    describe('#handleMessage', function () {
        let srv;

        before(function (done) {
            srv = Server(32223, { embeddedTimeserver: true });
            done();
        });

        after(function (done) {
            srv.close();
            done();
        });

        it('should disconnect after an invalid message', function (done) {
            let socket = ioc('http://localhost:32223', {path: '/syncsocket', reconnection: false, query: {instanceId: 'some-instance'}});
            socket.once('disconnect', () => done());
            socket.on('connect', () => {
                socket.emit('message');
            });
        });

        it('should disconnect after message to non-joined channel', function (done) {
            let socket = ioc('http://localhost:32223', {path: '/syncsocket', reconnection: false, query: {instanceId: 'some-instance'}});
            socket.once('disconnect', () => done());
            socket.on('connect', () => {
                socket.emit('message', { channelId: 'fake-channel', topic: 'any' });
            });
        });
    });

    describe('events', function () {
        let srv;

        beforeEach(function (done) {
            srv = Server(32223, { embeddedTimeserver: true });
            done();
        });

        afterEach(function (done) {
            srv.close();
            done();
        });

        it('should emit `connection` event', function (done) {
            srv.once('connection', () => done());
            let socket = ioc('http://localhost:32223', {path: '/syncsocket', reconnection: false, query: {instanceId: 'some-instance'}});
        });

        it('should emit `disconnect` event', function (done) {
            srv.on('disconnect', () => done());
            let socket = ioc('http://localhost:32223', {path: '/syncsocket', forceNew: true, query: {instanceId: 'some-instance'}});
            socket.on('connect', () => socket.disconnect());
        });
    });
});
