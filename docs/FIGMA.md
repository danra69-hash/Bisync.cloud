# Figma Design Source

**Figma Make file:** https://www.figma.com/make/QgoQ4Z3lguzeuUlJU7ycoe/Bisync.cloud

The original Figma Make export is a full React + Tailwind + shadcn/ui prototype with:

- Operations dashboard (KPIs, revenue charts, hourly staffing)
- Revenue Management (Smart Ingredient, Component Config, Vendor List, Compare Price)
- Point-of-Sales modules
- Multi-location filtering and dark mode

The `client/` folder implements the dashboard shell styled to match the Figma theme (`#E87722` primary, `#2C1A0A` navy, Nunito font) and connects to the C# API.

To port additional screens, use Figma MCP `get_design_context` with node `0:1` on file key `QgoQ4Z3lguzeuUlJU7ycoe`.
