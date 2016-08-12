const EventEmitter = require('events').EventEmitter;
const util = require('util');
const debug = require('debug')('syncsocket:channel');
const ClockClient = require('syncsocket-clock-client');

module.exports = Channel;

util.inherits(Channel, EventEmitter);

/**
 * Channel constructor.
 * @type {Channel}
 * @param {Server} server The server object
 * @param {object} opts Options
 * @param {string} opts.channelId The channel id (string). If not passed, will generate a random one
 * @param {string} opts.timeserver The timeserver which channel will use (if not set, will use the server's default)
 * @param {boolean} opts.autoSyncClients  Automatically instruct unsynchronized clients to re-synchronize
 * @constructor
 * @public
 */
function Channel(server, opts) {
    if (!(this instanceof Channel)) return new Channel(server, opts);

    this.server = server;
    opts = opts || {};
    this.channelId = opts.channelId;
    this.timeserver = opts.timeserver || this.server.defaultTimeserver;

    this.clients = [];
    this.clientStates = {};

    // Hackery
    this.setMaxListeners(150);

    this.clockClient = ClockClient(this.timeserver);
    this.sync();
}

Channel.prototype.sync = function () {
    this.clockClient.sync()
        .then(syncResult => {
            if (syncResult.successful === true) {
                this.onSyncSuccess(syncResult);
            } else {
                this.onSyncFailure(syncResult);
            }
        })
        .catch(err => {
            console.error(err);
        });
};

Channel.prototype.onSyncSuccess = function (result) {
    this.lastSyncResult = result;
    debug('channel sync successful! (error=%d, precision=%d)', result.adjust, result.error);
};

Channel.prototype.onSyncFailure = function (result) {
    debug('channel sync failed! (precision=%s)', result.error);
    debug('retrying in 1 second...');
    setTimeout(() => this.sync(), 1000);
};

/**
 * Adds client to the channel
 * @param {Client} client
 * @public
 */
Channel.prototype.addClient = function (client) {
    this.clients.push(client);
    this.clientStates[client.id] = 'unknown';
    /**
     * Client joined the channel
     * @event Channel#join
     * @type {Client}
     */
    this.emit('join', client);
};

/**
 * Kicks the client out of the channel
 * @param client
 * @private
 */
Channel.prototype.removeClient = function (client) {
    var idx = this.clients.indexOf(client);
    if (idx > -1) {
        this.clients.splice(idx, 1);
        /**
         * Client left the channel
         * @event Channel#left
         * @type {Client}
         */
        this.emit('left', client);
    }
};

/**
 * Initializes client, by providing it the channel's timeserver
 * @param client
 * @private
 */
Channel.prototype.initializeClient = function (client) {
    var envelope = {
        channelId: this.channelId,
        topic: 'service.initialize',
        data: {
            timeserver: this.timeserver
        }
    };
    client.send(envelope);
};

/**
 * Whether a client is joined this channel
 * @param client
 * @returns {boolean}
 * @public
 */
Channel.prototype.hasClient = function (client) {
    return this.clients.indexOf(client) !== -1;
};

/**
 * Send a 'prepare' message to a single client directly.
 * @param client
 * @param topic
 * @param payload
 * @returns {Promise} which is resolved once client moves to ready state.
 * @private
 */
Channel.prototype.prepareSingleClient = function (client, topic, payload) {
    var envelope = {
        topic: 'user.' + topic,
        channelId: this.channelId,
        headers: {
            'x-origin-id': 0
        },
        data: payload
    };

    this.prepareClient(client, envelope);
    return this.waitUntilReady([client]);
};

/**
 * Send a 'schedule' message (for particular time) to a single client directly.
 * @param client
 * @param topic
 * @param payload
 * @param time
 * @private
 */
Channel.prototype.scheduleSingleClient = function (client, topic, payload, time) {
    var envelope = {
        topic: 'user.' + topic,
        channelId: this.channelId,
        headers: {
            'x-origin-id': 0
        },
        data: payload
    };

    this.scheduleClient(client, envelope, time);
};

/**
 * Returns current time in channel time coordinates (e.g. timeserver coordinates)
 * @private
 */
Channel.prototype.getChannelTime = function () {
    var time = Date.now() + this.lastSyncResult.adjust;
    return parseInt(time);
};

/**
 * Injects a message
 * @param envelope
 * @param originatingClient
 * @private
 */
