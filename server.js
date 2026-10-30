// Econudge back end: a small server that stores fake room data
// and answers requests from the web page.

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Fake data for now. Later, this is the part you replace with a real
// database or with commands sent to smart plugs.
function makeRooms() {
  return {
    "lab-204": {
      name: "Computer Lab 204",
      devices: [
        { id: "lights", name: "Ceiling lights", watts: 240, on: true },
        { id: "ac", name: "Air conditioner", watts: 1500, on: true },
        { id: "pcs", name: "12 desktop computers", watts: 1800, on: true },
        { id: "projector", name: "Projector", watts: 300, on: true },
      ],
    },
    "studyroom-najd library": {
      name: "Study Room",
      devices: [
        { id: "lights", name: "Ceiling lights", watts: 120, on: true },
        { id: "ac", name: "Air conditioner", watts: 900, on: true },
        { id: "screen", name: "Wall screen", watts: 150, on: true },
      ],
    },
    "hf-lab": {
      name: "Human Factors Lab",
      devices: [
        {id: "lights", name: "Ceiling lights", watts: 180, on: true},
        {id: "ac", name: "Air conditioner", watts: 900, on: true},
        {id: "screen", name: "Wall screen", watts: 150, on: true},
        {id: "pc", name: "Computers", watts: 600, on: true},
      ]
    }
  };
}
let rooms = makeRooms();

// 1) Send back one room's data.
app.get("/api/rooms/:id", (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json(room);
});

// 2) Switch every device in the room off.
app.post("/api/rooms/:id/shutdown", (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: "Room not found" });
  room.devices.forEach((device) => (device.on = false));
  res.json(room);
});

// 3) Demo only: turn everything back on so you can test again.
app.post("/api/reset", (req, res) => {
  rooms = makeRooms();
  res.json({ ok: true });
});

// The QR code points to /room/lab-204. Every room shows the same page;
// the page reads the room name from the address.
app.get("/room/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Econudge running: http://localhost:${PORT}/room/lab-204`));
