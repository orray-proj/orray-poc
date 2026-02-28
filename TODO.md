## Ideas

The constant question: is it possible to not use a navbar item for this feature?
For everything regarding "customizing the experience" a navbar is acceptable but not encouraged.

### I1 - Version Control / Timeline + Relive Event

A draggable floating timeline panel accessible from a small button at the bottom of the viewport (icon: timeline/clock). Hovering the button expands it into a full timeline bar taking the bottom space. The bar is freely draggable anywhere on the viewport (unconstrained, like a pen-tool bar in note-taking apps). The timeline displays all system events: bugs, deployments, proposals. Hovering the edges of the timeline reveals a "search backwards" affordance; clicking moves the time range. Hovering an event shows a minimal tooltip. Clicking an event transitions the entire canvas into a historical snapshot of that moment — highlighting the event similarly to the tracing layer — and the timeline collapses back to button mode with an exit button beside it. Reopening the timeline while in snapshot mode also shows the exit button. Exiting snapshot mode returns the canvas to "live" state. "Live" replaces "tracing" as the default active layer.

**Relive mode**: When entering a snapshot for a traceable event (e.g. "place order"), the timeline doesn't just highlight affected components statically — it replays the event step-by-step. Edges light up sequentially following the actual request path (Gateway → Order Service → Payment Service → Notification Service), with a small animated dot traveling each hop. The timeline scrubber tracks the current step; dragging it moves forward/backward through the trace. Each step shows latency and status in a minimal overlay on the active edge. This turns the snapshot from a static highlight into a spatial, animated re-enactment of the request flow.

### I2 - Repo introspection

Using LLM to inspect and understand repo structure, with features and connections

### I3 - RBAC

Configuration happens through a **meta-canvas** — a dedicated spatial view that unpacks the platform's own functions into interactive elements. Every controllable surface in the UI becomes a button on this canvas. For example, the three layers from the top-left panel (Live, Building, Platform) each appear as a node; clicking one reveals a list of all teams/roles and their access level for that layer (view, edit, none). Same principle extends to other functions: timeline access, building toolbar actions (add/delete/connect nodes), runbook actions, environment switching, etc.

The meta-canvas approach keeps RBAC consistent with the product's spatial philosophy — you configure permissions the same way you navigate the system: by clicking things on a canvas, not by filling out a table in a settings page. Each "function node" on the meta-canvas could show a small badge with the count of teams that have access, and expanding it reveals the full permission matrix for that function.

Sanity check considerations:
- Scales well for small-to-medium orgs (< 20 teams). For larger orgs, grouping function-nodes by category (layers, actions, data) prevents clutter.
- The meta-canvas itself needs RBAC — only admins should see it. A simple "Admin" entry in the header dropdown (acceptable navbar use per the minimal UI rule since this is "customizing the experience").
- Edge case: cross-cutting permissions (e.g. "read-only everywhere") should be expressible as a role template that can be dragged onto multiple function-nodes at once, not configured one by one.

### I4 - Better zoom

Enter the details of a node just by zooming into it. Create a small cue at a certain zoom level to suggest that the node is about to expand, also following the cursor position (two components in the screen, follow the one where the cursor is hovering at, block if none). If continued zooming, the node will expand showing the details. For example showing the features are smaller nodes inside the microservice, or showing the singular kafka topics between two microservices that has more than one.

### I5 - Devops view

In the Infra layer, be able to see everything of the cluster, like namespaces, pods, kubelet etc.

### I6 - Universal search

Self-explanatory. cmd+k and be able to search ANYTHING

### I7 - Multi-collaboration

Multiple users, collaborating in real-time. Implement a chat feature to facilitate communication and collaboration among team members.

### I8 - Env Stacking (Diff between envs)

Components are the same, environments change. The challenge: how to make differences instantly visible without tab-switching or side-by-side layouts that break the spatial mental model.

**Z-axis stacking**: Environments are rendered as the same canvas stacked along the z-axis — like transparent layers in Photoshop or glass panes in physical space. The active environment sits at z=0 (full opacity, interactive). Other environments float behind it at increasing z-depth, slightly scaled down and faded (e.g. staging at z=-1 with 40% opacity, dev at z=-2 with 20%). A subtle parallax shift on mouse movement reinforces the depth illusion.

**Diff highlighting**: Nodes/edges that differ between the foreground env and any background env get a visual diff marker — a colored outline or glow (green = only in foreground, red = only in background, amber = present in both but different config/version). Hovering a diff-marked node shows a compact comparison tooltip (e.g. "prod: v2.3.1 / staging: v2.4.0-rc1, 2 replicas vs 3 replicas").

**Interaction**: Scroll-wheel on a dedicated axis control (or a small depth slider on the side) brings a background env forward to z=0, pushing the current one back. This feels like flipping through stacked cards. Pinching (trackpad) could also map to the z-axis for a natural "pull apart the stack" gesture. The transition animates smoothly — the canvases slide past each other with a slight blur during motion.

