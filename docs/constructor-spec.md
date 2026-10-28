# Touch friendly constructor (draft)

A builder for phones and tablets where wiring is automatic: pedals sit on a
grid, and adding one is a single dialog that says what feeds it and where
it goes. Figma: section "Touch friendly constructor" (`201:2996`), six phone
screens and two desktop / tablet screens.

Status: being worked out with Niels; open points are marked **Open**.

## The work surface

- A grid on the work surface (SET → Work surface). It starts at the size of
  the screen.
- MOD's own ports sit on the edges: Audio In L / R and MIDI In on the left,
  Audio Out L / R and MIDI Out on the right.
- Every free cell shows a round **+**. Tapping it adds a pedal there (the
  + dialog, below).
- **Always one empty row and one empty column**, at the bottom and the right.
  An **Expand surface** button shows only when there is none left (it adds
  one). When two rows or columns are empty, one is removed again. Phone and
  desktop alike.
- **Moving around:** drag to pan, everywhere. Zoom: pinch on a phone or
  tablet; on desktop also + / − magnifier buttons. Pressing on a pedal and
  dragging may have to be kept apart from panning: panning might need to
  start next to a pedal rather than on it (to be tried).

### Pedals on the grid

- **Desktop / tablet:** the pedal's own face (its modgui). Zoomed in, the
  face can be played directly, as in MOD's builder now.
- **Phone:** a card with the pedal's preview, name and brand (as in the +
  dialog). No playable face: tapping it opens the pedal's settings screen.
- A pedal takes one cell, or **two cells across** when its face is at
  least 1.8 × wider than tall. A tall pedal always stays in one cell
  (decided with Niels), its face scaled to fit.
- **Long-press and drag** moves a pedal: it snaps to the nearest free cell
  and keeps its wiring.
