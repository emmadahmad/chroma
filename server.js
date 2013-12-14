var server = require('http').createServer(handler),
	io = require('socket.io').listen(server),
	static = require('node-static'),
	chatClients = new Object();
	
var	file = new static.Server({
		cache : 600,
		headers : {'Access-Control-Allow-Origin' : '*'}
	});

var room = "Lobby";
	
server.listen(process.env.PORT || 2013);

function handler(req, res)
{
	//res.writeHead(200, {'Access-Control-Allow-Origin' : '*'});
	req.addListener('end', function()
	{
		file.serve(req, res);
	}).resume();
}

io.set('log level', 2);

/* Because of the configuration below socket.on(disconnect) was not being called. Figure out why.*/

io.configure(function () {
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

io.sockets.on('connection', function (socket)
{
	socket.on('connect', function(data){
		connect(socket, data);
	});
	
	socket.on('chatmessage', function(data){
		chatmessage(socket, data);
	});
	
	socket.on('subscribe', function(data){
		subscribe(socket, data);
	});

	socket.on('unsubscribe', function(data){
		unsubscribe(socket, data);
	});
	
	socket.on('disconnect', function(){
		disconnect(socket);
	});
	
	socket.on('message', function(data)
	{
		//log(data);
		//socket.broadcast.emit('message', data); // SHOULD BE ONLY ROOM. CHANGE TO ROOM AFTERWARDS.
		socket.broadcast.to(data.room).emit('message', data);
		//io.sockets.in(data.room).emit('message', data);
	});
	
	socket.on('options', function(data)
	{
		//log(data);
		//socket.broadcast.emit('message', data); // SHOULD BE ONLY ROOM. CHANGE TO ROOM AFTERWARDS.
		socket.broadcast.to(data.room).emit('options', data);
		//io.sockets.in(data.room).emit('message', data);
	});
	
	function log()
	{
		var array = ["C -> S : "];
	  	for (var i = 0; i < arguments.length; i++)
	  	{
	  		array.push(arguments[i]);
	  	}
	    socket.emit('log', array);
	    //console.log(array);
	}
});

function connect(socket, data)
{
	data.clientId = generateId();
	//console.log(data);
	chatClients[socket.id] = data;
	socket.emit('ready', { clientId: data.clientId });
	subscribe(socket, { room: room });
	//socket.emit('roomslist', { rooms: getRooms() });
}

function chatmessage(socket, data)
{
	socket.broadcast.to(data.room).emit('chatmessage', { sender: data.sender, receiver: data.receiver, message: data.message });
}

function disconnect(socket)
{
	//console.log("Disconnect called");
	var rooms = io.sockets.manager.roomClients[socket.id];

	for(var room in rooms)
	{
		if(room && rooms[room])
		{
			unsubscribe(socket, { room: room.replace('/','') });
		}
	}

	delete chatClients[socket.id];
}

function subscribe(socket, data)
{
	socket.join(data.room);

	updatePresence(socket, 'online');

	socket.emit('roomclients', { clients: getClients(socket.id) });
	io.sockets.in(data.room).emit('numofclients', { room: data.room, numofclients: countClients(data.room) });
	//console.log(countClients(data.room));
}

function unsubscribe(socket, data)
{
	//console.log("Unsubscribe called");
	updatePresence(socket, 'offline');
	socket.leave(data.room);
	if(!countClients(data.room))
	{
		io.sockets.emit('removeroom', { room: data.room });
	}
	else
	{
		io.sockets.in(data.room).emit('numofclients', { room: data.room, numofclients: countClients(data.room) });
	}		
}

function getRooms()
{
	return Object.keys(io.sockets.manager.rooms);
}

function getClients(socketId)
{
	var socketIds = io.sockets.manager.rooms['/' + room];
	var clients = [];
	
	if(socketIds && socketIds.length > 0)
	{
		socketsCount = socketIds.length;
		
		for(var i = 0, len = socketIds.length; i < len; i++)
		{
			if(socketIds[i] != socketId)
			{
				clients.push(chatClients[socketIds[i]]);
			}
		}
	}
	//console.log(clients);
	return clients;
}

function countClients(room)
{
	if(io.sockets.manager.rooms['/' + room])
	{
		return io.sockets.manager.rooms['/' + room].length;
	}
	return 0;
}

function updatePresence(socket, state)
{
	//console.log("Update Presence called");
	//room = room.replace('/','');
	socket.broadcast.to(room).emit('presence', { client: chatClients[socket.id], state: state});
}

function generateId()
{
	var S4 = function () {
		return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
	};
	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

console.log('Server is running and listenting...');