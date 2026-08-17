"use client";

import { useRef, useState } from "react";
import { SectionShell } from "@/components/SectionShell";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Send, Sparkles } from "lucide-react";

type Msg = { id: string; role: "user" | "assistant"; content: string };

export default function AssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);

    const newMessages: Msg[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: userMsg },
    ];
    setMessages(newMessages);
    scrollToBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.reply },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, something went wrong: ${err.message}`,
        },
      ]);
    }

    setSending(false);
    scrollToBottom();
  };

  return (
    <SectionShell title="AI Assistant" description="Powered by Gemini 2.5 Flash">
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-auto rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(107,76,76,.08)]">
                <Sparkles className="h-5 w-5 text-[#6B4C4C]" strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-[500] text-[#2A1F1A]">
                Ask me anything about your marketing numbers
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {[
                  "How did MQLs trend this month?",
                  "Which lead sources performed best?",
                  "What's our email open rate?",
                  "Summarize this week's numbers",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="rounded-[9999px] border border-[#D4CBC0] px-3 py-1.5 text-[12px] text-[#6B4C4C] hover:bg-[#F9F5F1] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-[16px] px-4 py-2.5 text-[14px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#6B4C4C] text-[#F9F5F1]"
                    : "bg-[#F2EDE8] text-[#2A1F1A] border border-[#D4CBC0]"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-[16px] bg-[#F2EDE8] border border-[#D4CBC0] px-4 py-2.5 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6B4C4C]" />
                <span className="text-[13px] text-[#7A6A60]">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Ask anything about your marketing numbers..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !sending && void send()}
            className="flex-1 rounded-[9999px] border border-[#D4CBC0] bg-white px-5 py-2.5 text-[14px] text-[#2A1F1A] outline-none placeholder:text-[#D4CBC0] focus:border-[#6B4C4C] focus:ring-2 focus:ring-[rgba(107,76,76,.15)]"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6B4C4C] text-[#F9F5F1] hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </SectionShell>
  );
}
