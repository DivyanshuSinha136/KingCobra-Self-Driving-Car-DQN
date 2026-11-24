# HTTP API

All responses are JSON (`Content-Type: application/json`, `Cache-Control: no-store`) except the static files. Errors have the shape
`{"error": "...", "status": 400}`. Game endpoints accept `?sid=<id>` (1–40 characters of `A-Z a-z 0-9 - _`); anything else falls back to
the shared `default` session. A **session** is one world (the ego car plus NPCs), its statistics and its chosen model; at most
`server.max_sessions` are kept, the least recently used is evicted first.

Actions are `(steer, pedal)`: steer `+1` left, `0` straight, `-1` right; pedal `0` gas, `1` coast, `2` brake/reverse, `3` handbrake.
The network's action index is `(1 − steer)·4 + pedal`.

| Method & path | Description |
|---|---|
| `GET /`, `GET /static/<file>` | dashboard and its assets (only files that exist in `web/`) |
| `GET /api/health` | `{status, version, uptime, sessions}` |
| `GET /api/models` | the loaded models: `{models: [{name, style, unseen_completion, unseen_speed}], default}` |
| `GET /api/model?model=<name>` | the model card (network, parameters, features, actions, evaluations on train/val/test tracks, config) |
| `GET /api/metrics?model=<name>` | learning curves: `{history: [{episode, steps, epsilon, train_progress, train_return, loss, eval_progress, eval_completion, seconds, steps_per_sec}]}` |
| `GET /api/tracks` | the track library: `{tracks: [{id, group: train\|val\|test, length}]}` |
| `GET /api/track?id=N` | road geometry for drawing: `{seed, half_width, length, left, right, center}` (any `id` 0–99999 works: roads are generated from their seed) |
| `GET /api/state` | the session's world (see below) |
| `POST /api/reset?track=&start=&npcs=&model=` | new run on a track, `start` sample index, `npcs` 0–`server.max_npcs`, driver `model` |
| `POST /api/ai-step` | one tick, the shared network drives **every** car; adds `decision: {action, name, q, human: false}` for the ego car |
| `POST /api/drive` | one tick with a human driving the ego car: body `{"steer": -1\|0\|1, "pedal": 0..3}`; NPCs still use the network |
| `GET /api/benchmark?group=test\|val\|train&starts=N&model=` | races the model and the rule-based driver on the same roads: `{ai, baseline}` summaries (`starts` ≤ `server.benchmark_max`) |
| `POST /api/shutdown` | stops the server; `403` unless started with `--set server.allow_shutdown=true` |

Wrong method → `405` with an `Allow` header; unknown path or model → `404`; malformed input → `400`.

## State object (abridged)

```json
{
  "track": 101, "model": "driver_ddqn", "npcs": 4, "time": 3.2,
  "cars": [
    { "id": 0, "x": 61.9, "y": -0.1, "theta": 1.52, "speed": 8.7, "vx": 8.7, "vy": 0.0, "omega": 0.11, "steer": 0.03,
      "slip": 0.0, "drifting": false, "gear": "D", "progress": 0.031, "steps": 32, "done": false, "cause": "",
      "lateral": 0.5, "scrapes": 0, "hits": 0, "action": 4, "rays": [10.2, 14.4, 40, 40, 40, 14.1, 10.3], "car_rays": [40, 40, 40, 40, 40, 40, 40] },
    { "id": 1, "...": "..." }
  ],
  "q": [4.4, 4.3, 4.1, 4.1, "... 12 values, steering-major: left, straight, right × gas, coast, brake/reverse, handbrake"],
  "best_action": 0,
  "features": [0.25, 0.36, "... 22 values, order = the model card's `features` list"],
  "session": { "runs": 0, "laps": 0, "best_lap": null, "drift_seconds": 0.0 }
}
```

`cars[0]` is the ego car; `q`, `best_action` and `features` describe the ego car's current observation. `cause` is `""`, `lap`, `stuck`,
`reverse`, `wrecked` or `timeout`. `rays` are the road lidar distances (m, 40 = nothing in range); `car_rays` the radar sectors. Both run
left → right (+90° … −90°).

## Security notes

* The server binds to `127.0.0.1` by default. Use `--host 0.0.0.0` deliberately; there is no authentication.
* Every response carries `Content-Security-Policy` (scripts and styles only from the same origin), `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer`.
* Static files are served from an in-memory map built at start-up, so there is no path to traverse.
* Shutdown over HTTP is opt-in.
