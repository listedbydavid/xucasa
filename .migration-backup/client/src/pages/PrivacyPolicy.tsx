import { Link } from "wouter";
import { useEffect } from "react";

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sectionClass = "mb-10";
  const headingClass = "text-xl font-display font-bold text-foreground mb-3";
  const textClass = "text-muted-foreground leading-relaxed text-sm";
  const listClass = "list-disc list-inside space-y-1.5 text-sm text-muted-foreground ml-2";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16" data-testid="page-privacy-policy">
      <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-2" data-testid="text-privacy-title">
        Privacy Policy
      </h1>
      <p className="text-muted-foreground text-sm mb-10">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <div className={sectionClass}>
        <h2 className={headingClass}>1. Introduction</h2>
        <p className={textClass}>
          xucasa ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect,
          use, disclose, and safeguard your information when you visit our website at www.xucasa.com and use our services.
          Please read this policy carefully. By using xucasa, you consent to the practices described herein.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>2. Information We Collect</h2>
        <p className={`${textClass} mb-3`}>We collect information in the following ways:</p>
        <h3 className="text-base font-semibold text-foreground mb-2">Account Information</h3>
        <ul className={`${listClass} mb-4`}>
          <li>Name, email address, and profile photo (when you sign in with Google)</li>
          <li>Email address and password (when you register with email)</li>
          <li>Phone number (if you choose to add it to your profile)</li>
          <li>Agent license information (for agent accounts)</li>
        </ul>
        <h3 className="text-base font-semibold text-foreground mb-2">Usage Information</h3>
        <ul className={listClass}>
          <li>Properties you save, like, or mark as favorites</li>
          <li>Search queries and saved search criteria</li>
          <li>Buyer profile preferences (budget, location, home type, etc.)</li>
          <li>Seller lead information submitted through the Sell Wizard</li>
          <li>Swipe history and property interaction patterns</li>
        </ul>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>3. Cookies and Local Storage</h2>
        <p className={`${textClass} mb-3`}>We use cookies and browser storage for the following purposes:</p>
        <ul className={listClass}>
          <li><strong className="text-foreground">Session cookie</strong> (connect.sid) — Keeps you logged in. This cookie is essential for authentication and expires after 1 week (or 30 days if you select "Remember me").</li>
          <li><strong className="text-foreground">Sidebar state</strong> — Remembers whether your sidebar is expanded or collapsed.</li>
          <li><strong className="text-foreground">Theme preference</strong> — Remembers your light/dark mode choice via localStorage.</li>
          <li><strong className="text-foreground">Cookie consent</strong> — Records whether you have acknowledged our cookie notice.</li>
        </ul>
        <p className={`${textClass} mt-3`}>
          We do not currently use third-party analytics or advertising cookies.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>4. How We Use Your Information</h2>
        <ul className={listClass}>
          <li>To provide and maintain our services, including property search and saved listings</li>
          <li>To personalize your experience and show relevant property recommendations</li>
          <li>To facilitate the buyer marketplace and agent matching features</li>
          <li>To process seller leads and connect homeowners with agents</li>
          <li>To communicate with you about your account or inquiries</li>
          <li>To improve our platform and develop new features</li>
        </ul>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>5. Third-Party Services</h2>
        <p className={`${textClass} mb-3`}>We integrate with the following third-party services:</p>
        <ul className={listClass}>
          <li><strong className="text-foreground">Google OAuth</strong> — For account sign-in. Google receives your authentication request; see <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google's Privacy Policy</a>.</li>
          <li><strong className="text-foreground">Google Maps</strong> — For displaying property locations and map-based search. Subject to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google's Privacy Policy</a>.</li>
          <li><strong className="text-foreground">RealtyFeed / MLS</strong> — For property listing data sourced from the Multiple Listing Service. Listing data is provided for informational purposes.</li>
        </ul>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>6. Data Retention</h2>
        <p className={textClass}>
          We retain your personal information for as long as your account is active or as needed to provide you services.
          You may request deletion of your account and associated data at any time by contacting us. Cached property data
          from the MLS is refreshed periodically and is not permanently stored in association with your account.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>7. Data Security</h2>
        <p className={textClass}>
          We use industry-standard security measures to protect your personal information, including encrypted connections
          (HTTPS/TLS), secure session cookies (HttpOnly, Secure, SameSite), and password hashing (bcrypt). However, no
          method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>8. Your Rights</h2>
        <p className={`${textClass} mb-3`}>Depending on your location, you may have the right to:</p>
        <ul className={listClass}>
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your data</li>
          <li>Opt out of certain data processing activities</li>
          <li>Receive a copy of your data in a portable format</li>
        </ul>
        <p className={`${textClass} mt-3`}>
          California residents have additional rights under the CCPA. Please contact us to exercise any of these rights.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>9. Changes to This Policy</h2>
        <p className={textClass}>
          We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the
          updated policy on this page with a revised "Last updated" date.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>10. Contact Us</h2>
        <p className={textClass}>
          If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us at:{" "}
          <a href="mailto:david@xucasa.com" className="text-primary hover:underline">david@xucasa.com</a>
        </p>
      </div>

      <div className="border-t border-border pt-6 mt-6 text-center">
        <Link href="/" className="text-sm text-primary hover:underline font-medium" data-testid="link-back-home">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
