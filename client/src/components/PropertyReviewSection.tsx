import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Star, MessageSquare, Send, Loader2, Eye, EyeOff,
  User, Camera, Mail, Phone, MapPin, CheckCircle2, AlertCircle,
} from "lucide-react";

interface ReviewUser {
  firstName: string;
  lastInitial: string;
  profileImageUrl: string | null;
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  isPublic: boolean;
  user: ReviewUser;
  moderatedBy?: string;
  userId?: string;
}

interface ProfileCompleteness {
  complete: boolean;
  missing: string[];
  profile: {
    hasPhoto: boolean;
    emailVerified: boolean;
    hasPhone: boolean;
    hasMailingAddress: boolean;
  };
}

function StarRating({ rating, size = "sm", interactive = false, onRate }: {
  rating: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRate?: (r: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const sizeClass = size === "lg" ? "w-7 h-7" : size === "md" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onRate?.(i)}
          onMouseEnter={() => interactive && setHover(i)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`${interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}`}
          data-testid={interactive ? `star-rating-${i}` : undefined}
        >
          <Star
            className={`${sizeClass} ${
              (interactive ? (hover || rating) : rating) >= i
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/30"
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

const EXAMPLE_REVIEW: Review = {
  id: -1,
  rating: 4,
  comment: "Beautiful home with great natural light. The kitchen renovation is stunning and the backyard is perfect for entertaining. Loved the neighborhood — walkable to shops and parks!",
  createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  isPublic: true,
  user: {
    firstName: "Sarah",
    lastInitial: "M.",
    profileImageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
  },
};

function ProfileCompleteGate({ completeness, onUpdate }: {
  completeness: ProfileCompleteness;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/completeness"] });
      onUpdate();
      toast({ title: "Profile updated" });
    },
  });

  const items = [
    { key: "photo", label: "Profile photo", icon: Camera, done: completeness.profile.hasPhoto, hint: "Add a photo from your account settings" },
    { key: "emailVerified", label: "Verified email", icon: Mail, done: completeness.profile.emailVerified, hint: "Verify your email address" },
    { key: "phone", label: "Phone number", icon: Phone, done: completeness.profile.hasPhone, hint: "Add your phone number" },
    { key: "mailingAddress", label: "Mailing address", icon: MapPin, done: completeness.profile.hasMailingAddress, hint: "Add your current mailing address" },
  ];

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-5" data-testid="section-profile-gate">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Complete your profile to leave a review</p>
      </div>
      <div className="space-y-2 mb-4">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-2.5 text-sm">
            {item.done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
            )}
            <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className={item.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}>{item.label}</span>
          </div>
        ))}
      </div>
      {(!completeness.profile.hasPhone || !completeness.profile.hasMailingAddress || !completeness.profile.emailVerified) && (
        <div className="space-y-3 pt-3 border-t border-amber-200 dark:border-amber-800/50">
          {!completeness.profile.emailVerified && (
            <p data-testid="text-verify-email-hint" className="text-sm text-muted-foreground">
              Sign in with Google to verify your email address automatically.
            </p>
          )}
          {!completeness.profile.hasPhone && (
            <div className="flex gap-2">
              <input
                data-testid="input-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Phone number"
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-input bg-background"
              />
              <button
                data-testid="button-save-phone"
                onClick={() => phone && updateMutation.mutate({ phone })}
                disabled={!phone || updateMutation.isPending}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}
          {!completeness.profile.hasMailingAddress && (
            <div className="flex gap-2">
              <input
                data-testid="input-mailing-address"
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Mailing address"
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-input bg-background"
              />
              <button
                data-testid="button-save-address"
                onClick={() => address && updateMutation.mutate({ mailingAddress: address })}
                disabled={!address || updateMutation.isPending}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PropertyReviewSection({ propertyId, isListingAgent, isAdmin }: {
  propertyId: number;
  isListingAgent: boolean;
  isAdmin: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const canModerate = isListingAgent || isAdmin;

  const { data: publicReviews = [], isLoading: loadingPublic } = useQuery<Review[]>({
    queryKey: ["/api/properties", propertyId, "reviews"],
    queryFn: () => fetch(`/api/properties/${propertyId}/reviews`).then(r => r.json()),
  });

  const { data: allReviews } = useQuery<Review[]>({
    queryKey: ["/api/properties", propertyId, "reviews", "all"],
    queryFn: () => fetch(`/api/properties/${propertyId}/reviews/all`, { credentials: "include" }).then(r => r.json()),
    enabled: canModerate,
  });

  const { data: completeness } = useQuery<ProfileCompleteness>({
    queryKey: ["/api/profile/completeness"],
    enabled: isAuthenticated,
  });

  const displayReviews = canModerate && Array.isArray(allReviews) ? allReviews : (Array.isArray(publicReviews) ? publicReviews : []);
  const showExampleReview = displayReviews.length === 0;

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/properties/${propertyId}/reviews`, { rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "reviews", "all"] });
      setRating(0);
      setComment("");
      toast({ title: "Review submitted", description: "Your review has been posted." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to submit review", variant: "destructive" });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ reviewId, isPublic }: { reviewId: number; isPublic: boolean }) =>
      apiRequest("PATCH", `/api/reviews/${reviewId}/visibility`, { isPublic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "reviews", "all"] });
    },
  });

  const avgRating = displayReviews.length > 0
    ? (displayReviews.reduce((sum, r) => sum + r.rating, 0) / displayReviews.length)
    : 0;

  return (
    <section className="mt-8" data-testid="section-property-reviews">
      <div className="flex items-center gap-3 mb-5">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-display font-bold text-foreground">Ratings & Reviews</h2>
        {displayReviews.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <StarRating rating={Math.round(avgRating)} />
            <span className="text-sm text-muted-foreground font-medium">
              {avgRating.toFixed(1)} ({displayReviews.length} {displayReviews.length === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {showExampleReview && (
          <div className="relative">
            <div className="absolute -top-2 left-4 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full z-10" data-testid="badge-example">
              Example Review
            </div>
            <ReviewCard review={EXAMPLE_REVIEW} canModerate={false} />
          </div>
        )}

        {displayReviews.map(review => (
          <ReviewCard
            key={review.id}
            review={review}
            canModerate={canModerate}
            onToggleVisibility={(isPublic) =>
              visibilityMutation.mutate({ reviewId: review.id, isPublic })
            }
          />
        ))}

        {loadingPublic && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-base font-display font-semibold text-foreground mb-3">Share Your Thoughts</h3>

        {!isAuthenticated ? (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-xl p-4" data-testid="text-login-prompt">
            Sign in to leave a rating and review for this property.
          </p>
        ) : completeness && !completeness.complete ? (
          <ProfileCompleteGate
            completeness={completeness}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/profile/completeness"] })}
          />
        ) : (
          <div className="space-y-3" data-testid="form-review">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Your Rating</label>
              <StarRating rating={rating} size="lg" interactive onRate={setRating} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Your Review <span className="text-muted-foreground/60">({comment.length}/300)</span>
              </label>
              <textarea
                data-testid="input-review-comment"
                value={comment}
                onChange={e => {
                  if (e.target.value.length <= 300) setComment(e.target.value);
                }}
                placeholder="What did you think of this property? Share your experience visiting or viewing it..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
              />
            </div>
            <button
              data-testid="button-submit-review"
              onClick={() => submitMutation.mutate()}
              disabled={!rating || !comment.trim() || submitMutation.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-primary/20"
            >
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Review
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewCard({ review, canModerate, onToggleVisibility }: {
  review: Review;
  canModerate: boolean;
  onToggleVisibility?: (isPublic: boolean) => void;
}) {
  return (
    <div
      className={`bg-card border rounded-xl p-4 ${
        review.isPublic === false ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : "border-border"
      }`}
      data-testid={`card-review-${review.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
          {review.user.profileImageUrl ? (
            <img
              src={review.user.profileImageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground" data-testid={`text-reviewer-name-${review.id}`}>
              {review.user.firstName} {review.user.lastInitial}
            </span>
            <StarRating rating={review.rating} />
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
              {timeAgo(review.createdAt)}
            </span>
          </div>
          <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed" data-testid={`text-review-comment-${review.id}`}>
            {review.comment}
          </p>
          {canModerate && (
            <div className="flex items-center gap-2 mt-2">
              {review.isPublic === false && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Hidden</span>
              )}
              <button
                data-testid={`button-toggle-visibility-${review.id}`}
                onClick={() => onToggleVisibility?.(!review.isPublic)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
              >
                {review.isPublic ? (
                  <><EyeOff className="w-3.5 h-3.5" /> Hide</>
                ) : (
                  <><Eye className="w-3.5 h-3.5" /> Show</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