- **Tapping a pedal** opens its settings screen (NHE's). Rewiring, Delete
  and Info move there too. Built: under the plugin's name on the settings
  screen, a row with its colour (palette), its **info** (the + dialog's
  info page, on its own; Back closes it) and **delete** (trash can, then
  "Delete this plugin?" No / Yes). Deleting **heals the signal path**:
  what fed the plugin is connected straight to what it fed, as if it were
  bypassed (in L → out L, in R → out R, a mono input to every output; per
  type: audio, MIDI, CV; `NHE.autowire.heal`), then MOD removes it.

### Wires

- Drawn by NHE: straight runs with rounded right-angle corners, along the
  gaps between cells (MOD draws curves).
- **Desktop:** MOD's dragging from a jack to wire by hand stays, for fine
  control. **Phone:** no hand wiring (a finger isn't precise enough); the
  + dialog and the settings screen do it.

### Live faces

- On a desktop (a mouse) every face shows the pedal's working GUI, as MOD's
  builder does: MOD's own icons, lent to the faces and kept up to date by
  MOD, one copy each. As there, any face's controls play; a click
  elsewhere on a face zooms in on it, a drag pans or lifts it.
  The performance view and MOD's builder get the icons back while they
  show. A touch screen keeps the pictures, the zoomed-in face live.
- Phones (cards): a red dot at the card's top left while the plugin is on.

### Zoomed in on a pedal

- Above each face: the gear (its settings) and, left of it, the plug: the
  wiring dialog, as on a phone's card: other ins and outs for it, or
  another plugin picked there takes its place (the old one is removed, the
  new one goes into its cell, wired as ticked).
- A tapped face zooms in and plays; its gear and plug grow to the bars'
  icon size (32 px), and a bolt left of them opens the performance view on that
  pedal: the last step from zoomed in to full screen. In the performance
  view, **Constructor view** (the puzzle, top right of the centred pedal)
  comes back, zoomed in on the pedal the carousel was showing.
- Free cells show only their + for now (no circle); a cable's + is half
  see-through.

### Kept per board

- A board's cable colours, hand-laid cables and grid size are kept by its
  bundle (`nhe-board-layouts`), on the MOD with NHE's other settings, so
  every browser on it shows the same. MOD keeps the pedals' places in the
  board itself.
- A board never saved has none kept until it is saved; Save as takes the
  layout to the new bundle. A new, empty board starts afresh.

### Manage CV ports

- While MOD's Manage CV ports is on (the bottom bar's menu), each pedal's
  CV output gets a tick beside its jack, and its name once ticked, as on
  MOD's builder: ticked, it's a CV source controls can be assigned to.
  NHE sets MOD's own (hidden) tick and name field, so MOD registers it.
- Faces only (cards draw no jacks); the device's own CV inputs, always
  sources, get no tag.

## The + dialog

Full screen on a phone; the bottom menu bar gives way to **Cancel** and
**Place**.

- At the top: category tabs (Favourites, All (238), Control Voltage (27),
  …) and a search field.
- Three columns, each scrolling on its own:
  - **Input from:** pedals on the surface that have outputs which can feed
    the new pedal, and MOD's inputs. Several can be picked; a picked one
    shows a tick.
  - **The pedal to add** (MOD's bottom bar of plugins today), narrowed by
    the tabs and the search. The picked one has a ring. Each has an **info
    icon** where the side columns show their tick: it opens the pedal's
    info over the whole dialog, with **Back** at the top (Escape too) to
    return to the dialog as it was. The same information as MOD's plugin
    info, in three columns (one on a phone): the screenshot with MOD's
    build badge (LOCAL, …); the name with a favourite star, brand, URI,
    category, author, homepage, installed version, licence, its audio /
    MIDI / CV ins and outs, **See online** and the description; then the
    control ports (default / min / max, MOD's number format) and CV ins
    and outs. MOD's Install / Upgrade / Remove are store actions, left out.
  - **Output to:** pedals and MOD's outputs, several, with ticks.
- **Order:** pick the pedal first; the side columns then list only what can
  connect to it.
- **Nearest first:** the side columns list what is nearest the tapped +
  first (grid steps across plus down; MOD's ports count as sitting just
  outside the edges). On a tie, what sits before the + (to its left) leads
  Input from, and what sits after it leads Output to.
- **Inserting:** picking X as input and Y as output, when X already feeds
  Y, puts the new pedal between them (the X → Y wire goes).
- **Series or parallel: Open.** What the prototype does now: the new pedal
  goes *in series* only when a picked input already feeds a picked output
  (that wire is replaced). Otherwise it is added *alongside*: the picked
  inputs keep feeding whatever they fed and now feed the new pedal too, and
  the picked outputs get the new pedal mixed in with what already feeds
  them. To be worked out once the prototype has been tried on a real
  surface.
- **Ports are chosen automatically** (to be tried, then refined):
  L → L and R → R; a mono output into a stereo pedal feeds both inputs;
  stereo into mono takes L; MIDI only to MIDI, CV only to CV.

## The bars (phone)

- **Top:** the pedalboard's name; Snapshots (camera).
- **Bottom**, one version only:
  - **Sparkle:** new pedalboard.
  - **Meters:** CPU / RAM, with small coloured numbers above for the load.
  - **Four dots:** the main menu: Plug-in store, Library, Banks, File
    manager, Manage CV ports, Global tempo & sync, Share your setup,
    Report a problem (Figma "iPhone 13 & 14 - 11").
  - **Play:** transport start / stop, with the tempo in BPM above.
  - **Floppy:** the save menu (Save, Save as).
- Snapshots and Save drop down from the top (Figma "- 12", "- 13").

## The bars (desktop / tablet)

- Top right: New pedalboard (sparkle), Snapshots, Save, Share; the
  snapshots as chips below (Intro, Verse, Chorus, Interlude).
- Footer: Constructor, Library, Banks, File manager, Store; CPU / RAM with
  the xrun count, tempo, Play, **CV ports** (the diamond: assign CV),
  Report a problem.

## How it maps onto MOD

- MOD keeps each pedal's position as x / y on the pedalboard: the grid
  snaps them. Connections go through MOD's own connect / disconnect (added
  to the adapter), so the device, MOD's own builder and other browsers stay
  in step.
- The wire drawing is NHE's own, over or instead of MOD's cables on this
  surface: the largest single piece.
- Built so far: the **+ dialog** (`nhe/components/constructor/add.js`,
  `constructor.css`) and the **wiring rules** (`autowire.js`, pure, no MOD),
  tried in `playground/constructor.html`: MOD Desktop's real plugin list and
  thumbnails (ports fetched when a pedal is picked, as on MOD), a pretend
  board (DS1 → Neural Amp Modeler → Bollie Delay → Dragonfly), and Place
  applying the plan to it. Not wired into MOD yet.
- Built next: the **work surface** (`nhe/components/constructor/surface.js`),
  also in the playground. Cells of 200 px at zoom 1; MOD's ports in edge
  columns; a + on every free cell (on a desktop only while the pointer is
  over that cell); one empty column and row kept, with
  Expand buttons in a strip under the grid when none is left; drag (or the
  wheel) to pan, pinch / ctrl-scroll / the + − buttons (top right) to zoom,
  the surface's image moving with it; a long-press (450 ms) lifts a pedal,
  a dashed outline shows where it lands (red where it can't), dropping on a
  free cell moves it with its wires; a tap on a pedal reports it (its
  settings screen, later). Wires: out of a pedal's right side into the
  next one's left, turning in the gap before the target; backwards ones
  cross in the gap between the rows. A pedal whose picture is 1.8 × wider
  than tall takes two cells across; a tall one stays in one. A narrow screen starts
  zoomed out to about two columns.
- **MOD's ports stick to the screen's left and right edges** (they don't pan
  or up and down, and keep their size when zooming): each side's ports
  stacked in the middle of the view. As in Figma: 48 × 48 black tiles flush against the edge,
  rounded on the inner side, the label under them. An unconnected port
  shows the plug (Phosphor Plug), a connected one the plugged-in icon. A
  wire between a port and a pedal that is out of view, or runs into
  that port's tile or label, isn't drawn: the
  tile shows a small white triangle pointing left or right, the side
  that pedal lies.
- The surface: `calm-dark.jpg` (a grey sheet), tiled so its holes come
  three to a cell with one under every +, also in SET → Work surface for MOD's builder. The + circles are
  solid and dark. Zoom buttons sit bottom left (on MOD: one row at the top
  right with the NHE / MOD switch, left of MOD's output tiles).
- **Desktop and large tablets** (the screen's short side 600 px or more):
  the pedals' faces with no card behind them, 20% larger than the phone's
  cards' pictures, and a tap zooms in until the face shows at its full
  size, centred, as in MOD's builder (on MOD its controls play there; the
  playground shows MOD's screenshot). **Phones:** the cards, and a tap
  opens the settings screen.
  On faces the wires run **jack to jack**, each port its own: on MOD from
  where the face's jacks really are (`jacks`, read by the adapter); in the
  playground spread down the face's sides (inputs left, outputs right) as
  an approximation. Cards wire to the middle of their sides.
- **Hand wiring on faces:** every jack shows a socket, every cable a plug
  at both ends. Drag a plug to another jack (or a MOD port tile) to move
  that end, or into nothing to pull the cable out, as on MOD; drag from a
  free socket to plug in a new cable; the jacks that take it light up.
  MOD's port tiles start cables too: drag from a tile, or tap it (or a
  free jack) and the cable follows the pointer until the next tap puts
  its end down (Escape lets go).
  Several cables on one jack: tap its plug and they spread apart, to
  grab the right one (as on MOD); tap again or elsewhere to gather them.
  **Press and hold a cable**, then drag, to move that stretch of it
  sideways: you decide where its corners go, to keep cables apart where
  the automatic way crowds them (as in whiteboard apps). A run out of or
  into a jack gets a short jog by the jack. The cable keeps its new way
  (`wireRoutes`) until a pedal at either end moves, it's rewired, or
  **Automatic route** in its tap popover puts it back. Other cables'
  lanes keep clear of it.
  **Tap a cable** to pick its colour (ten swatches, or by its type).
- **Another cable from a used output:** a small stub under its plug (as on
  MOD); dragging the stub plugs in a new cable, dragging the plug moves
  the existing one.
- **Rewiring on a phone:** a plug button at the top right of each card
  opens the + dialog with that pedal picked (scrolled into view, left out
  of the sides) and what feeds it and what it feeds ticked; the button
  reads **Rewire**. **Open:** what Rewire then does with the old wiring
  (delete and reconnect); the playground only reports the choice.
- **A small + on each cable** (one per pair of pedals, halfway along its
  longest run, in the cable's colour; phone and desktop; hidden while that
  run is too short, until the pedals move apart): a pedal goes in between. The + dialog
  opens with both ends ticked, and lists only pedals with an input and an
  output of the cable's kind (from their ports, else MOD's `iotype`: 1 / 2
  audio, 4 MIDI; the rest have their ports fetched as the dialog opens).
  Placing it replaces the cables between those two ends; the pedal takes
  the free cell nearest the +.
- **Lanes:** cables keep 14 px apart (centre to centre): a middle run that
  would come closer to another cable's run moves aside, clear of the runs
  out of and into the jacks too. Several cables from one jack part right
  after it; several into one jack join just before it.
- **On MOD's real pedalboard** (`nhe/features/constructor/`, preference
  `nhe-constructor`): SET → Builder (NHE / MOD, remembered per browser,
  MOD's by default; also the switch at the surface's top right, or
  `NHE.builder.set('nhe')`) shows the surface over MOD's builder, between
  its header and footer. The adapter reads the board (`mod.board()`:
  plugins, their ports, MOD's own ports, connections), follows it over
  the websocket (`mod.onBoardChange`), and writes through MOD's own calls
  (`mod.connect`, `mod.disconnect`, `mod.addPlugin`, `mod.movePlugin`).
  Cells are 600 × 520 canvas px from the top left pedal; MOD's positions
  snap to the nearest cell; where two land on one, the one already shown
  there (else the better fit) keeps it and the other takes the nearest
  free cell, on screen only. A move writes the cell back. A new pedal's
  span comes from its screenshot (the shape of its icon). The board is
  read once MOD has finished loading (its "Loading pedalboard…" gone).
  Rewire on a card tries "delete and reconnect". Wire colours and laid
  routes are kept per board in memory only.
- **Playing a face (desktop / large tablet):** faces are MOD's screenshots;
  a tap zooms one to 120% of MOD's icon size (less on a small screen: the
  pedal, its gear and its name always fit the view, also after a resize)
  and puts MOD's working
  icon (its modgui, borrowed off MOD's canvas: `mod.borrowIcon`) in the
  picture's place, so its knobs, switches and lists play as in MOD's
  builder. A press on one of its controls is the control's; a press on an
  empty part of the face pans, and held, lifts the pedal to move it (the
  icon goes back first). It stays live while panning; zooming out,
  tapping another face, lifting it or choosing MOD's builder gives the
  icon back to MOD's canvas.
- **Double click (or double tap) on the surface itself:** zooms out to
  show the whole grid.
- **Real jack positions:** on MOD the wires and sockets sit where the
  pedal's own jacks are: the adapter measures modgui's jack elements
  (`[mod-port]`, the ones MOD draws its cables to) against the icon, as
  fractions of its box (`jacks`), and the surface maps them onto the pedal
  within its screenshot (`faceSize`: MOD's screenshot has a margin round
  the pedal). Zoomed in, the live icon and the sockets line up exactly.
  Pedals without jack elements still get them spread down their sides.
- **The cable connectors** are NHE's drawings (NHE-MOD-UI/SVG "coming
  out" and "going-in"): a ribbed metal barrel, flat against the jack and
  rounded where the cable leaves, with a band in the cable's colour.
- **Jacks as on MOD's builder:** every jack is a metal nut on the pedal's
  side (inputs left, outputs right); a cable's connector sits past it, and
  the cable runs straight out of the connector (`LEAD`) before it bends,
  as far as the gap between pedals allows. While a cable is in the hand,
  every jack that takes it shows an arrow pointing in (past a connector
  already there), and the one it would go into, the nearest within reach
  of the jack or of where its connector would sit, shows chevrons in the
  accent colour. An output in use has MOD's spare jack: a smaller
  connector under its plug, half see-through, to pull another cable from;
  on a pair (stereo) the first one's sits above its plug, so the two keep
  clear of each other.
- The free cells' + circles are at 50% until hovered.
- **Phones held upright:** MOD's page is 980 px wide there, so NHE's
  builder is enlarged by `NHE.zoom` (about 1.8×, as NHE's other screens;
  with CSS zoom, not a transform, so its text stays sharp on iOS)
  and starts zoomed to about two and a half columns: the half column
  leaves room for the cables out to MOD's port tiles. The view can also pan
  160 px past the last column, so the cables down to MOD's outputs show.
- **Phones: tapping an input with nothing on it** (MOD's In tiles) opens
  the + dialog with that input ticked; the new pedal goes in the free
  cell nearest the board's start.
- **Notch / Dynamic Island** (a phone held sideways, the page under it):
  MOD's port tiles and the top row of buttons keep clear of it
  (`env(safe-area-inset-left / right)`); tiles held off the edge that
  way are rounded on all four corners.
- **Cards show the pedal's full-size picture** (MOD's screenshot), not its
  thumbnail: the thumbnails are about 40 × 64 px and blurred on a phone.
- **SET → Work surface** applies to NHE's builder too: "NHE constructor
  grid" (`calm-dark.jpg`, its holes lined up with the cells) by default,
  or another image from `nhe/backgrounds/`, or MOD's wood.
- **Touch:** a long press on the surface is the surface's: no iOS image
  menu or magnifier (`-webkit-touch-callout`), no Android context menu.
- A plugin without a picture of its own (MOD shows "No interface
  available") shows MOD's plain can (`resources/pedals/default.png`).
- A zoomed-in, live pedal keeps its picture's drop shadow.
- **Zooming in:** the pedals' names and makers, the connectors and the
  jacks' nuts don't grow past their own size: zoomed out they shrink with
  the pedals; zoomed in they stay put (a connector at most 44 px tall on
  screen, about MOD's port tiles); the name and maker hang right under the
  pedal itself, a few px below it. A cable into one of MOD's port tiles has
  its connector right against the tile.
- **Resizing** the window (or turning a tablet) moves MOD's port tiles to
  the new edges and draws the wires to them again; the grid keeps at least
  the screen's size.
- To come for the surface: bigger card text on a phone.
