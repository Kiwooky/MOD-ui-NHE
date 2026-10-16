# Tests

Playwright (Python) browser tests for the performance view. They drive MOD's real UI, with NHE loaded, and check the view's acceptance criteria (see `docs/performance-flip-spec.md` for the flip).

| File | What |
|---|---|
| `test_performance.py` | entry/exit, scaling, signal order, snapping, keys, tap, flip (the back, chain hop, Flip back), live sync between face and back, resize, remembered pedal, board switching |
| `test_hide.py` | hiding pedals, the "N hidden" tile and its grid, restore, persistence |
| `test_touch.py` | swipes, knob drags, taps and a swipe on a flipped pedal's back, with real touch events (CDP); prints results |
| `make_test_pedalboards.py` | creates the `Perf_Test` pedalboards they use (guitarix plugins) through mod-ui's HTTP API |

## Where they run

They were written against **mod-ui in dev mode** (`MOD_DEV_ENVIRONMENT=1`, fake audio host) with plugin data from `mod-audio/mod-lv2-data`. The pedalboards they load use guitarix plugins and file paths from that rig. Point them at a UI with:

```sh
BASE=http://localhost:18080/ PBS=/path/to/pedalboards/ python3 test/test_performance.py
```

Against MOD Desktop or a Duo, the pedalboard names, plugin set and paths differ: adapt `make_test_pedalboards.py` (plugin URIs) and `PBS` first. Optional: `DEBUG_PV=1` prints the performance view's trace when a board-switch check fails.

The flip checks were updated for the new performance view (Flip / Hide on the pedal, the back) but haven't been run against that rig since: expect to adjust timings or selectors on the first run.
