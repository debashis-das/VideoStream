const ice = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
// const ice = {'iceServers': []}
const remoteVideo = document.querySelector('video#remote_video');
const videoElement = document.querySelector('video#local_video');

class SignalingChannel {

    constructor(pc,offer){
        this.ws = new WebSocket("ws://localhost:8765");
        this.remote = []
        this.local = pc
        this.offer = offer
        this.init()
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
                    // candidate
                    this.local.addEventListener('icecandidate', event => {
                        if (event.candidate) {
                            this.ws.send(JSON.stringify({eventType : 'CANDIDATE', peerId : this.ws.peerId, iceCandidate : event.candidate}));
                        }
                    });
                    // create remote connection
                    const remotePeer = new RTCPeerConnection(ice);
                    this.remote.push(remotePeer)
                    console.log("peer added...")
                    // remote listeners
                    remotePeer.addEventListener('connectionstatechange', event => {
                        console.log(event)
                        if (remotePeer.connectionState === 'connected') {
                            // Peers connected!
                            console.log('connected !!')
                        }else if(remotePeer.connectionState == 'have-remote-offer') {
                            const answer = this.remote[0].createAnswer();
                            this.remote[0].setLocalDescription(answer);
                            this.ws.send(JSON.stringify({eventType : 'ANSWER', answer : answer, peerId : this.ws.peerId}));
                        }
                    });
                    // send to signaling server
                    this.ws.send(JSON.stringify({eventType : 'OFFER', offer : this.offer, peerId : this.ws.peerId}));
                    
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

async function playVideoFromCamera() {
    try { 
        var pc = new RTCPeerConnection(ice);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        //offer stream
        const offer = await pc.createOffer({iceRestart:true , offerToReceiveAudio: true, offerToReceiveVideo: true});
        await pc.setLocalDescription(offer);
        // webrtc
        var signalingServer = new SignalingChannel(pc,offer);
        //local video
        videoElement.srcObject = stream;
        console.log("waiting for peer...")
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        })
        pc.addEventListener('connectionstatechange', event => {
            console.log(event)
            if (event.currentTarget.connectionState == 'connected') {
                console.log("PEER CONNECTED !!!!!")
                signalingServer.peerConnected()
            }else if(event.currentTarget.connectionState == 'failed'){
                console.log("Failed !!!")
            }
        });
        
        
    } catch(error) {
        console.error('Error opening video camera.', error);
    }
}

playVideoFromCamera();








