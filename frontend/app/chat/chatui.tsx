"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Sparkles, X, Trash2, Plus, Mic, BookMarked, RotateCcw, Search as SearchIcon } from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

// -----------------------------------------------------------------
// Rough filter so casual chat ("hi", "thanks") doesn't pollute the
// book search history. This is a heuristic guess based on message
// text alone — the frontend has no way to know which backend tool
// the AI actually called, so this won't be perfect.
// -----------------------------------------------------------------
const CHIT_CHAT_WORDS = new Set([
  "hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "bye",
  "yes", "no", "cool", "great", "nice", "good", "morning", "sup",
]);

function looksLikeBookQuery(text: string): boolean {
  const cleaned = text.trim().toLowerCase().replace(/[.!?]/g, "");
  if (!cleaned) return false;
  if (CHIT_CHAT_WORDS.has(cleaned)) return false;
  if (cleaned.split(" ").length <= 1 && cleaned.length < 4) return false;
  return true;
}

// The backend's search_books/recommend_books tools always format
// their results with "Title: ..." lines. Detecting that pattern
// lets the UI show it as a distinct "search results" card instead
// of a plain chat bubble — similar to how Claude visually separates
// web search results from ordinary text.
function looksLikeSearchResults(text: string): boolean {
  return /Title:\s*/i.test(text);
}

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------
interface Book {
  id: number;
  title: string;
  author: string;
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

interface ChatSession {
  id: string;
  user_id: number;
  title: string | null;
  created_at: string;
  updated_at: string | null;
}

interface BorrowRecord {
  id: number;
  user_id: number;
  book_id: number;
  copy_id: number | null;
  borrow_date: string;
  return_date: string | null;
  status: string;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      .panel-scroll::-webkit-scrollbar { width: 6px; }
      .panel-scroll::-webkit-scrollbar-track { background: transparent; }
      .panel-scroll::-webkit-scrollbar-thumb { background: #d9c6a0; border-radius: 4px; }
      .wood-bg {
        background-color: #C99B60;
        background-image:
          repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px),
          repeating-linear-gradient(90deg, rgba(93,58,23,0.07) 0px, rgba(93,58,23,0.07) 1px, transparent 1px, transparent 6px),
          linear-gradient(180deg, #D3A76E 0%, #BE8E52 100%);
      }
    `}</style>
  );
}

// -----------------------------------------------------------------
// Left panel — chat session history
// -----------------------------------------------------------------
function HistoryPanel({
  activeSessionId,
  onSelect,
  onNewChat,
  refreshKey,
  onSessionDeleted,
}: {
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  refreshKey: number;
  onSessionDeleted: (id: string) => void;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/chat/sessions`, { headers: authHeaders() });
        if (!res.ok) throw new Error("bad response");
        const data: ChatSession[] = await res.json();
        if (!cancelled) setSessions(data);
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        setSessions((s) => s.filter((session) => session.id !== id));
        onSessionDeleted(id);
      }
    } catch {
      // silently leave the session in the list if deletion failed
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <div className="bg-[#F3E8D0] rounded-2xl p-4 flex flex-col h-full min-h-0" style={{ border: "1px solid #d9c6a0" }}>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[12px] uppercase tracking-[0.15em]"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8a6b2f" }}
        >
          History
        </span>
        <button
          onClick={onNewChat}
          className="text-[11px] px-2.5 py-1 rounded-full"
          style={{ border: "1px solid #B8934A", color: "#8a6b2f" }}
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll space-y-2">
        {loading ? (
          <div className="text-[12px] text-[#9a9284] px-1">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="text-[12px] text-[#9a9284] px-1">No conversations yet.</div>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="group relative">
              <button
                onClick={() => onSelect(s.id)}
                className="w-full text-left pl-3.5 pr-8 py-2.5 rounded-xl text-[12.5px] truncate transition-colors"
                style={{
                  border: "1px solid #d9c6a0",
                  backgroundColor: s.id === activeSessionId ? "#2E1D14" : "#FBF6EA",
                  color: s.id === activeSessionId ? "#F3E8D0" : "#2E1D14",
                }}
              >
                {s.title || `Conversation #${s.id}`}
              </button>

              {confirmingId === s.id ? (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                    disabled={deletingId === s.id}
                    className="text-[9.5px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "#A24B3B", color: "#F3E8D0" }}
                  >
                    {deletingId === s.id ? "…" : "Delete"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmingId(null);
                    }}
                    className="text-[9.5px] px-1.5 py-0.5 rounded-full"
                    style={{ border: "1px solid #d9c6a0", color: "#7a7364" }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingId(s.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete conversation"
                >
                  <Trash2 size={13} color={s.id === activeSessionId ? "#F3E8D0" : "#A24B3B"} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Right panel — Summary, search history, order (borrow) history
// -----------------------------------------------------------------
function SummaryPanel({
  lastAssistantMessage,
  searchHistory,
}: {
  lastAssistantMessage: string | null;
  searchHistory: string[];
}) {
  const [borrows, setBorrows] = useState<BorrowRecord[]>([]);
  const [bookTitles, setBookTitles] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [borrowRes, booksRes] = await Promise.all([
          fetch(`${API_BASE}/borrow/my`, { headers: authHeaders() }),
          fetch(`${API_BASE}/books/?skip=0&limit=1000`),
        ]);

        if (borrowRes.ok) {
          const borrowData: BorrowRecord[] = await borrowRes.json();
          if (!cancelled) setBorrows(borrowData);
        }

        if (booksRes.ok) {
          const books: Book[] = await booksRes.json();
          if (!cancelled) {
            const map: Record<number, string> = {};
            books.forEach((b) => (map[b.id] = b.title));
            setBookTitles(map);
          }
        }
      } catch {
        if (!cancelled) setBorrows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-[#F3E8D0] rounded-2xl p-4 flex flex-col h-full overflow-y-auto panel-scroll" style={{ border: "1px solid #d9c6a0" }}>
      <button
        onClick={() => setSummaryOpen((v) => !v)}
        className="w-full flex items-center justify-between mb-4"
      >
        <span
          className="text-[16px]"
          style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: "#2E1D14" }}
        >
          Summary
        </span>
        <span className="text-[11px]" style={{ color: "#8a6b2f" }}>
          {summaryOpen ? "▴ Hide" : "▾ Show"}
        </span>
      </button>

      {summaryOpen && (
        <p className="text-[12px] leading-relaxed mb-6" style={{ color: "#5c5442" }}>
          {lastAssistantMessage
            ? lastAssistantMessage
            : "Ask the AI Librarian something and a short summary of the conversation will appear here."}
        </p>
      )}

      <div
        className="text-[11px] uppercase tracking-[0.12em] mb-2 pb-1"
        style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8a6b2f", borderBottom: "1px solid #e6d8b8" }}
      >
        Book Search History
      </div>
      {searchHistory.length === 0 ? (
        <div className="text-[12px] text-[#9a9284] mb-5">Nothing searched yet this session.</div>
      ) : (
        <ol className="text-[12.5px] mb-5 space-y-1.5 list-decimal list-inside" style={{ color: "#2E1D14" }}>
          {searchHistory.map((q, i) => (
            <li key={i} className="truncate">{q}</li>
          ))}
        </ol>
      )}

      <div
        className="text-[11px] uppercase tracking-[0.12em] mb-2 pb-1"
        style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8a6b2f", borderBottom: "1px solid #e6d8b8" }}
      >
        Book Order History
      </div>
      {loading ? (
        <div className="text-[12px] text-[#9a9284]">Loading…</div>
      ) : borrows.length === 0 ? (
        <div className="text-[12px] text-[#9a9284]">No borrow records yet.</div>
      ) : (
        <ol className="text-[12.5px] space-y-1.5 list-decimal list-inside" style={{ color: "#2E1D14" }}>
          {borrows.map((b) => (
            <li key={b.id} className="truncate">
              {bookTitles[b.book_id] || `Book #${b.book_id}`}
              {b.status === "borrowed" && (
                <span className="text-[10px] ml-1" style={{ color: "#8fb37a" }}>
                  (active)
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Middle panel — main chat
// -----------------------------------------------------------------
function MainChatPanel({
  sessionId,
  setSessionId,
  onSessionCreated,
  onAssistantReply,
  onUserQuery,
}: {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  onSessionCreated: () => void;
  onAssistantReply: (text: string) => void;
  onUserQuery: (text: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [inputBooks, setInputBooks] = useState<Book[]>([]);
  const [bookSuggestionsOpen, setBookSuggestionsOpen] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const LOADING_PHRASES = [
    "Thinking…",
    "Checking the shelves…",
    "Flipping through the catalog…",
    "Consulting the librarian…",
    "Looking that up…",
    "Searching the stacks…",
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Rotate through a few different loading phrases instead of always
  // showing the same "Thinking…" text, while a request is in flight
  useEffect(() => {
    if (!loading) {
      setLoadingPhraseIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
    }, 1600);
    return () => clearInterval(interval);
  }, [loading]);

  // Fetch a book list once, for the "Ask anything" input's suggestions
  useEffect(() => {
    let cancelled = false;

    async function loadBooks() {
      try {
        const res = await fetch(`${API_BASE}/books/?skip=0&limit=200`);
        if (!res.ok) return;
        const data: Book[] = await res.json();
        if (!cancelled) setInputBooks(data);
      } catch {
        // suggestions just won't populate if this fails
      }
    }

    loadBooks();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sessionId === null) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      try {
        const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("bad response");
        const data: { role: string; message: string }[] = await res.json();
        if (!cancelled) {
          setMessages(
            data.map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.message,
            }))
          );
          setPendingConfirmation(null);
        }
      } catch {
        // leave whatever's shown if this fails
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const sendToAgent = useCallback(
    async (text: string, isConfirmationReply: boolean) => {
      setLoading(true);

      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
            awaiting_confirmation: isConfirmationReply,
          }),
        });

        if (!res.ok) throw new Error("bad response");
        const data: ChatApiResponse = await res.json();

        const isNewSession = sessionId === null;
        setSessionId(data.session_id);
        if (isNewSession) onSessionCreated();

        if (data.awaiting_confirmation) {
          setPendingConfirmation(data.response);
        } else {
          setPendingConfirmation(null);
          setMessages((m) => [...m, { role: "assistant", content: data.response }]);
          onAssistantReply(data.response);
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
    [sessionId, setSessionId, onSessionCreated, onAssistantReply]
  );

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    if (looksLikeBookQuery(text)) onUserQuery(text);
    setInput("");
    sendToAgent(text, false);
  }

  function handleConfirmAnswer(answer: string) {
    setMessages((m) => [...m, { role: "user", content: answer }]);
    sendToAgent(answer, true);
  }

  function handleMicClick() {
    // Uses the browser's built-in speech-to-text (Web Speech API) —
    // works in Chrome/Edge without any backend support. Not
    // available in every browser (notably not in Firefox), so it
    // fails gracefully if unsupported.
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Voice input isn't supported in this browser. Try Chrome or Edge instead.",
        },
      ]);
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event: any) => {
      setListening(false);
      const reason = event?.error || "unknown";
      let message = `Voice input error: ${reason}.`;
      if (reason === "not-allowed" || reason === "permission-denied") {
        message = "Microphone access was blocked. Click the padlock icon in your browser's address bar and allow microphone access for this site, then try again.";
      } else if (reason === "no-speech") {
        message = "Didn't catch any speech — try again and speak right after clicking the mic.";
      }
      setMessages((m) => [...m, { role: "assistant", content: message }]);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <div className="bg-[#FBF6EA] rounded-2xl flex flex-col h-full min-h-0 overflow-hidden" style={{ border: "1px solid #d9c6a0" }}>
      <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #e6d8b8" }}>
        <div
          className="text-[20px] mb-1.5"
          style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: "#2E1D14" }}
        >
          AI Librarian
        </div>
        <p className="text-[12.5px] leading-relaxed" style={{ color: "#7a7364" }}>
          Ask about a book, get a recommendation, or borrow and return titles right from the chat.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto panel-scroll px-6 py-5 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="h-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-[13px]" style={{ color: "#b3a88d" }}>
              <Sparkles size={14} color="#B8934A" />
              Say hello, or ask about a book to get started.
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "assistant" && looksLikeSearchResults(m.content) ? (
            <div key={i} className="flex justify-start">
              <div
                className="max-w-[85%] rounded-xl overflow-hidden"
                style={{ border: "1px solid #d9c6a0" }}
              >
                <div
                  className="flex items-center gap-1.5 px-3.5 py-2 text-[11px]"
                  style={{ backgroundColor: "#efe4c8", color: "#8a6b2f" }}
                >
                  <SearchIcon size={12} />
                  Searched the library
                </div>
                <div
                  className="px-3.5 py-3 text-[13px] leading-relaxed whitespace-pre-line"
                  style={{ backgroundColor: "#FBF6EA", color: "#2E1D14" }}
                >
                  {m.content}
                </div>
              </div>
            </div>
          ) : (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[70%] px-4 py-2.5 text-[13.5px] leading-relaxed"
                style={
                  m.role === "user"
                    ? { backgroundColor: "#2E1D14", color: "#F3E8D0", borderRadius: "14px 14px 3px 14px" }
                    : { backgroundColor: "#efe4c8", color: "#2E1D14", borderRadius: "14px 14px 14px 3px" }
                }
              >
                {m.content}
              </div>
            </div>
          )
        )}

        {pendingConfirmation && (
          <div className="flex justify-start">
            <div
              className="border-2 border-dashed rounded-xl px-4 py-3 max-w-[70%]"
              style={{ borderColor: "#B8934A", backgroundColor: "#FBF6EA" }}
            >
              <div className="text-[10.5px] uppercase tracking-wide mb-1.5" style={{ color: "#A24B3B" }}>
                Confirmation required
              </div>
              <div className="text-[13.5px] text-[#2E1D14] mb-2.5">{pendingConfirmation}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirmAnswer("YES")}
                  className="text-[12px] px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "#2E5450", color: "#F3E8D0" }}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleConfirmAnswer("NO")}
                  className="text-[12px] px-3 py-1.5 rounded-full"
                  style={{ border: "1px solid #A24B3B", color: "#A24B3B" }}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "#9a9284" }}>
            <Loader2 size={13} className="animate-spin" />
            {LOADING_PHRASES[loadingPhraseIndex]}
          </div>
        )}
      </div>

      <div className="px-5 pt-2 pb-4" style={{ borderTop: "1px solid #e6d8b8" }}>
        <p className="text-[10.5px] text-center mb-2" style={{ color: "#b3a88d" }}>
          AI Librarian can make mistakes. Check important info.
        </p>

        <div className="relative flex items-center gap-1.5 bg-white rounded-full pl-1.5 pr-1.5 py-1.5" style={{ border: "1px solid #d9c6a0" }}>
          <button
            onClick={() => {
              setPlusMenuOpen((v) => !v);
              setBookSuggestionsOpen(false);
            }}
            disabled={!!pendingConfirmation || loading}
            className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 disabled:opacity-40"
            style={{ backgroundColor: "#F3E8D0" }}
          >
            <Plus size={16} color="#2E1D14" />
          </button>

          {plusMenuOpen && (
            <div
              className="absolute left-0 bottom-full mb-2 rounded-xl overflow-hidden z-20"
              style={{ backgroundColor: "#FBF6EA", border: "1px solid #d9c6a0", boxShadow: "0 10px 24px rgba(46,29,20,0.25)" }}
            >
              {[
                { icon: SearchIcon, label: "Search for a book", text: "Search for " },
                { icon: BookMarked, label: "Borrow a book", text: "I want to borrow " },
                { icon: RotateCcw, label: "Return a book", text: "I want to return " },
                { icon: Sparkles, label: "Get a recommendation", text: "Recommend me a book about " },
              ].map(({ icon: Icon, label, text }) => (
                <button
                  key={label}
                  onClick={() => {
                    setInput(text);
                    setPlusMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12.5px] whitespace-nowrap hover:bg-[#efe4c8] transition-colors"
                  style={{ color: "#2E1D14" }}
                >
                  <Icon size={14} color="#8a6b2f" />
                  {label}
                </button>
              ))}
            </div>
          )}

          <input
            value={input}
            onChange={(e) => {
              const value = e.target.value;
              setInput(value);
              if (value.trim() === "\\") setBookSuggestionsOpen(true);
            }}
            onFocus={() => {
              setBookSuggestionsOpen(true);
              setPlusMenuOpen(false);
            }}
            onBlur={() => setTimeout(() => setBookSuggestionsOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            disabled={!!pendingConfirmation || loading}
            placeholder="Ask anything"
            className="flex-1 text-[13.5px] text-[#2E1D14] outline-none bg-transparent disabled:opacity-60"
          />

          {bookSuggestionsOpen && inputBooks.length > 0 && (messages.length === 0 || input.trim() === "\\") && (
            <div
              className="absolute left-0 right-0 bottom-full mb-2 rounded-xl z-20 max-h-[260px] overflow-y-auto panel-scroll p-2.5"
              style={{ backgroundColor: "#FBF6EA", border: "1px solid #d9c6a0", boxShadow: "0 10px 24px rgba(46,29,20,0.25)" }}
            >
              <div
                className="text-[10.5px] uppercase tracking-wide mb-2 px-1"
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8a6b2f" }}
              >
                Ask about a book
              </div>
              <div className="flex flex-wrap gap-1.5">
                {inputBooks
                  .filter(
                    (b) =>
                      input.trim() === "\\" ||
                      !input.trim() ||
                      b.title.toLowerCase().includes(input.toLowerCase()) ||
                      b.author.toLowerCase().includes(input.toLowerCase())
                  )
                  .map((b) => (
                    <button
                      key={b.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setInput(`Tell me about "${b.title}" by ${b.author}.`);
                        setBookSuggestionsOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-full text-[11px] transition-colors hover:bg-[#efe4c8]"
                      style={{ backgroundColor: "#F3E8D0", color: "#2E1D14" }}
                    >
                      {b.title}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <button
            onClick={handleMicClick}
            disabled={!!pendingConfirmation || loading}
            className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 disabled:opacity-40 transition-colors"
            style={{ backgroundColor: listening ? "#A24B3B" : "transparent" }}
            title={listening ? "Stop listening" : "Speak your question"}
          >
            <Mic size={15} color={listening ? "#F3E8D0" : "#2E1D14"} />
          </button>

          <button
            onClick={handleSend}
            disabled={!!pendingConfirmation || loading || !input.trim()}
            className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 disabled:opacity-30"
            style={{ backgroundColor: "#2E1D14" }}
          >
            <Send size={14} color="#F3E8D0" />
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Page — a real route (/chat or /chat/[sessionId]), not a modal.
// Session changes push a new URL instead of just changing state,
// so each conversation has its own shareable/refreshable address.
// -----------------------------------------------------------------
export default function ChatPage({ initialSessionId }: { initialSessionId: string | null }) {
  const router = useRouter();
  const [sessionId, setSessionIdState] = useState<string | null>(initialSessionId);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Tracks whether the URL is about to change because WE just called
  // setSessionId ourselves (click, new message, etc.) versus an
  // external navigation (browser back/forward). Without this, the
  // effect below can race against our own click and silently revert
  // it a moment later - which is exactly the "need to click twice"
  // and "conversation vanishes into history" bug.
  const selfInitiatedNavRef = useRef(false);

  // Keep local state in sync if the URL changes from OUTSIDE our own
  // click handlers (e.g. browser back/forward, or a hard refresh).
  useEffect(() => {
    if (selfInitiatedNavRef.current) {
      selfInitiatedNavRef.current = false;
      return;
    }
    setSessionIdState(initialSessionId);
  }, [initialSessionId]);

  function setSessionId(id: string | null) {
    selfInitiatedNavRef.current = true;
    setSessionIdState(id);
    router.push(id === null ? "/chat" : `/chat/${id}`);
  }

  function handleNewChat() {
    setSessionId(null);
  }

  function handleSessionCreated() {
    setHistoryRefreshKey((k) => k + 1);
  }

  function handleUserQuery(text: string) {
    setSearchHistory((h) => [...h, text]);
  }

  function handleSessionDeleted(deletedId: number) {
    if (sessionId === deletedId) {
      setSessionId(null);
    }
  }

  return (
    <div className="fixed inset-0 wood-bg p-6 z-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <GlobalStyle />

      <button
        onClick={() => router.push("/")}
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-10"
        style={{ backgroundColor: "#2E1D14" }}
        title="Back to library"
      >
        <X size={16} color="#F3E8D0" />
      </button>

      <div className="max-w-7xl mx-auto h-[calc(100vh-48px)] min-h-0 grid grid-cols-[240px_1fr_280px] gap-5">
        <HistoryPanel
          activeSessionId={sessionId}
          onSelect={setSessionId}
          onNewChat={handleNewChat}
          refreshKey={historyRefreshKey}
          onSessionDeleted={handleSessionDeleted}
        />

        <MainChatPanel
          sessionId={sessionId}
          setSessionId={setSessionId}
          onSessionCreated={handleSessionCreated}
          onAssistantReply={setLastAssistantMessage}
          onUserQuery={handleUserQuery}
        />

        <SummaryPanel lastAssistantMessage={lastAssistantMessage} searchHistory={searchHistory} />
      </div>
    </div>
  );
}