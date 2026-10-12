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
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const rawMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionChannelRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const callStateRef = useRef<CallState>("idle");

  // Candidate buffering queues to ensure zero dropped candidates
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

    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      localStreamRef.current = null;
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
   * Attach and monitor remote tracks
   */
  const setupRemoteStreamMonitoring = useCallback((stream: MediaStream) => {
    setRemoteStream(stream);

    const checkVideoActive = () => {
      const vTracks = stream.getVideoTracks();
      const active = vTracks.length > 0 && vTracks.some((t) => t.enabled && t.readyState === "live");
      setRemoteHasVideo(active);
    };

    checkVideoActive();

    stream.onaddtrack = () => checkVideoActive();
    stream.onremovetrack = () => checkVideoActive();
    stream.getVideoTracks().forEach((vt) => {
      vt.onmute = () => checkVideoActive();
      vt.onunmute = () => checkVideoActive();
      vt.onended = () => checkVideoActive();
    });
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

        // 1. Acquire local user media (always get audio; get video if callType === "video")
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });

        localStreamRef.current = stream;
        rawMicTrackRef.current = stream.getAudioTracks()[0] || null;
        setLocalStream(stream);
        setIsVideoOff(callType !== "video");

        // 2. Initialize PeerConnection with pre-allocated audio & video transceivers
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Remote stream container
        const rStream = new MediaStream();
        setupRemoteStreamMonitoring(rStream);

        // Setup transceivers: allows seamless audio <-> video <-> screen share transitions
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          pc.addTrack(audioTrack, stream);
        } else {
          pc.addTransceiver("audio", { direction: "sendrecv" });
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          pc.addTrack(videoTrack, stream);
        } else {
          pc.addTransceiver("video", { direction: "sendrecv" });
        }

        // On track received from remote friend
        pc.ontrack = (event) => {
          if (event.track) {
            rStream.addTrack(event.track);
            setupRemoteStreamMonitoring(rStream);
          }
        };

        // On ICE Candidate gathered
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            if (isAnswerReceivedRef.current && sessionChannelRef.current) {
              sessionChannelRef.current.send({
                type: "broadcast",
                event: "ice-candidate",
                payload: { candidate: event.candidate.toJSON() },
              });
            } else {
              // Buffer candidates until Callee answers and is subscribed to channel
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
              
              // Flush buffered incoming candidates
              await flushIncomingCandidates(pcRef.current);
              
              // Flush buffered outgoing candidates now that friend is subscribed!
              flushOutgoingCandidates(sessionChannelRef.current);

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
    [userId, userNameDisplay, userImageUrl, cleanupMediaAndPeer, flushIncomingCandidates, flushOutgoingCandidates, setupRemoteStreamMonitoring]
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
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: incomingCall.callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });

      localStreamRef.current = stream;
      rawMicTrackRef.current = stream.getAudioTracks()[0] || null;
      setLocalStream(stream);
      setIsVideoOff(incomingCall.callType !== "video");

      // 2. Initialize PeerConnection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Remote stream container
      const rStream = new MediaStream();
      setupRemoteStreamMonitoring(rStream);

      // Add tracks or transceivers
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, stream);
      } else {
        pc.addTransceiver("audio", { direction: "sendrecv" });
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        pc.addTrack(videoTrack, stream);
      } else {
        pc.addTransceiver("video", { direction: "sendrecv" });
      }

      pc.ontrack = (event) => {
        if (event.track) {
          rStream.addTrack(event.track);
          setupRemoteStreamMonitoring(rStream);
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
        })
        .on("broadcast", { event: "call-hangup" }, () => {
          callAudio.playEndCallChime();
          cleanupMediaAndPeer();
          setCallState("idle");
        });

      await sessionChannel.subscribe();

      // 4. Set Remote Offer & create Answer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      // Flush any buffered candidates from caller
      await flushIncomingCandidates(pc);

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
  }, [incomingCall, cleanupMediaAndPeer, flushIncomingCandidates, setupRemoteStreamMonitoring]);

  /**
   * Toggle microphone mute / unmute
   */
  const toggleMute = useCallback(() => {
    if (rawMicTrackRef.current) {
      rawMicTrackRef.current.enabled = !rawMicTrackRef.current.enabled;
      setIsMuted(!rawMicTrackRef.current.enabled);
    }
    if (localStreamRef.current) {
      const aTrack = localStreamRef.current.getAudioTracks()[0];
      if (aTrack) aTrack.enabled = !isMuted;
    }
  }, [isMuted]);

  /**
   * Toggle camera video on / off (instant transmission without renegotiation)
   */
  const toggleVideo = useCallback(async () => {
    if (!pcRef.current) return;

    const pc = pcRef.current;
    const senders = pc.getSenders();
    let videoSender = senders.find((s) => s.track?.kind === "video");
    if (!videoSender) {
      // Find video transceiver sender
      const tr = pc.getTransceivers().find((t) => t.sender.track?.kind === "video" || t.receiver.track.kind === "video");
      if (tr) videoSender = tr.sender;
    }

    // If currently screen sharing, turning on camera replaces screen share
    if (isScreenSharing && screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    }

    if (!isVideoOff) {
      // Turn camera OFF
      if (localStreamRef.current) {
        const vTrack = localStreamRef.current.getVideoTracks()[0];
        if (vTrack) {
          vTrack.stop();
          localStreamRef.current.removeTrack(vTrack);
        }
      }
      if (videoSender) {
        await videoSender.replaceTrack(null);
      }
      setIsVideoOff(true);

      // Notify remote peer
      if (sessionChannelRef.current) {
        sessionChannelRef.current.send({
          type: "broadcast",
          event: "media-state",
          payload: { hasVideo: false },
        });
      }
    } else {
      // Turn camera ON
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const newTrack = camStream.getVideoTracks()[0];

        if (localStreamRef.current) {
          localStreamRef.current.addTrack(newTrack);
        } else {
          localStreamRef.current = new MediaStream([newTrack]);
        }
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        if (videoSender) {
          await videoSender.replaceTrack(newTrack);
        } else if (localStreamRef.current) {
          pc.addTrack(newTrack, localStreamRef.current);
        }

        setIsVideoOff(false);

        // Notify remote peer
        if (sessionChannelRef.current) {
          sessionChannelRef.current.send({
            type: "broadcast",
            event: "media-state",
            payload: { hasVideo: true },
          });
        }
      } catch (err) {
        console.warn("[WebRTC] Could not enable camera:", err);
      }
    }
  }, [isVideoOff, isScreenSharing]);

  /**
   * Share screen with tab/system sound and mic audio mixing
   */
  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current) return;

    const pc = pcRef.current;
    const senders = pc.getSenders();
    let videoSender = senders.find((s) => s.track?.kind === "video");
    if (!videoSender) {
      const tr = pc.getTransceivers().find((t) => t.receiver.track.kind === "video");
      if (tr) videoSender = tr.sender;
    }

    let audioSender = senders.find((s) => s.track?.kind === "audio");
    if (!audioSender) {
      const tr = pc.getTransceivers().find((t) => t.receiver.track.kind === "audio");
      if (tr) audioSender = tr.sender;
    }

    if (isScreenSharing) {
      // STOP screen share
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }

      // Reconnect original mic if mixed
      if (rawMicTrackRef.current && audioSender) {
        await audioSender.replaceTrack(rawMicTrackRef.current);
      }

      // Restore camera or clear video
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack && !isVideoOff) {
        if (videoSender) await videoSender.replaceTrack(camTrack);
      } else {
        if (videoSender) await videoSender.replaceTrack(null);
      }

      setIsScreenSharing(false);

      if (sessionChannelRef.current) {
        sessionChannelRef.current.send({
          type: "broadcast",
          event: "media-state",
          payload: { hasVideo: !isVideoOff },
        });
      }
    } else {
      // START screen sharing with audio!
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" as any },
          audio: true, // Captures tab and system audio!
        });

        screenStreamRef.current = displayStream;
        const screenVideoTrack = displayStream.getVideoTracks()[0];
        const screenAudioTrack = displayStream.getAudioTracks()[0];

        // 1. Send Screen Video Track
        if (videoSender) {
          await videoSender.replaceTrack(screenVideoTrack);
        } else if (localStreamRef.current) {
          pc.addTrack(screenVideoTrack, localStreamRef.current);
        }

        // 2. Mix Screen Sound + Microphone so remote peer hears BOTH!
        if (screenAudioTrack && audioSender) {
          try {
            const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtxClass();
            audioContextRef.current = audioCtx;
            const dest = audioCtx.createMediaStreamDestination();

            // Connect raw mic if available
            if (rawMicTrackRef.current) {
              const micSource = audioCtx.createMediaStreamSource(new MediaStream([rawMicTrackRef.current]));
              micSource.connect(dest);
            }

            // Connect screen audio track
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
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
          }
          if (rawMicTrackRef.current && audioSender) {
            audioSender.replaceTrack(rawMicTrackRef.current).catch(() => {});
          }
          const cam = localStreamRef.current?.getVideoTracks()[0];
          if (cam && !isVideoOff && videoSender) {
            videoSender.replaceTrack(cam).catch(() => {});
          } else if (videoSender) {
            videoSender.replaceTrack(null).catch(() => {});
          }
          setIsScreenSharing(false);

          if (sessionChannelRef.current) {
            sessionChannelRef.current.send({
              type: "broadcast",
              event: "media-state",
              payload: { hasVideo: !isVideoOff },
            });
          }
        };

        // Notify remote peer of video stream
        if (sessionChannelRef.current) {
          sessionChannelRef.current.send({
            type: "broadcast",
            event: "media-state",
            payload: { hasVideo: true },
          });
        }
      } catch (err) {
        console.warn("[WebRTC] Screen sharing cancelled or denied:", err);
      }
    }
  }, [isScreenSharing, isVideoOff]);

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
