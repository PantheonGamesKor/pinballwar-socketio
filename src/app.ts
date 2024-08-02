// app.ts
import express from "express";
import { Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";

type HTTP_SERVER = HttpServer<
  //
  typeof IncomingMessage,
  typeof ServerResponse
>;

export const app = express();
// const server: HTTP_SERVER = http.createServer(app);

export function init_socket_io(server: HTTP_SERVER) {
  console.log("init_socket_io");
  const io = new Server(server);
  io.on("connection", (socket) => {
    console.log("a user connected");
    socket.emit("message", "hello");

    socket.on("message", (msg) => {
      console.log("message: ", msg);
      socket.emit("message", "echo " + msg);
    });
    socket.on("disconnect", () => {
      console.log("user disconnected");
    });
  });
}

app.get("/", (_req, res) => {
  res.send("ok");
});
