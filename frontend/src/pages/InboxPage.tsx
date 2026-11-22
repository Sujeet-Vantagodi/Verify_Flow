import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Bell, Check, Clipboard, Inbox, LockKeyhole, MessageSquareText, RefreshCw, ShieldCheck, Smartphone, Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { fetchMessage, fetchMessages, pairInbox } from "../services/inbox-api";
import type { InboxMessage } from "../types";

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:5000";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function InboxPage() {
  const reducedMotion = useReducedMotion();
  const [pairingCode, setPairingCode] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem("verifyflow-device-token") ?? "");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [pairing, setPairing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const unreadCount = useMemo(() => messages.filter((message) => message.unread).length, [messages]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    fetchMessages(token).then((result) => {
      if (!active) return;
      if (result.success && result.data) setMessages(result.data.messages);
      else setNotice(result.message);
    }).catch(() => active && setNotice("Unable to load your inbox right now.")).finally(() => active && setLoading(false));

    const socket: Socket = io(socketUrl, { auth: { deviceToken: token }, reconnection: true });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("inbox:message", (message: InboxMessage) => {
      setMessages((current) => [message, ...current.filter((item) => item.id !== message.id)]);
      setNotice("New verification message received.");
      window.setTimeout(() => setNotice(""), 3200);
    });
    return () => { active = false; socket.disconnect(); };
  }, [token]);

  async function handlePair(event: FormEvent) {
    event.preventDefault();
    if (pairingCode.replace(/\D/g, "").length !== 6) { setNotice("Enter the six-digit pairing code from your laptop."); return; }
    setPairing(true); setNotice("");
    try {
      const result = await pairInbox(pairingCode.replace(/\D/g, ""));
      if (!result.success || !result.data) throw new Error(result.message);
      sessionStorage.setItem("verifyflow-device-token", result.data.deviceToken);
      setToken(result.data.deviceToken);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Pairing failed. Check the code and try again.");
    } finally { setPairing(false); }
  }

  async function openMessage(message: InboxMessage) {
    setSelected(message);
    if (message.unread && token) {
      const result = await fetchMessage(message.id, token);
      if (result.success && result.data) {
        setSelected(result.data);
        setMessages((current) => current.map((item) => item.id === result.data!.id ? result.data! : item));
      }
    }
  }

  async function copyOtp() {
    if (!selected?.otp) return;
    await navigator.clipboard.writeText(selected.otp);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function disconnect() {
    sessionStorage.removeItem("verifyflow-device-token");
    setToken(""); setMessages([]); setSelected(null); setConnected(false);
  }

  if (!token) {
    return <main className="inbox-shell pairing-shell"><div className="inbox-ambient" /><a className="inbox-brand" href="/inbox"><span className="brand-mark"><ShieldCheck size={18} /></span> Verify<span>Flow</span></a><section className="pairing-card"><div className="pairing-hero-icon"><Smartphone size={28} /></div><span className="inbox-eyebrow">Virtual SMS inbox</span><h1>Pair your inbox</h1><p>Enter the secure six-digit code shown on your verification screen to connect this device.</p><form onSubmit={handlePair}><label htmlFor="pairing-code">Pairing code</label><input id="pairing-code" autoFocus inputMode="numeric" maxLength={7} placeholder="123 456" value={pairingCode} onChange={(event) => setPairingCode(event.target.value.replace(/[^\d ]/g, ""))} /><button className="inbox-primary" disabled={pairing}>{pairing ? <span className="inbox-spinner" /> : <>Connect secure inbox <ArrowLeft size={17} className="rotate-arrow" /></>}</button></form>{notice && <p className="inbox-error">{notice}</p>}<div className="pairing-foot"><LockKeyhole size={14} /> Your pairing code expires after a short time and can only be used once.</div></section></main>;
  }

  return <main className="inbox-shell"><div className="inbox-ambient" /><header className="inbox-header"><a className="inbox-brand" href="/inbox"><span className="brand-mark"><ShieldCheck size={18} /></span> Verify<span>Flow</span></a><div className="connection-pill" role="status" aria-live="polite"><span className={connected ? "connection-dot" : "connection-dot offline"} /> {connected ? "Live connection" : "Reconnecting"}</div><button className="disconnect-button" onClick={disconnect}>Disconnect</button></header><section className="inbox-content"><div className="inbox-title-row"><div><span className="inbox-eyebrow">Private virtual inbox</span><h1>Messages <span>{messages.length}</span></h1><p>Incoming verification codes appear here in real time.</p></div><div className="inbox-stat" aria-label={`${unreadCount} unread messages`}><Bell size={16} /><strong>{unreadCount}</strong><small>unread</small></div></div><div className="inbox-layout"><section className="message-list"><div className="list-header"><span>Recent messages</span><button aria-label="Refresh messages" onClick={() => token && fetchMessages(token).then((result) => result.data && setMessages(result.data.messages))}><RefreshCw size={15} /></button></div>{loading ? <div className="empty-inbox" role="status"><span className="inbox-loader" /><p>Loading your inbox…</p></div> : messages.length === 0 ? <div className="empty-inbox"><Inbox size={40} /><strong>No messages yet</strong><p>Your incoming verification messages will appear here.</p></div> : <AnimatePresence initial={false}>{messages.map((message) => <motion.button layout={!reducedMotion} initial={reducedMotion ? {} : { opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} key={message.id} className={`message-card ${selected?.id === message.id ? "selected" : ""}`} onClick={() => openMessage(message)}><span className="message-icon"><MessageSquareText size={18} /></span><span className="message-summary"><strong>{message.sender}</strong><small>{message.messageContent}</small></span><span className="message-meta"><time>{formatDate(message.createdAt)}</time>{message.unread && <i aria-label="Unread" />}</span></motion.button>)}</AnimatePresence>}</section><AnimatePresence mode="wait">{selected ? <motion.section key="detail" className="message-detail" initial={reducedMotion ? {} : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><button className="close-detail" aria-label="Close message" onClick={() => setSelected(null)}><X size={17} /></button><span className="detail-icon"><MessageSquareText size={22} /></span><span className="inbox-eyebrow">Verification message</span><h2>{selected.sender}</h2><p className="detail-recipient">To {selected.recipient} · {formatDate(selected.createdAt)}</p><div className="message-body">{selected.messageContent}</div>{selected.otp && <div className="otp-reveal"><small>Your one-time password</small><strong aria-label={`One-time password ${selected.otp}`}>{selected.otp}</strong><button onClick={copyOtp}>{copied ? <><Check size={15} /> Copied</> : <><Clipboard size={15} /> Copy OTP</>}</button></div>}<div className="expiry-note"><Wifi size={14} /> Available until {formatDate(selected.expiresAt)}</div></motion.section> : <motion.section key="empty-detail" className="message-detail detail-placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><MessageSquareText size={30} /><strong>Select a message</strong><p>Open a message to view its verification code.</p></motion.section>}</AnimatePresence></div></section><div className="inbox-toast-area" aria-live="polite">{notice && <motion.div className="inbox-toast" role="status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><Bell size={15} /> {notice}</motion.div>}</div><footer className="inbox-footer"><span><LockKeyhole size={12} /> Private to your paired device</span><span>{connected ? <><Wifi size={12} /> Live updates enabled</> : <><WifiOff size={12} /> Offline mode · messages are saved</>}</span></footer></main>;
}

export default InboxPage;
