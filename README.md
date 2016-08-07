# syncsocket

Synchronized messaging application framework server

[![Travis](https://img.shields.io/travis/woyorus/syncsocket.svg?maxAge=2592000)](<>) [![Codecov](https://img.shields.io/codecov/c/github/woyorus/syncsocket.svg?maxAge=2592000)](<>)

## API Docs

### Channel

Channel constructor.

**Parameters**

-   `server`  The server object
-   `opts`  Options
    -   `opts.channelId`  {string} The channel id (string). If not passed, will generate a random one
    -   `opts.maxClients`  {number} Maximum allowed clients on the channel
    -   `opts.autoSyncClients`  {boolean} Automatically instruct unsynchronized clients to re-synchronize

#### addClient

Adds client to the channel

**Parameters**

-   `client`  

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

#### hasClient

Whether a client is joined this channel

**Parameters**

-   `client`  

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

#### prepareSingleClient

Send a 'prepare' message to a single client directly.

**Parameters**

-   `client`  
-   `topic`  
-   `payload`  

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** which is resolved once client moves to ready state.

#### scheduleSingleClient

Send a 'schedule' message (for particular time) to a single client directly.

**Parameters**

-   `client`  
-   `topic`  
-   `payload`  
-   `time`  

#### getChannelTime

Returns current time in channel time coordinates (e.g. timeserver coordinates)

### Client

Client constructor

**Parameters**

-   `server`  
-   `socket`  

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

-   `opts`  Options for the new channel (see Channel constructor docs)

#### addToChannel

**Parameters**

-   `client`  
-   `opts`  

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

#### getChannel

**Parameters**

-   `channelId`  

Returns **Any** 
