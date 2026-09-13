"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, X, Send, Loader2, MessageCircle, ChevronLeft, ChevronRight, Smile, BookMarked, RotateCcw } from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";
const POPULAR_BOOKS_LIMIT = 15;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------
interface Book {
  id: number;
  title: string;
  author: string;
  genre: string[] | string;
  description?: string;
  is_available: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatApiResponse {
  session_id: string;
  response: string;
  awaiting_confirmation: boolean;
}

function genreLabel(genre: Book["genre"]): string {
  return Array.isArray(genre) ? genre.join(", ") : genre;
}

// -----------------------------------------------------------------
// Deterministic "cloth cover" placeholder — same book always gets
// the same color + initial, since there's no real cover image
// stored in the database yet.
// -----------------------------------------------------------------
const COVER_COLORS = ["#5B2530", "#2E4A3A", "#22334A", "#7A5A26", "#2E5450", "#4A2E1A"];

function coverColorFor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Dancing+Script:wght@600;700&display=swap');
      .chat-scroll::-webkit-scrollbar { width: 6px; }
      .chat-scroll::-webkit-scrollbar-track { background: transparent; }
      .chat-scroll::-webkit-scrollbar-thumb { background: #d8cdb4; border-radius: 4px; }
      .panel-scroll::-webkit-scrollbar { width: 6px; }
      .panel-scroll::-webkit-scrollbar-track { background: transparent; }
      .panel-scroll::-webkit-scrollbar-thumb { background: #d9c6a0; border-radius: 4px; }
      .shelf-scroll::-webkit-scrollbar { height: 6px; }
      .shelf-scroll::-webkit-scrollbar-track { background: transparent; }
      .shelf-scroll::-webkit-scrollbar-thumb { background: #d9c6a0; border-radius: 4px; }
      .wood-bg {
        background-color: #C99B60;
        background-image:
          repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px),
          repeating-linear-gradient(90deg, rgba(93,58,23,0.07) 0px, rgba(93,58,23,0.07) 1px, transparent 1px, transparent 6px),
          repeating-linear-gradient(90deg, rgba(93,58,23,0.05) 0px, rgba(93,58,23,0.05) 2px, transparent 2px, transparent 22px),
          linear-gradient(180deg, #D3A76E 0%, #BE8E52 100%);
      }
      @keyframes widget-in {
        0% { transform: translateY(12px) scale(0.97); opacity: 0; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }
      .widget-in { animation: widget-in 0.2s ease-out both; }
      @keyframes msg-in {
        0% { transform: translateY(6px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      .msg-in { animation: msg-in 0.22s ease-out both; }
      .chat-texture {
        background-image: radial-gradient(rgba(46,29,20,0.05) 1px, transparent 1px);
        background-size: 14px 14px;
      }
    `}</style>
  );
}

// -----------------------------------------------------------------
// Book card — placeholder "cloth cover" + Chat-about-this-book action
// -----------------------------------------------------------------
// -----------------------------------------------------------------
// Real cover images, fetched from Open Library's free, keyless API.
// Falls back to the generated cover (below) if no match is found or
// the request fails. Cached in memory so the same book isn't
// re-fetched every time it appears in a different shelf row.
// -----------------------------------------------------------------
const coverCache = new Map<string, string | null>();

function useCoverImage(title: string, author: string): string | null | undefined {
  const key = `${title}::${author}`;
  const [url, setUrl] = useState<string | null | undefined>(() => coverCache.get(key));

  useEffect(() => {
    if (coverCache.has(key)) {
      setUrl(coverCache.get(key) ?? null);
      return;
    }

    let cancelled = false;

    async function fetchCover() {
      try {
        const res = await fetch(
          `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(
            author
          )}&limit=1`
        );
        const data = await res.json();
        const coverId = data?.docs?.[0]?.cover_i;
        const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
        coverCache.set(key, coverUrl);
        if (!cancelled) setUrl(coverUrl);
      } catch {
        coverCache.set(key, null);
        if (!cancelled) setUrl(null);
      }
    }

    fetchCover();
    return () => {
      cancelled = true;
    };
  }, [key, title, author]);

  return url;
}

const ART_STYLES = ["glow", "band", "minimal", "ribbon"] as const;

function artStyleFor(title: string): (typeof ART_STYLES)[number] {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ART_STYLES[Math.abs(hash) % ART_STYLES.length];
}

function BookCard({
  book,
  onChatAbout,
  onViewDetails,
}: {
  book: Book;
  onChatAbout: (book: Book) => void;
  onViewDetails: (book: Book) => void;
}) {
  const baseColor = coverColorFor(book.title);
  const style = artStyleFor(book.title);
  const coverUrl = useCoverImage(book.title, book.author);

  return (
    <div className="w-full group">
      <button
        onClick={() => onViewDetails(book)}
        className="w-full aspect-[2/3] relative overflow-hidden transition-all duration-200 group-hover:-translate-y-1.5 cursor-pointer text-left block"
        style={{
          backgroundColor: baseColor,
          boxShadow: "0 2px 5px rgba(43,27,20,0.3)",
        }}
      >
        {coverUrl ? (
          // ---- real cover image found ----
          <img
            src={coverUrl}
            alt={book.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            {/* ---- cover art, varies per book ---- */}
            {style === "glow" && (
              <div
                className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 w-[70%] aspect-square rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${baseColor}00 0%, #E8D9B5 8%, ${baseColor}00 60%)`,
                  boxShadow: `0 0 24px 4px #E8D9B550`,
                  border: "1px solid rgba(232,217,181,0.6)",
                }}
              />
            )}

            {style === "band" && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(115deg, transparent 40%, rgba(232,217,181,0.22) 48%, rgba(232,217,181,0.22) 58%, transparent 66%)`,
                }}
              />
            )}

            {style === "ribbon" && (
              <div
                className="absolute -right-8 top-6 w-28 h-7 rotate-45 pointer-events-none"
                style={{ backgroundColor: "rgba(232,217,181,0.85)" }}
              />
            )}

            {/* minimal style intentionally has no extra art layer */}

            {/* ---- title, bold and dominant like a real jacket ---- */}
            <div className="absolute top-4 left-3 right-3">
              <div
                className={`leading-[1.05] ${
                  style === "minimal" ? "text-[13px] text-center" : "text-[17px] uppercase"
                }`}
                style={{
                  fontFamily: style === "minimal" ? "'Source Serif 4', serif" : "'Inter', sans-serif",
                  fontWeight: 800,
                  color: "#F3E8D0",
                  textShadow: "0 1px 3px rgba(0,0,0,0.45)",
                  letterSpacing: style === "minimal" ? "0.01em" : "-0.01em",
                }}
              >
                {book.title}
              </div>
            </div>

            {/* ---- author, bottom band like a spine label ---- */}
            <div
              className="absolute bottom-0 left-0 right-0 px-3 py-2"
              style={{ backgroundColor: "rgba(0,0,0,0.28)" }}
            >
              <div
                className="text-[9.5px] uppercase tracking-[0.1em] truncate"
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "rgba(243,232,208,0.85)" }}
              >
                {book.author}
              </div>
            </div>
          </>
        )}

        {/* availability dot */}
        <div
          className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full z-10"
          style={{ backgroundColor: book.is_available ? "#8fb37a" : "#c97b68" }}
        />

        {/* hover-revealed chat button, top-right corner */}
        <span
          onClick={(e) => {
            e.stopPropagation();
            onChatAbout(book);
          }}
          role="button"
          className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 z-10"
          style={{ backgroundColor: "#F3E8D0" }}
          title={`Chat about ${book.title}`}
        >
          <MessageCircle size={14} color="#2E1D14" />
        </span>

        {/* hover-revealed "View details" hint, so it's clear the cover is clickable */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
          style={{ backgroundColor: "rgba(46,29,20,0.85)" }}
        >
          <span
            className="text-[9.5px] uppercase tracking-[0.12em]"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#B8934A" }}
          >
            View details
          </span>
        </div>

        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 35%)" }}
        />
      </button>

      {/* shelf ledge — the book "resting" on a wooden shelf edge */}
      <div
        className="w-full h-[7px] transition-all duration-200 group-hover:-translate-y-1.5"
        style={{
          background: "linear-gradient(180deg, #6b4a2e 0%, #4a3220 100%)",
          boxShadow: "0 2px 3px rgba(43,27,20,0.35)",
        }}
      />

      {/* always-visible description preview, so there's a reason to click for more */}
      {book.description && (
        <p
          className="text-[10.5px] leading-snug mt-1.5 line-clamp-2 cursor-pointer rounded-sm px-2 py-1.5"
          style={{ color: "#2E1D14", backgroundColor: "#FBF6EA", border: "1px solid #e6d8b8" }}
          onClick={() => onViewDetails(book)}
        >
          {book.description}
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// A horizontal "shelf" row with scroll arrows, like the reference
// site's Top Rated / Latest Arrivals carousels
// -----------------------------------------------------------------
function BookShelfRow({
  title,
  books,
  onChatAbout,
  onViewDetails,
}: {
  title: string;
  books: Book[];
  onChatAbout: (book: Book) => void;
  onViewDetails: (book: Book) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-[16px] text-[#2E1D14]"
          style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700 }}
        >
          {title}
        </h2>
        <div className="flex gap-1.5">
          <button
            onClick={() => scrollBy(-320)}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ border: "1px solid #d9c6a0", color: "#6b5a3e" }}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => scrollBy(320)}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ border: "1px solid #d9c6a0", color: "#6b5a3e" }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 shelf-scroll">
        {books.map((b) => (
          <div key={b.id} className="w-[120px] shrink-0">
            <BookCard book={b} onChatAbout={onChatAbout} onViewDetails={onViewDetails} />
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Categories sidebar — built from genres actually present in your
// loaded books (there's no dedicated categories endpoint yet)
// -----------------------------------------------------------------
function CategorySidebar({
  books,
  onSelectCategory,
}: {
  books: Book[];
  onSelectCategory: (genre: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE_COUNT = 8;

  const categories = Array.from(
    new Set(
      books.flatMap((b) => (Array.isArray(b.genre) ? b.genre : b.genre ? [b.genre] : []))
    )
  ).sort();

  const visibleCategories = expanded ? categories : categories.slice(0, VISIBLE_COUNT);
  const hasMore = categories.length > VISIBLE_COUNT;

  return (
    <div className="w-full shrink-0">
      <div
        className="text-[13px] mb-3 pb-2"
        style={{
          fontFamily: "'Source Serif 4', serif",
          fontWeight: 700,
          color: "#2E1D14",
          borderBottom: "2px solid #B8934A",
        }}
      >
        Categories
      </div>
      {categories.length === 0 ? (
        <div className="text-[12px] text-[#9a9284]">No categories yet.</div>
      ) : (
        <div className="flex flex-col">
          {visibleCategories.map((c) => (
            <button
              key={c}
              onClick={() => onSelectCategory(c)}
              className="text-left text-[12.5px] py-1.5 border-b border-[#e6d8b8] hover:text-[#8a6b2f] transition-colors"
              style={{ color: "#4a4030" }}
            >
              ▶ {c}
            </button>
          ))}
          {hasMore && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-left text-[11.5px] py-2"
              style={{ color: "#8a6b2f", fontWeight: 600 }}
            >
              {expanded ? "Show less ▴" : `More (${categories.length - VISIBLE_COUNT}) ▾`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Popular books grid + search
// -----------------------------------------------------------------
function BookGrid({
  books,
  loading,
  query,
  onChatAbout,
  onViewDetails,
}: {
  books: Book[];
  loading: boolean;
  query: string;
  onChatAbout: (book: Book) => void;
  onViewDetails: (book: Book) => void;
}) {
  return (
    <div>
      <div
        className="text-[11px] tracking-[0.2em] uppercase mb-4"
        style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8a7a5c" }}
      >
        {query.trim() ? "Search results" : "Popular in the collection"}
      </div>

      {loading ? (
        <div className="text-[13px] text-[#8a8371] py-10 text-center">Loading books…</div>
      ) : books.length === 0 ? (
        <div className="text-[13px] text-[#8a8371] py-10 text-center">No books found.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8 pb-10">
          {books.map((b) => (
            <BookCard key={b.id} book={b} onChatAbout={onChatAbout} onViewDetails={onViewDetails} />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Floating "Ask AI Librarian" chat widget
// -----------------------------------------------------------------
function ChatWidget({
  open,
  onClose,
  initialQuestion,
  onLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  initialQuestion: string | null;
  onLoggedIn?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me anything about the library's collection." },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [widgetLoginEmail, setWidgetLoginEmail] = useState("");
  const [widgetLoginPassword, setWidgetLoginPassword] = useState("");
  const [widgetLoginError, setWidgetLoginError] = useState("");
  const [widgetLoggingIn, setWidgetLoggingIn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef<string | null>(null);

  async function handleWidgetLogin() {
    setWidgetLoginError("");
    if (!widgetLoginEmail.trim() || !widgetLoginPassword) return;
    setWidgetLoggingIn(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: widgetLoginEmail, password: widgetLoginPassword }),
      });

      if (!res.ok) {
        setWidgetLoginError("Invalid email or password.");
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      setAuthError(false);
      setWidgetLoginEmail("");
      setWidgetLoginPassword("");
      onLoggedIn?.();
    } catch {
      setWidgetLoginError("Couldn't reach the API.");
    } finally {
      setWidgetLoggingIn(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendToAgent = useCallback(async (text: string, isConfirmationReply: boolean) => {
    setLoading(true);
    const token = localStorage.getItem("token");

    if (!token) {
      setAuthError(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          awaiting_confirmation: isConfirmationReply,
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        setAuthError(true);
        return;
      }

      if (!res.ok) throw new Error("bad response");
      const data: ChatApiResponse = await res.json();
      setSessionId(data.session_id);

      if (data.awaiting_confirmation) {
        setPendingConfirmation(data.response);
      } else {
        setPendingConfirmation(null);
        setMessages((m) => [...m, { role: "assistant", content: data.response }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Couldn't reach the API at ${API_BASE}.` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Auto-send the "chat about this book" question once, when it changes
  useEffect(() => {
    if (open && initialQuestion && askedRef.current !== initialQuestion) {
      askedRef.current = initialQuestion;
      setMessages((m) => [...m, { role: "user", content: initialQuestion }]);
      sendToAgent(initialQuestion, false);
    }
  }, [open, initialQuestion, sendToAgent]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    sendToAgent(text, false);
  }

  function handleConfirmAnswer(answer: string) {
    setMessages((m) => [...m, { role: "user", content: answer }]);
    sendToAgent(answer, true);
  }

  if (!open) return null;

  return (
    <div
      className="widget-in fixed bottom-6 right-6 w-[380px] h-[540px] bg-[#F3E8D0] rounded-2xl flex flex-col overflow-hidden z-50"
      style={{
        border: "1px solid #d9c6a0",
        boxShadow: "0 20px 50px rgba(46,29,20,0.35), 0 4px 14px rgba(46,29,20,0.25)",
      }}
    >
      {/* header */}
      <div
        className="relative px-5 py-4 flex items-center justify-between overflow-hidden"
        style={{ background: "linear-gradient(135deg, #2E1D14 0%, #3D2818 100%)" }}
      >
        <div
          className="absolute -top-10 -right-6 w-28 h-28 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(184,147,74,0.25) 0%, transparent 70%)" }}
        />
        <div className="relative flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "rgba(184,147,74,0.18)",
              border: "1px solid rgba(184,147,74,0.5)",
              boxShadow: "0 0 12px rgba(184,147,74,0.25)",
            }}
          >
            <Sparkles size={14} color="#B8934A" />
          </div>
          <div>
            <div
              className="text-[14px] leading-none"
              style={{ fontFamily: "'Source Serif 4', serif", color: "#F3E8D0", fontWeight: 700 }}
            >
              AI Librarian
            </div>
            <div className="text-[10px] mt-1 flex items-center gap-1.5" style={{ color: "rgba(243,232,208,0.55)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#8fb37a" }} />
              Ready to help
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="relative w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
        >
          <X size={15} color="#F3E8D0" />
        </button>
      </div>

