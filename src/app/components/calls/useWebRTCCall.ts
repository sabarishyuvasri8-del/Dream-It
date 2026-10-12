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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function useWebRTCCall(userId: string, userNameDisplay: string, userImageUrl?: string) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [activeSession, setActiveSession] = useState<ActiveCallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInvite | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const sessionChannelRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const callStateRef = useRef<CallState>("idle");

  // Keep ref synchronized to prevent stale closure checks in realtime handlers
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Call timer interval when connected
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

    // Stop local camera/mic hardware immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }

    // Stop screen share tracks if any
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      screenStreamRef.current = null;
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

    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setActiveSession(null);
    setIncomingCall(null);
    setCallDuration(0);
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
      // Notify caller on their session channel that call was declined
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

        // 1. Acquire local user media (audio + video if requested)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video",
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        // 2. Initialize WebRTC PeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Add local tracks to PeerConnection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Listen for incoming remote tracks from friend
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          }
        };

        // Listen for ICE candidates to send over Realtime broadcast
        pc.onicecandidate = (event) => {
          if (event.candidate && sessionChannelRef.current) {
            sessionChannelRef.current.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: { candidate: event.candidate.toJSON() },
            });
          }
        };

        // 3. Create deterministic session channel
        const sessionChannel = supabase.channel(`call-session:${sessionId}`);
        sessionChannelRef.current = sessionChannel;

        sessionChannel
          .on("broadcast", { event: "call-answer" }, async ({ payload }) => {
            if (!pcRef.current || pcRef.current.signalingState === "closed") return;
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
              // Flush any buffered ICE candidates
              while (pendingCandidatesRef.current.length > 0) {
                const cand = pendingCandidatesRef.current.shift();
                if (cand) await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
              }
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
                pendingCandidatesRef.current.push(payload.candidate);
              }
            } catch (err) {
              console.warn("[WebRTC] Error adding ICE candidate:", err);
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

        // 4. Create and set local SDP Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 5. Broadcast call invite to friend's personal signaling inbox
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
    [userId, userNameDisplay, userImageUrl, cleanupMediaAndPeer]
  );

  /**
   * Accept an incoming call invite
   */
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      callAudio.stopAll();
      setCallState("connected");

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

      // 1. Acquire local user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Initialize PeerConnection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && sessionChannelRef.current) {
          sessionChannelRef.current.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate.toJSON() },
          });
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
              pendingCandidatesRef.current.push(payload.candidate);
            }
          } catch (err) {
            console.warn("[WebRTC] Error adding ICE candidate:", err);
          }
        })
        .on("broadcast", { event: "call-hangup" }, () => {
          callAudio.playEndCallChime();
          cleanupMediaAndPeer();
          setCallState("idle");
        });

      await sessionChannel.subscribe();

      // 4. Set Remote Offer & create Answer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      // Flush any buffered ICE candidates
      while (pendingCandidatesRef.current.length > 0) {
        const cand = pendingCandidatesRef.current.shift();
        if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 5. Broadcast Answer back to initiator
      await sessionChannel.send({
        type: "broadcast",
        event: "call-answer",
        payload: { answer },
      });

      callAudio.playConnectedChime();
      setIncomingCall(null);
    } catch (err) {
      console.error("[WebRTC] Error accepting call:", err);
      cleanupMediaAndPeer();
      setCallState("idle");
    }
  }, [incomingCall, cleanupMediaAndPeer]);

  /**
   * Toggle microphone mute / unmute
   */
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  /**
   * Toggle camera video on / off
   */
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current || !pcRef.current) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      // Toggle existing track
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    } else {
      // User started as audio-only, now turning camera on
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = camStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newTrack);
        pcRef.current.addTrack(newTrack, localStreamRef.current);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsVideoOff(false);
      } catch (err) {
        console.warn("[WebRTC] Could not enable camera:", err);
      }
    }
  }, []);

  /**
   * Toggle screen sharing for collaborative study
   */
  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current) return;

    if (isScreenSharing) {
      // Stop screen sharing and restore webcam
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (videoSender && camTrack) {
          videoSender.replaceTrack(camTrack);
        }
      }
      setIsScreenSharing(false);
    } else {
      // Start screen sharing
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = displayStream;
        const screenTrack = displayStream.getVideoTracks()[0];

        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        } else if (localStreamRef.current) {
          pcRef.current.addTrack(screenTrack, localStreamRef.current);
        }

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current) {
            const camTrack = localStreamRef.current.getVideoTracks()[0];
            const sender = pcRef.current?.getSenders().find((s) => s.track && s.track.kind === "video");
            if (sender && camTrack) sender.replaceTrack(camTrack);
          }
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.warn("[WebRTC] Screen sharing cancelled or denied:", err);
      }
    }
  }, [isScreenSharing]);

  // Listen globally to the user's personal signaling inbox for incoming calls
  useEffect(() => {
    if (!userId) return;

    const inboxChannel = supabase.channel(`user-call-signals:${userId}`);
    inboxChannel
      .on("broadcast", { event: "call-invite" }, ({ payload }: { payload: IncomingCallInvite }) => {
        // If already busy in a call, reject automatically with 'busy'
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

        // Display incoming call alert and play pleasant ringtone
        setIncomingCall(payload);
        setCallState("incoming_ringing");
        callAudio.startIncomingRingtone();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(inboxChannel);
    };
  }, [userId]);

  // Safety cleanup if user closes or reloads page
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
    callDuration,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  };
}
