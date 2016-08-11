module.exports = Client;

/**
 * Client constructor
 * @param server
 * @param socket
 * @constructor
 * @private
 */
function Client(server, socket) {
    if (!(this instanceof Client)) return new Client(server, socket);
    this.server = server;
    this.socket = socket;
    this.bindEvents();
}

/**
 * Sends a message to client
 * @param envelope
 * @private
 */
Client.prototype.send = function (envelope) {
    this.socket.emit('message', envelope);
};

Client.prototype.bindEvents = function () {
    this.socket.on('request', this.onRequest.bind(this));
    this.socket.on('message', this.onMessage.bind(this));
    this.socket.on('disconnect', this.onDisconnect.bind(this));
};

Client.prototype.onRequest = function (req, fn) {
    this.server.handleRequest(req, this, fn);
};

Client.prototype.onMessage = function (envelope) {
    this.server.handleMessage(envelope, this);
};

Client.prototype.onDisconnect = function () {
    this.server.clientDisconnected(this);
};
