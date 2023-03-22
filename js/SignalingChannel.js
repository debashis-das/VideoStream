const ice = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
const remoteVideo = document.querySelector('video#remote_video');
const videoElement = document.querySelector('video#local_video');

class SignalingChannel {

    constructor(){
        this.ws = new WebSocket("ws://localhost:8765");
        this.remote = []
        this.local = null
        this.init()
    }

    addLocal(localPeer){
        this.local = localPeer
    }

    getConnection(){
        return this.ws
    }

    peerConnected(){
        this.remotePeer[0].addEventListener('track', async (event) => {
            const [remoteStream] = event.streams;
            remoteVideo.srcObject = remoteStream;
        });
    }

    init(){
        this.ws.onopen = function() {
            this.peerId = Math.floor(Math.random()*90000) + 10000;
            this.send(JSON.stringify({eventType : 'READY', peerId : this.peerId }));
            console.log("websocket init...");
        };
        
        this.ws.onclose = function() { 
            console.log("Connection is closed..."); 
        };

        this.ws.addEventListener('message', async message => { 
            try{
                if(JSON.parse(message.data).eventType == 'ANSWER') {   
                    const remoteDesc = new RTCSessionDescription(JSON.parse(message.data).answer);
                    await this.local.setRemoteDescription(remoteDesc);
                }else if(JSON.parse(message.data).eventType == 'OFFER'){
                    this.remote[0].setRemoteDescription(new RTCSessionDescription(JSON.parse(message.data).offer));
                    const answer = await this.remote[0].createAnswer();
                    await this.remote[0].setLocalDescription(answer);
                    this.ws.send(JSON.stringify({eventType : 'ANSWER', answer : answer, peerId : this.ws.peerId}));
                }else if(JSON.parse(message.data).eventType  == 'CANDIDATE'){
                    if (JSON.parse(message.data).iceCandidate) {
                        try {
                            await this.local.addIceCandidate(JSON.parse(message.data).iceCandidate);
                        } catch (e) {
                            console.error('Error adding received ice candidate', e);
                        }
                    }
                }else if(JSON.parse(message.data).eventType  == 'PEER'){
                    const remotePeer = new RTCPeerConnection(ice);
                    this.remote.push(remotePeer)
                    console.log("peer added...")
                    //offer stream
                    const offer = await this.local.createOffer();
                    await this.local.setLocalDescription(offer);
                    this.ws.send(JSON.stringify({eventType : 'OFFER', offer : offer, peerId : this.ws.peerId}));
                    this.local.addEventListener('icecandidate', event => {
                        if (event.candidate) {
                            this.ws.send(JSON.stringify({eventType : 'CANDIDATE', peerId : this.ws.peerId, iceCandidate : event.candidate}));
                        }
                    });
                }else{
                    console.log("ERROR...")
                    console.log(JSON.parse(message.data))
                }
            }catch(error){
                console.log(error)
            }
        });
    }
}

var constraints = {
    audio: true, 
    video: true
}

// webrtc
var signalingChannel = new SignalingChannel();


async function playVideoFromCamera() {
    try { 
        var pc = new RTCPeerConnection(ice);
        signalingChannel.addLocal(pc)
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        //local video
        videoElement.srcObject = stream;
        console.log("waiting for peer...")
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        })
        pc.addEventListener('connectionstatechange', event => {
            if (peerConnection.connectionState === 'connected') {
                console.log("PEER CONNECTED !!!!!")
                signalingChannel.peerConnected()
            }
        });
    } catch(error) {
        console.error('Error opening video camera.', error);
    }
}

playVideoFromCamera();