Channel.prototype.injectMessage = function (envelope, originatingClient) {
    debug(' > [%s] injecting message: %s (by %s)', this.channelId, envelope.topic, originatingClient.tag);

    var topic = envelope.topic;
    var topicParts = topic.split('.');

    if (topicParts[0] === 'service') {
        this.processServiceMessage(envelope, originatingClient);
    } else if (topicParts[0] === 'user') {
        this.processUserMessage(envelope, originatingClient);
    }
};

/**
 * Processes service messages. Currently only `reportstate` message is supported
 * @param envelope
 * @param client
 * @private
 */
Channel.prototype.processServiceMessage = function (envelope, client) {
    if (envelope.topic === 'service.reportstate') {
        var newState = envelope.data.toState;
        this.clientStates[client.id] = newState;

        debug(' > [%s] client switched state: toState->%s, client: %s',
            this.channelId, newState, client.tag);

        /**
         * Client has switched state
         * @event Channel#clientStateChange
         * @type {object}
         * @property {Client} client
         * @property {string} newState
         */
        this.emit('clientStateChange', { client: client, newState: newState });

        switch (newState) {
            case 'uninitialized':
                this.initializeClient(client);
                break;
        }
    }
};

/**
 * Processes user messages (messages that are not in the _SYSTEM channel)
 * @param envelope {Object}
 * @param originatingClient {Client} who originated the message.
 * @private
 */
Channel.prototype.processUserMessage = function (envelope, originatingClient) {
    envelope.channelId = this.channelId;

    // Append origin header
    envelope.headers = envelope.headers || {};
    envelope.headers['x-origin-id'] = originatingClient.id;

    var targetClients = this.prepareIdleClients(envelope, originatingClient);

    this.waitUntilReady(targetClients)
        .then(readyClients => {
            let timeticket = this.getChannelTime() + 500;
            this.scheduleClients(envelope, readyClients, timeticket);
        });
};

/**
 * Selects all idle clients, sends them prepare message and waits until all are ready
 * @param {object} envelope - message
 * @returns {Array<Client>} Clients that were instructed to prepare
 * @private
 */
Channel.prototype.prepareIdleClients = function (envelope) {
    var idleClients = this.getIdleClients();

    envelope.topic = envelope.topic + '.prepare';

    for (var i = 0; i < idleClients.length; i++) {
        idleClients[i].send(envelope);
    }

    return idleClients;
};

/**
 * Waits for clients to be switched to the 'ready' state
 * @param clients Clients, that we wait for
 * @returns {Promise} Promise, which is satisfied as soon as all the clients do transition
 * @private
 */
Channel.prototype.waitUntilReady = function (clients) {
    var that = this;

    var allReady = function () {
        var ready = true;
        for (var i = 0; i < clients.length; i++) {
            ready = ready && (that.clientStates[clients[i].id] === 'ready');
        }
        return ready;
    };

    // TODO: Cancel processing and reject if a client is not ready for too long
    return new Promise(function (resolve, reject) {
        var onClientStateUpdate = function (client, newState) {
            if (allReady() === true) {
                that.removeListener('clientStateChange', onClientStateUpdate);
                resolve(clients);
            }
        };
        that.on('clientStateChange', onClientStateUpdate.bind(this));
    });
};

/**
 * Returns array of clients in the channel that are in the 'idle' state
 * @returns {Array}
 * @private
 */
Channel.prototype.getIdleClients = function () {
    var idleClients = [];
    var that = this;
    this.clients.forEach(function (client) {
        if (that.clientStates[client.id] === 'idle') {
            idleClients.push(client);
        }
    });
    return idleClients;
};

/**
 * Schedules clients, i.e. instructs them to set up timers
 * @param envelope The message
 * @param clients Clients to be scheduled
 * @param time Timestamp in timeserver coordinates the scheduling is made for
 * @private
 */
Channel.prototype.scheduleClients = function (envelope, clients, time) {
    for (var i = 0; i < clients.length; i++) {
        this.scheduleClient(clients[i], envelope, time);
    }
    /**
     * An event has been scheduled
     * @event Channel#scheduledMessage
     * @type {object}
     * @property {object} envelope
     * @property {number} time
     */
    this.emit('scheduledMessage', { envelope: envelope, time: time });
};

/**
 * Schedules a single client
 * @param client
 * @param envelope
 * @param time
 * @private
 */
Channel.prototype.scheduleClient = function (client, envelope, time) {
    envelope.headers = envelope.headers || {};
    envelope.headers['x-cct-timeticket'] = time;
    var topicParts = envelope.topic.split('.');
    envelope.topic = topicParts[0] + '.' + topicParts[1] + '.schedule';
    client.send(envelope);
};
