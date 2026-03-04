const CURRENT_YEAR = new Date().getFullYear();

export function SdmlsDisclaimer() {
  return (
    <div
      className="bg-white border border-border/60 rounded-xl p-4 sm:p-5 mt-6"
      data-testid="sdmls-disclaimer"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-[#003366] rounded-lg" data-testid="sdmls-logo">
          <div className="text-center leading-tight">
            <span className="block text-white font-bold text-[10px] sm:text-xs tracking-wide">SAN DIEGO</span>
            <span className="block text-white font-extrabold text-sm sm:text-base tracking-wider">MLS</span>
            <span className="block text-[#C5A55A] font-semibold text-[8px] sm:text-[9px] tracking-wide">IDX</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
            This information is deemed reliable but not guaranteed. You should rely on this
            information only to decide whether or not to further investigate a particular
            property. BEFORE MAKING ANY OTHER DECISION, YOU SHOULD PERSONALLY INVESTIGATE
            THE FACTS (e.g. square footage and lot size) with the assistance of an appropriate
            professional. You may use this information only to identify properties you may be
            interested in investigating further. All uses except for personal, noncommercial
            use in accordance with the foregoing purpose are prohibited. Redistribution or
            copying of this information, any photographs or video tours is strictly prohibited.
            This information is derived from the Internet Data Exchange (IDX) service provided
            by San Diego MLS. Displayed property listings may be held by a brokerage firm
            other than the broker and/or agent responsible for this display. The information
            and any photographs and video tours and the compilation from which they are derived
            is protected by copyright. Compilation &copy; {CURRENT_YEAR} San Diego MLS.
          </p>
        </div>
      </div>
    </div>
  );
}
