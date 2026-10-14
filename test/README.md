# Tests

Playwright (Python) browser tests for the performance view. They drive MOD's real UI and check the acceptance criteria (spec: `specs/performance-view-ac.md` in the "MOD plugs" project).

| File | What |
|---|---|
| `test_performance.py` | 34 checks: entry/exit, scaling, signal order, snapping, keys, tap, strip, live sync, resize, remembered pedal, board switching |
| `test_hide.py` | 20 checks: hiding pedals, the "N hidden" tile and shelf, restore, persistence |
| `test_touch.py` | swipes, knob drags and taps with real touch events (CDP), prints results |
| `make_test_pedalboards.py` | creates the `Perf_Test` pedalboards they use (guitarix plugins) through mod-ui's HTTP API |

## Where they run

They were written against **mod-ui in dev mode** (`MOD_DEV_ENVIRONMENT=1`, fake audio host) with plugin data from `mod-audio/mod-lv2-data`. The pedalboards they load use guitarix plugins and file paths from that rig. Point them at a UI with:

```sh
BASE=http://localhost:18080/ PBS=/path/to/pedalboards/ python3 test/test_performance.py
```

Against MOD Desktop or a Duo, the pedalboard names, plugin set and paths differ: adapt `make_test_pedalboards.py` (plugin URIs) and `PBS` first. Optional: `DEBUG_PV=1` prints the performance view's trace when a board-switch check fails.
