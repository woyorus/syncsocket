
/**
 *  Module dependencies
 */

const io = require('socket.io');
const debug = require('debug')('syncsocket:server');
const Channel = require('./channel');
const Client = require('./client');
const genuuid = require('./genuuid');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const bind = require('component-bind');
const ClockServer = require('syncsocket-clock-server');

/**
 * Module exports
 */

module.exports = Server;

/**
 * Mix in EventEmitter
 */

util.inherits(Server, EventEmitter);


/**
 * Server constructor
 * @param opts Options
 * @param opts.maxChannels {number} Maximum channels allowed per server
 * @param opts.maxClients {number} Maximum clients allowed to connect to server
 * @param opts.defaultTimeserver {string} Default timeserver which channels will use
 * @constructor
 * @public
 */
function Server(opts) {
    if (!(this instanceof Server)) return new Server(opts);

    opts = opts || {};
    this.maxChannels = opts.maxChannels || 64;
    this.maxClients = opts.maxClients || 1024;
    this.defaultTimeserver = opts.defaultTimeserver || 'http://localhost:5579';

    this.clockServer = ClockServer();
    this.clockServer.listen(5579);

    this.setup();
}

/**
 * Sets up the server
 * @private
 */
Server.prototype.setup = function () {
    this.io = io();
    this.io.on('connection', bind(this, 'onconnection'));
    // Setup the _SYSTEM channel
    this.systemChannel = new Channel(this, {
        channelId: '_SYSTEM',
        maxClients: this.maxClients
    });
    this.clients = [];
    this.channels = [this.systemChannel];
    this.listening = false;
    this.io.use(function (socket, next) {
        var id = socket.handshake.query.instanceId;
        if (typeof id === 'undefined') {
            debug('cannot accept connection from client, no instanceId is provided (addr: %s)',
                socket.handshake.address);
            socket.disconnect();
            return next(new Error('handshake failed'));
        }
        next();
    });
};

/**
 * Commands server to start listening for incoming clients
 * @param port Which port to use for listening
 * @returns {Server}
 * @public
 */
Server.prototype.listen = function (port) {
    this.io.listen(port);
    this.listening = true;
    debug('Server is listening on port ' + port + '!');
    return this;
};

/**
 * Shuts down the server
 * @returns {Server}
 * @public
 */
Server.prototype.close = function () {
    if (this.listening === false)
        return this;
    this.io.close();
    this.listening = false;
    this.clockServer.close();
    debug('Server is shutting down now.');
    return this;
};

/**
 * Creates a channel
 * @param opts Options for the new channel (see Channel constructor docs)
 * @public
 */
Server.prototype.createChannel = function (opts) {
    opts = opts || {};
    opts.channelId = opts.channelId || genuuid();
    var channel = new Channel(this, opts);
    this.channels.push(channel);
    debug('Created channel: ' + channel.channelId);
    return channel;
};

/**
 *
 * @param socket
 * @private
 */
Server.prototype.onconnection = function (socket) {
    this.configureClient(socket);
};

/**
 *
 * @param socket
 * @private
 */
Server.prototype.configureClient = function (socket) {
    var client = new Client(this, socket);
    client.instanceId = socket.handshake.query.instanceId;
    client.id = genuuid();
    client.tag = client.instanceId + '@' + client.id;
    this.clients.push(client);
    this.systemChannel.addClient(client);
    debug('new client: ' + client.id);
    this.emit('connection', client);
};

/**
 *
 * @param req
 * @param fn
 * @param client
 * @private
 */
Server.prototype.handleRequest = function (req, fn, client) {
    var what = req.what;
    var data = req.body;
    debug('handling request %s from client %s', what, client.id);

    switch (what) {
        case 'join_channel':

            var opts = {
                canPublish: data.canPublish,
                channelId: data.channelId
            };

            if (this.addToChannel(client, opts) === true) {
                fn(null, { status: 'success' });
            } else {
                fn(new Error('cannot add user to channel'));
            }

            break;

        case 'channel_state':
            var channelId = data.channelId;
            var channel = this.getChannel(channelId);
            if (channel.hasClient(client)) {
                this.emit('channelStateRequest', client, channel, fn);
            } else {
                fn(new Error('Client must join channel first to get state'));
            }
            break;
    }
};

/**
 *
 * @param client
 * @param opts
 * @returns {boolean}
 */
Server.prototype.addToChannel = function (client, opts) {
    var channel = this.getChannel(opts.channelId);

    if (channel !== null) {
        channel.addClient(client);
        this.emit('join', client, channel);
        return true;
    }

    return false;
};

/**
 *
 * @param channelId
 * @returns {*}
 */
Server.prototype.getChannel = function (channelId) {
    var ch = null;
    this.channels.forEach(function (channel) {
        if (channel.channelId === channelId) {
            ch = channel;
        }
    });
    return ch;
};

/**
 *
 * @param envelope
 * @param client
 * @private
 */
Server.prototype.handleMessage = function (envelope, client) {
    //debug('handling message from client ' + client.id);
    var channelId = envelope.channelId;
    var channel = this.getChannel(channelId);
    if (channel !== null) {
        // Verify that the client currently in that channel
        if (channel.hasClient(client)) {
            channel.injectMessage(envelope, client);
            this.emit('inject', envelope, client, channel);
        }
    }
};

/**
 *
 * @param client
 * @private
 */
Server.prototype.clientDisconnected = function (client) {
    this.emit('disconnect', client);
    this.channels.forEach(function (channel) {
        channel.removeClient(client);
    });
};
