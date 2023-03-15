var ice = {
    //     "iceServers": [
    //     {"url": "stun:stunserver.com:12345"}
    //   ]
    };
var pc = new RTCPeerConnection(ice);

class SignalingChannel {
    constructor(){
        this.ws = new WebSocket("ws://localhost:8765");
        this.init()
    }

    init(){
        this.ws.onopen = function() {
            // Web Socket is connected, send data using send()
            this.pId = crypto.randomUUID()
            this.pType = 'WebBrowser'
            this.send(JSON.stringify({eventType : 'READY', peerId : this.pId , peerType : this.pType}));
            console.log("Message is sent...");
            // ERROR
            // ws.send(JSON.stringify({eventType : 'READY', peerId : uuid , peerType : 'WebBrowser'}));
            // console.log("Message is sent... again");
            // ws.send(JSON.stringify({eventType : 'READY', peerId : crypto.randomUUID() , peerType : 'WebBrowser'}));
        };
        
        this.ws.onclose = function() { 
            // websocket is closed.
            console.log("Connection is closed..."); 
        };
    }
}

var constraints = {
    audio: true, 
    video: true
}




// webrtc
var signalingChannel = new SignalingChannel();
const remoteVideoELement = document.querySelector('video#remote_video');
const videoElement = document.querySelector('video#local_video');

async function playVideoFromCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        //local video
        console.log(stream)
        videoElement.srcObject = stream;
        //offer stream
        pc.addStream(stream);
        pc.createOffer().then((offer) => pc.setLocalDescription(offer))
            .then(() => {
                signalingChannel.ws.send(JSON.stringify({
                    eventType: "OFFER",
                    sdp: pc.localDescription,
                  }))
            })
            .catch((reason) => {
                console.error(reason)
            });
    } catch(error) {
        console.error('Error opening video camera.', error);
    }
}

playVideoFromCamera();



signalingChannel.ws.onmessage = function (evt) { 
    try{
        if(typeof JSON.parse(evt.data) == "string"){
            var received_msg = JSON.parse(JSON.parse(evt.data));
        }else{
            var received_msg = JSON.parse(evt.data);
        }
        console.log("Message is received... --> ");
        console.log(received_msg);
        if (received_msg.eventType == 'CANDIDATE' && received_msg.message) {   
            pc.addIceCandidate(received_msg.message);
        }else if(received_msg.eventType == 'OFFER'){
            console.log("onmessage !! offer -->")
            remote_pc = new RTCPeerConnection(ice);
            remote_pc.setRemoteDescription(received_msg.sdp);
            remote_pc.onicecandidate = function(evt) {
              if (evt.candidate) {
                console.log("remote onicecandidate--->")
                signalingChannel.ws.send(JSON.stringify({eventType : 'CANDIDATE', message: evt.candidate}));
              }
            }
            remote_pc.addEventListener('track', async (event) => {
                console.log("remote_pc addEventListener")
                const [remoteStream] = event.streams;
                remoteVideoELement.srcObject = remoteStream;
            });
        }else{
            console.log("onmessage !! else -->")
        }
    }catch(error){
        console.error(error)
    }
}

pc.onicecandidate = function(evt) { 
    if (evt.candidate) {
        signalingChannel.ws.send(JSON.stringify({eventType : 'CANDIDATE', message: evt.candidate}));
    }
}

pc.oniceconnectionstatechange = function(evt) { 
    console.log("ICE connection state change: " + evt.target.iceConnectionState);
}

pc.addEventListener('track', async (event) => {
    console.log("pc addEventListener")
    const [remoteStream] = event.streams;
    remoteVideoELement.srcObject = remoteStream;
});



