import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Clipboard, Globe2, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Smartphone, Sparkles, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";
import InboxPage from "./pages/InboxPage";
import { requestOtp, resendOtp, verifyOtp } from "./services/api";

type PortalState = "phone" | "otp" | "success";
type Notice = { tone: "error" | "info"; text: string } | null;

const ease = [0.22, 1, 0.36, 1] as const;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function App() {
  return window.location.pathname === "/inbox" ? <InboxPage /> : <VerificationPortal />;
}

function VerificationPortal() {
  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState<PortalState>("phone");
  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [inboxUrl, setInboxUrl] = useState("/inbox");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [copied, setCopied] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (secondsLeft <= 0 && resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
      setResendSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft, resendSeconds]);

  const animate = prefersReducedMotion ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.45, ease } };

  async function handleRequestOtp(event: FormEvent) {
    event.preventDefault();
    if (phone.replace(/\D/g, "").length < 8) {
      setNotice({ tone: "error", text: "Enter a valid phone number to continue." });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const result = await requestOtp(phone);
      if (!result.success || !result.data) throw new Error(result.message);
      setSessionId(result.data.sessionId);
      setPairingCode(result.data.pairingCode);
      setInboxUrl(result.data.inboxUrl);
      setSecondsLeft(result.data.expiresIn);
      setResendSeconds(30);
      setOtp(Array(6).fill(""));
      setState("otp");
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to generate an OTP." });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    const value = otp.join("");
    if (value.length !== 6) {
      setNotice({ tone: "error", text: "Enter all six digits from your virtual inbox." });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const result = await verifyOtp(sessionId, value);
      if (result.success && result.data?.verified) {
        setState("success");
      } else {
        setNotice({ tone: "error", text: result.message });
      }
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Verification failed." });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendSeconds > 0 || loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const result = await resendOtp(sessionId);
      if (!result.success || !result.data) throw new Error(result.message);
      setSecondsLeft(result.data.expiresIn);
      setResendSeconds(30);
      setOtp(Array(6).fill(""));
      setNotice({ tone: "info", text: "A fresh OTP is waiting in your virtual inbox." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to resend the OTP." });
    } finally {
      setLoading(false);
    }
  }

  function updateOtp(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    if (!digits.length) return;
    setOtp([...digits, ...Array(6 - digits.length).fill("")]);
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  async function copyPairingCode() {
    await navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function reset() {
    setState("phone");
    setOtp(Array(6).fill(""));
    setNotice(null);
  }

  return (
    <main className="app-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark"><ShieldCheck size={19} /></span>
          <span>Verify<span className="brand-accent">Flow</span></span>
        </a>
        <div className="topbar-meta"><span className="status-dot" /> Systems operational <span className="topbar-divider" /> Secure session</div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> Secure. Simple. Verified.</div>
          <h1>Identity, with a little <span>magic.</span></h1>
          <p className="hero-description">Verify your phone number with a secure OTP workflow and a virtual inbox that keeps your messages right where you need them.</p>
          <div className="trust-row">
            <div><LockKeyhole size={17} /><span>Encrypted by design</span></div>
            <div><Wifi size={17} /><span>Real-time delivery</span></div>
          </div>
        </div>

        <div className="phone-visual" aria-hidden="true">
          <div className="orbit orbit-large" /><div className="orbit orbit-small" />
          <motion.div className="phone-device" animate={prefersReducedMotion ? {} : { y: [0, -9, 0], rotate: [0, 1.2, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
            <div className="phone-speaker" />
            <div className="phone-screen"><div className="screen-top"><span>9:41</span><span>•••</span></div><div className="screen-icon"><Check size={25} /></div><strong>You're verified</strong><small>Welcome to VerifyFlow</small><div className="screen-bar"><span /></div></div>
          </motion.div>
          <div className="floating-chip chip-one"><span className="chip-icon chip-green"><Check size={14} /></span> OTP delivered</div>
          <div className="floating-chip chip-two"><span className="chip-icon chip-purple"><KeyRound size={14} /></span> 6-digit security</div>
        </div>
      </section>

      <section className="verification-card" aria-live="polite">
        <div className="card-glow" />
        <div className="stepper"><span className={state !== "phone" ? "step complete" : "step active"}>{state !== "phone" ? <Check size={14} /> : "1"}</span><span className="step-line" /><span className={state === "otp" ? "step active" : state === "success" ? "step complete" : "step"}>{state === "success" ? <Check size={14} /> : "2"}</span><span className="step-line" /><span className={state === "success" ? "step active" : "step"}>{state === "success" ? <Check size={14} /> : "3"}</span></div>
        <AnimatePresence mode="wait">
          {state === "phone" && <motion.div key="phone" {...animate}>
            <div className="card-heading"><div><span className="card-kicker">Step 01 · Your number</span><h2>Verify your phone number</h2><p>We’ll create a secure verification session for you.</p></div><span className="heading-icon"><Smartphone size={24} /></span></div>
            <form onSubmit={handleRequestOtp}>
              <label htmlFor="phone">Mobile number</label>
              <div className="phone-input"><div className="country-select"><span>🇮🇳</span><strong>+91</strong><span className="chevron">⌄</span></div><input id="phone" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
              <button className="primary-button" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : <><span>Send secure OTP</span><ArrowRight size={18} /></>}</button>
            </form>
            <p className="helper-text"><Globe2 size={14} /> Your number is used only for this demo verification session.</p>
          </motion.div>}

          {state === "otp" && <motion.div key="otp" {...animate}>
            <div className="card-heading"><div><span className="card-kicker">Step 02 · Check your inbox</span><h2>Enter your OTP</h2><p>Open the virtual inbox on another device to find your code.</p></div><span className="heading-icon heading-icon-cyan"><KeyRound size={24} /></span></div>
            <div className="pairing-panel"><div className="pairing-label"><span className="live-pulse" /> Virtual inbox pairing code</div><div className="pairing-content"><strong>{pairingCode.slice(0, 3)} {pairingCode.slice(3)}</strong><button type="button" onClick={copyPairingCode} aria-label="Copy pairing code">{copied ? <Check size={17} /> : <Clipboard size={17} />}</button></div><p>Open <a className="inbox-link" href={inboxUrl} target="_blank" rel="noreferrer">{inboxUrl}</a> on your phone and enter this code.</p></div>
            <form onSubmit={handleVerify}>
              <div className="otp-label-row"><label htmlFor="otp-0">Six-digit verification code</label><span className={secondsLeft < 60 ? "timer urgent" : "timer"}>{formatTime(secondsLeft)}</span></div>
              <div className="otp-row" onPaste={handleOtpPaste}>{otp.map((digit, index) => <input key={index} id={`otp-${index}`} ref={(element) => { otpRefs.current[index] = element; }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} value={digit} onChange={(event) => updateOtp(index, event.target.value)} onKeyDown={(event) => handleOtpKeyDown(index, event)} aria-label={`OTP digit ${index + 1}`} />)}</div>
              <button className="primary-button" type="submit" disabled={loading || secondsLeft === 0}>{loading ? <span className="spinner" /> : <><span>Verify phone number</span><ArrowRight size={18} /></>}</button>
            </form>
            <div className="resend-row"><span>Didn't receive it?</span><button type="button" onClick={handleResend} disabled={resendSeconds > 0 || loading}>{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : <><RefreshCw size={14} /> Resend OTP</>}</button></div>
          </motion.div>}

          {state === "success" && <motion.div key="success" {...animate} className="success-state"><motion.div className="success-mark" initial={prefersReducedMotion ? {} : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 250, damping: 16 }}><Check size={36} /></motion.div><span className="card-kicker">Verification complete</span><h2>Phone number verified!</h2><p>Your number has been securely verified. You’re all set to continue.</p><div className="success-badge"><ShieldCheck size={17} /> Verification status: success</div><button className="secondary-button" type="button" onClick={reset}>Verify another number</button></motion.div>}
        </AnimatePresence>
        {notice && <motion.div className={`notice ${notice.tone}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}><span>{notice.tone === "error" ? "!" : "i"}</span>{notice.text}</motion.div>}
      </section>

      <footer className="footer"><span>© 2026 VerifyFlow</span><span>Simulated SMS gateway · Built for secure learning</span></footer>
    </main>
  );
}

export default App;
