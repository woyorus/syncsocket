var expect = require('chai').expect;
var sinon = require('sinon');
var Emitter = require('events').EventEmitter;
var Client = require('./../src/client');

describe('Client', function () {
    let stubSocket = new Emitter();

    it('should call handle message', function () {
        let mockServer = {
            handleMessage: sinon.spy()
        };
        let client = new Client(mockServer, stubSocket);
        let message = { topic: 'fake' };
        stubSocket.emit('message', message);
        sinon.assert.calledOnce(mockServer.handleMessage);
        sinon.assert.calledWith(mockServer.handleMessage, message, client);
    });
});
