import { useState, useRef, useEffect, Fragment } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Send, Loader2, MapPin, Calendar, Home,
  MessageSquare, Eye, Clock, Check, X, Shield, Megaphone,
} from "lucide-react";

export default function ConversationThread({ adminMode = false, adminConversationId }: { adminMode?: boolean; adminConversationId?: number } = {}) {
  const [, params] = useRoute("/conversations/:id");
  const conversationId = adminConversationId || (params?.id ? parseInt(params.id) : null);
  const { user, isAuthenticated } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: adminData, isLoading: adminLoading } = useQuery<any>({
    queryKey: ["/api/admin/conversations", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: adminMode && !!conversationId,
  });

  const { data: conversation, isLoading: convoLoading } = useQuery<any>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !adminMode && !!conversationId,
  });

  const { data: regularMessages = [], isLoading: msgsLoading } = useQuery<any[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !adminMode && !!conversationId,
    refetchInterval: 10000,
  });

  const activeConversation = adminMode ? adminData?.conversation : conversation;
  const messages = adminMode ? (adminData?.messages || []) : regularMessages;
  const isLoadingConvo = adminMode ? adminLoading : convoLoading;
  const isLoadingMsgs = adminMode ? adminLoading : msgsLoading;

  const { data: showingRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/showing-requests"],
    enabled: !adminMode && !!conversationId && isAuthenticated,
  });

  const showingMutation = useMutation({
    mutationFn: async ({ id, status, confirmedDate }: { id: number; status: string; confirmedDate?: string }) => {
      return apiRequest("PATCH", `/api/showing-requests/${id}`, { status, confirmedDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/showing-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
    },
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

  useEffect(() => {
    if (!adminMode && conversationId && isAuthenticated) {
      apiRequest("PATCH", `/api/conversations/${conversationId}/read`).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
        queryClient.invalidateQueries({ queryKey: ["/api/conversations/unread-count"] });
      }).catch(() => {});
    }
  }, [conversationId, isAuthenticated, adminMode]);

  if (!adminMode && !isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view conversations.</p>
      </div>
    );
  }

  if (isLoadingConvo || isLoadingMsgs) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeConversation) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Conversation not found.</p>
        {!adminMode && (
          <Link href="/dashboard?section=messages" className="text-primary font-bold">
            Back to Messages
          </Link>
        )}
      </div>
    );
  }

  const isBuyer = !adminMode && activeConversation.buyerUserId === user?.id;
  const otherParty = adminMode ? null : (isBuyer ? activeConversation.agent : activeConversation.buyer);
  const otherName = adminMode
    ? "Admin View"
    : otherParty?.firstName
      ? `${otherParty.firstName} ${otherParty.lastName || ""}`.trim()
      : otherParty?.email || "Unknown";
  const property = activeConversation.property;

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

  const lastReadAt = isBuyer ? activeConversation.buyerLastReadAt : activeConversation.agentLastReadAt;
  const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : null;
  let unreadSeparatorShown = false;

  function renderMessage(msg: any) {
    const isMe = !adminMode && msg.senderUserId === user?.id;
    const senderName = msg.sender?.firstName || msg.sender?.email?.split("@")[0] || "User";
    const isSystem = msg.type === "system";
    const isShowingRequest = msg.type === "showing_request";
    const isReverseOffer = msg.type === "reverse_offer";
    const isPitch = msg.type === "pitch";

    if (isSystem) {
      return (
        <div key={msg.id} className="text-center">
          <span className="inline-block bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
            {msg.content}
          </span>
        </div>
      );
    }

    if (isPitch) {
      return (
        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[80%] rounded-2xl px-4 py-3 border-2 border-amber-400/40 ${isMe ? "bg-amber-600 text-white" : "bg-amber-50 dark:bg-amber-900/20 text-foreground"}`} data-testid={`message-${msg.id}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Megaphone className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Property Pitch</span>
            </div>
            {!isMe && (
              <p className="text-xs font-bold mb-0.5">{senderName}</p>
            )}
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            <p className={`text-xs mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>
      );
    }

    if (isShowingRequest) {
      const showingReqId = msg.metadata?.showingRequestId;
      const matchedShowing = showingReqId ? showingRequests.find((s: any) => s.id === showingReqId) : null;
      const showingStatus = matchedShowing?.status || "pending";
      const isAgentViewer = !isBuyer && !adminMode;
      const canAct = isAgentViewer && showingStatus === "pending";

      return (
        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[80%] rounded-2xl px-4 py-3 border-2 border-blue-400/30 ${isMe ? "bg-primary text-primary-foreground" : "bg-blue-50 dark:bg-blue-900/20 text-foreground"}`} data-testid={`message-${msg.id}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Showing Request</span>
              {showingStatus !== "pending" && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ml-1 ${
                  showingStatus === "confirmed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  showingStatus === "declined" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}>
                  {showingStatus}
                </span>
              )}
            </div>
            <p className="text-sm">{msg.content}</p>
            {canAct && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => showingMutation.mutate({ id: showingReqId, status: "confirmed", confirmedDate: msg.metadata?.requestedDates?.[0] })}
                  disabled={showingMutation.isPending}
                  className="flex items-center gap-1 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                  data-testid={`button-confirm-showing-${showingReqId}`}
                >
                  <Check className="w-3 h-3" />
                  Confirm
                </button>
                <button
                  onClick={() => showingMutation.mutate({ id: showingReqId, status: "declined" })}
                  disabled={showingMutation.isPending}
                  className="flex items-center gap-1 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                  data-testid={`button-decline-showing-${showingReqId}`}
                >
                  <X className="w-3 h-3" />
                  Decline
                </button>
              </div>
            )}
            <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>
      );
    }

    if (isReverseOffer) {
      return (
        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[80%] rounded-2xl px-4 py-3 border-2 border-amber-400/40 ${isMe ? "bg-amber-600 text-white" : "bg-amber-50 dark:bg-amber-900/20 text-foreground"}`} data-testid={`message-${msg.id}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold">Reverse Offer</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            <p className={`text-xs mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
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
            <p className="text-xs font-bold mb-0.5 text-foreground">{senderName}</p>
          )}
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  const backHref = adminMode
    ? "/admin"
    : isBuyer
      ? "/dashboard?section=messages"
      : "/agent?tab=messages";

  return (
    <div className={`flex flex-col ${adminMode ? "h-[70vh]" : "h-[calc(100vh-64px)]"} max-w-4xl mx-auto`} data-testid="conversation-thread">
      {adminMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2" data-testid="admin-view-banner">
          <Shield className="w-4 h-4 text-amber-700" />
          <span className="text-sm font-bold text-amber-800">Admin View — Read Only</span>
        </div>
      )}

      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        {!adminMode && (
          <Link href={backHref} className="p-2 hover:bg-muted rounded-lg transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          {adminMode ? (
            <div>
              <p className="font-bold text-foreground text-sm" data-testid="text-admin-participants">
                {activeConversation.buyer?.firstName || activeConversation.buyer?.email || "Buyer"} ↔ {activeConversation.agent?.firstName || activeConversation.agent?.email || "Seller/Agent"}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                <Home className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{property?.title || "Property"}</span>
              </div>
            </div>
          ) : (
            <>
              <p className="font-bold text-foreground truncate" data-testid="text-other-party">{otherName}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                <Home className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{property?.title || "Property"}</span>
              </div>
            </>
          )}
        </div>
        {property?.id && (
          <Link
            href={`/property/${property.id}`}
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
            data-testid="link-view-property"
          >
            <Eye className="w-3.5 h-3.5" />
            View Listing
          </Link>
        )}
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
            <p className="text-sm">No messages yet. {!adminMode && "Start the conversation!"}</p>
          </div>
        )}
        {messages.map((msg: any) => {
          const msgTime = new Date(msg.createdAt).getTime();
          const showUnreadSep = !adminMode && !unreadSeparatorShown && lastReadTime && msgTime > lastReadTime && msg.senderUserId !== user?.id;
          if (showUnreadSep) unreadSeparatorShown = true;
          return (
            <Fragment key={msg.id}>
              {showUnreadSep && (
                <div className="flex items-center gap-3 py-1" data-testid="unread-separator">
                  <div className="flex-1 h-px bg-destructive/40" />
                  <span className="text-xs font-bold text-destructive/70">New messages</span>
                  <div className="flex-1 h-px bg-destructive/40" />
                </div>
              )}
              {renderMessage(msg)}
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {!adminMode && (
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
      )}
    </div>
  );
}
