const http = require('http');
const sio = require('socket.io');
const read = require('fs').readFileSync;
const debug = require('debug')('syncsocket:server');
const Channel = require('./channel');
const Client = require('./client');
const genuuid = require('./genuuid');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const clientVersion = require('syncsocket-client/package').version;
const clientSource = read(require.resolve('syncsocket-client/syncsocket.js'), 'utf-8');
const ClockServer = require('syncsocket-clock-server');

module.exports = Server;

util.inherits(Server, EventEmitter);

/**
 * Server constructor
 * @param {http.Server|number|object} srv http server, port or options
 * @param {object} opts
 * @property {boolean} embeddedTimeserver If set to true, an embedded timeserver will be launched
 * @property {string} timeserverHost Clients will connect to this timeserver if no timeserver specified for channel
 * @property {number} timeserverPort Clients will connect to this timeserver if no timeserver specified for channel
 * @constructor
 * @public
 */
function Server(srv, opts) {
    if (!(this instanceof Server)) return new Server(srv, opts);
    if ('object' === typeof srv && !srv.listen) {
        opts = srv;
        srv = null;
    }
    opts = opts || {};
    this.path('/syncsocket');
    this.serveClient(false !== opts.serveClient);
    this.embeddedTimeserver(opts.embeddedTimeserver || false);
    this.timeserverHost(opts.timeserverHost || 'localhost');
    this.timeserverPort(opts.timeserverPort || 5579);
    this.defaultTimeserverUrl = 'http://' + this.timeserverHost() + ':' + this.timeserverPort();
    this.channels = [];
    if (srv) this.attach(srv, opts);
}

/**
 * Sets client serving path
 * @param {string} p path
 * @returns {Server|string} self when setting or value when getting
 * @public
 */
Server.prototype.path = function (p) {
    if (!arguments.length) return this._path;
    this._path = p.replace(/\/$/, '');
    return this;
};

/**
 * Sets/gets whether client code is being served
 * @param {boolean} v whether to serve client code
 * @return {Server|boolean} self when setting or value when getting
 * @public
 */
Server.prototype.serveClient = function (v) {
    if (!arguments.length) return this._serveClient;
    this._serveClient = v;
    return this;
};

/**
 * Sets/gets whether embedded timeserver is active
 * @param {boolean} v whether to activate integrated timeserver
 * @returns {Server|boolean} self when setting or value when getting
 * @public
 */
Server.prototype.embeddedTimeserver = function (v) {
    if (!arguments.length) return this._embeddedTimeserver;
    this._embeddedTimeserver = v;
    return this;
};

/**
 * Sets/gets timeserver host to which clients will connect if no timeserver specified for channel
 * @param {string} v default host
 * @returns {Server|string} self when setting or value when getting
 * @public
 */
Server.prototype.timeserverHost = function (v) {
    if (!arguments.length) return this._timeserverHost;
    this._timeserverHost = v;
    return this;
};

/**
 * Sets/gets timeserver port to which clients will connect if no timeserver specified for channel
 * @param {number} v default port
 * @returns {Server|number} self when setting or value when getting
 * @public
 */
Server.prototype.timeserverPort = function (v) {
    if (!arguments.length) return this._timeserverPort;
    this._timeserverPort = v;
    return this;
};

/**
 * Attaches to a server or port
 * @param {http.Server|number} server or port
 * @param {Object} options
 * @returns {Server} self
 * @public
 */
Server.prototype.listen =
Server.prototype.attach = function (srv, opts) {
    if ('function' === typeof srv) {
        var msg = 'You are trying to attach socket.io to an express ' +
            'request handler function. Please pass a http.Server instance.';
        throw new Error(msg);
    }

    // handle a port as a string
    if (Number(srv) == srv) {
        srv = Number(srv);
    }

    if ('number' === typeof srv) {
        debug('creating server and binding to port %d', srv);
        var port = srv;
        srv = http.Server(function (req, res) {
            res.writeHead(404);
            res.end();
        });
        srv.listen(port);
    }

    opts = opts || {};
    opts.path = this.path();

    // Initialize socket.io
    debug('creating socket.io instance with opts %j', opts);
    this.io = sio(srv, opts);
    // static client file serving
    if (this._serveClient) this.attachServe(srv);
    if (this._embeddedTimeserver) this.setupTimeserver();
    this.httpServer = srv;
    this.io.on('connection', this.onconnection.bind(this));
    this.io.use(this.validateConnection);

    return this;
};

/**
 * Sets up a parallel, embedded timeserver
 * @private
 */
