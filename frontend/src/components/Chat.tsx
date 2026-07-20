import { useEffect, useRef, useState } from "react";
import { streamChat, type Message } from "../api";

const DEFAULT_MODEL = "gpt-4o-mini";

interface ChatMessage extends Message {
  id: number;
  streaming?: boolean;
}

let nextId = 1;

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError(null);

    const userMsg: ChatMessage = { id: nextId++, role: "user", content: text };
    const assistantMsg: ChatMessage = {
      id: nextId++,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    // Build the history to send (exclude the empty placeholder)
    const history: Message[] = [...messages, userMsg].map(({ role, content }) => ({
      role,
      content,
    }));

    abortRef.current = streamChat(history, model, {
      onToken(token) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: m.content + token } : m,
          ),
        );
      },
      onDone() {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, streaming: false } : m,
          ),
        );
        setLoading(false);
      },
      onError(err) {
        setError(err);
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
        setLoading(false);
      },
    });
  }

  function handleStop() {
    abortRef.current?.abort();
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
    setLoading(false);
  }

  function handleClear() {
    if (loading) handleStop();
    setMessages([]);
    setError(null);
  }

  // Submit on Enter (Shift+Enter = new line)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>🔭 OTel GenAI Chat</h1>
        <p className="chat-subtitle">
          Powered by OpenAI Chat Completions · traced with OpenTelemetry GenAI semconv
        </p>
        <div className="model-row">
          <label htmlFor="model-input">Model:</label>
          <input
            id="model-input"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            disabled={loading}
          />
          <button className="btn-ghost" onClick={handleClear} disabled={loading && !messages.length}>
            Clear
          </button>
        </div>
      </header>

      <div className="messages-area">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Start a conversation. Every request generates <code>gen_ai.*</code> spans — check Kibana APM.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <span className="message-role">{msg.role === "user" ? "You" : "Assistant"}</span>
            <div className="message-content">
              {msg.content || (msg.streaming ? <span className="cursor">▋</span> : null)}
              {msg.streaming && msg.content && <span className="cursor">▋</span>}
            </div>
          </div>
        ))}

        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form className="input-area" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          disabled={loading}
          rows={3}
        />
        <div className="input-buttons">
          {loading ? (
            <button type="button" className="btn-stop" onClick={handleStop}>
              Stop
            </button>
          ) : (
            <button type="submit" className="btn-send" disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
