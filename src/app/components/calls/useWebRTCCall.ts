import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import { callAudio } from "./CallAudioSynthesizer";

export type CallType = "audio" | "video";
export type CallState = "idle" | "outgoing_ringing" | "incoming_ringing" | "connected" | "ended";

export interface ActiveCallSession {
  sessionId: string;
  friendId: string;
  friendName: string;
  friendImage?: string;
  isInitiator: boolean;
  callType: CallType;
  startedAt?: number;
}

export interface IncomingCallInvite {
  sessionId: string;
  callerId: string;
  callerName: string;
  callerImage?: string;
  callType: CallType;
  offer: RTCSessionDescriptionInit;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  leftPercent: number;
}

export interface InCallMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

/**
 * Optimizes WebRTC SDP for high performance gaming:
 * Configures Opus codec for low CPU, 32kbps mono voice with forward error correction.
 * Avoids CPU-heavy audio transcoding and eliminates background video encoding overhead.
 */
function optimizeSdp(sdp: string): string {
  return sdp.replace(
    /a=fmtp:111 ((?:(?!minptime).)*)/g,
    "a=fmtp:111 maxaveragebitrate=32000;stereo=0;sprop-stereo=0;cbr=1;useinbandfec=1;minptime=10 $1"
  );
}

export function useWebRTCCall(userId: string, userNameDisplay: string, userImageUrl?: string) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [activeSession, setActiveSession] = useState<ActiveCallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInvite | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
  const [remoteIsMuted, setRemoteIsMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [remoteHandRaised, setRemoteHandRaised] = useState(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [inCallMessages, setInCallMessages] = useState<InCallMessage[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const rawMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const rawCamTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionChannelRef = useRef<any>(null);
  const callStateRef = useRef<CallState>("idle");

  // Candidate buffering queues
  const outgoingCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const incomingCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const isAnswerReceivedRef = useRef(false);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  /**
   * Complete hardware cleanup and reset all call states
   */
  const cleanupMediaAndPeer = useCallback(() => {
    callAudio.stopAll();

    // Stop raw mic
    if (rawMicTrackRef.current) {
      try {
        rawMicTrackRef.current.stop();
      } catch {}
      rawMicTrackRef.current = null;
    }

    // Stop raw camera
    if (rawCamTrackRef.current) {
      try {
        rawCamTrackRef.current.stop();
      } catch {}
      rawCamTrackRef.current = null;
    }

    // Stop screen sharing tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      screenStreamRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }

    // Close AudioContext if used for mixing screen sound
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    // Close PeerConnection
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }

    // Remove active ephemeral Supabase session channel
    if (sessionChannelRef.current) {
      try {
        supabase.removeChannel(sessionChannelRef.current);
      } catch {}
      sessionChannelRef.current = null;
    }

    outgoingCandidateBufferRef.current = [];
    incomingCandidateBufferRef.current = [];
    isAnswerReceivedRef.current = false;

    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setRemoteHasVideo(false);
    setRemoteIsScreenSharing(false);
    setRemoteIsMuted(false);
    setHandRaised(false);
    setRemoteHandRaised(false);
    setInCallMessages([]);
    setActiveSession(null);
    setIncomingCall(null);
  }, []);

  /**
   * Helper to safely flush buffered remote ICE candidates
   */
  const flushIncomingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    while (incomingCandidateBufferRef.current.length > 0) {
      const cand = incomingCandidateBufferRef.current.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn("[WebRTC] Could not add buffered candidate:", e);
        }
      }
    }
  }, []);

  /**
   * Helper to safely flush buffered outgoing ICE candidates once peer is ready
   */
  const flushOutgoingCandidates = useCallback((channel: any) => {
    while (outgoingCandidateBufferRef.current.length > 0) {
      const cand = outgoingCandidateBufferRef.current.shift();
      if (cand && channel) {
        channel.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: cand },
        });
      }
    }
  }, []);

  /**
   * Find video sender safely using senders or transceivers
   */
  const getVideoSender = useCallback((pc: RTCPeerConnection) => {
    return (
      pc.getSenders().find((s) => s.track?.kind === "video") ||
      pc.getTransceivers().find((t) => t.receiver.track?.kind === "video" || t.sender.track?.kind === "video")?.sender ||
      pc.getSenders()[1]
    );
  }, []);

  /**
   * Find audio sender safely using senders or transceivers
   */
  const getAudioSender = useCallback((pc: RTCPeerConnection) => {
    return (
      pc.getSenders().find((s) => s.track?.kind === "audio") ||
      pc.getTransceivers().find((t) => t.receiver.track?.kind === "audio" || t.sender.track?.kind === "audio")?.sender ||
      pc.getSenders()[0]
    );
  }, []);

  /**
   * End or hang up an active call
   */
  const endCall = useCallback(() => {
    if (sessionChannelRef.current) {
      try {
        sessionChannelRef.current.send({
          type: "broadcast",
          event: "call-hangup",
          payload: {},
        });
      } catch {}
    }

    callAudio.playEndCallChime();
    cleanupMediaAndPeer();
    setCallState("idle");
  }, [cleanupMediaAndPeer]);

  /**
   * Decline an incoming call invite
   */
  const declineCall = useCallback(() => {
    if (incomingCall) {
      const sessionChannel = supabase.channel(`call-session:${incomingCall.sessionId}`);
      sessionChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          sessionChannel.send({
            type: "broadcast",
            event: "call-reject",
            payload: { reason: "declined" },
          }).then(() => {
            supabase.removeChannel(sessionChannel);
          });
        }
      });
    }

    callAudio.stopAll();
    setIncomingCall(null);
    setCallState("idle");
  }, [incomingCall]);

  /**
   * Start an outgoing call to a friend
   */
  const startCall = useCallback(
    async (friendId: string, friendName: string, friendImage: string | undefined, callType: CallType) => {
      if (callStateRef.current !== "idle") return;

      try {
        setCallState("outgoing_ringing");
        callAudio.startOutgoingRingtone();
        isAnswerReceivedRef.current = false;

        const isVideoCall = callType === "video";
        setIsVideoOff(!isVideoCall);
        setRemoteHasVideo(isVideoCall);

        const sessionId = `${userId}-${friendId}-${Date.now()}`;
        const session: ActiveCallSession = {
          sessionId,
          friendId,
          friendName,
          friendImage,
          isInitiator: true,
          callType,
        };
        setActiveSession(session);

        // 1. Acquire microphone with lightweight mono settings (Low CPU for 120 FPS gaming)
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false, // Saves CPU audio DSP cycles
            channelCount: 1, // Mono saves 50% CPU
          },
        });
        const micTrack = micStream.getAudioTracks()[0];
        rawMicTrackRef.current = micTrack;

        // 2. Initialize PeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        const rStream = new MediaStream();
        setRemoteStream(rStream);

        // Add mic track
        pc.addTrack(micTrack);

        // Add Video: If video call, acquire camera. If voice call, pre-allocate transceiver with NO track (0.00% CPU/GPU overhead)
        if (isVideoCall) {
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280, max: 1280 },
                height: { ideal: 720, max: 720 },
                frameRate: { ideal: 24, max: 30 },
              },
            });
            const camTrack = camStream.getVideoTracks()[0];
            rawCamTrackRef.current = camTrack;
            pc.addTrack(camTrack);
            const composite = new MediaStream([micTrack, camTrack]);
            localStreamRef.current = composite;
            setLocalStream(composite);
          } catch {
            pc.addTransceiver("video", { direction: "sendrecv" });
            setIsVideoOff(true);
            setLocalStream(new MediaStream([micTrack]));
          }
        } else {
          // Zero video encoding overhead on voice calls
          pc.addTransceiver("video", { direction: "sendrecv" });
          setLocalStream(new MediaStream([micTrack]));
        }

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          } else if (event.track) {
            rStream.addTrack(event.track);
            setRemoteStream(rStream);
          }
          if (event.track && event.track.kind === "audio") {
            event.track.enabled = true;
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            if (isAnswerReceivedRef.current && sessionChannelRef.current) {
              sessionChannelRef.current.send({
                type: "broadcast",
                event: "ice-candidate",
                payload: { candidate: event.candidate.toJSON() },
              });
            } else {
              outgoingCandidateBufferRef.current.push(event.candidate.toJSON());
            }
          }
        };

        // 3. Create Session Channel
        const sessionChannel = supabase.channel(`call-session:${sessionId}`);
        sessionChannelRef.current = sessionChannel;

        sessionChannel
          .on("broadcast", { event: "call-answer" }, async ({ payload }) => {
            if (!pcRef.current || pcRef.current.signalingState === "closed") return;
            try {
              isAnswerReceivedRef.current = true;
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
              
              await flushIncomingCandidates(pcRef.current);
              flushOutgoingCandidates(sessionChannelRef.current);

              // Broadcast initial media state to peer immediately
              sessionChannelRef.current.send({
                type: "broadcast",
                event: "media-state",
                payload: {
                  hasVideo: isVideoCall,
                  isScreenSharing: false,
                  isMuted: false,
                },
              });

              callAudio.playConnectedChime();
              setCallState("connected");
              setActiveSession((prev) => (prev ? { ...prev, startedAt: Date.now() } : null));
            } catch (err) {
              console.error("[WebRTC] Error setting remote description from answer:", err);
            }
          })
          .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
            if (!pcRef.current) return;
            try {
              if (pcRef.current.remoteDescription) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } else {
                incomingCandidateBufferRef.current.push(payload.candidate);
              }
            } catch (err) {
              console.warn("[WebRTC] Error adding ICE candidate:", err);
            }
          })
          .on("broadcast", { event: "media-state" }, ({ payload }) => {
            if (typeof payload.hasVideo === "boolean") {
              setRemoteHasVideo(payload.hasVideo);
            }
            if (typeof payload.isScreenSharing === "boolean") {
              setRemoteIsScreenSharing(payload.isScreenSharing);
            }
            if (typeof payload.isMuted === "boolean") {
              setRemoteIsMuted(payload.isMuted);
            }
            if (typeof payload.handRaised === "boolean") {
              setRemoteHandRaised(payload.handRaised);
            }
          })
          .on("broadcast", { event: "reaction" }, ({ payload }) => {
            if (payload?.emoji) {
              const reactionItem: FloatingReaction = {
                id: `${Date.now()}-${Math.random()}`,
                emoji: payload.emoji,
                leftPercent: Math.floor(Math.random() * 60) + 20,
              };
              setReactions((prev) => [...prev, reactionItem]);
              setTimeout(() => {
                setReactions((prev) => prev.filter((r) => r.id !== reactionItem.id));
              }, 2500);
            }
          })
          .on("broadcast", { event: "in-call-message" }, ({ payload }: { payload: InCallMessage }) => {
            if (payload?.text) {
              setInCallMessages((prev) => [...prev, payload]);
            }
          })
          .on("broadcast", { event: "call-reject" }, () => {
            callAudio.playEndCallChime();
            cleanupMediaAndPeer();
            setCallState("idle");
          })
          .on("broadcast", { event: "call-hangup" }, () => {
            callAudio.playEndCallChime();
            cleanupMediaAndPeer();
            setCallState("idle");
          });

        await sessionChannel.subscribe();

        // 4. Create & set SDP Offer (Optimized for low-latency gaming)
        const offer = await pc.createOffer();
        if (offer.sdp) {
          offer.sdp = optimizeSdp(offer.sdp);
        }
        await pc.setLocalDescription(offer);

        // 5. Broadcast invite to friend's signaling inbox
        const friendInbox = supabase.channel(`user-call-signals:${friendId}`);
        friendInbox.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            friendInbox.send({
              type: "broadcast",
              event: "call-invite",
              payload: {
                sessionId,
                callerId: userId,
                callerName: userNameDisplay,
                callerImage: userImageUrl,
                callType,
                offer,
              },
            }).then(() => {
              supabase.removeChannel(friendInbox);
            });
          }
        });
      } catch (err) {
        console.error("[WebRTC] Failed to start call:", err);
        cleanupMediaAndPeer();
        setCallState("idle");
      }
    },
    [userId, userNameDisplay, userImageUrl, cleanupMediaAndPeer, flushIncomingCandidates, flushOutgoingCandidates]
  );

  /**
   * Accept an incoming call invite
   */
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      callAudio.stopAll();
      setCallState("connected");

      const isVideoCall = incomingCall.callType === "video";
      setIsVideoOff(!isVideoCall);
      setRemoteHasVideo(isVideoCall);

      const session: ActiveCallSession = {
        sessionId: incomingCall.sessionId,
        friendId: incomingCall.callerId,
        friendName: incomingCall.callerName,
        friendImage: incomingCall.callerImage,
        isInitiator: false,
        callType: incomingCall.callType,
        startedAt: Date.now(),
      };
      setActiveSession(session);

      // 1. Acquire microphone with lightweight mono settings (Low CPU for 120 FPS gaming)
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      const micTrack = micStream.getAudioTracks()[0];
      rawMicTrackRef.current = micTrack;

      // 2. Initialize PeerConnection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      const rStream = new MediaStream();
      setRemoteStream(rStream);

      pc.addTrack(micTrack);

      if (isVideoCall) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 24, max: 30 },
            },
          });
          const camTrack = camStream.getVideoTracks()[0];
          rawCamTrackRef.current = camTrack;
          pc.addTrack(camTrack);
          const composite = new MediaStream([micTrack, camTrack]);
          localStreamRef.current = composite;
          setLocalStream(composite);
        } catch {
          pc.addTransceiver("video", { direction: "sendrecv" });
          setIsVideoOff(true);
          setLocalStream(new MediaStream([micTrack]));
        }
      } else {
        pc.addTransceiver("video", { direction: "sendrecv" });
        setLocalStream(new MediaStream([micTrack]));
      }

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else if (event.track) {
          rStream.addTrack(event.track);
          setRemoteStream(rStream);
        }
        if (event.track && event.track.kind === "audio") {
          event.track.enabled = true;
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          if (sessionChannelRef.current) {
            sessionChannelRef.current.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: { candidate: event.candidate.toJSON() },
            });
          } else {
            outgoingCandidateBufferRef.current.push(event.candidate.toJSON());
          }
        }
      };

      // 3. Connect to session channel
      const sessionChannel = supabase.channel(`call-session:${incomingCall.sessionId}`);
      sessionChannelRef.current = sessionChannel;

      sessionChannel
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (!pcRef.current) return;
          try {
            if (pcRef.current.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } else {
              incomingCandidateBufferRef.current.push(payload.candidate);
            }
          } catch (err) {
            console.warn("[WebRTC] Error adding ICE candidate:", err);
          }
        })
        .on("broadcast", { event: "media-state" }, ({ payload }) => {
          if (typeof payload.hasVideo === "boolean") {
            setRemoteHasVideo(payload.hasVideo);
          }
          if (typeof payload.isScreenSharing === "boolean") {
            setRemoteIsScreenSharing(payload.isScreenSharing);
          }
          if (typeof payload.isMuted === "boolean") {
            setRemoteIsMuted(payload.isMuted);
          }
          if (typeof payload.handRaised === "boolean") {
            setRemoteHandRaised(payload.handRaised);
          }
        })
        .on("broadcast", { event: "reaction" }, ({ payload }) => {
          if (payload?.emoji) {
            const reactionItem: FloatingReaction = {
              id: `${Date.now()}-${Math.random()}`,
              emoji: payload.emoji,
              leftPercent: Math.floor(Math.random() * 60) + 20,
            };
            setReactions((prev) => [...prev, reactionItem]);
            setTimeout(() => {
              setReactions((prev) => prev.filter((r) => r.id !== reactionItem.id));
            }, 2500);
          }
        })
        .on("broadcast", { event: "in-call-message" }, ({ payload }: { payload: InCallMessage }) => {
          if (payload?.text) {
            setInCallMessages((prev) => [...prev, payload]);
          }
        })
        .on("broadcast", { event: "call-hangup" }, () => {
          callAudio.playEndCallChime();
          cleanupMediaAndPeer();
          setCallState("idle");
        });

      await sessionChannel.subscribe();

      // 4. Set Remote Offer & create Answer (Optimized for low-latency gaming)
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      await flushIncomingCandidates(pc);

      const answer = await pc.createAnswer();
      if (answer.sdp) {
        answer.sdp = optimizeSdp(answer.sdp);
      }
      await pc.setLocalDescription(answer);

      // 5. Broadcast Answer back to initiator
      await sessionChannel.send({
        type: "broadcast",
        event: "call-answer",
        payload: { answer },
      });

      flushOutgoingCandidates(sessionChannelRef.current);

      // Send initial media state
      sessionChannel.send({
        type: "broadcast",
        event: "media-state",
        payload: {
          hasVideo: isVideoCall,
          isScreenSharing: false,
          isMuted: false,
        },
      });

      callAudio.playConnectedChime();
      setIncomingCall(null);
    } catch (err) {
      console.error("[WebRTC] Error accepting call:", err);
      cleanupMediaAndPeer();
      setCallState("idle");
    }
  }, [incomingCall, cleanupMediaAndPeer, flushIncomingCandidates, flushOutgoingCandidates]);

  /**
   * Toggle microphone mute / unmute
   */
  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (rawMicTrackRef.current) {
      rawMicTrackRef.current.enabled = !nextMuted;
    }
    if (localStreamRef.current) {
      const aTrack = localStreamRef.current.getAudioTracks()[0];
      if (aTrack) aTrack.enabled = !nextMuted;
    }

    if (sessionChannelRef.current) {
      sessionChannelRef.current.send({
        type: "broadcast",
        event: "media-state",
        payload: {
          hasVideo: !isVideoOff || isScreenSharing,
          isScreenSharing,
          isMuted: nextMuted,
          handRaised,
        },
      });
    }
  }, [isMuted, isVideoOff, isScreenSharing, handRaised]);

  /**
   * Toggle camera video on / off (Instant seamless track replacement, 0% CPU when off)
   */
  const toggleVideo = useCallback(async () => {
    if (!pcRef.current) return;

    const pc = pcRef.current;
    const videoSender = getVideoSender(pc);

    if (!videoSender) {
      console.warn("[WebRTC] No video sender found to replace");
      return;
    }

    // If currently sharing screen, turning on camera stops screen sharing
    if (isScreenSharing && screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    }

    if (!isVideoOff) {
      // Turn Camera OFF -> Stop hardware sensor completely, set track to null (0.00% CPU/GPU)
      if (rawCamTrackRef.current) {
        try {
          rawCamTrackRef.current.stop();
        } catch {}
        rawCamTrackRef.current = null;
      }

      await videoSender.replaceTrack(null);

      if (rawMicTrackRef.current) {
        setLocalStream(new MediaStream([rawMicTrackRef.current]));
      } else {
        setLocalStream(null);
      }

      setIsVideoOff(true);

      if (sessionChannelRef.current) {
        sessionChannelRef.current.send({
          type: "broadcast",
          event: "media-state",
          payload: { hasVideo: false, isScreenSharing: false, isMuted, handRaised },
        });
      }
    } else {
      // Turn Camera ON -> Acquire camera and replace sender track
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 },
            frameRate: { ideal: 24, max: 30 },
          },
        });
        const camTrack = camStream.getVideoTracks()[0];
        rawCamTrackRef.current = camTrack;

        await videoSender.replaceTrack(camTrack);

        const tracks = [camTrack];
        if (rawMicTrackRef.current) tracks.push(rawMicTrackRef.current);
        const composite = new MediaStream(tracks);
        localStreamRef.current = composite;
        setLocalStream(composite);

        setIsVideoOff(false);

        if (sessionChannelRef.current) {
          sessionChannelRef.current.send({
            type: "broadcast",
            event: "media-state",
            payload: { hasVideo: true, isScreenSharing: false, isMuted, handRaised },
          });
        }
      } catch (err) {
        console.warn("[WebRTC] Camera access denied or failed:", err);
      }
    }
  }, [isVideoOff, isScreenSharing, isMuted, handRaised, getVideoSender]);

  /**
   * Stop Screen Share Helper
   */
  const stopScreenShare = useCallback(async () => {
    if (!pcRef.current) return;
    const pc = pcRef.current;
    const videoSender = getVideoSender(pc);
    const audioSender = getAudioSender(pc);

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    // Restore raw mic track
    if (rawMicTrackRef.current && audioSender) {
      await audioSender.replaceTrack(rawMicTrackRef.current);
    }

    // Restore camera or null track
    if (videoSender) {
      if (!isVideoOff && rawCamTrackRef.current) {
        await videoSender.replaceTrack(rawCamTrackRef.current);
      } else {
        await videoSender.replaceTrack(null);
      }
    }

    setIsScreenSharing(false);

    if (sessionChannelRef.current) {
      sessionChannelRef.current.send({
        type: "broadcast",
        event: "media-state",
        payload: { hasVideo: !isVideoOff && Boolean(rawCamTrackRef.current), isScreenSharing: false, isMuted, handRaised },
      });
    }
  }, [isVideoOff, isMuted, handRaised, getVideoSender, getAudioSender]);

  /**
   * Share Screen with tab/system sound + microphone mixing
   */
  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current) return;

    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }

    const pc = pcRef.current;
    const videoSender = getVideoSender(pc);
    const audioSender = getAudioSender(pc);

    if (!videoSender) return;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always" as any,
          frameRate: { ideal: 30, max: 30 },
        },
        audio: true,
      });

      screenStreamRef.current = displayStream;
      const screenVideoTrack = displayStream.getVideoTracks()[0];
      const screenAudioTrack = displayStream.getAudioTracks()[0];

      // 1. Swap Video Track
      await videoSender.replaceTrack(screenVideoTrack);

      // Update local preview
      const tracks = [screenVideoTrack];
      if (rawMicTrackRef.current) tracks.push(rawMicTrackRef.current);
      const composite = new MediaStream(tracks);
      localStreamRef.current = composite;
      setLocalStream(composite);

      // 2. Mix screen sound + microphone so remote peer hears BOTH!
      if (screenAudioTrack && audioSender) {
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioCtxClass();
          if (audioCtx.state === "suspended") {
            await audioCtx.resume();
          }
          audioContextRef.current = audioCtx;
          const dest = audioCtx.createMediaStreamDestination();

          if (rawMicTrackRef.current) {
            const micSource = audioCtx.createMediaStreamSource(new MediaStream([rawMicTrackRef.current]));
            micSource.connect(dest);
          }

          const screenSource = audioCtx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
          screenSource.connect(dest);

          const mixedTrack = dest.stream.getAudioTracks()[0];
          await audioSender.replaceTrack(mixedTrack);
        } catch (mixErr) {
          console.warn("[WebRTC] Audio mixing fallback to screen audio:", mixErr);
          await audioSender.replaceTrack(screenAudioTrack);
        }
      }

      setIsScreenSharing(true);

      screenVideoTrack.onended = () => {
        stopScreenShare();
      };

      if (sessionChannelRef.current) {
        sessionChannelRef.current.send({
          type: "broadcast",
          event: "media-state",
          payload: { hasVideo: true, isScreenSharing: true, isMuted, handRaised },
        });
      }
    } catch (err) {
      console.warn("[WebRTC] Screen sharing cancelled or denied:", err);
    }
  }, [isScreenSharing, isMuted, handRaised, getVideoSender, getAudioSender, stopScreenShare]);

  /**
   * Send reaction emoji to peer
   */
  const sendReaction = useCallback((emoji: string) => {
    const reactionItem: FloatingReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      leftPercent: Math.floor(Math.random() * 60) + 20,
    };
    setReactions((prev) => [...prev, reactionItem]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reactionItem.id));
    }, 2500);

    if (sessionChannelRef.current) {
      sessionChannelRef.current.send({
        type: "broadcast",
        event: "reaction",
        payload: { emoji },
      });
    }
  }, []);

  /**
   * Toggle hand raise
   */
  const toggleHandRaise = useCallback(() => {
    const nextHand = !handRaised;
    setHandRaised(nextHand);

    if (sessionChannelRef.current) {
      sessionChannelRef.current.send({
        type: "broadcast",
        event: "media-state",
        payload: {
          hasVideo: !isVideoOff || isScreenSharing,
          isScreenSharing,
          isMuted,
          handRaised: nextHand,
        },
      });
    }
  }, [handRaised, isVideoOff, isScreenSharing, isMuted]);

  // Global inbox listener for incoming calls
  useEffect(() => {
    if (!userId) return;

    const inboxChannel = supabase.channel(`user-call-signals:${userId}`);
    inboxChannel
      .on("broadcast", { event: "call-invite" }, ({ payload }: { payload: IncomingCallInvite }) => {
        if (callStateRef.current !== "idle") {
          const busyChannel = supabase.channel(`call-session:${payload.sessionId}`);
          busyChannel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              busyChannel.send({
                type: "broadcast",
                event: "call-reject",
                payload: { reason: "busy" },
              }).then(() => {
                supabase.removeChannel(busyChannel);
              });
            }
          });
          return;
        }

        setIncomingCall(payload);
        setCallState("incoming_ringing");
        callAudio.startIncomingRingtone();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(inboxChannel);
    };
  }, [userId]);

  // Page unload cleanup
  useEffect(() => {
    const handleUnload = () => {
      if (sessionChannelRef.current) {
        sessionChannelRef.current.send({
          type: "broadcast",
          event: "call-hangup",
          payload: {},
        });
      }
      cleanupMediaAndPeer();
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [cleanupMediaAndPeer]);

  /**
   * Send ephemeral in-call chat message
   */
  const sendInCallMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !sessionChannelRef.current) return;
      const msg: InCallMessage = {
        id: `${Date.now()}-${Math.random()}`,
        senderId: userId,
        senderName: userNameDisplay,
        text: text.trim(),
        timestamp: Date.now(),
      };
      setInCallMessages((prev) => [...prev, msg]);
      sessionChannelRef.current.send({
        type: "broadcast",
        event: "in-call-message",
        payload: msg,
      });
    },
    [userId, userNameDisplay]
  );

  /**
   * Switch active microphone
   */
  const changeAudioInput = useCallback(
    async (deviceId: string) => {
      if (!pcRef.current) return;
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            channelCount: 1,
          },
        });
        const newTrack = newStream.getAudioTracks()[0];
        if (rawMicTrackRef.current) {
          rawMicTrackRef.current.stop();
        }
        rawMicTrackRef.current = newTrack;
        const audioSender = getAudioSender(pcRef.current);
        if (audioSender) {
          await audioSender.replaceTrack(newTrack);
        }
      } catch (err) {
        console.warn("[WebRTC] Could not switch mic:", err);
      }
    },
    [getAudioSender]
  );

  /**
   * Switch active camera
   */
  const changeVideoInput = useCallback(
    async (deviceId: string) => {
      if (!pcRef.current || isVideoOff) return;
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 },
            frameRate: { ideal: 24, max: 30 },
          },
        });
        const newTrack = newStream.getVideoTracks()[0];
        if (rawCamTrackRef.current) {
          rawCamTrackRef.current.stop();
        }
        rawCamTrackRef.current = newTrack;
        const videoSender = getVideoSender(pcRef.current);
        if (videoSender) {
          await videoSender.replaceTrack(newTrack);
        }
        const tracks = [newTrack];
        if (rawMicTrackRef.current) tracks.push(rawMicTrackRef.current);
        const composite = new MediaStream(tracks);
        localStreamRef.current = composite;
        setLocalStream(composite);
      } catch (err) {
        console.warn("[WebRTC] Could not switch camera:", err);
      }
    },
    [isVideoOff, getVideoSender]
  );

  return {
    callState,
    activeSession,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    remoteHasVideo,
    remoteIsScreenSharing,
    remoteIsMuted,
    handRaised,
    remoteHandRaised,
    reactions,
    inCallMessages,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    sendReaction,
    toggleHandRaise,
    sendInCallMessage,
    changeAudioInput,
    changeVideoInput,
  };
}
