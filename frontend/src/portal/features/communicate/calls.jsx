/* Purpose: voice and video calls between the two people of a chat (owner, 28 November 2026), peer to peer over WebRTC.
   The API only passes the offer and the answer between the two portals over the live channel (model/live.js); the
   sound and picture go straight between the two browsers, found through the STUN servers the API names
   (Calls:IceServers). There is no TURN relay yet, so a call between two very restrictive networks may not connect;
   the screen then says so. A call rings only where the other person has ParishLife open; otherwise, or when nobody
   answers, the API leaves a "missed call" message in the chat.
   Main members: startCall (a chat's call buttons), hangUp, CallLayer (mounted once by the shell: the incoming ring
   and the call screen). Network candidates are gathered before the offer or answer is sent (no trickle), so the API
   carries two messages per call. */
import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { t } from '../../../lib/i18n.js';
import { toast, Avatar } from '../../ui/ui.jsx';
import { Icon } from '../../ui/icons.jsx';
import { onCall } from '../../model/live.js';
import { callSettings, placeCall, answerCall, endCall } from '../../model/modules/communications.js';
import { loadNames, nameOf } from '../../model/names.js';

const L = t;
const RING_MS = 45000,
  GATHER_MS = 2500;

/* The one call this tab knows about (null when there is none). */
let call = null;
const watchers = new Set();
const set = patch => {
  call = patch === null ? null : { ...call, ...patch };
  watchers.forEach(fn => fn());
};
const subscribe = fn => {
  watchers.add(fn);
  return () => watchers.delete(fn);
};
const snapshot = () => call;

let servers = null;
async function iceServers() {
  if (!servers) servers = (await callSettings().catch(() => null))?.iceServers || [];
  return servers.map(urls => ({ urls }));
}

/* Every candidate found, or the wait is over: the description then carries what was found. */
const gathered = pc =>
  new Promise(resolve => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const check = () => pc.iceGatheringState === 'complete' && done();
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const timer = setTimeout(done, GATHER_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });

async function connection(video) {
  const local = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
  });
  const pc = new RTCPeerConnection({ iceServers: await iceServers() });
  local.getTracks().forEach(track => pc.addTrack(track, local));
  const remote = new MediaStream();
  pc.ontrack = e => {
    remote.addTrack(e.track);
    set({ remote }); // redraw: the picture or sound has arrived
  };
  pc.onconnectionstatechange = () => {
    if (call?.pc !== pc) return;
    if (pc.connectionState === 'connected') set({ state: 'live', started: call.started || Date.now() });
    if (pc.connectionState === 'failed') {
      hangUp('Failed');
      toast(
        L('The call could not connect', 'تعذّر وصل المكالمة'),
        L(
          'One of the two networks blocks direct calls. Try another network, or write instead.',
          'إحدى الشبكتين تمنع المكالمات المباشرة. جرّب شبكة أخرى، أو اكتب رسالة.'
        ),
        'danger'
      );
    }
  };
  return { pc, local, remote };
}

function cleanup() {
  if (!call) return;
  clearTimeout(call.timer);
  call.local?.getTracks().forEach(track => track.stop());
  call.pc?.close();
  set(null);
}

const refused = (error, video) =>
  error?.name === 'NotAllowedError' || error?.name === 'NotFoundError'
    ? video
      ? L(
          'Allow the microphone and camera for ParishLife to call.',
          'اسمح لـ ParishLife باستخدام الميكروفون والكاميرا للاتصال.'
        )
      : L('Allow the microphone for ParishLife to call.', 'اسمح لـ ParishLife باستخدام الميكروفون للاتصال.')
    : error?.message || L('The call could not start.', 'تعذّر بدء المكالمة.');