Server.prototype.setupTimeserver = function () {
    debug('activating embedded timeserver on default port');
    this.timeserver = ClockServer();
    this.timeserver.listen(this.timeserverPort());
};

/**
 * Incoming connection verification function. Server-side handshake
 * @param {sio.Socket} socket incoming connection
 * @param {Function} next middleware handler
 * @private
 */
Server.prototype.validateConnection = function (socket, next) {
    var id = socket.handshake.query.instanceId;
    if ('undefined' === typeof id) {
        debug('cannot accept connection from client, no instanceId is provided (addr: %s)',
            socket.handshake.address);
        socket.disconnect();
        return next(new Error('handshake failed'));
    }
    next();
};

/**
 * Attaches static file serving
 * @param {Function|http.Server} srv http server
 * @private
 */
Server.prototype.attachServe = function (srv) {
    debug('attaching handler for serving client');
    var url = this._path + '/syncsocket.js';
    var evs = srv.listeners('request').slice(0);
    var self = this;
    srv.removeAllListeners('request');
    srv.on('request', function (req, res) {
        if (0 === req.url.indexOf(url)) {
            self.serve(req, res);
        } else {
            for (var i = 0; i < evs.length; i++) {
                evs[i].call(srv, req, res);
            }
        }
    });
};

/**
 * Handles request for `/syncsocket.js`
 * @param {http.Request} req
 * @param {http.Response} res
 * @private
 */
Server.prototype.serve = function (req, res) {
    var etag = req.headers['if-none-match'];
    if (etag) {
        if (clientVersion === etag) {
            debug('serve client 304');
            res.writeHead(304);
            res.end();
            return;
        }
    }
    debug('serving client source');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('ETag', clientVersion);
    res.writeHead(200);
    res.end(clientSource);
};

/**
 * Creates a channel
 * @param {?string} channelId - channel id or null. If null, then id will be generated
 * @returns {Channel} that has been created
 * @public
 */
Server.prototype.createChannel = function (channelId) {
    var opts = {};
    opts.channelId = channelId || genuuid();
    var channel = new Channel(this, opts);
    this.channels.push(channel);
    debug('created channel with id %s', channel.channelId);
    return channel;
};

/**
 * Called on every validated incoming connection
 * @param {sio.Socket} socket
 * @private
 */
Server.prototype.onconnection = function (socket) {
    var client = new Client(this, socket);
    client.instanceId = socket.handshake.query.instanceId;
    client.id = genuuid();
    client.tag = client.instanceId + '@' + client.id;
    debug('new client: ' + client.id);
    /**
     * Client has successfully connected
     * @event Server#connection
     * @type {Client}
     */
    this.emit('connection', client);
};

/**
 *
 * @param req
 * @param fn
 * @param client
 * @private
 */
Server.prototype.handleRequest = function (req, client, fn) {
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
                fn();
            } else {
                fn(new Error('cannot add user to channel'));
            }

            break;
    }
};

/**
 * All incoming from clients messages handled here
 * @param {object} envelope topic and data
 * @param {Client} client
 * @private
 */
Server.prototype.handleMessage = function (envelope, client) {
    debug('handling message from client ' + client.id);
    var channelId = envelope.channelId;
    var channel = this.getChannel(channelId);
    if ('object' === typeof channel) {
        // Verify that the client currently in that channel
        if (channel.hasClient(client)) {
            channel.injectMessage(envelope, client);
        }
    }
};

/**
 * Adds a client to a specific channel
 * @param {Client} client
 * @param {object} opts Options
 * @param {string} opts.channelId The channel ID to add client
 * @returns {boolean} Operation result
 * @public
 */
Server.prototype.addToChannel = function (client, opts) {
    var channel = this.getChannel(opts.channelId);

    if (channel) {
        channel.addClient(client);
        return true;
    }

    return false;
};

/**
 * Get specific channel
 * @param channelId Channel id
 * @returns {?Channel}
 * @public
 */
Server.prototype.getChannel = function (channelId) {
    var ch;
    this.channels.forEach(function (channel) {
        if (channel.channelId === channelId) {
            ch = channel;
        }
    });
    return ch;
};

/**
 *
 * @param client
 * @private
 */
Server.prototype.clientDisconnected = function (client) {
    this.channels.forEach(function (channel) {
        channel.removeClient(client);
    });
    /**
     * Client has disconnected
     * @event Server#disconnect
     * @type {Client}
     */
    this.emit('disconnect', client);
};

/**
 * Shuts down the server
 * @returns {Server}
 * @public
 */
Server.prototype.close = function () {
    this.io.close();
    if (this.httpServer) {
        this.httpServer.close();
    }
    if (this.timeserver) {
        this.timeserver.close();
    }
};
