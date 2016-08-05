
/**
 *  Module dependencies
 */

const debug = require('debug')('syncsocket:client');
const bind = require('component-bind');

/**
 *  Module exports
 */

module.exports = Client;

/**
 * Client constructor
 * @param server
 * @param socket
 * @constructor
 * @public
 */
function Client(server, socket) {
    if (!(this instanceof Client)) return new Client(server, socket);

    this.server = server;
    this.socket = socket;
    this.tag    = 'unknown-client';
    this.bindEvents();
}

/**
 * Push message to the client.
 * The message will be delivered as soon as possible without
 * any synchrnoziation. On the client,
 * @param  {[type]} topic     [description]
 * @param  {[type]} data      [description]
 */
Client.prototype.pushMessage = function (topic, data) {
    this.socket.emit('inbound.' + topic, data);
};

/**
 * Sends a message to client
 * @param envelope
 * @private
 */
Client.prototype.send = function (envelope) {
    this.socket.emit('message', envelope);
};

Client.prototype.bindEvents = function () {
    this.socket.on('request', bind(this, 'onRequest'));
    this.socket.on('message', bind(this, 'onMessage'));
    this.socket.on('disconnect', bind(this, 'onDisconnect'));
};

Client.prototype.onRequest = function (req, fn) {
    this.server.handleRequest(req, fn, this);
};

Client.prototype.onMessage = function (envelope) {
    this.server.handleMessage(envelope, this);
};

Client.prototype.onDisconnect = function () {
    this.server.clientDisconnected(this);
};
