# SyncSocket

Synchronized messaging application framework server

[![Build Status](https://travis-ci.org/woyorus/syncsocket.svg?branch=master)](https://travis-ci.org/woyorus/syncsocket) [![codecov](https://codecov.io/gh/woyorus/syncsocket/branch/master/graph/badge.svg)](https://codecov.io/gh/woyorus/syncsocket) [![npm](https://img.shields.io/npm/v/syncsocket.svg?maxAge=2592000)](<>) [![npm](https://img.shields.io/npm/dm/syncsocket.svg?maxAge=2592000)](<>) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

## API Docs

### Channel

Channel constructor.

**Parameters**

-   `server` **[Server](#server)** The server object
-   `opts` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** Options
    -   `opts.channelId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The channel id (string). If not passed, will generate a random one
    -   `opts.timeserver` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The timeserver which channel will use (if not set, will use the server's default)
    -   `opts.autoSyncClients` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** Automatically instruct unsynchronized clients to re-synchronize

#### addClient

Adds client to the channel

**Parameters**

-   `client` **Client** 

#### hasClient

Whether a client is joined this channel

**Parameters**

-   `client`  

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

### Channel#error

Channel error

### Channel#join

Client joined the channel

### Channel#left

Client left the channel

### Channel#clientStateChange

Client has switched state

**Properties**

-   `client` **Client** 
-   `newState` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

### Channel#scheduledMessage

An event has been scheduled

**Properties**

-   `envelope` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `time` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

### Server

Server constructor

**Parameters**

-   `srv` **(http.Server | [number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) \| [object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object))** http server, port or options
-   `opts` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

**Properties**

-   `embeddedTimeserver` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** If set to true, an embedded timeserver will be launched
-   `timeserverHost` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** Clients will connect to this timeserver if no timeserver specified for channel
-   `timeserverPort` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** Clients will connect to this timeserver if no timeserver specified for channel

#### timeserverUrl

URL of server's default timeserver (set via timeserverHost() and timeserverPort())

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** URL

#### serveClient

Sets/gets whether client code is being served

**Parameters**

-   `v` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** whether to serve client code

Returns **([Server](#server) \| [boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean))** self when setting or value when getting

#### embeddedTimeserver

Sets/gets whether embedded timeserver is active

**Parameters**

-   `v` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** whether to activate integrated timeserver

Returns **([Server](#server) \| [boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean))** self when setting or value when getting

#### timeserverHost

Sets/gets timeserver host to which clients will connect if no timeserver specified for channel

**Parameters**

-   `v` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** default host

Returns **([Server](#server) \| [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** self when setting or value when getting

#### timeserverPort

Sets/gets timeserver port to which clients will connect if no timeserver specified for channel

**Parameters**

-   `v` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** default port

Returns **([Server](#server) \| [number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number))** self when setting or value when getting

#### listen

Attaches to a server or port

**Parameters**

-   `server` **(http.Server | [number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number))** or port
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Server](#server)** self

#### createChannel

Creates a channel

**Parameters**

-   `channelId` **?[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** channel id or null. If null, then id will be generated

Returns **?[Channel](#channel)** that has been created or null

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

#### close

Shuts down the server

Returns **[Server](#server)** 

### Server#connection

Client has successfully connected

### Server#disconnect

Client has disconnected