      {/* quick-action icon row */}
      <div
        className="flex items-center gap-2 px-5 py-2.5"
        style={{ backgroundColor: "#FBF6EA", borderBottom: "1px solid #e6d8b8" }}
      >
        {[
          { icon: Search, label: "Search", text: "Search for " },
          { icon: BookMarked, label: "Borrow", text: "I want to borrow " },
          { icon: RotateCcw, label: "Return", text: "I want to return " },
          { icon: Sparkles, label: "Recommend", text: "Recommend me a book about " },
        ].map(({ icon: Icon, label, text }) => (
          <button
            key={label}
            onClick={() => setInput(text)}
            title={label}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
            style={{ backgroundColor: "#F3E8D0", border: "1px solid #d9c6a0" }}
          >
            <Icon size={13} color="#8a6b2f" />
          </button>
        ))}
      </div>

      {authError ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <p className="text-[13px] leading-relaxed text-[#7a7364] mb-1">
            Sign in to chat with the AI Librarian.
          </p>

          <input
            value={widgetLoginEmail}
            onChange={(e) => setWidgetLoginEmail(e.target.value)}
            placeholder="Email"
            className="w-full max-w-[220px] bg-white rounded-sm px-3 py-2 text-[12.5px] text-[#2E1D14] outline-none"
            style={{ border: "1px solid #d9c6a0" }}
          />
          <input
            value={widgetLoginPassword}
            onChange={(e) => setWidgetLoginPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleWidgetLogin()}
            type="password"
            placeholder="Password"
            className="w-full max-w-[220px] bg-white rounded-sm px-3 py-2 text-[12.5px] text-[#2E1D14] outline-none"
            style={{ border: "1px solid #d9c6a0" }}
          />

          {widgetLoginError && (
            <p className="text-[11.5px]" style={{ color: "#A24B3B" }}>
              {widgetLoginError}
            </p>
          )}

          <button
            onClick={handleWidgetLogin}
            disabled={widgetLoggingIn}
            className="w-full max-w-[220px] py-2 rounded-full text-[12.5px] disabled:opacity-60"
            style={{ backgroundColor: "#2E1D14", color: "#F3E8D0" }}
          >
            {widgetLoggingIn ? "Signing in\u2026" : "Log In"}
          </button>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll chat-texture px-4 py-4 space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`msg-in flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-0.5"
                    style={{ backgroundColor: "#2E1D14" }}
                  >
                    <Sparkles size={10} color="#B8934A" />
                  </div>
                )}
                <div
                  className="max-w-[75%] px-3.5 py-2.5 text-[13px] leading-relaxed"
                  style={
                    m.role === "user"
                      ? {
                          backgroundColor: "#2E1D14",
                          color: "#F3E8D0",
                          borderRadius: "14px 14px 3px 14px",
                        }
                      : {
                          backgroundColor: "#FBF6EA",
                          color: "#2E1D14",
                          borderRadius: "14px 14px 14px 3px",
                          border: "1px solid #e6d8b8",
                        }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {pendingConfirmation && (
              <div className="flex items-end gap-2 justify-start">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-0.5"
                  style={{ backgroundColor: "#2E1D14" }}
                >
                  <Sparkles size={10} color="#B8934A" />
                </div>
                <div
                  className="border-2 border-dashed rounded-2xl px-4 py-3 max-w-[75%]"
                  style={{ borderColor: "#B8934A", backgroundColor: "#FBF6EA" }}
                >
                  <div
                    className="text-[9.5px] uppercase tracking-[0.12em] mb-1.5 font-semibold"
                    style={{ color: "#A24B3B" }}
                  >
                    Confirmation required
                  </div>
                  <div className="text-[13px] text-[#2E1D14] mb-2.5 leading-relaxed">
                    {pendingConfirmation}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirmAnswer("YES")}
                      className="text-[11.5px] px-3 py-1.5 rounded-full font-medium transition-transform hover:scale-105"
                      style={{ backgroundColor: "#2E5450", color: "#F3E8D0" }}
                    >
                      Yes, confirm
                    </button>
                    <button
                      onClick={() => handleConfirmAnswer("NO")}
                      className="text-[11.5px] px-3 py-1.5 rounded-full font-medium transition-transform hover:scale-105"
                      style={{ border: "1px solid #A24B3B", color: "#A24B3B" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 pl-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#2E1D14" }}
                >
                  <Sparkles size={10} color="#B8934A" />
                </div>
                <div
                  className="flex items-center gap-1 px-3.5 py-2.5 rounded-2xl"
                  style={{ backgroundColor: "#FBF6EA", border: "1px solid #e6d8b8" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#B8934A", animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#B8934A", animationDelay: "120ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#B8934A", animationDelay: "240ms" }} />
                </div>
              </div>
            )}
          </div>

          <div className="px-3.5 py-3.5 border-t" style={{ borderColor: "#d9c6a0" }}>
            <div className="flex items-center gap-2 bg-white rounded-full pl-2.5 pr-1.5 py-1.5" style={{ border: "1px solid #d9c6a0" }}>
              <button
                onClick={() => setInput((v) => v + "🙂")}
                disabled={!!pendingConfirmation || loading}
                className="w-7 h-7 flex items-center justify-center rounded-full shrink-0 disabled:opacity-40"
              >
                <Smile size={16} color="#b3a88d" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                disabled={!!pendingConfirmation || loading}
                placeholder="Ask a question…"
                className="flex-1 text-[13px] text-[#2E1D14] outline-none bg-transparent disabled:opacity-60"
              />
              <button
                onClick={handleSend}
                disabled={!!pendingConfirmation || loading || !input.trim()}
                className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 transition-transform disabled:opacity-30 enabled:hover:scale-105"
                style={{ backgroundColor: "#2E1D14" }}
              >
                <Send size={13} color="#F3E8D0" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Decorative star rating (no real rating data exists yet)
// -----------------------------------------------------------------
function StarRow({ filled = 5, size = 11 }: { filled?: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ color: i < filled ? "#B8934A" : "#d9c6a0", fontSize: size }}>
          ★
        </span>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------
// "Book of the week" sidebar box
// -----------------------------------------------------------------
function BookOfTheWeek({
  book,
  onChatAbout,
  onViewDetails,
}: {
  book: Book | null;
  onChatAbout: (book: Book) => void;
  onViewDetails: (book: Book) => void;
}) {
  return (
    <div className="bg-[#FBF6EA] rounded-md p-3.5 mb-6" style={{ border: "1px solid #e6d8b8" }}>
      <div
        className="text-[12px] mb-2.5 pb-2"
        style={{
          fontFamily: "'Source Serif 4', serif",
          fontWeight: 700,
          color: "#2E1D14",
          borderBottom: "2px solid #B8934A",
        }}
      >
        Book of the Week
      </div>

      {!book ? (
        <div className="text-[11.5px] text-[#9a9284]">Nothing to show yet.</div>
      ) : (
        <div className="flex gap-3">
          <div className="w-[54px] shrink-0">
            <BookCard book={book} onChatAbout={onChatAbout} onViewDetails={onViewDetails} />
          </div>
          <div className="min-w-0">
            <div
              className="text-[12px] leading-snug truncate"
              style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: "#2E1D14" }}
            >
              {book.title}
            </div>
            <div className="text-[10.5px] text-[#7a6e56] mb-1 truncate">{book.author}</div>
            <StarRow filled={4} size={10} />
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// "Author on focus" sidebar box
// -----------------------------------------------------------------
function AuthorOnFocus({ author }: { author: string | null }) {
  const initial = author?.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="bg-[#FBF6EA] rounded-md p-3.5" style={{ border: "1px solid #e6d8b8" }}>
      <div
        className="text-[12px] mb-2.5 pb-2"
        style={{
          fontFamily: "'Source Serif 4', serif",
          fontWeight: 700,
          color: "#2E1D14",
          borderBottom: "2px solid #B8934A",
        }}
      >
        Author on Focus
      </div>

      {!author ? (
        <div className="text-[11.5px] text-[#9a9284]">Nothing to show yet.</div>
      ) : (
        <div className="flex gap-3 items-start">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#3D2818" }}
          >
            <span
              className="text-[16px]"
              style={{ fontFamily: "'Source Serif 4', serif", color: "#F3E8D0" }}
            >
              {initial}
            </span>
          </div>
          <div className="min-w-0">
            <div
              className="text-[12px] leading-snug truncate"
              style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: "#2E1D14" }}
            >
              {author}
            </div>
            <div className="text-[10.5px] text-[#7a6e56] mb-1">Featured author</div>
            <StarRow filled={5} size={10} />
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Full-screen, ChatGPT-style chat — opened from the "Browse" nav
// item or the "1. Browse" hero card. Clean, centered, minimal —
// deliberately different from the floating "Ask AI Librarian"
// widget, which stays compact and corner-anchored.
// -----------------------------------------------------------------
function BrowseChatFullScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "What are you looking for today?" },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendToAgent = useCallback(
    async (text: string, isConfirmationReply: boolean) => {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
            awaiting_confirmation: isConfirmationReply,
          }),
        });

        if (res.status === 401) {
          localStorage.removeItem("token");
          setAuthError(true);
          return;
        }

        if (!res.ok) throw new Error("bad response");
        const data: ChatApiResponse = await res.json();
        setSessionId(data.session_id);

        if (data.awaiting_confirmation) {
          setPendingConfirmation(data.response);
        } else {
          setPendingConfirmation(null);
          setMessages((m) => [...m, { role: "assistant", content: data.response }]);
        }
      } catch {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `Couldn't reach the API at ${API_BASE}.` },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    sendToAgent(text, false);
  }

