// React + hooks come from the global <script> tags loaded in index.html
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ── Helpers ──────────────────────────────────────────────────────────────────
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const shuffle = a => [...a].sort(() => Math.random() - 0.5);

// ── Text / cipher helpers (power the terminals' crypto commands) ─────────────
// Caesar cipher: shift every letter n places along the alphabet. Negative n
// decodes. A–Z and a–z wrap separately; spaces/punctuation are left alone.
const caesarShift = (str, n) =>
  str.replace(/[a-zA-Z]/g, c => {
    const base = c <= "Z" ? 65 : 97;                       // ASCII of 'A' or 'a'
    // ((code - base + n) wrapped into 0..25) + base  → the shifted letter
    return String.fromCharCode(((c.charCodeAt(0) - base + (n % 26) + 26) % 26) + base);
  });
// Atbash: mirror the alphabet (A<->Z, B<->Y ...). It is its own decoder.
const atbash = str =>
  str.replace(/[a-zA-Z]/g, c => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
// Text -> space-separated hex bytes  ("Hi" -> "48 69")
const toHexStr = str => str.split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
// Text -> space-separated 8-bit binary ("Hi" -> "01001000 01101001")
const toBinStr = str => str.split("").map(c => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
// Base64 encode/decode, guarded because btoa/atob throw on bad input.
const b64enc = str => { try { return btoa(str); } catch (e) { return "[error: cannot encode]"; } };
const b64dec = str => { try { return atob(str); } catch (e) { return "[error: not valid Base64]"; } };

const btn = (bg = "#6366f1", fg = "white") => ({
  background: bg, color: fg, border: "none", borderRadius: 12,
  padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 15,
});
const inputStyle = {
  background: "white", border: "2px solid #e5e7eb", borderRadius: 10,
  padding: "10px 14px", fontSize: 15, outline: "none",
  width: "100%", boxSizing: "border-box",
};
const card = {
  background: "white", borderRadius: 20, padding: 16,
  boxShadow: "0 4px 20px rgba(0,0,0,0.12)", border: "none",
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const BackBtn = ({ fn, dark }) => (
  <button onClick={fn} style={{
    ...btn(dark ? "#1a3a2a" : "rgba(255,255,255,0.5)", dark ? "#4ade80" : "#333"),
    marginBottom: 16, fontSize: 13,
  }}>← Back to Games</button>
);

// ── Terminal ──────────────────────────────────────────────────────────────────
function Terminal({ cmds, prompt = "$ ", welcome = [], onBack, title }) {
  const [hist, setHist] = useState(welcome.map(v => ({ t: "o", v })));
  const [inp, setInp] = useState("");
  const [cH, setCH] = useState([]);
  const [cI, setCI] = useState(-1);
  const endRef = useRef();
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [hist]);

  const run = cmd => {
    const c = cmd.trim();
    if (!c) return;
    setCH(h => [c, ...h]);
    setCI(-1);
    const lines = [{ t: "i", v: prompt + c }];
    let found = false;
    for (const [pat, fn] of Object.entries(cmds)) {
      const m = c.match(new RegExp("^" + pat + "$", "i"));
      if (m) {
        const out = fn(m, c);
        if (out) out.split("\n").forEach(v => lines.push({ t: "o", v }));
        found = true;
        break;
      }
    }
    if (!found) lines.push({ t: "e", v: "bash: " + c.split(" ")[0] + ": command not found. Type 'help'" });
    setHist(h => [...h, ...lines]);
    setInp("");
  };

  const kd = e => {
    if (e.key === "Enter") run(inp);
    if (e.key === "ArrowUp") { const ni = Math.min(cI + 1, cH.length - 1); setCI(ni); setInp(cH[ni] || ""); }
    if (e.key === "ArrowDown") { const ni = Math.max(cI - 1, -1); setCI(ni); setInp(ni === -1 ? "" : cH[ni]); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "#4ade80", padding: 16, fontFamily: "monospace", fontSize: 14 }}>
      <button onClick={onBack} style={{ color: "#4ade80", background: "none", border: "none", cursor: "pointer", marginBottom: 8, alignSelf: "flex-start", fontSize: 13 }}>← Back</button>
      {title && <div style={{ color: "#86efac", fontWeight: "bold", marginBottom: 12, fontSize: 18 }}>{title}</div>}
      <div style={{ flex: 1, overflowY: "auto", maxHeight: "65vh", marginBottom: 8 }}>
        {hist.map((h, i) => (
          <div key={i} style={{ color: h.t === "i" ? "#fbbf24" : h.t === "e" ? "#f87171" : "#4ade80", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{h.v}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #1a3a2a", paddingTop: 8 }}>
        <span style={{ color: "#fbbf24", whiteSpace: "nowrap" }}>{prompt}</span>
        <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={kd} autoFocus
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: 14, fontFamily: "monospace" }} />
      </div>
    </div>
  );
}

// ── Generic Math Game ─────────────────────────────────────────────────────────
function MathGame({ title, emoji, genQ, onBack, bg = "#e0f2fe" }) {
  const [q, setQ] = useState(null);
  const [choices, setChoices] = useState([]);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);

  const nxt = useCallback(() => {
    const { question, answer } = genQ();
    const s = new Set([answer]);
    while (s.size < 4) { const x = answer + rnd(-8, 8); if (x >= 0) s.add(x); }
    setChoices(shuffle([...s]));
    setQ({ question, answer });
    setFb(null);
  }, [genQ]);

  useEffect(() => { nxt(); }, []);

  const guess = c => {
    if (fb) return;
    setFb(c === q.answer ? "correct" : "wrong");
    if (c === q.answer) setScore(s => s + 1);
    setTimeout(nxt, 1100);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: bg, padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, marginBottom: 8 }}>{emoji} {title}</h1>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>⭐ Score: {score}</div>
      {q && <>
        <div style={{ ...card, fontSize: 48, fontWeight: 900, padding: "28px 44px", marginBottom: 20, color: "#1e1b4b", cursor: "default" }}>{q.question}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {choices.map((c, i) => (
            <button key={i} onClick={() => guess(c)} disabled={!!fb}
              style={{ ...card, fontSize: 36, fontWeight: 900, width: 100, height: 84, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {c}
            </button>
          ))}
        </div>
        {fb === "correct" && <div style={{ fontSize: 22, marginTop: 14, color: "#15803d" }}>✅ Correct! 🎉</div>}
        {fb === "wrong" && <div style={{ fontSize: 22, marginTop: 14, color: "#b91c1c" }}>❌ The answer was {q.answer}</div>}
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGE 3 GAMES
// ═══════════════════════════════════════════════════════════════
const ANIMALS = { A:"🦊",B:"🐻",C:"🐱",D:"🐶",E:"🐘",F:"🐸",G:"🦒",H:"🦛",I:"🦎",J:"🪼",K:"🦘",L:"🦁",M:"🐒",N:"🐬",O:"🦦",P:"🐼",Q:"🦆",R:"🐰",S:"🐍",T:"🐯",U:"🦄",V:"🦅",W:"🐺",X:"🐠",Y:"🦋",Z:"🦓" };
const ANAMES = { A:"Ape",B:"Bear",C:"Cat",D:"Dog",E:"Elephant",F:"Frog",G:"Giraffe",H:"Hippo",I:"Iguana",J:"Jellyfish",K:"Kangaroo",L:"Lion",M:"Monkey",N:"Narwhal",O:"Otter",P:"Panda",Q:"Quail",R:"Rabbit",S:"Snake",T:"Tiger",U:"Unicorn",V:"Vulture",W:"Wolf",X:"X-Ray Fish",Y:"Yak",Z:"Zebra" };

function ABCExplorer({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [pop, setPop] = useState(false);
  const tap = () => { setPop(true); setTimeout(() => { setPop(false); setIdx(i => (i + 1) % 26); }, 300); };
  const l = LETTERS[idx];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#fef3c7,#fce7f3)", padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#db2777", marginBottom: 8 }}>🔤 ABC Explorer</h1>
      <p style={{ color: "#6b7280", marginBottom: 16, fontSize: 17 }}>Tap the letter to continue!</p>
      <div onClick={tap} style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 52px", cursor: "pointer", transform: pop ? "scale(1.12)" : "scale(1)", transition: "transform 0.2s", gap: 4 }}>
        <div style={{ fontSize: 120, fontWeight: 900, color: "#6366f1", lineHeight: 1 }}>{l}</div>
        <div style={{ fontSize: 80, lineHeight: 1 }}>{ANIMALS[l]}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#374151" }}>{ANAMES[l]}</div>
        <div style={{ fontSize: 14, color: "#9ca3af" }}>"{l}" is for {ANAMES[l]}!</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", maxWidth: 500, marginTop: 16 }}>
        {LETTERS.map((ltr, i) => (
          <button key={ltr} onClick={() => setIdx(i)}
            style={{ width: 34, height: 34, borderRadius: 8, fontWeight: 700, fontSize: 12, background: i === idx ? "#6366f1" : "white", color: i === idx ? "white" : "#374151", border: "1px solid #e5e7eb", cursor: "pointer" }}>
            {ltr}
          </button>
        ))}
      </div>
      <p style={{ marginTop: 10, color: "#9ca3af", fontSize: 16, fontWeight: 700 }}>{idx + 1}/26</p>
    </div>
  );
}

function NumberTap({ onBack }) {
  const EMOJ = ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯"];
  const [target, setTarget] = useState(rnd(1, 6));
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const newR = useCallback(() => { setTarget(rnd(1, 8)); setFb(null); }, []);
  const guess = n => {
    if (fb) return;
    setFb(n === target ? "correct" : "wrong");
    if (n === target) setScore(s => s + 1);
    setTimeout(newR, 900);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#bfdbfe,#a7f3d0)", padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#1d4ed8", marginBottom: 4 }}>🔢 Number Tap</h1>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>⭐ Score: {score}</div>
      <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, color: "#374151" }}>How many animals?</p>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, maxWidth: 300, padding: 20, marginBottom: 16, minHeight: 90 }}>
        {Array(target).fill(0).map((_, i) => <span key={i} style={{ fontSize: 42 }}>{EMOJ[i % EMOJ.length]}</span>)}
      </div>
      {fb === "correct" && <div style={{ fontSize: 26, marginBottom: 10 }}>🎉 Correct!</div>}
      {fb === "wrong" && <div style={{ fontSize: 22, marginBottom: 10, color: "#dc2626" }}>Try again! 🤔</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {[1,2,3,4,5,6,7,8].map(n => (
          <button key={n} onClick={() => guess(n)} style={{ ...btn("white", "#1d4ed8"), fontSize: 28, fontWeight: 900, width: 64, height: 64, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>{n}</button>
        ))}
      </div>
    </div>
  );
}

const SHAPES = [
  { n: "Circle", e: "⭕" }, { n: "Square", e: "🟦" }, { n: "Triangle", e: "🔺" },
  { n: "Star", e: "⭐" }, { n: "Heart", e: "❤️" }, { n: "Diamond", e: "💎" },
  { n: "Moon", e: "🌙" }, { n: "Pentagon", e: "⬠" },
];
function ShapeWorld({ onBack }) {
  const [target, setTarget] = useState(0);
  const [opts, setOpts] = useState([0, 2, 4]);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const newR = useCallback(() => {
    const t = rnd(0, SHAPES.length - 1);
    const o = new Set([t]);
    while (o.size < 3) o.add(rnd(0, SHAPES.length - 1));
    setTarget(t); setOpts(shuffle([...o])); setFb(null);
  }, []);
  useEffect(() => { newR(); }, []);
  const guess = i => {
    if (fb) return;
    setFb(i === target ? "correct" : "wrong");
    if (i === target) setScore(s => s + 1);
    setTimeout(newR, 900);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#e9d5ff,#fbcfe8)", padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#7c3aed", marginBottom: 4 }}>🔷 Shape World</h1>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>⭐ Score: {score}</div>
      <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#374151" }}>Tap the <span style={{ color: "#7c3aed" }}>{SHAPES[target].n}</span>!</p>
      <div style={{ display: "flex", gap: 16 }}>
        {opts.map(i => (
          <button key={i} onClick={() => guess(i)} style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", padding: 20, cursor: "pointer" }}>
            <span style={{ fontSize: 64 }}>{SHAPES[i].e}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginTop: 6 }}>{SHAPES[i].n}</span>
          </button>
        ))}
      </div>
      {fb === "correct" && <div style={{ fontSize: 26, marginTop: 16 }}>🎉 You found it!</div>}
      {fb === "wrong" && <div style={{ fontSize: 22, marginTop: 16, color: "#dc2626" }}>Try again! 🤔</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGE 4 GAMES
// ═══════════════════════════════════════════════════════════════
function KeyboardAdv({ onBack }) {
  const [lastKey, setLastKey] = useState(null);
  const [sparks, setSparks] = useState([]);
  const FUN = "🎉🌟💥🎊🔥✨🎈🦄🐉🌈🍕🎮🚀🎸🏆💎🎯🦋🌊🎭";
  useEffect(() => {
    const h = e => {
      setLastKey(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      setSparks(s => [...s.slice(-12), { id: Date.now(), e: FUN[rnd(0, FUN.length - 1)], x: rnd(5, 90), y: rnd(5, 85) }]);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#67e8f9,#6366f1)", padding: 24, overflow: "hidden" }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "white", marginBottom: 4 }}>⌨️ Keyboard Adventure</h1>
      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 17, marginBottom: 24 }}>Press any key!</p>
      {sparks.map(s => <div key={s.id} style={{ position: "absolute", left: s.x + "%", top: s.y + "%", fontSize: 44, pointerEvents: "none" }}>{s.e}</div>)}
      {lastKey
        ? <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 52px", zIndex: 10 }}>
            <div style={{ fontSize: 100, fontWeight: 900, color: "#6366f1", lineHeight: 1 }}>{lastKey}</div>
            <div style={{ fontSize: 17, color: "#6b7280", marginTop: 6 }}>You pressed: {lastKey}</div>
          </div>
        : <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 24, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 60 }}>⌨️</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "white", marginTop: 6 }}>Press any key!</div>
          </div>
      }
    </div>
  );
}

const CVC = [
  { w: "CAT", e: "🐱" }, { w: "DOG", e: "🐶" }, { w: "HAT", e: "🎩" }, { w: "SUN", e: "☀️" },
  { w: "BUS", e: "🚌" }, { w: "CUP", e: "☕" }, { w: "BED", e: "🛏️" }, { w: "PIG", e: "🐷" },
  { w: "HEN", e: "🐔" }, { w: "NET", e: "🥅" }, { w: "JAM", e: "🫙" }, { w: "FAN", e: "🌀" },
];
function WordBuilder({ onBack }) {
  const [wIdx, setWIdx] = useState(0);
  const [typed, setTyped] = useState([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const w = CVC[wIdx];
  const tap = l => {
    if (typed.length >= w.w.length || done) return;
    const next = [...typed, l];
    setTyped(next);
    if (next.length === w.w.length) {
      if (next.join("") === w.w) {
        setScore(s => s + 1); setDone(true);
        setTimeout(() => { setWIdx(i => (i + 1) % CVC.length); setTyped([]); setDone(false); }, 1300);
      } else {
        setTimeout(() => setTyped([]), 600);
      }
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#fef9c3,#fed7aa)", padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#c2410c", marginBottom: 4 }}>📝 Word Builder</h1>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>⭐ Score: {score}</div>
      <div style={{ ...card, padding: 20, marginBottom: 12, textAlign: "center" }}>
        <div style={{ fontSize: 76 }}>{w.e}</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {w.w.split("").map((c, i) => (
          <div key={i} style={{ width: 54, height: 54, borderRadius: 12, border: "3px solid " + (typed[i] ? "#6366f1" : "#d1d5db"), background: typed[i] ? (done ? "#86efac" : "#e0e7ff") : "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: typed[i] ? (done ? "#15803d" : "#4338ca") : "#9ca3af" }}>
            {typed[i] || "_"}
          </div>
        ))}
      </div>
      {done && <div style={{ fontSize: 24, marginBottom: 8 }}>🎉 {w.w}! Awesome!</div>}
      <button onClick={() => setTyped([])} style={{ ...btn("#e5e7eb", "#374151"), marginBottom: 10, fontSize: 13 }}>Clear ✕</button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", maxWidth: 400 }}>
        {LETTERS.map(l => (
          <button key={l} onClick={() => tap(l)} style={{ width: 36, height: 36, borderRadius: 8, fontWeight: 700, fontSize: 12, background: "white", color: "#374151", border: "1px solid #e5e7eb", cursor: "pointer" }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

const PHONEMES = [
  { s: "/æ/", w: "cat", e: "🐱", t: "Short Vowel" }, { s: "/eɪ/", w: "cake", e: "🎂", t: "Long Vowel" },
  { s: "/ɛ/", w: "bed", e: "🛏️", t: "Short Vowel" }, { s: "/iː/", w: "tree", e: "🌳", t: "Long Vowel" },
  { s: "/ɪ/", w: "sit", e: "💺", t: "Short Vowel" }, { s: "/aɪ/", w: "kite", e: "🪁", t: "Long Vowel" },
  { s: "/ɒ/", w: "hot", e: "🌶️", t: "Short Vowel" }, { s: "/oʊ/", w: "boat", e: "⛵", t: "Long Vowel" },
  { s: "/ʌ/", w: "cup", e: "☕", t: "Short Vowel" }, { s: "/uː/", w: "moon", e: "🌙", t: "Long Vowel" },
  { s: "/b/", w: "ball", e: "⚽", t: "Consonant" }, { s: "/d/", w: "dog", e: "🐶", t: "Consonant" },
  { s: "/f/", w: "fish", e: "🐟", t: "Consonant" }, { s: "/g/", w: "goat", e: "🐐", t: "Consonant" },
  { s: "/h/", w: "hat", e: "🎩", t: "Consonant" }, { s: "/k/", w: "kite", e: "🪁", t: "Consonant" },
  { s: "/l/", w: "lion", e: "🦁", t: "Consonant" }, { s: "/m/", w: "moon", e: "🌙", t: "Consonant" },
  { s: "/n/", w: "nut", e: "🥜", t: "Consonant" }, { s: "/p/", w: "pig", e: "🐷", t: "Consonant" },
  { s: "/r/", w: "rabbit", e: "🐰", t: "Consonant" }, { s: "/s/", w: "snake", e: "🐍", t: "Consonant" },
  { s: "/t/", w: "tiger", e: "🐯", t: "Consonant" }, { s: "/v/", w: "van", e: "🚐", t: "Consonant" },
  { s: "/w/", w: "wolf", e: "🐺", t: "Consonant" }, { s: "/z/", w: "zebra", e: "🦓", t: "Consonant" },
  { s: "/tʃ/", w: "chin", e: "😄", t: "Digraph" }, { s: "/ʃ/", w: "ship", e: "🚢", t: "Digraph" },
  { s: "/θ/", w: "think", e: "💭", t: "Digraph" }, { s: "/ð/", w: "this", e: "👆", t: "Digraph" },
  { s: "/ŋ/", w: "ring", e: "💍", t: "Nasal" }, { s: "/dʒ/", w: "jump", e: "🏃", t: "Affricate" },
  { s: "/ɔɪ/", w: "boy", e: "👦", t: "Diphthong" }, { s: "/aʊ/", w: "cow", e: "🐄", t: "Diphthong" },
  { s: "/ɑː/", w: "car", e: "🚗", t: "R-Controlled" }, { s: "/j/", w: "yellow", e: "💛", t: "Consonant" },
];
function SoundSafari({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [filter, setFilter] = useState("All");
  const types = [...new Set(PHONEMES.map(p => p.t))];
  const fil = filter === "All" ? PHONEMES : PHONEMES.filter(p => p.t === filter);
  const p = fil[idx % fil.length];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#a7f3d0,#6ee7b7)", padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#065f46", marginBottom: 8 }}>🔊 Sound Safari</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 14 }}>
        {["All", ...types].map(t => (
          <button key={t} onClick={() => { setFilter(t); setIdx(0); }} style={{ ...btn(filter === t ? "#065f46" : "white", filter === t ? "white" : "#065f46"), fontSize: 12, padding: "5px 10px" }}>{t}</button>
        ))}
      </div>
      <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 52px", width: "100%", maxWidth: 320 }}>
        <div style={{ fontSize: 86 }}>{p.e}</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: "#059669", margin: "6px 0" }}>{p.s}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#374151" }}>"{p.w}"</div>
        <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 20, padding: "3px 10px", fontSize: 12, marginTop: 6 }}>{p.t}</div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 16, alignItems: "center" }}>
        <button onClick={() => setIdx(i => (i - 1 + fil.length) % fil.length)} style={btn()}>← Prev</button>
        <span style={{ fontWeight: 600, color: "#065f46" }}>{(idx % fil.length) + 1}/{fil.length}</span>
        <button onClick={() => setIdx(i => (i + 1) % fil.length)} style={btn()}>Next →</button>
      </div>
    </div>
  );
}

const MathSprouts = ({ onBack }) => <MathGame title="Math Sprouts" emoji="➕" onBack={onBack} bg="linear-gradient(180deg,#fef9c3,#bbf7d0)"
  genQ={() => { const a = rnd(1, 5), b = rnd(1, 5), add = Math.random() < 0.5; return add ? { question: a + " + " + b + " = ?", answer: a + b } : { question: (a + b) + " - " + b + " = ?", answer: a }; }} />;

// ═══════════════════════════════════════════════════════════════
// AGE 5 GAMES
// ═══════════════════════════════════════════════════════════════
const MathQuest = ({ onBack }) => <MathGame title="Math Quest" emoji="🧮" onBack={onBack} bg="linear-gradient(180deg,#bfdbfe,#c4b5fd)"
  genQ={() => { const a = rnd(2, 15), b = rnd(1, 12), add = Math.random() < 0.5; return add ? { question: a + " + " + b + " = ?", answer: a + b } : { question: (a + b) + " - " + b + " = ?", answer: a }; }} />;

function FirstTerminal({ onBack }) {
  const cmds = {
    "help": () => "Commands:\n  ls       - list files\n  cat <f>  - read a file\n  echo <m> - print message\n  pwd      - current folder\n  whoami   - who are you?\n  date     - today's date\n  fortune  - get a fortune",
    "ls": () => "hello.txt   readme.txt",
    "pwd": () => "/home/kid",
    "whoami": () => "junior-hacker",
    "date": () => new Date().toString(),
    "echo (.+)": m => m[1],
    "cat hello\\.txt": () => "Hello World!\nWelcome to Linux!",
    "cat readme\\.txt": () => "You are learning the terminal!\nType ls to see files.",
    "cat (.+)": m => "cat: " + m[1] + ": No such file",
    "fortune": () => ["Knowledge is power!", "Every expert was once a beginner.", "Code is poetry.", "The best debugger is good sleep."][rnd(0, 3)],
    "clear": () => "[CLEARED]",
  };
  return <Terminal cmds={cmds} title="💾 My First Terminal" prompt="kid@linux:~$ " welcome={["Welcome to your FIRST Linux terminal! 🐧", "Type 'help' to see commands!", "Tip: Try: ls  then: cat hello.txt"]} onBack={onBack} />;
}

const COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899"];
const CNAMES = ["Red","Orange","Yellow","Green","Blue","Purple","Pink"];
function PatternLab({ onBack }) {
  const [score, setScore] = useState(0);
  const [pattern, setPattern] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [choices, setChoices] = useState([]);
  const [fb, setFb] = useState(null);
  const newR = useCallback(() => {
    const pat = Array(rnd(3, 5)).fill(0).map(() => rnd(0, COLORS.length - 1));
    const ans = rnd(0, COLORS.length - 1);
    const wc = new Set([ans]);
    while (wc.size < 4) wc.add(rnd(0, COLORS.length - 1));
    setPattern(pat); setAnswer(ans); setChoices(shuffle([...wc])); setFb(null);
  }, []);
  useEffect(() => { newR(); }, []);
  const guess = c => {
    if (fb) return;
    setFb(c === answer ? "correct" : "wrong");
    if (c === answer) setScore(s => s + 1);
    setTimeout(newR, 1000);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#e0e7ff,#fce7f3)", padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#4338ca", marginBottom: 4 }}>🎨 Pattern Lab</h1>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>⭐ Score: {score}</div>
      <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>What color comes next?</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {pattern.map((c, i) => <div key={i} style={{ width: 50, height: 50, borderRadius: 12, background: COLORS[c] }} />)}
        <div style={{ width: 50, height: 50, borderRadius: 12, border: "3px dashed #9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#9ca3af" }}>?</div>
      </div>
      <div style={{ marginBottom: 16, fontSize: 13, color: "#6b7280" }}>{pattern.map(c => CNAMES[c]).join(" → ")} → ?</div>
      <div style={{ display: "flex", gap: 10 }}>
        {choices.map(c => (
          <button key={c} onClick={() => guess(c)} style={{ width: 62, height: 62, borderRadius: 14, background: COLORS[c], border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", cursor: "pointer" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{CNAMES[c]}</span>
          </button>
        ))}
      </div>
      {fb === "correct" && <div style={{ fontSize: 24, marginTop: 14 }}>🎉 Great pattern spotting!</div>}
      {fb === "wrong" && <div style={{ fontSize: 20, marginTop: 14, color: "#dc2626" }}>Not quite! Look at the pattern.</div>}
    </div>
  );
}

const SIGHT = [
  { w: "the", s: "The dog runs fast." }, { w: "and", s: "Cat and dog play." },
  { w: "is", s: "The sky is blue." }, { w: "said", s: "She said hello." },
  { w: "have", s: "I have a red ball." }, { w: "they", s: "They went to the park." },
  { w: "was", s: "It was a sunny day." }, { w: "he", s: "He runs very fast." },
  { w: "she", s: "She reads a book." }, { w: "for", s: "This gift is for you." },
];
function ReadingRockets({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const sw = SIGHT[idx];
  // useMemo: only reshuffle the choices when idx changes (fixes flicker bug)
  const opts = useMemo(
    () => shuffle([sw.w, ...SIGHT.filter((_, i) => i !== idx).map(s => s.w).slice(0, 3)]),
    [idx]
  );
  const guess = w => {
    if (fb) return;
    setFb(w === sw.w ? "correct" : "wrong");
    if (w === sw.w) setScore(s => s + 1);
    setTimeout(() => { setIdx(i => (i + 1) % SIGHT.length); setFb(null); }, 1100);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#fef3c7,#d1fae5)", padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#b45309", marginBottom: 4 }}>📖 Reading Rockets</h1>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>⭐ Score: {score}</div>
      <div style={{ ...card, padding: 24, textAlign: "center", marginBottom: 16, maxWidth: 360, width: "100%" }}>
        <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>Find the sight word:</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: "#374151", lineHeight: 1.8 }}>
          {sw.s.split(" ").map((word, i) => (
            <span key={i} style={{ marginRight: 4, color: word.toLowerCase().replace(/[^a-z]/g, "") === sw.w ? "#7c3aed" : "#374151", fontWeight: word.toLowerCase().replace(/[^a-z]/g, "") === sw.w ? 900 : 600 }}>{word}</span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {opts.map(w => <button key={w} onClick={() => guess(w)} style={{ ...btn(), fontSize: 18, padding: "10px 20px" }}>{w}</button>)}
      </div>
      {fb === "correct" && <div style={{ fontSize: 24, marginTop: 14 }}>🚀 Blast off!</div>}
      {fb === "wrong" && <div style={{ fontSize: 18, marginTop: 14, color: "#dc2626" }}>The word was: <strong>{sw.w}</strong></div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGE 6 GAMES
// ═══════════════════════════════════════════════════════════════
const MathNinja = ({ onBack }) => <MathGame title="Math Ninja" emoji="🥷" onBack={onBack} bg="linear-gradient(180deg,#ede9fe,#fce7f3)"
  genQ={() => {
    const r = Math.random();
    if (r < 0.33) { const a = rnd(5, 20), b = rnd(1, 20); return { question: a + "+" + b + "=?", answer: a + b }; }
    if (r < 0.66) { const a = rnd(5, 20), b = rnd(1, a); return { question: a + "-" + b + "=?", answer: a - b }; }
    const a = rnd(1, 10), b = rnd(1, 10); return { question: a + "×" + b + "=?", answer: a * b };
  }} />;

function TerminalPro({ onBack }) {
  const cmds = {
    "help": () => "Commands:\n  ls / ls -la  - list files\n  cat <file>   - read file\n  pwd / cd     - navigation\n  echo / grep  - text tools\n  mkdir / rm   - manage files\n  ps / uname   - system info\n  ping <host>  - network test\n  --- crypto / text ---\n  caesar <n> <text>    - shift letters by key n\n  caesar -d <n> <text> - un-shift (decode)\n  rot13 <text>         - shift by 13\n  atbash <text>        - mirror A<->Z\n  reverse <text>       - reverse the text\n  base64 <text>        - encode (base64 -d decodes)\n  hex <text> / bin <text> - to hex / binary\n  ascii <char>         - show its number\n  upper/lower <text>   - change case",
    "pwd": () => "/home/hacker/projects",
    "ls": () => "README.md   scripts/   data/   .hidden_flag",
    "ls -la": () => "-rw-r--r-- README.md\ndrwxr-xr-x scripts/\ndrwxr-xr-x data/\n-rw------- .hidden_flag",
    "cat README\\.md": () => "# Welcome, Hacker!\nExplore the files. Find the flag!\nHint: Some files are hidden...",
    "cat \\.hidden_flag": () => "🚩 FLAG{y0u_f0und_1t_n1c3_w0rk}",
    "cat (.+)": m => "cat: " + m[1] + ": No such file",
    "grep (.+) (.+)": m => "[Line 3] Found match for '" + m[1] + "' in " + m[2],
    "ps": () => "PID CMD\n1   init\n42  bash\n99  python3",
    "uname -a": () => "Linux kidbox 5.15.0 x86_64 GNU/Linux",
    "ping (.+)": m => "PING " + m[1] + ": 64 bytes ttl=64 time=12ms",
    "echo (.*)": m => m[1] || "",
    "mkdir (.+)": m => "created directory '" + m[1] + "'",
    "rm (.+)": m => "removed '" + m[1] + "'",
    "cd (.+)": m => "[changed to " + m[1] + "]",
    "sudo (.+)": () => "Permission denied.",
    "ls (.+)": m => m[1] + ": file1.txt  file2.py  notes.md",
    // ── Crypto & text tools — try these to solve the CTF Arena puzzles! ──
    "caesar -d ([0-9]+) (.+)": m => caesarShift(m[2], -parseInt(m[1])),
    "caesar ([0-9]+) (.+)": m => caesarShift(m[2], parseInt(m[1])),
    "rot13 (.+)": m => caesarShift(m[1], 13),
    "atbash (.+)": m => atbash(m[1]),
    "reverse (.+)": m => m[1].split("").reverse().join(""),
    "base64 -d (.+)": m => b64dec(m[1]),
    "base64 (.+)": m => b64enc(m[1]),
    "hex (.+)": m => toHexStr(m[1]),
    "bin (.+)": m => toBinStr(m[1]),
    "ascii (.)": m => "'" + m[1] + "' = " + m[1].charCodeAt(0) + " (0x" + m[1].charCodeAt(0).toString(16) + ")",
    "upper (.+)": m => m[1].toUpperCase(),
    "lower (.+)": m => m[1].toLowerCase(),
    "clear": () => "[CLEARED]",
  };
  return <Terminal cmds={cmds} title="🖥️ Terminal Pro" prompt="hacker@box:~/projects$ " welcome={["Terminal Pro! 🖥️", "Explore the filesystem. Find the hidden flag!", "Type 'help' for commands."]} onBack={onBack} />;
}

const BLOCK_CMDS = [
  { id: "print", label: "📢 PRINT 'Hello'", color: "#6366f1" },
  { id: "loop3", label: "🔄 REPEAT 3 TIMES", color: "#f97316" },
  { id: "if",    label: "❓ IF score > 5",  color: "#22c55e" },
  { id: "var",   label: "📦 SET x = 10",    color: "#8b5cf6" },
  { id: "add",   label: "➕ ADD x + 5",     color: "#3b82f6" },
  { id: "say",   label: "💬 SAY 'Great!'",  color: "#ec4899" },
  { id: "move",  label: "🚶 MOVE forward",  color: "#eab308" },
  { id: "wait",  label: "⏳ WAIT 1 second", color: "#14b8a6" },
];
const BLOCK_RESULTS = {
  print: "> Hello", loop3: "> Step 1\n> Step 2\n> Step 3", if: "> score > 5 is TRUE!",
  var: "> x is now 10", add: "> x + 5 = 15", say: "> Great!", move: "> Moved forward!", wait: "> Done waiting!",
};
function CodeBlocks({ onBack }) {
  const [prog, setProg] = useState([]);
  const [output, setOutput] = useState("Click blocks then Run!");
  const run = () => {
    if (!prog.length) { setOutput("Add some blocks first!"); return; }
    let out = "🚀 Running...\n\n";
    prog.forEach(b => { out += (BLOCK_RESULTS[b] || "") + "\n"; });
    out += "\n✅ Done!";
    setOutput(out);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#f0fdf4,#eff6ff)", padding: 20 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 14 }}>🧩 Code Blocks</h1>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 auto", maxWidth: 230 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#374151" }}>📦 Block Library:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {BLOCK_CMDS.map(b => (
              <button key={b.id} onClick={() => setProg(p => [...p, b.id])} style={{ ...btn(b.color), textAlign: "left", fontSize: 13, padding: "9px 12px" }}>{b.label}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#374151" }}>⚡ Your Program:</div>
          <div style={{ background: "white", borderRadius: 12, padding: 10, minHeight: 130, marginBottom: 6, border: "2px dashed #d1d5db" }}>
            {prog.length === 0 && <div style={{ color: "#9ca3af", textAlign: "center", padding: 20, fontSize: 14 }}>Click blocks to add them →</div>}
            {prog.map((id, i) => {
              const b = BLOCK_CMDS.find(x => x.id === id);
              return b ? (
                <div key={i} style={{ background: b.color, color: "white", borderRadius: 8, padding: "5px 8px", marginBottom: 3, fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                  <span>{b.label}</span>
                  <button onClick={() => setProg(p => p.filter((_, j) => j !== i))} style={{ background: "rgba(255,255,255,0.3)", border: "none", color: "white", borderRadius: 3, cursor: "pointer", padding: "0 5px", fontSize: 11 }}>✕</button>
                </div>
              ) : null;
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <button onClick={run} style={btn("#15803d")}>▶ Run</button>
            <button onClick={() => { setProg([]); setOutput("Cleared!"); }} style={btn("#dc2626")}>🗑 Clear</button>
          </div>
          <div style={{ background: "#0a0a0a", color: "#4ade80", borderRadius: 12, padding: 10, fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap", minHeight: 80 }}>{output}</div>
        </div>
      </div>
    </div>
  );
}

function CipherLab({ onBack }) {
  const [text, setText] = useState("");
  const [shift, setShift] = useState(3);
  const [mode, setMode] = useState("encode");
  const caesar = (str, sh, enc) => str.toUpperCase().split("").map(c => {
    if (c < "A" || c > "Z") return c;
    const code = c.charCodeAt(0) - 65;
    return String.fromCharCode(((enc ? code + sh : code - sh + 26) % 26) + 65);
  }).join("");
  const result = text ? caesar(text, shift, mode === "encode") : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#1e1b4b,#312e81)", padding: 24 }}>
      <BackBtn fn={onBack} dark />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#a5b4fc", marginBottom: 14 }}>🔐 Cipher Lab</h1>
      <div style={{ ...card, width: "100%", maxWidth: 440, padding: 22 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMode("encode")} style={btn(mode === "encode" ? "#6366f1" : "#e5e7eb", mode === "encode" ? "white" : "#374151")}>🔐 Encode</button>
          <button onClick={() => setMode("decode")} style={btn(mode === "decode" ? "#6366f1" : "#e5e7eb", mode === "decode" ? "white" : "#374151")}>🔓 Decode</button>
        </div>
        <label style={{ fontWeight: 600, color: "#374151", fontSize: 13 }}>Shift: {shift}</label>
        <input type="range" min={1} max={25} value={shift} onChange={e => setShift(+e.target.value)} style={{ width: "100%", margin: "6px 0 14px" }} />
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Type your message..." style={{ ...inputStyle, height: 70, resize: "vertical", fontFamily: "monospace" }} />
        {result && <>
          <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 3, color: "#374151" }}>{mode === "encode" ? "Encoded" : "Decoded"}:</div>
          <div style={{ background: "#1e1b4b", color: "#a5b4fc", borderRadius: 10, padding: 10, fontFamily: "monospace", fontWeight: 700, letterSpacing: 3, fontSize: 16, wordBreak: "break-all" }}>{result}</div>
          <div style={{ marginTop: 10, background: "#f0f9ff", borderRadius: 8, padding: 10, fontSize: 12, color: "#0369a1" }}>
            💡 Each letter shifts {shift} positions. A→{String.fromCharCode(65 + shift % 26)}
          </div>
        </>}
      </div>
    </div>
  );
}

const WORDS_POOL = ["apple","brave","cloud","dance","eagle","flame","grass","happy","igloo","jumpy","knife","lemon","magic","night","ocean","piano","queen","radio","stone","tiger","under","vivid","water","xenon","yacht","zebra"];
function TypingRacer({ onBack }) {
  const [words] = useState(() => shuffle(WORDS_POOL));
  const [inp, setInp] = useState("");
  const [wIdx, setWIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const inpRef = useRef();
  useEffect(() => {
    if (!started || done) return;
    if (time <= 0) { setDone(true); return; }
    const t = setTimeout(() => setTime(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [started, time, done]);
  const handleKey = e => {
    if (!started) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (inp.trim() === words[wIdx % words.length]) setScore(s => s + 1);
      setWIdx(i => i + 1); setInp("");
    }
  };
  const start = () => { setStarted(true); setTime(30); setScore(0); setWIdx(0); setInp(""); setDone(false); setTimeout(() => inpRef.current?.focus(), 100); };
  const cw = words[wIdx % words.length] || "";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#fef3c7,#fde68a)", padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#92400e", marginBottom: 8 }}>🏎️ Typing Racer</h1>
      {!started && !done && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>🏁</div>
          <p style={{ fontSize: 16, marginBottom: 14, color: "#374151" }}>Type words as fast as you can!<br />Press <strong>Space</strong> or <strong>Enter</strong> after each word.</p>
          <button onClick={start} style={btn("#f59e0b", "#1c1917")}>🏎️ Start!</button>
        </div>
      )}
      {done && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 60 }}>🏆</div>
          <div style={{ fontSize: 32, fontWeight: 900, margin: "6px 0" }}>{score} words!</div>
          <div style={{ fontSize: 15, color: "#374151", marginBottom: 14 }}>{score >= 15 ? "Amazing! 🔥" : score >= 8 ? "Good job! 👍" : "Keep practicing! 💪"}</div>
          <button onClick={start} style={btn("#f59e0b", "#1c1917")}>Play Again 🔄</button>
        </div>
      )}
      {started && !done && (<>
        <div style={{ display: "flex", gap: 20, marginBottom: 18, fontSize: 22, fontWeight: 700 }}>
          <span>⏱️ {time}s</span><span>✅ {score}</span>
        </div>
        <div style={{ ...card, padding: "24px 40px", marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 2 }}>Type this word:</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: "#1e1b4b", letterSpacing: 4 }}>{cw}</div>
        </div>
        <input ref={inpRef} value={inp} onChange={e => setInp(e.target.value)} onKeyDown={handleKey} autoFocus
          style={{ ...inputStyle, maxWidth: 260, textAlign: "center", fontSize: 22, fontWeight: 700, border: "3px solid " + (inp === cw.slice(0, inp.length) ? "#22c55e" : "#6366f1") }} />
      </>)}
    </div>
  );
}

const SENTENCES = [
  { words: ["The","cat","sat","on","the","mat"], hint: "Where did the cat sit?" },
  { words: ["Dogs","can","run","very","fast"], hint: "What can dogs do?" },
  { words: ["The","sun","is","bright","today"], hint: "How is the sun?" },
  { words: ["She","eats","a","big","red","apple"], hint: "What does she eat?" },
  { words: ["I","love","to","read","books"], hint: "Favorite activity?" },
];
function StoryScramble({ onBack }) {
  const [sIdx, setSIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [order, setOrder] = useState([]);
  const [available, setAvailable] = useState([]);
  const [done, setDone] = useState(false);
  const s = SENTENCES[sIdx];
  useEffect(() => { setAvailable(shuffle(s.words.map((w, i) => ({ w, uid: i })))); setOrder([]); setDone(false); }, [sIdx]);
  const addWord = item => { setAvailable(a => a.filter(x => x.uid !== item.uid)); setOrder(o => [...o, item]); };
  const removeWord = item => { setOrder(o => o.filter(x => x.uid !== item.uid)); setAvailable(a => [...a, item]); };
  const check = () => {
    if (order.map(x => x.w).join(" ") === s.words.join(" ")) {
      setScore(sc => sc + 1); setDone(true);
      setTimeout(() => setSIdx(i => (i + 1) % SENTENCES.length), 1300);
    } else {
      setOrder([]); setAvailable(shuffle(s.words.map((w, i) => ({ w, uid: i }))));
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#ecfdf5,#f0fdf4)", padding: 24 }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#065f46", marginBottom: 4 }}>📚 Story Scramble</h1>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>⭐ Score: {score}</div>
      <p style={{ color: "#374151", fontSize: 14, marginBottom: 12 }}>Hint: {s.hint}</p>
      <div style={{ background: "white", borderRadius: 14, border: "2px dashed #6ee7b7", padding: 12, minHeight: 50, width: "100%", maxWidth: 440, marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {order.length === 0 && <span style={{ color: "#9ca3af", fontSize: 13 }}>Your sentence goes here...</span>}
        {order.map(item => <button key={item.uid} onClick={() => removeWord(item)} style={{ ...btn("#059669"), padding: "6px 14px" }}>{item.w}</button>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 12, maxWidth: 440 }}>
        {available.map(item => <button key={item.uid} onClick={() => addWord(item)} style={{ ...btn("#e5e7eb", "#374151"), padding: "6px 14px" }}>{item.w}</button>)}
      </div>
      {done && <div style={{ fontSize: 24, marginBottom: 6 }}>🎉 Perfect sentence!</div>}
      {!done && order.length > 0 && <button onClick={check} style={btn("#059669")}>✅ Check!</button>}
    </div>
  );
}

function LogicGates({ onBack }) {
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const gates = [
    { name: "AND",  sym: "⊓", desc: "Both inputs ON",       fn: (a, b) => a && b },
    { name: "OR",   sym: "⊔", desc: "Either input ON",      fn: (a, b) => a || b },
    { name: "NOT A",sym: "¬", desc: "Opposite of A",        fn: (a) => !a },
    { name: "NAND", sym: "⊼", desc: "NOT AND",              fn: (a, b) => !(a && b) },
    { name: "NOR",  sym: "⊽", desc: "NOT OR",               fn: (a, b) => !(a || b) },
    { name: "XOR",  sym: "⊕", desc: "One but not both",     fn: (a, b) => a !== b },
  ];
  const Sw = ({ val, set }) => (
    <button onClick={() => set(x => !x)} style={{ width: 58, height: 26, borderRadius: 13, background: val ? "#22c55e" : "#e5e7eb", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
      {val ? "ON" : "OFF"}
    </button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#1e1b4b,#0f172a)", padding: 24, color: "white" }}>
      <BackBtn fn={onBack} dark />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#a5b4fc", marginBottom: 10 }}>⚙️ Logic Gates</h1>
      <div style={{ display: "flex", gap: 24, marginBottom: 20, alignItems: "center" }}>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>Input A</div><Sw val={a} set={setA} /><div style={{ fontSize: 10, marginTop: 1, color: a ? "#4ade80" : "#94a3b8" }}>{a ? 1 : 0}</div></div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>Input B</div><Sw val={b} set={setB} /><div style={{ fontSize: 10, marginTop: 1, color: b ? "#4ade80" : "#94a3b8" }}>{b ? 1 : 0}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 440 }}>
        {gates.map(g => {
          const out = g.fn(a, b);
          return (
            <div key={g.name} style={{ background: out ? "#14532d" : "#1e293b", borderRadius: 12, padding: 14, border: "2px solid " + (out ? "#22c55e" : "#334155") }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#a5b4fc" }}>{g.sym} {g.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 6px" }}>{g.desc}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: out ? "#4ade80" : "#94a3b8" }}>{out ? "✅ ON" : "⬜ OFF"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BinaryBasics({ onBack }) {
  const [decimal, setDecimal] = useState(rnd(0, 15));
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const [mode, setMode] = useState("dtob");
  const newR = () => { setDecimal(rnd(0, 31)); setInput(""); setFb(null); };
  const check = () => {
    const ans = mode === "dtob" ? decimal.toString(2) : String(decimal);
    if (input.trim() === ans) { setScore(s => s + 1); setFb("correct"); }
    else setFb("wrong:" + ans);
    setTimeout(newR, 1200);
  };
  const bits = decimal.toString(2).padStart(5, "0").split("");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#1e3a5f)", padding: 24, color: "white" }}>
      <BackBtn fn={onBack} dark />
      <h1 style={{ fontSize: 30, fontWeight: 900, color: "#38bdf8", marginBottom: 8 }}>01 Binary Basics</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => { setMode("dtob"); newR(); }} style={btn(mode === "dtob" ? "#0ea5e9" : "#1e3a5f")}>Dec→Bin</button>
        <button onClick={() => { setMode("btod"); newR(); }} style={btn(mode === "btod" ? "#0ea5e9" : "#1e3a5f")}>Bin→Dec</button>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>⭐ Score: {score}</div>
      <div style={{ background: "#0f172a", borderRadius: 14, padding: 20, marginBottom: 14, textAlign: "center", border: "1px solid #334155", width: "100%", maxWidth: 340 }}>
        {mode === "dtob" ? (<>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Convert to binary:</div>
          <div style={{ fontSize: 64, fontWeight: 900, color: "#f0f9ff", margin: "6px 0" }}>{decimal}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 6 }}>
            {[4,3,2,1,0].map(bit => <div key={bit} style={{ width: 36, height: 36, borderRadius: 8, background: bits[4 - bit] === "1" ? "#38bdf8" : "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "white" }}>{Math.pow(2, bit)}</div>)}
          </div>
        </>) : (<>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>What decimal is this?</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: "#38bdf8", margin: "6px 0", fontFamily: "monospace", letterSpacing: 4 }}>{decimal.toString(2).padStart(5, "0")}</div>
        </>)}
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && check()} placeholder={mode === "dtob" ? "Enter binary..." : "Enter decimal..."}
        style={{ ...inputStyle, maxWidth: 260, textAlign: "center", fontFamily: "monospace", fontSize: 20, fontWeight: 700, background: "#1e293b", color: "white", border: "2px solid #334155", marginBottom: 8 }} />
      <button onClick={check} style={btn("#0ea5e9")}>Check ✓</button>
      {fb === "correct" && <div style={{ fontSize: 22, marginTop: 10 }}>🎉 Correct!</div>}
      {fb && fb.startsWith("wrong") && <div style={{ fontSize: 16, marginTop: 10, color: "#f87171" }}>Answer: <strong>{fb.split(":")[1]}</strong></div>}
    </div>
  );
}

const CAPITALS = [
  { c: "France", cap: "Paris", e: "🗼" }, { c: "Japan", cap: "Tokyo", e: "🏯" },
  { c: "Brazil", cap: "Brasília", e: "🌿" }, { c: "Australia", cap: "Canberra", e: "🦘" },
  { c: "Canada", cap: "Ottawa", e: "🍁" }, { c: "Egypt", cap: "Cairo", e: "🏛️" },
  { c: "Germany", cap: "Berlin", e: "🇩🇪" }, { c: "India", cap: "New Delhi", e: "🕌" },
  { c: "Mexico", cap: "Mexico City", e: "🌮" }, { c: "China", cap: "Beijing", e: "🐉" },
  { c: "Italy", cap: "Rome", e: "🍕" }, { c: "UK", cap: "London", e: "🎡" },
  { c: "USA", cap: "Washington D.C.", e: "🗽" }, { c: "Spain", cap: "Madrid", e: "💃" },
  { c: "Russia", cap: "Moscow", e: "❄️" },
];
function GeoExplorer({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [opts, setOpts] = useState([]);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const newR = useCallback(() => {
    const i = rnd(0, CAPITALS.length - 1);
    const o = new Set([i]);
    while (o.size < 4) o.add(rnd(0, CAPITALS.length - 1));
    setIdx(i); setOpts(shuffle([...o])); setFb(null);
  }, []);
  useEffect(() => { newR(); }, []);
  const guess = i => {
    if (fb) return;
    setFb(i === idx ? "correct" : "wrong:" + CAPITALS[idx].cap);
    if (i === idx) setScore(s => s + 1);
    setTimeout(newR, 1200);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "linear-gradient(180deg,#0369a1,#1e3a5f)", padding: 24, color: "white" }}>
      <BackBtn fn={onBack} dark />
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#7dd3fc", marginBottom: 8 }}>🌍 Geo Explorer</h1>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>⭐ Score: {score}</div>
      <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 18, padding: "20px 34px", textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 64 }}>{CAPITALS[idx]?.e}</div>
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>Capital of {CAPITALS[idx]?.c}?</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 380 }}>
        {opts.map(i => (
          <button key={i} onClick={() => guess(i)} style={{ ...btn(fb && i === idx ? "#15803d" : "rgba(255,255,255,0.15)"), fontSize: 14, padding: "12px 8px", border: "1px solid rgba(255,255,255,0.2)" }}>{CAPITALS[i].cap}</button>
        ))}
      </div>
      {fb === "correct" && <div style={{ fontSize: 24, marginTop: 12 }}>🎉 Correct!</div>}
      {fb && fb.startsWith("wrong") && <div style={{ fontSize: 16, marginTop: 12, color: "#fca5a5" }}>Answer: <strong>{fb.split(":")[1]}</strong></div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGE 8+ GAMES
// ═══════════════════════════════════════════════════════════════
function evalPy(code, env) {
  const lines = code.split("\n");
  const out = [];
  const ev = expr => {
    expr = expr.trim();
    if (/^["'](.*)["']$/.test(expr)) return expr.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(expr)) return parseFloat(expr);
    if (expr in env) return env[expr];
    try {
      const safe = expr.replace(/\b([a-z_]\w*)\b/g, m => m in env ? JSON.stringify(env[m]) : m);
      return Function("\"use strict\";return(" + safe + ")")();
    } catch { return "[err:" + expr + "]"; }
  };
  for (const l of lines) {
    const t = l.trim();
    if (!t || t.startsWith("#")) continue;
    let m;
    if ((m = t.match(/^print\((.*)\)$/))) { out.push(String(ev(m[1]))); continue; }
    if ((m = t.match(/^([a-z_]\w*)\s*=\s*(.+)$/))) { env[m[1]] = ev(m[2]); out.push("# " + m[1] + " = " + env[m[1]]); continue; }
    if ((m = t.match(/^for (\w+) in range\((\d+)\):\s*print\((.+)\)$/))) {
      for (let j = 0; j < parseInt(m[2]); j++) out.push(String(ev(m[3].replace(new RegExp("\\b" + m[1] + "\\b", "g"), j))));
      continue;
    }
    out.push(">>> SyntaxError near: " + t);
  }
  return out;
}

function PythonStarter({ onBack }) {
  const [code, setCode] = useState("# Python Starter 🐍\nx = 10\nprint(x)\nprint(\"Hello, World!\")\nfor i in range(5):\n    print(i)\n");
  const [output, setOutput] = useState([]);
  const run = () => { const e = {}; setOutput(evalPy(code, e)); };
  const EX = [
    { l: "Hello", c: "print(\"Hello, World!\")\nprint(\"I am a Python programmer!\")" },
    { l: "Variables", c: "name = \"Alex\"\nage = 10\nprint(name)\nprint(age)" },
    { l: "Math", c: "x = 5\ny = 3\nprint(x + y)\nprint(x * y)" },
    { l: "Loop", c: "for i in range(10):\n    print(i)" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", padding: 16, fontFamily: "monospace" }}>
      <button onClick={onBack} style={{ color: "#4ade80", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#4ade80", marginBottom: 6 }}>🐍 Python Starter</h1>
      <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
        {EX.map(ex => <button key={ex.l} onClick={() => setCode(ex.c)} style={{ ...btn("#1e3a2a", "#4ade80"), fontSize: 11, padding: "3px 8px" }}>{ex.l}</button>)}
      </div>
      <textarea value={code} onChange={e => setCode(e.target.value)} style={{ flex: 1, background: "#1a2332", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: 10, fontFamily: "monospace", fontSize: 13, resize: "none", minHeight: 180, outline: "none" }} />
      <button onClick={run} style={{ ...btn("#15803d"), margin: "6px 0", fontSize: 14 }}>▶ Run Python</button>
      <div style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 8, padding: 10, minHeight: 70 }}>
        <div style={{ color: "#64748b", fontSize: 10, marginBottom: 3 }}>Output:</div>
        {output.length === 0 ? <div style={{ color: "#334155" }}>Press Run...</div> : output.map((l, i) => <div key={i} style={{ color: l.startsWith(">>>") ? "#f87171" : "#4ade80", lineHeight: 1.8 }}>{l}</div>)}
      </div>
    </div>
  );
}

function NetworkExplorer({ onBack }) {
  const layers = [
    { n: "Application", ex: "HTTP, HTTPS, DNS, FTP", icon: "🌐", desc: "Where your apps live. HTTP is used when you open a webpage." },
    { n: "Transport", ex: "TCP, UDP", icon: "📮", desc: "Breaks data into packets and ensures delivery. TCP checks all arrived." },
    { n: "Network", ex: "IP, ICMP, routing", icon: "🗺️", desc: "Finds the best path across networks. IP addresses live here." },
    { n: "Data Link", ex: "Ethernet, WiFi, MAC", icon: "🔗", desc: "Handles communication between nearby devices using MAC addresses." },
    { n: "Physical", ex: "Cables, radio, fiber", icon: "⚡", desc: "The actual wires, radio signals, and light pulses carrying data." },
  ];
  const [sel, setSel] = useState(null);
  const [quiz, setQuiz] = useState(false);
  const Q = [
    { q: "What does IP stand for?", a: "Internet Protocol", opts: ["Internet Portal", "Internet Protocol", "Internal Packet", "Interconnect Program"] },
    { q: "Which layer handles HTTP?", a: "Application", opts: ["Transport", "Network", "Application", "Physical"] },
    { q: "What does DNS do?", a: "Translates domain names to IPs", opts: ["Sends emails", "Encrypts traffic", "Translates domain names to IPs", "Controls routing"] },
    { q: "What is a packet?", a: "A small chunk of data", opts: ["A full download", "A small chunk of data", "A network cable", "A router"] },
  ];
  const [qIdx, setQIdx] = useState(0);
  const [qScore, setQScore] = useState(0);
  const [qFb, setQFb] = useState(null);
  const guessQ = ans => {
    if (qFb) return;
    setQFb(ans === Q[qIdx].a ? "correct" : "wrong:" + Q[qIdx].a);
    if (ans === Q[qIdx].a) setQScore(s => s + 1);
    setTimeout(() => { setQIdx(i => (i + 1) % Q.length); setQFb(null); }, 1200);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#1e3a5f)", padding: 18, color: "white" }}>
      <button onClick={onBack} style={{ color: "#7dd3fc", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#7dd3fc", marginBottom: 8 }}>🌐 Network Explorer</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setQuiz(false)} style={btn(!quiz ? "#0369a1" : "#1e293b")}>📚 OSI Model</button>
        <button onClick={() => setQuiz(true)} style={btn(quiz ? "#0369a1" : "#1e293b")}>🧪 Quiz</button>
      </div>
      {!quiz && layers.map(l => (
        <div key={l.n} onClick={() => setSel(sel === l.n ? null : l.n)} style={{ background: sel === l.n ? "#1e3a5f" : "#1e293b", borderRadius: 10, padding: "10px 14px", marginBottom: 5, cursor: "pointer", border: "1px solid " + (sel === l.n ? "#38bdf8" : "#334155") }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{l.icon}</span>
            <div><div style={{ fontWeight: 700, color: "#e2e8f0" }}>{l.n}</div><div style={{ fontSize: 11, color: "#64748b" }}>{l.ex}</div></div>
          </div>
          {sel === l.n && <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 13, borderTop: "1px solid #334155", paddingTop: 6 }}>{l.desc}</div>}
        </div>
      ))}
      {quiz && <>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>⭐ {qScore}</div>
        <div style={{ background: "#1e293b", borderRadius: 14, padding: 18, marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 12 }}>{Q[qIdx].q}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {Q[qIdx].opts.map(o => <button key={o} onClick={() => guessQ(o)} style={{ ...btn(qFb && o === Q[qIdx].a ? "#15803d" : "#334155"), textAlign: "left", fontSize: 13, padding: "9px 12px", border: "1px solid #475569" }}>{o}</button>)}
          </div>
        </div>
        {qFb === "correct" && <div style={{ color: "#4ade80", fontSize: 17 }}>✅ Correct!</div>}
        {qFb && qFb.startsWith("wrong") && <div style={{ color: "#f87171", fontSize: 13 }}>Answer: {qFb.split(":")[1]}</div>}
      </>}
    </div>
  );
}

const BUGS = [
  { code: "def greet(name):\n    print(\"Hello, \" + Name)\n\ngreet(\"Alice\")", bug: "Name should be name (case-sensitive)", hint: "Look at the variable name inside print()" },
  { code: "x = 10\ny = 0\nresult = x / y\nprint(result)", bug: "Division by zero — y cannot be 0", hint: "What is the value of y?" },
  { code: "for i in range(5)\n    print(i)", bug: "Missing colon after range(5)", hint: "What punctuation ends a for statement?" },
  { code: "password = \"secret\"\nif password = \"secret\":\n    print(\"OK!\")", bug: "= is assignment, == is comparison", hint: "What operator checks equality?" },
  { code: "nums = [1,2,3]\nfor n in nums\n    print(n)", bug: "Missing colon after nums", hint: "For loops need a : at the end" },
  { code: "nums = [10, 20, 30]\nprint(nums[3])", bug: "IndexError: index 3 is out of range (valid: 0,1,2)", hint: "How many items are in the list, and where do they start counting?" },
  { code: "age = 5\nprint(\"You are \" + age)", bug: "Can't add str + int — wrap with str(age)", hint: "What type is age vs the text around it?" },
  { code: "def add(a, b):\n    return a + b\nprint(add(3))", bug: "add() needs 2 arguments but only 1 was given", hint: "Count the parameters vs the values passed" },
  { code: "count = 0\nwhile count < 5:\n    print(count)", bug: "Infinite loop — count is never incremented", hint: "What updates the loop variable each time?" },
  { code: "print(\"Result:\", total)\ntotal = 42", bug: "NameError: total used before it is defined", hint: "Read top to bottom — does total exist yet on line 1?" },
];
function BugHunter({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [fb, setFb] = useState(null);
  const b = BUGS[idx];
  const check = () => { if (input.length > 10) { setScore(s => s + 1); setFb("correct"); } else setFb("short"); };
  const next = () => { setIdx(i => (i + 1) % BUGS.length); setInput(""); setFb(null); setRevealed(false); };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", padding: 16, fontFamily: "monospace" }}>
      <button onClick={onBack} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#f87171", marginBottom: 4 }}>🐛 Bug Hunter</h1>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>⭐ {score} | Bug {idx + 1}/{BUGS.length}</div>
      <div style={{ background: "#1a2332", borderRadius: 10, padding: 14, marginBottom: 10, border: "1px solid #334155" }}>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Buggy Code:</div>
        <pre style={{ color: "#e2e8f0", fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{b.code}</pre>
      </div>
      <p style={{ color: "#fbbf24", marginBottom: 6, fontSize: 12 }}>💡 Hint: {b.hint}</p>
      <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Describe the bug and how to fix it..." style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: 8, fontFamily: "monospace", fontSize: 12, minHeight: 55, resize: "vertical", outline: "none", marginBottom: 6 }} />
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <button onClick={check} style={btn("#dc2626")}>Submit Fix</button>
        <button onClick={() => setRevealed(true)} style={btn("#475569")}>👁 Answer</button>
        <button onClick={next} style={btn("#0369a1")}>Next →</button>
      </div>
      {fb === "correct" && <div style={{ color: "#4ade80", fontSize: 15, marginTop: 6 }}>✅ Nice debugging!</div>}
      {fb === "short" && <div style={{ color: "#f87171", marginTop: 6, fontSize: 12 }}>Write more detail!</div>}
      {revealed && <div style={{ background: "#14532d", borderRadius: 6, padding: 10, marginTop: 6, fontSize: 12, color: "#86efac" }}>Bug: {b.bug}</div>}
    </div>
  );
}

const AI_CH = [
  { title: "Be Specific", bad: "Tell me about Python", good: "Explain Python as if I'm 8 and never coded", lesson: "Adding audience context makes prompts much better!" },
  { title: "Role Assignment", bad: "Help me write an email", good: "You are an email coach. Help me write a polite email asking for more time.", lesson: "Telling AI who to 'be' changes the quality!" },
  { title: "Chain of Thought", bad: "What is 15% of 240?", good: "What is 15% of 240? Show all steps.", lesson: "Asking step-by-step reduces mistakes!" },
  { title: "Give Examples", bad: "Give me game ideas", good: "Give me 5 game ideas like: 'Math puzzles unlock doors.' Different genres.", lesson: "Examples help AI understand your quality bar." },
  { title: "Spot the Hallucination", fake: "The Great Wall is visible from space with naked eye", claims: ["The Eiffel Tower is in Paris", "Einstein won the 1921 Nobel Prize in Physics", "The Great Wall is visible from space with naked eye", "Water boils at 100°C at sea level"], lesson: "This is a myth! Always verify AI facts." },
  { title: "Set the Format", bad: "List some countries", good: "List 5 countries as a numbered list with their capital in brackets.", lesson: "Naming the exact output format saves you cleanup work!" },
  { title: "Add Constraints", bad: "Write a story", good: "Write a 4-sentence bedtime story for a 5-year-old about a shy dragon. No scary parts.", lesson: "Length, audience and 'don't do X' rules keep answers on target." },
];
function AIWhisperer({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const c = AI_CH[idx];
  const check = ans => {
    if (c.fake) {
      if (ans === c.fake) { setScore(s => s + 1); setFb("correct"); }
      else setFb("wrong:" + c.fake);
    } else if (input.length > 20) { setScore(s => s + 1); setFb("correct"); }
    else setFb("short");
  };
  const next = () => { setIdx(i => (i + 1) % AI_CH.length); setInput(""); setFb(null); };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#1e1b4b)", padding: 18, color: "white" }}>
      <button onClick={onBack} style={{ color: "#a5b4fc", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#a5b4fc", marginBottom: 4 }}>🤖 AI Whisperer</h1>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⭐ {score} | {idx + 1}/{AI_CH.length}</div>
      <div style={{ background: "#1e1b4b", borderRadius: 14, padding: 18, marginBottom: 10, border: "1px solid #4338ca" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#a5b4fc", marginBottom: 8 }}>🎯 {c.title}</div>
        {!c.fake && <>
          <div style={{ marginBottom: 6 }}><span style={{ color: "#f87171", fontWeight: 700 }}>❌ Weak: </span><span style={{ color: "#94a3b8", fontStyle: "italic" }}>"{c.bad}"</span></div>
          <div style={{ marginBottom: 10 }}><span style={{ color: "#4ade80", fontWeight: 700 }}>✅ Strong: </span><span style={{ color: "#86efac", fontStyle: "italic" }}>"{c.good}"</span></div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Now write YOUR improved prompt:</div>
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Write your improved prompt..." style={{ background: "#0f172a", color: "#e2e8f0", border: "1px solid #4338ca", borderRadius: 8, padding: 8, fontSize: 12, minHeight: 55, resize: "vertical", outline: "none", width: "100%", boxSizing: "border-box" }} />
        </>}
        {c.fake && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ color: "#c7d2fe", marginBottom: 6, fontSize: 13 }}>Which claim is probably FALSE?</div>
          {c.claims.map(claim => <button key={claim} onClick={() => check(claim)} style={{ ...btn("#1e3a5f"), textAlign: "left", fontSize: 12, padding: "9px 12px", border: "1px solid #334155" }}>{claim}</button>)}
        </div>}
      </div>
      {!c.fake && <button onClick={() => check(input)} style={btn("#4338ca")}>Submit</button>}
      {fb === "correct" && <div style={{ background: "#14532d", borderRadius: 8, padding: 10, marginTop: 8, color: "#86efac", fontSize: 13 }}>✅ {c.lesson}</div>}
      {fb === "short" && <div style={{ color: "#f87171", marginTop: 6, fontSize: 13 }}>Write a more detailed prompt!</div>}
      {fb && fb.startsWith("wrong") && <div style={{ background: "#450a0a", borderRadius: 8, padding: 10, marginTop: 8, color: "#fca5a5", fontSize: 13 }}>{c.lesson}</div>}
      {fb && <button onClick={next} style={{ ...btn("#4338ca"), marginTop: 8 }}>Next →</button>}
    </div>
  );
}

function HTMLBuilder({ onBack }) {
  const [code, setCode] = useState("<h1 style=\"color:blue\">Hello World!</h1>\n<p>I am learning <strong>HTML</strong>!</p>\n<ul>\n  <li>🍕 Pizza</li>\n  <li>🎮 Gaming</li>\n  <li>💻 Coding</li>\n</ul>\n<p style=\"color:green;font-size:20px\">Edit this code!</p>");
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", padding: 14 }}>
      <button onClick={onBack} style={{ color: "#f97316", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#f97316", marginBottom: 8 }}>📄 HTML Builder</h1>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>Edit HTML:</div>
      <textarea value={code} onChange={e => setCode(e.target.value)} style={{ width: "100%", height: 190, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: 10, fontFamily: "monospace", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3, marginTop: 10 }}>Live Preview:</div>
      <div style={{ background: "white", borderRadius: 10, padding: 14, minHeight: 140, border: "1px solid #e5e7eb" }} dangerouslySetInnerHTML={{ __html: code }} />
      <div style={{ background: "#1e293b", borderRadius: 8, padding: 10, marginTop: 8, fontSize: 11, color: "#94a3b8" }}>Try: &lt;h1&gt; &lt;p&gt; &lt;a href="..."&gt; style="color:red"</div>
    </div>
  );
}

function CSSPainter({ onBack }) {
  const [html, setHtml] = useState("<div class=\"box\">Hello!</div>\n<p class=\"text\">Edit CSS to style me!</p>\n<button class=\"btn\">Click me</button>");
  const [css, setCss] = useState(".box{\n  background:coral;color:white;\n  padding:20px;border-radius:10px;\n  text-align:center;font-size:24px;\n}\n.text{color:navy;font-family:Georgia;font-size:18px;}\n.btn{background:purple;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;font-size:16px;}");
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", padding: 14 }}>
      <button onClick={onBack} style={{ color: "#ec4899", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#ec4899", marginBottom: 8 }}>🎨 CSS Painter</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 1 }}>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>HTML:</div>
          <textarea value={html} onChange={e => setHtml(e.target.value)} style={{ width: "100%", height: 90, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: 8, fontFamily: "monospace", fontSize: 12, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2, marginTop: 6 }}>CSS:</div>
          <textarea value={css} onChange={e => setCss(e.target.value)} style={{ width: "100%", height: 180, background: "#1e293b", color: "#ec4899", border: "1px solid #334155", borderRadius: 8, padding: 8, fontFamily: "monospace", fontSize: 12, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>Preview:</div>
          <div style={{ background: "white", borderRadius: 10, padding: 14, minHeight: 280, border: "1px solid #e5e7eb" }} dangerouslySetInnerHTML={{ __html: "<style>" + css + "</style>" + html }} />
        </div>
      </div>
    </div>
  );
}

function JSBasics({ onBack }) {
  const [code, setCode] = useState("// JavaScript Basics 🚀\nlet name = \"Alex\";\nlet age = 10;\nconsole.log(\"Name: \" + name);\nconsole.log(\"Age: \" + age);\n\nfunction greet(who) {\n  return \"Hello, \" + who + \"!\";\n}\nconsole.log(greet(name));\n\nlet fruits = [\"apple\",\"banana\",\"cherry\"];\nfor (let i = 0; i < fruits.length; i++) {\n  console.log(fruits[i]);\n}");
  const [output, setOutput] = useState([]);
  const run = () => {
    const logs = [];
    const c = { log: (...a) => logs.push(a.map(String).join(" ")), error: (...a) => logs.push("[ERR] " + a.join(" ")) };
    try { Function("console", code)(c); } catch (e) { logs.push("[JS Error] " + e.message); }
    setOutput(logs);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", padding: 14, fontFamily: "monospace" }}>
      <button onClick={onBack} style={{ color: "#fbbf24", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fbbf24", marginBottom: 8 }}>⚡ JavaScript Basics</h1>
      <textarea value={code} onChange={e => setCode(e.target.value)} style={{ flex: 1, background: "#1a2332", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: 10, fontFamily: "monospace", fontSize: 13, resize: "none", minHeight: 200, outline: "none" }} />
      <button onClick={run} style={{ ...btn("#ca8a04"), margin: "6px 0", fontSize: 14 }}>▶ Run JS</button>
      <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 10, minHeight: 70 }}>
        <div style={{ color: "#64748b", fontSize: 10, marginBottom: 3 }}>Console:</div>
        {output.length === 0 ? <div style={{ color: "#334155" }}>Run JS to see output...</div> : output.map((l, i) => <div key={i} style={{ color: l.startsWith("[JS Error]") ? "#f87171" : "#fbbf24", lineHeight: 1.8 }}>{l}</div>)}
      </div>
    </div>
  );
}

function BinaryHexLab({ onBack }) {
  const [inp, setInp] = useState("");
  const [from, setFrom] = useState("dec");
  const [challenge, setChallenge] = useState(null);
  const [score, setScore] = useState(0);
  const [ans, setAns] = useState("");
  const [fb, setFb] = useState(null);
  const convert = v => {
    if (!v) return { bin: "", hex: "", dec: "", oct: "" };
    try {
      const d = from === "dec" ? parseInt(v) : from === "bin" ? parseInt(v, 2) : from === "hex" ? parseInt(v, 16) : parseInt(v, 8);
      if (isNaN(d)) return { bin: "?", hex: "?", dec: "?", oct: "?" };
      return { dec: d.toString(), bin: d.toString(2), hex: d.toString(16).toUpperCase(), oct: d.toString(8) };
    } catch { return { bin: "?", hex: "?", dec: "?", oct: "?" }; }
  };
  const r = convert(inp);
  const newC = () => {
    const n = rnd(1, 255);
    const types = [{ f: "dec", t: "bin" }, { f: "dec", t: "hex" }, { f: "bin", t: "dec" }, { f: "hex", t: "dec" }];
    const tp = types[rnd(0, types.length - 1)];
    const val = tp.f === "dec" ? n.toString() : tp.f === "bin" ? n.toString(2) : n.toString(16).toUpperCase();
    const correct = tp.t === "dec" ? n.toString() : tp.t === "bin" ? n.toString(2) : n.toString(16).toUpperCase();
    setChallenge({ val, from: tp.f, to: tp.t, correct }); setAns(""); setFb(null);
  };
  const checkC = () => {
    if (ans.toUpperCase() === challenge.correct.toUpperCase()) { setScore(s => s + 1); setFb("correct"); }
    else setFb("wrong:" + challenge.correct);
    setTimeout(newC, 1200);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#1e3a5f)", padding: 18, color: "white" }}>
      <button onClick={onBack} style={{ color: "#38bdf8", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#38bdf8", marginBottom: 12 }}>🔢 Binary & Hex Lab</h1>
      <div style={{ background: "#1e293b", borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: "#94a3b8", fontSize: 12 }}>🔄 Converter</div>
        <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
          {[["dec","Dec"],["bin","Bin"],["hex","Hex"],["oct","Oct"]].map(([v, l]) => (
            <button key={v} onClick={() => { setFrom(v); setInp(""); }} style={btn(from === v ? "#0369a1" : "#334155")}>{l}</button>
          ))}
        </div>
        <input value={inp} onChange={e => setInp(e.target.value)} placeholder={"Enter " + from + " number..."} style={{ ...inputStyle, background: "#0f172a", color: "white", border: "1px solid #334155", fontFamily: "monospace", fontSize: 18, fontWeight: 700, marginBottom: 8 }} />
        {inp && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[["Decimal", r.dec, "#fbbf24"],["Binary", r.bin, "#4ade80"],["Hex", r.hex, "#f472b6"],["Octal", r.oct, "#38bdf8"]].map(([n, v, c]) => (
            <div key={n} style={{ background: "#0f172a", borderRadius: 7, padding: 8 }}>
              <div style={{ fontSize: 10, color: "#64748b" }}>{n}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: c, fontFamily: "monospace" }}>{v}</div>
            </div>
          ))}
        </div>}
      </div>
      <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: "#94a3b8", fontSize: 12 }}>🎯 Challenge — Score: {score}</div>
        {!challenge && <button onClick={newC} style={btn("#0369a1")}>Start</button>}
        {challenge && <>
          <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 8 }}>Convert <strong style={{ color: "#fbbf24" }}>{challenge.val}</strong> ({challenge.from.toUpperCase()}) to {challenge.to.toUpperCase()}:</div>
          <input value={ans} onChange={e => setAns(e.target.value)} onKeyDown={e => e.key === "Enter" && checkC()} placeholder="Your answer..." style={{ ...inputStyle, background: "#0f172a", color: "white", border: "1px solid #334155", fontFamily: "monospace", marginBottom: 6 }} />
          <button onClick={checkC} style={btn("#0369a1")}>Check</button>
          {fb === "correct" && <div style={{ color: "#4ade80", marginTop: 6 }}>✅ Correct!</div>}
          {fb && fb.startsWith("wrong") && <div style={{ color: "#f87171", marginTop: 6 }}>Answer: {fb.split(":")[1]}</div>}
        </>}
      </div>
    </div>
  );
}

const SQL_DB = {
  users: [{ id:1,name:"Alice",age:14,city:"NYC" },{ id:2,name:"Bob",age:12,city:"LA" },{ id:3,name:"Carol",age:15,city:"NYC" },{ id:4,name:"Dave",age:13,city:"Chicago" },{ id:5,name:"Eve",age:11,city:"LA" }],
  scores: [{ id:1,user_id:1,game:"Python",score:95 },{ id:2,user_id:2,game:"HTML",score:82 },{ id:3,user_id:3,game:"Python",score:98 },{ id:4,user_id:1,game:"HTML",score:78 },{ id:5,user_id:4,game:"Python",score:71 }],
};
function SQLIntro({ onBack }) {
  const [query, setQuery] = useState("SELECT * FROM users");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const run = () => {
    try {
      const q = query.trim().toUpperCase();
      const tbl = q.includes("FROM USERS") ? "users" : q.includes("FROM SCORES") ? "scores" : null;
      if (!tbl) { setErr("Table not found. Try: FROM users  OR  FROM scores"); setResult(null); return; }
      let rows = [...SQL_DB[tbl]];
      const wm = q.match(/WHERE\s+(\w+)\s*(=|>|<|!=|>=|<=)\s*['"]?([^'" ]+)['"]?/);
      if (wm) {
        const col = wm[1].toLowerCase(), op = wm[2], val = isNaN(wm[3]) ? wm[3] : Number(wm[3]);
        rows = rows.filter(r => {
          const rv = r[col];
          if (op === "=") return String(rv).toUpperCase() === String(val).toUpperCase();
          if (op === ">") return rv > val; if (op === "<") return rv < val;
          if (op === "!=") return rv != val; if (op === ">=") return rv >= val; return rv <= val;
        });
      }
      const om = q.match(/ORDER BY\s+(\w+)/);
      if (om) { const col = om[1].toLowerCase(); rows.sort((a, b) => a[col] > b[col] ? 1 : -1); }
      const lm = q.match(/LIMIT\s+(\d+)/);
      if (lm) rows = rows.slice(0, parseInt(lm[1]));
      let cols = Object.keys(SQL_DB[tbl][0]);
      const sm = q.match(/SELECT\s+(.+?)\s+FROM/);
      if (sm && sm[1] !== "*") {
        const sel = sm[1].split(",").map(c => c.trim().toLowerCase()).filter(c => cols.includes(c));
        if (sel.length) cols = sel;
      }
      setResult({ cols, rows: rows.map(r => cols.map(c => r[c])) }); setErr("");
    } catch (e) { setErr("SQL Error: " + e.message); setResult(null); }
  };
  const EX = ["SELECT * FROM users","SELECT name, age FROM users","SELECT * FROM users WHERE city = 'NYC'","SELECT * FROM scores WHERE score > 80","SELECT * FROM users ORDER BY age","SELECT * FROM users LIMIT 3"];
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", padding: 14, fontFamily: "monospace" }}>
      <button onClick={onBack} style={{ color: "#4ade80", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#4ade80", marginBottom: 4 }}>🗄️ SQL Intro</h1>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>Tables: <strong style={{ color: "#38bdf8" }}>users</strong>(id,name,age,city) | <strong style={{ color: "#38bdf8" }}>scores</strong>(id,user_id,game,score)</div>
      <div style={{ display: "flex", gap: 3, marginBottom: 5, flexWrap: "wrap" }}>
        {EX.map(ex => <button key={ex} onClick={() => setQuery(ex)} style={{ ...btn("#1e293b", "#94a3b8"), fontSize: 10, padding: "2px 5px", border: "1px solid #334155" }}>{ex}</button>)}
      </div>
      <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && e.ctrlKey && run()} style={{ background: "#1e293b", color: "#4ade80", border: "1px solid #334155", borderRadius: 8, padding: 8, fontFamily: "monospace", fontSize: 14, height: 50, resize: "none", outline: "none", marginBottom: 5 }} />
      <button onClick={run} style={btn("#059669")}>▶ Run Query</button>
      {err && <div style={{ color: "#f87171", marginTop: 6, fontSize: 12 }}>{err}</div>}
      {result && <div style={{ marginTop: 10, overflowX: "auto" }}>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>{result.rows.length} row(s)</div>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead><tr>{result.cols.map(c => <th key={c} style={{ background: "#1e3a5f", color: "#38bdf8", padding: "5px 10px", textAlign: "left", border: "1px solid #334155" }}>{c}</th>)}</tr></thead>
          <tbody>{result.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={{ padding: "5px 10px", border: "1px solid #1e293b", color: "#e2e8f0", background: i % 2 === 0 ? "#0f172a" : "#1e293b" }}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>}
    </div>
  );
}

function GitControl({ onBack }) {
  const cmds = {
    "help": () => "Git commands:\n  git init        - Start repo\n  git status      - File status\n  git add .       - Stage all\n  git commit -m \"msg\" - Save\n  git log         - History\n  git branch      - List branches\n  git branch <n>  - Create branch\n  git checkout <b>- Switch branch\n  git merge <b>   - Merge branch\n  git diff        - See changes\n  git clone <url> - Copy repo",
    "git init": () => "Initialized empty Git repository in .git/",
    "git status": () => "On branch main\nmodified: index.html\nmodified: style.css\nUntracked: app.js",
    "git add \\.": () => "[3 files staged]",
    "git add (.+)": m => "[staged: " + m[1] + "]",
    "git commit -m \"(.+)\"": m => "[main abc1234] " + m[1] + "\n3 files changed",
    "git log": () => "commit abc1234 (HEAD)\nAuthor: Junior Hacker\nDate:   Feb 26 2026\n    Initial commit",
    "git branch": () => "* main\n  feature/login\n  bugfix/navbar",
    "git branch (.+)": m => "Created '" + m[1] + "'",
    "git checkout (.+)": m => "Switched to '" + m[1] + "'",
    "git merge (.+)": m => "Fast-forward merge from '" + m[1] + "' done",
    "git diff": () => "+++ b/index.html\n-   <h1>Hello</h1>\n+   <h1>Hello, World!</h1>",
    "git clone (.+)": m => "Cloning into '" + m[1].split("/").pop() + "'...\n42 objects received.",
    "git (.+)": m => "git: '" + m[1] + "' unknown — type 'help'",
    "clear": () => "[CLEARED]",
  };
  return <Terminal cmds={cmds} title="🌿 Git Control" prompt="user@projects $ " welcome={["Git Control! 🌿", "Git saves and tracks your code.", "Type 'help' to see commands!", "", "Try: git init → git status → git add . → git commit -m \"First commit\" → git log"]} onBack={onBack} />;
}

const REGEX_CH = [
  { pattern: /\d+/g, input: "I have 3 cats and 12 dogs", desc: "Match all numbers", hint: "\\d+ matches one or more digits" },
  { pattern: /[A-Z]/g, input: "Hello World from Code", desc: "Match all capital letters", hint: "[A-Z] matches uppercase letters" },
  { pattern: /\b\w{4}\b/g, input: "This is cool code that runs now", desc: "Match exactly 4-letter words", hint: "\\b is word boundary, \\w{4} is 4 chars" },
  { pattern: /[aeiou]/gi, input: "Hello World", desc: "Match all vowels", hint: "[aeiou] with i flag for case-insensitive" },
  { pattern: /https?:\/\/\S+/g, input: "Visit https://example.com or http://test.org", desc: "Match URLs", hint: "https? means s is optional, \\S+ = non-spaces" },
  { pattern: /\w+@\w+\.\w+/g, input: "Email me at sam@site.com or jo@web.org", desc: "Match email addresses", hint: "\\w+ @ \\w+ . \\w+ — a very simple email shape" },
  { pattern: /#\w+/g, input: "I love #coding and #python today", desc: "Match hashtags", hint: "# followed by \\w+ (word characters)" },
  { pattern: /\d{3}-\d{4}/g, input: "Call 555-1234 or 555-9876 now", desc: "Match phone numbers (000-0000)", hint: "\\d{3} then a dash then \\d{4}" },
  { pattern: /#[0-9a-fA-F]{6}/g, input: "Colors: #ff0000 red and #00FF00 green", desc: "Match hex color codes", hint: "# then exactly 6 hex digits" },
  { pattern: /\bhttps\b/g, input: "http is old, https is secure, https rocks", desc: "Match the whole word 'https' only", hint: "\\b word boundaries stop it matching inside other words" },
];
function RegexRanger({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const [hint, setHint] = useState(false);
  const c = REGEX_CH[idx];
  const matches = c.input.match(c.pattern) || [];
  const check = () => {
    try {
      const flags = input.match(/\/([gimy]+)$/)?.[1] || "g";
      const pat = input.replace(/^\/|\/[gimy]*$/g, "");
      const got = c.input.match(new RegExp(pat, flags)) || [];
      if (JSON.stringify(got.sort()) === JSON.stringify(matches.sort())) { setScore(s => s + 1); setFb("correct"); }
      else setFb("wrong:Got [" + got.join(", ") + "], expected [" + matches.join(", ") + "]");
    } catch (e) { setFb("wrong:Invalid regex — " + e.message); }
  };
  const next = () => { setIdx(i => (i + 1) % REGEX_CH.length); setInput(""); setFb(null); setHint(false); };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", padding: 16, fontFamily: "monospace" }}>
      <button onClick={onBack} style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#a78bfa", marginBottom: 4 }}>🔍 Regex Ranger</h1>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⭐ {score} | Challenge {idx + 1}/{REGEX_CH.length}</div>
      <div style={{ background: "#1e293b", borderRadius: 10, padding: 14, marginBottom: 10 }}>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 3 }}>Test string:</div>
        <div style={{ color: "#fbbf24", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>"{c.input}"</div>
        <div style={{ color: "#a78bfa", fontWeight: 700 }}>Goal: {c.desc}</div>
        <div style={{ color: "#4ade80", fontSize: 11, marginTop: 3 }}>Expected: [{matches.join(", ")}]</div>
      </div>
      {hint && <div style={{ background: "#1e3a5f", borderRadius: 8, padding: 9, marginBottom: 8, color: "#7dd3fc", fontSize: 12 }}>💡 {c.hint}</div>}
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && check()} placeholder="Enter regex e.g. /\\d+/g"
        style={{ ...inputStyle, background: "#1e293b", color: "#a78bfa", border: "1px solid #4c1d95", fontFamily: "monospace", fontSize: 15, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <button onClick={check} style={btn("#7c3aed")}>Test</button>
        <button onClick={() => setHint(true)} style={btn("#334155")}>💡 Hint</button>
        <button onClick={next} style={btn("#0369a1")}>Next →</button>
      </div>
      {fb === "correct" && <div style={{ color: "#4ade80", marginTop: 8, fontSize: 14 }}>✅ Perfect match!</div>}
      {fb && fb.startsWith("wrong") && <div style={{ color: "#f87171", marginTop: 8, fontSize: 12 }}>{fb.split(":")[1]}</div>}
    </div>
  );
}

function APIExplorer({ onBack }) {
  const [endpoint, setEndpoint] = useState("GET /api/users");
  const [result, setResult] = useState(null);
  const FAKE = {
    "GET /api/users": { s: 200, b: { users: [{ id:1,name:"Alice" },{ id:2,name:"Bob" },{ id:3,name:"Carol" }] } },
    "GET /api/users/1": { s: 200, b: { id:1,name:"Alice",role:"admin",email:"alice@example.com" } },
    "GET /api/users/99": { s: 404, b: { error: "User not found" } },
    "POST /api/users": { s: 201, b: { message: "User created!", id: 4 } },
    "DELETE /api/users/1": { s: 200, b: { message: "User deleted" } },
    "GET /api/products": { s: 200, b: { products: [{ id:1,name:"Widget",price:9.99 },{ id:2,name:"Gadget",price:24.99 }] } },
    "GET /api/status": { s: 200, b: { status: "OK", uptime: "99.9%", version: "2.0" } },
    "GET /api/secret": { s: 403, b: { error: "Forbidden — Auth required" } },
    "DELETE /api/admin": { s: 401, b: { error: "Unauthorized" } },
  };
  const call = () => setResult(FAKE[endpoint] || { s: 404, b: { error: "Endpoint not found" } });
  const SC = { 200: "#4ade80", 201: "#86efac", 403: "#ef4444", 404: "#f87171", 401: "#f97316" };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", padding: 14, fontFamily: "monospace" }}>
      <button onClick={onBack} style={{ color: "#38bdf8", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#38bdf8", marginBottom: 8 }}>📡 API Explorer</h1>
      <div style={{ display: "flex", gap: 4, marginBottom: 7, flexWrap: "wrap" }}>
        {Object.keys(FAKE).map(ep => <button key={ep} onClick={() => setEndpoint(ep)} style={{ ...btn(endpoint === ep ? "#0369a1" : "#1e293b", "#94a3b8"), fontSize: 10, padding: "3px 6px", border: "1px solid #334155" }}>{ep}</button>)}
      </div>
      <div style={{ display: "flex", gap: 7, marginBottom: 7 }}>
        <input value={endpoint} onChange={e => setEndpoint(e.target.value)} style={{ ...inputStyle, flex: 1, background: "#1e293b", color: "#38bdf8", border: "1px solid #334155", fontFamily: "monospace" }} />
        <button onClick={call} style={btn("#0369a1")}>Send</button>
      </div>
      {result && <>
        <div style={{ background: "#1e293b", borderRadius: 7, padding: 10, marginBottom: 7 }}>
          <span style={{ color: "#64748b", fontSize: 10 }}>Status: </span>
          <span style={{ color: SC[result.s] || "#94a3b8", fontWeight: 900, fontSize: 14 }}>{result.s}</span>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 7, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 3 }}>Response:</div>
          <pre style={{ color: "#4ade80", margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>{JSON.stringify(result.b, null, 2)}</pre>
        </div>
        <div style={{ background: "#1e293b", borderRadius: 7, padding: 10, marginTop: 8, fontSize: 11, color: "#94a3b8" }}>GET=read • POST=create • PUT=update • DELETE=remove</div>
      </>}
    </div>
  );
}

function LinuxDeepDive({ onBack }) {
  const cmds = {
    "help": () => "Advanced Linux:\n  ps aux         - all processes\n  top            - system monitor\n  df -h          - disk usage\n  netstat -tulpn - open ports\n  grep -r <p> .  - recursive search\n  find . -name f - find files\n  chmod 755 f    - permissions\n  curl <url>     - HTTP request\n  env            - env variables\n  export X=val   - set variable\n  which <cmd>    - find path\n  crontab -l     - list cron jobs\n  --- crypto / text ---\n  caesar <n> <t> / caesar -d <n> <t>\n  rot13 / atbash / reverse <t>\n  base64 [-d] / hex / bin <t>",
    "ps aux": () => "USER  PID  %CPU CMD\nroot    1   0.0  init\nhack  420   2.1  python3 server.py\nhack  421   0.0  bash",
    "top": () => "Tasks: 42 total\nCPU: 2.1% used  Mem: 6210MB free\nPID  CMD\n420  python3",
    "df -h": () => "Filesystem  Size  Used  Avail\n/dev/sda1    50G   12G    38G\ntmpfs       4.0G    0   4.0G",
    "netstat -tulpn": () => "tcp 0.0.0.0:22   LISTEN 99/sshd\ntcp 0.0.0.0:80   LISTEN 420/python3\ntcp 0.0.0.0:443  LISTEN 420/python3",
    "curl (.+)": m => "HTTP/1.1 200 OK\n\n<html>Hello from " + m[1] + "!</html>",
    "grep -r (.+) \\.": m => "./main.py:42:  if \"" + m[1] + "\" in data:\n./README.md:15: See " + m[1],
    "find \\. -name (.+)": m => "./src/" + m[1] + "\n./tests/" + m[1],
    "chmod (.+) (.+)": m => "chmod: '" + m[2] + "' → " + m[1],
    "env": () => "HOME=/home/hacker\nPATH=/usr/local/bin:/usr/bin\nSHELL=/bin/bash",
    "export (.+)=(.+)": m => "[" + m[1] + "=" + m[2] + " set]",
    "which (.+)": m => "/usr/bin/" + m[1],
    "crontab -l": () => "0 2 * * * /scripts/backup.sh\n*/5 * * * * /scripts/monitor.sh",
    "echo (.*)": m => m[1],
    "pwd": () => "/home/hacker",
    "ls": () => "bin  config  data  logs  scripts",
    "whoami": () => "hacker",
    // ── Crypto & text tools (same set as Terminal Pro) ──
    "caesar -d ([0-9]+) (.+)": m => caesarShift(m[2], -parseInt(m[1])),
    "caesar ([0-9]+) (.+)": m => caesarShift(m[2], parseInt(m[1])),
    "rot13 (.+)": m => caesarShift(m[1], 13),
    "atbash (.+)": m => atbash(m[1]),
    "reverse (.+)": m => m[1].split("").reverse().join(""),
    "base64 -d (.+)": m => b64dec(m[1]),
    "base64 (.+)": m => b64enc(m[1]),
    "hex (.+)": m => toHexStr(m[1]),
    "bin (.+)": m => toBinStr(m[1]),
    "clear": () => "[CLEARED]",
  };
  return <Terminal cmds={cmds} title="🐧 Linux Deep Dive" prompt="hacker@server:~$ " welcome={["Linux Deep Dive! 🐧", "Master these commands to do anything.", "Type 'help' for the command list."]} onBack={onBack} />;
}

const FW_RULES = [
  { rule: "ALLOW TCP port 443 (HTTPS)", allow: true,  reason: "Secure web traffic — always allowed" },
  { rule: "BLOCK TCP port 23 (Telnet)",  allow: false, reason: "Telnet sends passwords in plain text!" },
  { rule: "ALLOW TCP port 80 (HTTP)",    allow: true,  reason: "Basic web traffic" },
  { rule: "BLOCK incoming port 4444",    allow: false, reason: "Common port for reverse shells & malware" },
  { rule: "ALLOW UDP port 53 (DNS)",     allow: true,  reason: "DNS needed to look up domain names" },
  { rule: "BLOCK port 6667 (IRC)",       allow: false, reason: "Often used by botnets" },
  { rule: "ALLOW TCP port 22 (SSH)",     allow: true,  reason: "Secure remote access" },
  { rule: "BLOCK ICMP flood from 10.0.0.99", allow: false, reason: "DDoS ping flood attack!" },
  { rule: "BLOCK inbound TCP port 3389 (RDP) from the internet", allow: false, reason: "Exposed Remote Desktop is a top ransomware entry point" },
  { rule: "BLOCK inbound TCP port 445 (SMB) from the internet", allow: false, reason: "SMB exposure enabled WannaCry — keep it internal only" },
  { rule: "ALLOW TCP port 587 (secure email submission)", allow: true, reason: "Modern encrypted outgoing mail" },
  { rule: "ALLOW established & related connections back in", allow: true, reason: "Stateful firewalls let replies to YOUR requests return" },
  { rule: "BLOCK outbound traffic to a known malware C2 server", allow: false, reason: "Stops infected machines 'phoning home' to attackers" },
];
function FirewallConcepts({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const [learn, setLearn] = useState(false);
  const r = FW_RULES[idx];
  const guess = allow => {
    if (fb) return;
    setFb(allow === r.allow ? "correct" : "wrong");
    if (allow === r.allow) setScore(s => s + 1);
  };
  const next = () => { setIdx(i => (i + 1) % FW_RULES.length); setFb(null); };
  const PORTS = [{ p:80,n:"HTTP" },{ p:443,n:"HTTPS" },{ p:22,n:"SSH" },{ p:21,n:"FTP" },{ p:25,n:"SMTP" },{ p:53,n:"DNS" },{ p:3306,n:"MySQL" },{ p:8080,n:"Alt HTTP" }];
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#450a0a,#0f172a)", padding: 18, color: "white" }}>
      <button onClick={onBack} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#f87171", marginBottom: 8 }}>🔥 Firewall Concepts</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => setLearn(false)} style={btn(!learn ? "#dc2626" : "#1e293b")}>🎮 Game</button>
        <button onClick={() => setLearn(true)} style={btn(learn ? "#dc2626" : "#1e293b")}>📚 Port Guide</button>
      </div>
      {!learn && <>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⭐ {score} | Rule {idx + 1}/{FW_RULES.length}</div>
        <div style={{ background: "#1e293b", borderRadius: 14, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>Rule:</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", fontFamily: "monospace", marginBottom: 14 }}>{r.rule}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => guess(true)} style={{ ...btn("#15803d"), flex: 1, fontSize: 16, padding: 12 }}>✅ ALLOW</button>
            <button onClick={() => guess(false)} style={{ ...btn("#dc2626"), flex: 1, fontSize: 16, padding: 12 }}>🚫 BLOCK</button>
          </div>
        </div>
        {fb && <div style={{ background: fb === "correct" ? "#14532d" : "#450a0a", borderRadius: 10, padding: 12, fontSize: 13 }}>
          {fb === "correct" ? "✅" : "❌"} {r.reason}
          <button onClick={next} style={{ ...btn("#334155"), marginTop: 7, display: "block", fontSize: 11 }}>Next →</button>
        </div>}
      </>}
      {learn && PORTS.map(p => (
        <div key={p.p} style={{ background: "#1e293b", borderRadius: 8, padding: 9, marginBottom: 5, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#38bdf8", fontFamily: "monospace", fontWeight: 700 }}>:{p.p}</span>
          <span>{p.n}</span>
        </div>
      ))}
    </div>
  );
}

function PasswordSecurity({ onBack }) {
  const [pwd, setPwd] = useState("");
  const analyze = p => {
    if (!p) return null;
    let s = 0, tips = [];
    if (p.length >= 8) s += 20; else tips.push("Use at least 8 characters");
    if (p.length >= 12) s += 10;
    if (p.length >= 16) s += 10;
    if (/[A-Z]/.test(p)) s += 15; else tips.push("Add uppercase letters");
    if (/[a-z]/.test(p)) s += 15; else tips.push("Add lowercase letters");
    if (/\d/.test(p)) s += 15; else tips.push("Add numbers");
    if (/[!@#$%^&*]/.test(p)) s += 15; else tips.push("Add special chars (!@#$)");
    if (/(.)\1{2,}/.test(p)) { s -= 20; tips.push("Avoid repeating characters"); }
    if (/(123|password|abc|qwe)/i.test(p)) { s -= 25; tips.push("Avoid common patterns"); }
    s = Math.max(0, Math.min(100, s));
    const ct = p.length < 6 ? "instantly" : p.length < 8 ? "seconds" : p.length < 10 ? "hours" : p.length < 12 ? "days" : p.length < 14 ? "years" : "centuries";
    const entropy = Math.round(p.length * Math.log2(26 + (/[A-Z]/.test(p) ? 26 : 0) + (/\d/.test(p) ? 10 : 0) + (/[!@#$]/.test(p) ? 32 : 0)));
    return { score: s, tips, crackTime: ct, entropy };
  };
  const a = analyze(pwd);
  const col = a ? a.score >= 80 ? "#4ade80" : a.score >= 60 ? "#fbbf24" : a.score >= 40 ? "#f97316" : "#f87171" : "#334155";
  const lbl = a ? a.score >= 80 ? "Strong 🔒" : a.score >= 60 ? "Good 👍" : a.score >= 40 ? "Weak ⚠️" : "Very Weak ❌" : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#1e1b4b)", padding: 18, color: "white" }}>
      <button onClick={onBack} style={{ color: "#a5b4fc", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#a5b4fc", marginBottom: 14 }}>🔑 Password Security</h1>
      <input value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Type a password to analyze..." style={{ ...inputStyle, background: "#1e293b", color: "white", border: "2px solid #4338ca", fontSize: 17, fontFamily: "monospace", marginBottom: 10 }} />
      {a && <>
        <div style={{ background: "#1e293b", borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: col, fontSize: 17 }}>{lbl}</span>
            <span style={{ color: "#94a3b8" }}>{a.score}/100</span>
          </div>
          <div style={{ background: "#0f172a", borderRadius: 8, height: 10, marginBottom: 10, overflow: "hidden" }}>
            <div style={{ width: a.score + "%", height: "100%", background: col, borderRadius: 8, transition: "width 0.3s" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {[["Length", pwd.length + " chars", "#38bdf8"],["Entropy", a.entropy + " bits", "#a78bfa"],["Crack Time", a.crackTime, col]].map(([n, v, c]) => (
              <div key={n} style={{ background: "#0f172a", borderRadius: 7, padding: 9, gridColumn: n === "Crack Time" ? "span 2" : undefined }}>
                <div style={{ fontSize: 10, color: "#64748b" }}>{n}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {a.tips.length > 0 && <div style={{ background: "#1e3a5f", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 5, color: "#7dd3fc", fontSize: 12 }}>💡 Improvements:</div>
          {a.tips.map((t, i) => <div key={i} style={{ color: "#94a3b8", fontSize: 12, marginBottom: 1 }}>• {t}</div>)}
        </div>}
      </>}
    </div>
  );
}

const PHISHING = [
  { msg: "URGENT: Your bank account SUSPENDED! Click NOW: http://b4nk-secure.ru/login", legit: false, red: ["ALL CAPS urgency", "Suspicious .ru domain", "Misspelled 'b4nk'"] },
  { msg: "Hi, your Amazon order #123-456 has shipped! Track at amazon.com/tracking", legit: true, red: [] },
  { msg: "Congratulations!! You won $5,000,000!! Send us your SSN to claim your prize!!", legit: false, red: ["Too good to be true", "Asking for SSN", "Multiple !!!"] },
  { msg: "Your password was recently changed. If this wasn't you, contact support at apple.com/support", legit: true, red: [] },
  { msg: "Dear valued customer, verify your PayPal at: paypa1-secure-login.xyz", legit: false, red: ["'paypa1' (1 vs l)", "Suspicious .xyz domain", "Generic greeting"] },
  { msg: "GitHub: A new sign-in to your account from Chrome on Windows. If this was you, no action is needed.", legit: true, red: [] },
  { msg: "Netflix: Your payment failed. Update your card in 24h or lose access: netflix-billing-update.com", legit: false, red: ["Fake look-alike domain", "Countdown pressure (24h)", "Netflix never uses odd domains"] },
  { msg: "IT HELPDESK: Your mailbox is FULL. Re-verify your password now: http://bit.ly/re-verify", legit: false, red: ["Shortened hidden link", "Real IT never asks for your password", "Urgency + fear"] },
  { msg: "Your UPS package 1Z9999 is out for delivery today. Track it in the UPS app.", legit: true, red: [] },
  { msg: "Hi, it's the CEO. I'm in a meeting — quietly buy 5 x $100 gift cards and text me the codes. Keep this confidential.", legit: false, red: ["Gift-card request = classic scam", "Secrecy demand", "Impersonating an executive (BEC attack)"] },
];
function SocialEngineering({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const m = PHISHING[idx];
  const guess = legit => {
    if (fb) return;
    setFb(legit === m.legit ? "correct" : "wrong");
    if (legit === m.legit) setScore(s => s + 1);
  };
  const next = () => { setIdx(i => (i + 1) % PHISHING.length); setFb(null); };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#1a1a2e,#16213e)", padding: 18, color: "white" }}>
      <button onClick={onBack} style={{ color: "#f59e0b", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#f59e0b", marginBottom: 8 }}>🎭 Social Engineering</h1>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⭐ {score} | {idx + 1}/{PHISHING.length}</div>
      <div style={{ background: "#1e293b", borderRadius: 14, padding: 18, marginBottom: 12, border: "1px solid #334155" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>📧 Message received:</div>
        <div style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.6, fontStyle: "italic" }}>"{m.msg}"</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button onClick={() => guess(true)} style={{ ...btn("#15803d"), flex: 1, fontSize: 15, padding: 12 }}>✅ Legit</button>
        <button onClick={() => guess(false)} style={{ ...btn("#dc2626"), flex: 1, fontSize: 15, padding: 12 }}>🎣 Phishing!</button>
      </div>
      {fb && <div style={{ background: fb === "correct" ? "#14532d" : "#450a0a", borderRadius: 10, padding: 14 }}>
        {fb === "correct" ? "✅ Correct!" : "❌ Watch out!"}
        {!m.legit && m.red.length > 0 && <div style={{ marginTop: 6 }}>
          <div style={{ fontWeight: 700, color: "#fca5a5", fontSize: 12 }}>🚩 Red flags:</div>
          {m.red.map((r, i) => <div key={i} style={{ color: "#fca5a5", fontSize: 11 }}>• {r}</div>)}
        </div>}
        {m.legit && <div style={{ color: "#86efac", fontSize: 12, marginTop: 3 }}>No red flags — this one was real!</div>}
        <button onClick={next} style={{ ...btn("#334155"), marginTop: 7, fontSize: 11 }}>Next →</button>
      </div>}
    </div>
  );
}

function PacketInspector({ onBack }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "You Type a URL", icon: "🖥️", desc: "You type 'https://google.com' in your browser.", detail: "Your request hasn't gone anywhere yet. It's just in your browser's memory." },
    { title: "DNS Lookup", icon: "📋", desc: "Your computer asks a DNS server: 'What is Google's IP address?'", detail: "DNS (Domain Name System) is like a phone book. google.com → 142.250.80.46" },
    { title: "TCP Handshake", icon: "🤝", desc: "Your computer and Google's server do a 3-way handshake to connect.", detail: "SYN → SYN-ACK → ACK. This ensures both sides are ready before data flows." },
    { title: "HTTP Request Sent", icon: "📤", desc: "Your browser sends an HTTP GET request packet to Google.", detail: "The packet has your IP, destination IP, port 443, and request headers." },
    { title: "Routers Forward It", icon: "🗺️", desc: "Your packet hops through 10-20 routers across the internet.", detail: "Each router looks at the destination IP and picks the best next hop." },
    { title: "Server Responds", icon: "📥", desc: "Google sends back the webpage in multiple numbered packets.", detail: "Large responses split into many packets, each numbered for reassembly." },
    { title: "TCP Reassembles", icon: "🧩", desc: "Your computer reassembles packets in the correct order.", detail: "If any packets are lost, TCP requests them to be resent. This is reliability!" },
    { title: "Browser Renders", icon: "🌐", desc: "Your browser interprets HTML/CSS/JS and draws the page!", detail: "The whole process took ~50-200ms — faster than the blink of an eye!" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#1e3a5f)", padding: 18, color: "white" }}>
      <button onClick={onBack} style={{ color: "#38bdf8", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#38bdf8", marginBottom: 4 }}>📦 Packet Inspector</h1>
      <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 12 }}>Watch how data travels across the internet step by step!</p>
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {steps.map((_, i) => (
          <div key={i} onClick={() => setStep(i)} style={{ width: 30, height: 30, borderRadius: 8, background: i === step ? "#0ea5e9" : i < step ? "#14532d" : "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, cursor: "pointer", color: i === step ? "white" : i < step ? "#4ade80" : "#64748b", border: i === step ? "2px solid #38bdf8" : "1px solid #334155" }}>{i + 1}</div>
        ))}
      </div>
      <div style={{ background: "#1e293b", borderRadius: 16, padding: 20, flex: 1, marginBottom: 12 }}>
        <div style={{ fontSize: 44, textAlign: "center", marginBottom: 10 }}>{steps[step].icon}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#7dd3fc", marginBottom: 8, textAlign: "center" }}>Step {step + 1}: {steps[step].title}</div>
        <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, marginBottom: 12, textAlign: "center" }}>{steps[step].desc}</div>
        <div style={{ background: "#0f172a", borderRadius: 10, padding: 12, border: "1px solid #334155" }}>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>💡 Under the hood:</div>
          <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>{steps[step].detail}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{ ...btn(step === 0 ? "#1e293b" : "#0369a1"), flex: 1 }}>← Previous</button>
        <button onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1} style={{ ...btn(step === steps.length - 1 ? "#1e293b" : "#0369a1"), flex: 1 }}>Next →</button>
      </div>
      <div style={{ textAlign: "center", marginTop: 6, color: "#64748b", fontSize: 11 }}>{step + 1} / {steps.length}</div>
    </div>
  );
}

function EncryptionWorkshop({ onBack }) {
  const [tab, setTab] = useState("cipher");
  const [msg, setMsg] = useState("Hello Secret");
  const [key, setKey] = useState(7);
  const caesar = (str, k) => str.split("").map(c => {
    if (!/[a-zA-Z]/.test(c)) return c;
    const base = c.charCodeAt(0) < 91 ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + k) % 26) + base);
  }).join("");
  const encoded = caesar(msg, key);
  const decoded = caesar(encoded, 26 - key);
  const CONCEPTS = [
    { title: "Symmetric", icon: "🔑", desc: "Same key to encrypt and decrypt. Like a lockbox — whoever has the key can open it.", ex: "AES-256 — used for HTTPS, file encryption" },
    { title: "Asymmetric", icon: "🔏", desc: "Public key (anyone encrypts) + private key (only you decrypt).", ex: "RSA — used for SSL certificates and email signing" },
    { title: "Hash Functions", icon: "#️⃣", desc: "One-way transformation. Can't be reversed. Used to store passwords safely.", ex: "SHA-256, bcrypt — 'abc123' → 'a665a45920422f9d...'" },
    { title: "TLS/SSL", icon: "🌐", desc: "Combines asymmetric key exchange + symmetric speed to secure the web.", ex: "HTTPS — look for the padlock in your browser!" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#1e1b4b,#0f172a)", padding: 18, color: "white" }}>
      <button onClick={onBack} style={{ color: "#a5b4fc", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#a5b4fc", marginBottom: 10 }}>🔒 Encryption Workshop</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setTab("cipher")} style={btn(tab === "cipher" ? "#6366f1" : "#1e293b")}>🔑 Caesar Cipher</button>
        <button onClick={() => setTab("concepts")} style={btn(tab === "concepts" ? "#6366f1" : "#1e293b")}>📚 Concepts</button>
      </div>
      {tab === "cipher" && <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>Message:</div>
        <input value={msg} onChange={e => setMsg(e.target.value)} style={{ ...inputStyle, background: "#0f172a", color: "white", border: "1px solid #334155", fontFamily: "monospace", marginBottom: 10 }} />
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>Shift Key: {key}</div>
        <input type="range" min={1} max={25} value={key} onChange={e => setKey(+e.target.value)} style={{ width: "100%", marginBottom: 12 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[["Original", msg, "#e2e8f0"],["🔐 Encrypted", encoded, "#a5b4fc"],["🔓 Decrypted", decoded, "#4ade80"]].map(([n, v, c]) => (
            <div key={n} style={{ background: "#0f172a", borderRadius: 8, padding: 10, gridColumn: n === "🔓 Decrypted" ? "span 2" : undefined }}>
              <div style={{ fontSize: 10, color: "#64748b" }}>{n}</div>
              <div style={{ fontSize: 14, color: c, fontFamily: "monospace", wordBreak: "break-all" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "#1e3a5f", borderRadius: 8, padding: 8, marginTop: 10, fontSize: 11, color: "#7dd3fc" }}>
          💡 Caesar cipher shifts each letter {key} positions. Real AES-256 uses a 256-bit key — unbreakable with current computers!
        </div>
      </div>}
      {tab === "concepts" && CONCEPTS.map(c => (
        <div key={c.title} style={{ background: "#1e293b", borderRadius: 12, padding: 14, marginBottom: 8, border: "1px solid #334155" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#a5b4fc", marginBottom: 4 }}>{c.icon} {c.title}</div>
          <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>{c.desc}</div>
          <div style={{ background: "#0f172a", borderRadius: 8, padding: 8, fontSize: 11, color: "#64748b" }}>Example: {c.ex}</div>
        </div>
      ))}
    </div>
  );
}

const CTF_CHALLENGES = [
  { title: "Reverse the String", desc: "A secret message was stored backwards. Can you read it?", input: "!dlroW ,olleH", type: "reverse", answer: "Hello, World!", hint: "Just reverse the characters" },
  { title: "Caesar Decrypt (ROT13)", desc: "This message was encoded with shift 13.", input: "Uryyb Unpxre!", type: "rot13", answer: "Hello Hacker!", hint: "Shift each letter 13 positions back" },
  { title: "Binary to Text", desc: "Convert this binary to ASCII text.", input: "01001000 01101001", type: "binary", answer: "Hi", hint: "8 bits = 1 character. 01001000 = 72 = 'H' in ASCII" },
  { title: "Hex to Text", desc: "Decode this hex string to find the flag.", input: "48 65 6c 6c 6f", type: "hex", answer: "Hello", hint: "Each hex pair is one character. 48 = 72 decimal = 'H'" },
  { title: "Base64 Decode", desc: "This looks like Base64 encoding. Decode it!", input: "SGVsbG8gV29ybGQh", type: "base64", answer: "Hello World!", hint: "Base64 uses letters, numbers, +, / and = padding" },
  { title: "Reverse the Flag", desc: "Read this backwards to capture the flag.", input: "galFehTerutpaC", type: "reverse", answer: "CaptureTheFlag", hint: "Reverse every character" },
  { title: "ROT13 Message", desc: "A classic ROT13-encoded phrase.", input: "Npprff Tenagrq", type: "rot13", answer: "Access Granted", hint: "ROT13: shift each letter 13 places" },
  { title: "Binary Bytes", desc: "Two ASCII bytes are hidden here.", input: "01001111 01001011", type: "binary", answer: "OK", hint: "Each 8-bit group is one letter" },
  { title: "Hex Flag", desc: "Decode the hex to reveal a word.", input: "66 6c 61 67", type: "hex", answer: "flag", hint: "0x66 = 102 = 'f'" },
  { title: "Base64 Secret", desc: "Base64 shows up everywhere in web apps and tokens.", input: "aHVudGVyMiE=", type: "base64", answer: "hunter2!", hint: "The trailing = is padding" },
];
function CTFArena({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [inp, setInp] = useState("");
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const [hint, setHint] = useState(false);
  const c = CTF_CHALLENGES[idx];
  const getSolution = () => {
    if (c.type === "reverse") return c.input.split("").reverse().join("");
    if (c.type === "rot13") return c.input.split("").map(ch => {
      if (!/[a-zA-Z]/.test(ch)) return ch;
      const base = ch.charCodeAt(0) < 91 ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
    }).join("");
    if (c.type === "binary") return c.input.split(" ").map(b => String.fromCharCode(parseInt(b, 2))).join("");
    if (c.type === "hex") return c.input.split(" ").map(h => String.fromCharCode(parseInt(h, 16))).join("");
    if (c.type === "base64") { try { return atob(c.input); } catch { return "error"; } }
    return "?";
  };
  const check = () => {
    if (inp.trim().toLowerCase() === c.answer.toLowerCase()) { setScore(s => s + 1); setFb("correct"); }
    else setFb("wrong");
  };
  const next = () => { setIdx(i => (i + 1) % CTF_CHALLENGES.length); setInp(""); setFb(null); setHint(false); };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#0a0a0a,#14532d)", padding: 18, color: "white", fontFamily: "monospace" }}>
      <button onClick={onBack} style={{ color: "#4ade80", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#4ade80", marginBottom: 4 }}>🚩 CTF Arena</h1>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⭐ {score} flags | Challenge {idx + 1}/{CTF_CHALLENGES.length}</div>
      <div style={{ background: "#0f2a0f", borderRadius: 14, padding: 18, marginBottom: 10, border: "1px solid #166534" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>🎯 {c.title}</div>
        <div style={{ color: "#86efac", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>{c.desc}</div>
        <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 12, fontSize: 15, color: "#fbbf24", wordBreak: "break-all" }}>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Encoded input:</div>
          {c.input}
        </div>
      </div>
      {hint && <div style={{ background: "#1e3a5f", borderRadius: 8, padding: 9, marginBottom: 8, color: "#7dd3fc", fontSize: 12 }}>💡 Hint: {c.hint}</div>}
      <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && check()} placeholder="Enter decoded answer..."
        style={{ ...inputStyle, background: "#0f2a0f", color: "#4ade80", border: "2px solid #166534", fontFamily: "monospace", fontSize: 15, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
        <button onClick={check} style={btn("#15803d")}>🚩 Submit Flag</button>
        <button onClick={() => setHint(true)} style={btn("#334155")}>💡 Hint</button>
        <button onClick={() => setFb("reveal:" + getSolution())} style={btn("#475569")}>👁 Reveal</button>
        <button onClick={next} style={btn("#0369a1")}>Next →</button>
      </div>
      {fb === "correct" && <div style={{ background: "#14532d", borderRadius: 8, padding: 10, color: "#4ade80", fontSize: 14 }}>🚩 FLAG CAPTURED! Great work!</div>}
      {fb === "wrong" && <div style={{ background: "#450a0a", borderRadius: 8, padding: 8, color: "#f87171", fontSize: 13 }}>Not right. Check your encoding!</div>}
      {fb && fb.startsWith("reveal") && <div style={{ background: "#1e3a5f", borderRadius: 8, padding: 10, color: "#86efac", fontSize: 14 }}>Answer: {fb.split(":")[1]}</div>}
    </div>
  );
}

const AI_BIAS_SAMPLES = [
  { prompt: "Who is a better leader?", response: "Men tend to make better leaders because they are more decisive.", bias: "Makes unsupported generalizations about gender and leadership.", type: "Gender Bias" },
  { prompt: "Describe a typical software engineer.", response: "He is probably in his 20s, enjoys gaming, and drinks lots of coffee.", bias: "Assumes male gender and reinforces stereotypes about the profession.", type: "Stereotype" },
  { prompt: "What foods are healthy?", response: "The Mediterranean diet is objectively the best diet for all humans.", bias: "Ignores cultural context, individual needs, and food access differences.", type: "Overgeneralization" },
  { prompt: "Is AI going to take all jobs?", response: "Yes, within 10 years AI will replace 90% of all human workers.", bias: "Overconfident prediction presented as fact, not an estimate.", type: "False Certainty" },
  { prompt: "Translate: 'The nurse treated the patient.'", response: "L'infirmière a traité le patient. (feminine form used)", bias: "Assuming nurses are female is gender bias — many nurses are male.", type: "Gender Bias" },
  { prompt: "Who can be a nurse?", response: "People of any gender can be excellent nurses; it depends on skill and training.", bias: "Balanced, evidence-based, no stereotype — this is a fair answer.", type: "No Bias" },
  { prompt: "Are girls good at math?", response: "Girls usually struggle more with math than boys do.", bias: "Reinforces a harmful stereotype not supported by evidence.", type: "Stereotype" },
  { prompt: "Will this startup succeed?", response: "This startup will 100% become a billion-dollar company next year.", bias: "States an uncertain prediction as absolute fact.", type: "False Certainty" },
  { prompt: "What music do teenagers like?", response: "All teenagers love pop music and hate classical.", bias: "Sweeping claim about a huge, diverse group.", type: "Overgeneralization" },
];
function AIBiasDetector({ onBack }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const s = AI_BIAS_SAMPLES[idx];
  const BIAS_TYPES = ["Gender Bias", "Stereotype", "Overgeneralization", "False Certainty", "No Bias"];
  const guess = t => {
    if (fb) return;
    setFb(t === s.type ? "correct" : "wrong:" + s.type);
    if (t === s.type) setScore(sc => sc + 1);
  };
  const next = () => { setIdx(i => (i + 1) % AI_BIAS_SAMPLES.length); setFb(null); };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(180deg,#1a1a2e,#0f172a)", padding: 18, color: "white" }}>
      <button onClick={onBack} style={{ color: "#c084fc", background: "none", border: "none", cursor: "pointer", marginBottom: 6, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#c084fc", marginBottom: 4 }}>🧠 AI Bias Detector</h1>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⭐ {score} | Sample {idx + 1}/{AI_BIAS_SAMPLES.length}</div>
      <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #4c1d95" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>User prompt:</div>
        <div style={{ color: "#c7d2fe", fontStyle: "italic", marginBottom: 10, fontSize: 13 }}>"{s.prompt}"</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>AI response:</div>
        <div style={{ background: "#0f172a", borderRadius: 8, padding: 10, color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, fontStyle: "italic" }}>"{s.response}"</div>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10 }}>What type of bias does this AI response contain?</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
        {BIAS_TYPES.map(t => (
          <button key={t} onClick={() => guess(t)} disabled={!!fb}
            style={{ ...btn(fb && t === s.type ? "#7c3aed" : "#1e293b"), textAlign: "left", fontSize: 13, padding: "10px 14px", border: "1px solid #334155" }}>
            {t}
          </button>
        ))}
      </div>
      {fb === "correct" && <div style={{ background: "#2e1065", borderRadius: 10, padding: 12, fontSize: 13, color: "#c084fc" }}>
        ✅ Correct! <strong>{s.type}</strong><br /><span style={{ color: "#a78bfa" }}>{s.bias}</span>
        <button onClick={next} style={{ ...btn("#7c3aed"), marginTop: 7, display: "block", fontSize: 11 }}>Next →</button>
      </div>}
      {fb && fb.startsWith("wrong") && <div style={{ background: "#450a0a", borderRadius: 10, padding: 12, fontSize: 13, color: "#fca5a5" }}>
        The bias type was: <strong>{fb.split(":")[1]}</strong><br /><span style={{ fontSize: 12 }}>{s.bias}</span>
        <button onClick={next} style={{ ...btn("#7c3aed"), marginTop: 7, display: "block", fontSize: 11 }}>Next →</button>
      </div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GAME CATALOG + ROUTING
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// AGE 7 — GUIDED, STEP-BY-STEP TUTORIALS
// ═══════════════════════════════════════════════════════════════
// Age 7 is the "training wheels" for the Age 8+ games. Each tutorial walks a
// child through a skill ONE spelled-out step at a time, with an example and a
// tiny thing to DO before moving on. It teaches the METHOD without spoiling the
// Age 8+ puzzles (those use different content, so discovery there stays fun).
//
// A tutorial def = { emoji, title, bg, steps:[ {teach, example?, done?, task?} ] }
//   task types:
//     (none)   → a "read" step; just Next
//     type     → { type:"type",   prompt, answer, hint? }  (kid types it)
//     choose   → { type:"choose", prompt, options:[...], answer, hint? }
function StepTutorial({ def, onBack }) {
  const [i, setI] = useState(0);        // current step number
  const [val, setVal] = useState("");   // what the child typed (type steps)
  const [ok, setOk] = useState(false);  // has THIS step been completed?
  const [note, setNote] = useState(null); // "try" → show a gentle retry hint
  const step = def.steps[i];
  const total = def.steps.length;
  const last = i === total - 1;
  const task = step.task;
  const isRead = !task;                  // read-only step needs no answer
  const canNext = ok || isRead;          // Next is unlocked once the step is done

  // Reset the per-step scratch state whenever we move to a new step.
  useEffect(() => { setVal(""); setOk(false); setNote(null); }, [i]);

  // Loose compare: ignore case and extra spaces so kids aren't punished for those.
  const norm = str => (str || "").trim().toLowerCase().replace(/\s+/g, " ");
  const checkType = () => { if (norm(val) === norm(task.answer)) { setOk(true); setNote(null); } else setNote("try"); };
  const showMe = () => { setVal(task.answer); setOk(true); setNote(null); };  // "Show me" = never stuck
  const pick = opt => { if (ok) return; if (opt === task.answer) { setOk(true); setNote(null); } else setNote("try"); };
  const next = () => { if (last) onBack && onBack(); else setI(i + 1); };

  return (
    <div style={{ minHeight: "100vh", background: def.bg || "linear-gradient(180deg,#e0f2fe,#ede9fe)", padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <BackBtn fn={onBack} />
      <h1 style={{ fontSize: 28, fontWeight: 900, color: "#1e3a8a", marginBottom: 4, textAlign: "center" }}>{def.emoji} {def.title}</h1>
      {/* Progress bar: green = done, blue = current, grey = upcoming */}
      <div style={{ display: "flex", gap: 5, margin: "8px 0 14px", flexWrap: "wrap", justifyContent: "center" }}>
        {def.steps.map((_, k) => (
          <div key={k} style={{ width: 22, height: 8, borderRadius: 4, background: k < i ? "#22c55e" : k === i ? "#6366f1" : "#cbd5e1" }} />
        ))}
      </div>

      <div style={{ ...card, maxWidth: 470, width: "100%", padding: 20, cursor: "default" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", marginBottom: 6 }}>STEP {i + 1} of {total}</div>
        <div style={{ fontSize: 15.5, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: (step.example || task) ? 12 : 0 }}>{step.teach}</div>

        {/* Optional worked example in a code box */}
        {step.example && <pre style={{ background: "#0f172a", color: "#4ade80", borderRadius: 8, padding: 10, fontSize: 13, whiteSpace: "pre-wrap", marginBottom: 12 }}>{step.example}</pre>}

        {/* TASK: type-it */}
        {task && task.type === "type" && (
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", marginBottom: 6 }}>👉 {task.prompt}</div>
            <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && checkType()} placeholder="Type here..." disabled={ok}
              style={{ ...inputStyle, fontFamily: "monospace", fontSize: 16, border: "2px solid " + (ok ? "#22c55e" : "#6366f1"), marginBottom: 8 }} />
            {!ok && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={checkType} style={btn("#6366f1")}>Check ✓</button>
                <button onClick={showMe} style={btn("#e5e7eb", "#374151")}>Show me</button>
              </div>
            )}
          </div>
        )}

        {/* TASK: choose-one */}
        {task && task.type === "choose" && (
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", marginBottom: 8 }}>👉 {task.prompt}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {task.options.map(o => (
                <button key={o} onClick={() => pick(o)} disabled={ok}
                  style={{ ...btn(ok && o === task.answer ? "#22c55e" : "#eef2ff", ok && o === task.answer ? "white" : "#3730a3"), textAlign: "left", fontSize: 14, padding: "10px 14px" }}>{o}</button>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {note === "try" && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>Not quite — try again{task && task.hint ? " (hint: " + task.hint + ")" : ""}, or tap “Show me”.</div>}
        {ok && <div style={{ color: "#15803d", fontSize: 15, fontWeight: 700, marginTop: 10 }}>✅ {step.done || "Great job!"}</div>}
        {/* Optional live "terminal output" shown once the step is solved */}
        {ok && step.result && <pre style={{ background: "#0a0a0a", color: "#4ade80", borderRadius: 8, padding: "8px 10px", fontSize: 14, marginTop: 8, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{step.result}</pre>}
      </div>

      <button onClick={next} disabled={!canNext}
        style={{ ...btn(canNext ? (last ? "#22c55e" : "#6366f1") : "#cbd5e1"), fontSize: 16, padding: "12px 28px", marginTop: 16 }}>
        {last ? "🎉 Finish" : "Next →"}
      </button>
    </div>
  );
}

// The 8 Age-7 tutorials. Each mirrors an Age 8+ game so kids arrive ready.
const TUTORIALS = {
  // ───────────────────────── LINUX CLASS 🐧 ─────────────────────────
  t_term: { emoji: "\ud83d\udc27", title: "Linux Class", steps: [
    { teach: "Welcome to your Linux class! \ud83d\udc27 A terminal (or 'shell') lets you control a computer by TYPING commands. Linux runs most servers, phones and the internet. We'll learn the real commands one at a time." },
    // --- WOVEN-IN "where IS this terminal, and can I use one on a tablet?" step ---
    { teach: "First: WHERE is this terminal?\n• Mac → open the 'Terminal' app\n• Windows → 'PowerShell' (or install WSL for real Linux)\n• Linux → press Ctrl+Alt+T\n• TABLET → the free 'Termux' app (Android) or 'a-Shell'/'iSH' (iOS).\nThe same commands work in ALL of them.", task: { type: "choose", prompt: "Can you use a terminal on a tablet?", options: ["Yes — apps like Termux", "No, never", "Only on paper"], answer: "Yes — apps like Termux" }, done: "A real terminal fits in your pocket! 📱" },
    { teach: "pwd means 'print working directory'. It tells you WHERE you are — which folder you're standing in.", example: "$ pwd\n/home/kid", task: { type: "type", prompt: "Type:  pwd", answer: "pwd" }, done: "You're in /home/kid." },
    { teach: "ls LISTS the files and folders where you are.", example: "$ ls\nnotes.txt   photos/   game.py", task: { type: "type", prompt: "Type:  ls", answer: "ls" }, done: "Those are your files!" },
    { teach: "Add -la to see EVERYTHING — including hidden files (they start with a dot) and extra details.", example: "$ ls -la\n-rw-r--r-- notes.txt\ndrwxr-xr-x photos/\n-rw------- .secret", task: { type: "type", prompt: "Type:  ls -la", answer: "ls -la" }, done: "Now hidden files show too." },
    { teach: "cd means 'change directory'. Move INTO a folder by naming it.", example: "$ cd photos", task: { type: "type", prompt: "Type:  cd photos", answer: "cd photos" }, done: "You walked into the photos folder." },
    { teach: "cd .. goes back UP one folder. The .. means 'the folder above me'.", example: "$ cd ..", task: { type: "type", prompt: "Type:  cd ..", answer: "cd .." }, done: "Back where you started!" },
    { teach: "mkdir MAKES a new directory (folder).", example: "$ mkdir games", task: { type: "type", prompt: "Type:  mkdir games", answer: "mkdir games" }, done: "Folder 'games' created." },
    { teach: "touch makes a new EMPTY file.", example: "$ touch todo.txt", task: { type: "type", prompt: "Type:  touch todo.txt", answer: "touch todo.txt" }, done: "Empty file made!" },
    { teach: "echo prints text back to you.", example: "$ echo Hello\nHello", task: { type: "type", prompt: "Type:  echo Hello", answer: "echo Hello" }, done: "It echoed your words." },
    { teach: "The > arrow SENDS text INTO a file. This WRITES the word Hi into note.txt.", example: "$ echo Hi > note.txt", task: { type: "type", prompt: "Type:  echo Hi > note.txt", answer: "echo Hi > note.txt" }, done: "You saved text to a file!" },
    { teach: "cat shows what's INSIDE a file.", example: "$ cat note.txt\nHi", task: { type: "type", prompt: "Type:  cat note.txt", answer: "cat note.txt" }, done: "You read the file." },
    { teach: "cp COPIES a file — copy an old name to a new name.", example: "$ cp note.txt backup.txt", task: { type: "type", prompt: "Type:  cp note.txt backup.txt", answer: "cp note.txt backup.txt" }, done: "Copied!" },
    { teach: "mv MOVES or RENAMES a file.", example: "$ mv note.txt notes.txt", task: { type: "type", prompt: "Type:  mv note.txt notes.txt", answer: "mv note.txt notes.txt" }, done: "Renamed note.txt \u2192 notes.txt." },
    { teach: "rm REMOVES (deletes) a file. Be careful — there's no trash bin to undo it!", example: "$ rm backup.txt", task: { type: "type", prompt: "Type:  rm backup.txt", answer: "rm backup.txt" }, done: "Deleted." },
    { teach: "grep SEARCHES inside a file for a word and shows the matching line.", example: "$ grep cat notes.txt\nI have a cat", task: { type: "type", prompt: "Type:  grep cat notes.txt", answer: "grep cat notes.txt" }, done: "Found the match!" },
    { teach: "wc counts things. wc -w counts the WORDS in a file.", example: "$ wc -w notes.txt\n5", task: { type: "type", prompt: "Type:  wc -w notes.txt", answer: "wc -w notes.txt" }, done: "Counted the words." },
    { teach: "The | 'pipe' sends one command's output straight INTO another. Example:  ls | grep .py  lists files, then keeps only the Python ones.", task: { type: "choose", prompt: "What does the | pipe do?", options: ["Deletes a file", "Sends output into the next command", "Prints the date"], answer: "Sends output into the next command" }, done: "Pipes chain commands together!" },
    { teach: "Files have PERMISSIONS: who can read, write, or run them. chmod changes them. 755 is a common way to make a file runnable.", example: "$ chmod 755 game.py", task: { type: "type", prompt: "Type:  chmod 755 game.py", answer: "chmod 755 game.py" }, done: "Now it can be run." },
    { teach: "Quick recap of your new powers!", task: { type: "choose", prompt: "Which command DELETES a file?", options: ["rm", "cat", "mkdir"], answer: "rm" }, done: "Yes — rm removes." },
    { teach: "\ud83c\udf89 You took a real Linux class! You now know pwd, ls, cd, mkdir, touch, echo, cat, cp, mv, rm, grep, wc, chmod and pipes. In Age 8+ 'Terminal Pro' and 'Linux Deep Dive' you'll use them for real — and hunt hidden flags!", done: "Class complete!" },
  ]},

  // ───────────────────────── PYTHON CLASS 🐍 ─────────────────────────
  t_py: { emoji: "\ud83d\udc0d", title: "Python Class", steps: [
    { teach: "Welcome to Python class! \ud83d\udc0d Python is a real language used for games, websites, science and AI. First, let's learn how programs are MADE and RUN." },
    { teach: "The whole process:\n1) Write your code in a file that ends in .py  (like hello.py)\n2) Open a terminal\n3) Run it by typing:  python hello.py\nThe computer then does each line, top to bottom.", done: "Write a .py file, then run it with python!" },
    // --- WOVEN-IN "how do I actually run a .py on MY machine?" steps ---
    { teach: "First you need Python ON your computer. Good news:\n• Mac and Linux → it's usually ALREADY installed.\n• Windows → get it free at python.org (tick 'Add Python to PATH' while installing).", task: { type: "choose", prompt: "Where do Windows users get Python?", options: ["python.org", "the toy store", "you can't"], answer: "python.org" }, done: "Python is a free download!" },
    { teach: "Next you open a TERMINAL — the typing window where scripts run:\n• Windows → search 'PowerShell'\n• Mac → open the 'Terminal' app\n• Linux → press Ctrl+Alt+T\nThat black window is where you'll type your python command.", done: "The terminal is where python runs your file." },
    { teach: "Can you run Python on a TABLET? YES — no computer needed:\n• Android → the free app 'Pydroid 3'\n• iPad / iPhone → 'a-Shell' or 'Pythonista'\n• ANY device → a website like replit.com or programiz.com runs Python right in your browser.", task: { type: "choose", prompt: "Which runs Python with NO install, on any device?", options: ["a website like replit.com", "a paper notebook", "the TV remote"], answer: "a website like replit.com" }, done: "Tablets can code too! 📱" },
    { teach: "Let's practise the RUN command. Pretend you saved a file called hello.py.", example: "$ python hello.py\nHello!", task: { type: "type", prompt: "Type the command that runs it:", answer: "python hello.py", hint: "python, a space, then the file name" }, done: "That's how every script is launched!" },
    { teach: "print() shows text on the screen. Text goes inside quotes.", example: 'print("Hello!")', task: { type: "type", prompt: 'Type:  print("Hello!")', answer: 'print("Hello!")', hint: 'print then ( then "Hello!" then )' }, result: "\u2192 Hello!", done: "Your program can talk!" },
    { teach: "A line that starts with # is a COMMENT — a note for humans. Python ignores it when it runs.", example: '# this explains the code\nprint("Hi")  # this runs', done: "Comments explain your code." },
    { teach: "A VARIABLE is a labelled box that stores a value. Use = to put something in it.", example: "age = 7", task: { type: "type", prompt: "Type:  age = 7", answer: "age = 7" }, done: "The box 'age' now holds 7." },
    { teach: "Values have TYPES:\n\"hi\"  is a string (text)\n7  is an int (whole number)\n3.5  is a float (a decimal).", task: { type: "choose", prompt: 'What TYPE is  "cat" ?', options: ["int", "string", "float"], answer: "string" }, done: "Text = a string!" },
    { teach: "Python does math with  +  -  *  /  . The * means multiply.", example: "print(2 * 3)", task: { type: "type", prompt: "Type:  print(2 * 3)", answer: "print(2 * 3)" }, result: "\u2192 6", done: "A calculator in one line!" },
    { teach: "input() PAUSES the program and lets the user type. You can store what they type:", example: 'name = input("Your name? ")\nprint("Hi " + name)', done: "input() makes programs interactive." },
    { teach: "input() always gives back TEXT. To do math with it, turn it into a number with int():", example: 'age = int(input("Age? "))', done: "int() turns the text '7' into the number 7." },
    { teach: "if runs code ONLY when something is true. Notice the : at the end and the indented line under it.", example: 'score = 10\nif score > 5:\n    print("You win!")', task: { type: "type", prompt: "Type the compare line (score over 5):", answer: "if score > 5:", hint: "if  score  >  5  then a colon :" }, result: "\u2192 You win!", done: "if makes decisions!" },
    { teach: "Careful:  =  STORES a value, but  ==  CHECKS if two things are equal.", task: { type: "choose", prompt: "Which one CHECKS if a equals 5?", options: ["a = 5", "a == 5"], answer: "a == 5" }, done: "Double == compares!" },
    { teach: "Add more choices with elif (else-if) and else:", example: 'if age < 13:\n    print("kid")\nelif age < 20:\n    print("teen")\nelse:\n    print("adult")', done: "if / elif / else = a full decision tree." },
    { teach: "A for loop repeats. range(3) counts 0, 1, 2.", example: "for i in range(3):\n    print(i)\n\u2192 0\n1\n2", task: { type: "type", prompt: "Type the loop line for range(3):", answer: "for i in range(3):", hint: "for  i  in  range(3)  then a colon" }, done: "Loops repeat work for you!" },
    { teach: "A while loop repeats until a condition stops it. A LIST holds many values, and counting starts at 0:", example: 'fruits = ["apple", "pear"]\nprint(fruits[0])   # apple', done: "Lists store collections; indexes start at 0." },
    { teach: "A FUNCTION is a reusable mini-program you name with def:", example: 'def greet(name):\n    print("Hi " + name)\n\ngreet("Sam")   # \u2192 Hi Sam', done: "Functions = reusable blocks of code." },
    { teach: "\ud83c\udf89 You learned the Python PROCESS and the basics: writing a .py file, running it, print, comments, variables, types, input, if/elif/else, loops, lists and functions. You even know how to install it and RUN a .py file on Windows, Mac, Linux OR a tablet. In Age 8+ 'Python Starter' you'll write and RUN your own scripts!", done: "Class complete!" },
  ]},

  // ───────────────────────── CIPHER CLASS 🔐 ─────────────────────────
  t_ciph: { emoji: "\ud83d\udd10", title: "Cipher Class", steps: [
    { teach: "Welcome to Cipher class! \ud83d\udd10 A cipher hides a secret message. A KEY tells you HOW it was hidden. Today we'll MAKE secret messages and REVERSE them — using terminal commands!" },
    { teach: "The Caesar cipher SHIFTS each letter forward by the key.\nKey 3:  A\u2192D, B\u2192E, C\u2192F \u2026 and it wraps around: X\u2192A.", done: "Shift by the key number." },
    { teach: "Let's shift CAT by 3 in our heads:  C\u2192F,  A\u2192D,  T\u2192W.", example: "CAT + 3 = ?", task: { type: "type", prompt: "Type the coded word:", answer: "FDW", hint: "C\u2192F, A\u2192D, T\u2192W" }, done: "CAT becomes FDW!" },
    { teach: "Shifting by hand is slow. The terminal can do it instantly! In 'Terminal Pro' or 'Linux Deep Dive' you can type these cipher commands.", done: "Let the computer do the shifting." },
    { teach: "Encode the word hello with key 3 using the caesar command.", task: { type: "type", prompt: "Type:  caesar 3 hello", answer: "caesar 3 hello" }, result: "\u2192 khoor", done: "hello \u2192 khoor \ud83c\udf89" },
    { teach: "To REVERSE it, use caesar -d with the SAME key. The -d means 'decode'.", task: { type: "type", prompt: "Type:  caesar -d 3 khoor", answer: "caesar -d 3 khoor" }, result: "\u2192 hello", done: "khoor \u2192 hello. You reversed it!" },
    { teach: "The key is the whole secret.", task: { type: "choose", prompt: "To DECODE a Caesar message you must know\u2026", options: ["nothing", "the key (the shift number)", "the file name"], answer: "the key (the shift number)" }, done: "The same key locks and unlocks." },
    { teach: "ROT13 is just Caesar with key 13. Fun fact: running it TWICE brings your text back! Encode Hello.", task: { type: "type", prompt: "Type:  rot13 Hello", answer: "rot13 Hello" }, result: "\u2192 Uryyb", done: "Hello \u2192 Uryyb. rot13 it again \u2192 Hello!" },
    { teach: "Atbash MIRRORS the alphabet: A\u2194Z, B\u2194Y \u2026 It is its own decoder.", task: { type: "type", prompt: "Type:  atbash hello", answer: "atbash hello" }, result: "\u2192 svool", done: "hello \u2192 svool (a mirror image)." },
    { teach: "reverse simply flips the text backwards.", task: { type: "type", prompt: "Type:  reverse hello", answer: "reverse hello" }, result: "\u2192 olleh", done: "hello \u2192 olleh!" },
    { teach: "Base64 re-writes text using letters, numbers and =. IMPORTANT: it's ENCODING (anyone can undo it), NOT secret encryption.", example: "base64 hi        \u2192 aGk=\nbase64 -d aGk=   \u2192 hi", done: "Base64 hides the look, not the secret." },
    { teach: "Now MAKE your very own secret! Encode the word attack with key 3.", task: { type: "type", prompt: "Type:  caesar 3 attack", answer: "caesar 3 attack" }, result: "\u2192 dwwdfn", done: "Your secret message is dwwdfn!" },
    { teach: "A friend with the key can decode it. Reverse your secret:", task: { type: "type", prompt: "Type:  caesar -d 3 dwwdfn", answer: "caesar -d 3 dwwdfn" }, result: "\u2192 attack", done: "Decoded back to attack!" },
    { teach: "\ud83c\udf89 You can now MAKE and REVERSE ciphers with caesar, rot13, atbash, reverse and base64! In Age 8+ 'CTF Arena', 'Cipher Lab' and 'Encryption Workshop' you'll crack real hidden messages.", done: "Class complete!" },
  ]},

  // ───────────────────────── HTML CLASS 📄 ─────────────────────────
  t_html: { emoji: "\ud83d\udcc4", title: "HTML Class", steps: [
    { teach: "Welcome to HTML class! \ud83d\udcc4 Web pages are built with HTML. It uses TAGS inside < > to label the parts of a page." },
    { teach: "Most tags come in PAIRS — an opener and a closer with a slash:\n\n<p>Hello</p>\n\n<p> starts a paragraph, </p> ends it.", done: "Openers and closers!" },
    { teach: "A big title uses the h1 tag.", example: "<h1>My Page</h1>", task: { type: "type", prompt: "Type:  <h1>Hi</h1>", answer: "<h1>Hi</h1>", hint: "<h1> then Hi then </h1>" }, done: "That's a big heading!" },
    { teach: "A paragraph of text uses the p tag.", example: "<p>Welcome to my page.</p>", task: { type: "type", prompt: "Type:  <p>Hi</p>", answer: "<p>Hi</p>" }, done: "That's a paragraph!" },
    { teach: "Lists use <ul> (the list) with <li> items inside it.", example: "<ul>\n  <li>Pizza</li>\n  <li>Code</li>\n</ul>", task: { type: "choose", prompt: "Which tag starts a bullet LIST?", options: ["<ul>", "<p>", "<h1>"], answer: "<ul>" }, done: "<ul> holds the list!" },
    { teach: "Some tags carry extra info called ATTRIBUTES:\n\n<a href=\"cats.html\">Cats</a>  makes a link.\n<img src=\"cat.jpg\">  shows a picture.", done: "Attributes add details like links and images." },
    { teach: "Make text bold with the strong tag.", example: "<strong>Important!</strong>", task: { type: "type", prompt: "Type:  <strong>Bold</strong>", answer: "<strong>Bold</strong>" }, done: "Nice and bold!" },
    // --- WOVEN-IN "how do I SEE my page on my own machine?" steps ---
    { teach: "So how do you actually SEE your page? Put your tags in a plain text file and SAVE it with a name ending in .html — like index.html. The .html is what turns text into a web page.", task: { type: "choose", prompt: "What must the file name END with to be a web page?", options: [".html", ".mp3", ".jpg"], answer: ".html" }, done: "index.html is a web page file!" },
    { teach: "Now 'deploy it locally' — that just means open it on YOUR OWN computer. Simply DOUBLE-CLICK index.html. It opens in your web browser (Chrome, Safari, Edge…) and shows your page. No internet or server needed!", done: "Double-click = your page runs locally." },
    { teach: "See changes in REAL TIME: keep the file open in a text editor AND open in the browser. Edit a tag → SAVE the file → click REFRESH (↻) in the browser. Your change appears instantly.\n\nEdit → Save → Refresh is the whole live-building loop.", task: { type: "choose", prompt: "After you edit and save, how do you see the change?", options: ["Refresh the browser (↻)", "Restart the computer", "Print it"], answer: "Refresh the browser (↻)" }, done: "Edit, save, refresh — live web building!" },
    { teach: "On a TABLET (there's no double-click)? Use a free online editor like CodePen.io or JSFiddle.net — you type HTML on one side and the live page appears on the other, instantly. Or a code-editor app like 'Koder' (iOS) / 'Acode' (Android).", task: { type: "choose", prompt: "Which shows your HTML page live on a tablet?", options: ["CodePen.io", "the calculator", "the flashlight"], answer: "CodePen.io" }, done: "You can build web pages on a tablet! 📱" },
    { teach: "\ud83c\udf89 You know tags, pairs, headings, paragraphs, lists, links, images and bold text! You can even SAVE index.html, open it in a browser, and refresh to see it live — on a computer OR a tablet! In Age 8+ 'HTML Builder' you'll type HTML and watch a REAL page appear live.", done: "Class complete!" },
  ]},

  // ───────────────────────── BINARY CLASS 🔢 ─────────────────────────
  t_bin: { emoji: "\ud83d\udd22", title: "Binary Class", steps: [
    { teach: "Welcome to Binary class! \ud83d\udd22 Computers only understand ON (1) and OFF (0). Counting with just 1s and 0s is called BINARY (base-2)." },
    { teach: "Each spot DOUBLES in value:  8  4  2  1.\nTurn a spot ON (1) to add its number in.", example: "place:  8 4 2 1\nbits:   0 1 0 1  = 4 + 1 = 5", done: "Add up the ON spots!" },
    { teach: "Let's READ a binary number together.", task: { type: "choose", prompt: "What is  0 0 1 1 ?   (places 8 4 2 1)", options: ["3 (2+1)", "5", "8"], answer: "3 (2+1)" }, done: "Right! 2 + 1 = 3." },
    { teach: "Now let's WRITE one. To make 5, remember 5 = 4 + 1, so turn ON the 4 and the 1.", example: "place:  4 2 1\nwant:   ? ? ?   = 5", task: { type: "type", prompt: "Type the 3 bits for 5:", answer: "101", hint: "4 is ON, 2 is OFF, 1 is ON" }, done: "101 = 5. You did it!" },
    { teach: "8 bits together are called a BYTE. One byte can store a letter — the letter A is 01000001.", task: { type: "choose", prompt: "How many bits are in a byte?", options: ["4", "8", "10"], answer: "8" }, done: "8 bits = 1 byte!" },
    { teach: "Counting in binary looks like this:", example: "0 = 0\n1 = 1\n2 = 10\n3 = 11\n4 = 100", task: { type: "choose", prompt: "What is 2 in binary?", options: ["10", "2", "11"], answer: "10" }, done: "After 1 comes 10!" },
    { teach: "\ud83c\udf89 You can READ and WRITE binary, and you know a byte is 8 bits! In Age 8+ 'Binary Basics' and 'Binary & Hex Lab' you'll convert bigger numbers and meet HEX.", done: "Class complete!" },
  ]},

  // ───────────────────────── SQL CLASS 🗄️ ─────────────────────────
  t_sql: { emoji: "\ud83d\uddc4\ufe0f", title: "SQL Class", steps: [
    { teach: "Welcome to SQL class! \ud83d\uddc4\ufe0f A database keeps information in TABLES (like a spreadsheet, with rows and columns). We ask it questions using SQL." },
    { teach: "The magic word is SELECT. This asks for ALL rows and columns from a table called users. The * means 'everything'.", example: "SELECT * FROM users", done: "SELECT gets data!" },
    { teach: "Your turn — ask for everything in the users table.", example: "SELECT * FROM users", task: { type: "type", prompt: "Type:  SELECT * FROM users", answer: "SELECT * FROM users", hint: "SELECT  *  FROM  users" }, done: "You queried a database!" },
    { teach: "Instead of *, you can pick only the COLUMNS you want.", example: "SELECT name, age FROM users", task: { type: "type", prompt: "Type:  SELECT name FROM users", answer: "SELECT name FROM users" }, done: "Just the names!" },
    { teach: "WHERE keeps only the rows that match a condition.", example: "SELECT * FROM users WHERE city = 'NYC'", task: { type: "choose", prompt: "Which word FILTERS the rows?", options: ["SELECT", "WHERE", "FROM"], answer: "WHERE" }, done: "WHERE filters!" },
    { teach: "Two more helpers:\nORDER BY age  sorts the rows.\nLIMIT 3  shows only the first 3.", example: "SELECT * FROM users ORDER BY age LIMIT 3", done: "Sort and limit your results." },
    { teach: "\ud83c\udf89 You know SELECT, columns, WHERE, ORDER BY and LIMIT! In Age 8+ 'SQL Intro' you'll run real queries on a live table.", done: "Class complete!" },
  ]},

  // ───────────────────────── REGEX CLASS 🔍 ─────────────────────────
  t_regex: { emoji: "\ud83d\udd0d", title: "Regex Class", steps: [
    { teach: "Welcome to Regex class! \ud83d\udd0d A regex is a mini-pattern for FINDING text. It's like a super-smart search box that apps use everywhere." },
    // --- WOVEN-IN "what is it FOR, WHERE do I type it, is it Linux-only?" steps ---
    { teach: "What is regex FOR? Three big jobs:\n1) FIND text that fits a shape (grab every phone number)\n2) CHECK if something is valid (is this a real email?)\n3) REPLACE lots of things at once.", task: { type: "choose", prompt: "Which is a job regex does?", options: ["Find text that fits a pattern", "Charge your phone", "Bake bread"], answer: "Find text that fits a pattern" }, done: "Find, check, replace — all by pattern!" },
    { teach: "WHERE do you actually type a regex? Lots of places:\n• the Find/Search box of code editors (VS Code, Notepad++)\n• the grep command in a terminal\n• INSIDE real code — Python, JavaScript, Java… almost every language\n• many website search bars.", task: { type: "choose", prompt: "Where is regex used?", options: ["a code editor's Find box", "a microwave", "a shoe"], answer: "a code editor's Find box" }, done: "It lives inside tools and code everywhere." },
    { teach: "Is regex ONLY on Linux? NO — that's a myth! The grep COMMAND is a Linux tool, but regex ITSELF works on Windows, Mac, phones, and right inside your web browser. It's a mini-language built into tools on EVERY system.", task: { type: "choose", prompt: "Is regex Linux-only?", options: ["No — it works everywhere", "Yes, Linux only", "Only on paper"], answer: "No — it works everywhere" }, done: "Regex is everywhere, not just Linux!" },
    { teach: "Some pattern pieces:\n\\d = any digit (0-9)\n\\w = any letter or number\n. = any single character", done: "Symbols stand for KINDS of characters!" },
    { teach: "Let's pick the right piece.", task: { type: "choose", prompt: "Which one matches any DIGIT?", options: ["\\d", "\\w", "."], answer: "\\d" }, done: "Yes! \\d means a digit." },
    { teach: "Add a + to mean 'one or more'. So \\d+ matches a whole number like 123.", example: "\\d+  matches  42  in  'code 42'", task: { type: "type", prompt: "Type a pattern for one-or-more digits:", answer: "\\d+", hint: "\\d then a + sign" }, done: "\\d+ finds numbers!" },
    { teach: "More power:\n[abc] matches a, b OR c.\n{3} means exactly 3 of the thing before it.\n* means zero-or-more.", task: { type: "choose", prompt: "Which matches the letter a, b, OR c?", options: ["[abc]", "\\d", "."], answer: "[abc]" }, done: "Square brackets = a choice!" },
    { teach: "FLAGS go after the pattern:\ng = find ALL matches (not just the first)\ni = ignore CAPITAL vs small letters.", example: "/[aeiou]/gi  finds every vowel, big or small", done: "g = global, i = ignore-case." },
    { teach: "Want to PLAY with regex right now, on ANY device? Open regex101.com in a browser. Type a pattern up top and some text below — it highlights every match live AND explains your pattern piece by piece.", done: "regex101.com = a live regex playground. 📱" },
    { teach: "\ud83c\udf89 You can build real patterns with \\d, \\w, +, [abc], {n} and flags! You also know it works on ANY system (not just Linux) and where to type it. In Age 8+ 'Regex Ranger' you'll match trickier text like emails and hashtags.", done: "Class complete!" },
  ]},

  // ───────────────────────── DECODE CLASS 🚩 (capstone) ─────────────
  t_ctf: { emoji: "\ud83d\udea9", title: "Decode Class", steps: [
    { teach: "Welcome to the Decode capstone! \ud83d\udea9 Hackers-in-training play Capture-The-Flag: solve a puzzle to reveal a hidden 'flag'. You'll use everything you learned." },
    { teach: "Some messages are just written BACKWARDS. Read this one backwards:  !iH", example: "!iH  \u2192  ?", task: { type: "type", prompt: "Type the real message:", answer: "Hi!", hint: "read it right-to-left: H i !" }, done: "You reversed it!" },
    { teach: "Base64 hides text with letters, numbers and often ENDS with an = sign.", task: { type: "choose", prompt: "Which symbol often ends a Base64 message?", options: ["=", "#", "!"], answer: "=" }, done: "Right — the = padding!" },
    { teach: "The big idea: these are ENCODINGS you can undo without a secret key:\nReverse \u2192 read backwards\nROT13 \u2192 shift 13\nBinary/Hex \u2192 groups become letters\nBase64 \u2192 ends in =", done: "Encoding is not encryption!" },
    { teach: "Secret weapon: the terminal decodes for you. In 'Terminal Pro' or 'Linux Deep Dive' try:", example: "base64 -d SGk=   \u2192 Hi\nrot13 Uryyb      \u2192 Hello\nreverse !iH      \u2192 Hi!\ncaesar -d 3 khoor \u2192 hello", done: "Let the terminal crack it!" },
    { teach: "\ud83c\udf89 You're ready! In Age 8+ 'CTF Arena' you'll capture real flags by decoding reverse, ROT13, binary, hex AND Base64.", done: "Class complete!" },
  ]},
};

// ═══════════════════════════════════════════════════════════════
// SPLIT SCREEN  (two games side-by-side — a kiosk-mode power feature)
// ═══════════════════════════════════════════════════════════════
// One independent panel. It shows a mini game-picker until a game is chosen,
// then that game with its own header (Change / Lesson). Each side is separate.
// The ages that support split-screen. Any pane can load a game from any of
// these, so an Age 6 screen can pull in an Age 7/8 game, an Age 8 screen can
// pull in Age 6/7, etc. — mix and match freely.
const SPLIT_AGES = ["6", "7", "8"];

// Decide left/right vs top/bottom. On tablets/phones (narrow OR portrait) we
// stack the two panes vertically so each is wide enough to use comfortably.
function useStackLayout() {
  const calc = () => window.innerWidth < 900 || window.innerHeight > window.innerWidth;
  const [stack, setStack] = useState(calc);
  useEffect(() => {
    const on = () => setStack(calc());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
  }, []);
  return stack;
}

// One independent panel. Shows a cross-age picker until a game is chosen, then
// that game with its own header (Change / Lesson). `initial` pre-loads a game
// (used so the pane you were already playing stays put when you add a screen).
function SplitPane({ initial, onLesson }) {
  const [sel, setSel] = useState(initial || null);

  if (!sel) {
    // Picker grouped by age — you can pick ANY split-age game for this side.
    return (
      <div style={{ height: "100%", overflowY: "auto", padding: 10, background: "#0f172a" }}>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, textAlign: "center", margin: "6px 0 10px" }}>Pick a game for this side ▾</div>
        {SPLIT_AGES.map(a => (
          <div key={a} style={{ marginBottom: 10 }}>
            <div style={{ color: "#64748b", fontSize: 11, fontWeight: 800, margin: "0 0 4px 2px" }}>{AGE_META[a].emoji} {AGE_META[a].title}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(GAMES_BY_AGE[a] || []).map(g => (
                <button key={g.id} onClick={() => setSel(g.id)}
                  style={{ ...btn("#1e293b", "#e2e8f0"), display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 5px", fontSize: 10.5, lineHeight: 1.2 }}>
                  <span style={{ fontSize: 20 }}>{g.e}</span>{g.t}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const GameComp = GAME_MAP[sel];
  // Find this game's tile info across ALL split ages (it may not be `age`'s own).
  const g = SPLIT_AGES.flatMap(a => GAMES_BY_AGE[a] || []).find(x => x.id === sel);
  return (
    <div style={{ height: "100%", overflowY: "auto", position: "relative", background: "#0b1220" }}>
      {/* sticky pane header: switch game / open its lesson */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", gap: 6, alignItems: "center", background: "#0b1220", padding: "5px 8px", borderBottom: "1px solid #1e293b" }}>
        <button onClick={() => setSel(null)} style={{ ...btn("#334155", "white"), fontSize: 11, padding: "4px 8px" }}>🎮 Change</button>
        <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 700, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{g && g.e} {g && g.t}</span>
        {LESSONS[sel] && <button onClick={() => onLesson(sel)} style={{ ...btn("#7c3aed", "white"), fontSize: 11, padding: "4px 8px" }}>📚</button>}
      </div>
      {/* key={sel} makes React remount when the pane's game changes */}
      <GameComp key={sel} onBack={() => setSel(null)} />
    </div>
  );
}

// The two-pane container. `startGame` (the game you were already on) loads into
// the first pane, so entering split just ADDS a second screen. Panes are laid
// out top/bottom on tablets and side-by-side on wide screens.
function SplitView({ startGame, onExit, onLesson }) {
  const stack = useStackLayout();                    // true → top/bottom
  const divider = stack ? { borderBottom: "3px solid #000" } : { borderRight: "3px solid #000" };
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0b1220" }}>
      {/* slim top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#000", color: "white" }}>
        <button onClick={onExit} style={{ ...btn("#dc2626", "white"), fontSize: 12, padding: "5px 10px" }}>✕ Exit Split</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 13 }}>🔲 Two Games — tap 🎮 on either side to swap</div>
        <button title="Fullscreen" onClick={() => (isFS() ? document.exitFullscreen && document.exitFullscreen() : requestFS())}
          style={{ ...btn("rgba(255,255,255,0.15)", "white"), fontSize: 12, padding: "5px 8px" }}>⛶</button>
      </div>
      {/* the two panes: column (stacked) on tablets, row on wide screens */}
      <div style={{ flex: 1, display: "flex", flexDirection: stack ? "column" : "row", minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, ...divider }}><SplitPane initial={startGame} onLesson={onLesson} /></div>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}><SplitPane onLesson={onLesson} /></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BONUS GAMES  (30 colorful toys & learning games for Ages 3–5)
// ═══════════════════════════════════════════════════════════════
// Shared engines first, then 10 games per young age. Everything reuses the
// existing helpers (rnd, shuffle, btn, card, BackBtn, LETTERS).

// ── SOUND STUBS ──────────────────────────────────────────────────────────────
// A tiny Web-Audio "beeper" so games have sound with NO audio files. To swap in
// real recorded sounds later, replace the bodies of sfx.* with an <audio> play.
const _AudioCtx = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
let _actx = null;
function beep(freq = 440, dur = 0.12, type = "sine", vol = 0.2) {
  try {
    if (!_AudioCtx) return;
    if (!_actx) _actx = new _AudioCtx();               // created lazily on first tap (autoplay rules)
    const o = _actx.createOscillator(), g = _actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol; o.connect(g); g.connect(_actx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, _actx.currentTime + dur);
    o.stop(_actx.currentTime + dur);
  } catch (e) { /* audio not allowed yet — ignore */ }
}
const sfx = {
  pop:  () => beep(500 + Math.random() * 400, 0.09, "triangle", 0.25),
  tap:  () => beep(520, 0.06, "sine", 0.18),
  good: () => beep(660, 0.12, "triangle", 0.22),
  win:  () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, "triangle", 0.22), i * 110)),
  wrong:() => beep(150, 0.22, "sawtooth", 0.14),
  boing:() => beep(200, 0.16, "sine", 0.22),
  drop: () => beep(320, 0.08, "square", 0.15),
  note: n => beep(n, 0.35, "sine", 0.25),
};

// ── SHARED ANIMATION KEYFRAMES (injected once) ───────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("kt-keyframes")) {
  const st = document.createElement("style");
  st.id = "kt-keyframes";
  st.textContent =
    "@keyframes ktFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}" +
    "@keyframes ktSpin{to{transform:rotate(360deg)}}" +
    "@keyframes ktWobble{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}" +
    "@keyframes ktPop{0%{transform:scale(1);opacity:1}100%{transform:scale(2.2);opacity:0}}" +
    "@keyframes ktPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}" +
    "@keyframes ktRise{from{transform:translateY(0);opacity:1}to{transform:translateY(-70px);opacity:0}}" +
    "@keyframes ktShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}" +
    "@keyframes ktRainbow{to{filter:hue-rotate(360deg)}}" +
    "@keyframes ktBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}" +
    "@keyframes ktFlipIn{0%{transform:rotateX(-90deg);opacity:.2}60%{transform:rotateX(12deg)}100%{transform:rotateX(0);opacity:1}}" +
    "@keyframes ktFlyIn{0%{transform:translateX(-80px) scale(.4) rotate(-22deg);opacity:0}70%{transform:translateX(6px) scale(1.08) rotate(4deg);opacity:1}100%{transform:translateX(0) scale(1) rotate(0)}}";
  document.head.appendChild(st);
}

// ── requestAnimationFrame loop hook (gives dt in seconds, clamped) ───────────
function useRaf(cb, active = true) {
  const saved = useRef(cb); saved.current = cb;       // always call the latest cb
  useEffect(() => {
    if (!active) return;
    let id, last = performance.now();
    const loop = t => { const dt = Math.min((t - last) / 1000, 0.05); last = t; saved.current(dt); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

// ── Measure a container into a ref (so physics can read live width/height) ───
function useBox() {
  const ref = useRef(null);
  const dim = useRef({ w: 320, h: 440 });
  useEffect(() => {
    const m = () => { const el = ref.current; if (el) dim.current = { w: el.clientWidth, h: el.clientHeight }; };
    m(); const id = setTimeout(m, 80);
    window.addEventListener("resize", m);
    return () => { clearTimeout(id); window.removeEventListener("resize", m); };
  }, []);
  return [ref, dim];
}

// ── Little shared UI bits to keep games short ────────────────────────────────
const GTitle = ({ children, color = "#1f2937" }) => (
  <h1 style={{ fontSize: 30, fontWeight: 900, color, textAlign: "center", margin: "2px 0 8px" }}>{children}</h1>
);
const GScore = ({ n, label = "⭐" }) => (
  <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 10, color: "#334151" }}>{label} {n}</div>
);
// A full-screen colorful play surface.
const Stage = ({ bg, dark, onBack, children }) => (
  <div style={{ minHeight: "100vh", background: bg, padding: 16, position: "relative", overflow: "hidden" }}>
    <BackBtn fn={onBack} dark={dark} />
    {children}
  </div>
);

// A colored balloon shape (used by several games).
const Balloon = ({ c, size = 46 }) => (
  <div style={{ pointerEvents: "none" }}>
    <div style={{ width: size, height: size * 1.26, background: "radial-gradient(circle at 32% 28%, #ffffffcc, " + c + ")", borderRadius: "50% 50% 50% 50% / 60% 60% 42% 42%", boxShadow: "0 5px 12px rgba(0,0,0,.22)" }} />
    <div style={{ width: 0, height: 0, margin: "0 auto", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "8px solid " + c }} />
  </div>
);

const CANDY = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

// ═══════════════════════════════════════════════════════════════
// AGE 3 — TAP, TOUCH & TOYS
// ═══════════════════════════════════════════════════════════════

// 🎈 Balloon Pop — balloons drift up; tap to pop them.
function BalloonPop({ onBack }) {
  const [bs, setBs] = useState([]);
  const [score, setScore] = useState(0);
  const id = useRef(0);
  useRaf(dt => setBs(list => list.map(b => ({ ...b, y: b.y - b.sp * dt })).filter(b => b.y > -18)));
  useEffect(() => {
    const t = setInterval(() => setBs(list => list.length < 9
      ? [...list, { id: id.current++, x: rnd(6, 84), y: 108, sp: rnd(9, 20), c: CANDY[rnd(0, CANDY.length - 1)] }] : list), 650);
    return () => clearInterval(t);
  }, []);
  const pop = i => { setBs(l => l.filter(b => b.id !== i)); setScore(s => s + 1); sfx.pop(); };
  return (
    <Stage bg="linear-gradient(180deg,#bae6fd,#e0f2fe)" onBack={onBack}>
      <GTitle color="#0369a1">🎈 Balloon Pop</GTitle><GScore n={score} />
      {bs.map(b => (
        <div key={b.id} onPointerDown={() => pop(b.id)} style={{ position: "absolute", left: b.x + "%", top: b.y + "%", transform: "translate(-50%,0)", cursor: "pointer" }}>
          <Balloon c={b.c} />
        </div>
      ))}
    </Stage>
  );
}

// 🫧 Bubble Wrap — a grid of bubbles; tap each to pop. Reset when all popped.
function BubbleWrap({ onBack }) {
  const N = 40;
  const [popped, setPopped] = useState({});
  const count = Object.keys(popped).length;
  useEffect(() => { if (count === N) { sfx.win(); const t = setTimeout(() => setPopped({}), 900); return () => clearTimeout(t); } }, [count]);
  return (
    <Stage bg="linear-gradient(180deg,#e9d5ff,#cffafe)" onBack={onBack}>
      <GTitle color="#7c3aed">🫧 Bubble Wrap</GTitle>
      <div style={{ textAlign: "center", color: "#6b7280", marginBottom: 8 }}>Pop them all!</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8, maxWidth: 380, margin: "0 auto" }}>
        {Array.from({ length: N }).map((_, i) => (
          <div key={i} onPointerDown={() => { if (!popped[i]) { setPopped(p => ({ ...p, [i]: 1 })); sfx.pop(); } }}
            style={{ width: "100%", paddingBottom: "100%", position: "relative", cursor: "pointer" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", transition: "transform .1s",
              transform: popped[i] ? "scale(0.55)" : "scale(1)",
              background: popped[i] ? "rgba(148,163,184,.25)" : "radial-gradient(circle at 32% 30%, #fff, #a5b4fc)",
              boxShadow: popped[i] ? "inset 0 0 6px rgba(0,0,0,.2)" : "0 3px 6px rgba(0,0,0,.15)" }} />
          </div>
        ))}
      </div>
    </Stage>
  );
}

// 🌈 Color Splash — tap anywhere for an expanding splash of color. Pure fun.
function ColorSplash({ onBack }) {
  const [spots, setSpots] = useState([]);
  const id = useRef(0);
  const splash = e => {
    const c = CANDY[rnd(0, CANDY.length - 1)];
    const s = { id: id.current++, x: e.clientX, y: e.clientY, c };
    setSpots(v => [...v.slice(-24), s]); sfx.pop();
    setTimeout(() => setSpots(v => v.filter(x => x.id !== s.id)), 900);
  };
  return (
    <div onPointerDown={splash} style={{ minHeight: "100vh", background: "#0f172a", position: "relative", overflow: "hidden", touchAction: "none" }}>
      <BackBtn fn={onBack} dark />
      <div style={{ textAlign: "center", color: "#94a3b8", marginTop: 6 }}>Tap anywhere! 🌈</div>
      {spots.map(s => (
        <div key={s.id} style={{ position: "fixed", left: s.x, top: s.y, width: 20, height: 20, marginLeft: -10, marginTop: -10, borderRadius: "50%", background: s.c, animation: "ktPop .9s ease-out forwards", pointerEvents: "none" }} />
      ))}
    </div>
  );
}

// 🐾 Peekaboo — tap a box to reveal a hidden animal with a little wobble.
function Peekaboo({ onBack }) {
  const ANIMALS = ["🦊", "🐻", "🐰", "🐼", "🐸", "🦁", "🐵", "🐷", "🐨"];
  const [open, setOpen] = useState({});
  const toggle = i => { setOpen(o => ({ ...o, [i]: !o[i] })); sfx.boing(); };
  return (
    <Stage bg="linear-gradient(180deg,#fde68a,#fca5a5)" onBack={onBack}>
      <GTitle color="#b45309">🐾 Peekaboo</GTitle>
      <div style={{ textAlign: "center", color: "#7c2d12", marginBottom: 10 }}>Tap to peek!</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, maxWidth: 340, margin: "0 auto" }}>
        {ANIMALS.map((a, i) => (
          <div key={i} onPointerDown={() => toggle(i)} style={{ ...card, height: 92, display: "flex", alignItems: "center", justifyContent: "center", fontSize: open[i] ? 52 : 40, cursor: "pointer", background: open[i] ? "#fff7ed" : "#fb923c", animation: open[i] ? "ktWobble .5s" : "none" }}>
            {open[i] ? a : "❓"}
          </div>
        ))}
      </div>
    </Stage>
  );
}

// 🧱 Block Stacker — a block slides side to side; tap to drop it on the pile.
function StackBlocks({ onBack }) {
  const [box, dim] = useBox();
  const [stack, setStack] = useState([]);          // placed blocks {x,c}
  const px = useRef(0), dir = useRef(1);
  const [, tick] = useState(0);
  useRaf(dt => { px.current += dir.current * 90 * dt; const W = dim.current.w; if (px.current < 40) dir.current = 1; if (px.current > W - 40) dir.current = -1; tick(t => t + 1); });
  const drop = () => { setStack(s => [...s, { x: px.current, c: CANDY[s.length % CANDY.length] }]); sfx.drop(); };
  return (
    <Stage bg="linear-gradient(180deg,#a7f3d0,#5eead4)" onBack={onBack}>
      <GTitle color="#065f46">🧱 Block Stacker</GTitle><GScore n={stack.length} label="🏗️" />
      <div ref={box} onPointerDown={drop} style={{ position: "relative", height: "62vh", background: "#ffffff55", borderRadius: 16, overflow: "hidden", cursor: "pointer" }}>
        {/* moving block */}
        <div style={{ position: "absolute", top: 8, left: px.current - 36, width: 72, height: 30, borderRadius: 6, background: CANDY[stack.length % CANDY.length], boxShadow: "0 3px 6px rgba(0,0,0,.2)" }} />
        {/* the growing tower, from the floor up */}
        {stack.map((b, i) => (
          <div key={i} style={{ position: "absolute", bottom: i * 30, left: b.x - 36, width: 72, height: 28, borderRadius: 6, background: b.c, boxShadow: "0 2px 4px rgba(0,0,0,.2)" }} />
        ))}
      </div>
      <div style={{ textAlign: "center", color: "#065f46", marginTop: 6 }}>Tap to drop!</div>
    </Stage>
  );
}

// ⭐ Catch the Star — a star darts around; tap it to score.
function CatchStar({ onBack }) {
  const [box, dim] = useBox();
  const pos = useRef({ x: 100, y: 100, vx: 160, vy: 130 });
  const [, tick] = useState(0);
  const [score, setScore] = useState(0);
  useRaf(dt => { const p = pos.current, W = dim.current.w, H = dim.current.h; p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < 24 || p.x > W - 24) p.vx *= -1; if (p.y < 24 || p.y > H - 24) p.vy *= -1; tick(t => t + 1); });
  const hit = () => { setScore(s => s + 1); sfx.good(); const p = pos.current; p.vx = rnd(-220, 220) || 150; p.vy = rnd(-200, 200) || 120; };
  return (
    <Stage bg="linear-gradient(180deg,#1e1b4b,#4338ca)" dark onBack={onBack}>
      <GTitle color="#fde047">⭐ Catch the Star</GTitle><GScore n={score} />
      <div ref={box} style={{ position: "relative", height: "66vh", background: "#0008", borderRadius: 16, overflow: "hidden" }}>
        <div onPointerDown={hit} style={{ position: "absolute", left: pos.current.x - 26, top: pos.current.y - 26, fontSize: 52, cursor: "pointer", filter: "drop-shadow(0 0 10px #fde047)" }}>⭐</div>
      </div>
    </Stage>
  );
}

// 🎨 Finger Paint — drag across the grid to paint. Pick a color, or clear.
function FingerPaint({ onBack }) {
  const COLS = 12, ROWS = 16;
  const [cells, setCells] = useState({});
  const [c, setC] = useState(CANDY[6]);
  const down = useRef(false);
  const paint = i => setCells(m => ({ ...m, [i]: c }));
  return (
    <Stage bg="#111827" dark onBack={onBack}>
      <GTitle color="#f9a8d4">🎨 Finger Paint</GTitle>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8, flexWrap: "wrap" }}>
        {CANDY.map(col => <button key={col} onPointerDown={() => { setC(col); sfx.tap(); }} style={{ width: 30, height: 30, borderRadius: "50%", background: col, border: c === col ? "3px solid #fff" : "2px solid #0006", cursor: "pointer" }} />)}
        <button onPointerDown={() => setCells({})} style={{ ...btn("#e5e7eb", "#374151"), fontSize: 12, padding: "4px 10px" }}>Clear</button>
      </div>
      <div onPointerDown={() => { down.current = true; }} onPointerUp={() => { down.current = false; }} onPointerLeave={() => { down.current = false; }}
        style={{ display: "grid", gridTemplateColumns: "repeat(" + COLS + ",1fr)", gap: 2, maxWidth: 320, margin: "0 auto", touchAction: "none" }}>
        {Array.from({ length: COLS * ROWS }).map((_, i) => (
          <div key={i} onPointerDown={() => paint(i)} onPointerEnter={() => { if (down.current) paint(i); }}
            style={{ width: "100%", paddingBottom: "100%", background: cells[i] || "#1f2937", borderRadius: 3, position: "relative" }} />
        ))}
      </div>
    </Stage>
  );
}

// 🔵 Shape Pop — shapes appear at random spots; tap to pop for points.
function PopShapes({ onBack }) {
  const SHAPES = ["●", "▲", "★", "◆", "■", "❤"];
  const [items, setItems] = useState([]);
  const [score, setScore] = useState(0);
  const id = useRef(0);
  useEffect(() => {
    const t = setInterval(() => setItems(v => v.length < 6
      ? [...v, { id: id.current++, x: rnd(8, 82), y: rnd(22, 82), s: SHAPES[rnd(0, 5)], c: CANDY[rnd(0, CANDY.length - 1)] }] : v), 700);
    return () => clearInterval(t);
  }, []);
  const pop = i => { setItems(v => v.filter(x => x.id !== i)); setScore(s => s + 1); sfx.pop(); };
  return (
    <Stage bg="linear-gradient(180deg,#fbcfe8,#ddd6fe)" onBack={onBack}>
      <GTitle color="#be185d">🔵 Shape Pop</GTitle><GScore n={score} />
      {items.map(it => (
        <div key={it.id} onPointerDown={() => pop(it.id)} style={{ position: "absolute", left: it.x + "%", top: it.y + "%", fontSize: 56, color: it.c, cursor: "pointer", animation: "ktPulse 1.2s infinite", textShadow: "0 3px 6px rgba(0,0,0,.2)" }}>{it.s}</div>
      ))}
    </Stage>
  );
}

// 🐤 Feed the Duck — drag food to the duck's mouth (drop zone).
function FeedDuck({ onBack }) {
  const FOODS = ["🍎", "🥕", "🍞", "🌽", "🍓", "🥬"];
  const [tray, setTray] = useState(() => shuffle(FOODS).slice(0, 5).map((e, i) => ({ id: i, e })));
  const [drag, setDrag] = useState(null);
  const [fed, setFed] = useState(0);
  const [happy, setHappy] = useState(false);
  const start = (e, item) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ ...item, x: e.clientX, y: e.clientY }); };
  const move = e => { if (drag) setDrag(d => ({ ...d, x: e.clientX, y: e.clientY })); };
  const end = e => {
    if (drag) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.closest("[data-zone='duck']")) {
        setTray(t => t.filter(x => x.id !== drag.id)); setFed(f => f + 1);
        setHappy(true); sfx.good(); setTimeout(() => setHappy(false), 400);
      }
    }
    setDrag(null);
  };
  return (
    <div onPointerMove={move} onPointerUp={end} style={{ minHeight: "100vh", background: "linear-gradient(180deg,#bbf7d0,#a7f3d0)", padding: 16, touchAction: "none", position: "relative" }}>
      <BackBtn fn={onBack} />
      <GTitle color="#166534">🐤 Feed the Duck</GTitle><GScore n={fed} label="🍽️" />
      <div data-zone="duck" style={{ ...card, width: 150, height: 150, margin: "8px auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, animation: happy ? "ktPulse .4s" : "none", background: "#fef9c3" }}>🦆</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {tray.map(item => (
          <div key={item.id} onPointerDown={e => start(e, item)} style={{ fontSize: 44, cursor: "grab", visibility: drag && drag.id === item.id ? "hidden" : "visible" }}>{item.e}</div>
        ))}
      </div>
      {!tray.length && <div style={{ textAlign: "center", fontSize: 22, marginTop: 16, color: "#166534", fontWeight: 800 }}>All fed! 🎉</div>}
      {drag && <div style={{ position: "fixed", left: drag.x - 22, top: drag.y - 22, fontSize: 44, pointerEvents: "none", zIndex: 50 }}>{drag.e}</div>}
    </div>
  );
}

// 🎹 Sound Board — tap coloured keys to play musical notes.
function SoundBoard({ onBack }) {
  const NOTES = [{ n: "C", f: 261 }, { n: "D", f: 294 }, { n: "E", f: 330 }, { n: "F", f: 349 }, { n: "G", f: 392 }, { n: "A", f: 440 }, { n: "B", f: 494 }, { n: "C²", f: 523 }];
  const [lit, setLit] = useState(null);
  const play = (note, i) => { sfx.note(note.f); setLit(i); setTimeout(() => setLit(null), 200); };
  return (
    <Stage bg="linear-gradient(180deg,#0f172a,#312e81)" dark onBack={onBack}>
      <GTitle color="#a5b4fc">🎹 Sound Board</GTitle>
      <div style={{ textAlign: "center", color: "#c7d2fe", marginBottom: 14 }}>Tap the keys!</div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
        {NOTES.map((note, i) => (
          <div key={i} onPointerDown={() => play(note, i)} style={{ width: 42, height: 150, borderRadius: 10, background: CANDY[i % CANDY.length], display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 8, color: "#fff", fontWeight: 800, cursor: "pointer", transform: lit === i ? "translateY(6px) scale(0.97)" : "none", transition: "transform .1s", boxShadow: "0 6px 14px rgba(0,0,0,.3)" }}>{note.n}</div>
        ))}
      </div>
    </Stage>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGE 4 — EARLY MATH, ENGLISH & MOVEMENT
// ═══════════════════════════════════════════════════════════════

// 🔟 Count & Pop — pop EXACTLY the target number of bubbles, then check.
function CountPop({ onBack }) {
  const [target, setTarget] = useState(rnd(2, 6));
  const [popped, setPopped] = useState(0);
  const [round, setRound] = useState(0);
  const total = 9;
  const check = () => {
    if (popped === target) { sfx.win(); setTarget(rnd(2, 8)); setPopped(0); setRound(r => r + 1); }
    else { sfx.wrong(); setPopped(0); }
  };
  return (
    <Stage bg="linear-gradient(180deg,#bfdbfe,#c7d2fe)" onBack={onBack}>
      <GTitle color="#1d4ed8">🔟 Count &amp; Pop</GTitle>
      <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Pop {target} bubbles!</div>
      <div style={{ textAlign: "center", fontSize: 30, fontWeight: 900, color: "#1d4ed8", marginBottom: 8 }}>{popped}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, maxWidth: 260, margin: "0 auto 14px" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={round + "-" + i} onPointerDown={e => { e.currentTarget.style.visibility = "hidden"; setPopped(p => p + 1); sfx.pop(); }}
            style={{ width: 64, height: 64, borderRadius: "50%", background: "radial-gradient(circle at 32% 30%,#fff," + CANDY[i % CANDY.length] + ")", cursor: "pointer", boxShadow: "0 3px 6px rgba(0,0,0,.15)" }} />
        ))}
      </div>
      <div style={{ textAlign: "center" }}><button onPointerDown={check} style={btn("#1d4ed8")}>Check ✓</button></div>
    </Stage>
  );
}

// ➕ Add the Dots — visual addition; count the dots and tap the sum.
function AddDots({ onBack }) {
  const [a, setA] = useState(rnd(1, 4));
  const [b, setB] = useState(rnd(1, 4));
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const sum = a + b;
  const opts = useMemo(() => shuffle([sum, ...new Set([sum + 1, sum - 1, sum + 2].filter(x => x > 0 && x !== sum))].slice(0, 4)), [a, b]);
  const guess = n => {
    if (fb) return;
    setFb(n === sum ? "y" : "n");
    if (n === sum) { setScore(s => s + 1); sfx.good(); } else sfx.wrong();
    setTimeout(() => { setA(rnd(1, 5)); setB(rnd(1, 5)); setFb(null); }, 900);
  };
  const Dots = ({ n, c }) => <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: 70, justifyContent: "center" }}>{Array.from({ length: n }).map((_, i) => <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c }} />)}</div>;
  return (
    <Stage bg="linear-gradient(180deg,#fef9c3,#bbf7d0)" onBack={onBack}>
      <GTitle color="#b45309">➕ Add the Dots</GTitle><GScore n={score} />
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, maxWidth: 320, margin: "0 auto 14px", padding: 18 }}>
        <Dots n={a} c="#ef4444" /><span style={{ fontSize: 30, fontWeight: 900 }}>+</span><Dots n={b} c="#3b82f6" /><span style={{ fontSize: 30, fontWeight: 900 }}>=?</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 220, margin: "0 auto" }}>
        {opts.map(n => <button key={n} onPointerDown={() => guess(n)} style={{ ...card, fontSize: 30, fontWeight: 900, height: 64, cursor: "pointer" }}>{n}</button>)}
      </div>
      {fb === "y" && <div style={{ textAlign: "center", fontSize: 24, marginTop: 12 }}>🎉 {sum}!</div>}
      {fb === "n" && <div style={{ textAlign: "center", fontSize: 20, marginTop: 12, color: "#dc2626" }}>It was {sum}</div>}
    </Stage>
  );
}

// 🔤 Letter Catch — letters fall; tap the one that matches the target.
function LetterCatch({ onBack }) {
  const [box, dim] = useBox();
  const [target, setTarget] = useState(LETTERS[rnd(0, 25)]);
  const items = useRef([]);
  const id = useRef(0);
  const [, tick] = useState(0);
  const [score, setScore] = useState(0);
  useRaf(dt => { const H = dim.current.h; items.current = items.current.map(o => ({ ...o, y: o.y + o.sp * dt })).filter(o => o.y < H + 30); tick(t => t + 1); });
  useEffect(() => {
    const t = setInterval(() => {
      const withTarget = Math.random() < 0.5;
      const ch = withTarget ? target : LETTERS[rnd(0, 25)];
      items.current.push({ id: id.current++, ch, x: rnd(8, 86), y: -20, sp: rnd(60, 110), c: CANDY[rnd(0, CANDY.length - 1)] });
    }, 700);
    return () => clearInterval(t);
  }, [target]);
  const tap = o => {
    items.current = items.current.filter(x => x.id !== o.id);
    if (o.ch === target) { setScore(s => s + 1); sfx.good(); setTarget(LETTERS[rnd(0, 25)]); }
    else sfx.wrong();
  };
  return (
    <Stage bg="linear-gradient(180deg,#a7f3d0,#67e8f9)" onBack={onBack}>
      <GTitle color="#065f46">🔤 Letter Catch</GTitle>
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Tap every <span style={{ color: "#dc2626", fontSize: 26 }}>{target}</span> — ⭐ {score}</div>
      <div ref={box} style={{ position: "relative", height: "64vh", background: "#ffffff44", borderRadius: 16, overflow: "hidden" }}>
        {items.current.map(o => (
          <div key={o.id} onPointerDown={() => tap(o)} style={{ position: "absolute", left: o.x + "%", top: o.y, width: 44, height: 44, borderRadius: 10, background: o.c, color: "#fff", fontWeight: 900, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 3px 6px rgba(0,0,0,.25)" }}>{o.ch}</div>
        ))}
      </div>
    </Stage>
  );
}

// 🐘 Big or Small — tap the bigger (or smaller) of two animals.
function BigSmall({ onBack }) {
  const A = ["🐘", "🐁", "🦒", "🐜", "🐳", "🐈", "🦕", "🐤", "🦏", "🐌"];
  const [pair, setPair] = useState(() => shuffle(A).slice(0, 2));
  const [wantBig, setWantBig] = useState(true);
  const [big] = useState(() => 0);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const sizes = useMemo(() => [rnd(48, 96), rnd(48, 96)], [pair]);
  const bigIdx = sizes[0] >= sizes[1] ? 0 : 1;
  const guess = i => {
    if (fb) return;
    const correct = wantBig ? bigIdx : 1 - bigIdx;
    setFb(i === correct ? "y" : "n");
    if (i === correct) { setScore(s => s + 1); sfx.good(); } else sfx.wrong();
    setTimeout(() => { setPair(shuffle(A).slice(0, 2)); setWantBig(Math.random() < 0.5); setFb(null); }, 900);
  };
  return (
    <Stage bg="linear-gradient(180deg,#fecaca,#fef08a)" onBack={onBack}>
      <GTitle color="#b91c1c">🐘 Big or Small</GTitle><GScore n={score} />
      <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Tap the {wantBig ? "BIGGER" : "smaller"} one!</div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center" }}>
        {pair.map((a, i) => (
          <div key={i} onPointerDown={() => guess(i)} style={{ ...card, width: 130, height: 130, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: sizes[i] }}>{a}</div>
        ))}
      </div>
      {fb === "y" && <div style={{ textAlign: "center", fontSize: 24, marginTop: 14 }}>🎉 Yes!</div>}
      {fb === "n" && <div style={{ textAlign: "center", fontSize: 20, marginTop: 14, color: "#dc2626" }}>Try the other one!</div>}
    </Stage>
  );
}

// 🧲 Sort It — drag each item into the matching bin (fruit vs toy).
function MagnetDrag({ onBack }) {
  const POOL = [{ e: "🍎", k: "food" }, { e: "🚗", k: "toy" }, { e: "🍌", k: "food" }, { e: "🧸", k: "toy" }, { e: "🍇", k: "food" }, { e: "⚽", k: "toy" }];
  const [items, setItems] = useState(() => shuffle(POOL).map((x, i) => ({ ...x, id: i })));
  const [drag, setDrag] = useState(null);
  const [score, setScore] = useState(0);
  const start = (e, it) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ ...it, x: e.clientX, y: e.clientY }); };
  const move = e => { if (drag) setDrag(d => ({ ...d, x: e.clientX, y: e.clientY })); };
  const end = e => {
    if (drag) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const z = el && el.closest("[data-zone]");
      if (z && z.getAttribute("data-zone") === drag.k) { setItems(v => v.filter(x => x.id !== drag.id)); setScore(s => s + 1); sfx.good(); }
      else if (z) sfx.wrong();
    }
    setDrag(null);
  };
  const Bin = ({ k, label, c }) => <div data-zone={k} style={{ flex: 1, minHeight: 120, borderRadius: 16, border: "4px dashed " + c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, color: c, fontWeight: 800 }}>{label}</div>;
  return (
    <div onPointerMove={move} onPointerUp={end} style={{ minHeight: "100vh", background: "linear-gradient(180deg,#e0e7ff,#fae8ff)", padding: 16, touchAction: "none" }}>
      <BackBtn fn={onBack} />
      <GTitle color="#6d28d9">🧲 Sort It</GTitle><GScore n={score} />
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}><Bin k="food" label="🍽️ Food" c="#16a34a" /><Bin k="toy" label="🧸 Toys" c="#2563eb" /></div>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {items.map(it => <div key={it.id} onPointerDown={e => start(e, it)} style={{ fontSize: 44, cursor: "grab", visibility: drag && drag.id === it.id ? "hidden" : "visible" }}>{it.e}</div>)}
      </div>
      {!items.length && <div style={{ textAlign: "center", fontSize: 22, marginTop: 16, color: "#6d28d9", fontWeight: 800 }}>All sorted! 🎉</div>}
      {drag && <div style={{ position: "fixed", left: drag.x - 22, top: drag.y - 22, fontSize: 44, pointerEvents: "none", zIndex: 50 }}>{drag.e}</div>}
    </div>
  );
}

// 🏗️ Crane Stacker — a block swings under a crane; tap to drop and stack.
function TowerCrane({ onBack }) {
  const [box, dim] = useBox();
  const t = useRef(0);
  const [, tick] = useState(0);
  const [stack, setStack] = useState([]);
  useRaf(dt => { t.current += dt; tick(x => x + 1); });
  const craneX = () => { const W = dim.current.w; return W / 2 + Math.sin(t.current * 1.6) * (W / 2 - 50); };
  const drop = () => { setStack(s => [...s, { x: craneX(), c: CANDY[s.length % CANDY.length] }]); sfx.drop(); };
  return (
    <Stage bg="linear-gradient(180deg,#fde68a,#fdba74)" onBack={onBack}>
      <GTitle color="#9a3412">🏗️ Crane Stacker</GTitle><GScore n={stack.length} label="🧱" />
      <div ref={box} onPointerDown={drop} style={{ position: "relative", height: "62vh", background: "#ffffff55", borderRadius: 16, overflow: "hidden", cursor: "pointer" }}>
        <div style={{ position: "absolute", top: 6, left: craneX() - 34, width: 68, height: 26, borderRadius: 6, background: CANDY[stack.length % CANDY.length], boxShadow: "0 3px 6px rgba(0,0,0,.25)" }} />
        {stack.map((b, i) => <div key={i} style={{ position: "absolute", bottom: i * 26, left: b.x - 34, width: 68, height: 24, borderRadius: 6, background: b.c, boxShadow: "0 2px 4px rgba(0,0,0,.2)" }} />)}
      </div>
      <div style={{ textAlign: "center", color: "#9a3412", marginTop: 6 }}>Tap to drop the block!</div>
    </Stage>
  );
}

// 🌠 Gravity Drop — tap to drop balls; they fall and bounce with gravity.
function GravityDrop({ onBack }) {
  const [box, dim] = useBox();
  const balls = useRef([]);
  const [, tick] = useState(0);
  useRaf(dt => {
    const { w, h } = dim.current, g = 1500;
    balls.current = balls.current.map(b => {
      let vy = b.vy + g * dt, x = b.x + b.vx * dt, y = b.y + vy * dt, vx = b.vx;
      if (y + b.r > h) { y = h - b.r; vy = -vy * 0.72; vx *= 0.98; if (Math.abs(vy) < 30) vy = 0; }
      if (x - b.r < 0) { x = b.r; vx = -vx * 0.7; } if (x + b.r > w) { x = w - b.r; vx = -vx * 0.7; }
      return { ...b, x, y, vx, vy };
    });
    tick(t => t + 1);
  });
  const drop = e => {
    const r = box.current.getBoundingClientRect();
    balls.current = [...balls.current, { x: e.clientX - r.left, y: 20, vx: rnd(-60, 60), vy: 0, r: rnd(14, 26), c: CANDY[rnd(0, CANDY.length - 1)] }].slice(-40);
    sfx.drop();
  };
  return (
    <Stage bg="linear-gradient(180deg,#dbeafe,#a5f3fc)" onBack={onBack}>
      <GTitle color="#0369a1">🌠 Gravity Drop</GTitle>
      <div style={{ textAlign: "center", color: "#0369a1", marginBottom: 6 }}>Tap the sky to drop balls!</div>
      <div ref={box} onPointerDown={drop} style={{ position: "relative", height: "68vh", background: "#ffffff55", borderRadius: 16, overflow: "hidden", cursor: "pointer", touchAction: "none" }}>
        {balls.current.map((b, i) => <div key={i} style={{ position: "absolute", left: b.x - b.r, top: b.y - b.r, width: b.r * 2, height: b.r * 2, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff9," + b.c + ")", boxShadow: "0 2px 5px rgba(0,0,0,.25)" }} />)}
      </div>
    </Stage>
  );
}

// 🔺 Pattern Pop — an A-B-A-B pattern; tap what comes next.
function ABPattern({ onBack }) {
  const ICONS = ["🔴", "🔵", "🟡", "🟢", "🟣", "🟠"];
  const [ab, setAb] = useState(() => shuffle(ICONS).slice(0, 2));
  const [len] = useState(4);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const seq = Array.from({ length: len }).map((_, i) => ab[i % 2]);
  const answer = ab[len % 2];
  const opts = useMemo(() => shuffle([answer, ab[(len + 1) % 2], ICONS.find(x => !ab.includes(x))]), [ab]);
  const guess = o => {
    if (fb) return;
    setFb(o === answer ? "y" : "n");
    if (o === answer) { setScore(s => s + 1); sfx.good(); } else sfx.wrong();
    setTimeout(() => { setAb(shuffle(ICONS).slice(0, 2)); setFb(null); }, 900);
  };
  return (
    <Stage bg="linear-gradient(180deg,#ddd6fe,#fbcfe8)" onBack={onBack}>
      <GTitle color="#6d28d9">🔺 Pattern Pop</GTitle><GScore n={score} />
      <div style={{ textAlign: "center", fontSize: 40, marginBottom: 4 }}>{seq.join(" ")} <span style={{ opacity: .5 }}>❓</span></div>
      <div style={{ textAlign: "center", color: "#6b7280", marginBottom: 14 }}>What comes next?</div>
      <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
        {opts.map((o, i) => <button key={i} onPointerDown={() => guess(o)} style={{ ...card, fontSize: 44, width: 84, height: 84, cursor: "pointer" }}>{o}</button>)}
      </div>
      {fb === "y" && <div style={{ textAlign: "center", fontSize: 24, marginTop: 14 }}>🎉 Yes!</div>}
      {fb === "n" && <div style={{ textAlign: "center", fontSize: 20, marginTop: 14, color: "#dc2626" }}>It was {answer}</div>}
    </Stage>
  );
}

// 🅰️ Letter Match — match a big (capital) letter to its small letter.
function CaseMatch({ onBack }) {
  const [upper, setUpper] = useState(LETTERS[rnd(0, 25)]);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const opts = useMemo(() => {
    const wrong = new Set(); while (wrong.size < 3) { const c = LETTERS[rnd(0, 25)]; if (c !== upper) wrong.add(c); }
    return shuffle([upper, ...wrong]).map(c => c.toLowerCase());
  }, [upper]);
  const guess = c => {
    if (fb) return;
    setFb(c === upper.toLowerCase() ? "y" : "n");
    if (c === upper.toLowerCase()) { setScore(s => s + 1); sfx.good(); } else sfx.wrong();
    setTimeout(() => { setUpper(LETTERS[rnd(0, 25)]); setFb(null); }, 800);
  };
  return (
    <Stage bg="linear-gradient(180deg,#bfdbfe,#a7f3d0)" onBack={onBack}>
      <GTitle color="#1d4ed8">🅰️ Letter Match</GTitle><GScore n={score} />
      <div style={{ ...card, width: 120, height: 120, margin: "6px auto 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, fontWeight: 900, color: "#4338ca" }}>{upper}</div>
      <div style={{ textAlign: "center", color: "#374151", marginBottom: 10 }}>Find the small letter!</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 220, margin: "0 auto" }}>
        {opts.map(c => <button key={c} onPointerDown={() => guess(c)} style={{ ...card, fontSize: 40, fontWeight: 900, height: 70, cursor: "pointer" }}>{c}</button>)}
      </div>
      {fb === "y" && <div style={{ textAlign: "center", fontSize: 24, marginTop: 12 }}>🎉</div>}
      {fb === "n" && <div style={{ textAlign: "center", fontSize: 20, marginTop: 12, color: "#dc2626" }}>It was {upper.toLowerCase()}</div>}
    </Stage>
  );
}

// 🔢 Number Order — tap the bubbles 1,2,3… in the right order.
function NumberOrder({ onBack }) {
  const N = 6;
  const [next, setNext] = useState(1);
  const [round, setRound] = useState(0);
  const spots = useMemo(() => shuffle(Array.from({ length: N }, (_, i) => i + 1)).map((n, i) => ({ n, x: rnd(8, 82), y: rnd(20, 80) })), [round]);
  const [done, setDone] = useState({});
  const tap = n => {
    if (n === next) { setDone(d => ({ ...d, [n]: 1 })); sfx.good(); if (n === N) { sfx.win(); setTimeout(() => { setNext(1); setDone({}); setRound(r => r + 1); }, 800); } else setNext(n + 1); }
    else sfx.wrong();
  };
  return (
    <Stage bg="linear-gradient(180deg,#fef08a,#86efac)" onBack={onBack}>
      <GTitle color="#166534">🔢 Number Order</GTitle>
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Tap them in order! Next: <span style={{ color: "#dc2626", fontSize: 24 }}>{next > N ? "🎉" : next}</span></div>
      <div style={{ position: "relative", height: "64vh" }}>
        {spots.map(s => (
          <div key={s.n} onPointerDown={() => tap(s.n)} style={{ position: "absolute", left: s.x + "%", top: s.y + "%", width: 60, height: 60, borderRadius: "50%", background: done[s.n] ? "#86efac" : CANDY[(s.n) % CANDY.length], color: "#fff", fontWeight: 900, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 3px 8px rgba(0,0,0,.25)", opacity: done[s.n] ? 0.5 : 1 }}>{s.n}</div>
        ))}
      </div>
    </Stage>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGE 5 — MATH, ENGLISH & PHYSICS FUN
// ═══════════════════════════════════════════════════════════════

// ➗ Math Pop — a sum floats up on balloons; pop the correct answer.
function MathPop({ onBack }) {
  const gen = () => { const add = Math.random() < 0.5; const a = rnd(1, 9), b = rnd(1, add ? 9 : a); return add ? { q: a + " + " + b, ans: a + b } : { q: a + " − " + b, ans: a - b }; };
  const [q, setQ] = useState(gen);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const opts = useMemo(() => shuffle([q.ans, ...new Set([q.ans + 1, q.ans - 1, q.ans + 2].filter(x => x >= 0 && x !== q.ans))].slice(0, 4)), [q]);
  const guess = n => {
    if (fb) return;
    setFb(n === q.ans ? "y" : "n");
    if (n === q.ans) { setScore(s => s + 1); sfx.win(); } else sfx.wrong();
    setTimeout(() => { setQ(gen()); setFb(null); }, 950);
  };
  return (
    <Stage bg="linear-gradient(180deg,#a5f3fc,#c4b5fd)" onBack={onBack}>
      <GTitle color="#4338ca">➗ Math Pop</GTitle><GScore n={score} />
      <div style={{ ...card, fontSize: 42, fontWeight: 900, textAlign: "center", maxWidth: 260, margin: "0 auto 16px", padding: "16px 0", color: "#1e1b4b" }}>{q.q} = ?</div>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {opts.map(n => (
          <div key={n} onPointerDown={() => guess(n)} style={{ cursor: "pointer", position: "relative", animation: "ktFloat 3s ease-in-out infinite" }}>
            <Balloon c={CANDY[(n + 3) % CANDY.length]} size={64} />
            <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center", fontSize: 26, fontWeight: 900, color: "#fff", textShadow: "0 1px 3px #0007" }}>{n}</div>
          </div>
        ))}
      </div>
      {fb === "y" && <div style={{ textAlign: "center", fontSize: 24, marginTop: 14 }}>🎉 {q.ans}!</div>}
      {fb === "n" && <div style={{ textAlign: "center", fontSize: 20, marginTop: 14, color: "#dc2626" }}>It was {q.ans}</div>}
    </Stage>
  );
}

// 📖 Rhyme Time — pick the word that rhymes with the target.
function RhymeTime({ onBack }) {
  const SETS = [
    { w: "cat", r: "hat", x: ["dog", "sun"] }, { w: "bee", r: "tree", x: ["fish", "car"] },
    { w: "star", r: "car", x: ["moon", "cup"] }, { w: "cake", r: "lake", x: ["milk", "frog"] },
    { w: "dog", r: "log", x: ["cat", "hat"] }, { w: "sun", r: "bun", x: ["rain", "leaf"] },
    { w: "moon", r: "spoon", x: ["star", "book"] }, { w: "snake", r: "rake", x: ["worm", "bird"] },
  ];
  const [i, setI] = useState(rnd(0, SETS.length - 1));
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const s = SETS[i];
  const opts = useMemo(() => shuffle([s.r, ...s.x]), [i]);
  const guess = w => {
    if (fb) return;
    setFb(w === s.r ? "y" : "n");
    if (w === s.r) { setScore(v => v + 1); sfx.good(); } else sfx.wrong();
    setTimeout(() => { setI(rnd(0, SETS.length - 1)); setFb(null); }, 1000);
  };
  return (
    <Stage bg="linear-gradient(180deg,#fef3c7,#fbcfe8)" onBack={onBack}>
      <GTitle color="#be185d">📖 Rhyme Time</GTitle><GScore n={score} />
      <div style={{ textAlign: "center", fontSize: 18, marginBottom: 6 }}>Which word rhymes with</div>
      <div style={{ textAlign: "center", fontSize: 44, fontWeight: 900, color: "#be185d", marginBottom: 14 }}>{s.w}?</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        {opts.map(w => <button key={w} onPointerDown={() => guess(w)} style={{ ...card, fontSize: 24, fontWeight: 800, padding: "12px 20px", cursor: "pointer" }}>{w}</button>)}
      </div>
      {fb === "y" && <div style={{ textAlign: "center", fontSize: 24, marginTop: 16 }}>🎉 {s.w} — {s.r}!</div>}
      {fb === "n" && <div style={{ textAlign: "center", fontSize: 20, marginTop: 16, color: "#dc2626" }}>{s.w} rhymes with {s.r}</div>}
    </Stage>
  );
}

// 🪐 Gravity Lab — a real toy: change gravity & bounciness, drop balls, explore.
function GravityLab({ onBack }) {
  const [box, dim] = useBox();
  const balls = useRef([]);
  const [, tick] = useState(0);
  const [g, setG] = useState(1200);
  const [bounce, setBounce] = useState(0.8);
  useRaf(dt => {
    const { w, h } = dim.current;
    balls.current = balls.current.map(b => {
      let vy = b.vy + g * dt, x = b.x + b.vx * dt, y = b.y + vy * dt, vx = b.vx;
      if (y + b.r > h) { y = h - b.r; vy = -vy * bounce; vx *= 0.99; if (Math.abs(vy) < 20) vy = 0; }
      if (y - b.r < 0) { y = b.r; vy = -vy * bounce; }
      if (x - b.r < 0) { x = b.r; vx = -vx * bounce; } if (x + b.r > w) { x = w - b.r; vx = -vx * bounce; }
      return { ...b, x, y, vx, vy };
    });
    tick(t => t + 1);
  });
  const drop = e => { const r = box.current.getBoundingClientRect(); balls.current = [...balls.current, { x: e.clientX - r.left, y: e.clientY - r.top, vx: rnd(-120, 120), vy: 0, r: rnd(12, 24), c: CANDY[rnd(0, CANDY.length - 1)] }].slice(-50); sfx.drop(); };
  const Slider = ({ label, val, min, max, set, fmt }) => (
    <label style={{ fontSize: 12, color: "#e2e8f0", display: "block" }}>{label}: {fmt(val)}
      <input type="range" min={min} max={max} value={val} onChange={e => set(+e.target.value)} style={{ width: "100%" }} /></label>
  );
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#1e1b4b)", padding: 16 }}>
      <BackBtn fn={onBack} dark />
      <GTitle color="#a5b4fc">🪐 Gravity Lab</GTitle>
      <div style={{ display: "flex", gap: 14, maxWidth: 420, margin: "0 auto 8px" }}>
        <div style={{ flex: 1 }}><Slider label="Gravity" val={g} min={0} max={3000} set={setG} fmt={v => v === 0 ? "space!" : v} /></div>
        <div style={{ flex: 1 }}><Slider label="Bounce" val={Math.round(bounce * 100)} min={0} max={99} set={v => setBounce(v / 100)} fmt={v => v + "%"} /></div>
      </div>
      <div ref={box} onPointerDown={drop} style={{ position: "relative", height: "62vh", background: "#0008", borderRadius: 16, overflow: "hidden", cursor: "pointer", touchAction: "none" }}>
        {balls.current.map((b, i) => <div key={i} style={{ position: "absolute", left: b.x - b.r, top: b.y - b.r, width: b.r * 2, height: b.r * 2, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff9," + b.c + ")", boxShadow: "0 0 8px " + b.c }} />)}
      </div>
      <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, marginTop: 6 }}>Tap to drop balls. Try gravity = space!</div>
    </div>
  );
}

// 🗼 Tower Physics — drag blocks onto the tower; off-center ones topple away!
function PhysicsStack({ onBack }) {
  const [box, dim] = useBox();
  const [stack, setStack] = useState([]);           // {x} placed blocks (bottom→top)
  const [drag, setDrag] = useState(null);
  const [fallen, setFallen] = useState(null);
  const [n, setN] = useState(0);
  const BW = 76;
  const start = e => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ x: e.clientX, y: e.clientY }); };
  const move = e => { if (drag) setDrag({ x: e.clientX, y: e.clientY }); };
  const end = e => {
    if (drag && box.current) {
      const r = box.current.getBoundingClientRect();
      const x = e.clientX - r.left;
      if (e.clientY - r.top > 0 && e.clientY - r.top < r.height) {
        const topX = stack.length ? stack[stack.length - 1].x : r.width / 2;
        if (stack.length === 0 || Math.abs(x - topX) < BW * 0.6) { setStack(s => [...s, { x }]); setN(v => v + 1); sfx.drop(); }
        else { setFallen({ x, side: x > topX ? 1 : -1 }); sfx.wrong(); setTimeout(() => setFallen(null), 600); }
      }
    }
    setDrag(null);
  };
  return (
    <div onPointerMove={move} onPointerUp={end} style={{ minHeight: "100vh", background: "linear-gradient(180deg,#bae6fd,#ddd6fe)", padding: 16, touchAction: "none" }}>
      <BackBtn fn={onBack} />
      <GTitle color="#4338ca">🗼 Tower Physics</GTitle><GScore n={stack.length} label="🧱" />
      <div ref={box} style={{ position: "relative", height: "60vh", background: "#ffffff66", borderRadius: 16, overflow: "hidden" }}>
        {stack.map((b, i) => <div key={i} style={{ position: "absolute", bottom: i * 26, left: b.x - BW / 2, width: BW, height: 24, borderRadius: 6, background: CANDY[i % CANDY.length], boxShadow: "0 2px 4px rgba(0,0,0,.25)" }} />)}
        {fallen && <div style={{ position: "absolute", bottom: stack.length * 26, left: fallen.x - BW / 2, width: BW, height: 24, borderRadius: 6, background: "#94a3b8", transform: "rotate(" + (fallen.side * 60) + "deg) translateY(120px)", transition: "transform .6s ease-in", opacity: .6 }} />}
      </div>
      {/* the block to drag */}
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <div onPointerDown={start} style={{ display: "inline-block", width: BW, height: 26, borderRadius: 6, background: CANDY[stack.length % CANDY.length], cursor: "grab", boxShadow: "0 3px 6px rgba(0,0,0,.25)", visibility: drag ? "hidden" : "visible" }} />
        <div style={{ color: "#4338ca", fontSize: 13, marginTop: 6 }}>Drag the block onto the tower — keep it centered!</div>
      </div>
      {drag && <div style={{ position: "fixed", left: drag.x - BW / 2, top: drag.y - 13, width: BW, height: 26, borderRadius: 6, background: CANDY[stack.length % CANDY.length], pointerEvents: "none", zIndex: 50, boxShadow: "0 4px 10px rgba(0,0,0,.3)" }} />}
    </div>
  );
}

// 🔡 Missing Letter — a word with a gap; tap the letter that fits.
function MissingLetter({ onBack }) {
  const WORDS = [{ w: "CAT", e: "🐱" }, { w: "DOG", e: "🐶" }, { w: "SUN", e: "☀️" }, { w: "BUS", e: "🚌" }, { w: "PIG", e: "🐷" }, { w: "HAT", e: "🎩" }, { w: "BED", e: "🛏️" }, { w: "CUP", e: "☕" }];
  const [i, setI] = useState(rnd(0, WORDS.length - 1));
  const [gap, setGap] = useState(rnd(0, 2));
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const item = WORDS[i];
  const missing = item.w[gap];
  const opts = useMemo(() => {
    const wrong = new Set(); while (wrong.size < 2) { const c = LETTERS[rnd(0, 25)]; if (c !== missing) wrong.add(c); }
    return shuffle([missing, ...wrong]);
  }, [i, gap]);
  const guess = c => {
    if (fb) return;
    setFb(c === missing ? "y" : "n");
    if (c === missing) { setScore(s => s + 1); sfx.good(); } else sfx.wrong();
    setTimeout(() => { setI(rnd(0, WORDS.length - 1)); setGap(rnd(0, 2)); setFb(null); }, 900);
  };
  return (
    <Stage bg="linear-gradient(180deg,#fde68a,#a7f3d0)" onBack={onBack}>
      <GTitle color="#b45309">🔡 Missing Letter</GTitle><GScore n={score} />
      <div style={{ fontSize: 84, textAlign: "center" }}>{item.e}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "8px 0 16px" }}>
        {item.w.split("").map((ch, k) => (
          <div key={k} style={{ width: 54, height: 60, borderRadius: 10, background: k === gap ? (fb ? "#86efac" : "#fff") : "#e0e7ff", border: "3px solid " + (k === gap ? "#6366f1" : "#c7d2fe"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: "#3730a3" }}>{k === gap ? (fb === "y" || fb === "n" ? missing : "?") : ch}</div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        {opts.map(c => <button key={c} onPointerDown={() => guess(c)} style={{ ...card, width: 64, height: 64, fontSize: 30, fontWeight: 900, cursor: "pointer" }}>{c}</button>)}
      </div>
      {fb === "y" && <div style={{ textAlign: "center", fontSize: 22, marginTop: 12 }}>🎉 {item.w}!</div>}
    </Stage>
  );
}

// ⚖️ Balance It — add apples to the light side until both sides are equal.
function BalanceScale({ onBack }) {
  const [target, setTarget] = useState(rnd(2, 6));
  const [have, setHave] = useState(rnd(0, 2));
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const tilt = Math.max(-14, Math.min(14, (have - target) * 4));
  const check = () => {
    if (have === target) { setFb("y"); setScore(s => s + 1); sfx.win(); setTimeout(() => { const t = rnd(2, 7); setTarget(t); setHave(rnd(0, t - 1)); setFb(null); }, 1000); }
    else { sfx.wrong(); setFb("n"); setTimeout(() => setFb(null), 700); }
  };
  const Apples = ({ n }) => <div style={{ display: "flex", flexWrap: "wrap", width: 90, justifyContent: "center", gap: 2 }}>{Array.from({ length: n }).map((_, i) => <span key={i} style={{ fontSize: 20 }}>🍎</span>)}</div>;
  return (
    <Stage bg="linear-gradient(180deg,#fecaca,#fde68a)" onBack={onBack}>
      <GTitle color="#b91c1c">⚖️ Balance It</GTitle><GScore n={score} />
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Make both sides have {target}!</div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 30, transform: "rotate(" + tilt + "deg)", transition: "transform .3s", margin: "18px 0" }}>
        <div style={{ ...card, minWidth: 100, minHeight: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}><Apples n={target} /></div>
        <div style={{ ...card, minWidth: 100, minHeight: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}><Apples n={have} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
        <button onPointerDown={() => { setHave(h => Math.max(0, h - 1)); sfx.tap(); }} style={btn("#ef4444")}>➖</button>
        <button onPointerDown={() => { setHave(h => h + 1); sfx.tap(); }} style={btn("#22c55e")}>➕ Apple</button>
        <button onPointerDown={check} style={btn("#1d4ed8")}>Balance ✓</button>
      </div>
      {fb === "y" && <div style={{ textAlign: "center", fontSize: 24, marginTop: 14 }}>🎉 Balanced!</div>}
      {fb === "n" && <div style={{ textAlign: "center", fontSize: 18, marginTop: 14, color: "#dc2626" }}>Not yet — you have {have}, need {target}</div>}
    </Stage>
  );
}

// 🎯 Number Line — hop the frog to the target number.
// 🐇 Number Line Hop — Age 3 addition & subtraction VISUALIZER.
// Unlike NumberLine below (which is a "hop to a target" game for Age 5), this
// one shows a hop-by-hop animation of a math fact: e.g. 3 + 2 walks the bunny
// from 3, then hops 2 more times landing on 5 — so a 3-year-old SEES what
// "plus" and "minus" physically mean before ever seeing a written sum.
function NumberLineAddSub({ onBack }) {
  const MAX = 10;                                    // number line shows 0..10
  // A "fact" is { a, op, b } meaning "a + b" or "a - b". We keep both numbers
  // small (0-6) and cap results inside 0..MAX so the bunny never hops off the line.
  const genFact = () => {
    const op = Math.random() < 0.5 ? "+" : "-";
    if (op === "+") {
      const a = rnd(0, 6);
      const b = rnd(0, Math.min(6, MAX - a));         // keep a+b within the line
      return { a, op, b };
    } else {
      const a = rnd(2, MAX);                          // start high enough to subtract from
      const b = rnd(0, a);                             // never go below 0
      return { a, op, b };
    }
  };
  const [fact, setFact] = useState(genFact);
  const [pos, setPos] = useState(fact.a);             // bunny's current spot on the line
  const [hopsLeft, setHopsLeft] = useState(0);         // hops still queued for auto-play
  const [hopping, setHopping] = useState(false);       // true while auto-hop animation runs
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);             // landed on the final answer?
  const answer = fact.op === "+" ? fact.a + fact.b : fact.a - fact.b;

  // Reset the line to the START of a fresh fact (bunny sits on "a", no hops taken yet).
  const newFact = () => {
    const f = genFact();
    setFact(f); setPos(f.a); setHopsLeft(0); setHopping(false); setDone(false);
  };

  // "▶ Show Me" — auto-hop one step at a time toward the answer, with a short
  // pause between hops so little eyes can track the bunny's movement.
  const playHops = () => {
    if (hopping) return;                              // ignore double-taps mid-animation
    setHopping(true);
    setPos(fact.a);
    setHopsLeft(fact.b);
    let cur = fact.a, left = fact.b;
    const step = () => {
      if (left <= 0) {                                 // finished all hops → landed!
        setHopping(false); setDone(true); setScore(s => s + 1); sfx.win();
        return;
      }
      cur = fact.op === "+" ? cur + 1 : cur - 1;
      left -= 1;
      setPos(cur); setHopsLeft(left);
      sfx.boing();
      setTimeout(step, 550);                           // pace: one hop every 550ms
    };
    setTimeout(step, 350);                              // brief pause before the first hop
  };

  // Manual hop buttons let a child drive the bunny themselves instead of
  // watching "Show Me" — same +1/-1 movement, just tap-triggered.
  const manualHop = dir => {
    if (hopping || done) return;
    const next = Math.max(0, Math.min(MAX, pos + dir));
    setPos(next);
    sfx.boing();
    if (next === answer) { setDone(true); setScore(s => s + 1); sfx.win(); }
  };

  return (
    <Stage bg="linear-gradient(180deg,#fef3c7,#bbf7d0)" onBack={onBack}>
      <GTitle color="#92400e">🐇 Number Line Hop</GTitle>
      <GScore n={score} />
      {/* The math fact shown in big friendly text, e.g. "3 + 2 = ?" */}
      <div style={{ textAlign: "center", fontSize: 30, fontWeight: 900, marginBottom: 4, color: "#1f2937" }}>
        {fact.a} {fact.op} {fact.b} = {done ? answer : "?"}
      </div>
      <div style={{ textAlign: "center", fontSize: 14, color: "#78716c", marginBottom: 14 }}>
        {fact.op === "+" ? "Hop forward to add!" : "Hop backward to subtract!"}
      </div>
      {/* The number line itself: 0..MAX as evenly spaced dots, bunny marks position */}
      <div style={{ position: "relative", height: 96, background: "#fff", borderRadius: 14, margin: "0 auto 16px", maxWidth: 460, padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 3px 10px rgba(0,0,0,.12)" }}>
        {Array.from({ length: MAX + 1 }).map((_, i) => (
          <div key={i} style={{ textAlign: "center", position: "relative", flex: 1 }}>
            {/* Highlight the start number and the answer so kids see the two anchors */}
            <div style={{ fontSize: 15, fontWeight: 800,
              color: i === fact.a ? "#2563eb" : i === answer ? "#dc2626" : "#94a3b8" }}>{i}</div>
            {pos === i && <div style={{ fontSize: 34, position: "absolute", top: -38, left: 0, right: 0, transition: "left 0.3s" }}>🐇</div>}
          </div>
        ))}
      </div>
      {/* Controls: auto-play the hops, or drive the bunny by hand */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button onPointerDown={playHops} disabled={hopping} style={{ ...btn("#7c3aed"), opacity: hopping ? 0.6 : 1 }}>
          ▶ Show Me
        </button>
        <button onPointerDown={() => manualHop(-1)} disabled={hopping} style={btn("#ef4444")}>⬅️ Hop</button>
        <button onPointerDown={() => manualHop(1)} disabled={hopping} style={btn("#22c55e")}>Hop ➡️</button>
      </div>
      {done && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>🎉 {fact.a} {fact.op} {fact.b} = {answer}!</div>
          <button onPointerDown={newFact} style={btn("#1d4ed8")}>Next ➜</button>
        </div>
      )}
    </Stage>
  );
}

function NumberLine({ onBack }) {
  const MAX = 10;
  const [target, setTarget] = useState(rnd(1, MAX));
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [fb, setFb] = useState(null);
  const check = () => {
    if (pos === target) { setFb("y"); setScore(s => s + 1); sfx.win(); setTimeout(() => { setTarget(rnd(1, MAX)); setPos(0); setFb(null); }, 900); }
    else { sfx.wrong(); setFb("n"); setTimeout(() => setFb(null), 700); }
  };
  return (
    <Stage bg="linear-gradient(180deg,#bbf7d0,#a5f3fc)" onBack={onBack}>
      <GTitle color="#065f46">🎯 Number Line</GTitle><GScore n={score} />
      <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Hop to number {target}!</div>
      <div style={{ position: "relative", height: 90, background: "#fff", borderRadius: 14, margin: "0 auto 12px", maxWidth: 440, padding: "0 10px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 3px 10px rgba(0,0,0,.12)" }}>
        {Array.from({ length: MAX + 1 }).map((_, i) => (
          <div key={i} style={{ textAlign: "center", position: "relative", flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: i === target ? "#dc2626" : "#94a3b8" }}>{i}</div>
            {pos === i && <div style={{ fontSize: 32, position: "absolute", top: -34, left: 0, right: 0 }}>🐸</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onPointerDown={() => { setPos(p => Math.max(0, p - 1)); sfx.boing(); }} style={btn("#ef4444")}>⬅️ Hop</button>
        <button onPointerDown={() => { setPos(p => Math.min(MAX, p + 1)); sfx.boing(); }} style={btn("#22c55e")}>Hop ➡️</button>
        <button onPointerDown={check} style={btn("#1d4ed8")}>Here! ✓</button>
      </div>
      {fb === "y" && <div style={{ textAlign: "center", fontSize: 24, marginTop: 14 }}>🎉 You landed on {target}!</div>}
      {fb === "n" && <div style={{ textAlign: "center", fontSize: 18, marginTop: 14, color: "#dc2626" }}>You're on {pos}, hop to {target}</div>}
    </Stage>
  );
}

// 🧩 Shape Fit — drag each shape into its matching hole.
function ShapeFit({ onBack }) {
  const SHAPES = [{ k: "circle", e: "🔵", c: "#3b82f6" }, { k: "square", e: "🟩", c: "#22c55e" }, { k: "triangle", e: "🔺", c: "#ef4444" }, { k: "star", e: "⭐", c: "#eab308" }];
  const [items, setItems] = useState(() => shuffle(SHAPES).map((s, i) => ({ ...s, id: i })));
  const [drag, setDrag] = useState(null);
  const [placed, setPlaced] = useState({});
  const start = (e, it) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ ...it, x: e.clientX, y: e.clientY }); };
  const move = e => { if (drag) setDrag(d => ({ ...d, x: e.clientX, y: e.clientY })); };
  const end = e => {
    if (drag) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const z = el && el.closest("[data-hole]");
      if (z && z.getAttribute("data-hole") === drag.k) { setPlaced(p => ({ ...p, [drag.k]: drag.e })); setItems(v => v.filter(x => x.id !== drag.id)); sfx.good(); }
      else if (z) sfx.wrong();
    }
    setDrag(null);
  };
  return (
    <div onPointerMove={move} onPointerUp={end} style={{ minHeight: "100vh", background: "linear-gradient(180deg,#e9d5ff,#bfdbfe)", padding: 16, touchAction: "none" }}>
      <BackBtn fn={onBack} />
      <GTitle color="#7c3aed">🧩 Shape Fit</GTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, maxWidth: 420, margin: "6px auto 20px" }}>
        {SHAPES.map(s => (
          <div key={s.k} data-hole={s.k} style={{ height: 74, borderRadius: 14, border: "4px dashed " + s.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, background: placed[s.k] ? s.c + "22" : "transparent" }}>{placed[s.k] || ""}</div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        {items.map(it => <div key={it.id} onPointerDown={e => start(e, it)} style={{ fontSize: 48, cursor: "grab", visibility: drag && drag.id === it.id ? "hidden" : "visible" }}>{it.e}</div>)}
      </div>
      {!items.length && <div style={{ textAlign: "center", fontSize: 22, marginTop: 16, color: "#7c3aed", fontWeight: 800 }}>All fit! 🎉</div>}
      {drag && <div style={{ position: "fixed", left: drag.x - 24, top: drag.y - 24, fontSize: 48, pointerEvents: "none", zIndex: 50 }}>{drag.e}</div>}
    </div>
  );
}

// 🌀 Marble Drop — Plinko! Drop a marble; it bounces down pegs into a bin.
function MarbleDrop({ onBack }) {
  const ROWS = 7;
  const [ball, setBall] = useState(null);      // {row, x}
  const [bin, setBin] = useState(null);
  const dropping = useRef(false);
  const drop = () => {
    if (dropping.current) return;
    dropping.current = true; setBin(null);
    let row = 0, x = ROWS / 2;
    setBall({ row, x });
    const step = () => {
      row++; x += Math.random() < 0.5 ? -0.5 : 0.5; sfx.tap();
      if (row > ROWS) { setBall(null); setBin(Math.round(x)); dropping.current = false; sfx.win(); return; }
      setBall({ row, x }); setTimeout(step, 180);
    };
    setTimeout(step, 180);
  };
  return (
    <Stage bg="linear-gradient(180deg,#1e293b,#0f172a)" dark onBack={onBack}>
      <GTitle color="#38bdf8">🌀 Marble Drop</GTitle>
      <div style={{ position: "relative", height: "58vh", maxWidth: 360, margin: "0 auto", background: "#0008", borderRadius: 16, overflow: "hidden" }}>
        {/* peg rows */}
        {Array.from({ length: ROWS }).map((_, r) => (
          <div key={r} style={{ position: "absolute", top: (r + 1) * (100 / (ROWS + 2)) + "%", left: 0, right: 0, display: "flex", justifyContent: "center", gap: 22 }}>
            {Array.from({ length: r + 2 }).map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748b" }} />)}
          </div>
        ))}
        {ball && <div style={{ position: "absolute", top: (ball.row) * (100 / (ROWS + 2)) + "%", left: (ball.x / ROWS) * 80 + 10 + "%", width: 20, height: 20, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff,#ef4444)", transition: "all .18s linear", boxShadow: "0 0 8px #ef4444" }} />}
      </div>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <button onPointerDown={drop} style={btn("#0ea5e9")}>🌀 Drop Marble</button>
        {bin != null && <div style={{ color: "#38bdf8", fontSize: 18, marginTop: 8, fontWeight: 800 }}>Landed in bin {bin}! 🎉</div>}
      </div>
    </Stage>
  );
}

// 🤸 Bounce! — tap to make the ball jump; gravity pulls it back. Just fun.
function BounceHouse({ onBack }) {
  const [box, dim] = useBox();
  const ball = useRef({ y: 0, vy: 0 });
  const [, tick] = useState(0);
  const [hops, setHops] = useState(0);
  useRaf(dt => {
    const H = dim.current.h, floor = H - 40, g = 1600;
    const b = ball.current;
    b.vy += g * dt; b.y += b.vy * dt;
    if (b.y > floor) { b.y = floor; if (b.vy > 250) { b.vy = -b.vy * 0.55; sfx.boing(); } else b.vy = 0; }
    if (b.y < 0) { b.y = 0; b.vy = 0; }
    tick(t => t + 1);
  });
  const jump = () => { ball.current.vy = -720; setHops(h => h + 1); sfx.boing(); };
  return (
    <Stage bg="linear-gradient(180deg,#fca5a5,#fdba74)" onBack={onBack}>
      <GTitle color="#9a3412">🤸 Bounce!</GTitle><GScore n={hops} label="🦘" />
      <div ref={box} onPointerDown={jump} style={{ position: "relative", height: "66vh", background: "#ffffff55", borderRadius: 16, overflow: "hidden", cursor: "pointer" }}>
        <div style={{ position: "absolute", left: "50%", top: ball.current.y, transform: "translateX(-50%)", fontSize: 56, filter: "drop-shadow(0 6px 4px rgba(0,0,0,.25))" }}>😃</div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "#16a34a" }} />
      </div>
      <div style={{ textAlign: "center", color: "#9a3412", marginTop: 6 }}>Tap to jump! 🎈</div>
    </Stage>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGE 5 — BINARY FLIP  (an odometer-style binary counter)
// ═══════════════════════════════════════════════════════════════
// A hands-on way to SEE how counting in binary works. Kids press +1 and the
// four bits roll like the wheels on a car's odometer:
//   • the RIGHT bit (value 1) flips on every single press
//   • when a bit rolls from 1 back to 0 it "carries" — it flips the bit to its
//     LEFT up by one, exactly like a mechanical peg nudging the next wheel.
// The place-value labels (8 4 2 1) and the running sum (e.g. 4 + 1 = 5) show
// WHY those 1s and 0s add up to the big number. This is the same idea the Age-6
// "Binary Basics" and Age-7 "Binary Class" build on later.
// 🔤 Letter Bits — Age 6. The sequel to Binary Flip (Age 5).
// Binary Flip taught "bits make NUMBERS". This one teaches the next big idea:
// the computer only ever stores numbers, so letters are just numbers in
// disguise — a lookup table called ASCII. A=65, B=66, ... a=97, b=98.
// The star teaching moment is the "case bit": capital → small is ONE bit
// (the 32 column), because 65 + 32 = 97. Kids can literally watch A become a.
function LetterBits({ onBack }) {
  const PLACES = [128, 64, 32, 16, 8, 4, 2, 1];   // 8 bits = 1 byte = 0..255
  const [n, setN] = useState(65);                  // current byte value; start on "A"
  const [quiz, setQuiz] = useState(false);         // false = free explore, true = challenge
  const [target, setTarget] = useState("K");       // the letter to build in quiz mode
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);           // just matched the target?

  const bits = PLACES.map(p => (n & p) ? 1 : 0);   // is each column ON?
  // ASCII 32..126 are the "printable" characters. Anything else has no symbol
  // we can safely show a child, so we display a dash instead.
  const printable = n >= 32 && n <= 126;
  const ch = printable ? String.fromCharCode(n) : "—";
  // A friendly description of what kind of character this is.
  const kind = n >= 65 && n <= 90 ? "a CAPITAL letter"
    : n >= 97 && n <= 122 ? "a small letter"
    : n >= 48 && n <= 57 ? "a digit"
    : n === 32 ? "a space"
    : printable ? "a symbol"
    : "not a letter (yet!)";

  // Flip one bit on/off. XOR (^) toggles exactly that column and leaves the rest.
  const flip = p => {
    setN(v => { sfx.pop(); return v ^ p; });
    setWon(false);
  };
  // THE CASE BIT: toggling just the 32 column swaps CAPITAL ↔ small.
  const flipCase = () => { setN(v => { sfx.good(); return v ^ 32; }); setWon(false); };

  // Pick a fresh random letter to build (mixes capitals and smalls).
  const newTarget = () => {
    const caps = Math.random() < 0.5;
    const base = caps ? 65 : 97;
    setTarget(String.fromCharCode(base + rnd(0, 25)));
    setN(0);                                        // start from a blank byte
    setWon(false);
  };

  // In quiz mode, watch for the byte matching the target letter.
  useEffect(() => {
    if (!quiz || won) return;
    if (n === target.charCodeAt(0)) { setWon(true); setScore(s => s + 1); sfx.win(); }
  }, [n, quiz, target, won]);

  // "Show me" — just set the byte straight to the answer so a stuck kid
  // can SEE which columns light up, then try the next one themselves.
  const showMe = () => { setN(target.charCodeAt(0)); sfx.good(); };

  return (
    <Stage bg="linear-gradient(180deg,#fce7f3,#dbeafe)" onBack={onBack}>
      <GTitle color="#9d174d">🔤 Letter Bits</GTitle>
      <GScore n={score} />

      {/* Mode switch: free exploring vs. build-the-letter challenge */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
        <button onPointerDown={() => { setQuiz(false); setWon(false); }}
          style={btn(quiz ? "#94a3b8" : "#2563eb")}>🔎 Explore</button>
        <button onPointerDown={() => { setQuiz(true); newTarget(); }}
          style={btn(quiz ? "#2563eb" : "#94a3b8")}>🎯 Challenge</button>
      </div>

      {/* In challenge mode, show the letter we're trying to build */}
      {quiz && (
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 15, color: "#475569" }}>Build this letter: </span>
          <span style={{ fontSize: 30, fontWeight: 900, color: "#dc2626" }}>{target}</span>
          <span style={{ fontSize: 15, color: "#475569" }}> (= {target.charCodeAt(0)})</span>
        </div>
      )}

      {/* The 8 bit columns. Tapping one toggles it — same feel as Binary Flip.
          The 32 column is tinted purple because it's the special "case bit". */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 6, flexWrap: "nowrap" }}>
        {PLACES.map((p, i) => (
          <div key={p} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: p === 32 ? "#7c3aed" : "#64748b", fontWeight: 700, marginBottom: 3 }}>{p}</div>
            <button onPointerDown={() => flip(p)}
              style={{
                width: 38, height: 50, borderRadius: 9, border: "none", cursor: "pointer",
                fontSize: 20, fontWeight: 900,
                background: bits[i] ? (p === 32 ? "#7c3aed" : "#2563eb") : "#e2e8f0",
                color: bits[i] ? "white" : "#94a3b8",
                boxShadow: bits[i] ? "0 3px 8px rgba(0,0,0,.2)" : "none",
                transition: "background .15s",
              }}>{bits[i]}</button>
          </div>
        ))}
      </div>

      {/* The running total, so kids connect the lit columns to the number */}
      <div style={{ textAlign: "center", fontSize: 14, color: "#475569", marginBottom: 10 }}>
        {PLACES.filter(p => n & p).join(" + ") || "0"} = <strong style={{ fontSize: 18 }}>{n}</strong>
      </div>

      {/* THE PAYOFF: the number turned into an actual character */}
      <div style={{ background: "white", borderRadius: 14, padding: "14px 10px", maxWidth: 320,
        margin: "0 auto 12px", textAlign: "center", boxShadow: "0 3px 10px rgba(0,0,0,.12)" }}>
        <div style={{ fontSize: 13, color: "#64748b" }}>the computer shows</div>
        <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.1, color: "#0f172a" }}>{ch}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{kind}</div>
      </div>

      {/* The case-bit trick — the single most memorable idea in this game */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <button onPointerDown={flipCase} style={btn("#7c3aed")}>aA Flip the 32 bit</button>
        {quiz && <button onPointerDown={showMe} style={btn("#f59e0b")}>💡 Show me</button>}
        <button onPointerDown={() => { setN(0); setWon(false); sfx.pop(); }} style={btn("#64748b")}>Clear</button>
      </div>

      {won ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>🎉 That’s {target}!</div>
          <button onPointerDown={newTarget} style={btn("#16a34a")}>Next letter ➜</button>
        </div>
      ) : (
        <div style={{ textAlign: "center", fontSize: 13, color: "#475569", maxWidth: 380, margin: "0 auto" }}>
          {quiz
            ? "Tap the 1/0 buttons until the number matches the letter's number."
            : "A = 65 and a = 97. The difference is 32 — exactly one bit! Tap “Flip the 32 bit” to watch a capital become small."}
        </div>
      )}
    </Stage>
  );
}

function BinaryFlip({ onBack }) {
  // All SEVEN columns, biggest → smallest. 7 bits reach 127, so counting to 100
  // is easy (100 = 64 + 32 + 4). We don't show all seven at once, though...
  const PLACES_ALL = [64, 32, 16, 8, 4, 2, 1];
  const MAX = 127;                          // 7 bits: 0..127, then it wraps back to 0

  const [n, setN] = useState(0);            // the current number, in plain decimal
  const [auto, setAuto] = useState(false);  // "Auto" mode: count up on its own so kids watch it roll
  // How many columns are currently on screen. We START at 4 (the classic 8 4 2 1)
  // and only ever GROW: when a number needs a bigger column, a new one flies in.
  const [maxBits, setMaxBits] = useState(4);
  // Remembers how many columns we showed last time, so we can tell which
  // column(s) are BRAND NEW this render and give them the fly-in animation.
  const prevMax = useRef(4);
  useEffect(() => { prevMax.current = maxBits; });   // runs after each paint

  // How many bits does a number need?  0→1, 15→4, 16→5, 100→7. (log2 + 1.)
  const bitsNeeded = v => (v <= 0 ? 1 : Math.floor(Math.log2(v)) + 1);

  // Move the counter by delta (+1 or -1), wrapping at the ends, growing the display
  // if needed, and making a sound. A move that flips MORE THAN ONE bit is a "carry".
  const go = delta => {
    setN(cur => {
      const next = (cur + delta + (MAX + 1)) % (MAX + 1);       // stay inside 0..127
      setMaxBits(m => Math.max(m, bitsNeeded(next)));           // grow, never shrink
      const flips = (cur ^ next).toString(2).replace(/0/g, "").length; // # of bits changed
      flips > 1 ? sfx.good() : sfx.pop();                       // carry = happier chime
      return next;
    });
  };

  // AUTO mode ticks +1 about every half-second so the rolling is easy to watch.
  useEffect(() => {
    if (!auto) return;                       // only run the timer while Auto is on
    const t = setInterval(() => go(1), 550);
    return () => clearInterval(t);           // clean up when Auto stops / we leave
  }, [auto]);

  // Only show the rightmost `maxBits` columns (e.g. 4 bits → [8,4,2,1]).
  const places = PLACES_ALL.slice(PLACES_ALL.length - maxBits);
  const bits = places.map(p => (n & p) ? 1 : 0);   // is each visible peg ON?
  // The leftmost columns added since last render are the "new" ones → fly them in.
  const newCols = Math.max(0, maxBits - prevMax.current);

  // Shrink the cards as more columns appear so 7 of them still fit a tablet screen.
  const W = maxBits >= 7 ? 40 : maxBits === 6 ? 46 : maxBits === 5 ? 52 : 60;
  const H = Math.round(W * 1.3), FS = Math.round(W * 0.66), GAP = W > 50 ? 10 : 7;

  return (
    <Stage bg="linear-gradient(180deg,#c7d2fe,#ede9fe)" onBack={onBack}>
      <GTitle color="#3730a3">🔢 Binary Flip</GTitle>
      <div style={{ textAlign: "center", color: "#4338ca", fontWeight: 800, marginTop: -4, marginBottom: 12, fontSize: 14 }}>
        Count up high — new bits FLY IN when you need them!
      </div>

      {/* BIG number readout — this is what the lit-up columns add up to */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6d28d9", letterSpacing: 2 }}>THIS MANY</div>
        <div style={{ fontSize: 66, fontWeight: 900, color: "#4c1d95", lineHeight: 1 }}>{n}</div>
      </div>

      {/* The row of flip cards. Tapping anywhere on the row also does +1 (a nice big
          target for little fingers). perspective gives the flip a 3-D feel. */}
      <div onPointerDown={() => go(1)}
        style={{ display: "flex", gap: GAP, justifyContent: "center", cursor: "pointer", perspective: 700, marginBottom: 8, minHeight: H + 26 }}>
        {bits.map((b, i) => {
          const isNew = i < newCols;         // a column that just appeared this turn
          return (
            <div key={places[i]} style={{ textAlign: "center" }}>
              {/* place-value label: 64 32 16 8 4 2 1 (lights up when its bit is ON) */}
              <div style={{ fontSize: W > 50 ? 13 : 11, fontWeight: 800, color: b ? "#7c3aed" : "#a5b4fc", marginBottom: 5 }}>{places[i]}</div>
              {/* THE CARD. key = "place:value" so: (a) when a bit's VALUE changes, its
                  key changes → React remounts it → the flip animation replays (that's
                  the peg turning); (b) a brand-NEW column is a brand-new key → it
                  mounts and plays the FLY-IN animation instead. Still pegs stay put. */}
              <div key={places[i] + ":" + b} style={{
                width: W, height: H, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: FS, fontWeight: 900,
                color: b ? "#ffffff" : "#c7d2fe",
                background: b ? "linear-gradient(180deg,#a78bfa,#6d28d9)" : "#eef2ff",
                border: "2px solid " + (b ? "#6d28d9" : "#c7d2fe"),
                boxShadow: b ? "0 6px 14px rgba(109,40,217,.35)" : "inset 0 2px 6px rgba(0,0,0,.08)",
                animation: isNew ? "ktFlyIn .5s cubic-bezier(.34,1.56,.64,1)" : "ktFlipIn .28s ease",
              }}>{b}</div>
            </div>
          );
        })}
      </div>

      {/* THE "WHY": add up only the ON columns, e.g. 64 + 32 + 4 = 100. The payoff. */}
      <div style={{ textAlign: "center", minHeight: 26, marginBottom: 14, fontSize: 16, fontWeight: 800, color: "#4338ca", padding: "0 8px" }}>
        {n === 0 ? "all OFF = 0" : places.filter((_, i) => bits[i]).join(" + ") + " = " + n}
      </div>

      {/* Controls: +1 is the star; -1, Auto and Reset help exploring. */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={() => go(1)}  style={{ ...btn("#22c55e"), fontSize: 20, padding: "12px 26px" }}>+1 ▶</button>
        <button onClick={() => go(-1)} style={{ ...btn("#f59e0b"), fontSize: 20, padding: "12px 20px" }}>-1</button>
        <button onClick={() => setAuto(a => !a)} style={{ ...btn(auto ? "#ef4444" : "#3b82f6"), fontSize: 16, padding: "12px 18px" }}>{auto ? "⏸ Stop" : "▶ Auto"}</button>
        <button onClick={() => { setN(0); setMaxBits(4); setAuto(false); sfx.tap(); }} style={{ ...btn("#e5e7eb", "#374151"), fontSize: 16, padding: "12px 18px" }}>↺ Reset</button>
      </div>
    </Stage>
  );
}

const GAME_MAP = {
  abc: ABCExplorer, nums: NumberTap, shapes: ShapeWorld,
  // Bonus games (Ages 3-5): colourful toys, physics & learning
  b_balloon: BalloonPop, b_bubble: BubbleWrap, b_splash: ColorSplash, b_peek: Peekaboo, b_stack3: StackBlocks,
  b_star: CatchStar, b_paint: FingerPaint, b_shapes3: PopShapes, b_duck: FeedDuck, b_sound: SoundBoard,
  b_countpop: CountPop, b_adddots: AddDots, b_lettercatch: LetterCatch, b_bigsmall: BigSmall, b_magnet: MagnetDrag,
  b_crane: TowerCrane, b_gravdrop: GravityDrop, b_abpat: ABPattern, b_case: CaseMatch, b_order: NumberOrder,
  b_mathpop: MathPop, b_rhyme: RhymeTime, b_gravlab: GravityLab, b_pstack: PhysicsStack, b_missing: MissingLetter,
  b_balance: BalanceScale, b_numline: NumberLine, b_shapefit: ShapeFit, b_plinko: MarbleDrop, b_bounce: BounceHouse, bflip: BinaryFlip,
  b_numvis: NumberLineAddSub,
  bletter: LetterBits,
  keys: KeyboardAdv, words: WordBuilder, sounds: SoundSafari, math1: MathSprouts,
  math2: MathQuest, term1: FirstTerminal, patt: PatternLab, read: ReadingRockets,
  math3: MathNinja, term2: TerminalPro, code1: CodeBlocks, ciph: CipherLab,
  type: TypingRacer, story: StoryScramble, lgates: LogicGates, bin1: BinaryBasics, geo: GeoExplorer,
  py: PythonStarter, net: NetworkExplorer, bug: BugHunter, aiw: AIWhisperer,
  html: HTMLBuilder, cssp: CSSPainter, jsb: JSBasics, hex: BinaryHexLab, sql: SQLIntro,
  git: GitControl, regex: RegexRanger, apix: APIExplorer, linux: LinuxDeepDive,
  fw: FirewallConcepts, pass: PasswordSecurity, soc: SocialEngineering,
  pkt: PacketInspector, enc: EncryptionWorkshop, ctf: CTFArena, aibd: AIBiasDetector,
  // Age 7 guided tutorials (each renders the shared StepTutorial with its def):
  t_term: p => <StepTutorial def={TUTORIALS.t_term} {...p} />,
  t_py: p => <StepTutorial def={TUTORIALS.t_py} {...p} />,
  t_html: p => <StepTutorial def={TUTORIALS.t_html} {...p} />,
  t_bin: p => <StepTutorial def={TUTORIALS.t_bin} {...p} />,
  t_ciph: p => <StepTutorial def={TUTORIALS.t_ciph} {...p} />,
  t_sql: p => <StepTutorial def={TUTORIALS.t_sql} {...p} />,
  t_regex: p => <StepTutorial def={TUTORIALS.t_regex} {...p} />,
  t_ctf: p => <StepTutorial def={TUTORIALS.t_ctf} {...p} />,
};

const GAMES_BY_AGE = {
  "3": [
    { id: "abc",    e: "🔤", t: "ABC Explorer",     d: "Tap letters & meet animal friends!" },
    { id: "nums",   e: "🔢", t: "Number Tap",        d: "Count animals and match!" },
    { id: "shapes", e: "🔷", t: "Shape World",        d: "Find and match shapes!" },
    { id: "b_balloon", e: "🎈", t: "Balloon Pop",   d: "Pop the floating balloons!" },
    { id: "b_bubble",  e: "🫧", t: "Bubble Wrap",    d: "Pop every bubble — so fun!" },
    { id: "b_splash",  e: "🌈", t: "Color Splash",   d: "Tap to splash rainbows!" },
    { id: "b_peek",    e: "🐾", t: "Peekaboo",       d: "Tap boxes to find animals!" },
    { id: "b_stack3",  e: "🧱", t: "Block Stacker",  d: "Tap to stack blocks high!" },
    { id: "b_star",    e: "⭐", t: "Catch the Star", d: "Tap the moving star!" },
    { id: "b_paint",   e: "🎨", t: "Finger Paint",   d: "Drag to paint anything!" },
    { id: "b_shapes3", e: "🔵", t: "Shape Pop",      d: "Pop the shapes that appear!" },
    { id: "b_duck",    e: "🐤", t: "Feed the Duck",  d: "Drag food to the duck!" },
    { id: "b_sound",   e: "🎹", t: "Sound Board",    d: "Tap keys to make music!" },
    { id: "b_numvis",  e: "🐇", t: "Number Line Hop", d: "Hop to add and subtract!" },
  ],
  "4": [
    { id: "keys",  e: "⌨️", t: "Keyboard Adventure", d: "Press keys for surprises!" },
    { id: "words", e: "📝", t: "Word Builder",        d: "Build 3-letter CVC words!" },
    { id: "sounds",e: "🔊", t: "Sound Safari",        d: "Learn 36 English phonemes!" },
    { id: "math1", e: "➕", t: "Math Sprouts",        d: "Simple adding & subtracting!" },
    { id: "b_countpop",    e: "🔟", t: "Count & Pop",   d: "Pop the right number!" },
    { id: "b_adddots",     e: "➕", t: "Add the Dots",  d: "Count dots to add!" },
    { id: "b_lettercatch", e: "🔤", t: "Letter Catch",  d: "Tap the matching letter!" },
    { id: "b_bigsmall",    e: "🐘", t: "Big or Small",  d: "Tap bigger or smaller!" },
    { id: "b_magnet",      e: "🧲", t: "Sort It",       d: "Drag things to the right bin!" },
    { id: "b_crane",       e: "🏗️", t: "Crane Stacker", d: "Drop blocks from the crane!" },
    { id: "b_gravdrop",    e: "🌠", t: "Gravity Drop",  d: "Drop balls, watch them bounce!" },
    { id: "b_abpat",       e: "🔺", t: "Pattern Pop",   d: "Finish the shape pattern!" },
    { id: "b_case",        e: "🅰️", t: "Letter Match",  d: "Match big & small letters!" },
    { id: "b_order",       e: "🔢", t: "Number Order",  d: "Tap 1, 2, 3 in order!" },
  ],
  "5": [
    { id: "math2", e: "🧮", t: "Math Quest",          d: "Addition & subtraction hero!" },
    { id: "term1", e: "💾", t: "My First Terminal",    d: "Real Linux commands!" },
    { id: "patt",  e: "🎨", t: "Pattern Lab",          d: "Complete color sequences!" },
    { id: "read",  e: "📖", t: "Reading Rockets",       d: "Sight words & sentences!" },
    { id: "b_mathpop",  e: "➗", t: "Math Pop",       d: "Pop the answer balloon!" },
    { id: "b_rhyme",    e: "📖", t: "Rhyme Time",     d: "Find the word that rhymes!" },
    { id: "b_gravlab",  e: "🪐", t: "Gravity Lab",    d: "Change gravity & explore!" },
    { id: "b_pstack",   e: "🗼", t: "Tower Physics",  d: "Stack blocks — don't topple!" },
    { id: "b_missing",  e: "🔡", t: "Missing Letter", d: "Fill the missing letter!" },
    { id: "b_balance",  e: "⚖️", t: "Balance It",     d: "Make both sides equal!" },
    { id: "b_numline",  e: "🎯", t: "Number Line",    d: "Hop to the right number!" },
    { id: "b_shapefit", e: "🧩", t: "Shape Fit",      d: "Drag shapes into holes!" },
    { id: "b_plinko",   e: "🌀", t: "Marble Drop",    d: "Drop it & watch it fall!" },
    { id: "b_bounce",   e: "🤸", t: "Bounce!",        d: "Tap to jump — just for fun!" },
    { id: "bflip",      e: "🔢", t: "Binary Flip",   d: "Count to 100 — bits fly in as you climb!" },
  ],
  "6": [
    { id: "math3", e: "🥷", t: "Math Ninja",           d: "Multiply and conquer!" },
    { id: "term2", e: "🖥️", t: "Terminal Pro",         d: "Advanced command mastery!" },
    { id: "code1", e: "🧩", t: "Code Blocks",          d: "Visual logic programming!" },
    { id: "ciph",  e: "🔐", t: "Cipher Lab",           d: "Encode secret messages!" },
    { id: "type",  e: "🏎️", t: "Typing Racer",        d: "Speed typing challenge!" },
    { id: "story", e: "📚", t: "Story Scramble",        d: "Unscramble sentences!" },
    { id: "lgates",e: "⚙️", t: "Logic Gates",          d: "AND OR NOT switches!" },
    { id: "bin1",  e: "🔢", t: "Binary Basics",         d: "Count in 0s and 1s!" },
    { id: "bletter", e: "🔤", t: "Letter Bits",       d: "Turn bits into A B C!" },
    { id: "geo",   e: "🌍", t: "Geo Explorer",          d: "World capitals quiz!" },
  ],
  "7": [
    { id: "t_term",  e: "🐧", t: "Linux Class",   d: "A full mini Linux class — 14 commands!" },
    { id: "t_py",    e: "🐍", t: "Python Class",  d: "Write AND run real Python!" },
    { id: "t_ciph",  e: "🔐", t: "Cipher Class",  d: "Make & reverse secret codes!" },
    { id: "t_html",  e: "📄", t: "HTML Class",    d: "Build web pages with tags!" },
    { id: "t_bin",   e: "🔢", t: "Binary Class",  d: "Master 1s, 0s and bytes!" },
    { id: "t_sql",   e: "🗄️", t: "SQL Class",     d: "Query a real database!" },
    { id: "t_regex", e: "🔍", t: "Regex Class",   d: "Master search patterns!" },
    { id: "t_ctf",   e: "🚩", t: "Decode Class",  d: "Crack codes — the capstone!" },
  ],
  "8": [
    { id: "py",    e: "🐍", t: "Python Starter",       d: "Write & run Python!" },
    { id: "net",   e: "🌐", t: "Network Explorer",      d: "How the internet works!" },
    { id: "bug",   e: "🐛", t: "Bug Hunter",            d: "Find bugs in code!" },
    { id: "aiw",   e: "🤖", t: "AI Whisperer",          d: "Master prompt engineering!" },
    { id: "html",  e: "📄", t: "HTML Builder",          d: "Write HTML, see it live!" },
    { id: "cssp",  e: "🎨", t: "CSS Painter",           d: "Style elements with CSS!" },
    { id: "jsb",   e: "⚡", t: "JS Basics",             d: "Variables & functions!" },
    { id: "hex",   e: "🔣", t: "Binary & Hex Lab",       d: "Convert number systems!" },
    { id: "sql",   e: "🗄️", t: "SQL Intro",            d: "Query databases!" },
    { id: "git",   e: "🌿", t: "Git Control",           d: "Commits & branches!" },
    { id: "regex", e: "🔍", t: "Regex Ranger",          d: "Pattern matching!" },
    { id: "apix",  e: "📡", t: "API Explorer",          d: "HTTP requests & responses!" },
    { id: "linux", e: "🐧", t: "Linux Deep Dive",        d: "Advanced terminal!" },
    { id: "fw",    e: "🔥", t: "Firewall Concepts",      d: "Network security rules!" },
    { id: "pass",  e: "🔑", t: "Password Security",      d: "Hashing & entropy!" },
    { id: "soc",   e: "🎭", t: "Social Engineering",     d: "Spot phishing attacks!" },
    { id: "pkt",   e: "📦", t: "Packet Inspector",       d: "How data travels networks!" },
    { id: "enc",   e: "🔒", t: "Encryption Workshop",    d: "Keys & ciphers!" },
    { id: "ctf",   e: "🚩", t: "CTF Arena",              d: "Capture-the-flag puzzles!" },
    { id: "aibd",  e: "🧠", t: "AI Bias Detector",       d: "Find AI flaws!" },
  ],
};

const AGE_META = {
  "3": { emoji: "🐣", title: "Age 3",  sub: "Tiny Explorers",  bg: "linear-gradient(135deg,#ffb3c1,#ffe066)", dark: false },
  "4": { emoji: "🌱", title: "Age 4",  sub: "Growing Minds",   bg: "linear-gradient(135deg,#a8f7a6,#67e8d5)", dark: false },
  "5": { emoji: "🚀", title: "Age 5",  sub: "Junior Techies",  bg: "linear-gradient(135deg,#93c5fd,#818cf8)", dark: false },
  "6": { emoji: "⚡", title: "Age 6",  sub: "Skill Builders",  bg: "linear-gradient(135deg,#c084fc,#f472b6)", dark: false },
  "7": { emoji: "🎓", title: "Age 7",  sub: "Foundations",      bg: "linear-gradient(135deg,#5eead4,#3b82f6)", dark: false },
  "8": { emoji: "💻", title: "Age 8+", sub: "Junior Hackers",  bg: "linear-gradient(135deg,#1f2937,#064e3b)", dark: true  },
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// KIOSK MODE HOOK  (fullscreen + block browser/system shortcuts)
// ═══════════════════════════════════════════════════════════════
// A "kiosk" is a locked-down screen a child can't easily escape.
// The browser only lets JavaScript do SOME of this — see CLAUDE.md for the
// OS-level steps (iPad Guided Access / Android Screen Pinning / Chrome
// --kiosk) that finish the job. This hook does everything the web CAN do:
//   • request true fullscreen (must be triggered by a tap — browser rule)
//   • swallow browser shortcut keys (F1–F12, Ctrl/⌘+S/P/R…, F5 refresh)
//   • block the right-click menu
// It deliberately does NOT block normal letter/number typing, so the typing
// games and terminals still work.

// Cross-browser "go fullscreen on this element" helper.
function requestFS() {
  const el = document.documentElement;              // the whole page
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (fn) { try { fn.call(el); } catch (e) { /* some browsers reject silently */ } }
}
// Are we currently fullscreen?
function isFS() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function useKiosk() {
  useEffect(() => {
    // ---- 1) Block browser shortcut keys -------------------------------
    // We only cancel the browser's DEFAULT action; the keypress still reaches
    // the games, so Keyboard Adventure etc. keep working.
    const onKey = e => {
      const k = e.key;
      const ctrl = e.ctrlKey || e.metaKey;          // ⌘ on Mac, Ctrl elsewhere
      // Function keys F1..F12 (help, dev-tools, etc.)
      const isFn = /^F\d{1,2}$/.test(k);
      // Refresh combos we want to swallow so kids don't reload/lose progress
      const isReload = k === "F5" || (ctrl && (k === "r" || k === "R"));
      // Common "save / print / open / view-source / downloads / find" combos
      const isBrowserCombo = ctrl && ["s","p","o","u","j","g","h","S","P","O","U","J","G","H"].includes(k);
      if (isFn || isReload || isBrowserCombo) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    // ---- 1b) Keyboard-friendliness: when a text field is focused (e.g. the
    // on-screen keyboard slides up and covers the lower half on tablets), scroll
    // that field to the CENTRE so the child can always see what they're typing.
    const onFocus = e => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) {
        setTimeout(() => { try { t.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (err) {} }, 300);
      }
    };
    // ---- 2) Block the right-click context menu ------------------------
    const onCtx = e => e.preventDefault();

    // Attach in the "capture" phase so we see the event before the page does.
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("focusin", onFocus);
    // Cleanup when the app unmounts (good React hygiene).
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("focusin", onFocus);
    };
  }, []);
}

// ═══════════════════════════════════════════════════════════════
// KIOSK LOCK  (forces fullscreen for young ages, re-grabs it if lost)
// ═══════════════════════════════════════════════════════════════
// Honesty check (see CLAUDE.md §6 for the full version): the browser CANNOT
// block the device Home button, the OS app-switcher, or the notification
// shade — those are below the page sandbox and no web API reaches them.
// What THIS hook does is the strongest thing JS/CSS legitimately can:
//   • auto-request fullscreen as soon as a "locked" age is entered
//   • watch for fullscreen being lost (Esc key on a Chromebook, browser UI,
//     etc.) and immediately re-request it, so the app "snaps back" instead
//     of leaving the child looking at browser chrome/tabs
// For a true can't-escape-at-all lock, a parent still needs the OS-level
// tools: iPad Guided Access or Android Screen Pinning (documented in
// CLAUDE.md). This hook is the in-app half of that story.
function useKioskLock(locked) {
  useEffect(() => {
    if (!locked) return;                                // not a locked age — do nothing
    if (!isFS()) requestFS();                            // grab fullscreen right away

    // If fullscreen is ever lost while we're supposed to be locked, the
    // "fullscreenchange" event fires — grab it back on the next tick.
    // (A tiny delay avoids fighting the browser mid-transition.)
    const onFSChange = () => {
      if (!isFS()) setTimeout(() => { if (!isFS()) requestFS(); }, 150);
    };
    document.addEventListener("fullscreenchange", onFSChange);
    document.addEventListener("webkitfullscreenchange", onFSChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFSChange);
      document.removeEventListener("webkitfullscreenchange", onFSChange);
    };
  }, [locked]);
}

// ═══════════════════════════════════════════════════════════════
// DEVICE BACK BUTTON  (hardware/gesture back → app back, not browser history)
// ═══════════════════════════════════════════════════════════════
// Phones/tablets fire a "popstate" event for: the Android hardware/gesture
// back button, a browser's on-screen back button, and Chromebook keyboard
// back. By default that would pop the REAL browser history and either show
// a blank/previous page or leave the app entirely — confusing for a kid app
// running full-screen. Instead we:
//   1) push one dummy history entry every time the app goes "deeper"
//      (home → age menu → game, or age → split-screen)
//   2) listen for popstate and, instead of letting the browser navigate,
//      call the SAME "step back" logic the in-app Back buttons use
//   3) immediately push a fresh dummy entry again, so there's always
//      something on the stack to catch the NEXT back-press too
// Net effect: device back always behaves exactly like tapping "← Back"
// inside the app, and it can never navigate away from KidTech entirely.
function useAppBackButton(depth, stepBack) {
  // depth = a number that changes whenever the on-screen level changes
  // (0 = home, 1 = age menu, 2 = game/split). stepBack = fn to call to go
  // up one level; it's the app's OWN back logic (same as the Back buttons).
  const stepBackRef = useRef(stepBack);
  stepBackRef.current = stepBack;                    // always call the latest version

  useEffect(() => {
    // Push a dummy entry so there's something for the browser to "pop" the
    // very first time the child presses back, even from the home screen.
    // We tag it with our own depth so we could inspect it later if needed.
    window.history.pushState({ ktDepth: depth }, "");

    const onPop = () => {
      // A back-navigation just happened (hardware button, gesture, etc).
      // Undo it from the browser's point of view by re-pushing an entry —
      // this keeps the browser's real history stack from ever running out,
      // so the back button can NEVER exit to a previous site or blank tab.
      window.history.pushState({ ktDepth: depth }, "");
      // Now perform the app's own "go back one level" action.
      stepBackRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [depth]);                                        // re-arm whenever the level changes
}

// ═══════════════════════════════════════════════════════════════
// PARENT GATE  (grown-up check before little kids can exit)
// ═══════════════════════════════════════════════════════════════
// Shown for ages 3–5 whenever the child tries to leave a game or the age menu.
// It asks a multiplication question a young child can't do, so a parent has to
// tap the exit. This is the same idea "kid apps" on app stores use.
function ParentGate({ onPass, onCancel }) {
  // Pick two numbers 6–12 so the product isn't trivial for a 3–5 year old.
  const [a] = useState(() => rnd(6, 12));
  const [b] = useState(() => rnd(6, 12));
  const [val, setVal] = useState("");           // what the grown-up typed
  const [wrong, setWrong] = useState(false);    // show a gentle "try again"
  const answer = a * b;

  const submit = () => {
    if (parseInt(val, 10) === answer) onPass();  // correct → let them out
    else { setWrong(true); setVal(""); }         // wrong → clear and retry
  };
  // On-screen number pad so it works on touch screens with no keyboard.
  const pad = ["1","2","3","4","5","6","7","8","9","⌫","0","OK"];
  const tap = key => {
    setWrong(false);
    if (key === "OK") return submit();
    if (key === "⌫") return setVal(v => v.slice(0, -1));
    if (val.length < 4) setVal(v => v + key);
  };

  return (
    // Full-screen dark overlay so the game behind is hidden.
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.92)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...card, maxWidth: 320, width: "100%", textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 40 }}>🧑‍🍼</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#1f2937", margin: "4px 0" }}>Ask a grown-up!</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
          To leave, please solve: <strong style={{ color: "#4338ca" }}>{a} × {b} = ?</strong>
        </div>
        {/* The typed answer */}
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 4, minHeight: 42,
          color: wrong ? "#dc2626" : "#111827" }}>{val || "•"}</div>
        {wrong && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 6 }}>Not quite — try again</div>}
        {/* Number pad */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "10px 0" }}>
          {pad.map(key => (
            <button key={key} onClick={() => tap(key)}
              style={{ ...btn(key === "OK" ? "#15803d" : "#e5e7eb", key === "OK" ? "white" : "#374151"),
                fontSize: 20, padding: "12px 0" }}>{key}</button>
          ))}
        </div>
        {/* Let the child bail out back into the game safely */}
        <button onClick={onCancel} style={{ ...btn("transparent", "#6b7280"), fontSize: 13 }}>← Stay and keep playing</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INSTRUCTIONS  (how the pages work + how to play every game)
// ═══════════════════════════════════════════════════════════════
// One short "how to play" line per game id. Shown in the Help overlay so
// parents/kids know what each tile does.
const HOWTO = {
  abc: "Tap the big card to cycle A→Z. Each letter shows an animal that starts with it.",
  nums: "Count the animals shown, then tap the matching number 1–8.",
  shapes: "Read the shape name at the top and tap the matching picture.",
  keys: "Press ANY key on the keyboard to see it appear with fun confetti.",
  words: "Look at the picture, then tap letters to spell the 3-letter word. 'Clear' resets.",
  sounds: "Browse 36 English sounds (phonemes). Use the filter buttons and Prev/Next arrows.",
  math1: "Read the small addition/subtraction problem and tap the right answer.",
  math2: "Bigger add & subtract problems — tap one of the four answers.",
  term1: "A safe pretend Linux terminal. Type 'help', then try 'ls' and 'cat hello.txt'.",
  patt: "Look at the color pattern, work out what comes next, and tap that color.",
  read: "Find the highlighted sight-word inside the sentence by tapping it below.",
  math3: "Add, subtract AND multiply. Tap the correct answer to score.",
  term2: "A richer terminal. Type 'help', explore files, and find the hidden flag!",
  code1: "Click blocks to build a program, press ▶ Run to see what it does.",
  ciph: "Slide the shift and type a message to encode/decode a Caesar cipher.",
  type: "Type each word then press Space/Enter. Score as many as you can in 30s.",
  story: "Tap the scrambled words in the right order to rebuild the sentence.",
  lgates: "Flip the two switches and watch how AND/OR/NOT/XOR outputs change.",
  bin1: "Convert numbers to/from binary (base-2). Type your answer and press Check.",
  geo: "Read the country and tap its correct capital city.",
  py: "Write real (simplified) Python and press ▶ Run. Try the example buttons first.",
  net: "Read the OSI network layers, then take the quiz to test yourself.",
  bug: "Read the buggy code, describe the bug in the box, and reveal the answer.",
  aiw: "Learn prompt-engineering: rewrite weak prompts into strong ones.",
  html: "Edit HTML on the left and watch the live page update instantly.",
  cssp: "Edit HTML + CSS and see your styled page render live.",
  jsb: "Write JavaScript and press ▶ Run to see console output.",
  hex: "Convert between decimal, binary, hex and octal — plus a challenge mode.",
  sql: "Run real SELECT queries against a tiny sample database.",
  git: "Practice Git in a safe terminal: init, add, commit, branch, merge.",
  regex: "Write a regular expression that matches the target text exactly.",
  apix: "Send pretend HTTP requests and read the JSON responses & status codes.",
  linux: "Advanced Linux terminal — ps, top, netstat, curl, grep and more.",
  fw: "Decide ALLOW or BLOCK for each firewall rule and learn why.",
  pass: "Type a password to see its strength, entropy and crack-time estimate.",
  soc: "Read each message and decide: is it legit, or a phishing scam?",
  pkt: "Step through how data travels the internet, from URL to rendered page.",
  enc: "Play with a Caesar cipher and learn real encryption concepts.",
  ctf: "Capture-the-flag: decode reverse/ROT13/binary/hex/Base64 puzzles.",
  aibd: "Read an AI answer and identify which kind of bias it shows.",
  t_term: "Linux class: where to GET a terminal (even on a tablet), then 14 real commands (ls, cd, grep, chmod, pipes…).",
  t_py: "Python class: install Python, open a terminal and RUN a .py file (computer OR tablet), plus print, variables, if, loops & functions.",
  t_ciph: "Cipher class: make and reverse secret codes with caesar, rot13, atbash, reverse & base64.",
  t_html: "HTML class: tags & headings, then SAVE index.html and open it in a browser to see your page live — computer or tablet.",
  t_bin: "Binary class: read & write 1s and 0s, and learn what a byte is.",
  t_sql: "SQL class: SELECT, columns, WHERE, ORDER BY and LIMIT.",
  t_regex: "Regex class: what it's for, WHERE you type it, that it's not Linux-only, plus \\d, \\w, +, [abc], {n} and g/i flags.",
  t_ctf: "Decode capstone: reverse, ROT13, Base64 — and using the terminal to crack them.",
  b_balloon: "Tap the balloons drifting up the screen to pop them.",
  b_bubble: "Tap each bubble to pop it — clear the whole sheet!",
  b_splash: "Tap anywhere to splash a burst of colour. Just for fun.",
  b_peek: "Tap a box to peek at the animal hiding inside.",
  b_stack3: "Tap to drop the sliding block onto the growing tower.",
  b_star: "Tap the star as it bounces around the screen.",
  b_paint: "Pick a colour, then drag across the grid to paint.",
  b_shapes3: "Tap the colourful shapes as they pop up.",
  b_duck: "Drag each food onto the duck to feed it.",
  b_sound: "Tap the coloured keys to play musical notes.",
  b_numvis: "Tap ▶ Show Me to watch the bunny hop out the sum, or hop it yourself!",
  bletter: "Tap the 1/0 columns to build a number. 65 shows an A! The 32 bit swaps CAPITAL and small.",
  b_countpop: "Pop EXACTLY the number of bubbles shown, then press Check.",
  b_adddots: "Count the red and blue dots, then tap the total.",
  b_lettercatch: "Tap every falling letter that matches the target.",
  b_bigsmall: "Tap the bigger (or smaller) animal as asked.",
  b_magnet: "Drag each item into the correct bin (food or toys).",
  b_crane: "Tap to drop the swinging crane block onto the stack.",
  b_gravdrop: "Tap the sky to drop balls and watch gravity bounce them.",
  b_abpat: "Look at the A-B pattern and tap what comes next.",
  b_case: "Match the big capital letter to its small letter.",
  b_order: "Tap the numbered bubbles in order: 1, 2, 3…",
  b_mathpop: "Solve the sum and pop the balloon with the answer.",
  b_rhyme: "Tap the word that rhymes with the target word.",
  b_gravlab: "Slide gravity & bounce, then tap to drop balls and explore.",
  b_pstack: "Drag blocks onto the tower — keep them centred or they topple!",
  b_missing: "Look at the picture and tap the missing letter.",
  b_balance: "Add or remove apples until both sides match.",
  b_numline: "Hop the frog left/right to land on the target number.",
  b_shapefit: "Drag each shape into its matching hole.",
  b_plinko: "Drop the marble and watch it bounce down into a bin.",
  b_bounce: "Tap to make the character jump. No goal — just bouncy fun!",
  bflip: "Press +1 (or tap the cards) to count. Watch bits flip like a car odometer, and a NEW bit fly in each time the number outgrows its columns (up to 100+).",
};

// ═══════════════════════════════════════════════════════════════
// LESSONS  ("📚 Lesson" button content for Age 6 & Age 8+ games)
// ═══════════════════════════════════════════════════════════════
// Some games teach by doing (their instruction is already built in). For the
// games that are mostly practice/quiz, we attach a short LESSON a child can
// read first. Each lesson = a list of {h: heading, p: paragraph, code: sample}.
// The 📚 button in the toolbar opens the lesson for the current game.
const LESSONS = {
  // ---------- AGE 6 ----------
  math3: { emoji: "🥷", title: "Math Ninja — Multiplication", body: [
    { h: "What multiplication means", p: `Multiplying is just FAST repeated adding.\n4 × 3 means "add 4, three times": 4 + 4 + 4 = 12.\nSo 4 × 3 and 3 × 4 both equal 12 — order doesn't matter.` },
    { h: "Ninja shortcuts", p: `× 2  → double it (6 → 12)\n× 10 → add a zero (7 → 70)\n× 5  → do × 10 then take half (6×5 = 60 ÷ 2 = 30)\n× 9  → do × 10 then subtract one group (7×9 = 70 − 7 = 63)` },
    { h: "Your mission", p: `Read the problem, pick a shortcut in your head, then tap the answer. Accuracy first — speed comes with practice!` },
  ]},
  term2: { emoji: "🖥️", title: "Terminal Pro — Talking to Computers", body: [
    { h: "What is a terminal?", p: `A terminal (or "shell") lets you type commands to control a computer with words instead of clicking. Every pro developer uses one.` },
    { h: "Core commands", p: `pwd  → print working directory (where am I?)\nls   → list files here (ls -la shows hidden ones)\ncd   → change directory (move into a folder)\ncat  → show a file's contents` },
    { h: "Hidden files", p: `Files starting with a dot (like .hidden_flag) are "hidden". Use ls -la to reveal them, then cat to read them. Your goal: find the flag!` },
    { h: "New: cipher tools", p: `This terminal can encode/decode secret messages. Type help to see them.`, code: `caesar 3 hello      -> khoor\ncaesar -d 3 khoor   -> hello\nrot13 Uryyb         -> Hello\nbase64 hi           -> aGk=` },
  ]},
  code1: { emoji: "🧩", title: "Code Blocks — How Programs Think", body: [
    { h: "Programs = instructions in order", p: `A computer does exactly what you tell it, one step at a time, top to bottom. That ordered list of steps is an algorithm.` },
    { h: "The 4 building blocks", p: `SEQUENCE  → steps run in order\nLOOP      → repeat steps (REPEAT 3 TIMES)\nCONDITION → choose (IF score > 5 ...)\nVARIABLE  → remember a value (SET x = 10)` },
    { h: "Try it", p: `Stack blocks, press ▶ Run, and watch each block act. Change the order and the result changes — just like real code!` },
  ]},
  ciph: { emoji: "🔐", title: "Cipher Lab — Secret Messages", body: [
    { h: "What is a cipher?", p: `A cipher scrambles a message so only someone with the "key" can read it. The Caesar cipher shifts every letter forward by the key number.` },
    { h: "Example (key = 3)", p: `A→D, B→E, C→F ... so "HI" becomes "KL". To read it back, shift the SAME amount backwards.` },
    { h: "Why it's weak", p: `There are only 25 possible shifts, so anyone can try them all ("brute force") in seconds. Real apps use much stronger math (see Encryption Workshop).` },
    { h: "Tip", p: `Terminal Pro has a matching command: caesar 3 <text> and caesar -d 3 <text>. Try encoding a note, then decoding it!` },
  ]},
  type: { emoji: "🏎️", title: "Typing Racer — Touch Typing", body: [
    { h: "The home row", p: `Rest your fingers on A S D F (left hand) and J K L ; (right hand). Feel the little bumps on F and J — they help you find home without looking.` },
    { h: "Don't look down", p: `Looking at your fingers slows you down. Trust your hands. It feels hard at first, then suddenly clicks.` },
    { h: "Accuracy beats speed", p: `Typing fast with mistakes is slower overall. Aim for correct first; speed (words-per-minute) grows naturally with practice.` },
  ]},
  story: { emoji: "📚", title: "Story Scramble — Building Sentences", body: [
    { h: "A sentence tells who did what", p: `Most sentences have a SUBJECT (who/what) and a VERB (the action):  "The cat  sat."  →  subject: the cat, verb: sat.` },
    { h: "Word order matters", p: `"The dog chased the cat" is very different from "The cat chased the dog"! English usually goes subject → verb → object.` },
    { h: "Rules of the road", p: `Start with a CAPITAL letter and end with a period ( . ). Use the hint to figure out the meaning, then order the words so it reads correctly.` },
  ]},
  lgates: { emoji: "⚙️", title: "Logic Gates — How Computers Decide", body: [
    { h: "Everything is 1 or 0", p: `Inside a computer, ON = 1 = true and OFF = 0 = false. Logic gates combine these true/false signals to make decisions.` },
    { h: "The main gates", p: `AND → true only if BOTH inputs are true\nOR  → true if EITHER input is true\nNOT → flips it (true↔false)\nXOR → true if inputs are DIFFERENT` },
    { h: "Why it matters", p: `Millions of tiny gates on a chip, wired together, add numbers and run every app you use. Flip the switches in the game and watch each gate react!` },
  ]},
  bin1: { emoji: "🔢", title: "Binary Basics — Counting in 1s and 0s", body: [
    { h: "Why computers use binary", p: `A wire is either ON or OFF — 1 or 0. So computers count using only two digits. That's called binary (base-2).` },
    { h: "Place values double", p: `In our normal numbers each place is ×10. In binary each place DOUBLES:  16  8  4  2  1.\nTo build a number, turn on the bits that add up to it.` },
    { h: "Example", p: `13 = 8 + 4 + 1 → turn on those bits → 0 1 1 0 1\nSo 13 in binary is 01101.`, code: `place:  16  8  4  2  1\nbits:    0  1  1  0  1  = 8+4+1 = 13` },
  ]},
  geo: { emoji: "🌍", title: "Geo Explorer — Countries & Capitals", body: [
    { h: "Countries and capitals", p: `The world is split into ~195 countries. Each has a CAPITAL — the city where its government works (like Paris for France).` },
    { h: "Capital ≠ biggest city", p: `Surprise! The capital isn't always the largest city. The USA's capital is Washington D.C., not New York. Australia's is Canberra, not Sydney.` },
    { h: "Remember with clues", p: `Link a country to a picture or fact (🗼 Paris, 🗽 Washington). In the game, match each country to its capital and the pairs will start to stick.` },
  ]},

  // ---------- AGE 8+ ----------
  py: { emoji: "🐍", title: "Python Starter — Your First Language", body: [
    { h: "What is Python?", p: `Python is a popular, readable programming language used for websites, games, science and AI. You write instructions; the computer runs them.` },
    { h: "The basics", p: `print(...) shows text. Variables remember values. Text goes in quotes ("a string"); numbers don't. A for-loop repeats.`, code: `name = "Alex"      # a variable\nprint("Hi " + name)\nfor i in range(3): # repeats 3 times\n    print(i)       # note the indentation!` },
    { h: "Indentation is not optional", p: `Python uses spaces at the start of a line to show what's "inside" a loop or if. Line them up or you'll get an error.` },
    { h: "How to run it for real", p: `Save your code as hello.py, open a terminal, and type:  python hello.py. On Windows get Python free from python.org (Mac & Linux already have it). No computer? Run Python in a browser at replit.com, or use the Pydroid 3 app (Android) / a-Shell (iPad).` },
  ]},
  net: { emoji: "🌐", title: "Network Explorer — How the Internet Works", body: [
    { h: "A network of computers", p: `The internet is millions of computers connected together. Your device (the CLIENT) asks a SERVER for a web page; the server sends it back.` },
    { h: "Packets and IP addresses", p: `Data is chopped into small PACKETS. Every device has an IP ADDRESS (like a postal address) so packets know where to go.` },
    { h: "The OSI layers", p: `Networking is built in layers, each doing one job — from the physical wires up to the apps you see. The game lets you tap each layer to explore it, then quiz yourself.` },
  ]},
  bug: { emoji: "🐛", title: "Bug Hunter — Debugging Code", body: [
    { h: "Three kinds of bugs", p: `SYNTAX error → you broke the language rules (missing colon).\nRUNTIME error → it crashes while running (divide by zero).\nLOGIC error → it runs but gives the wrong answer.` },
    { h: "Read the error, top to bottom", p: `Error messages point at the line and problem. Read code in order — a variable must exist BEFORE you use it.` },
    { h: "Classic Python traps", p: `Forgetting the : after for/if/def\nUsing = (assign) instead of == (compare)\nWrong indentation\nAdding a number to text without str()` },
  ]},
  aiw: { emoji: "🤖", title: "AI Whisperer — Prompt Engineering", body: [
    { h: "Why prompts matter", p: `An AI does what you ask — so asking well gets far better answers. This skill is called prompt engineering.` },
    { h: "5 power moves", p: `1) Be specific (audience, length, topic)\n2) Give it a role ("You are a math tutor…")\n3) Ask for steps ("show your working")\n4) Give an example of what you want\n5) Set the format ("answer as a bullet list")` },
    { h: "Always verify", p: `AI can sound confident but be WRONG (a "hallucination"). Check important facts yourself before trusting them.` },
  ]},
  html: { emoji: "📄", title: "HTML Builder — The Skeleton of Web Pages", body: [
    { h: "HTML = structure", p: `HTML uses TAGS to label parts of a page. Most tags come in pairs: an opening <p> and a closing </p> wrap around content.` },
    { h: "Common tags", p: `<h1> big heading  <p> paragraph\n<ul><li> bullet list  <a href> link  <img> image\n<strong> bold text`, code: `<h1>My Page</h1>\n<p>Hello <strong>world</strong>!</p>\n<ul><li>Pizza</li><li>Code</li></ul>` },
    { h: "Attributes", p: `Tags can carry extra info called attributes, like the web address in <a href="...">. Edit the code and watch the live page change!` },
    { h: "See it live on YOUR device", p: `Save your tags in a file named index.html and double-click it — it opens in your browser with no internet needed (that's "running it locally"). Then edit the file, save, and hit Refresh to watch changes appear instantly. On a tablet, use a live online editor like CodePen.io instead.` },
  ]},
  cssp: { emoji: "🎨", title: "CSS Painter — Styling Web Pages", body: [
    { h: "CSS = looks", p: `HTML builds the structure; CSS paints it — colours, sizes, spacing, fonts. Together they make every website you see.` },
    { h: "Rules: selector + properties", p: `Pick something (a selector), then set property: value pairs inside { }.`, code: `.box {\n  background: coral;   /* colour */\n  padding: 20px;       /* space inside */\n  border-radius: 10px; /* round corners */\n}` },
    { h: "The box model", p: `Every element is a box: content, then padding (space inside), then border, then margin (space outside). Tweak the CSS and watch it react instantly.` },
  ]},
  jsb: { emoji: "⚡", title: "JS Basics — Making Pages Interactive", body: [
    { h: "JavaScript = behaviour", p: `HTML is structure, CSS is style, JavaScript is ACTION — it makes buttons work, checks answers, updates the page live.` },
    { h: "The essentials", p: `let/const store values. Functions do a job when called. console.log prints. Arrays hold lists. Loops repeat.`, code: `let name = "Alex";\nfunction greet(who) {\n  return "Hi, " + who + "!";\n}\nconsole.log(greet(name));` },
    { h: "Runs in the browser", p: `The same JavaScript in this app powers real websites. Press ▶ Run to see your console output.` },
  ]},
  hex: { emoji: "🔣", title: "Binary & Hex Lab — Number Systems", body: [
    { h: "Different bases", p: `Decimal (base-10) uses 0–9. Binary (base-2) uses 0–1. HEX (base-16) uses 0–9 then A–F, where A=10 … F=15.` },
    { h: "Why hex exists", p: `Binary is long and hard to read. One hex digit = exactly 4 binary bits, so hex is a short way to write binary.`, code: `binary  1111 = hex F = decimal 15\nbinary  1010 = hex A = decimal 10` },
    { h: "You've seen it", p: `Colours on the web are hex! #FF0000 = red (FF red, 00 green, 00 blue). Memory addresses use hex too.` },
  ]},
  sql: { emoji: "🗄️", title: "SQL Intro — Asking Databases Questions", body: [
    { h: "Data lives in tables", p: `A database stores info in TABLES — like a spreadsheet with rows (records) and columns (fields). SQL is the language to ask it questions.` },
    { h: "The SELECT recipe", p: `SELECT which columns\nFROM which table\nWHERE a condition is true\nORDER BY a column, LIMIT how many.`, code: `SELECT name, age FROM users\nWHERE city = 'NYC'\nORDER BY age\nLIMIT 3;` },
    { h: "Try it", p: `Use the example buttons, then change the WHERE value or column names and re-run to see the results update.` },
  ]},
  git: { emoji: "🌿", title: "Git Control — Save Points for Code", body: [
    { h: "What is version control?", p: `Git records SNAPSHOTS of your project so you can undo mistakes, see history, and work with others without overwriting each other.` },
    { h: "The core workflow", p: `init  → start tracking a project\nadd   → stage the changes you want to save\ncommit→ save a snapshot with a message\nlog   → see the history`, code: `git init\ngit add .\ngit commit -m "First version"\ngit log` },
    { h: "Branches", p: `A BRANCH is a parallel copy where you try new ideas safely. When it works, you MERGE it back into the main branch.` },
  ]},
  regex: { emoji: "🔍", title: "Regex Ranger — Pattern Matching", body: [
    { h: "What is a regex?", p: `A regular expression is a tiny pattern language for finding text — like a super-powered Find. Search boxes, form checks and data tools all use it.` },
    { h: "Building blocks", p: `\\d = a digit   \\w = a letter/number   \\s = a space\n. = any char   [abc] = a, b or c\n+ = one-or-more   * = zero-or-more   {3} = exactly 3\n\\b = word edge` },
    { h: "Flags", p: `Add letters after the closing slash: g = find ALL matches, i = ignore CASE.`, code: `/\\d+/g      matches 3 and 12 in "3 cats, 12 dogs"\n/[aeiou]/gi matches every vowel` },
    { h: "Where you type it (NOT Linux-only)", p: `A myth-buster: regex works everywhere — Windows, Mac, phones, even inside your browser. Only the grep command is Linux-flavoured. You'll meet regex in code-editor Find boxes, the grep terminal command, and inside almost every language (Python, JavaScript…). Try patterns live at regex101.com.` },
  ]},
  apix: { emoji: "📡", title: "API Explorer — How Apps Talk", body: [
    { h: "What is an API?", p: `An API is how one program asks another for data or actions. Your weather app calls a weather API; it doesn't measure the sky itself.` },
    { h: "HTTP methods", p: `GET → read data\nPOST → create something\nPUT → update it\nDELETE → remove it` },
    { h: "Status codes & JSON", p: `The server replies with a status number and usually JSON data.`, code: `200 OK        it worked\n201 Created   new thing made\n404 Not Found nothing there\n403 Forbidden not allowed` },
  ]},
  linux: { emoji: "🐧", title: "Linux Deep Dive — Power Commands", body: [
    { h: "Linux is everywhere", p: `Most websites, servers, and even Android phones run Linux. Learning its terminal lets you control real machines.` },
    { h: "Inspecting the system", p: `ps aux → running programs (processes)\ntop → live activity monitor\ndf -h → disk space\nnetstat -tulpn → which ports are open` },
    { h: "Permissions & searching", p: `chmod sets who can read/write/run a file (755 is common). grep searches inside files; find locates them.` },
    { h: "Get a terminal anywhere", p: `Mac has "Terminal"; Windows has PowerShell (or install WSL for true Linux); Linux uses Ctrl+Alt+T. On a tablet, Termux (Android) or a-Shell/iSH (iOS) give you a real shell — the very same commands work on all of them.` },
    { h: "New: crypto tools", p: `This terminal also decodes messages — handy for CTF puzzles.`, code: `base64 -d aGk=   -> hi\nrot13 Uryyb      -> Hello\ncaesar -d 3 khoor-> hello` },
  ]},
  fw: { emoji: "🔥", title: "Firewall Concepts — Guarding the Network", body: [
    { h: "What a firewall does", p: `A firewall is a gatekeeper that checks every connection against RULES and decides ALLOW or BLOCK — keeping bad traffic out.` },
    { h: "Ports & protocols", p: `Each service uses a numbered PORT: 80 web (HTTP), 443 secure web (HTTPS), 22 SSH, 53 DNS. Rules act on these ports.` },
    { h: "Default deny", p: `Good security blocks everything by default and only opens what's needed. Watch out for risky ports: 23 (Telnet), 3389 (RDP), 445 (SMB).` },
  ]},
  pass: { emoji: "🔑", title: "Password Security — Strong & Safe", body: [
    { h: "Length beats symbols", p: `A long passPHRASE like "correct-horse-battery-staple" is stronger AND easier to remember than a short "P@ss1".` },
    { h: "Entropy = guessing difficulty", p: `Entropy (in bits) measures how many guesses an attacker needs. Longer + more character types = higher entropy = far longer to crack.` },
    { h: "Golden rules", p: `Use a UNIQUE password per site (a leak on one won't unlock the rest).\nUse a password manager to remember them.\nTurn on 2-factor (2FA) for a second lock.\nSites should store passwords HASHED, never as plain text.` },
  ]},
  soc: { emoji: "🎭", title: "Social Engineering — Hacking People", body: [
    { h: "The weakest link is us", p: `Attackers often trick PEOPLE instead of breaking code. Phishing is a fake message that gets you to click, log in, or pay.` },
    { h: "Red flags", p: `⚠ Urgency/fear ("act now or lose access!")\n⚠ Odd links or look-alike domains (paypa1.xyz)\n⚠ Requests for passwords, codes, or gift cards\n⚠ Spelling mistakes / generic "Dear customer"` },
    { h: "How to stay safe", p: `Slow down. Don't click — go to the site yourself. Verify surprising requests through another channel (call the person). Real companies never ask for your password.` },
  ]},
  pkt: { emoji: "📦", title: "Packet Inspector — A Data Journey", body: [
    { h: "Big data travels small", p: `A web page is too big to send at once, so it's split into many PACKETS that travel separately and get reassembled at the end.` },
    { h: "Every packet has a header", p: `Like an envelope, each packet carries a "from" IP, a "to" IP, and a port number, so routers know where to forward it.` },
    { h: "TCP makes it reliable", p: `TCP numbers the packets, checks they all arrived, and re-requests any that got lost — then puts them back in order. That's why downloads don't come out jumbled.` },
    { h: "Real tools", p: `Engineers watch packets with tools like ping, traceroute and Wireshark. Step through the game to see the whole trip.` },
  ]},
  enc: { emoji: "🔒", title: "Encryption Workshop — Real Secrecy", body: [
    { h: "Encoding vs encryption", p: `Encoding (Base64, hex) just re-writes data — anyone can reverse it. ENCRYPTION scrambles it so ONLY a key can unlock it.` },
    { h: "Two families", p: `SYMMETRIC → one shared key locks & unlocks (fast; AES).\nASYMMETRIC → a public key locks, a private key unlocks (RSA). This is how HTTPS shares keys safely.` },
    { h: "Hashing is one-way", p: `A hash (SHA-256) turns data into a fixed fingerprint you can't reverse — perfect for storing passwords. The Caesar cipher here is a toy to build intuition; real math is unbreakable by hand.` },
  ]},
  ctf: { emoji: "🚩", title: "CTF Arena — Capture The Flag", body: [
    { h: "What is CTF?", p: `Capture-The-Flag is a hacking game: solve a puzzle to reveal a hidden "flag". It's how many security pros practise — legally and for fun.` },
    { h: "Encoding is not encryption", p: `These puzzles use ENCODINGS you can reverse without a secret:\nReverse → read it backwards\nROT13 → shift letters 13\nBinary/Hex → groups become letters\nBase64 → ends in = padding` },
    { h: "Use the terminal!", p: `Open Terminal Pro or Linux Deep Dive and let it do the work for you:`, code: `base64 -d SGk=   -> Hi\nrot13 Uryyb      -> Hello\ncaesar -d 3 khoor-> hello\nreverse !iH      -> Hi!` },
  ]},
  aibd: { emoji: "🧠", title: "AI Bias Detector — Fairness in AI", body: [
    { h: "What is AI bias?", p: `AI learns from human-made data. If that data is unfair or one-sided, the AI copies those patterns — that's bias.` },
    { h: "Types to spot", p: `GENDER BIAS → assuming a job = one gender\nSTEREOTYPE → sweeping claims about a group\nOVERGENERALIZATION → "everyone/always/never"\nFALSE CERTAINTY → guessing stated as fact` },
    { h: "Why it matters", p: `Biased AI can treat people unfairly in real decisions (jobs, loans). Spotting it is the first step to building AI that's fair for everyone.` },
  ]},
};

function LessonModal({ lesson, onClose }) {
  return (
    // Dark full-screen overlay; sits above games but below the parent gate.
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.92)", zIndex: 950,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ ...card, maxWidth: 560, width: "100%", maxHeight: "88vh", overflowY: "auto", padding: 22, cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 21, fontWeight: 900, color: "#1f2937" }}>{lesson.emoji} {lesson.title}</div>
          <button onClick={onClose} style={{ ...btn("#e5e7eb", "#374151"), fontSize: 13 }}>✕ Close</button>
        </div>
        {/* Render each teaching section: heading, paragraph, optional code sample */}
        {lesson.body.map((sec, i) => (
          <div key={i} style={{ marginBottom: 13 }}>
            {sec.h && <div style={{ fontWeight: 800, color: "#4338ca", marginBottom: 3 }}>{sec.h}</div>}
            {sec.p && <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sec.p}</div>}
            {sec.code && <pre style={{ background: "#0f172a", color: "#4ade80", borderRadius: 8, padding: 10, fontSize: 12.5, overflowX: "auto", marginTop: 6, whiteSpace: "pre-wrap" }}>{sec.code}</pre>}
          </div>
        ))}
        <button onClick={onClose} style={{ ...btn("#7c3aed"), marginTop: 2 }}>Got it — back to the game →</button>
      </div>
    </div>
  );
}

function Instructions({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.9)", zIndex: 900,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ ...card, maxWidth: 560, width: "100%", maxHeight: "88vh", overflowY: "auto", padding: 22, cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#1f2937" }}>📖 How KidTech Works</div>
          <button onClick={onClose} style={{ ...btn("#e5e7eb", "#374151"), fontSize: 13 }}>✕ Close</button>
        </div>

        {/* Page-by-page guide */}
        <div style={{ fontWeight: 800, color: "#4338ca", marginTop: 6 }}>The Pages</div>
        <ul style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, paddingLeft: 18 }}>
          <li><strong>Home (Age Picker):</strong> choose an age group (3, 4, 5, 6 or 8+). Each card shows how many games it has.</li>
          <li><strong>Age Menu:</strong> a grid of game tiles for that age. Tap a tile to play. Tap “← All Ages” to return.</li>
          <li><strong>Game Screen:</strong> each game has its own “← Back” button. For Ages 3–4, a grown-up needs to solve a math question to leave the whole <em>age group</em> (Age 5 and up can leave freely).</li>
          <li><strong>☰ Menu (Ages 6–8):</strong> adds a <em>second game</em> beside the one you're on. Either side can load a game from <em>any</em> of Ages 6–8. Panes sit side-by-side on wide screens and top/bottom on tablets — ideal for kiosk mode.</li>
          <li><strong>🎓 Age 7:</strong> step-by-step guided tutorials that spell out how to do the Age 8+ skills, so kids can follow along and then explore for real.</li>
          <li><strong>Fullscreen:</strong> the ⛶ button (or tapping Start) locks the app to fullscreen for a distraction-free, kiosk-style experience.</li>
          <li><strong>📚 Lesson:</strong> on Age 6 and Age 8+ games, the 📚 button opens a “teach-me” lesson explaining the idea behind the game.</li>
        </ul>

        {/* Every game, grouped by age */}
        <div style={{ fontWeight: 800, color: "#4338ca", marginTop: 10 }}>The Games</div>
        {Object.entries(GAMES_BY_AGE).map(([age, games]) => (
          <div key={age} style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>{AGE_META[age].emoji} Age {age === "8" ? "8+" : age}</div>
            {games.map(g => (
              <div key={g.id} style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.5, margin: "3px 0", paddingLeft: 4 }}>
                <strong>{g.e} {g.t}:</strong> {HOWTO[g.id] || g.d}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP  (adds: fullscreen Start gate, PWA install, parent gate, help)
// ═══════════════════════════════════════════════════════════════
function App() {
  const [age, setAge] = useState(null);        // which age menu is open
  const [game, setGame] = useState(null);      // which game is open
  const [started, setStarted] = useState(false); // has the Start gate been passed?
  const [showInfo, setShowInfo] = useState(false); // Help overlay visible?
  const [lessonGame, setLessonGame] = useState(null); // which game's lesson is open (id or null)
  const [split, setSplit] = useState(null);   // age id when in two-game split mode
  const [burger, setBurger] = useState(false); // ☰ dropdown open?
  const [gate, setGate] = useState(null);      // pending parent-gate action (a fn) or null
  const [installEvt, setInstallEvt] = useState(null); // saved PWA install prompt

  useKiosk(); // turn on shortcut-blocking / right-click-blocking for the whole app

  // Capture the browser's "you can install this app" event so we can show our
  // own friendly Install button (PWA / Add-to-Home-Screen).
  useEffect(() => {
    const onBIP = e => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  // Auto-close any open Lesson when the player switches games.
  useEffect(() => { setLessonGame(null); }, [game]);
  // Close the ☰ menu whenever we navigate.
  useEffect(() => { setBurger(false); }, [age, game, split]);

  // Ages that need a grown-up to exit (the parent math-gate). Age 5 no
  // longer needs it — only 3 & 4, which are also the two ages that get
  // fullscreen locked in below.
  const YOUNG = ["3", "4"];
  // Ages where fullscreen is FORCED ON and can't be exited from inside the
  // app (no ⛶ toggle shown). This is the strongest lock the WEB can offer —
  // see useKioskLock's comments for what it can't do (Home button, etc).
  const KIOSK_LOCKED = ["3", "4"];

  // Wrap any "leave" action. For little kids we first show the ParentGate and
  // only run the real action once the grown-up solves the math.
  const guard = action => {
    if (YOUNG.includes(age)) setGate(() => action); // store the fn to run on pass
    else action();                                   // older kids just go
  };

  // ---- DEVICE BACK BUTTON WIRING --------------------------------------------
  // "depth" is just how many levels deep we are (home=0, age menu=1,
  // game or split-screen=2). We feed this to useAppBackButton so it knows
  // when to re-arm the history trap (see the hook's comments above).
  const depth = (game || split) ? 2 : age ? 1 : 0;
  // stepBack() mirrors exactly what each screen's own Back button does,
  // just chosen automatically based on where we currently are. It goes
  // through the SAME guard() the on-screen buttons use, so a 3/4-year-old
  // still needs a grown-up to back out — the device button can't skip that.
  const stepBack = useCallback(() => {
    if (game) { setGame(null); return; }              // game → back to its age menu
    if (split) { guard(() => setSplit(null)); return; } // split → back to age menu
    if (age) { guard(() => setAge(null)); return; }    // age menu → back to home
    // Already at home: nothing further to do — the history trap above
    // ensures the browser never actually leaves the page from here.
  }, [game, split, age, YOUNG]);                       // eslint-safe deps for the closure above
  useAppBackButton(depth, stepBack);
  // When a grown-up passes the parent gate on the ⛶ button we set this true,
  // which SUSPENDS the kiosk lock — otherwise useKioskLock would instantly
  // re-grab fullscreen and the parent could never actually get out.
  const [kioskOff, setKioskOff] = useState(false);
  // Re-arm the lock automatically whenever we move to a different age group,
  // so unlocking once doesn't leave Age 3/4 unlocked forever.
  useEffect(() => { setKioskOff(false); }, [age]);
  // Force + re-grab fullscreen while inside a KIOSK_LOCKED age (3 or 4),
  // unless a parent has just unlocked it.
  useKioskLock(KIOSK_LOCKED.includes(age) && !kioskOff);

  // ---- START GATE ----------------------------------------------------------
  // Fullscreen can only be requested inside a real user tap, so we show a
  // Start screen first. Tapping it enters fullscreen AND reveals the app.
  if (!started) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e1b4b 0%,#065f46 50%,#1e1b4b 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>💻🎮🚀</div>
        <h1 style={{ fontSize: 44, fontWeight: 900, color: "white", margin: 0 }}>KidTech</h1>
        <h2 style={{ fontSize: 18, color: "#a5f3fc", margin: "4px 0 20px" }}>Learning Hub</h2>
        <button onClick={() => { requestFS(); setStarted(true); }}
          style={{ ...btn("#22c55e", "white"), fontSize: 22, padding: "16px 40px", boxShadow: "0 6px 24px rgba(0,0,0,0.4)" }}>
          ▶ Tap to Start
        </button>
        {/* Offer install only if the browser said it's possible */}
        {installEvt && (
          <button onClick={async () => { installEvt.prompt(); setInstallEvt(null); }}
            style={{ ...btn("rgba(255,255,255,0.15)", "white"), fontSize: 14, marginTop: 14 }}>
            ⬇ Install as an App
          </button>
        )}
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 22, maxWidth: 340 }}>
          Starts in fullscreen kiosk mode. On iPad use Guided Access, on Android use Screen Pinning to fully lock the screen (see the guide).
        </p>
      </div>
    );
  }

  // A tiny toolbar shown on every screen: fullscreen toggle + help.
  const Toolbar = () => (
    <div style={{ position: "fixed", top: 8, right: 8, zIndex: 500, display: "flex", gap: 6, alignItems: "flex-start" }}>
      {/* ☰ burger: only on the Age 6/7/8 menu — opens the split-screen option. */}
      {age && ["6", "7", "8"].includes(age) && (
        <div style={{ position: "relative" }}>
          <button title="Menu" onClick={() => setBurger(b => !b)}
            style={{ ...btn("rgba(0,0,0,0.35)", "white"), fontSize: 15, padding: "6px 11px" }}>☰</button>
          {burger && (
            <div style={{ position: "absolute", top: 40, right: 0, background: "white", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.3)", padding: 8, width: 218, zIndex: 600 }}>
              <button onClick={() => { setBurger(false); setSplit(age); }}
                style={{ ...btn("#7c3aed", "white"), width: "100%", fontSize: 13, marginBottom: 6 }}>🔲 Add a Second Game</button>
              <button onClick={() => { setBurger(false); setShowInfo(true); }}
                style={{ ...btn("#e5e7eb", "#374151"), width: "100%", fontSize: 13 }}>❔ How to Use</button>
              <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 6, lineHeight: 1.4 }}>Keeps your current game and adds another beside it — pick from Ages 6–8. Stacks top/bottom on tablets.</div>
            </div>
          )}
        </div>
      )}
      {/* Lesson button appears only on games that have a lesson (Age 6 & 8+). */}
      {game && LESSONS[game] && (
        <button title="Lesson" onClick={() => setLessonGame(game)}
          style={{ ...btn("#7c3aed", "white"), fontSize: 13, padding: "6px 12px", fontWeight: 800 }}>📚 Lesson</button>
      )}
      {/* Fullscreen toggle. On kiosk-locked ages (3 & 4) it shows a 🔒 and is
          routed through the PARENT GATE — a child tapping it just gets the
          math question, but a grown-up can still legitimately get out.
          Passing the gate sets kioskOff so useKioskLock stops re-grabbing
          fullscreen, THEN exits (see the small delay note below). */}
      <button title={KIOSK_LOCKED.includes(age) ? "Fullscreen (grown-ups only)" : "Fullscreen"}
        onClick={() => {
          if (KIOSK_LOCKED.includes(age)) {
            guard(() => {
              setKioskOff(true);
              // Tiny delay so React can tear down useKioskLock's
              // fullscreenchange listener first — otherwise the hook would
              // see us leaving fullscreen and immediately snap it back.
              setTimeout(() => document.exitFullscreen?.(), 60);
            });
          } else {
            isFS() ? document.exitFullscreen?.() : requestFS();
          }
        }}
        style={{ ...btn("rgba(0,0,0,0.35)", "white"), fontSize: 13, padding: "6px 10px" }}>
        {KIOSK_LOCKED.includes(age) ? "🔒⛶" : "⛶"}
      </button>
      <button title="Help" onClick={() => setShowInfo(true)}
        style={{ ...btn("rgba(0,0,0,0.35)", "white"), fontSize: 13, padding: "6px 10px" }}>❔</button>
    </div>
  );

  // Overlays that can appear on top of anything:
  const overlays = (
    <>
      {showInfo && <Instructions onClose={() => setShowInfo(false)} />}
      {lessonGame && LESSONS[lessonGame] && <LessonModal lesson={LESSONS[lessonGame]} onClose={() => setLessonGame(null)} />}
      {gate && (
        <ParentGate
          onPass={() => { const run = gate; setGate(null); run(); }} // solved → do the action
          onCancel={() => setGate(null)}                              // stay in the game
        />
      )}
    </>
  );

  // ---- SPLIT SCREEN (two games at once) ------------------------------------
  if (split) {
    return (
      <>
        <SplitView startGame={game} onExit={() => setSplit(null)} onLesson={id => setLessonGame(id)} />
        {overlays}
      </>
    );
  }

  // ---- GAME SCREEN ---------------------------------------------------------
  if (game) {
    const GameComp = GAME_MAP[game];
    if (!GameComp) return <div onClick={() => setGame(null)} style={{ padding: 40, textAlign: "center", cursor: "pointer", color: "red" }}>Game not found. Click to go back.</div>;
    // The game's own Back button is routed through guard() → parent gate for young ages.
    return (
      <>
        <Toolbar />
        <GameComp onBack={() => setGame(null)} />
        {overlays}
      </>
    );
  }

  // ---- AGE MENU ------------------------------------------------------------
  if (age) {
    const meta = AGE_META[age];
    const games = GAMES_BY_AGE[age] || [];
    return (
      <div style={{ minHeight: "100vh", background: meta.bg, padding: 20 }}>
        <Toolbar />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          {/* "All Ages" is also guarded for little kids */}
          <button onClick={() => guard(() => setAge(null))} style={{ ...btn("rgba(255,255,255,0.4)", meta.dark ? "white" : "#333"), fontSize: 13 }}>← All Ages</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: meta.dark ? "white" : "#1f2937" }}>{meta.emoji} {meta.title} — {meta.sub}</div>
          </div>
          <div style={{ width: 80 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12, maxWidth: 900, margin: "0 auto" }}>
          {games.map(g => (
            <div key={g.id} onClick={() => setGame(g.id)}
              style={{ background: meta.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.85)", borderRadius: 16, padding: "16px 10px", textAlign: "center", cursor: "pointer", transition: "transform 0.15s", boxShadow: "0 2px 10px rgba(0,0,0,0.12)", border: meta.dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.5)" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <div style={{ fontSize: 34, marginBottom: 5 }}>{g.e}</div>
              <div style={{ fontWeight: 800, fontSize: 13, color: meta.dark ? "white" : "#1f2937", marginBottom: 3 }}>{g.t}</div>
              <div style={{ fontSize: 11, color: meta.dark ? "#94a3b8" : "#6b7280", lineHeight: 1.4 }}>{g.d}</div>
            </div>
          ))}
        </div>
        {overlays}
      </div>
    );
  }

  // ---- HOME / AGE PICKER ---------------------------------------------------
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e1b4b 0%,#065f46 50%,#1e1b4b 100%)", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px" }}>
      <Toolbar />
      <div style={{ textAlign: "center", marginBottom: 24, marginTop: 8 }}>
        <div style={{ fontSize: 44, marginBottom: 6 }}>💻🎮🚀</div>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: "white", margin: 0, textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>KidTech</h1>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#a5f3fc", margin: "4px 0 0" }}>Learning Hub</h2>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 8, maxWidth: 380 }}>From ABCs to AI Security — pick your age and start learning!</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14, width: "100%", maxWidth: 740 }}>
        {Object.entries(AGE_META).map(([id, m]) => {
          const count = GAMES_BY_AGE[id]?.length || 0;
          return (
            <div key={id} onClick={() => setAge(id)}
              style={{ background: m.bg, borderRadius: 20, padding: "22px 14px", textAlign: "center", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.25)", transition: "transform 0.15s, box-shadow 0.15s", border: "2px solid rgba(255,255,255,0.15)" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)"; }}
            >
              <div style={{ fontSize: 42, marginBottom: 8 }}>{m.emoji}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: m.dark ? "white" : "#1f2937" }}>{m.title}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: m.dark ? "#86efac" : "#374151", marginBottom: 6 }}>{m.sub}</div>
              <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 20, padding: "3px 12px", display: "inline-block", fontSize: 12, fontWeight: 700, color: m.dark ? "white" : "#374151" }}>{count} games 🎮</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 24, color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center" }}>
        Tap ❔ for instructions • {Object.values(GAMES_BY_AGE).flat().length} games across {Object.keys(GAMES_BY_AGE).length} age levels • From shapes to cybersecurity!
      </div>
      {overlays}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOUNT THE APP  (React 18 style — no build tools, runs straight in the browser)
// ═══════════════════════════════════════════════════════════════
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
