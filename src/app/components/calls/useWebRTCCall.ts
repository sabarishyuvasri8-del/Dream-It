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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

/**
 * Creates an active dummy canvas video track.
 * Emits regular frames so WebRTC SDP negotiation establishes video channel from millisecond 0.
 * Allows zero-delay, instantaneous switching to camera or screen sharing.
 */
function createDummyVideoTrack(): { track: MediaStreamTrack; stop: () => void } {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, 64, 64);
  }

  // Periodic heartbeat draw keeps the captureStream active across all browser engines
  const interval = setInterval(() => {
    if (ctx) {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, 64, 64);
    }
  }, 1000);

  const stream = canvas.captureStream(5);
  const track = stream.getVideoTracks()[0];
  return {
    track,
    stop: () => {
      clearInterval(interval);
      try {
        track.stop();
      } catch {}
    },
  };
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
  const [callDuration, setCallDuration] = useState(0);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const rawMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const rawCamTrackRef = useRef<MediaStreamTrack | null>(null);
  const dummyVideoRef = useRef<{ track: MediaStreamTrack; stop: () => void } | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionChannelRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const callStateRef = useRef<CallState>("idle");

  // Candidate buffering queues
  const outgoingCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const incomingCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const isAnswerReceivedRef = useRef(false);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Duration timer
  useEffect(() => {
    if (callState === "connected") {
      setCallDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
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

    // Stop dummy video
    if (dummyVideoRef.current) {
      dummyVideoRef.current.stop();
      dummyVideoRef.current = null;
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
    setActiveSession(null);
    setIncomingCall(null);
    setCallDuration(0);
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

        // 1. Acquire microphone
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        const micTrack = micStream.getAudioTracks()[0];
        rawMicTrackRef.current = micTrack;

        // 2. Acquire camera if callType === "video", or generate dummy track
        let videoTrack: MediaStreamTrack;
        if (isVideoCall) {
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            videoTrack = camStream.getVideoTracks()[0];
            rawCamTrackRef.current = videoTrack;
          } catch {
            const dummy = createDummyVideoTrack();
            dummyVideoRef.current = dummy;
            videoTrack = dummy.track;
            setIsVideoOff(true);
          }
        } else {
          const dummy = createDummyVideoTrack();
          dummyVideoRef.current = dummy;
          videoTrack = dummy.track;
        }

        const compositeLocalStream = new MediaStream([micTrack, videoTrack]);
        localStreamRef.current = compositeLocalStream;
        setLocalStream(compositeLocalStream);

        // 3. Initialize PeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        const rStream = new MediaStream();
        setRemoteStream(rStream);

        pc.addTrack(micTrack, compositeLocalStream);
        pc.addTrack(videoTrack, compositeLocalStream);

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

        // 4. Create Session Channel
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

        // 5. Create & set SDP Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 6. Broadcast invite to friend's personal signaling inbox
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

      // 1. Acquire microphone
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const micTrack = micStream.getAudioTracks()[0];
      rawMicTrackRef.current = micTrack;

      // 2. Acquire camera if video call, or create dummy track
      let videoTrack: MediaStreamTrack;
      if (isVideoCall) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          videoTrack = camStream.getVideoTracks()[0];
          rawCamTrackRef.current = videoTrack;
        } catch {
          const dummy = createDummyVideoTrack();
          dummyVideoRef.current = dummy;
          videoTrack = dummy.track;
          setIsVideoOff(true);
        }
      } else {
        const dummy = createDummyVideoTrack();
        dummyVideoRef.current = dummy;
        videoTrack = dummy.track;
      }

      const compositeLocalStream = new MediaStream([micTrack, videoTrack]);
      localStreamRef.current = compositeLocalStream;
      setLocalStream(compositeLocalStream);

      // 3. Initialize PeerConnection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      const rStream = new MediaStream();
      setRemoteStream(rStream);

      pc.addTrack(micTrack, compositeLocalStream);
      pc.addTrack(videoTrack, compositeLocalStream);

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

      // 4. Connect to session channel
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
        .on("broadcast", { event: "call-hangup" }, () => {
          callAudio.playEndCallChime();
          cleanupMediaAndPeer();
          setCallState("idle");
        });

      await sessionChannel.subscribe();

      // 5. Set Remote Offer & create Answer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      await flushIncomingCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 6. Broadcast Answer back to initiator
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
  }, [incomingCall, cleanupMediaAndPeer, flushIncomingCandidates]);

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
   * Toggle camera video on / off (Instant seamless track replacement)
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
      // Turn Camera OFF -> Replace with dummy canvas track
      if (rawCamTrackRef.current) {
        try {
          rawCamTrackRef.current.stop();
        } catch {}
        rawCamTrackRef.current = null;
      }
      if (!dummyVideoRef.current) {
        dummyVideoRef.current = createDummyVideoTrack();
      }

      await videoSender.replaceTrack(dummyVideoRef.current.track);

      // Update local stream preview
      if (localStreamRef.current) {
        const oldV = localStreamRef.current.getVideoTracks()[0];
        if (oldV) localStreamRef.current.removeTrack(oldV);
        localStreamRef.current.addTrack(dummyVideoRef.current.track);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
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
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const camTrack = camStream.getVideoTracks()[0];
        rawCamTrackRef.current = camTrack;

        await videoSender.replaceTrack(camTrack);

        // Update local stream preview
        if (localStreamRef.current) {
          const oldV = localStreamRef.current.getVideoTracks()[0];
          if (oldV) localStreamRef.current.removeTrack(oldV);
          localStreamRef.current.addTrack(camTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

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

    // Restore camera or dummy track
    if (videoSender) {
      if (!isVideoOff && rawCamTrackRef.current) {
        await videoSender.replaceTrack(rawCamTrackRef.current);
      } else {
        if (!dummyVideoRef.current) {
          dummyVideoRef.current = createDummyVideoTrack();
        }
        await videoSender.replaceTrack(dummyVideoRef.current.track);
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
        video: { cursor: "always" as any },
        audio: true, // Captures tab and system audio
      });

      screenStreamRef.current = displayStream;
      const screenVideoTrack = displayStream.getVideoTracks()[0];
      const screenAudioTrack = displayStream.getAudioTracks()[0];

      // 1. Swap Video Track
      await videoSender.replaceTrack(screenVideoTrack);

      // Update local preview to show the screen
      if (localStreamRef.current) {
        const oldV = localStreamRef.current.getVideoTracks()[0];
        if (oldV) localStreamRef.current.removeTrack(oldV);
        localStreamRef.current.addTrack(screenVideoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

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

      // When user clicks the browser native "Stop sharing" button
      screenVideoTrack.onended = () => {
        stopScreenShare();
      };

      // Notify remote peer that screen video is now streaming!
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
    callDuration,
    reactions,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    sendReaction,
    toggleHandRaise,
  };
}