/** Calls the other person of a chat. */
export async function startCall({ parishId, conversationId, name, peer, video }) {
  if (call) return toast(L('You are already on a call.', 'أنت في مكالمة الآن.'), '', 'info');
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined')
    return toast(L('This browser cannot make calls.', 'هذا المتصفح لا يستطيع إجراء المكالمات.'), '', 'danger');
  set({ state: 'starting', video, name, peer, parishId, conversationId });
  const mine = call;
  try {
    const { pc, local, remote } = await connection(video);
    if (call !== mine) {
      // hung up while the browser asked for the microphone
      local.getTracks().forEach(track => track.stop());
      return pc.close();
    }
    set({ pc, local, remote });
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    if (call?.pc !== pc) return;
    const placed = await placeCall(parishId, conversationId, video, pc.localDescription.sdp);
    if (!placed.ringing) {
      cleanup();
      return toast(
        L(`${name} does not have ParishLife open`, `${name} لا يفتح ParishLife الآن`),
        L('A missed call was left in your chat.', 'تُركت مكالمة فائتة في محادثتكما.'),
        'info'
      );
    }
    if (call?.pc !== pc) return endCall(placed.id, 'Cancelled').catch(() => {});
    set({ id: placed.id, state: 'ringing', timer: setTimeout(() => hangUp('NoAnswer'), RING_MS) });
  } catch (error) {
    cleanup();
    toast(refused(error, video), '', 'danger');
  }
}

/** Ends, cancels or declines the call. */
export function hangUp(reason) {
  if (!call) return;
  const { id, state } = call;
  const why = reason || (state === 'ringing' ? 'Cancelled' : state === 'incoming' ? 'Declined' : 'Ended');
  cleanup();
  if (id) endCall(id, why).catch(() => {});
}

async function accept() {
  const offer = call;
  if (offer?.state !== 'incoming') return;
  clearTimeout(offer.timer);
  set({ state: 'connecting' });
  try {
    const { pc, local, remote } = await connection(offer.video);
    if (call?.id !== offer.id) {
      local.getTracks().forEach(track => track.stop());
      return pc.close();
    }
    set({ pc, local, remote });
    await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    await answerCall(offer.id, pc.localDescription.sdp);
  } catch (error) {
    hangUp('Failed');
    toast(refused(error, offer.video), '', 'danger');
  }
}

const ENDED = {
  Declined: ['Call declined', 'رُفضت المكالمة'],
  Busy: ['On another call', 'في مكالمة أخرى'],
  Failed: ['The call could not connect', 'تعذّر وصل المكالمة'],
  NoAnswer: ['Missed call', 'مكالمة فائتة'],
  Cancelled: ['Missed call', 'مكالمة فائتة']
};

async function handle(event) {
  if (event.type === 'call') {
    if (call) return endCall(event.callId, 'Busy').catch(() => {});
    await loadNames(event.parishId, [event.from]).catch(() => {});
    if (call) return endCall(event.callId, 'Busy').catch(() => {});
    set({
      id: event.callId,
      state: 'incoming',
      video: !!event.video,
      sdp: event.sdp,
      peer: event.from,
      parishId: event.parishId,
      conversationId: event.conversationId,
      name: nameOf(event.parishId, event.from) || L('Someone from your parish', 'شخص من رعيتك'),
      timer: setTimeout(cleanup, RING_MS + 5000)
    });
  } else if (call?.id !== event.callId) return;
  else if (event.type === 'call-answer') {
    clearTimeout(call.timer);
    set({ state: 'connecting' });
    call.pc?.setRemoteDescription({ type: 'answer', sdp: event.sdp }).catch(() => hangUp('Failed'));
  } else if (event.type === 'call-taken' && call.state === 'incoming')
    cleanup(); // answered in another tab
  else if (event.type === 'call-end') {
    const live = call.state === 'live';
    cleanup();
    const [en, ar] = live ? ['Call ended', 'انتهت المكالمة'] : ENDED[event.reason] || ['Call ended', 'انتهت المكالمة'];
    toast(L(en, ar), '', 'info');
  }
}

/* A soft two-note ring while a call is ringing, made by the browser (no sound file). */
function useRing(on) {
  useEffect(() => {
    if (!on || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const beep = () => {
      [0, 0.25].forEach((at, i) => {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain();
        osc.frequency.value = i ? 660 : 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.24);
      });
    };
    beep();
    const timer = setInterval(beep, 2000);
    return () => {
      clearInterval(timer);
      ctx.close();
    };
  }, [on]);
}