**Quick diff mode**: A toggle that collapses all environments to z=0 simultaneously, overlaying them with maximum transparency. Only the differences remain visible (identical nodes cancel out to solid, differences shimmer). This is the "instant answer" mode — glance and see every delta across all envs at once.

### I9 - Kargo Plugin

Autopromote or schedule autopromotions services, useful when inspecting the diff between envs.

### I10 - Blast Radius Simulation

Click any node and trigger a "what if this dies?" mode. Animated domino-effect cascades through dependent services — edges flash red sequentially following the dependency graph, downstream nodes dim one by one with a staggered delay. A small overlay tallies the blast: "4 services affected, ~12k users impacted." Inverts the typical post-mortem into a pre-mortem tool.

### I11 - Cost Flow Layer

A fourth layer (or sub-layer of Platform) where edge thickness represents dollar cost. Cloud spend flows visually through the graph like water — thick, bright edges are expensive paths, thin ones are cheap. Nodes show their monthly cost as a radial fill. Immediately answers "where is our money going?" without opening a billing console. Pairs naturally with env diff (I9).

### I12 - Ambient Sonification

Map system health to generative audio. Healthy = low warm drone, degraded = subtle dissonance, critical = percussive alert tones. Each node contributes a voice to the mix based on its metrics. Engineers can "listen" to their system in the background while coding — a degradation in the soundscape triggers attention before any dashboard. Toggle on/off from the header.

### I13 - Canvas Annotations / Sketch Layer

A freeform drawing layer over the canvas — pen strokes, arrows, text boxes, sticky notes. Persisted per-layer and per-snapshot. During incident reviews, draw directly on the affected path. During architecture discussions, sketch proposed changes on top of the live topology. Annotations are first-class objects: searchable, timestamped, attributable to a user.

### I14 - Spatial Bookmarks (Viewpoints)

Save the current camera position + layer + focus state + timeline position as a named "viewpoint." Jump between viewpoints instantly. Share them as deep links. Use cases: "Payment debug view" (zoomed into payment cluster, live layer, focus on Payment Service), "Sprint 12 proposals" (building layer, zoomed out, timeline at proposal date). Essentially browser bookmarks for the system's spatial state.

### I15 - AI Narrator (System Storytelling)

An LLM watches the metric stream and generates a running natural-language narrative in a small aside panel: "Order Service latency spiked 3x following the Payment Service deploy at 14:15. The spike correlates with the new retry policy — see edge Order→Payment for details." Click any sentence and the canvas navigates to the relevant nodes/edges. Turns raw metrics into a readable incident log. Pairs with timeline (I1) and relive mode.

### I16 - Ownership Territories

Color-fill convex hulls around node clusters by team ownership. The canvas becomes a territory map — you instantly see team boundaries, shared dependencies crossing territory lines, and orphaned services with no owner. Hovering a territory highlights all its edges (internal = solid, cross-team = dashed).

### I17 - Runbook Actions (Canvas as Control Plane)

Right-click a node → contextual actions: restart pod, scale replicas, toggle feature flag, trigger deploy, rollback. The canvas isn't just a viewer — it's a control surface. Actions are gated by RBAC (I3) and produce timeline events (I1). Confirmation dialogs show blast radius (I11). Collapses the observe→decide→act loop into a single spatial interface.

### I18 - Project List (Canvas of Canvases)

Each project is a canvas. The question: how do you navigate between them?

**Zoom-out transition**: From within a project canvas, zooming out past a threshold (e.g. below 0.15x zoom) triggers a smooth transition to a grid view where each project appears as a miniaturized, live-thumbnail canvas tile. The tiles show a simplified rendering of the topology (just node dots and edge lines, no labels) with a health-status glow (green/amber/red border). Zooming into any tile transitions back into that project's full canvas.

UX considerations:
- The zoom-out approach is natural for spatial interfaces (Google Maps does this — zoom out from street to city to country) and consistent with I4's semantic zoom philosophy.
- Risk: accidental zoom-out. Mitigate with a clear "threshold zone" — at ~0.2x zoom, show a subtle vignette or label ("zoom out more to see all projects") so the user knows they're approaching the transition, and can stop if unintentional.
- Alternative entry: cmd+P or a small "projects" icon in the header for keyboard-first users who don't want to zoom-dance.
- Each tile could show a one-line status summary (e.g. "3 critical, 1 deploying") and the project name.
- The grid itself could be spatial — projects that share infrastructure or teams are placed closer together, creating an org-level topology.

## Design choices

- SRD as representation of a resource node. Deployments too fine grained.
- Divide SRD resources by project / environment.
- Inputs:
  - db: link to an already deployed greptime db, self-deployed by us if not provided
  - collector: optional, requires config from the user to set a new destination for the telemetries
  - link to org for LLM inspection (?)

## Open questions

- Layout: auto or manual?
  - auto, with manual intervention in building layer
