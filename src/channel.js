/**
 *  Module dependencies
 */


const EventEmitter = require('events').EventEmitter;
const util = require('util');
const debug = require('debug')('syncsocket:channel');
const genuuid = require('./genuuid');
const bind = require('component-bind');
const ClockClient = require('syncsocket-clock-client');


/**
 *  Module exports
 */

module.exports = Channel;

/**
 * Mix in Emitter
 */

util.inherits(Channel, EventEmitter);

/**
 * Channel constructor.
 * @param server The server object
 * @param opts Options
 * @param opts.channelId {string} The channel id (string). If not passed, will generate a random one
 * @param opts.maxClients {number} Maximum allowed clients on the channel
 * @param opts.autoSyncClients {boolean} Automatically instruct unsynchronized clients to re-synchronize
 * @constructor
 * @public
 */
function Channel(server, opts) {
    if (!(this instanceof Channel)) return new Channel(server, opts);

    opts = opts || {};

    this.server = server;
    this.channelId = opts.channelId || genuuid();
    this.maxClients = opts.maxClients || 32;
    this.timeserver = opts.timeserver || this.server.defaultTimeserver;
    this.autoSyncClients = typeof opts.autoSyncClients === 'boolean' ? opts.autoSyncClients : true;
    this.tag = opts.tag;
    this.locals = {};

    this.clients = [];
    this.clientStates = {};

    // Hackery
    this.setMaxListeners(150);

    this.clockClient = ClockClient(this.timeserver);
    this.synchronized = false;
    this.sync();
}

Channel.prototype.sync = function () {
    this.clockClient.sync()
        .then(syncResult => {
            if (syncResult.successful === true) {
                this.onSyncSuccess(syncResult);
            }
            else {
                this.onSyncFailure(syncResult);
            }
        })
        .catch(err => {
            console.error(err);
        });
};

Channel.prototype.onSyncSuccess = function (result) {
    this.synchronized = true;
    this.lastSyncResult = result;
    debug('channel sync successful! (error=%s, precision=%s)', result.adjust, result.error);
};

Channel.prototype.onSyncFailure = function (result) {
    this.synchronized = false;
    debug('channel sync failed! (precision=%s)', result.error);
    debug('retrying in 1 second...');
    setTimeout(() => this.sync(), 1000);
};

/**
 * Adds client to the channel
 * @param client
 * @returns {boolean}
 * @public
 */
Channel.prototype.addClient = function (client) {
    if (this.clients.length >= this.maxClients) {
        debug('maximum number of clients per channel hit');
        return false;
    }

    this.clients.push(client);
    this.clientStates[client.id] = 'unknown';

    this.emit('clientJoined', client);

    return true;
};

/**
 * Kicks the client out of the channel
 * @param client
 * @private
 */
Channel.prototype.removeClient = function (client) {
    var idx = this.clients.indexOf(client);
    if (idx > -1) {
        this.emit('clientLeft', client);
        debug(' > [%s] client removed: %s', this.channelId, client.tag);
        this.clients.splice(idx, 1);
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
 * Instructs the client to syncrhonize with the timeserver
 * @param client
 * @private
 */
Channel.prototype.synchronizeClient = function (client) {
    var envelope = {
        channelId: this.channelId,
        topic: 'service.synchronize',
        data: {}
    };

    client.send(envelope);
};

/**
 * Whether a client is joined this channel
 * @param client
 * @returns {boolean}
 * @ublic
 */
Channel.prototype.hasClient = function (client) {
    return this.clients.indexOf(client) != -1;
};

/**
 * Simply broadcasts a message to channel
 * @param envelope
 * @private
 */
Channel.prototype.fanout = function (envelope) {
    this.clients.forEach(function (client) {
        client.send(envelope);
    });
};

/**
 * Send a 'prepare' message to a single client directly.
 * @param client
 * @param topic
 * @param payload
 * @returns {Promise} which is resolved once client moves to ready state.
 * @public
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
 * @public
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
 * @public
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
    }
    else if (topicParts[0] === 'user') {
        this.processUserMessage(envelope, originatingClient);
    }
};

/**
 * Processes messages posted to _SYSTEM channel
 * @param envelope
 * @param originatingClient
 * @private
 */
Channel.prototype.processServiceMessage = function (envelope, originatingClient) {
    if (envelope.topic == 'service.reportstate') {
        var oldState = this.clientStates[originatingClient.id];
        var newState = envelope.data.toState;
        this.clientStates[originatingClient.id] = newState;

        debug(' > [%s] client switched state: toState->%s, client: %s',
            this.channelId, newState, originatingClient.tag);

        this.emit('clientStateChange', originatingClient, newState);

        switch (newState) {

            case 'uninitialized':
                this.initializeClient(originatingClient);
                break;

            case 'unsynchronized':
                if (this.autoSyncClients === true) {
                    this.synchronizeClient(originatingClient);
                }
                break;

            case 'idle':
                if (oldState === 'unsynchronized') {
                    this.emit('clientResynchronized', originatingClient);
                }
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

    if (envelope.headers['x-passthrough'] === true) {
        this.fanout(envelope);
        return;
    }

    this.emit('prepareMessage', envelope);

    var targetClients = this.prepareIdleClients(envelope, originatingClient);

    this.waitUntilReady(targetClients)
        .then(readyClients => {
            let timeticket = this.getChannelTime() + 500;
            this.scheduleClients(envelope, readyClients, timeticket);
        });
};

/**
 * Selects all idle clients, sends them prepare message and waits until all are ready
 * @param envelope
 * @param initiatingClient
 * @returns {Promise}
 * @private
 */
Channel.prototype.prepareIdleClients = function (envelope, initiatingClient) {
    var idleClients = this.getIdleClients();
    var that = this;

    idleClients.forEach(function (idleClient) {
        that.prepareClient(idleClient, envelope);
    });

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
        clients.forEach(function (client) {
            ready = ready && (that.clientStates[client.id] === 'ready');
        });
        return ready;
    };

    return new Promise(function (resolve, reject) {

        var onClientStateUpdate = function (client, newState) {
            if (allReady() === true) {
                that.removeListener('clientStateChange', onClientStateUpdate);
                resolve(clients);
            }
        };

        that.on('clientStateChange', bind(this, onClientStateUpdate));
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
        if (that.clientStates[client.id] == 'idle') {
            idleClients.push(client);
        }
    });
    return idleClients;
};

/**
 * Instruct a client to prepare for a message
 * @param client
 * @param envelope
 * @private
 */
Channel.prototype.prepareClient = function (client, envelope) {
    envelope.topic = envelope.topic + '.prepare';
    client.send(envelope);
};

/**
 * Schedules clients, i.e. instructs them to set up timers
 * @param envelope The message
 * @param clients Clients to be scheduled
 * @param time Timestamp in timeserver coordinates the scheduling is made for
 * @private
 */
Channel.prototype.scheduleClients = function (envelope, clients, time) {
    clients.forEach(client => {
        this.scheduleClient(client, envelope, time);
    });
    this.emit('scheduledMessage', envelope, time);
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