const attach = stream => el => {
  if (el && stream && el.srcObject !== stream) el.srcObject = stream;
};
const duration = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The incoming ring and the call screen, over everything. */
export function CallLayer() {
  const c = useSyncExternalStore(subscribe, snapshot);
  const [, tick] = useReducer(n => n + 1, 0);
  useEffect(() => onCall(handle), []);
  useEffect(() => () => hangUp(), []); // leaving the portal ends the call
  useEffect(() => {
    if (c?.state !== 'live') return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [c?.state]);
  useRing(c?.state === 'incoming' || c?.state === 'ringing');
  useEffect(() => {
    if (!c) return;
    const leave = () => hangUp();
    addEventListener('pagehide', leave);
    return () => removeEventListener('pagehide', leave);
  }, [!!c]);
  if (!c) return null;
  const showVideo = c.video && c.remote?.getVideoTracks().length > 0 && c.state === 'live';
  const status =
    c.state === 'incoming'
      ? c.video
        ? L('Incoming video call', 'مكالمة فيديو واردة')
        : L('Incoming voice call', 'مكالمة صوتية واردة')
      : c.state === 'starting'
        ? L('Starting…', 'جارٍ البدء…')
        : c.state === 'ringing'
          ? L('Ringing…', 'يرنّ…')
          : c.state === 'connecting'
            ? L('Connecting…', 'جارٍ الوصل…')
            : duration(Date.now() - (c.started || Date.now()));
  const toggle = (kind, key) => {
    const off = !c[key];
    c.local?.[kind]().forEach(track => (track.enabled = !off));
    set({ [key]: off });
  };
  return (
    <div
      className={'call' + (showVideo ? ' call-video' : '')}
      role="dialog"
      aria-modal="true"
      aria-label={c.video ? L('Video call', 'مكالمة فيديو') : L('Voice call', 'مكالمة صوتية')}
      data-call={c.state}
    >
      {showVideo ? (
        <video className="call-remote" autoPlay playsInline ref={attach(c.remote)} />
      ) : (
        <audio autoPlay ref={attach(c.remote)} />
      )}
      {c.video && c.local && !c.cameraOff ? (
        <video className="call-self" autoPlay playsInline muted ref={attach(c.local)} />
      ) : null}
      <div className="call-who">
        {showVideo ? null : (
          <Avatar p={{ id: c.peer || c.id, lat: String(c.name || '').replace(/[^\p{L}\s-]/gu, ' ') }} cls="call-av" />
        )}
        <h2 dir="auto">{c.name}</h2>
        <p aria-live="polite">{status}</p>
      </div>
      <div className="call-acts">
        {c.state === 'incoming' ? (
          <>
            <button type="button" className="call-btn call-end" onClick={() => hangUp('Declined')}>
              <Icon name="close" size={24} />
              <span>{L('Decline', 'رفض')}</span>
            </button>
            <button type="button" className="call-btn call-ok" onClick={accept} data-accept="">
              <Icon name={c.video ? 'video' : 'phone'} size={24} />
              <span>{L('Answer', 'رد')}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="call-btn"
              aria-pressed={!!c.muted}
              onClick={() => toggle('getAudioTracks', 'muted')}
            >
              <Icon name="mic" size={22} />
              <span>{c.muted ? L('Unmute', 'إلغاء الكتم') : L('Mute', 'كتم')}</span>
            </button>
            {c.video ? (
              <button
                type="button"
                className="call-btn"
                aria-pressed={!!c.cameraOff}
                onClick={() => toggle('getVideoTracks', 'cameraOff')}
              >
                <Icon name="video" size={22} />
                <span>{c.cameraOff ? L('Camera on', 'تشغيل الكاميرا') : L('Camera off', 'إيقاف الكاميرا')}</span>
              </button>
            ) : null}
            <button type="button" className="call-btn call-end" onClick={() => hangUp()} data-hangup="">
              <Icon name="phone" size={22} />
              <span>{L('End', 'إنهاء')}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
