// app.ts
import express from "express";
import {
  //
  WebSocket,
} from "./types_sock";
import {
  //
  on_connection,
  on_update_client,
  on_update_waitroot,
} from "./ws";
import { HttpServer2, WSServer } from "./types_sock";
import { DummyClient } from "./lib/DummyClient";

export const app = express();
// const server: HTTP_SERVER = http.createServer(app);

app.get("/", (_req, res) => {
  res.send("ok");
});

var start_dummy_user_uid = 1;
const max_dummy_count = 10;
export function init_socket_io(server: HttpServer2) {
  console.log("init_socket_io start");

  const io = new WSServer(server);
  io.on("connection", on_connection);

  // 접속자 업데이트
  setInterval(on_update_client, 1000 * 5);

  // 대기방 업데이트
  setInterval(on_update_waitroot, 1000 * 3);

  // dummy 생성
  for (var i = 0; i < max_dummy_count; i++) {
    var dummy = new DummyClient();
    dummy.dummy_user_uid = start_dummy_user_uid + i;
    dummy.is_dummy = true;

    var c: any = dummy;
    on_connection(c as WebSocket);
  }
}
