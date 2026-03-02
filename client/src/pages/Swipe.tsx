import { useState, useRef, useCallback, useEffect } from "react";
import { useProperties } from "@/hooks/use-properties";
import { useSavedProperties, useToggleSavedProperty } from "@/hooks/use-saved";
import { useAuth } from "@/hooks/use-auth";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import {
  Heart, X, RotateCcw, MapPin, BedDouble, Bath,
  Maximize, ChevronRight, ChevronLeft, Sparkles,
} from "lucide-react";
import { Link } from "wouter";

const SWIPE_THRESHOLD = 90;
const FALLBACK = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=1200&fit=crop";

export default function Swipe() {
  const { data: properties = [], isLoading } = useProperties({});
  const { data: savedProps = [] } = useSavedProperties();
  const { mutate: toggleSave } = useToggleSavedProperty();
  const { isAuthenticated } = useAuth();

  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [flyOut, setFlyOut] = useState<"left" | "right" | null>(null);
  const [lastAction, setLastAction] = useState<"liked" | "passed" | null>(null);
  const [lastActionVisible, setLastActionVisible] = useState(false);

  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const activeProps = properties.filter(p => p.status === "active");
  const current = activeProps[currentIndex];
  const isSaved = savedProps.some(sp => sp.propertyId === current?.id);

  // Reset photo index when card changes
  useEffect(() => { setPhotoIndex(0); }, [currentIndex]);

  // Flash the action badge briefly
  const flashAction = (action: "liked" | "passed") => {
    setLastAction(action);
    setLastActionVisible(true);
    setTimeout(() => setLastActionVisible(false), 1200);
  };

  const commitSwipe = useCallback((dir: "left" | "right") => {
    if (!current) return;
    if (dir === "right") {
      if (!isAuthenticated) {
        setDragX(0); setDragY(0);
        setShowAuthPrompt(true);
        return;
      }
      if (!isSaved) toggleSave({ propertyId: current.id, isSaved: false });
      flashAction("liked");
    } else {
      flashAction("passed");
    }
    setFlyOut(dir);
    setTimeout(() => {
      setCurrentIndex(i => i + 1);
      setFlyOut(null);
      setDragX(0);
      setDragY(0);
    }, 320);
  }, [current, isAuthenticated, isSaved, toggleSave]);

  const swipeLeft  = useCallback(() => commitSwipe("left"),  [commitSwipe]);
  const swipeRight = useCallback(() => commitSwipe("right"), [commitSwipe]);

  // Pointer drag handlers (works for mouse + touch)
  const onPointerDown = (e: React.PointerEvent) => {
    if (flyOut) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    if (cardRef.current) cardRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStart.current) return;
    setDragX(e.clientX - dragStart.current.x);
    setDragY(e.clientY - dragStart.current.y);
  };

  const onPointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStart.current = null;
    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      commitSwipe(dragX > 0 ? "right" : "left");
    } else {
      setDragX(0); setDragY(0);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  swipeLeft();
      if (e.key === "ArrowRight") swipeRight();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [swipeLeft, swipeRight]);

  // Card visual math
  const rotation = isDragging ? dragX * 0.07 : 0;
  const likeOpacity  = Math.min(Math.max(dragX, 0) / SWIPE_THRESHOLD, 1);
  const passOpacity  = Math.min(Math.max(-dragX, 0) / SWIPE_THRESHOLD, 1);

  const getCardTransform = () => {
    if (flyOut === "right")
      return `translate(${window.innerWidth + 300}px, ${dragY - 80}px) rotate(30deg)`;
    if (flyOut === "left")
      return `translate(${-window.innerWidth - 300}px, ${dragY - 80}px) rotate(-30deg)`;
    return `translate(${dragX}px, ${dragY}px) rotate(${rotation}deg)`;
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const done = currentIndex >= activeProps.length;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col items-center bg-muted/30 overflow-hidden select-none">
      {showAuthPrompt && (
        <AuthPromptModal feature="favorite" onClose={() => setShowAuthPrompt(false)} />
      )}

      {/* Action flash badge */}
      <div
        className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 ${
          lastActionVisible ? "opacity-100 -translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {lastAction === "liked" && (
          <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
            <Heart className="w-4 h-4 fill-current" /> Added to favorites!
          </div>
        )}
        {lastAction === "passed" && (
          <div className="flex items-center gap-2 bg-foreground/70 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
            <X className="w-4 h-4" /> Passed
          </div>
        )}
      </div>

      {/* Header */}
      <div className="w-full max-w-sm flex items-center justify-between px-5 pt-4 pb-2">
        <h1 className="font-display font-bold text-lg">Swipe homes</h1>
        <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {Math.max(0, activeProps.length - currentIndex)} remaining
        </span>
      </div>

      {/* Hint */}
      {!done && (
        <p className="text-xs text-muted-foreground mb-2">
          ← Pass &nbsp;·&nbsp; ♥ Like → &nbsp;·&nbsp; ↑↓ Arrow keys
        </p>
      )}

      {/* Card stack area */}
      <div className="relative flex-1 w-full max-w-sm mx-auto px-4">

        {/* Empty / done state */}
        {done && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="text-6xl">🏡</div>
            <h2 className="font-display font-bold text-2xl">You've seen them all!</h2>
            <p className="text-muted-foreground text-sm">New listings added regularly.</p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => { setCurrentIndex(0); setLastAction(null); }}
                className="bg-primary text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Start over
              </button>
              <Link href="/search" className="border border-border bg-card px-5 py-2.5 rounded-full font-bold text-sm hover:bg-muted transition-colors">
                Browse all
              </Link>
            </div>
          </div>
        )}

        {/* Stack: render cards 2 behind + current on top */}
        {!done && [2, 1, 0].map(offset => {
          const prop = activeProps[currentIndex + offset];
          if (!prop) return null;

          const isTop = offset === 0;
          const scale = 1 - offset * 0.045;
          const vy = offset * 12;

          return (
            <div
              key={prop.id}
              ref={isTop ? cardRef : undefined}
              data-testid={isTop ? "card-swipe-current" : undefined}
              className={`absolute inset-x-4 rounded-3xl overflow-hidden shadow-2xl ${isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
              style={{
                top: 0,
                bottom: 0,
                transform: isTop
                  ? getCardTransform()
                  : `scale(${scale}) translateY(${vy}px)`,
                transition: (isTop && isDragging) ? "none" : "transform 0.32s cubic-bezier(.25,.8,.25,1)",
                zIndex: 10 - offset,
                touchAction: "none",
                transformOrigin: "bottom center",
              }}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerUp : undefined}
            >
              {/* Photo carousel */}
              {(() => {
                const photos: string[] =
                  prop.photos && (prop.photos as string[]).length > 0
                    ? (prop.photos as string[])
                    : [prop.imageUrl || FALLBACK];
                const pIdx = isTop ? photoIndex : 0;
                return (
                  <>
                    <div
                      className="absolute inset-0 flex"
                      style={{
                        width: `${photos.length * 100}%`,
                        transform: `translateX(-${(pIdx / photos.length) * 100}%)`,
                        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
                      }}
                    >
                      {photos.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          className="object-cover h-full"
                          style={{ width: `${100 / photos.length}%` }}
                          alt={prop.title}
                          draggable={false}
                        />
                      ))}
                    </div>

                    {/* Story-bar dots at the top */}
                    {isTop && photos.length > 1 && (
                      <div className="absolute top-3 left-4 right-4 flex gap-1 z-10 pointer-events-none">
                        {photos.map((_, i) => (
                          <div
                            key={i}
                            className={`h-[3px] flex-1 rounded-full transition-all duration-200 ${i <= pIdx ? "bg-white" : "bg-white/35"}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Left / right tap zones for photos */}
                    {isTop && photos.length > 1 && (
                      <>
                        <button
                          className="absolute left-0 top-0 h-full w-1/3 z-10"
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); setPhotoIndex(i => Math.max(0, i - 1)); }}
                          aria-label="Previous photo"
                        />
                        <button
                          className="absolute right-0 top-0 h-full w-1/3 z-10"
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); setPhotoIndex(i => Math.min(photos.length - 1, i + 1)); }}
                          aria-label="Next photo"
                        />
                      </>
                    )}
                  </>
                );
              })()}

              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none" />

              {isTop && (
                <>
                  {/* LIKE stamp */}
                  <div
                    className="absolute top-10 left-5 rotate-[-22deg] pointer-events-none"
                    style={{ opacity: likeOpacity }}
                  >
                    <span className="border-4 border-green-400 text-green-400 rounded-xl px-3 py-1.5 font-black text-2xl tracking-widest uppercase">
                      LIKE ♥
                    </span>
                  </div>

                  {/* NOPE stamp */}
                  <div
                    className="absolute top-10 right-5 rotate-[22deg] pointer-events-none"
                    style={{ opacity: passOpacity }}
                  >
                    <span className="border-4 border-red-400 text-red-400 rounded-xl px-3 py-1.5 font-black text-2xl tracking-widest uppercase">
                      NOPE ✕
                    </span>
                  </div>

                  {/* View detail button */}
                  <Link
                    href={`/property/${prop.id}`}
                    className="absolute top-4 right-4 bg-black/30 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-black/50 transition-colors flex items-center gap-1 pointer-events-auto"
                    onClick={e => e.stopPropagation()}
                    data-testid={`link-swipe-detail-${prop.id}`}
                  >
                    Details <ChevronRight className="w-3 h-3" />
                  </Link>

                  {/* Badges */}
                  {prop.isOffMarket && (
                    <div className="absolute top-4 left-4 pointer-events-none">
                      <span className="bg-foreground text-background text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-yellow-400" /> Make Me Move
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Property info */}
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white pointer-events-none">
                <div className="font-display font-bold text-2xl leading-tight">
                  ${prop.price.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-white/75 text-sm mt-0.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{prop.location}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/60 font-medium">
                  <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{prop.beds} bd</span>
                  <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{prop.baths} ba</span>
                  <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{prop.sqft.toLocaleString()} sqft</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom action buttons */}
      {!done && (
        <div className="flex items-center justify-center gap-5 py-5">
          {/* Undo */}
          <button
            onClick={() => currentIndex > 0 && setCurrentIndex(i => i - 1)}
            disabled={currentIndex === 0}
            className="w-11 h-11 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-all shadow-md disabled:opacity-25"
            title="Undo"
            data-testid="button-swipe-undo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Pass (X) */}
          <button
            onClick={swipeLeft}
            className="w-16 h-16 bg-white border-2 border-red-200 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 hover:border-red-400 transition-all shadow-lg active:scale-95"
            title="Pass (←)"
            data-testid="button-swipe-pass"
          >
            <X className="w-8 h-8" strokeWidth={2.5} />
          </button>

          {/* Like (Heart) */}
          <button
            onClick={swipeRight}
            className="w-16 h-16 bg-white border-2 border-green-200 rounded-full flex items-center justify-center text-green-500 hover:bg-green-50 hover:border-green-400 transition-all shadow-lg active:scale-95"
            title="Like (→)"
            data-testid="button-swipe-like"
          >
            <Heart className="w-8 h-8" strokeWidth={2.5} />
          </button>

          {/* View detail */}
          <Link
            href={`/property/${current?.id}`}
            className="w-11 h-11 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all shadow-md"
            title="View details"
            data-testid="link-swipe-view"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      )}
    </div>
  );
}
