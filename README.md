# SyncSocket

Synchronized messaging application framework server

[![Build Status](https://travis-ci.org/woyorus/syncsocket.svg?branch=master)](https://travis-ci.org/woyorus/syncsocket) [![codecov](https://codecov.io/gh/woyorus/syncsocket/branch/master/graph/badge.svg)](https://codecov.io/gh/woyorus/syncsocket) [![npm](https://img.shields.io/npm/v/syncsocket.svg?maxAge=2592000)](<>)

## API Docs

### Channel

Channel constructor.

**Parameters**

-   `server` **[Server](#server)** The server object
-   `opts` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options
    -   `opts.channelId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The channel id (string). If not passed, will generate a random one
    -   `opts.maxClients` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** Maximum allowed clients on the channel
    -   `opts.timeserver` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The timeserver which channel will use (if not set, will use the server's default)
    -   `opts.autoSyncClients` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** Automatically instruct unsynchronized clients to re-synchronize

#### addClient

Adds client to the channel

**Parameters**

-   `client` **Client** 

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** operation result

#### hasClient

Whether a client is joined this channel

**Parameters**

-   `client`  

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

### Server

Server constructor

**Parameters**

-   `opts`  Options
    -   `opts.maxChannels`  {number} Maximum channels allowed per server
    -   `opts.maxClients`  {number} Maximum clients allowed to connect to server
    -   `opts.defaultTimeserver`  {string} Default timeserver which channels will use

#### listen

Commands server to start listening for incoming clients

**Parameters**

-   `port`  Which port to use for listening

Returns **[Server](#server)** 

#### close

Shuts down the server

Returns **[Server](#server)** 

#### createChannel

Creates a channel

**Parameters**

-   `opts`  Options for the new channel (see {Channel} constructor docs)

Returns **[Channel](#channel)** that has been created

#### addToChannel

Adds a client to a specific channel

**Parameters**

-   `client` **Client** 
-   `opts` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options
    -   `opts.channelId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The channel ID to add client

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** Operation result

#### getChannel

Get specific channel

**Parameters**

-   `channelId`  Channel id

Returns **?[Channel](#channel)** 