  function handleConfirmAnswer(answer: string) {
    setMessages((m) => [...m, { role: "user", content: answer }]);
    sendToAgent(answer, true);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <GlobalStyle />

      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#ececec]">
        <span
          className="text-[17px]"
          style={{ fontFamily: "'Dancing Script', cursive", fontWeight: 700, color: "#2E1D14" }}
        >
          The Readers' Planet
        </span>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#f2f2f2]">
          <X size={18} color="#4a4030" />
        </button>
      </div>

      {authError ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[14px] text-[#7a7364]">Please sign in first to chat with the AI Librarian.</p>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll">
            <div className="max-w-[680px] mx-auto px-6 py-8 space-y-5">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[75%] px-4 py-2.5 text-[14.5px] leading-relaxed rounded-2xl"
                    style={
                      m.role === "user"
                        ? { backgroundColor: "#F3E8D0", color: "#2E1D14" }
                        : { backgroundColor: "transparent", color: "#2E1D14" }
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {pendingConfirmation && (
                <div className="flex justify-start">
                  <div
                    className="border-2 border-dashed rounded-xl px-4 py-3 max-w-[75%]"
                    style={{ borderColor: "#B8934A", backgroundColor: "#FBF6EA" }}
                  >
                    <div className="text-[10.5px] uppercase tracking-wide mb-1.5" style={{ color: "#A24B3B" }}>
                      Confirmation required
                    </div>
                    <div className="text-[13.5px] text-[#2E1D14] mb-2.5">{pendingConfirmation}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirmAnswer("YES")}
                        className="text-[12px] px-3 py-1.5 rounded-md"
                        style={{ backgroundColor: "#2E5450", color: "#F3E8D0" }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleConfirmAnswer("NO")}
                        className="text-[12px] px-3 py-1.5 rounded-md"
                        style={{ border: "1px solid #A24B3B", color: "#A24B3B" }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex items-center gap-2 text-[13px] text-[#9a9284]">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#ececec] px-6 py-4">
            <div className="max-w-[680px] mx-auto flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                disabled={!!pendingConfirmation || loading}
                placeholder="Message the AI Librarian…"
                className="flex-1 bg-[#f7f7f5] rounded-full px-5 py-3 text-[14px] text-[#2E1D14] outline-none focus:ring-1 focus:ring-[#B8934A] disabled:opacity-60"
              />
              <button
                onClick={handleSend}
                disabled={!!pendingConfirmation || loading || !input.trim()}
                className="w-11 h-11 flex items-center justify-center rounded-full shrink-0 disabled:opacity-40"
                style={{ backgroundColor: "#2E1D14" }}
              >
                <Send size={16} color="#F3E8D0" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Full book detail modal — shown when a cover is clicked
// -----------------------------------------------------------------
function BookDetailModal({
  book,
  onClose,
  onChatAbout,
}: {
  book: Book | null;
  onClose: () => void;
  onChatAbout: (book: Book) => void;
}) {
  if (!book) return null;

  const genres = Array.isArray(book.genre) ? book.genre : book.genre ? [book.genre] : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(46,29,20,0.55)" }}
      onClick={onClose}
    >
      <div
        className="bg-[#FBF6EA] rounded-xl max-w-[520px] w-full overflow-hidden"
        style={{ border: "1px solid #d9c6a0", boxShadow: "0 20px 50px rgba(46,29,20,0.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-5 p-6">
          <div className="w-[110px] shrink-0">
            <BookCard book={book} onChatAbout={onChatAbout} onViewDetails={() => {}} />
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="text-[19px] leading-tight mb-1"
              style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: "#2E1D14" }}
            >
              {book.title}
            </div>
            <div className="text-[13px] mb-2" style={{ color: "#7a7364" }}>
              {book.author}
            </div>

            <span
              className="inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full mb-3"
              style={{
                backgroundColor: book.is_available ? "#e3e8d9" : "#efd9d3",
                color: book.is_available ? "#43522f" : "#82372a",
              }}
            >
              {book.is_available ? "Available" : "Checked out"}
            </span>

            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{ backgroundColor: "#efe4c8", color: "#5c5442" }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6">
          <div
            className="text-[10.5px] uppercase tracking-[0.15em] mb-1.5"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8a6b2f" }}
          >
            Description
          </div>
          <p className="text-[13px] leading-relaxed mb-5" style={{ color: "#4a4030" }}>
            {book.description || "No description available for this title yet."}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => {
                onChatAbout(book);
                onClose();
              }}
              className="flex-1 py-2.5 rounded-full text-[13px]"
              style={{ backgroundColor: "#2E1D14", color: "#F3E8D0" }}
            >
              Chat about this book
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-[13px]"
              style={{ border: "1px solid #d9c6a0", color: "#7a7364" }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Page
// -----------------------------------------------------------------
export default function LandingPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedBookForDetails, setSelectedBookForDetails] = useState<Book | null>(null);
  const router = useRouter();
  const [initialQuestion, setInitialQuestion] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [allTitles, setAllTitles] = useState<Book[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [forgotMessageOpen, setForgotMessageOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("token"));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBooks() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/books/?skip=0&limit=${POPULAR_BOOKS_LIMIT}`);
        if (!res.ok) throw new Error("bad response");
        const data: Book[] = await res.json();
        if (!cancelled) setBooks(data);
      } catch {
        if (!cancelled) setBooks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBooks();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the full title list once, for the search suggestions dropdown
  useEffect(() => {
    let cancelled = false;

    async function loadAllTitles() {
      try {
        const res = await fetch(`${API_BASE}/books/?skip=0&limit=1000`);
        if (!res.ok) return;
        const data: Book[] = await res.json();
        if (!cancelled) setAllTitles(data);
      } catch {
        // suggestions just won't populate if this fails
      }
    }

    loadAllTitles();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(q: string) {
    setQuery(q);

    // Typing a lone backslash is a shortcut for "show me everything"
    if (q.trim() === "\\") {
      const res = await fetch(`${API_BASE}/books/?skip=0&limit=1000`);
      if (res.ok) setBooks(await res.json());
      return;
    }

    if (!q.trim()) {
      const res = await fetch(`${API_BASE}/books/?skip=0&limit=${POPULAR_BOOKS_LIMIT}`);
      if (res.ok) setBooks(await res.json());
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/books/search?query=${encodeURIComponent(q)}`);
      if (res.ok) setBooks(await res.json());
    } catch {
      // keep whatever's currently shown if search fails
    }
  }

  function handleChatAbout(book: Book) {
    setInitialQuestion(`Tell me about "${book.title}" by ${book.author}.`);
    setChatOpen(true);
  }

  function handleViewDetails(book: Book) {
    setSelectedBookForDetails(book);
  }

  function handleAskLibrarian() {
    setInitialQuestion(null);
    setChatOpen(true);
  }

  async function handleLogin() {
    setLoginError("");
    if (!loginEmail.trim() || !loginPassword) return;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (!res.ok) {
        setLoginError("Invalid email or password.");
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      setLoggedIn(true);
    } catch {
      setLoginError("Couldn't reach the API.");
    }
  }

  async function handleSignup() {
    setSignupError("");
    setSignupSuccess(false);

    if (!signupName.trim() || !signupEmail.trim() || !signupPassword) {
      setSignupError("Please fill in all fields.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSignupError(data?.detail || "Could not create account. That email may already be registered.");
        return;
      }

      setSignupSuccess(true);
      // Log the new user straight in, so they don't have to type
      // their details twice
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signupEmail, password: signupPassword }),
      });

      if (loginRes.ok) {
        const data = await loginRes.json();
        localStorage.setItem("token", data.access_token);
        setLoggedIn(true);
        setSignupOpen(false);
        setSignupName("");
        setSignupEmail("");
        setSignupPassword("");
      }
    } catch {
      setSignupError("Couldn't reach the API.");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setLoggedIn(false);
  }

  const latestArrivals = [...books].sort((a, b) => b.id - a.id).slice(0, 10);
  const topRated = books.slice(0, 10);
  const isSearching = query.trim().length > 0;
  const bookOfTheWeek = books.length > 0 ? books[0] : null;
  const authorOnFocus = books.length > 0 ? books[0].author : null;

  const navItems = ["Home", "Browse"];

  return (
    <div className="min-h-screen wood-bg" style={{ fontFamily: "'Inter', sans-serif" }}>
      <GlobalStyle />

      {/* ============================================= */}
      {/* Top bar: logo, login fields, Ask AI Librarian */}
      {/* ============================================= */}
      <div style={{ backgroundColor: "rgba(46,29,20,0.92)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <span
            className="text-[30px] shrink-0"
            style={{ fontFamily: "'Dancing Script', cursive", fontWeight: 700, color: "#F3E8D0" }}
          >
            The Readers' Planet
          </span>

          {loggedIn ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleAskLibrarian}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px]"
                style={{ backgroundColor: "#B8934A", color: "#2E1D14", fontWeight: 600 }}
              >
                <Sparkles size={13} color="#2E1D14" />
                Ask AI Librarian
              </button>
              <button
                onClick={handleLogout}
                className="text-[11.5px]"
                style={{ color: "rgba(243,232,208,0.65)" }}
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex gap-1.5">
                  <input
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Email"
                    className="w-[130px] bg-[#F3E8D0] rounded-sm px-2.5 py-1.5 text-[11.5px] text-[#2E1D14] outline-none"
                  />
                  <input
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    type="password"
                    placeholder="Password"
                    className="w-[110px] bg-[#F3E8D0] rounded-sm px-2.5 py-1.5 text-[11.5px] text-[#2E1D14] outline-none"
                  />
                  <button
                    onClick={handleLogin}
                    className="px-3 py-1.5 rounded-sm text-[11.5px]"
                    style={{ backgroundColor: "#2E1D14", color: "#F3E8D0", border: "1px solid #B8934A" }}
                  >
                    Log In
                  </button>
                </div>
                <div className="text-[10px] flex gap-2" style={{ color: "rgba(243,232,208,0.55)" }}>
                  <span>
                    New user?{" "}
                    <span
                      onClick={() => setSignupOpen(true)}
                      className="cursor-pointer hover:underline"
                      style={{ color: "#B8934A" }}
                    >
                      Sign Up here
                    </span>
                  </span>
                  <span
                    onClick={() => setForgotMessageOpen(true)}
                    className="cursor-pointer hover:underline"
                  >
                    Forgot password?
                  </span>
                  {loginError && <span style={{ color: "#c97b68" }}>{loginError}</span>}
                </div>
              </div>

              <button
                onClick={handleAskLibrarian}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] shrink-0"
                style={{ backgroundColor: "#B8934A", color: "#2E1D14", fontWeight: 600 }}
              >
                <Sparkles size={13} color="#2E1D14" />
                Ask AI Librarian
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============================================= */}
      {/* Nav bar */}
      {/* ============================================= */}
      <div style={{ backgroundColor: "rgba(243,232,208,0.92)", borderBottom: "3px solid #B8934A" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-6 text-[12.5px]">
            {navItems.map((item, i) => (
              <span
                key={item}
                onClick={
                  item === "Browse"
                    ? () => router.push("/chat")
                    : item === "Home"
                    ? () => router.push("/")
                    : undefined
                }
                className="py-3 flex items-center gap-1 cursor-pointer hover:underline"
                style={{ color: i === 0 ? "#8a3a2a" : "#4a4030", fontWeight: i === 0 ? 600 : 400 }}
              >
                {item === "Browse" && <MessageCircle size={12} color="#8a6b2f" />}
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* Main content: hero + shelves | sidebar */}
      {/* ============================================= */}
      <div className="max-w-6xl mx-auto px-6 pt-8 flex gap-8">
        <div className="flex-1 min-w-0">
          {/* "1. Browse" hero — image fully covers the background */}
          <button
            onClick={() => router.push("/chat")}
            className="relative w-full h-[220px] rounded-md mb-8 overflow-hidden text-left transition-transform hover:-translate-y-0.5"
          >
            {/*
              Real photo — saved to your project's /public/images/
              folder. Update this path if you place it somewhere else.
            */}
            <img
              src="/images/browse-hero.jpg"
              alt="Browsing the library shelves"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "60% 40%" }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(90deg, rgba(46,29,20,0.88) 0%, rgba(46,29,20,0.45) 55%, rgba(46,29,20,0.15) 100%)" }}
            />

            <div className="relative h-full flex flex-col justify-center px-8 max-w-[420px]">
              <div
                className="text-[28px] mb-2 flex items-center gap-2.5"
                style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: "#F3E8D0" }}
              >
                <MessageCircle size={22} color="#B8934A" />
                1. Browse
              </div>
              <p className="text-[13.5px] leading-relaxed mb-4" style={{ color: "rgba(243,232,208,0.85)" }}>
                Browse our library collection online and chat with the AI Librarian to find
                exactly what you're looking for.
              </p>

              <div
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full w-fit"
                style={{ backgroundColor: "#B8934A" }}
              >
                <MessageCircle size={20} color="#2E1D14" />
                <span className="text-[16px]" style={{ color: "#2E1D14", fontWeight: 700 }}>
                  Click to open AI Chat
                </span>
              </div>
            </div>
          </button>

          {isSearching ? (
            <BookGrid
              books={books}
              loading={loading}
              query={query}
              onChatAbout={handleChatAbout}
              onViewDetails={handleViewDetails}
            />
          ) : loading ? (
            <div className="text-[13px] text-[#8a8371] py-10 text-center">Loading books…</div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <h2
                  className="text-[16px] text-[#2E1D14]"
                  style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700 }}
                >
                  Top rated books
                </h2>
                <StarRow filled={4} />
              </div>
              <BookShelfRow
                title=""
                books={topRated}
                onChatAbout={handleChatAbout}
                onViewDetails={handleViewDetails}
              />

              <BookShelfRow
                title="Latest Arrivals"
                books={latestArrivals}
                onChatAbout={handleChatAbout}
                onViewDetails={handleViewDetails}
              />
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-[220px] shrink-0">
          <div className="relative mb-1">
            <div
              className="flex items-stretch rounded-sm overflow-hidden"
              style={{ border: "2px solid #B8934A" }}
            >
              <input
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setSuggestionsOpen(true)}
                onMouseEnter={() => setSuggestionsOpen(true)}
                onTouchStart={() => setSuggestionsOpen(true)}
                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                placeholder="Search title / author"
                className="flex-1 min-w-0 bg-[#FBF6EA] px-3 py-2 text-[12px] text-[#2E1D14] outline-none"
              />
              <button
                onClick={() => handleSearch(query)}
                className="px-3 flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#2E1D14" }}
              >
                <Search size={14} color="#F3E8D0" />
              </button>
            </div>

