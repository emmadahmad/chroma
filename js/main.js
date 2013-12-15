(function($)
{
	$("#end-call").hide();
	var NICK_MAX_LENGTH = 10,
		ROOM_MAX_LENGTH = 10,
		room = "Lobby",
		userList = [],
		tmplt = {
			room: [
				'<a href="javascript:void(0)" data-roomId="${room}" class="list-group-item">',
					'${room}',
				'</a>'
			].join(""),
			client: [
				'<li class="user" data-clientId="${clientId}"><a class="users" href="#chat-${clientId}" data-transition="slide">',
				'<div class="thumb"><img src="images/user-thumb.png" /></div>',
				'<span class="info">${username}</span></a></li>'
			].join(""),
			messageMe: [
				'<div class="media">',
					'<div class="media-object pull-left">',
						'<img src="images/user-thumb.png">',
						'<span class="uname">You</span>',
					'</div>',
					'<div class="media-body text-left">',
						'<p class="chat me">',
							'${message}',
							'<span class="time">${time}</span>',
						'</p>',
					'</div>',
				'</div>'
			].join(""),
			messageClient: [
				'<div class="media">',
					'<div class="media-object pull-right">',
						'<img src="images/user-thumb.png">',
						'<span class="uname">${sender}</span>',
					'</div>',
					'<div class="media-body text-right">',
						'<p class="chat">',
							'${message}',
							'<span class="time">${time}</span>',
						'</p>',                                            
					'</div>',
				'</div>'
			].join(""),
			chatPage: [
				'<div data-role="page" id="chat-${cId}" data-theme="a"><div data-role="header" data-theme="a" data-position="fixed">',
				'<h3> ${name} </h3><a href="#user-panel" data-theme="a" ><i class="fa fa-user fa-lg"></i></a>',
				'<a href="#calling" id="call" data-transition="flip" data-rel="dialog" data-theme="a" ><i class="fa fa-video-camera fa-lg"></i></a></div>',
				'<div id="chat-panel" data-role="content"></div>',
				'<div data-role="panel" data-display="push" data-position-fixed="true" data-theme="b" id="user-panel">',        
				'<ul id="users" data-role="listview" data-theme="b"></ul></div>',
				'<div id="chat-submit" data-role="footer" data-theme="b" data-position="fixed">',
				'<input type="text" name="message" id="message" value="" placeholder="Type your message here"  />',
				'<a data-theme="a" id="btn-submit" href="#" data-role="button">Send</a></div></div>'
			].join("")
		};
	
	var listItems = '<li data-theme="a" data-icon="home"><a href="#home" data-transition="slide" data-direction="reverse" >Home</a></li>' + 
					'<li data-role="list-divider">Online</li>';
	
	var video = document.getElementById('video'),
	remoteVideo = document.getElementById('remoteVideo'),
	takepic = document.getElementById('takepic'),
	slider = document.getElementById('slider-s'),
	opacity = document.getElementById('slider-o'),
	feed = document.getElementById('feed'), 
	display = document.getElementById('display'),
	remote = document.getElementById('remote'),
	remoteFeed = document.getElementById('remoteFeed'),
	mini = document.getElementById('mini'),
	foreground = document.getElementById('foreground'), 
	forephoto = document.getElementById('forephoto'), 
	photo = document.getElementById('photo'), 
	photoback = document.getElementById('photoback'),
	feedCtx = feed.getContext('2d'),
	displayCtx = display.getContext('2d'),
	rFeedCtx = remoteFeed.getContext('2d'),
	remoteCtx = remote.getContext('2d'),
	miniCtx = mini.getContext('2d'),
	photoCtx = photo.getContext('2d'),
	photobackCtx = photoback.getContext('2d'),
	selectBox = document.getElementById("toggle-chroma"),
	chromaOn = 0,
	width = 0, 
	height = 0, 
	range = 80, 
	colors = [0, 0, 200];
	
	
	var clientId = null,
	username = null,
	socket = null,
	receiverId = null,
	inCallClient = null,
	options = {
		'id' : receiverId,
		'type' : 'all',
		'range' : 80,
		'colors' : [0, 0, 200],
		'on' : 0,
		'bgFile' : null
	};

	//WEBRTC Variables
	var isChannelReady = false;
	var isInitiator = false;
	var isStarted = false;
	var localStream;
	var pc;
	var remoteStream;
	var turnReady;
	
	var constraints = {video : true, audio : true};
	var pc_config = webrtcDetectedBrowser === 'firefox' ?
			  {'iceServers':[{'url':'stun:23.21.150.121'}]} : // number IP
			  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
	
	var pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true}]};
	
	// Set up audio and video regardless of what devices are present.
	var sdpConstraints = {'mandatory': {
	  'OfferToReceiveAudio':true,
	  'OfferToReceiveVideo':true }};
	
	var localVideo = document.querySelector('#video');
	var remoteVideo = document.querySelector('#remoteVideo');


	
	function bindDOMEvents()
	{
		
		$(":jqmData(role='page') #message").live('keydown', function(e) 
		{
			var key = e.which || e.keyCode;
			if (key == 13) { event.preventDefault();handleMessage(); }
		});

		$(":jqmData(role='page') #btn-submit").live('click', function()
		{
			event.preventDefault();
			handleMessage();
		});
		
		$('#accept-call').live('click', function() 
		{
			//event.preventDefault();
			isChannelReady = true;
			sendMessage({
				mes: 'Accepted',
				sender: clientId,
				receiver: receiverId
			});
			options.id = receiverId;
			sendOptions(options);
			$("#remote").show();
			$("#mini").show();
			$("#display").hide();
			$("#end-call").show();
			
			
		});
		
		$('#reject-call').live('click', function() 
		{
			event.preventDefault();
			sendMessage({
				mes: 'Rejected',
				sender: clientId,
				receiver: receiverId
			});
			
		});
		
		$('#call').live('click', function() 
		{
			isInitiator = true;
			call();
		});
			  
		$('#txtUsername').on('keydown', function(e)
		{
			var key = e.which || e.keyCode;
			if(key == 13) { handleUserName(); }
		});
		
		$('#btn-signin').on('click', function()
		{
			handleUserName();
		});
		
		$('#end-call').on('click', function()
		{
			event.preventDefault();
			$('#end-call').hide();
			$.mobile.changePage("#home", {
				transition : "flip",
				reverse : true,
				changeHash : true
			});
			hangup();
		});
		
		$('#toggle-chroma').on('change', function()
		{
			toggleChroma();
		});
		
		document.getElementById('backfiles').addEventListener('change', handleBgFile, false);
		document.getElementById('forefiles').addEventListener('change',	handleFgFile, false);
	}

	function bindSocketEvents(){

		socket.on('connect', function ()
		{
			socket.emit('connect', { username: username });
		});
		
		socket.on('ready', function(data)
		{			
			clientId = data.clientId;
		});
		
		socket.on('presence', function(data)
		{
			if(data.state == 'online')
			{
				userList.push(data.client);
				addChat(data.client.clientId);
				updatePanels();
			} else if(data.state == 'offline')
			{
				removeClient(data.client);
				updatePanels();
			}
		});
		
		socket.on('log', function (array)
		{
			console.log.apply(console, array.mes);
		});
		
		socket.on('chatmessage', function(data)
		{
			var sender = data.sender;
			var message = data.message;
			var recId = data.receiver;			
			insertMessage(data.sender, data.receiver, data.message);
		});
		
		socket.on('roomclients', function(data)
		{
			for(var i = 0, len = data.clients.length; i < len; i++)
			{
				if(data.clients[i])
				{
					userList.push(data.clients[i]);
					addChat(data.clients[i].clientId);
				}
			}
			updatePanels();

		});
		
		socket.on('message', function(message)
		{
			receiverId = message.sender;
			var name = getName(receiverId);
			
			if (message.receiver == clientId)
			{
				console.log('isStarted = ' + isStarted + '  isInitiator = ' + isInitiator);
				console.log("S -> C " + message.mes.type + " --- " + message.mes + "--" + message.sender + "--" + message.receiver);
				if (message.mes === 'Calling')
				{
					if (isStarted)
					{	
						sendMessage({
							mes: 'Busy',
							sender: clientId,
							receiver: receiverId
						});						
					}
					else 
					{
						//maybeStart();
						$.mobile.changePage("#incoming", {
							transition : "flip",
							reverse : false,
							role: 'dialog',
							changeHash : true
						});
						$("#incoming h1").html(name + " Calling . . .");
					}
				}
				
				else if (message.mes === 'Busy')
				{
					isInitiator = false;
					$("#calling h1").html(name + " busy!");
					console.log("BUSY");
					setTimeout(function()
					{
						$.mobile.changePage("#home", {
							transition : "flip",
							reverse : true,
							changeHash : true
						});
					}, 2000);
					
				}
				
				else if (message.mes === 'Accepted')
				{
					$.mobile.changePage("#home", {
						transition : "flip",
						reverse : true,
						changeHash : true
					});
					$("#remote").show();
					$("#mini").show();
					$("#display").hide();
					$("#end-call").show();
					isChannelReady = true;
					options.id = receiverId;
					sendOptions(options);
					maybeStart();
					
				}
				
				else if (message.mes === 'Rejected')
				{
					isInitiator = false;
					$.mobile.changePage("#home", {
						transition : "flip",
						reverse : true,
						changeHash : true
					});
				}
				
				else if (message.mes === 'Bye' && isStarted)
				{
					if(message.sender == inCallClient)
					{
						$("#remote").hide();
						$("#mini").hide();
						$("#display").show();
						$("#end-call").hide();
						handleRemoteHangup();
					}						
				}
				
				else if (message.mes.type === 'offer')
				{
					console.log("isStarted = " + isStarted);
					
					if (!isInitiator && !isStarted)
					{
						maybeStart();
					}
					pc.setRemoteDescription(new RTCSessionDescription(message.mes));
					doAnswer();
				}
				
				else if (message.mes.type === 'answer' && isStarted)
				{
					pc.setRemoteDescription(new RTCSessionDescription(message.mes));
				}
				
				else if (message.mes.type === 'Candidate' && isStarted)
				{
					var candidate = new RTCIceCandidate({sdpMLineIndex:message.mes.label, candidate:message.mes.candidate});
					pc.addIceCandidate(candidate);
				}
			}
		});
		
		socket.on('options', function(opt)
		{
			if (opt.id == clientId)
			{
				console.log(opt);
				if (opt.type == 'all')
				{
					options.range = opt.range;
					options.colors = opt.colors;
					options.on = opt.on;
					if (opt.bgFile != null)
					{
						console.log(opt.bgFile);
						options.bgFile = opt.bgFile;
						document.getElementById('remote').style.backgroundImage = "url(" + opt.value + ")";
					}
					
				}
				else if (opt.type == 'range')
				{
					options.range = opt.value;
				}
				else if (opt.type == 'colors')
				{
					options.colors = opt.value;
				}
				else if (opt.type == 'on')
				{
					options.on = opt.value;
				}
				else if (opt.type == 'bgFile')
				{
					if (opt.bgFile != null)
					{
						console.log(opt.value);
						options.bgFile = opt.value;
						document.getElementById('remote').style.backgroundImage = "url(" + opt.value + ")";
					}
				}
			}
			
		});
	}
	
	/** *********** FUNCTIONS ************* */
		
	
	function handleUserName()
	{
		var nick = $('#txtUsername').val().trim();
		
		if (nick == '')
		{
			$('#u-error').html("Username Cannot be empty!");
			$('#u-error').show();
			event.preventDefault();
		}
		else if (nick && nick.length <= NICK_MAX_LENGTH)
		{
			event.preventDefault();
			username = nick;
			$.mobile.navigate( "#home" );
			connect();
			start();
			
		} 
		else 
		{
			$('#u-error').html("User Name should not be more than 10 characters. Try again.");
			$('#u-error').show();
			$('#txtUsername').val('');
			event.preventDefault();
		}
	}

	function handleMessage() 
	{
		var recId = getId();
		var message = $.mobile.activePage.find("#message").val().trim();
		if (message)
		{
			socket.emit('chatmessage', {				
				sender : clientId,
				receiver : recId,
				message : message
			});

			insertMessage(clientId, recId, message);
			$.mobile.activePage.find("#message").val('');
		}
	}

	function insertMessage(senderId, recId, message) 
	{
		var uname = getName(senderId);
		var $html;
		
		if (senderId == clientId)
		{
			$html = $.tmpl(tmplt.messageMe, {				
				message : message,
				time : getTime()
			});
			$html.appendTo("#chat-" + recId + " #chat-panel");
		}
		else if (recId == clientId)
		{
			$html = $.tmpl(tmplt.messageClient, {	
				sender : uname,
				message : message,
				time : getTime()
			});
			$html.appendTo("#chat-" + senderId + " #chat-panel");
		}
	}
	
	function getId()
	{
		return $.mobile.activePage.attr('id').substr(5);
	}
	
	function getName(Id)
	{
		var uname = null;
		for(var i = 0, len = userList.length; i < len; i++)
		{
			if(userList[i].clientId == Id)
			{
				uname = userList[i].username;
				break;
			}
		}
		return uname;
	}

	function getTime() 
	{
		var date = new Date();
		return (date.getHours() < 10 ? '0' + date.getHours().toString() : date.getHours()) + 
				':' + (date.getMinutes() < 10 ? '0' +
				date.getMinutes().toString() : date.getMinutes());
	}
	
	
	
	function addChat(cId)
	{
		var name = getName(cId);
		name = name.charAt(0).toUpperCase() + name.slice(1);
		if($("#chat-" + cId).length == 0) 
		{
			var $html = $.tmpl(tmplt.chatPage, 
			{
				cId : cId,
				name : name
			});
			$html.appendTo( $.mobile.pageContainer );
		}
	}
	
	function updatePanels()
	{
		$(":jqmData(role='panel') #users").empty();
		$(":jqmData(role='panel') #users").append(listItems);
		addClient();
	}
	
	function addClient()
	{
		var $html;
		var un;
		
		for(var i = 0, len = userList.length; i < len; i++)
		{
			if(userList[i])
			{
				un = userList[i].username;
				un = un.charAt(0).toUpperCase() + un.slice(1);
				$html = $.tmpl(tmplt.client, 
				{
					clientId : userList[i].clientId,
					username : un
				});
				$html.appendTo(":jqmData(role='panel') #users");
			}
		}
		$(":jqmData(role='panel') #users").trigger('create');		
		$(":jqmData(role='panel')").find(".ui-listview").listview('refresh');
	}
	
	
	function removeClient(client)
	{
		for (i = 0, len = userList.length ; i < len ; i++)
		{
			if (userList[i].username == client.username)
				break;
		}
		userList.splice(i,1);
	}
	
	function call()
	{
		receiverId = getId();
		var name = getName(receiverId);
		sendMessage({
			mes: 'Calling',
			sender: clientId,
			receiver: receiverId
		});
		
		$("#calling h1").html("Calling " + name);
	}
	
	function connect()
	{
		socket = io.connect();
		bindSocketEvents();
	}

	function sendMessage(message)
	{
		socket.emit('message', message);
	}

	function sendOptions(options)
	{
		socket.emit('options', options);
	}

	$(function()
	{
		bindDOMEvents();
	});
	
	window.onbeforeunload = function(e)
	{
		//receiverId = getId();
		sendMessage({
			mes: 'Bye',
			sender: clientId,
			receiver: receiverId
		});
	}
	
	
	/******** VIDEO CHROMA ******/
	
	
	function start()
	{
		window.requestAnimationFrame || 
		(window.requestAnimationFrame = window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || 
			function( callback )
			{
				window.setTimeout(callback, 1000 / 60);
			});
		window.URL = window.URL || window.webkitURL;
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || false;
		
		if(navigator.getUserMedia)
		{
			navigator.getUserMedia(constraints, onSuccess, onError);
		}
		else
		{
			alert('getUserMedia is not supported in this browser.');
		}
		
	}

	function onSuccess(localMediaStream)
	{
		window.stream = localMediaStream;
		localStream = localMediaStream;
		try
		{
			stream = window.URL.createObjectURL(localMediaStream);
		}
		catch(e) {}
		video.src = stream;
		video.play();
		
		if (!width) 
		{
			width = display.width;
			height = display.height;
		}
		
		streamFeed();
		
		display.addEventListener('click', videoClick);
		takepic.addEventListener('click', function(ev)
		{
			takepicture();
		}, false);
		
		document.getElementsByClassName('ui-slider-handle')[1].addEventListener('click', function() 
		{
			range = 255 - parseInt(document.getElementById('slider-s').value, 10);
			
			if (isStarted)
			{
				sendOptions({
					id : inCallClient,
					type : 'range',
					value : range
				});
			}
			else if (!isStarted)
			{
				options.range = range;
			}
		});
		document.getElementsByClassName('ui-slider-handle')[2].addEventListener('click', function()
		{
			foreground.style.opacity = document.getElementById('slider-o').value;
			forephoto.style.opacity = document.getElementById('slider-o').value;
		});
		
	}

	function onError()
	{
		alert("There has been a problem retreiving the streams - did you allow access?");
	}

	function takepicture()
	{
		photo.width = width;
		photo.height = height;
		photoCtx.drawImage(photoback, 0, 0, width, height);
		photoCtx.drawImage(display, 0, 0, width, height);
		var img    = photo.toDataURL("image/jpg");
		document.getElementById("image").src=img;
		document.getElementById("save-image").href = document.getElementById("image").src;	
	}

	var videoClick = function(evt)
	{
		var line = evt.offsetY, 
		col = evt.offsetX,
		frame = displayCtx.getImageData(col, line, 1, 1),
		px = [frame.data[0], frame.data[1], frame.data[2]];
		colors = px;
		if (isStarted)
		{
			sendOptions({
				id : inCallClient,
				type : 'colors',
				value : colors
			});
		}
		else if (!isStarted)
		{
			options.colors = colors;
		}
	};

	function streamFeed() 
	{
		//console.log("StreamFeed");
	    requestAnimationFrame(streamFeed);
	    //feedCtx.drawImage(imgg, 0, 0, width, height);
	    feedCtx.drawImage(video, 0, 0, width, height);
	    imageData = feedCtx.getImageData(0, 0, width, height);
	    
	    if (chromaOn)
		{
	    	imageData.data = addChroma(imageData.data, range, colors);    	
		}
	    displayCtx.drawImage(photoback, 0, 0, width, height);
	    miniCtx.drawImage(photoback, 0, 0, width, height);
	    displayCtx.putImageData(imageData, 0, 0);
	    miniCtx.putImageData(imageData, 0, 0);
	    if(isStarted)
    	{
	    	rFeedCtx.drawImage(remoteVideo, 0, 0);
	    	remoteData = rFeedCtx.getImageData(0, 0, width, height);
	    	if (options.on)
    		{
	    		remoteData.data = addChroma(remoteData.data, options.range, options.colors);
    		}
	    	remoteCtx.putImageData(remoteData, 0, 0);
    	}
	    
	    //callCtx.drawImage(display, 0, 0);
	    
	}

	function addChroma(data, ran, col)
	{
		var i = 0, l, r, g, b;
		l = data.length / 4;
		
		for (; i < l; i++)
		{
			r = data[i * 4];
			g = data[i * 4 + 1];
			b = data[i * 4 + 2];
			
			if (Math.abs(r - col[0]) < 250 - ran && Math.abs(g - col[1]) < 250 - ran && Math.abs(b - col[2]) < 250 - ran) 
			{
				data[i * 4 + 3] = 0;
			}
		}	
		return data;	
	}
	
	function toggleChroma()
	{
		var selectedValue = selectBox.options[selectBox.selectedIndex].value;
		
		if (selectedValue == 'on')
		{
			chromaOn = 1;
		}
		else if (selectedValue == 'off')
		{
			chromaOn = 0;
		}
		if (isStarted)
		{
			if (selectedValue == 'on')
			{
				sendOptions({
					id : inCallClient,
					type : 'on',
					value : 1
				});
			}
			else if (selectedValue == 'off')
			{
				sendOptions({
					id : inCallClient,
					type : 'on',
					value : 0
				});
			}
		}
		else if (!isStarted)
		{
			if (selectedValue == 'on')
			{
				options.on = 1;
			}
			else if (selectedValue == 'off')
			{
				options.on = 0;
			}
		}
	}


	/************** WEBRTC **************/


	function maybeStart() 
	{
		//console.log('Maybestart');
		console.log(isChannelReady + ' ' + isStarted + ' ' + isInitiator);
		if (!isStarted && localStream && isChannelReady)
		{
			createPeerConnection();
			pc.addStream(localStream);
			isStarted = true;
			inCallClient = receiverId;
			
			if (isInitiator) 
			{
				doCall();
			}
		}
	}

	function createPeerConnection()
	{
		//console.log('create peer connection');
		try 
		{
		   pc = new RTCPeerConnection(pc_config, pc_constraints);
		   pc.onicecandidate = handleIceCandidate;
		   console.log('Created RTCPeerConnnection with:\n' +
		     '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
		     '  constraints: \'' + JSON.stringify(pc_constraints) + '\'.');
		}
		catch (e) 
		{
			//console.log('Failed to create PeerConnection, exception: ' + e.message);
			alert('Cannot create RTCPeerConnection object.');
			return;
		}
		pc.onaddstream = handleRemoteStreamAdded;
		pc.onremovestream = handleRemoteStreamRemoved;
	}

	function handleIceCandidate(event) 
	{
		//console.log('handle ice candidate');
		//console.log(event.candidate)
		//console.log('handleIceCandidate event: ', event);
		if (event.candidate) 
		{
			sendMessage({
			mes:
			{
				type: 'Candidate',
				label: event.candidate.sdpMLineIndex,
				id: event.candidate.sdpMid,
				candidate: event.candidate.candidate,
			},					
			sender: clientId,
			receiver: receiverId});
		}
		else 
		{
		//console.log('End of candidates.');
		}
	}

	function handleRemoteStreamAdded(event) 
	{
		//console.log('Remote stream added.');
		// reattachMediaStream(miniVideo, localVideo);
		attachMediaStream(remoteVideo, event.stream);
		remoteStream = event.stream;
		// waitForRemoteVideo();
	}

	function handleRemoteStreamRemoved(event) 
	{
		console.log('Remote stream removed. Event: ', event);
	}

	function doCall()
	{
		//console.log('docall');
		var constraints = {'optional': [], 'mandatory': {'MozDontOfferDataChannel': true}};
		if (webrtcDetectedBrowser === 'chrome')
		{
			for (var prop in constraints.mandatory)
			{
				if (prop.indexOf('Moz') !== -1)
				{
					delete constraints.mandatory[prop];
				}
			}
		}		
		constraints = mergeConstraints(constraints, sdpConstraints);
		console.log('Sending offer to peer, with constraints: \n' +
			    '  \'' + JSON.stringify(constraints) + '\'.');
		pc.createOffer(setLocalAndSendMessage, null, constraints);		
	}

	function doAnswer() 
	{
		//console.log('doanswer');
		pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
	}


	function hangup() 
	{
		//console.log("hangUp");
		stop();
		sendMessage({
			mes: 'Bye',
			sender: clientId,
			receiver: receiverId
		});
		$("#remote").hide();
		$("#mini").hide();
		$("#display").show();
	}

	function handleRemoteHangup() 
	{
		//console.log('handleRemoteHangup');
		stop();
		//isInitiator = false;
	}

	function stop() 
	{
		//console.log("stop");
		isStarted = false;
		inCallClient = null;
		isChannelReady = false;
		// isAudioMuted = false;
		// isVideoMuted = false;
		pc.close();
		pc = null;
	}

	function mergeConstraints(cons1, cons2) 
	{
		//console.log('merge');
		var merged = cons1;
		for (var name in cons2.mandatory) 
		{
			merged.mandatory[name] = cons2.mandatory[name];
		}
		merged.optional.concat(cons2.optional);
		return merged;
	}

	function setLocalAndSendMessage(sessionDescription) 
	{
		//console.log('setlocalsendmessage');
		// Set Opus as the preferred codec in SDP if Opus is present.
		sessionDescription.sdp = preferOpus(sessionDescription.sdp);
		pc.setLocalDescription(sessionDescription);
		sendMessage({
			mes: sessionDescription,
			sender: clientId,
			receiver: receiverId
		});
	}



	function preferOpus(sdp) 
	{
		//console.log('preferopus');
		var sdpLines = sdp.split('\r\n');
		var mLineIndex;
		// Search for m line.
		for ( var i = 0; i < sdpLines.length; i++) 
		{
			if (sdpLines[i].search('m=audio') !== -1) 
			{
				mLineIndex = i;
				break;
			}
		}
		if (mLineIndex === null) 
		{
			return sdp;
		}

		// If Opus is available, set it as the default in m line.
		for (i = 0; i < sdpLines.length; i++) 
		{
			if (sdpLines[i].search('opus/48000') !== -1) 
			{
				var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
				if (opusPayload) 
				{
					sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
				}
				break;
			}
		}

		// Remove CN in m line and sdp.
		sdpLines = removeCN(sdpLines, mLineIndex)
		sdp = sdpLines.join('\r\n');
		return sdp;
	}

	function extractSdp(sdpLine, pattern) 
	{
		//console.log('extract');
		var result = sdpLine.match(pattern);
		return result && result.length === 2 ? result[1] : null;
	}

	// Set the selected codec to the first in m line.
	function setDefaultCodec(mLine, payload) 
	{
		//console.log('default codec');
		var elements = mLine.split(' ');
		var newLine = [];
		var index = 0;
		for ( var i = 0; i < elements.length; i++) 
		{
			if (index === 3) { // Format of media starts from the fourth.
				newLine[index++] = payload; // Put target payload to the first.
			}
			if (elements[i] !== payload) 
			{
				newLine[index++] = elements[i];
			}
		}
		return newLine.join(' ');
	}

	// Strip CN from sdp before CN constraints is ready.
	function removeCN(sdpLines, mLineIndex) 
	{
		//console.log('removecn');
		var mLineElements = sdpLines[mLineIndex].split(' ');
		// Scan from end for the convenience of removing an item.
		for ( var i = sdpLines.length - 1; i >= 0; i--) 
		{
			var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
			if (payload) 
			{
				var cnPos = mLineElements.indexOf(payload);
				if (cnPos !== -1) 
				{
					// Remove CN payload from m line.
					mLineElements.splice(cnPos, 1);
				}
				// Remove CN line in sdp
				sdpLines.splice(i, 1);
			}
		}

		sdpLines[mLineIndex] = mLineElements.join(' ');
		return sdpLines;
	}
	
	if (window.File && window.FileReader && window.FileList && window.Blob) 
	{
		// Great success! All the File APIs are supported.
	} else 
	{
		alert('The File APIs are not fully supported in this browser.');
	}

	function handleBgFile(evt) 
	{
		var photoback = document.getElementById('photoback');
		var photobackCtx = photoback.getContext('2d');
		var files = evt.target.files; // FileList object
		var imgg = new Image();

		// Loop through the FileList and render image files as thumb nails.
		for ( var i = 0, f; f = files[i]; i++) {

			// Only process image files.
			if (!f.type.match('image.*')) {
				continue;
			}

			var reader = new FileReader();

			// Closure to capture the file information.
			reader.onload = (function(theFile) {
				return function(e) {
					// Render thumb nail.
					//var canvas = document.getElementById('canvas');
					imgg.src = e.target.result;
					document.getElementById('display').style.backgroundImage = "url(" + e.target.result + ")";
					document.getElementById('mini').style.backgroundImage = "url(" + e.target.result + ")";
					//document.getElementById('photo').style.backgroundImage = "url("	+ e.target.result + ")";
					photobackCtx.drawImage(imgg, 0, 0);
					if (isStarted)
					{
						sendOptions({
							id : inCallClient,
							type : 'bgFile',
							value :  e.target.result
						});
					}
					else if (!isStarted)
					{
						options.bgFile = e.target.result;
					}
				};
			})(f);

			// Read in the image file as a data URL.
			reader.readAsDataURL(f);
		}
	}

	function handleFgFile(evt) 
	{
		var files = evt.target.files; // FileList object

		// Loop through the FileList and render image files as thumb nails.
		for ( var i = 0, f; f = files[i]; i++) {

			// Only process image files.
			if (!f.type.match('image.*')) {
				continue;
			}

			var reader = new FileReader();

			// Closure to capture the file information.
			reader.onload = (function(theFile) {
				return function(e) {
					// Render thumb nail.
					//var canvas = document.getElementById('canvas');
					document.getElementById('foreground').style.backgroundImage = "url(" + e.target.result + ")";
					document.getElementById('forephoto').style.backgroundImage = "url("	+ e.target.result + ")";
				};
			})(f);

			// Read in the image file as a data URL.
			reader.readAsDataURL(f);
		}
	}
	

})(jQuery);

window.onresize = function()
{
	if ( window.innerWidth < 600 )
	{
		$("#display").css( "width", "100%" );
		$("#image").css( "width", "100%" );
		$("#remote").css( "width", "100%" );
		$("#mini").css({ "width" : "40%" , "left" : "0" , "top" : "0"});
	}
	else if ( window.innerWidth > 600 )
	{
		$("#display").css( "width", "50%" );
		$("#image").css( "width", "50%" );
		$("#remote").css( "width", "50%" );
		$("#mini").css({ "width" : "10%" , "left" : "25%" , "top" : "0"});
	}
};