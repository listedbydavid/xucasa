import { useState, useRef, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Send, Loader2, MapPin, Calendar, Home,
  MessageSquare, Eye, Clock,
} from "lucide-react";

export default function ConversationThread() {
  const [, params] = useRoute("/conversations/:id");
  const conversationId = params?.id ? parseInt(params.id) : null;
  const { user, isAuthenticated } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversation, isLoading: convoLoading } = useQuery<any>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<any[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/messages`, { content, type: "text" });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view conversations.</p>
      </div>
    );
  }

  if (convoLoading || msgsLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Conversation not found.</p>
        <Link href="/dashboard?section=messages" className="text-primary font-bold">
          Back to Messages
        </Link>
      </div>
    );
  }

  const isBuyer = conversation.buyerUserId === user?.id;
  const otherParty = isBuyer ? conversation.agent : conversation.buyer;
  const otherName = otherParty?.firstName
    ? `${otherParty.firstName} ${otherParty.lastName || ""}`.trim()
    : otherParty?.email || "Unknown";
  const property = conversation.property;

  const handleSend = () => {
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-4xl mx-auto" data-testid="conversation-thread">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href={isBuyer ? "/dashboard?section=messages" : "/agent?tab=messages"} className="p-2 hover:bg-muted rounded-lg transition-colors" data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate" data-testid="text-other-party">{otherName}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <Home className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{property?.title || "Property"}</span>
          </div>
        </div>
        <Link
          href={`/property/${property?.id}`}
          className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
          data-testid="link-view-property"
        >
          <Eye className="w-3.5 h-3.5" />
          View Listing
        </Link>
      </div>

      {property && (
        <div className="bg-muted/50 border-b border-border px-4 py-2 flex items-center gap-3">
          {property.imageUrl && (
            <img src={property.imageUrl} alt={property.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">${property.price?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {property.location || property.title}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="messages-container">
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map((msg: any) => {
          const isMe = msg.senderUserId === user?.id;
          const senderName = msg.sender?.firstName || msg.sender?.email?.split("@")[0] || "User";
          const isSystem = msg.type === "system";
          const isShowingRequest = msg.type === "showing_request";

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center">
                <span className="inline-block bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }

          if (isShowingRequest) {
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`} data-testid={`message-${msg.id}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">Showing Request</span>
                  </div>
                  <p className="text-sm">{msg.content}</p>
                  <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`} data-testid={`message-${msg.id}`}>
                {!isMe && (
                  <p className={`text-xs font-bold mb-0.5 ${isMe ? "text-primary-foreground/80" : "text-foreground"}`}>{senderName}</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-card border-t border-border px-4 py-3 safe-bottom" data-testid="message-input-area">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32"
            data-testid="input-message"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMutation.isPending}
            className="flex items-center justify-center w-10 h-10 bg-primary text-primary-foreground rounded-xl transition-all active:scale-95 disabled:opacity-40"
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
