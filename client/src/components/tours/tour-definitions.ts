export type TourStep = {
  title: string;
  body: string;
  target: string;
  placement?: "top" | "bottom" | "left" | "right";
};

export type TourDefinition = {
  pageKey: string;
  steps: TourStep[];
};

export const TOUR_REGISTRY: Record<string, TourDefinition> = {
  swipe: {
    pageKey: "swipe",
    steps: [
      {
        title: "Welcome to your home search",
        body: "Swipe through homes like you would on your favorite apps. Right to save, left to pass.",
        target: '[data-tour="swipe-card"]',
        placement: "bottom",
      },
      {
        title: "Save homes you love",
        body: "Every home you swipe right on goes into your shortlist and notifies your agent.",
        target: '[data-tour="swipe-actions"]',
        placement: "top",
      },
      {
        title: "Look for Seller Terms",
        body: "Homes with the amber \"Seller Offering Terms\" badge have special concessions — closing cost help, assumable loans, and more.",
        target: '[data-tour="concession-badge"]',
        placement: "bottom",
      },
      {
        title: "Complete your profile",
        body: "A complete buyer profile helps your agent find better matches and powers our Beacon matching engine.",
        target: '[data-tour="profile-nudge"]',
        placement: "bottom",
      },
    ],
  },
  agent: {
    pageKey: "agent",
    steps: [
      {
        title: "Your agent command center",
        body: "Everything you need to manage clients, listings, and buyer activity — all in one place.",
        target: '[data-tour="agent-tabs"]',
        placement: "bottom",
      },
      {
        title: "Beacon — prove demand before you list",
        body: "Enter an upcoming listing address and see how many active buyers match. Use this in your listing presentations.",
        target: '[data-tour="beacon-tab"]',
        placement: "right",
      },
      {
        title: "Buyer interest queue",
        body: "Every buyer who swipes right on one of your listings appears here. Review, respond, and schedule showings.",
        target: '[data-tour="buyer-interest-tab"]',
        placement: "right",
      },
      {
        title: "Your CRM",
        body: "Manage all your contacts, tag them, import from CSV or phone, and track client activity.",
        target: '[data-tour="contacts-tab"]',
        placement: "right",
      },
      {
        title: "Add seller terms to your listings",
        body: "Stand out by posting what the seller is willing to offer — closing costs, assumable loans, rate buydowns.",
        target: '[data-tour="add-concession-btn"]',
        placement: "left",
      },
    ],
  },
  search: {
    pageKey: "search",
    steps: [
      {
        title: "Find homes your way",
        body: "Search by city, zip, or address. Use filters to narrow by price, beds, baths, and more.",
        target: '[data-tour="search-filters"]',
        placement: "bottom",
      },
      {
        title: "Map and list — side by side",
        body: "The map updates as you scroll. Click any pin to see details, or browse the list on the left.",
        target: '[data-tour="search-map"]',
        placement: "left",
      },
      {
        title: "Homes with seller terms",
        body: "Look for the amber badge — those sellers are offering concessions that could save you thousands.",
        target: '[data-tour="search-results"]',
        placement: "top",
      },
    ],
  },
  dashboard: {
    pageKey: "dashboard",
    steps: [
      {
        title: "Your buyer dashboard",
        body: "Track saved homes, your searches, and your profile completeness all in one place.",
        target: '[data-tour="dashboard-tabs"]',
        placement: "bottom",
      },
      {
        title: "Saved homes",
        body: "Every home you swiped right on lives here. Share with your agent or plan your tour route.",
        target: '[data-tour="saved-homes"]',
        placement: "top",
      },
      {
        title: "Complete your profile",
        body: "A fuller profile means better matches. It takes about 2 minutes and makes a big difference.",
        target: '[data-tour="profile-completeness"]',
        placement: "top",
      },
    ],
  },
  "home-report": {
    pageKey: "home-report",
    steps: [
      {
        title: "Your home at a glance",
        body: "Track your home value, equity, and nearby sales — updated regularly from live market data.",
        target: '[data-tour="home-report-value"]',
        placement: "bottom",
      },
      {
        title: "Thinking about selling?",
        body: "See what buyers are willing to offer and get connected with an agent who knows your market.",
        target: '[data-tour="sell-cta"]',
        placement: "top",
      },
      {
        title: "Post your terms",
        body: "Let buyers know what you're willing to offer — closing cost help, assumable loans, flexible timeline.",
        target: '[data-tour="post-terms-cta"]',
        placement: "top",
      },
    ],
  },
  property: {
    pageKey: "property",
    steps: [
      {
        title: "Everything about this home",
        body: "Photos, mortgage calculator, public records, schools, flood zones — all in one place.",
        target: '[data-tour="property-detail-header"]',
        placement: "bottom",
      },
      {
        title: "Seller terms",
        body: "If the seller posted concessions, you'll see them here. These are real offers — not estimates.",
        target: '[data-tour="property-concessions"]',
        placement: "top",
      },
      {
        title: "Agent-only details",
        body: "Verified agents see additional MLS fields here — showing instructions, confidential remarks, and more.",
        target: '[data-tour="agent-mls-panel"]',
        placement: "top",
      },
    ],
  },
  onboarding: {
    pageKey: "onboarding",
    steps: [
      {
        title: "Welcome to xucasa",
        body: "Let's set up your experience. This takes about 2 minutes and makes everything work better for you.",
        target: '[data-tour="onboarding-intent"]',
        placement: "bottom",
      },
      {
        title: "Tell us what you're looking for",
        body: "The more you share, the better we can match you with homes and connect you with the right agent.",
        target: '[data-tour="onboarding-form"]',
        placement: "bottom",
      },
    ],
  },
};