            {suggestionsOpen && allTitles.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1.5 rounded-md z-20 max-h-[320px] overflow-y-auto panel-scroll p-3"
                style={{ backgroundColor: "#FBF6EA", border: "1px solid #d9c6a0", boxShadow: "0 10px 24px rgba(46,29,20,0.25)" }}
              >
                <div
                  className="text-[11.5px] mb-2.5"
                  style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: "#2E1D14" }}
                >
                  {query.trim() ? "Matching titles" : "Browse titles"}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {allTitles
                    .filter(
                      (b) =>
                        !query.trim() ||
                        b.title.toLowerCase().includes(query.toLowerCase()) ||
                        b.author.toLowerCase().includes(query.toLowerCase())
                    )
                    .map((b) => (
                      <button
                        key={b.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSearch(b.title);
                          setSuggestionsOpen(false);
                        }}
                        className="px-3 py-1.5 rounded-full text-[11px] transition-colors"
                        style={{ backgroundColor: "#efe4c8", color: "#2E1D14" }}
                      >
                        {b.title}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="text-[10.5px] mb-5" style={{ color: "#8a6b2f" }}>
            Advanced search
          </div>

          <CategorySidebar books={books} onSelectCategory={(genre) => handleSearch(genre)} />

          <div className="mt-6">
            <BookOfTheWeek book={bookOfTheWeek} onChatAbout={handleChatAbout} onViewDetails={handleViewDetails} />
            <AuthorOnFocus author={authorOnFocus} />
          </div>
        </div>
      </div>

      <div className="pb-10" />

      <ChatWidget
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        initialQuestion={initialQuestion}
        onLoggedIn={() => setLoggedIn(true)}
      />

      <BookDetailModal
        book={selectedBookForDetails}
        onClose={() => setSelectedBookForDetails(null)}
        onChatAbout={handleChatAbout}
      />

      {/* Sign Up modal */}
      {signupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(46,29,20,0.55)" }}
          onClick={() => setSignupOpen(false)}
        >
          <div
            className="bg-[#FBF6EA] rounded-xl max-w-[380px] w-full p-6"
            style={{ border: "1px solid #d9c6a0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="text-[18px] mb-1"
              style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: "#2E1D14" }}
            >
              Create an account
            </div>
            <p className="text-[12px] mb-4" style={{ color: "#7a7364" }}>
              New accounts always start as regular members.
            </p>

            <input
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-white rounded-sm px-3 py-2 text-[13px] text-[#2E1D14] outline-none mb-2"
              style={{ border: "1px solid #d9c6a0" }}
            />
            <input
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full bg-white rounded-sm px-3 py-2 text-[13px] text-[#2E1D14] outline-none mb-2"
              style={{ border: "1px solid #d9c6a0" }}
            />
            <input
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignup()}
              placeholder="Password"
              type="password"
              className="w-full bg-white rounded-sm px-3 py-2 text-[13px] text-[#2E1D14] outline-none mb-3"
              style={{ border: "1px solid #d9c6a0" }}
            />

            {signupError && (
              <p className="text-[12px] mb-3" style={{ color: "#A24B3B" }}>
                {signupError}
              </p>
            )}
            {signupSuccess && !signupError && (
              <p className="text-[12px] mb-3" style={{ color: "#5C6F4E" }}>
                Account created! Signing you in…
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSignup}
                className="flex-1 py-2 rounded-full text-[13px]"
                style={{ backgroundColor: "#2E1D14", color: "#F3E8D0" }}
              >
                Create account
              </button>
              <button
                onClick={() => setSignupOpen(false)}
                className="px-4 py-2 rounded-full text-[13px]"
                style={{ border: "1px solid #d9c6a0", color: "#7a7364" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot password notice - honest placeholder, no backend support exists yet */}
      {forgotMessageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(46,29,20,0.55)" }}
          onClick={() => setForgotMessageOpen(false)}
        >
          <div
            className="bg-[#FBF6EA] rounded-xl max-w-[360px] w-full p-6 text-center"
            style={{ border: "1px solid #d9c6a0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="text-[16px] mb-2"
              style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: "#2E1D14" }}
            >
              Password reset isn't available yet
            </div>
            <p className="text-[12.5px] mb-4" style={{ color: "#7a7364" }}>
              This feature hasn't been built yet. If you're locked out of your account, please contact an administrator to have your password reset manually.
            </p>
            <button
              onClick={() => setForgotMessageOpen(false)}
              className="px-5 py-2 rounded-full text-[13px]"
              style={{ backgroundColor: "#2E1D14", color: "#F3E8D0" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
