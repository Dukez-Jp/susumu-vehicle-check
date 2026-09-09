# Workshop administration design

The approved V1 contract is the implementation baseline. This panel is the office view of tablet inspections: it prioritizes fleet identity, critical findings, immutable history, and honest photo synchronization status.

Palette: workshop blue `#173c67`, action blue `#215db0`, paper `#f1f5fa`, ink `#183049`, verified teal `#087467`, caution amber `#9a5900`; critical red is reserved for safety findings. Typography uses the Windows-native Bahnschrift family for headings and Segoe UI for body copy, with Japanese system fallbacks and no remote fonts.

Layout: a fixed narrow blue navigation rail next to a left-aligned inspection work surface. The dashboard presents fleet readiness as a horizontal summary followed by an operational exceptions panel and a useful, dense recent-inspection register. Editors use full-width work sheets with labeled fields, while reports use a clean paper view.

```
Navigation | Page title + refresh/export action
           | Fleet counts / exceptions
           | Recent inspection register
           | Vehicle + author + time + findings + photo state
```

Review: avoid a generic grid of identical statistic cards. The summary is one connected instrument strip; the prominent content is the real inspection register, not decorative charts. No synthetic numbers or illustrations in the production interface. Every empty, loading, and error state gives a truthful next action. A compact Portuguese dictionary carries navigation and shared labels and can be extended with a Japanese locale.

Implementation sequence: executable API/auth/validation/report tests first; typed API and session; shell and real query states; dashboard/vehicles; immutable template version editor; inspection evidence and print/CSV; users/audit; verification and independent review.
