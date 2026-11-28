// EcoNudge back end (simulator version).
// Rooms live in memory. "People in the room" is simulated with buttons on the demo panel.
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Numbers you can change from the demo panel. SAR price is an ASSUMED rate: check it before you report it.
const DEFAULTS = { countdownSec: 30, idleMin: 20, sarPerKwh: 0.2, laptopWatts: 50, overnightHours: 12 };
const settings = { ...DEFAULTS };

// tier = who may switch the device off ("student" or "staff"). critical = never switched off by EcoNudge.
const dev = (id, name, watts, tier, critical = false) => ({ id, name, watts, tier, critical, on: true });
const room = (name, type, people, devices) => ({ name, type, people, devices, lastMotion: Date.now(), pending: null });

function makeRooms() {
  return {
    "lab-204": room("Computer Lab 204", "lab", 2, [
      dev("lights", "Ceiling lights", 240, "student"),
      dev("ac", "Air conditioner", 1500, "student"),
      dev("pcs", "12 desktop computers", 1800, "staff"),
      dev("projector", "Projector", 300, "staff"),
      dev("net", "Network switch", 60, "staff", true),
    ]),
    "studyroom-najd-library": room("Study Room", "study", 1, [
      dev("lights", "Ceiling lights", 120, "student"),
      dev("ac", "Air conditioner", 900, "student"),
      dev("screen", "Wall screen", 150, "student"),
    ]),
    "hf-lab": room("Human Factors Lab", "lab", 2, [
      dev("lights", "Ceiling lights", 180, "student"),
      dev("ac", "Air conditioner", 900, "student"),
      dev("screen", "Wall screen", 150, "student"),
      dev("pc", "Computers", 600, "staff"),
    ]),
  };
}
let rooms = makeRooms();
const log = []; // newest first: what happened, for the demo panel and the report

function note(roomId, text) {
  log.unshift({ t: Date.now(), room: roomId, text });
  log.length = Math.min(log.length, 100);
}

// Switch off every non-critical device this role is allowed to switch off.
function switchOff(id, role, why) {
  const r = rooms[id];
  r.devices.forEach((d) => {
    if (d.on && !d.critical && (role === "staff" || d.tier === "student")) d.on = false;
  });
  r.pending = null;
  note(id, why);
}

// What the web page receives for one room.
function view(id) {
  const r = rooms[id];
  const now = Date.now();
  const watts = r.devices.filter((d) => d.on && !d.critical).reduce((sum, d) => sum + d.watts, 0);
  const idleSec = Math.floor((now - r.lastMotion) / 1000);
  const waiting = r.people === 0 && watts > 0;
  return {
    id, name: r.name, type: r.type, people: r.people, devices: r.devices, watts, settings,
    countdown: r.pending ? Math.max(0, Math.ceil((r.pending.endsAt - now) / 1000)) : null,
    autoOffIn: waiting ? Math.max(0, settings.idleMin * 60 - idleSec) : null,
    log: log.filter((l) => l.room === id).slice(0, 8),
  };
}

const exists = (req, res, next) =>
  rooms[req.params.id] ? next() : res.status(404).json({ error: "Room not found" });

// 1) Read one room.
app.get("/api/rooms/:id", exists, (req, res) => res.json(view(req.params.id)));

// 2) Someone pressed "Switch off". If people are inside, start a cancelable countdown first.
app.post("/api/rooms/:id/shutdown", exists, (req, res) => {
  const id = req.params.id;
  const r = rooms[id];
  const role = req.body.role === "staff" ? "staff" : "student";
  if (r.people > 0) {
    r.pending = { endsAt: Date.now() + settings.countdownSec * 1000, role };
    note(id, `${role} pressed the button. ${r.people} detected, ${settings.countdownSec} s to cancel`);
  } else {
    switchOff(id, role, `${role} switched off an empty room`);
  }
  res.json(view(id));
});

// 3) Cancel a countdown.
app.post("/api/rooms/:id/cancel", exists, (req, res) => {
  const id = req.params.id;
  if (rooms[id].pending) {
    rooms[id].pending = null;
    note(id, "Shutdown canceled");
  }
  res.json(view(id));
});

// 4) Simulator: a person enters or leaves the room.
app.post("/api/rooms/:id/sim", exists, (req, res) => {
  const id = req.params.id;
  const r = rooms[id];
  if (req.body.action === "enter") r.people++;
  else if (req.body.action === "leave" && r.people > 0) r.people--;
  else return res.json(view(id));
  r.lastMotion = Date.now();
  note(id, req.body.action === "enter" ? "Person entered" : "Person left");
  res.json(view(id));
});

// 5) Demo settings (for example a faster countdown) and reset.
app.post("/api/settings", (req, res) => {
  for (const k of ["countdownSec", "idleMin", "sarPerKwh"]) {
    const v = Number(req.body[k]);
    if (v > 0) settings[k] = v;
  }
  res.json(settings);
});
app.post("/api/reset", (req, res) => {
  rooms = makeRooms();
  Object.assign(settings, DEFAULTS);
  log.length = 0;
  res.json({ ok: true });
});

// Every second: finish countdowns, and switch off rooms that stayed empty too long.
setInterval(() => {
  const now = Date.now();
  for (const id in rooms) {
    const r = rooms[id];
    if (r.pending && now >= r.pending.endsAt) {
      switchOff(id, r.pending.role, "Countdown finished: devices switched off");
    } else if (
      r.people === 0 &&
      now - r.lastMotion >= settings.idleMin * 60000 &&
      r.devices.some((d) => d.on && !d.critical)
    ) {
      switchOff(id, "staff", `Empty for ${settings.idleMin} min: automatic shutoff`);
    }
  }
}, 1000);

// The QR code or NFC tag points to /room/lab-204. Add ?demo=1 to see the simulator panel.
app.get("/room/:id", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EcoNudge running: http://localhost:${PORT}/room/lab-204?demo=1`));
