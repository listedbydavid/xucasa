import { Link } from "wouter";
import { useEffect } from "react";

export default function TermsOfService() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sectionClass = "mb-10";
  const headingClass = "text-xl font-display font-bold text-foreground mb-3";
  const textClass = "text-muted-foreground leading-relaxed text-sm";
  const listClass = "list-disc list-inside space-y-1.5 text-sm text-muted-foreground ml-2";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16" data-testid="page-terms-of-service">
      <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-2" data-testid="text-terms-title">
        Terms of Service
      </h1>
      <p className="text-muted-foreground text-sm mb-10">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <div className={sectionClass}>
        <h2 className={headingClass}>1. Acceptance of Terms</h2>
        <p className={textClass}>
          By accessing or using xucasa (www.xucasa.com), you agree to be bound by these Terms of Service and our{" "}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. If you do not agree to
          these terms, please do not use our services. We reserve the right to modify these terms at any time, and your
          continued use of the platform constitutes acceptance of any changes.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>2. Description of Services</h2>
        <p className={textClass}>
          xucasa is a real estate platform that provides property search, buyer marketplace, seller tools, and agent
          matching services. Our platform aggregates property listing data from Multiple Listing Services (MLS) through
          authorized data providers, displays property information, and facilitates connections between buyers, sellers,
          and real estate agents.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>3. Account Responsibilities</h2>
        <p className={`${textClass} mb-3`}>When you create an account on xucasa, you agree to:</p>
        <ul className={listClass}>
          <li>Provide accurate and complete information during registration</li>
          <li>Maintain the security of your account credentials</li>
          <li>Notify us immediately of any unauthorized use of your account</li>
          <li>Accept responsibility for all activity that occurs under your account</li>
          <li>Not create multiple accounts for deceptive purposes</li>
        </ul>
        <p className={`${textClass} mt-3`}>
          We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>4. Property Data Disclaimer</h2>
        <p className={textClass}>
          Property listing data displayed on xucasa is sourced from third-party providers, including the Multiple Listing
          Service (MLS) through RealtyFeed. While we strive to provide accurate and up-to-date information, we do not
          guarantee the accuracy, completeness, or reliability of any listing data. Property information including but not
          limited to prices, square footage, lot sizes, room counts, and property conditions may contain errors or may not
          reflect the most current status. Users should independently verify all property information before making any
          real estate decisions.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>5. Buyer Marketplace</h2>
        <p className={textClass}>
          The buyer marketplace allows users to create public buyer profiles visible to agents and other users. By creating
          a buyer profile, you consent to sharing your stated preferences (budget range, location preferences, property
          requirements) publicly. You may delete your buyer profile at any time. xucasa does not guarantee that creating a
          buyer profile will result in receiving property offers or agent contact.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>6. Agent Services</h2>
        <p className={textClass}>
          Agents using xucasa are responsible for maintaining valid real estate licenses and complying with all applicable
          real estate laws and regulations. Agent verification status displayed on xucasa is based on information provided
          by the agent and does not constitute an endorsement. xucasa is not a real estate brokerage and does not provide
          real estate brokerage services.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>7. Intellectual Property</h2>
        <p className={textClass}>
          The xucasa name, logo, website design, and original content are the property of xucasa and are protected by
          copyright and trademark laws. MLS listing data is provided under license from the applicable MLS and data
          providers and may not be reproduced, redistributed, or used for purposes other than personal, non-commercial
          viewing on this platform.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>8. Prohibited Conduct</h2>
        <p className={`${textClass} mb-3`}>You agree not to:</p>
        <ul className={listClass}>
          <li>Use the platform for any unlawful purpose or in violation of fair housing laws</li>
          <li>Scrape, crawl, or harvest data from the platform without authorization</li>
          <li>Interfere with or disrupt the platform's infrastructure or security</li>
          <li>Impersonate another person or entity</li>
          <li>Post misleading, fraudulent, or discriminatory property listings</li>
          <li>Use automated systems to access the platform without our written permission</li>
        </ul>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>9. Limitation of Liability</h2>
        <p className={textClass}>
          To the fullest extent permitted by law, xucasa and its officers, directors, employees, and agents shall not be
          liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to
          your use of the platform. This includes, without limitation, damages for loss of profits, data, or other
          intangible losses. Our total liability for any claim arising from these terms shall not exceed the amount you
          paid to us, if any, in the twelve months preceding the claim.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>10. Indemnification</h2>
        <p className={textClass}>
          You agree to indemnify, defend, and hold harmless xucasa and its affiliates from and against any claims,
          liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising out of or in any
          way connected with your use of the platform, violation of these terms, or infringement of any rights of
          another party.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 id="fair-housing" className={headingClass}>11. Fair Housing Statement</h2>
        <p className={textClass}>
          xucasa is committed to compliance with all federal, state, and local fair housing laws. We do not discriminate
          against any person because of race, color, religion, sex, handicap, familial status, national origin, sexual
          orientation, gender identity, or any other protected class. All properties listed on xucasa are available on an
          equal opportunity basis.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>12. Termination</h2>
        <p className={textClass}>
          We may terminate or suspend your access to xucasa at any time, with or without cause, and with or without
          notice. Upon termination, your right to use the platform ceases immediately. Provisions of these terms that
          by their nature should survive termination (including limitation of liability, indemnification, and intellectual
          property) will remain in effect.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>13. Governing Law</h2>
        <p className={textClass}>
          These Terms of Service shall be governed by and construed in accordance with the laws of the State of California,
          without regard to its conflict of law provisions. Any disputes arising from these terms shall be resolved in the
          state or federal courts located in San Diego County, California.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className={headingClass}>14. Contact Us</h2>
        <p className={textClass}>
          If you have questions about these Terms of Service, please contact us at:{" "}
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