- Plugins?
  Nop. Conflicts with business model. This actually simplifies design. But it does not mean to build a stupid unscalable monolith

### Performance: ReactFlow ceiling and radical alternatives

ReactFlow renders every node and edge as a DOM element (React component). Each node is a `<div>` with full React lifecycle overhead. CSS shadows, gradients, animations compound the cost. DOM rendering is locked to the main thread. Practical limit: hundreds of nodes before needing heavy optimization. React Flow v12 (`@xyflow/react`) improved perf and added a framework-agnostic core (`@xyflow/system`), but **did not change the underlying DOM rendering architecture**. No public roadmap for Canvas/WebGL rendering.

**What tools like Figma, Miro, tldraw use:**
- Figma: C++/WASM compiled to WebGL, now migrating to WebGPU. React only for panels/toolbar. Tile-based GPU renderer with custom GLSL shaders.
- Miro: Canvas 2D / WebGL (proprietary) + React UI shell.
- tldraw: SVG + Canvas with React. Centralized culling system, direct DOM manipulation for perf. Reduces subscription overhead from O(N) to O(1).
- Common pattern: **React for UI chrome, custom renderer for the canvas**. None render canvas content as DOM elements.

**Upgrade path (ordered by effort):**

1. **Optimize ReactFlow** (days) — Memoize nodes/edges, `React.memo`, simplify CSS, lazy-render off-screen nodes. Gets to ~500-1000 nodes. Sufficient for the current POC.

2. **Switch to WebGL graph library** (weeks) — Sigma.js v3 (WebGL, handles ~100k edges), PixiJS + custom graph layer, or GoJS (Canvas 2D, thousands of nodes <2s at 60fps). You lose ReactFlow's built-in interactions and need to reimplement drag, selection, minimap. Sigma.js is purpose-built for graphs.

3. **Hybrid: React shell + Canvas/WebGL engine** (months) — The Figma pattern. React handles timeline, layer controls, toolbars. A custom or library-based Canvas/WebGL renderer handles the node graph. Correct architecture for scaling to thousands of nodes with complex visual effects.

4. **Hybrid: React + Rust/WASM canvas via wgpu** (months, higher risk) — Same as above but the canvas engine is Rust compiled to WASM via wgpu (Rust's GPU abstraction, compiles to WebGPU or WebGL2 in browser). Maximum performance. Only justified if you need compute-heavy operations (real-time layout algorithms, physics simulations) alongside rendering. Figma, Adobe Photoshop (web), AutoCAD (web), 1Password all ship Rust/WASM in production.

5. **Tauri desktop app** (orthogonal) — Tauri v2 (stable since Oct 2024): 2.5-3MB bundle vs Electron's 80-120MB, 30-40MB idle RAM vs 200-300MB, <500ms startup. Could use wgpu natively (not through WASM) for full GPU access. But: uses OS WebView (inconsistent rendering across platforms), WebGPU support depends on OS WebView version, limits distribution to desktop — an IDP that needs browser access for sharing/collaboration loses a major benefit of being web-native.

**Rust/WASM framework landscape (Feb 2026):**
- Leptos 0.7: ~18.5k stars. Fine-grained reactivity, direct DOM (no VDOM). Most mature for web. Not yet 1.0.
- Dioxus 0.7: ~23k stars. Virtual DOM + signals. Strongest for desktop/mobile. Hot-patching of Rust at runtime.
- Yew 0.21: ~30.5k stars. Virtual DOM, React-like. Oldest, stable, but slower development pace.
- All are **DOM-based** — none render to Canvas/WebGL natively. For Canvas/WebGL you'd use wgpu or Bevy separately.

**WebGPU browser support (Jan 2026): full cross-browser.** Chrome/Edge since v113, Firefox Windows since v141, Safari macOS Tahoe 26 / iOS 26. ~70% global coverage. WebGL2 fallback path is trivial.

**JS-WASM boundary cost:** Not zero. Small frequent calls can be slower than pure JS. But at 50-500 nodes, passing the entire graph state as a single serialized buffer per update is microseconds — negligible. SharedArrayBuffer (near-zero overhead) requires COOP/COEP headers.

**Bottom line for Orray:** At 50-500 nodes ReactFlow is adequate with optimization (option 1). If the product scales to thousands of nodes or the animation/layer system hits DOM limits, the move is to option 2 (Sigma.js/PixiJS) or option 3 (Figma-pattern hybrid). Rust/WASM (option 4) is the nuclear option — technically correct at Figma scale, but overkill until node counts reach thousands with complex per-frame effects.

### Market situation

- current percentage of companies using k8s
- rate of adoption of k8s on new companies
- numbers of devs and services on companies p.a.
- numbers of companies using IDPs
- most common IDPs on the market
- most frustrating things about current IDPs
- the most used interaction medium for inspecting a platform: mouse, trackpad, touch, keyboard, pen.
